import type { Env, User, Subdomain, DnsRecord, CloudflareAccount, EmailVerification } from '../types';

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
