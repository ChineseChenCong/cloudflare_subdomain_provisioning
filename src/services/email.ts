import type { Env } from '../types';

/**
 * SMTP 邮件发送服务
 * 使用 MailChannels API（Cloudflare Workers 可直接调用）
 * 或者通过外部 SMTP 中继（如 QQ 邮箱）
 *
 * 在 Workers 环境中无法直接使用 TCP socket 连接 SMTP，
 * 因此通过 MailChannels 免费 API 或自建 SMTP HTTP 网关发送。
 *
 * 如果配置了 SMTP_HOST，则使用外部 SMTP HTTP API 网关；
 * 否则尝试 MailChannels（Cloudflare Workers 原生支持）。
 */

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 通过 MailChannels API 发送邮件（Cloudflare Workers 免费集成）
 * 无需额外配置，仅需域名 SPF 记录包含 _mailchannels
 */
async function sendViaMailChannels(
  env: Env,
  options: EmailOptions
): Promise<boolean> {
  const fromEmail = env.SMTP_FROM || `noreply@${getDomainFromEnv(env)}`;
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || 'SubDomain Hub';

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to, name: options.toName || options.to }],
          },
        ],
        from: { email: fromEmail, name: fromName },
        subject: options.subject,
        content: [
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          { type: 'text/html', value: options.html },
        ],
      }),
    });

    if (response.status === 202 || response.ok) {
      return true;
    }
    // 读取响应体以便定位拒发原因（Domain Lockdown / SPF / from 域名 等）
    const bodyText = await response.text().catch(() => '');
    console.error('MailChannels rejected:', response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error('MailChannels send error:', err);
    return false;
  }
}

/**
 * 通过外部 SMTP HTTP API 发送（需要自建网关或使用 Resend/Mailgun 等）
 * 这里提供通用 HTTP POST 接口支持
 */
