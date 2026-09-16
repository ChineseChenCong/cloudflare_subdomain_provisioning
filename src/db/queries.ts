import type {
  Env,
  User,
  Subdomain,
  DnsRecord,
  CloudflareAccount,
  EmailVerification,
  Announcement,
  OwnerApproval,
} from "../types";
import { getStorageOrder, mysqlSelect, sqliteSelect } from "./provider";
import { mirrorSyncRow } from "../services/mirror";

export interface FriendLinkWithId {
  id: number;
  name: string;
  url: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

// ==================== 后端读回退链（provider 镜像优先，失败回退 D1） ====================
// 优先走 DB_QUERY_ORDER 中启用且已配置的镜像（mysql / custom-sqlite）；镜像未配置/失败时回退 env.DB。
// 仅用于查询；写操作仍走 D1（唯一写主）。

function pickReadBackend(env: Env): string | null {
  const order = getStorageOrder(env);
  for (const b of order) {
    if (b === "mysql" && env.HYPERDRIVE) return "mysql";
    if (b === "custom-sqlite" && env.CUSTOM_SQLITE_URL) return "custom-sqlite";
  }
  return null;
}

async function dbFirst<T>(
  env: Env,
  sql: string,
  args: unknown[],
): Promise<T | null> {
  const backend = pickReadBackend(env);
  if (backend === "mysql" || backend === "custom-sqlite") {
    const rows =
      backend === "mysql"
        ? await mysqlSelect(env, sql, args)
        : await sqliteSelect(env, sql, args);
    // 镜像后端故障（返回 null：未配置/连接失败/HTTP 非 2xx）→ 回退 D1 兜底；
    // 镜像正常但空（[]）→ 视为“镜像确认无该行”，保持空（读优先镜像的既定语义）。
    if (rows === null || rows === undefined) {
      try {
        return await env.DB.prepare(sql)
          .bind(...args)
          .first<T>();
      } catch {
        return null;
      }
    }
    return (rows[0] as T | undefined) ?? null;
  }
  try {
    return await env.DB.prepare(sql)
      .bind(...args)
      .first<T>();
  } catch {
    return null;
  }
}

async function dbAll<T>(env: Env, sql: string, args: unknown[]): Promise<T[]> {
  const backend = pickReadBackend(env);
  if (backend === "mysql" || backend === "custom-sqlite") {
    const rows =
      backend === "mysql"
        ? await mysqlSelect(env, sql, args)
        : await sqliteSelect(env, sql, args);
    // 镜像后端故障（null）→ 回退 D1 兜底；镜像正常但空（[]）→ 保持空。
    if (rows === null || rows === undefined) {
      try {
        const r = await env.DB.prepare(sql)
          .bind(...args)
          .all<T>();
        return r.results || [];
      } catch {
        return [];
      }
    }
    return rows as T[];
  }
  try {
    const r = await env.DB.prepare(sql)
      .bind(...args)
      .all<T>();
    return r.results || [];
  } catch {
    return [];
  }
}

/** D1 直查（不经过镜像回退链）。仅用于写/删函数内部的权威反查：数据刚写入 D1，D1 是唯一权威，
 *  读镜像会与镜像同步的时序竞态（镜像尚未同步 → 空 → 误判）。 */
async function d1First<T>(
  env: Env,
  sql: string,
  args: unknown[],
): Promise<T | null> {
  try {
    return await env.DB.prepare(sql)
      .bind(...args)
      .first<T>();
  } catch {
    return null;
  }
}

async function d1All<T>(env: Env, sql: string, args: unknown[]): Promise<T[]> {
  try {
    const r = await env.DB.prepare(sql)
      .bind(...args)
      .all<T>();
    return r.results || [];
  } catch {
    return [];
  }
}

// ==================== Users ====================

export async function findUserByGitHubId(
  env: Env,
  githubId: number,
): Promise<User | null> {
  return dbFirst<User>(env, "SELECT * FROM users WHERE github_id = ?", [
    githubId,
  ]);
}

export async function findUserById(env: Env, id: number): Promise<User | null> {
  return dbFirst<User>(env, "SELECT * FROM users WHERE id = ?", [id]);
}

export async function upsertUser(
  env: Env,
  githubId: number,
  githubUsername: string,
  avatarUrl: string | null,
  email: string | null,
  isAdmin: boolean,
): Promise<User> {
  await env.DB.prepare(
    `INSERT INTO users (github_id, github_username, avatar_url, email, is_admin)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET
         github_username = excluded.github_username,
         avatar_url = excluded.avatar_url,
         email = excluded.email,
         is_admin = CASE WHEN excluded.is_admin = 1 THEN 1 ELSE users.is_admin END,
         updated_at = datetime('now')`,
  )
    .bind(githubId, githubUsername, avatarUrl, email, isAdmin ? 1 : 0)
    .run();

  const user = await d1First<User>(env, "SELECT * FROM users WHERE github_id = ?", [
    githubId,
  ]);
  if (!user) throw new Error("Failed to upsert user");
  await mirrorSyncRow(env, "users", user.id).catch(() => {});
  return user;
}

export async function updateUserEmailVerified(
  env: Env,
  userId: number,
  emailVerified: boolean,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE users SET email_verified = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(emailVerified ? 1 : 0, userId)
    .run();
  await mirrorSyncRow(env, "users", userId).catch(() => {});
}

export async function updateUserEmail(
  env: Env,
  userId: number,
  email: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE users SET email = ?, email_verified = 0, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(email, userId)
    .run();
  await mirrorSyncRow(env, "users", userId).catch(() => {});
}

// ==================== Subdomains ====================

export async function getUserSubdomains(
  env: Env,
  userId: number,
): Promise<Subdomain[]> {
  return dbAll<Subdomain>(
    env,
    "SELECT * FROM subdomains WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
}

export async function getSubdomainById(
  env: Env,
  id: number,
): Promise<Subdomain | null> {
  return dbFirst<Subdomain>(env, "SELECT * FROM subdomains WHERE id = ?", [id]);
}

export async function findSubdomain(
  env: Env,
  subdomain: string,
  domain: string,
): Promise<Subdomain | null> {
  return dbFirst<Subdomain>(
    env,
    "SELECT * FROM subdomains WHERE subdomain = ? AND domain = ?",
    [subdomain, domain],
  );
}

export async function countUserSubdomains(
  env: Env,
  userId: number,
): Promise<number> {
  const result = await dbFirst<{ count: number }>(
    env,
    "SELECT COUNT(*) as count FROM subdomains WHERE user_id = ? AND status != ?",
    [userId, "rejected"],
  );
  return result?.count || 0;
}

export async function createSubdomain(
  env: Env,
  userId: number,
  subdomain: string,
  domain: string,
): Promise<Subdomain> {
  await env.DB.prepare(
    "INSERT INTO subdomains (user_id, subdomain, domain) VALUES (?, ?, ?)",
  )
    .bind(userId, subdomain, domain)
    .run();

  const record = await d1First<Subdomain>(
    env,
    "SELECT * FROM subdomains WHERE subdomain = ? AND domain = ?",
    [subdomain, domain],
  );
  if (!record) throw new Error("Failed to create subdomain");
  await mirrorSyncRow(env, "subdomains", record.id).catch(() => {});
  return record;
}

export async function deleteSubdomain(env: Env, id: number): Promise<void> {
  // 先获取要删除的记录（用于镜像同步，D1 权威直查）
  const record = await d1First<Subdomain>(
    env,
    "SELECT * FROM subdomains WHERE id = ?",
    [id],
  );

  await env.DB.prepare("DELETE FROM subdomains WHERE id = ?").bind(id).run();

  // 同步删除到镜像
  if (record) {
    await mirrorSyncRow(env, "subdomains", id).catch(() => {});
  }
}

// ==================== Review Workflow ====================

export async function approveSubdomain(
  env: Env,
  id: number,
  reviewedBy: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE subdomains SET status = 'approved', reject_reason = NULL, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`,
  )
    .bind(reviewedBy, id)
    .run();
  await mirrorSyncRow(env, "subdomains", id).catch(() => {});
}

export async function rejectSubdomain(
  env: Env,
  id: number,
  reviewedBy: number,
  reason: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE subdomains SET status = 'rejected', reject_reason = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`,
  )
    .bind(reason, reviewedBy, id)
    .run();
  await mirrorSyncRow(env, "subdomains", id).catch(() => {});
}

export async function getPendingSubdomains(
  env: Env,
): Promise<(Subdomain & { github_username: string; email: string | null })[]> {
  return dbAll<Subdomain & { github_username: string; email: string | null }>(
    env,
    `SELECT s.*, u.github_username, u.email FROM subdomains s
     JOIN users u ON s.user_id = u.id
     WHERE s.status = 'pending'
     ORDER BY s.created_at ASC`,
    [],
  );
}

// ==================== DNS Records ====================

export async function getSubdomainRecords(
  env: Env,
  subdomainId: number,
): Promise<DnsRecord[]> {
  return dbAll<DnsRecord>(
    env,
    "SELECT * FROM dns_records WHERE subdomain_id = ? ORDER BY record_type, name",
    [subdomainId],
  );
}

export async function countSubdomainRecords(
  env: Env,
  subdomainId: number,
): Promise<number> {
  const result = await dbFirst<{ count: number }>(
    env,
    "SELECT COUNT(*) as count FROM dns_records WHERE subdomain_id = ?",
    [subdomainId],
  );
  return result?.count || 0;
}

/** 写操作前的权威定位：直接查 D1（绑定 CD 或自增主键 id，D1 为唯一权威，避免读镜像缺行误判“不存在”） */
export async function getDnsRecordById(
  env: Env,
  id: number,
): Promise<DnsRecord | null> {
  return d1First<DnsRecord>(env, "SELECT * FROM dns_records WHERE id = ?", [
    id,
  ]);
}

/** 按 Cloudflare 记录 ID 反查（DNS 实时读取模式下，更新/删除以 CF id 定位；D1 权威直查） */
export async function getDnsRecordByCfId(
  env: Env,
  subdomainId: number,
  cfRecordId: string,
): Promise<DnsRecord | null> {
  return d1First<DnsRecord>(
    env,
    "SELECT * FROM dns_records WHERE subdomain_id = ? AND cf_record_id = ?",
    [subdomainId, cfRecordId],
  );
}

export async function createDnsRecordEntry(
  env: Env,
  subdomainId: number,
  cfRecordId: string,
  recordType: string,
  name: string,
  content: string,
  ttl: number,
  priority: number | null,
  proxied: boolean,
  comment: string | null,
): Promise<DnsRecord> {
  const result = await env.DB.prepare(
    `INSERT INTO dns_records (subdomain_id, cf_record_id, record_type, name, content, ttl, priority, proxied, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      subdomainId,
      cfRecordId,
      recordType,
      name,
      content,
      ttl,
      priority,
      proxied ? 1 : 0,
      comment,
    )
    .run();

  const id = result.meta.last_row_id;
  const record = await d1First<DnsRecord>(
    env,
    "SELECT * FROM dns_records WHERE id = ?",
    [id as number],
  );
  if (!record) throw new Error("Failed to create DNS record entry");
  await mirrorSyncRow(env, "dns_records", record.id).catch(() => {});
  return record;
}

export async function updateDnsRecordEntry(
  env: Env,
  id: number,
  cfRecordId: string,
  recordType: string,
  name: string,
  content: string,
  ttl: number,
  priority: number | null,
  proxied: boolean,
  comment: string | null,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE dns_records SET cf_record_id = ?, record_type = ?, name = ?, content = ?, ttl = ?, priority = ?, proxied = ?, comment = ?, updated_at = datetime('now')
       WHERE id = ?`,
  )
    .bind(
      cfRecordId,
      recordType,
      name,
      content,
      ttl,
      priority,
      proxied ? 1 : 0,
      comment,
      id,
    )
    .run();
  await mirrorSyncRow(env, "dns_records", id).catch(() => {});
}

export async function deleteDnsRecordEntry(
  env: Env,
  id: number,
): Promise<void> {
  // 先获取要删除的记录（用于镜像同步，D1 权威直查）
  const record = await d1First<DnsRecord>(
    env,
    "SELECT * FROM dns_records WHERE id = ?",
    [id],
  );

  await env.DB.prepare("DELETE FROM dns_records WHERE id = ?").bind(id).run();

  // 同步删除到镜像
  if (record) {
    await mirrorSyncRow(env, "dns_records", id).catch(() => {});
  }
}

export async function deleteAllRecordsForSubdomain(
  env: Env,
  subdomainId: number,
): Promise<DnsRecord[]> {
  const records = await d1All<DnsRecord>(
    env,
    "SELECT * FROM dns_records WHERE subdomain_id = ?",
    [subdomainId],
  );
  await env.DB.prepare("DELETE FROM dns_records WHERE subdomain_id = ?")
    .bind(subdomainId)
    .run();

  // 批量同步删除到镜像（每条记录单独删除）
  for (const record of records) {
    await mirrorSyncRow(env, "dns_records", record.id).catch(() => {});
  }

  return records;
}

// ==================== Admin ====================

export async function getAllSubdomains(
  env: Env,
): Promise<(Subdomain & { github_username: string; email: string | null })[]> {
  return dbAll<Subdomain & { github_username: string; email: string | null }>(
    env,
    `SELECT s.*, u.github_username, u.email FROM subdomains s
     JOIN users u ON s.user_id = u.id
     WHERE s.status != 'rejected'
     ORDER BY s.created_at DESC`,
    [],
  );
}

export async function getAllUsers(env: Env): Promise<User[]> {
  return dbAll<User>(env, "SELECT * FROM users ORDER BY created_at DESC", []);
}

// ==================== Cloudflare Accounts ====================

export async function getCloudflareAccounts(
  env: Env,
  userId: number,
): Promise<CloudflareAccount[]> {
  return dbAll<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
    [userId],
  );
}

