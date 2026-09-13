import type { Env, EmailVerification } from '../types';
import { generateToken } from './crypto';
import { sendEmail, buildVerificationEmail } from './email';

/**
 * 检查邮箱域名是否在白名单中
 */
export function isEmailDomainAllowed(env: Env, email: string): boolean {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === '') {
    return true; // 未配置白名单，允许所有
  }

  const allowedDomains = whitelist
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return allowedDomains.includes(domain);
}

/**
 * 获取允许的邮箱域名列表
 */
export function getAllowedEmailDomains(env: Env): string[] {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === '') {
    return [];
  }

  return whitelist
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 检查是否需要邮箱验证
 */
export function isEmailVerificationRequired(env: Env): boolean {
  return env.EMAIL_VERIFICATION_REQUIRED === 'true' || env.EMAIL_VERIFICATION_REQUIRED === '1';
}

/**
 * 创建邮箱验证记录
 */
export async function createEmailVerification(
  db: D1Database,
  userId: number,
  email: string
): Promise<EmailVerification> {
  // 删除旧的验证记录
  await db
    .prepare('DELETE FROM user_email_verifications WHERE user_id = ? AND email = ?')
    .bind(userId, email)
    .run();

  const token = generateToken(32);
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `INSERT INTO user_email_verifications (user_id, email, verification_token, is_verified, created_at)
       VALUES (?, ?, ?, 0, ?)`
    )
    .bind(userId, email, token, now)
    .run();

  const id = result.meta.last_row_id;

  return {
    id: id as number,
    user_id: userId,
    email,
    verification_token: token,
    is_verified: 0,
    verified_at: null,
    created_at: now,
  };
}

/**
 * 验证邮箱
 */
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

  // 检查是否过期（24 小时）
  const createdAt = new Date(verification.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > 24 * 60 * 60 * 1000) {
    return null;
  }

  // 更新验证状态
  await db
    .prepare(
      `UPDATE user_email_verifications
       SET is_verified = 1, verified_at = datetime('now')
       WHERE id = ?`
    )
    .bind(verification.id)
    .run();

  // 更新用户邮箱验证状态
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

/**
 * 获取用户的邮箱验证状态
 */
export async function getEmailVerificationStatus(
  db: D1Database,
  userId: number
): Promise<{ email: string | null; is_verified: boolean } | null> {
  const user = await db
    .prepare('SELECT email, email_verified FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string | null; email_verified: number }>();

  if (!user) {
    return null;
  }

  return {
    email: user.email,
    is_verified: !!user.email_verified,
  };
}

/**
 * 发送验证邮件
 */
export async function sendVerificationEmail(
  env: Env,
  email: string,
  token: string,
  siteName: string,
  siteUrl: string
): Promise<boolean> {
  const verificationUrl = `${siteUrl}/verify-email?token=${token}`;

  const emailHtml = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#3b82f6;margin:0 0 16px;">📧 验证您的邮箱</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    感谢您使用 ${siteName}！请点击下方按钮验证您的邮箱地址：
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${verificationUrl}" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      验证邮箱
    </a>
  </div>
  <p style="color:#666;font-size:13px;line-height:1.6;">
    如果按钮无法点击，请复制以下链接到浏览器打开：<br>
    <a href="${verificationUrl}" style="color:#3b82f6;word-break:break-all;">${verificationUrl}</a>
  </p>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    此链接 24 小时内有效。如果这不是您的操作，请忽略此邮件。<br>
    ${siteName}
  </p>
</div>
</body></html>`;

  const emailText = `
验证您的邮箱 - ${siteName}

感谢您使用 ${siteName}！请访问以下链接验证您的邮箱地址：

${verificationUrl}

此链接 24 小时内有效。如果这不是您的操作，请忽略此邮件。
`;

  return sendEmail(env, {
    to: email,
    subject: `验证您的邮箱 - ${siteName}`,
    html: emailHtml,
    text: emailText,
  });
}

/**
 * 重新发送验证邮件
 */
export async function resendVerificationEmail(
  env: Env,
  db: D1Database,
  userId: number,
  email: string,
  siteName: string,
  siteUrl: string
): Promise<boolean> {
  // 创建新的验证记录
  const verification = await createEmailVerification(db, userId, email);

  return sendVerificationEmail(env, email, verification.verification_token, siteName, siteUrl);
}
