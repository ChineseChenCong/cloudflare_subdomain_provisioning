import { Context } from 'hono';
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

// ==================== 安全辅助（同源 / 限流） ====================
// 判断请求是否来自本站（Origin 或 Referer 与当前 origin 一致；两者皆缺视为同源/API 客户端放行）
function isSameOrigin(c: Context): boolean {
  const self = new URL(c.req.url).origin;
  const origin = c.req.header('origin');
  if (origin) {
    try { return new URL(origin).origin === self; } catch { return false; }
  }
  const referer = c.req.header('referer');
  if (referer) {
    try { return new URL(referer).origin === self; } catch { return false; }
  }
  return true;
}

// 轻量内存窗口限流（单 isolate 内存，基础防护；用于发邮件等易被刷的接口）
const rateBuckets = new Map<string, { first: number; count: number }>();
function rateLimit(c: Context, windowMs: number, max: number, keyBase: string): boolean {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const key = `${keyBase}:${ip}`;
  const b = rateBuckets.get(key);
  if (!b || now - b.first >= windowMs) {
    if (rateBuckets.size > 10000) rateBuckets.clear();
    rateBuckets.set(key, { first: now, count: 1 });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ==================== 安全响应头 ====================
// 非破坏性安全头。注意：CSP 刻意不加——本项目前端（pages.ts）有大量内联
// script/style/onclick，若加严格 CSP 会直接破坏页面显示与功能，违背
// “安全与功能/显示均最佳”的叠加目标。
app.use('*', async (c, next) => {
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  await next();
});

// ==================== CORS（仅同源，收紧替代 origin:'*'） ====================
// 同源请求浏览器本不依赖 CORS；跨源则返回空 → 浏览器拒绝跨域读写，缩小凭证暴露面。
app.use('/api/*', cors({
  origin: (origin, c) => {
    if (!origin) return '';
    try {
      return new URL(origin).origin === new URL(c.req.url).origin ? origin : '';
    } catch {
      return '';
    }
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ==================== CSRF 二道防线 + 写操作审计日志 ====================
// cookie sameSite=Lax 已挡大部分跨站；此处再加 Origin/Referer 校验作为纵深。
// 同时对写方法输出结构化审计日志（零 DB，console.log → Dashboard Logs / wrangler tail，
// 保留约 3 天）：记录 时间/方法/路径/IP，不携带任何私有数据。
const csrfAndAudit = async (c: Context, next: any) => {
  const m = c.req.method;
  if (m === 'POST' || m === 'PUT' || m === 'DELETE' || m === 'PATCH') {
    const ip = c.req.header('CF-Connecting-IP') || '-';
    console.log(`[audit] ${new Date().toISOString()} ${m} ${c.req.path} ip=${ip}`);
    if (!isSameOrigin(c)) {
      return c.json({ error: 'CSRF: 跨源请求被拒绝' }, 403);
    }
  }
  await next();
};
// /api/* 与 /announcements（公告管理也含写方法，一并纳入 CSRF 与审计）
app.use('/api/*', csrfAndAudit);
app.use('/announcements', csrfAndAudit);

// ==================== 发邮件接口限流（防刷） ====================
// 每 IP 每分钟最多 5 次验证邮件发送请求（叠加既有“每用户每日 5 封”）。
app.use('/api/verification/send', async (c, next) => {
  if (!rateLimit(c, 60_000, 5, 'verify-send')) {
    return c.json({ error: '请求过于频繁，请稍后再试' }, 429);
  }
  await next();
});

// ==================== 外链资源代理（本域中转） ====================
// 外部图片/资源经本站 /assets 转发：HTML 只暴露本站路径、不泄露外链真实域名
// （防爬虫/扫描发现外链来源）；访客不再直连外部源站，源站只接收 Worker 请求
// → 保护外链服务器（源站 IP 隐藏、防定向扫描/攻击）。白名单 host 校验防 SSRF，
// 非开放代理；复用 rateLimit 防刷。
// /assets 现仅服务 sukicdn.com（logo/背景图代理）。头像已改 GitHub 直连，
// github/CDN 域名段无需再开放；白名单越窄，SSRF/被借打出面越小。
// 若日后公告正文需外链图片，再按实际域名逐个加入白名单。
const ALLOWED_ASSET_HOSTS = ['sukicdn.com'];
app.get('/assets', async (c) => {
  const raw = c.req.query('src');
  if (!raw) return c.json({ error: '缺少资源地址' }, 400);
  let url: URL;
  try { url = new URL(raw); } catch { return c.json({ error: '无效地址' }, 400); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return c.json({ error: '仅允许 http(s)' }, 400);
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_ASSET_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  if (!allowed) return c.json({ error: '资源域名不在白名单' }, 403);
  if (!rateLimit(c, 60_000, 60, 'asset')) return c.json({ error: '请求过于频繁' }, 429);
  const resp = await fetch(url.toString(), { headers: { 'user-agent': 'R.O.L.-DomainSystem' } });
  const ct = resp.headers.get('content-type') || 'application/octet-stream';
  return new Response(resp.body, {
    status: resp.status,
    // max-age=1 天+ s-maxage=1 天：浏览器本地缓存 + Cloudflare 边缘 CDN 缓存。
    // 首个访客触发 Worker→源站后，同图在 1 天内再次被请求直接命中 CF 边缘缓存，
    // 不再触发 Worker 执行、不计 Worker 请求数、不耗出站 —— 即“走 CDN 分发不耗 Worker”。
    headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400, s-maxage=86400', 'x-content-type-options': 'nosniff' },
  });
});

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
