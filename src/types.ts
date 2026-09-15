export interface Env {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  CF_API_TOKEN: string;
  DOMAINS: string;
  BANNED_PREFIXES: string;
  MAX_SUBDOMAINS_PER_USER: string;
  MAX_RECORDS_PER_SUBDOMAIN: string;
  ADMIN_USERS?: string;
  // DNS 记录读取来源：'true'/'1' 时优先从 Cloudflare 实时查（读少用 D1），CF 失败回退 DB
  DNS_LIVE_READ?: string;
  // 上级所有权审批超时（小时），超时未处理自动驳回；默认 72
  OWNER_APPROVAL_DEADLINE_HOURS?: string;
  SITE_NAME: string;
  // 站点背景图与 Logo（可选）
  SITE_BACKGROUND_IMAGE?: string;
  SITE_BACKGROUND_OVERLAY?: string;
  SITE_LOGO?: string;
  // 备案信息（可选，如 "浙ICP备12345678号" 或虚拟备案项目；未配置则不显示）
  SITE_BEIAN?: string;
  // 友情链接（可选，JSON 数组字符串：[{"name":"xx","url":"https://..."}]）
  FRIEND_LINKS?: string;
  // 联系管理员邮箱（可选，用于 footer "联系管理员" 按钮）
  ADMIN_CONTACT_EMAIL?: string;
  // SMTP 邮件通知（可选）
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  SMTP_FROM_NAME?: string;
  // 加密密钥（用于敏感数据加密）
  ENCRYPTION_KEY?: string;
  // 邮箱验证配置
  EMAIL_VERIFICATION_REQUIRED?: string;
  // 允许的邮箱域名白名单（逗号分隔，空=不限制）
  ALLOWED_EMAIL_DOMAINS?: string;
  // 第三方发信服务（推荐 Resend；配置后优先走 Resend）
  RESEND_API_KEY?: string;
  // 每用户每天最大邮件发送数（默认 5）
  EMAIL_DAILY_EMAIL_LIMIT?: string;
  // ---- 存储后端链（STORAGE.md）----
  // 活动查询后端顺序，逗号分隔，越靠前越优先；合法项 mysql / custom-sqlite / d1；缺省 d1（=现状）
  DB_QUERY_ORDER?: string;
  // MySQL 经 Cloudflare Hyperdrive（Worker 无法原生 TCP）；形如 mysql://user:pass@host:port/db
  HYPERDRIVE?: { connectionString: string };
  // 自定义 SQLite（Turso/libsql over HTTP）
  CUSTOM_SQLITE_URL?: string;
  CUSTOM_SQLITE_TOKEN?: string;
  CUSTOM_SQLITE_JWT?: string;
  // S3/R2 快照灾备
  S3_BACKUP_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_USE_PATH_STYLE?: string; // 'true' 时用 path-style（兼容 MinIO/R2 自定义端点）
  // 后端异常时管理告警收件邮箱（复用邮件通道）
  DB_ADMIN_ALERT_EMAIL?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  is_active: number;
  is_pinned: number;   // 1=置顶（轮播中显示全文）；0=普通（按字数缩略，可展开）
  sort_order: number;  // 展示排序号，越小越靠前；删除后自动紧凑重排不产生空洞
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface FriendLink {
  name: string;
  url: string;
  description?: string;
}

export type OwnerApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/** 上级所有权审批请求：申请更深层子域名时，需目标子域名的最近被拥有祖先的所有者同意 */
export interface OwnerApproval {
  id: number;
  target_fqdn: string;       // 目标子域名 FQDN（申请人想要的）
  base_fqdn: string;         // 最近被拥有的祖先 FQDN（审批人拥有的二级/三级…）
  approver_user_id: number;  // 审批人（所有权者）
  applicant_user_id: number; // 申请人
  token: string;             // 决策令牌（邮件按钮链接用，长随机）
  status: OwnerApprovalStatus;
  created_at: string;
  deadline_at: string;       // 超时未处理自动驳回
  decided_at: string | null;
}

export interface User {
  id: number;
  github_id: number;
  github_username: string;
  avatar_url: string | null;
  email: string | null;
  email_verified: number;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

export type SubdomainStatus = 'pending' | 'approved' | 'rejected';

export interface Subdomain {
  id: number;
  user_id: number;
  subdomain: string;
  domain: string;
  status: SubdomainStatus;
  reject_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  created_at: string;
}

export interface DnsRecord {
  id: number;
  subdomain_id: number;
  cf_record_id: string;
  record_type: string;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  proxied: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainConfig {
  domain: string;
  zoneId: string;
  accountId?: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

export interface JwtPayload {
  sub: number; // user id
  iat: number;
  exp: number;
}

export interface DnsRecordInput {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  comment?: string;
}

export interface CloudflareAccount {
  id: number;
  user_id: number;
  account_name: string;
  api_token: string;
  zone_id: string | null;
  is_active: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface EmailVerification {
  id: number;
  user_id: number;
  email: string;
  verification_token: string;
  is_verified: number;
  verified_at: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: number;
  key: string;
  encrypted_value: string | null;
  description: string | null;
  updated_at: string;
}

export const ALLOWED_RECORD_TYPES = [
  'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'
] as const;

export type RecordType = typeof ALLOWED_RECORD_TYPES[number];
