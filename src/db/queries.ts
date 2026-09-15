import type { Env, User, Subdomain, DnsRecord, CloudflareAccount, EmailVerification, Announcement, OwnerApproval } from '../types';

export interface FriendLinkWithId {
  id: number;
  name: string;
  url: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

// ==================== Users ====================

export async function findUserByGitHubId(db: D1Database, githubId: number): Promise<User | null> {
  return db
    .prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(githubId)
    .first<User>();
}

export async function findUserById(db: D1Database, id: number): Promise<User | null> {
  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

export async function upsertUser(
  db: D1Database,
  githubId: number,
  githubUsername: string,
  avatarUrl: string | null,
  email: string | null,
  isAdmin: boolean
): Promise<User> {
  await db
    .prepare(
      `INSERT INTO users (github_id, github_username, avatar_url, email, is_admin)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET
         github_username = excluded.github_username,
         avatar_url = excluded.avatar_url,
         email = excluded.email,
         is_admin = CASE WHEN excluded.is_admin = 1 THEN 1 ELSE users.is_admin END,
         updated_at = datetime('now')`
    )
    .bind(githubId, githubUsername, avatarUrl, email, isAdmin ? 1 : 0)
    .run();

  const user = await findUserByGitHubId(db, githubId);
  if (!user) throw new Error('Failed to upsert user');
  return user;
}

export async function updateUserEmailVerified(
  db: D1Database,
  userId: number,
  emailVerified: boolean
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET email_verified = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(emailVerified ? 1 : 0, userId)
    .run();
}

export async function updateUserEmail(
  db: D1Database,
  userId: number,
  email: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET email = ?, email_verified = 0, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(email, userId)
    .run();
}

// ==================== Subdomains ====================

export async function getUserSubdomains(db: D1Database, userId: number): Promise<Subdomain[]> {
  const result = await db
    .prepare('SELECT * FROM subdomains WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<Subdomain>();
  return result.results;
}

export async function getSubdomainById(db: D1Database, id: number): Promise<Subdomain | null> {
  return db
    .prepare('SELECT * FROM subdomains WHERE id = ?')
    .bind(id)
    .first<Subdomain>();
}

export async function findSubdomain(
  db: D1Database,
  subdomain: string,
  domain: string
): Promise<Subdomain | null> {
  return db
    .prepare('SELECT * FROM subdomains WHERE subdomain = ? AND domain = ?')
    .bind(subdomain, domain)
    .first<Subdomain>();
}

export async function countUserSubdomains(db: D1Database, userId: number): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM subdomains WHERE user_id = ? AND status != ?')
    .bind(userId, 'rejected')
    .first<{ count: number }>();
  return result?.count || 0;
}

export async function createSubdomain(
  db: D1Database,
  userId: number,
  subdomain: string,
  domain: string
): Promise<Subdomain> {
  await db
    .prepare('INSERT INTO subdomains (user_id, subdomain, domain) VALUES (?, ?, ?)')
    .bind(userId, subdomain, domain)
    .run();

  const record = await findSubdomain(db, subdomain, domain);
  if (!record) throw new Error('Failed to create subdomain');
  return record;
}

export async function deleteSubdomain(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM subdomains WHERE id = ?').bind(id).run();
}

// ==================== Review Workflow ====================

export async function approveSubdomain(
  db: D1Database,
  id: number,
  reviewedBy: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE subdomains SET status = 'approved', reject_reason = NULL, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
    )
    .bind(reviewedBy, id)
    .run();
}

export async function rejectSubdomain(
  db: D1Database,
  id: number,
  reviewedBy: number,
  reason: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE subdomains SET status = 'rejected', reject_reason = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
    )
    .bind(reason, reviewedBy, id)
    .run();
}

export async function getPendingSubdomains(db: D1Database): Promise<(Subdomain & { github_username: string; email: string | null })[]> {
  const result = await db
    .prepare(
      `SELECT s.*, u.github_username, u.email FROM subdomains s
       JOIN users u ON s.user_id = u.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at ASC`
    )
    .all<Subdomain & { github_username: string; email: string | null }>();
  return result.results;
}

// ==================== DNS Records ====================

export async function getSubdomainRecords(db: D1Database, subdomainId: number): Promise<DnsRecord[]> {
  const result = await db
    .prepare('SELECT * FROM dns_records WHERE subdomain_id = ? ORDER BY record_type, name')
    .bind(subdomainId)
    .all<DnsRecord>();
  return result.results;
}

