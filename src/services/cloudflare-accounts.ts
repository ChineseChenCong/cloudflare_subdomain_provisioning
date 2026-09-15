import type { Env, CloudflareAccount, DomainConfig } from "../types";
import { encryptText, decryptText } from "./crypto";
import { mirrorSyncRow } from "./mirror";
import {
  verifyToken,
  listDnsRecords,
  createDnsRecord as cfCreateDnsRecord,
  updateDnsRecord as cfUpdateDnsRecord,
  deleteDnsRecord as cfDeleteDnsRecord,
} from "./cloudflare";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * 获取用户的 Cloudflare 账户列表
 */
export async function getUserAccounts(
  db: D1Database,
  env: { ENCRYPTION_KEY?: string },
  userId: number,
): Promise<(CloudflareAccount & { api_token_decrypted?: string })[]> {
  const result = await db
    .prepare(
      "SELECT * FROM cloudflare_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
    )
    .bind(userId)
    .all<CloudflareAccount>();

  const accounts: (CloudflareAccount & { api_token_decrypted?: string })[] = [];

  for (const account of result.results) {
    const decrypted = await decryptToken(env, account);
    accounts.push({
      ...account,
      api_token_decrypted: decrypted || "",
    });
  }

  return accounts;
}

/**
 * 获取用户的默认 Cloudflare 账户
 */
export async function getDefaultAccount(
  db: D1Database,
  env: { ENCRYPTION_KEY?: string },
  userId: number,
): Promise<(CloudflareAccount & { api_token: string }) | null> {
  const result = await db
    .prepare(
      "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1",
    )
    .bind(userId)
    .first<CloudflareAccount>();

  if (!result) return null;

  const decrypted = await decryptToken(env, result);
  if (!decrypted) return null;

  return { ...result, api_token: decrypted };
}

/**
 * 获取用户的活跃 Cloudflare 账户（用于域名解析）
 */
export async function getActiveAccounts(
  db: D1Database,
  env: { ENCRYPTION_KEY?: string },
  userId: number,
): Promise<{ account: CloudflareAccount; token: string }[]> {
  const result = await db
    .prepare(
      "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at ASC",
    )
    .bind(userId)
    .all<CloudflareAccount>();

  const accounts: { account: CloudflareAccount; token: string }[] = [];

  for (const account of result.results) {
    const decrypted = await decryptToken(env, account);
    if (decrypted) {
      accounts.push({ account, token: decrypted });
    }
  }

  return accounts;
}

/**
 * 创建 Cloudflare 账户
 */