export async function getCloudflareAccountById(
  env: Env,
  userId: number,
  accountId: number,
): Promise<CloudflareAccount | null> {
  return dbFirst<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
    [userId, accountId],
  );
}

export async function getDefaultCloudflareAccount(
  env: Env,
  userId: number,
): Promise<CloudflareAccount | null> {
  return dbFirst<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1",
    [userId],
  );
}

export async function createCloudflareAccount(
  env: Env,
  userId: number,
  accountName: string,
  encryptedApiToken: string,
  zoneId: string | null,
  isDefault: boolean,
): Promise<CloudflareAccount> {
  if (isDefault) {
    await env.DB.prepare(
      "UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?",
    )
      .bind(userId)
      .run();
  }

  const result = await env.DB.prepare(
    `INSERT INTO cloudflare_accounts (user_id, account_name, api_token, zone_id, is_active, is_default)
       VALUES (?, ?, ?, ?, 1, ?)`,
  )
    .bind(userId, accountName, encryptedApiToken, zoneId, isDefault ? 1 : 0)
    .run();

  const id = result.meta.last_row_id;
  const account = await d1First<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
    [userId, id as number],
  );
  if (!account) throw new Error("Failed to create cloudflare account");
  await mirrorSyncRow(env, "cloudflare_accounts", account.id).catch(() => {});
  return account;
}