export async function countSubdomainRecords(db: D1Database, subdomainId: number): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM dns_records WHERE subdomain_id = ?')
    .bind(subdomainId)
    .first<{ count: number }>();
  return result?.count || 0;
}

export async function getDnsRecordById(db: D1Database, id: number): Promise<DnsRecord | null> {
  return db
    .prepare('SELECT * FROM dns_records WHERE id = ?')
    .bind(id)
    .first<DnsRecord>();
}

/** 按 Cloudflare 记录 ID 反查（DNS 实时读取模式下，更新/删除以 CF id 定位） */
export async function getDnsRecordByCfId(
  db: D1Database,
  subdomainId: number,
  cfRecordId: string
): Promise<DnsRecord | null> {
  return db
    .prepare('SELECT * FROM dns_records WHERE subdomain_id = ? AND cf_record_id = ?')
    .bind(subdomainId, cfRecordId)
    .first<DnsRecord>();
}

export async function createDnsRecordEntry(
  db: D1Database,
  subdomainId: number,
  cfRecordId: string,
  recordType: string,
  name: string,
  content: string,
  ttl: number,
  priority: number | null,
  proxied: boolean,
  comment: string | null
): Promise<DnsRecord> {
  const result = await db
    .prepare(
      `INSERT INTO dns_records (subdomain_id, cf_record_id, record_type, name, content, ttl, priority, proxied, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(subdomainId, cfRecordId, recordType, name, content, ttl, priority, proxied ? 1 : 0, comment)
    .run();

  const id = result.meta.last_row_id;
  const record = await getDnsRecordById(db, id as number);
  if (!record) throw new Error('Failed to create DNS record entry');
  return record;
}

export async function updateDnsRecordEntry(
  db: D1Database,
  id: number,
  cfRecordId: string,
  recordType: string,
  name: string,
  content: string,
  ttl: number,
  priority: number | null,
  proxied: boolean,
  comment: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE dns_records SET cf_record_id = ?, record_type = ?, name = ?, content = ?, ttl = ?, priority = ?, proxied = ?, comment = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(cfRecordId, recordType, name, content, ttl, priority, proxied ? 1 : 0, comment, id)
    .run();
}

export async function deleteDnsRecordEntry(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM dns_records WHERE id = ?').bind(id).run();
}

export async function deleteAllRecordsForSubdomain(db: D1Database, subdomainId: number): Promise<DnsRecord[]> {
  const records = await getSubdomainRecords(db, subdomainId);
  await db.prepare('DELETE FROM dns_records WHERE subdomain_id = ?').bind(subdomainId).run();
  return records;
}

// ==================== Admin ====================

export async function getAllSubdomains(db: D1Database): Promise<(Subdomain & { github_username: string; email: string | null })[]> {
  const result = await db
    .prepare(
      `SELECT s.*, u.github_username, u.email FROM subdomains s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
    )
    .all<Subdomain & { github_username: string; email: string | null }>();
  return result.results;
}

export async function getAllUsers(db: D1Database): Promise<User[]> {
  const result = await db
    .prepare('SELECT * FROM users ORDER BY created_at DESC')
    .all<User>();
  return result.results;
}

// ==================== Cloudflare Accounts ====================

export async function getCloudflareAccounts(db: D1Database, userId: number): Promise<CloudflareAccount[]> {
  const result = await db
    .prepare('SELECT * FROM cloudflare_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC')
    .bind(userId)
    .all<CloudflareAccount>();
  return result.results;
}

export async function getCloudflareAccountById(
  db: D1Database,
  userId: number,
  accountId: number
): Promise<CloudflareAccount | null> {
  return db
    .prepare('SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?')
    .bind(userId, accountId)
    .first<CloudflareAccount>();
}

export async function getDefaultCloudflareAccount(
  db: D1Database,
  userId: number
): Promise<CloudflareAccount | null> {
  return db
    .prepare('SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1')
    .bind(userId)
    .first<CloudflareAccount>();
}