export async function createAccount(
  db: D1Database,
  env: Env,
  userId: number,
  accountName: string,
  apiToken: string,
  zoneId?: string,
): Promise<CloudflareAccount> {
  // 验证 API Token
  const isValid = await verifyToken(apiToken);
  if (!isValid) {
    throw new Error("Cloudflare API Token 无效或已过期");
  }

  // 加密 API Token
  const encryptedToken = await encryptText(env, apiToken);
  if (!encryptedToken) {
    throw new Error("加密 API Token 失败");
  }

  // 如果没有提供 zoneId，尝试从第一个域名自动获取
  let finalZoneId = zoneId;
  if (!finalZoneId && env.DOMAINS) {
    const domains = env.DOMAINS.split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (domains.length > 0) {
      const zoneId = await resolveZoneId(apiToken, domains[0]);
      if (zoneId) {
        finalZoneId = zoneId;
      }
    }
  }

  // 如果是第一个账户，设为默认
  const countResult = await db
    .prepare(
      "SELECT COUNT(*) as count FROM cloudflare_accounts WHERE user_id = ?",
    )
    .bind(userId)
    .first<{ count: number }>();

  const isDefault = !countResult || countResult.count === 0;

  // 如果是默认账户，清除其他默认
  if (isDefault) {
    await db
      .prepare(
        "UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?",
      )
      .bind(userId)
      .run();
  }

  const result = await db
    .prepare(
      `INSERT INTO cloudflare_accounts (user_id, account_name, api_token, zone_id, is_active, is_default)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .bind(
      userId,
      accountName,
      encryptedToken,
      finalZoneId ?? null,
      isDefault ? 1 : 0,
    )
    .run();

  const id = result.meta.last_row_id;
  const account = await getAccountById(db, userId, id as number);
  if (!account) throw new Error("Failed to create account");

  // write-through：镜像侧新增该账户行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(env, "cloudflare_accounts", id as number).catch(() => {});

  return account;
}

/**
 * 更新 Cloudflare 账户
 */
export async function updateAccount(
  db: D1Database,
  env: Env,
  userId: number,
  accountId: number,
  updates: {
    account_name?: string;
    api_token?: string;
    zone_id?: string;
    is_active?: boolean;
    is_default?: boolean;
  },
): Promise<CloudflareAccount> {
  const existing = await getAccountById(db, userId, accountId);
  if (!existing) {
    throw new Error("账户不存在");
  }

  // 如果要更新 API Token，需要验证
  if (updates.api_token) {
    const isValid = await verifyToken(updates.api_token);
    if (!isValid) {
      throw new Error("Cloudflare API Token 无效或已过期");
    }
  }

  // 如果要设为默认，清除其他默认
  if (updates.is_default) {
    await db
      .prepare(
        "UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?",
      )
      .bind(userId)
      .run();
  }

  // 构建更新语句
  const setParts: string[] = [];
  const values: any[] = [];

  if (updates.account_name !== undefined) {
    setParts.push("account_name = ?");
    values.push(updates.account_name);
  }

  if (updates.api_token !== undefined) {
    const encrypted = await encryptText(env, updates.api_token);
    if (!encrypted) {
      throw new Error("加密 API Token 失败");
    }
    setParts.push("api_token = ?");
    values.push(encrypted);
  }

  if (updates.zone_id !== undefined) {
    setParts.push("zone_id = ?");
    values.push(updates.zone_id);
  }

  if (updates.is_active !== undefined) {
    setParts.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }

  if (updates.is_default !== undefined) {
    setParts.push("is_default = ?");
    values.push(updates.is_default ? 1 : 0);
  }

  setParts.push('updated_at = datetime("now")');

  if (setParts.length === 1) {
    return existing;
  }

  values.push(userId, accountId);

  await db
    .prepare(
      `UPDATE cloudflare_accounts SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`,
    )
    .bind(...values)
    .run();

  const updated = await getAccountById(db, userId, accountId);
  if (!updated) throw new Error("Failed to update account");

  // write-through：镜像侧更新该账户行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(env, "cloudflare_accounts", accountId).catch(() => {});

  return updated;
}

/**
 * 删除 Cloudflare 账户
 */
export async function deleteAccount(
  db: D1Database,
  userId: number,
  accountId: number,
): Promise<void> {
  const account = await getAccountById(db, userId, accountId);
  if (!account) {
    throw new Error("账户不存在");
  }

  await db
    .prepare("DELETE FROM cloudflare_accounts WHERE user_id = ? AND id = ?")
    .bind(userId, accountId)
    .run();

  // 如果删除的是默认账户，将第一个活跃账户设为默认
  if (account.is_default) {
    const firstActive = await db
      .prepare(
        "SELECT id FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1",
      )
      .bind(userId)
      .first<{ id: number }>();

    if (firstActive) {
      await db
        .prepare(
          "UPDATE cloudflare_accounts SET is_default = 1 WHERE user_id = ? AND id = ?",
        )
        .bind(userId, firstActive.id)
        .run();
    }
  }
}

/**
 * 获取账户详情（不包含解密后的 token）
 */
export async function getAccountById(
  db: D1Database,
  userId: number,
  accountId: number,
): Promise<CloudflareAccount | null> {
  return db
    .prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?")
    .bind(userId, accountId)
    .first<CloudflareAccount>();
}

/**
 * 解密账户 API Token
 */
export async function decryptToken(
  env: { ENCRYPTION_KEY?: string },
  account: CloudflareAccount,
): Promise<string | null> {
  // 先检查是否已经是明文（兼容旧数据）
  if (
    !account.api_token.startsWith("{") &&
    !account.api_token.includes("+") &&
    !account.api_token.includes("/")
  ) {
    return account.api_token;
  }

  return decryptText(env, account.api_token);
}

/**
 * 解析 Zone ID
 */
async function resolveZoneId(
  apiToken: string,
  domain: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = (await response.json()) as {
      success: boolean;
      result: Array<{ id: string; name: string }>;
    };

    if (data.success && data.result.length > 0) {
      return data.result[0].id;
    }
  } catch (err) {
    console.error(`Failed to resolve zone ID for ${domain}:`, err);
  }

  return null;
}

/**
 * 从用户绑定的多个 Cloudflare 账户中解析域名的 Zone ID
 * 不再依赖全局 CF_API_TOKEN
 * 返回 { zoneId, token } 或 null
 */
export async function resolveZoneIdAndTokenFromAccounts(
  accounts: { account: CloudflareAccount; token: string }[],
  domain: string,
): Promise<{ zoneId: string; token: string } | null> {
  // 优先从账户缓存的 zone_id 匹配
  for (const { account, token } of accounts) {
    if (account.zone_id && account.zone_id.trim() !== "") {
      const matched = await verifyZoneIdForDomain(
        token,
        account.zone_id,
        domain,
      );
      if (matched) {
        return { zoneId: account.zone_id, token };
      }
    }
  }

  // 如果都没命中，遍历账户逐个解析
  for (const { token } of accounts) {
    const zoneId = await resolveZoneId(token, domain);
    if (zoneId) {
      return { zoneId, token };
    }
  }

  return null;
}

/**
 * 验证 Zone ID 是否属于指定域名
 */
async function verifyZoneIdForDomain(
  apiToken: string,
  zoneId: string,
  domain: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = (await response.json()) as {
      success: boolean;
      result: { id: string; name: string };
    };

    return data.success && data.result.name === domain;
  } catch {
    return false;
  }
}

/**
 * 使用指定账户创建 DNS 记录
 */
export async function createDnsRecordWithAccount(
  apiToken: string,
  zoneId: string,
  record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
    proxied?: boolean;
  },
) {
  return cfCreateDnsRecord(apiToken, zoneId, record);
}

/**
 * 使用指定账户更新 DNS 记录
 */
export async function updateDnsRecordWithAccount(
  apiToken: string,
  zoneId: string,
  recordId: string,
  record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
    proxied?: boolean;
  },
) {
  return cfUpdateDnsRecord(apiToken, zoneId, recordId, record);
}

/**
 * 使用指定账户删除 DNS 记录
 */
export async function deleteDnsRecordWithAccount(
  apiToken: string,
  zoneId: string,
  recordId: string,
) {
  return cfDeleteDnsRecord(apiToken, zoneId, recordId);
}