export async function updateCloudflareAccount(
  env: Env,
  userId: number,
  accountId: number,
  updates: {
    account_name?: string;
    api_token?: string;
    zone_id?: string | null;
    is_active?: boolean;
    is_default?: boolean;
  },
): Promise<CloudflareAccount> {
  const existing = await d1First<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
    [userId, accountId],
  );
  if (!existing) {
    throw new Error("Cloudflare 账户不存在");
  }

  if (updates.is_default) {
    await env.DB.prepare(
      "UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?",
    )
      .bind(userId)
      .run();
  }

  const setParts: string[] = [];
  const values: any[] = [];

  if (updates.account_name !== undefined) {
    setParts.push("account_name = ?");
    values.push(updates.account_name);
  }
  if (updates.api_token !== undefined) {
    setParts.push("api_token = ?");
    values.push(updates.api_token);
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

  await env.DB.prepare(
    `UPDATE cloudflare_accounts SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await d1First<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
    [userId, accountId],
  );
  if (!updated) throw new Error("Failed to update cloudflare account");
  await mirrorSyncRow(env, "cloudflare_accounts", accountId).catch(() => {});
  return updated;
}

export async function deleteCloudflareAccount(
  env: Env,
  userId: number,
  accountId: number,
): Promise<void> {
  const account = await d1First<CloudflareAccount>(
    env,
    "SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
    [userId, accountId],
  );
  if (!account) {
    throw new Error("Cloudflare 账户不存在");
  }

  await env.DB.prepare(
    "DELETE FROM cloudflare_accounts WHERE user_id = ? AND id = ?",
  )
    .bind(userId, accountId)
    .run();

  if (account.is_default) {
    const firstActive = await env.DB.prepare(
      "SELECT id FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1",
    )
      .bind(userId)
      .first<{ id: number }>();

    if (firstActive) {
      await env.DB.prepare(
        "UPDATE cloudflare_accounts SET is_default = 1 WHERE user_id = ? AND id = ?",
      )
        .bind(userId, firstActive.id)
        .run();
      await mirrorSyncRow(env, "cloudflare_accounts", firstActive.id).catch(() => {});
    }
  }
  // 同步删除到镜像
  await mirrorSyncRow(env, "cloudflare_accounts", accountId).catch(() => {});
}

// ==================== Email Verifications ====================

export async function createEmailVerificationRecord(
  env: Env,
  userId: number,
  email: string,
  token: string,
): Promise<EmailVerification> {
  await env.DB.prepare(
    "DELETE FROM user_email_verifications WHERE user_id = ? AND email = ?",
  )
    .bind(userId, email)
    .run();

  const result = await env.DB.prepare(
    `INSERT INTO user_email_verifications (user_id, email, verification_token, is_verified, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`,
  )
    .bind(userId, email, token)
    .run();

  const id = result.meta.last_row_id;

  await mirrorSyncRow(env, "user_email_verifications", id as number).catch(() => {});

  return {
    id: id as number,
    user_id: userId,
    email,
    verification_token: token,
    is_verified: 0,
    verified_at: null,
    created_at: new Date().toISOString(),
  };
}

export async function verifyEmailByToken(
  env: Env,
  token: string,
): Promise<{ success: boolean; user_id: number; email: string } | null> {
  const verification = await env.DB.prepare(
    "SELECT * FROM user_email_verifications WHERE verification_token = ? AND is_verified = 0",
  )
    .bind(token)
    .first<EmailVerification>();

  if (!verification) {
    return null;
  }

  const createdAt = new Date(verification.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > 24 * 60 * 60 * 1000) {
    return null;
  }

  await env.DB.prepare(
    `UPDATE user_email_verifications
       SET is_verified = 1, verified_at = datetime('now')
       WHERE id = ?`,
  )
    .bind(verification.id)
    .run();

  await env.DB.prepare(
    `UPDATE users SET email_verified = 1, email = ?, updated_at = datetime('now')
       WHERE id = ?`,
  )
    .bind(verification.email, verification.user_id)
    .run();

  await mirrorSyncRow(env, "user_email_verifications", verification.id).catch(() => {});
  await mirrorSyncRow(env, "users", verification.user_id).catch(() => {});

  return {
    success: true,
    user_id: verification.user_id,
    email: verification.email,
  };
}

// ==================== System Settings ====================

export async function getSystemSetting(
  env: Env,
  key: string,
): Promise<{
  key: string;
  encrypted_value: string | null;
  description: string | null;
} | null> {
  return env.DB.prepare("SELECT * FROM system_settings WHERE key = ?")
    .bind(key)
    .first<{
      key: string;
      encrypted_value: string | null;
      description: string | null;
    }>();
}

export async function setSystemSetting(
  env: Env,
  key: string,
  encryptedValue: string | null,
  description?: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, encrypted_value, description, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         description = excluded.description,
         updated_at = excluded.updated_at`,
  )
    .bind(key, encryptedValue, description || null)
    .run();
  await mirrorSyncRow(env, "system_settings", key).catch(() => {});
}

// ==================== Email Domain Whitelist ====================

export async function getEmailDomainWhitelist(
  env: Env,
): Promise<{ domain: string; description: string | null }[]> {
  return dbAll<{ domain: string; description: string | null }>(
    env,
    "SELECT domain, description FROM email_domain_whitelist WHERE is_enabled = 1 ORDER BY domain ASC",
    [],
  );
}

export async function addEmailDomainToWhitelist(
  env: Env,
  domain: string,
  description?: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO email_domain_whitelist (domain, description, is_enabled)
       VALUES (?, ?, 1)
       ON CONFLICT(domain) DO UPDATE SET
         description = excluded.description,
         is_enabled = 1`,
  )
    .bind(domain.toLowerCase(), description || null)
    .run();
  const row = await d1First<{ id: number }>(
    env,
    "SELECT id FROM email_domain_whitelist WHERE domain = ?",
    [domain.toLowerCase()],
  );
  if (row) {
    await mirrorSyncRow(env, "email_domain_whitelist", row.id).catch(() => {});
  }
}

export async function removeEmailDomainFromWhitelist(
  env: Env,
  domain: string,
): Promise<void> {
  await env.DB.prepare(
    "UPDATE email_domain_whitelist SET is_enabled = 0 WHERE domain = ?",
  )
    .bind(domain.toLowerCase())
    .run();
  const row = await d1First<{ id: number }>(
    env,
    "SELECT id FROM email_domain_whitelist WHERE domain = ?",
    [domain.toLowerCase()],
  );
  if (row) {
    await mirrorSyncRow(env, "email_domain_whitelist", row.id).catch(() => {});
  }
}

// ==================== Announcements (公告) ====================

export async function getActiveAnnouncements(
  env: Env,
): Promise<Announcement[]> {
  // 排序：置顶优先 → 展示序号升序 → id 升序（稳定）
  return dbAll<Announcement>(
    env,
    "SELECT * FROM announcements WHERE is_active = 1 ORDER BY is_pinned DESC, sort_order ASC, id ASC",
    [],
  );
}

export async function getAllAnnouncements(env: Env): Promise<Announcement[]> {
  // 管理列表：启用在前，再按置顶/序号；隐藏的排最后仍可见
  return dbAll<Announcement>(
    env,
    "SELECT * FROM announcements ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC",
    [],
  );
}

export async function createAnnouncement(
  env: Env,
  title: string,
  content: string,
  createdBy: number | null,
  sortOrder?: number,
  isPinned?: boolean,
): Promise<Announcement | null> {
  // 未指定排序号时，取当前最大值 + 1（排到末尾）
  let order = sortOrder;
  if (order === undefined || Number.isNaN(order)) {
    const max = await env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS m FROM announcements",
    ).first<{ m: number }>();
    order = (max?.m ?? -1) + 1;
  }
  const result = await env.DB.prepare(
    "INSERT INTO announcements (title, content, is_active, is_pinned, sort_order, created_by) VALUES (?, ?, 1, ?, ?, ?)",
  )
    .bind(title, content, isPinned ? 1 : 0, order, createdBy)
    .run();

  const id = result.meta.last_row_id;
  const created = await env.DB.prepare("SELECT * FROM announcements WHERE id = ?")
    .bind(id)
    .first<Announcement>();
  if (created) {
    await mirrorSyncRow(env, "announcements", created.id).catch(() => {});
  }
  return created ?? null;
}

export async function updateAnnouncement(
  env: Env,
  id: number,
  updates: {
    title?: string;
    content?: string;
    is_active?: boolean;
    is_pinned?: boolean;
    sort_order?: number;
  },
): Promise<Announcement | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    setParts.push("title = ?");
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    setParts.push("content = ?");
    values.push(updates.content);
  }
  if (updates.is_active !== undefined) {
    setParts.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_pinned !== undefined) {
    setParts.push("is_pinned = ?");
    values.push(updates.is_pinned ? 1 : 0);
  }
  if (updates.sort_order !== undefined && !Number.isNaN(updates.sort_order)) {
    setParts.push("sort_order = ?");
    values.push(updates.sort_order);
  }
  setParts.push('updated_at = datetime("now")');

  if (setParts.length === 1) return null;

  values.push(id);
  await env.DB.prepare(
    `UPDATE announcements SET ${setParts.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM announcements WHERE id = ?")
    .bind(id)
    .first<Announcement>();
  if (updated) {
    await mirrorSyncRow(env, "announcements", updated.id).catch(() => {});
  }
  return updated ?? null;
}

// 删除公告后，对剩余公告做「展示序号紧凑重排」：sort_order 连续无空洞。
// 说明：只操作展示序号列（sort_order），绝不触碰被外键引用的主键 id，
// 满足“删除后有序替补空白、防止序号逐渐增大”且不影响既有引用关系的诉求。
export async function deleteAnnouncement(env: Env, id: number): Promise<void> {
  // 先获取要删除的记录（用于镜像同步，D1 权威直查）
  const announce = await d1First<Announcement>(
    env,
    "SELECT * FROM announcements WHERE id = ?",
    [id],
  );

  await env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
  await env.DB.prepare(
    `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC) - 1 AS new_sort
         FROM announcements
       )
       UPDATE announcements
       SET sort_order = (SELECT new_sort FROM ranked WHERE ranked.id = announcements.id),
           updated_at = datetime('now')`,
  ).run();

  // 同步删除到镜像
  if (announce) {
    await mirrorSyncRow(env, "announcements", id).catch(() => {});
    // 重新同步所有公告（因为sort_order重排会影响其他行）
    // 简单的实现：通过日级cron来对齐，这里不处理
  }
}

// ==================== Friend Links (友情链接，数据库版备用) ====================

export async function getFriendLinksFromDb(
  env: Env,
): Promise<FriendLinkWithId[]> {
  return dbAll<FriendLinkWithId>(
    env,
    "SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC",
    [],
  );
}

// ==================== Owner Approval (上级所有权审批，层级子域名) ====================

export async function createOwnerApproval(
  env: Env,
  base: {
    targetFqdn: string;
    baseFqdn: string;
    approverUserId: number;
    applicantUserId: number;
    token: string;
    deadlineAt: string;
  },
): Promise<OwnerApproval> {
  const res = await env.DB.prepare(
    `INSERT INTO owner_approvals
        (target_fqdn, base_fqdn, approver_user_id, applicant_user_id, token, deadline_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      base.targetFqdn,
      base.baseFqdn,
      base.approverUserId,
      base.applicantUserId,
      base.token,
      base.deadlineAt,
    )
    .run();
  const id = Number((res.meta as any)?.last_row_id);
  const row = await getOwnerApprovalById(env, id);
  if (!row) throw new Error("Failed to create owner approval");
  await mirrorSyncRow(env, "owner_approvals", id).catch(() => {});
  return row;
}

export async function getOwnerApprovalById(
  env: Env,
  id: number,
): Promise<OwnerApproval | null> {
  return env.DB.prepare("SELECT * FROM owner_approvals WHERE id = ?")
    .bind(id)
    .first<OwnerApproval>();
}

export async function getOwnerApprovalByToken(
  env: Env,
  token: string,
): Promise<OwnerApproval | null> {
  return env.DB.prepare("SELECT * FROM owner_approvals WHERE token = ?")
    .bind(token)
    .first<OwnerApproval>();
}

export async function getPendingApprovalByTarget(
  env: Env,
  targetFqdn: string,
): Promise<OwnerApproval | null> {
  return env.DB.prepare(
    `SELECT * FROM owner_approvals WHERE target_fqdn = ? AND status = 'pending'`,
  )
    .bind(targetFqdn)
    .first<OwnerApproval>();
}

/** 取某目标 FQDN 的全部非折叠审批记录（用于删除子域时联动折叠 + 通知二级持有人） */
export async function getApprovalsByTargetFqdn(
  env: Env,
  targetFqdn: string,
): Promise<OwnerApproval[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM owner_approvals WHERE target_fqdn = ? AND status != 'deleted'
       ORDER BY created_at DESC, id DESC`,
  )
    .bind(targetFqdn)
    .all<OwnerApproval>();
  return res.results;
}

export async function setOwnerApprovalStatus(
  env: Env,
  id: number,
  status: "approved" | "rejected" | "expired" | "deleted",
): Promise<void> {
  await env.DB.prepare(
    `UPDATE owner_approvals SET status = ?, decided_at = datetime('now') WHERE id = ?`,
  )
    .bind(status, id)
    .run();
  await mirrorSyncRow(env, "owner_approvals", id).catch(() => {});
}

/** 我发起的上级所有权审批（申请人视角），最新优先 */
export async function getOwnerApprovalsByApplicant(
  env: Env,
  applicantUserId: number,
): Promise<OwnerApproval[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM owner_approvals WHERE applicant_user_id = ?
       ORDER BY created_at DESC, id DESC`,
  )
    .bind(applicantUserId)
    .all<OwnerApproval>();
  return res.results;
}

/** 我作为所有权者待/已处理的审批（审批人视角），最新优先 */
export async function getOwnerApprovalsByApprover(
  env: Env,
  approverUserId: number,
): Promise<OwnerApproval[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM owner_approvals WHERE approver_user_id = ?
       ORDER BY created_at DESC, id DESC`,
  )
    .bind(approverUserId)
    .all<OwnerApproval>();
  return res.results;
}

/**
 * 在给定祖先列表中找到“最近一个已被用户拥有（subdomains.status='approved'）的真祖先”，
 * 作为该目标子域名的上级所有权审批人。返回拥有的祖先子域名记录（最长者优先）。
 */
export async function findApprovedOwnedAncestor(
  env: Env,
  ancestors: string[],
): Promise<Subdomain | null> {
  if (ancestors.length === 0) return null;
  const placeholders = ancestors.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT * FROM subdomains
       WHERE status = 'approved'
         AND (subdomain || '.' || domain) IN (${placeholders})
       ORDER BY LENGTH(subdomain || '.' || domain) DESC
       LIMIT 1`,
  )
    .bind(...ancestors)
    .first<Subdomain>();
  return result || null;
}

/**
 * 枚举一个 FQDN 的相对某根域的所有“真祖先”（不含自身，从根域的下一级子域名开始）。
 * 例：root=example.org, fqdn=d.c.b.example.org → [b.example.org, c.b.example.org, d.c.b.example.org]，去掉自身返回前 3 个。
 * 若 fqdn 直接等于根域的下一级（二级域名），则无真祖先，返回 []。
 */
export function enumerateAncestorFqdns(fqdn: string, domain: string): string[] {
  const labels = fqdn.split(".");
  const domainLabels = domain.split(".");
  // 去除根域后得到的子域名标签链，如 d.c.b.example.org → [d, c, b]
  const subLabels = labels.slice(0, labels.length - domainLabels.length);
  const out: string[] = [];
  // 逐层补前缀（离根最近的祖先最先）：j=1 → b.example.org；j=2 → c.b.example.org；…
  // j 取到 len-1，不含自身（j=len 即完整的 fqdn）。
  for (let j = 1; j < subLabels.length; j++) {
    out.push(subLabels.slice(subLabels.length - j).join(".") + "." + domain);
  }
  return out;
}


// ==================== User Daily Limits (子域名申请/删除频控) ====================

function getShanghaiDateString(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getUserDailyLimits(env: Env, userId: number): Promise<{ apply_count: number; delete_count: number; limit_override: number }> {
  const date = getShanghaiDateString();
  const row = await env.DB.prepare(
    "SELECT apply_count, delete_count, limit_override FROM user_daily_limits WHERE user_id = ? AND date = ?"
  ).bind(userId, date).first<{ apply_count: number; delete_count: number; limit_override: number }>();
  if (!row) {
    return { apply_count: 0, delete_count: 0, limit_override: 0 };
  }
  return row;
}

export async function incrementUserDailyLimit(env: Env, userId: number, type: 'apply' | 'delete'): Promise<void> {
  const date = getShanghaiDateString();
  const field = type === 'apply' ? 'apply_count' : 'delete_count';
  await env.DB.prepare(
    `INSERT INTO user_daily_limits (user_id, date, ${field}) VALUES (?, ?, 1)
     ON CONFLICT(user_id, date) DO UPDATE SET ${field} = ${field} + 1, updated_at = datetime('now')`
  ).bind(userId, date).run();
}

export async function resetUserDailyLimits(env: Env, userId: number): Promise<void> {
  const date = getShanghaiDateString();
  await env.DB.prepare(
    "UPDATE user_daily_limits SET apply_count = 0, delete_count = 0, limit_override = 1, updated_at = datetime('now') WHERE user_id = ? AND date = ?"
  ).bind(userId, date).run();
}

export async function getOverLimitUsers(env: Env): Promise<Array<{ user_id: number; apply_count: number; delete_count: number; github_username: string | null }>> {
  const date = getShanghaiDateString();
  const rawLimit = Number(env.SUBDOMAIN_DAILY_LIMIT);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 5;
  const rows = await env.DB.prepare(
    `SELECT ul.user_id, ul.apply_count, ul.delete_count, u.github_username
     FROM user_daily_limits ul
     LEFT JOIN users u ON u.id = ul.user_id
     WHERE ul.date = ? AND (ul.apply_count >= ? OR ul.delete_count >= ?)`
  ).bind(date, limit, limit).all<{ user_id: number; apply_count: number; delete_count: number; github_username: string | null }>();
  return rows.results;
}