export async function createCloudflareAccount(
  db: D1Database,
  userId: number,
  accountName: string,
  encryptedApiToken: string,
  zoneId: string | null,
  isDefault: boolean
): Promise<CloudflareAccount> {
  if (isDefault) {
    await db
      .prepare('UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  const result = await db
    .prepare(
      `INSERT INTO cloudflare_accounts (user_id, account_name, api_token, zone_id, is_active, is_default)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .bind(userId, accountName, encryptedApiToken, zoneId, isDefault ? 1 : 0)
    .run();

  const id = result.meta.last_row_id;
  const account = await getCloudflareAccountById(db, userId, id as number);
  if (!account) throw new Error('Failed to create cloudflare account');
  return account;
}

export async function updateCloudflareAccount(
  db: D1Database,
  userId: number,
  accountId: number,
  updates: {
    account_name?: string;
    api_token?: string;
    zone_id?: string | null;
    is_active?: boolean;
    is_default?: boolean;
  }
): Promise<CloudflareAccount> {
  const existing = await getCloudflareAccountById(db, userId, accountId);
  if (!existing) {
    throw new Error('Cloudflare 账户不存在');
  }

  if (updates.is_default) {
    await db
      .prepare('UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  const setParts: string[] = [];
  const values: any[] = [];

  if (updates.account_name !== undefined) {
    setParts.push('account_name = ?');
    values.push(updates.account_name);
  }
  if (updates.api_token !== undefined) {
    setParts.push('api_token = ?');
    values.push(updates.api_token);
  }
  if (updates.zone_id !== undefined) {
    setParts.push('zone_id = ?');
    values.push(updates.zone_id);
  }
  if (updates.is_active !== undefined) {
    setParts.push('is_active = ?');
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_default !== undefined) {
    setParts.push('is_default = ?');
    values.push(updates.is_default ? 1 : 0);
  }

  setParts.push('updated_at = datetime("now")');

  if (setParts.length === 1) {
    return existing;
  }

  values.push(userId, accountId);

  await db
    .prepare(`UPDATE cloudflare_accounts SET ${setParts.join(', ')} WHERE user_id = ? AND id = ?`)
    .bind(...values)
    .run();

  const updated = await getCloudflareAccountById(db, userId, accountId);
  if (!updated) throw new Error('Failed to update cloudflare account');
  return updated;
}

export async function deleteCloudflareAccount(
  db: D1Database,
  userId: number,
  accountId: number
): Promise<void> {
  const account = await getCloudflareAccountById(db, userId, accountId);
  if (!account) {
    throw new Error('Cloudflare 账户不存在');
  }

  await db
    .prepare('DELETE FROM cloudflare_accounts WHERE user_id = ? AND id = ?')
    .bind(userId, accountId)
    .run();

  if (account.is_default) {
    const firstActive = await db
      .prepare('SELECT id FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1')
      .bind(userId)
      .first<{ id: number }>();

    if (firstActive) {
      await db
        .prepare('UPDATE cloudflare_accounts SET is_default = 1 WHERE user_id = ? AND id = ?')
        .bind(userId, firstActive.id)
        .run();
    }
  }
}

// ==================== Email Verifications ====================

export async function createEmailVerificationRecord(
  db: D1Database,
  userId: number,
  email: string,
  token: string
): Promise<EmailVerification> {
  await db
    .prepare('DELETE FROM user_email_verifications WHERE user_id = ? AND email = ?')
    .bind(userId, email)
    .run();

  const result = await db
    .prepare(
      `INSERT INTO user_email_verifications (user_id, email, verification_token, is_verified, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`
    )
    .bind(userId, email, token)
    .run();

  const id = result.meta.last_row_id;

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
  db: D1Database,
  token: string
): Promise<{ success: boolean; user_id: number; email: string } | null> {
  const verification = await db
    .prepare('SELECT * FROM user_email_verifications WHERE verification_token = ? AND is_verified = 0')
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

  await db
    .prepare(
      `UPDATE user_email_verifications
       SET is_verified = 1, verified_at = datetime('now')
       WHERE id = ?`
    )
    .bind(verification.id)
    .run();

  await db
    .prepare(
      `UPDATE users SET email_verified = 1, email = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(verification.email, verification.user_id)
    .run();

  return {
    success: true,
    user_id: verification.user_id,
    email: verification.email,
  };
}

// ==================== System Settings ====================

export async function getSystemSetting(
  db: D1Database,
  key: string
): Promise<{ key: string; encrypted_value: string | null; description: string | null } | null> {
  return db
    .prepare('SELECT * FROM system_settings WHERE key = ?')
    .bind(key)
    .first<{ key: string; encrypted_value: string | null; description: string | null }>();
}

export async function setSystemSetting(
  db: D1Database,
  key: string,
  encryptedValue: string | null,
  description?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_settings (key, encrypted_value, description, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         description = excluded.description,
         updated_at = excluded.updated_at`
    )
    .bind(key, encryptedValue, description || null)
    .run();
}

// ==================== Email Domain Whitelist ====================

export async function getEmailDomainWhitelist(db: D1Database): Promise<{ domain: string; description: string | null }[]> {
  const result = await db
    .prepare('SELECT domain, description FROM email_domain_whitelist WHERE is_enabled = 1 ORDER BY domain ASC')
    .all<{ domain: string; description: string | null }>();
  return result.results;
}

export async function addEmailDomainToWhitelist(
  db: D1Database,
  domain: string,
  description?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO email_domain_whitelist (domain, description, is_enabled)
       VALUES (?, ?, 1)
       ON CONFLICT(domain) DO UPDATE SET
         description = excluded.description,
         is_enabled = 1`
    )
    .bind(domain.toLowerCase(), description || null)
    .run();
}

export async function removeEmailDomainFromWhitelist(
  db: D1Database,
  domain: string
): Promise<void> {
  await db
    .prepare('UPDATE email_domain_whitelist SET is_enabled = 0 WHERE domain = ?')
    .bind(domain.toLowerCase())
    .run();
}

// ==================== Announcements (公告) ====================

export async function getActiveAnnouncements(db: D1Database): Promise<Announcement[]> {
  // 排序：置顶优先 → 展示序号升序 → id 升序（稳定）
  const result = await db
    .prepare('SELECT * FROM announcements WHERE is_active = 1 ORDER BY is_pinned DESC, sort_order ASC, id ASC')
    .all<Announcement>();
  return result.results;
}

export async function getAllAnnouncements(db: D1Database): Promise<Announcement[]> {
  // 管理列表：启用在前，再按置顶/序号；隐藏的排最后仍可见
  const result = await db
    .prepare('SELECT * FROM announcements ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC')
    .all<Announcement>();
  return result.results;
}

export async function createAnnouncement(
  db: D1Database,
  title: string,
  content: string,
  createdBy: number | null,
  sortOrder?: number,
  isPinned?: boolean
): Promise<Announcement | null> {
  // 未指定排序号时，取当前最大值 + 1（排到末尾）
  let order = sortOrder;
  if (order === undefined || Number.isNaN(order)) {
    const max = await db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM announcements')
      .first<{ m: number }>();
    order = (max?.m ?? -1) + 1;
  }
  const result = await db
    .prepare(
      'INSERT INTO announcements (title, content, is_active, is_pinned, sort_order, created_by) VALUES (?, ?, 1, ?, ?, ?)'
    )
    .bind(title, content, isPinned ? 1 : 0, order, createdBy)
    .run();

  const id = result.meta.last_row_id;
  return db
    .prepare('SELECT * FROM announcements WHERE id = ?')
    .bind(id)
    .first<Announcement>();
}

export async function updateAnnouncement(
  db: D1Database,
  id: number,
  updates: { title?: string; content?: string; is_active?: boolean; is_pinned?: boolean; sort_order?: number }
): Promise<Announcement | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    setParts.push('title = ?');
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    setParts.push('content = ?');
    values.push(updates.content);
  }
  if (updates.is_active !== undefined) {
    setParts.push('is_active = ?');
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_pinned !== undefined) {
    setParts.push('is_pinned = ?');
    values.push(updates.is_pinned ? 1 : 0);
  }
  if (updates.sort_order !== undefined && !Number.isNaN(updates.sort_order)) {
    setParts.push('sort_order = ?');
    values.push(updates.sort_order);
  }
  setParts.push('updated_at = datetime("now")');

  if (setParts.length === 1) return null;

  values.push(id);
  await db
    .prepare(`UPDATE announcements SET ${setParts.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return db.prepare('SELECT * FROM announcements WHERE id = ?').bind(id).first<Announcement>();
}

// 删除公告后，对剩余公告做「展示序号紧凑重排」：sort_order 连续无空洞。
// 说明：只操作展示序号列（sort_order），绝不触碰被外键引用的主键 id，
// 满足“删除后有序替补空白、防止序号逐渐增大”且不影响既有引用关系的诉求。
export async function deleteAnnouncement(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
  await db
    .prepare(
      `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC) - 1 AS new_sort
         FROM announcements
       )
       UPDATE announcements
       SET sort_order = (SELECT new_sort FROM ranked WHERE ranked.id = announcements.id),
           updated_at = datetime('now')`
    )
    .run();
}

// ==================== Friend Links (友情链接，数据库版备用) ====================

export async function getFriendLinksFromDb(db: D1Database): Promise<FriendLinkWithId[]> {
  const result = await db
    .prepare('SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC')
    .all<FriendLinkWithId>();
  return result.results;
}

// ==================== Owner Approval (上级所有权审批，层级子域名) ====================

export async function createOwnerApproval(
  db: D1Database,
  base: {
    targetFqdn: string;
    baseFqdn: string;
    approverUserId: number;
    applicantUserId: number;
    token: string;
    deadlineAt: string;
  }
): Promise<OwnerApproval> {
  const res = await db
    .prepare(
      `INSERT INTO owner_approvals
        (target_fqdn, base_fqdn, approver_user_id, applicant_user_id, token, deadline_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      base.targetFqdn,
      base.baseFqdn,
      base.approverUserId,
      base.applicantUserId,
      base.token,
      base.deadlineAt
    )
    .run();
  const id = Number((res.meta as any)?.last_row_id);
  const row = await getOwnerApprovalById(db, id);
  if (!row) throw new Error('Failed to create owner approval');
  return row;
}

export async function getOwnerApprovalById(db: D1Database, id: number): Promise<OwnerApproval | null> {
  return db
    .prepare('SELECT * FROM owner_approvals WHERE id = ?')
    .bind(id)
    .first<OwnerApproval>();
}

export async function getOwnerApprovalByToken(db: D1Database, token: string): Promise<OwnerApproval | null> {
  return db
    .prepare('SELECT * FROM owner_approvals WHERE token = ?')
    .bind(token)
    .first<OwnerApproval>();
}

export async function getPendingApprovalByTarget(
  db: D1Database,
  targetFqdn: string
): Promise<OwnerApproval | null> {
  return db
    .prepare(
      `SELECT * FROM owner_approvals WHERE target_fqdn = ? AND status = 'pending'`
    )
    .bind(targetFqdn)
    .first<OwnerApproval>();
}

export async function setOwnerApprovalStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'rejected' | 'expired'
): Promise<void> {
  await db
    .prepare(
      `UPDATE owner_approvals SET status = ?, decided_at = datetime('now') WHERE id = ?`
    )
    .bind(status, id)
    .run();
}

