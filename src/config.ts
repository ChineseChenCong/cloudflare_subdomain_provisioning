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

/** DNS 记录读取是否优先走 Cloudflare 实时查询（省 D1 读），CF 失败自动回退 DB */
export function isDnsLiveRead(env: Env): boolean {
  return env.DNS_LIVE_READ === 'true' || env.DNS_LIVE_READ === '1';
}

/** 上级所有权审批超时（小时），超时未处理自动驳回。默认 72 小时。 */
export function getOwnerApprovalDeadlineHours(env: Env): number {
  const v = parseInt(env.OWNER_APPROVAL_DEADLINE_HOURS || '72', 10);
  return Number.isFinite(v) && v > 0 ? v : 72;
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
 * 未显式配置时返回空字符串，由 CSS 侧使用主题感知的 --overlay-fallback（深色/浅色主题各自适配）
 */
export function getBackgroundOverlay(env: Env): string {
  return env.SITE_BACKGROUND_OVERLAY || '';
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
 * 备案信息（自动识别「萌ICP备」与「中国正式 ICP 备案」，安全渲染）。
 * 只用**一个环境变量 `SITE_BEIAN`**，因此两者天然互斥：把当前启用的那一个号码
 * 填进去即可（想切到另一种就把号码换成那种，二者不可能同时启用）。
 * 识别规则：
 *  - 号码含「萌」（如 `萌ICP备2024xxxx号`）→ 萌ICP备，仅展示文本、不伪造权威链接。
 *  - 形如 `…ICP备…号 / …ICP证…` 且不含「萌」→ 中国正式 ICP，链接工信部官网
 *    https://beian.miit.gov.cn（`rel=noopener noreferrer nofollow` 防劫持）。
 *  - 其它 → 仅展示文本（不加外部链接，避免指向仿冒站点）。
 * 号码一律 HTML 转义（防 XSS）。未配置返回 ''（页脚不渲染该段）。
 */
export function getSiteBeian(env: Env): string {
  const raw = (env.SITE_BEIAN || '').trim();
  if (!raw) return '';
  const esc = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  if (raw.includes('萌')) {
    // 萌ICP备 → 跳转萌备官方查询站：icp.gov.moe/?keyword=MMM（MMM=「萌ICP备…号」中的数字串）
    // 数字串由正则提取，仅包含数字，无任何注入面；未匹配到数字时退化为纯文本展示。
    const m = raw.match(/萌ICP备?\s*(\d+)/i);
    const kw = m ? m[1] : raw.replace(/\D+/g, '').slice(0, 8);
    if (kw) {
      return `<a class="beian" href="https://icp.gov.moe/?keyword=${kw}" target="_blank" rel="noopener noreferrer nofollow">${esc}</a>`;
    }
    return `<span class="beian">${esc}</span>`;
  }
  if (/ICP[备证]/.test(raw)) {
    return `<a class="beian" href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer nofollow">${esc}</a>`;
  }
  return `<span class="beian">${esc}</span>`;
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
