import { Hono } from 'hono';
import type { Env, User } from '../types';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import {
  isEmailVerificationRequired,
  isEmailDomainAllowed,
  getAllowedEmailDomains,
  getEmailVerificationStatus,
  createEmailVerification,
  verifyEmailByToken,
  resendVerificationEmail,
} from '../services/email-verification';
import { sendEmail } from '../services/email';
import { updateUserEmail } from '../db/queries';

type Variables = { user: User };

const verification = new Hono<{ Bindings: Env; Variables: Variables }>();

// 获取邮箱验证配置
verification.get('/config', optionalAuthMiddleware, async (c) => {
  const env = c.env;
  const required = isEmailVerificationRequired(env);
  const allowedDomains = getAllowedEmailDomains(env);

  return c.json({
    required,
    allowedDomains,
  });
});

// 获取当前用户的邮箱验证状态
verification.get('/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const status = await getEmailVerificationStatus(c.env.DB, user.id);

  if (!status) {
    return c.json({ error: '用户不存在' }, 404);
  }

  return c.json(status);
});

// 发送验证邮件
verification.post('/send', authMiddleware, async (c) => {
  const user = c.get('user');
  const env = c.env;

  if (!user.email) {
    return c.json({ error: '用户没有邮箱地址' }, 400);
  }

  const required = isEmailVerificationRequired(env);
  if (!required) {
    return c.json({ error: '邮箱验证未启用' }, 400);
  }

  const allowed = isEmailDomainAllowed(env, user.email);
  if (!allowed) {
    return c.json({ error: '该邮箱域名不在允许列表中' }, 400);
  }

  try {
    const token = crypto.randomUUID().replace(/-/g, '');
    await createEmailVerification(c.env.DB, user.id, user.email);

    const siteName = env.SITE_NAME || 'SubDomain Hub';
    const url = new URL(c.req.url);
    const siteUrl = url.origin;

    await resendVerificationEmail(env, c.env.DB, user.id, user.email, siteName, siteUrl);

    return c.json({ message: '验证邮件已发送，请查收' });
  } catch (err: any) {
    return c.json({ error: err.message || '发送验证邮件失败' }, 500);
  }
});

// 绑定邮箱（当用户没有邮箱或想更换邮箱时）
verification.post('/bind', authMiddleware, async (c) => {
  const user = c.get('user');
  const env = c.env;

  let email = '';
  try {
    email = (await c.req.json<{ email: string }>()).email?.trim().toLowerCase() || '';
  } catch {
    return c.json({ error: '请提供邮箱地址' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return c.json({ error: '邮箱格式不正确' }, 400);
  }

  const allowed = isEmailDomainAllowed(env, email);
  if (!allowed) {
    return c.json({ error: '该邮箱域名不在允许列表中' }, 400);
  }

  try {
    await updateUserEmail(c.env.DB, user.id, email);

    const token = crypto.randomUUID().replace(/-/g, '');
    await createEmailVerification(c.env.DB, user.id, email);

    const siteName = env.SITE_NAME || 'SubDomain Hub';
    const url = new URL(c.req.url);
    const siteUrl = url.origin;

    await resendVerificationEmail(env, c.env.DB, user.id, email, siteName, siteUrl);

    return c.json({ message: '邮箱已绑定，验证邮件已发送，请查收', email });
  } catch (err: any) {
    return c.json({ error: err.message || '绑定邮箱失败' }, 500);
  }
});

// 验证邮箱
verification.get('/confirm', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.json({ error: '缺少验证令牌' }, 400);
  }

  try {
    const result = await verifyEmailByToken(c.env.DB, token);

    if (!result) {
      return c.json({ error: '验证链接无效或已过期' }, 400);
    }

    return c.json({
      success: true,
      message: '邮箱验证成功',
      email: result.email,
    });
  } catch (err: any) {
    return c.json({ error: err.message || '验证失败' }, 500);
  }
});

// 检查邮箱是否允许
verification.post('/check-domain', async (c) => {
  const body = await c.req.json<{ email: string }>();

  if (!body.email) {
    return c.json({ error: '请提供邮箱地址' }, 400);
  }

  const allowed = isEmailDomainAllowed(c.env, body.email);

  return c.json({
    allowed,
    domain: body.email.split('@')[1]?.toLowerCase(),
  });
});

export default verification;