/** 我发起的上级所有权审批（申请人视角），最新优先 */
export async function getOwnerApprovalsByApplicant(
  db: D1Database,
  applicantUserId: number
): Promise<OwnerApproval[]> {
  const res = await db
    .prepare(
      `SELECT * FROM owner_approvals WHERE applicant_user_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .bind(applicantUserId)
    .all<OwnerApproval>();
  return res.results;
}

/** 我作为所有权者待/已处理的审批（审批人视角），最新优先 */
export async function getOwnerApprovalsByApprover(
  db: D1Database,
  approverUserId: number
): Promise<OwnerApproval[]> {
  const res = await db
    .prepare(
      `SELECT * FROM owner_approvals WHERE approver_user_id = ?
       ORDER BY created_at DESC, id DESC`
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
  db: D1Database,
  ancestors: string[]
): Promise<Subdomain | null> {
  if (ancestors.length === 0) return null;
  const placeholders = ancestors.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT * FROM subdomains
       WHERE status = 'approved'
         AND (subdomain || '.' || domain) IN (${placeholders})
       ORDER BY LENGTH(subdomain || '.' || domain) DESC
       LIMIT 1`
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
  const labels = fqdn.split('.');
  const domainLabels = domain.split('.');
  // 去除根域后得到的子域名标签链，如 d.c.b.example.org → [d, c, b]
  const subLabels = labels.slice(0, labels.length - domainLabels.length);
  const out: string[] = [];
  // 逐层补前缀（离根最近的祖先最先）：j=1 → b.example.org；j=2 → c.b.example.org；…
  // j 取到 len-1，不含自身（j=len 即完整的 fqdn）。
  for (let j = 1; j < subLabels.length; j++) {
    out.push(subLabels.slice(subLabels.length - j).join('.') + '.' + domain);
  }
  return out;
}
