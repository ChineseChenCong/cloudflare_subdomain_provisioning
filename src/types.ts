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
  SITE_NAME: string;
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