async function sendViaSmtpGateway(
  env: Env,
  options: EmailOptions
): Promise<boolean> {
  const fromEmail = env.SMTP_FROM || env.SMTP_USER || '';
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || 'SubDomain Hub';

  // 使用 SMTP_HOST 作为 HTTP API 端点
  // 支持格式: https://your-smtp-relay.example.com/send
  const endpoint = env.SMTP_HOST!;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${env.SMTP_USER}:${env.SMTP_PASS}`)}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || '',
      }),
    });

    if (response.ok) {
      return true;
    }
    const bodyText = await response.text().catch(() => '');
    console.error('SMTP gateway rejected:', response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error('SMTP gateway send error:', err);
    return false;
  }
}

/**
 * 通过 Resend 发送（HTTP API，推荐作为第三方发信服务）
 * 只需配置 RESEND_API_KEY，无需 MailChannels 那套 DNS（SPF/Domain Lockdown/DKIM）
 */
async function sendViaResend(
  env: Env,
  options: EmailOptions
): Promise<boolean> {
  const fromEmail = env.SMTP_FROM || `noreply@${getDomainFromEnv(env)}`;
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || 'SubDomain Hub';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || '',
      }),
    });

    if (response.ok) {
      return true;
    }
    const bodyText = await response.text().catch(() => '');
    console.error('Resend rejected:', response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error('Resend send error:', err);
    return false;
  }
}

function getDomainFromEnv(env: Env): string {
  const domains = env.DOMAINS?.split(',');
  return domains?.[0]?.trim() || 'example.com';
}

/**
 * 发送邮件（自动选择可用的发送方式）
 */
export async function sendEmail(
  env: Env,
  options: EmailOptions
): Promise<boolean> {
  // 1) 配置了 RESEND_API_KEY → 走 Resend（第三方，推荐）
  if (env.RESEND_API_KEY) {
    return sendViaResend(env, options);
  }

  // 2) 配置了 SMTP 三件套 → 走 SMTP HTTP 网关
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return sendViaSmtpGateway(env, options);
  }

  // 3) 默认 MailChannels
  return sendViaMailChannels(env, options);
}

// ==================== 邮件模板 ====================

export function buildApprovalEmail(
  subdomain: string,
  domain: string,
  siteName: string,
  siteUrl: string
): EmailOptions {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: '', // 由调用方填入
    subject: `✅ 您的子域名 ${fqdn} 已通过审核 - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#16a34a;margin:0 0 16px;">✅ 审核通过</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    恭喜！您申请的子域名 <strong style="font-family:monospace;background:#f0fdf4;padding:2px 8px;border-radius:4px;">${fqdn}</strong> 已通过管理员审核。
  </p>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    您现在可以登录管理面板，为您的子域名添加 DNS 记录了。
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      前往管理面板
    </a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    此邮件由 ${siteName} 自动发送，请勿直接回复。
  </p>
</div>
</body></html>`,
    text: `恭喜！您的子域名 ${fqdn} 已通过审核。请登录 ${siteUrl} 管理 DNS 记录。`,
  };
}

export function buildRejectionEmail(
  subdomain: string,
  domain: string,
  reason: string,
  siteName: string,
  siteUrl: string
): EmailOptions {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: '',
    subject: `❌ 您的子域名 ${fqdn} 审核未通过 - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#dc2626;margin:0 0 16px;">❌ 审核未通过</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    很抱歉，您申请的子域名 <strong style="font-family:monospace;background:#fef2f2;padding:2px 8px;border-radius:4px;">${fqdn}</strong> 未通过管理员审核。
  </p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="color:#991b1b;font-size:14px;margin:0;"><strong>拒绝原因：</strong></p>
    <p style="color:#991b1b;font-size:14px;margin:8px 0 0;">${reason}</p>
  </div>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    您可以登录管理面板重新申请其他子域名。
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      前往管理面板
    </a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    此邮件由 ${siteName} 自动发送，请勿直接回复。
  </p>
</div>
</body></html>`,
    text: `很抱歉，您的子域名 ${fqdn} 审核未通过。原因：${reason}。请登录 ${siteUrl} 重新申请。`,
  };
}

export function buildNewRequestNotifyEmail(
  username: string,
  subdomain: string,
  domain: string,
  siteName: string,
  siteUrl: string
): EmailOptions {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: '',
    subject: `📋 新的子域名申请: ${fqdn} - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#4f46e5;margin:0 0 16px;">📋 新的子域名申请</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    用户 <strong>${username}</strong> 申请了子域名
    <strong style="font-family:monospace;background:#eef2ff;padding:2px 8px;border-radius:4px;">${fqdn}</strong>，
    等待您的审核。
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      前往审核
    </a>
  </div>
</div>
</body></html>`,
    text: `用户 ${username} 申请了子域名 ${fqdn}，请登录 ${siteUrl} 审核。`,
  };
}

/** 管理员删除（或停用）子域名时发送给用户的通知邮件 */
export function buildDeletionNoticeEmail(
  subdomain: string,
  domain: string,
  reason: string,
  siteName: string,
  siteUrl: string
): EmailOptions {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: '',
    subject: `🛑 您的子域名 ${fqdn} 已被移除 - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#dc2626;margin:0 0 16px;">🛑 子域名已被移除</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    您的子域名 <strong style="font-family:monospace;background:#fef2f2;padding:2px 8px;border-radius:4px;">${fqdn}</strong>
    已被管理员回收，其下 DNS 解析配置已同步删除，域名将不再生效。
  </p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="color:#991b1b;font-size:14px;margin:0;"><strong>移除原因：</strong></p>
    <p style="color:#991b1b;font-size:14px;margin:8px 0 0;">${reason}</p>
  </div>
  <p style="color:#333;font-size:15px;line-height:1.6;">如需恢复，可重新登录 ${siteName} 申请其他子域名。</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${siteUrl}" style="background:#dc2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">返回 ${siteName}</a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">此邮件由 ${siteName} 自动发送，请勿直接回复。</p>
</div>
</body></html>`,
    text: `您的子域名 ${fqdn} 已被管理员回收，DNS 解析已同步删除。移除原因：${reason}。`,
  };
}

/** 用户自行删除子域名时，通知管理员的邮件 */
export function buildUserDeletedAdminEmail(
  username: string,
  subdomain: string,
  domain: string,
  siteName: string,
  siteUrl: string
): EmailOptions {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: '',
    subject: `🗑️ 用户删除了子域名 ${fqdn} - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#f59e0b;margin:0 0 16px;">🗑️ 子域名已由用户删除</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    用户 <strong>${username}</strong> 已删除子域名
    <strong style="font-family:monospace;background:#fef3c7;padding:2px 8px;border-radius:4px;">${fqdn}</strong>。
  </p>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    该子域名下的全部 DNS 解析配置已同步自动删除，域名不再解析，原权限已回收。
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${siteUrl}" style="background:#f59e0b;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">前往管理后台</a>
  </div>
</div>
</body></html>`,
    text: `用户 ${username} 删除了子域名 ${fqdn}，其下 DNS 解析已同步删除。`,
  };
}

/** 上级所有权审批请求：发给“最近被拥有的祖先”的所有者，含确定/驳回按钮 */
export function buildOwnerApprovalRequestEmail(
  ownerName: string,
  applicantName: string,
  targetFqdn: string,
  baseFqdn: string,
  approveUrl: string,
  rejectUrl: string,
  deadlineHours: number,
  siteName: string,
  siteUrl: string
): EmailOptions {
  return {
    to: '',
    subject: `📩 子域名审批请求：${applicantName} 申请 ${targetFqdn} - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#3b82f6;margin:0 0 12px;">📩 子域名审批申请</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">您好，您拥有上层子域名
    <strong style="font-family:monospace;background:#eff6ff;padding:2px 8px;border-radius:4px;">${baseFqdn}</strong>，
    用户 <strong>${applicantName}</strong> 申请其下子域名
    <strong style="font-family:monospace;background:#eff6ff;padding:2px 8px;border-radius:4px;">${targetFqdn}</strong> 的使用权。</p>
  <p style="color:#64748b;font-size:14px;">请在 <strong>${deadlineHours} 小时内</strong>处理；超时未处理将自动驳回。</p>
  <div style="display:flex;gap:12px;margin:24px 0;">
    <a href="${approveUrl}" style="flex:1;text-align:center;background:#16a34a;color:#fff;padding:12px 0;border-radius:8px;text-decoration:none;font-weight:600;">✔ 同意</a>
    <a href="${rejectUrl}" style="flex:1;text-align:center;background:#dc2626;color:#fff;padding:12px 0;border-radius:8px;text-decoration:none;font-weight:600;">✘ 驳回</a>
  </div>
  <div style="text-align:center;margin:16px 0;"><a href="${siteUrl}" style="color:#3b82f6;font-size:14px;">前往 ${siteName}</a></div>
  <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">此邮件由 ${siteName} 自动发送，请勿直接回复。</p>
</div>
</body></html>`,
    text: `用户 ${applicantName} 申请您拥有的 ${baseFqdn} 之下级子域名 ${targetFqdn}。同意：${approveUrl}；驳回：${rejectUrl}。${deadlineHours} 小时内未处理将自动驳回。`,
  };
}

/** 把上级审批结果通知给申请人（同意/驳回/超时自动驳回） */
export function buildOwnerApprovalResultEmail(
  applicantName: string,
  targetFqdn: string,
  baseFqdn: string,
  result: 'approved' | 'rejected' | 'expired',
  siteName: string,
  siteUrl: string
): EmailOptions {
  const map = {
    approved: { emoji: '✅', color: '#16a34a', title: '审批已同意', desc: `您申请的子域名 ${targetFqdn} 已获上层 ${baseFqdn} 所有者同意，现已生效。` },
    rejected: { emoji: '⛔', color: '#dc2626', title: '审批已驳回', desc: `您申请的子域名 ${targetFqdn} 已被上层 ${baseFqdn} 所有者驳回，未能开通。` },
    expired: { emoji: '⏰', color: '#f59e0b', title: '审批已超时自动驳回', desc: `您申请的子域名 ${targetFqdn} 因上层所有者未在时限内处理而被自动驳回，请重新申请。` },
  } as const;
  const m = map[result];
  return {
    to: '',
    subject: `${m.emoji} ${m.title}：${targetFqdn} - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:${m.color};margin:0 0 16px;">${m.emoji} ${m.title}</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">${m.desc}</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${siteUrl}" style="display:inline-block;background:${m.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">前往 ${siteName}</a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">此邮件由 ${siteName} 自动发送，请勿直接回复。</p>
</div>
</body></html>`,
    text: `${m.title}：${m.desc}`,
  };
}
