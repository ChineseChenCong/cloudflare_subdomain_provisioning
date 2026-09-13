import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, User } from './types';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import pageRoutes from './routes/pages';
import accountRoutes from './routes/accounts';
import verificationRoutes from './routes/verification';
import proxiedRoutes from './routes/proxied';
import announcementRoutes from './routes/announcements';
import { verifyEmailByToken } from './services/email-verification';

type Variables = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 邮件验证落地页（邮件中的验证链接指向 /verify-email?token=...）
app.get('/verify-email', async (c) => {
  const token = c.req.query('token');
  const page = (emoji: string, title: string, desc: string) =>
    c.html(`<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>邮箱验证</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#e0eaff,#f8fbff);color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(59,130,246,.15);padding:40px;max-width:380px"><div style="font-size:52px">${emoji}</div><h2 style="margin:16px 0 8px">${title}</h2><p style="color:#64748b;margin:0 0 20px;line-height:1.6">${desc}</p><a href="/" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">返回首页</a></div></body></html>`);
  if (!token) {
    return page('❓', '验证链接缺少令牌', '请从邮件中打开完整链接。');
  }
  const result = await verifyEmailByToken(c.env.DB, token);
  if (!result) {
    return page('❌', '验证链接无效或已过期', '该链接已失效，请重新发送验证邮件。');
  }
  return page('✅', '邮箱验证成功', `已验证邮箱 <strong>${result.email}</strong>。请回到站点刷新，即可正常使用全部功能。`);
});

// 路由挂载
app.route('/auth', authRoutes);
// 邮箱验证相关路由必须先于 /api 注册：api 路由组挂了 emailVerifiedMiddleware(/*),
// 若 verification 在其后注册会被一并拦截,导致未验证用户连 /config /send /bind 都 403,
// 形成「看不到横幅→无法验证→永远 403」的死锁。
app.route('/api/verification', verificationRoutes);
app.route('/api', apiRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/proxied', proxiedRoutes);
app.route('/announcements', announcementRoutes);
app.route('/', pageRoutes);

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: '服务器内部错误' }, 500);
});

export default app;
