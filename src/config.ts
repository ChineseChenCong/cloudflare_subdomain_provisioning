import type { Env, DomainConfig, FriendLink } from './types';

// Zone ID 缓存（Worker 实例生命周期内有效）
const zoneIdCache = new Map<string, string>();

export function getDomainNames(env: Env): string[] {
  if (!env.DOMAINS) return [];
  return env.DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export async function getDomainConfigs(env: Env): Promise<DomainConfig[]> {
  const names = getDomainNames(env);
  const configs: DomainConfig[] = [];

  for (const domain of names) {
    const zoneId = await resolveZoneId(env.CF_API_TOKEN, domain);
    if (zoneId) {
      configs.push({ domain, zoneId });
    }
  }

  return configs;
}

async function resolveZoneId(apiToken: string, domain: string): Promise<string | null> {
  if (zoneIdCache.has(domain)) {
    return zoneIdCache.get(domain)!;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as {
      success: boolean;
      result: Array<{ id: string; name: string }>;
    };

    if (data.success && data.result.length > 0) {
      const zoneId = data.result[0].id;
      zoneIdCache.set(domain, zoneId);
      return zoneId;
    }
  } catch (err) {
    console.error(`Failed to resolve zone ID for ${domain}:`, err);
  }

  return null;
}

export async function getZoneIdForDomain(env: Env, domain: string): Promise<string | null> {
  return resolveZoneId(env.CF_API_TOKEN, domain);
}

export function getBannedPrefixes(env: Env): string[] {
  if (!env.BANNED_PREFIXES) return [];
  return env.BANNED_PREFIXES.split(',').map((p) => p.trim().toLowerCase());
}

export function getMaxSubdomains(env: Env): number {
  return parseInt(env.MAX_SUBDOMAINS_PER_USER || '1', 10);
}

export function getMaxRecords(env: Env): number {
  return parseInt(env.MAX_RECORDS_PER_SUBDOMAIN || '20', 10);
}

export function getAdminUsers(env: Env): string[] {
  if (!env.ADMIN_USERS) return [];
  return env.ADMIN_USERS.split(',').map((u) => u.trim().toLowerCase());
}

export function isSmtpConfigured(env: Env): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

// ==================== Email Verification ====================

export function isEmailVerificationRequired(env: Env): boolean {
  return env.EMAIL_VERIFICATION_REQUIRED === 'true' || env.EMAIL_VERIFICATION_REQUIRED === '1';
}

export function getAllowedEmailDomains(env: Env): string[] {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === '') {
    return [];
  }

  return whitelist
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 从用户绑定的多个 Cloudflare 账户中解析域名的 Zone ID
 * 不再依赖全局 CF_API_TOKEN
 * 返回 { zoneId, token } 或 null
 */
export async function resolveZoneIdAndTokenFromAccounts(
  accounts: { account: { zone_id?: string | null }; token: string }[],
  domain: string
): Promise<{ zoneId: string; token: string } | null> {
  // 优先从账户缓存的 zone_id 匹配
  for (const { account, token } of accounts) {
    if (account.zone_id && account.zone_id.trim() !== '') {
      const matched = await verifyZoneIdForDomain(token, account.zone_id, domain);
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

async function verifyZoneIdForDomain(apiToken: string, zoneId: string, domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
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
 * 获取站点背景图 URL
 */
export function getBackgroundImage(env: Env): string | null {
  return env.SITE_BACKGROUND_IMAGE || null;
}

/**
 * 获取背景图遮罩颜色（hex 或 rgba）
 */
export function getBackgroundOverlay(env: Env): string {
  return env.SITE_BACKGROUND_OVERLAY || 'rgba(15, 23, 42, 0.7)';
}

/**
 * 获取站点 Logo URL
 */
export function getSiteLogo(env: Env): string | null {
  return env.SITE_LOGO || null;
}

/**
 * 获取站点名称
 */
export function getSiteName(env: Env): string {
  return env.SITE_NAME || 'SubDomain Hub';
}

/**
 * 获取备案信息（未配置则不显示）
 */
export function getSiteBeian(env: Env): string {
  return env.SITE_BEIAN || '';
}

/**
 * 获取友情链接列表
 */
export function getFriendLinks(env: Env): FriendLink[] {
  if (!env.FRIEND_LINKS) return [];
  try {
    const parsed = JSON.parse(env.FRIEND_LINKS);
    if (Array.isArray(parsed)) {
      return parsed.filter((l) => l && l.name && l.url);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 获取管理员联系邮箱（未配置则不显示联系按钮）
 */
export function getAdminContactEmail(env: Env): string {
  return env.ADMIN_CONTACT_EMAIL || '';
}
