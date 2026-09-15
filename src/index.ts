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
import {
  getOwnerApprovalByToken,
  setOwnerApprovalStatus,
  findUserById,
  createSubdomain,
  findSubdomain,
  approveSubdomain,
} from './db/queries';
import { sendEmail } from './services/email';
import { buildOwnerApprovalResultEmail } from './services/email';
import {
  approveOwnerApproval,
  rejectOwnerApproval,
  expireOwnerApproval,
} from './services/owner-approval';
import { syncD1ToMirrors } from './services/sync';

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

// ==================== 上级所有权审批决策落地页 ====================
// 邮件「同意/驳回」按钮链接到该页。逻辑：
//  - 超时（now > deadline_at）且仍 pending → 自动标 expired（视为自动驳回），不能再操作。
//  - 已决定 → 显示已决定结果，重复点击不重复生效。
//  - pending 未超时 → approve：为该目标创建子域名并置为 approved（所有权者已同意）；
//    reject：标记 rejected。均邮件通知申请人。
app.get('/decide-approval', async (c) => {
  const token = (c.req.query('token') || '').trim();
  const action = (c.req.query('action') || '').trim();
  const page = (emoji: string, title: string, desc: string, extra?: string) =>
    c.html(`<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>审批结果</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#e0eaff,#f8fbff);color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(59,130,246,.15);padding:40px;max-width:420px"><div style="font-size:52px">${emoji}</div><h2 style="margin:16px 0 8px">${title}</h2><p style="color:#64748b;margin:0 0 8px;line-height:1.6">${desc}</p>${extra || ''}<a href="/" style="display:inline-block;margin-top:20px;background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">返回首页</a></div></body></html>`);

  if (!token || (action !== 'approve' && action !== 'reject')) {
    return page('❓', '链接无效', '请从邮件中打开完整链接。');
  }
  const approval = await getOwnerApprovalByToken(c.env, token);
  if (!approval) {
    return page('❌', '审批请求不存在', '该链接已失效。');
  }
  const siteUrl = new URL(c.req.url).origin;
  const siteName = c.env.SITE_NAME || 'SubDomain Hub';

  // 已决定 → 不再生效，仅提示结果
  if ((approval.status as string) !== 'pending') {
    const map: Record<string, { e: string; t: string; d: string }> = {
      approved: { e: '✅', t: '已同意', d: '该申请已被同意并生效。' },
      rejected: { e: '⛔', t: '已驳回', d: '该申请已被驳回。' },
      expired: { e: '⏰', t: '已超时自动驳回', d: '该申请因超时未处理已被自动驳回。' },
    };
    const m = map[approval.status] || map.rejected;
    return page(m.e, m.t, m.d);
  }

  // 超时自动驳回（pending 且已超时，仅首次生效）
  if (await expireOwnerApproval(c.env, approval, siteUrl)) {
    return page('⏰', '审批已超时自动驳回', `${approval.target_fqdn} 因未在时限内处理而被自动驳回。`);
  }

  if (action === 'reject') {
    await rejectOwnerApproval(c.env, approval, siteUrl);
    return page('⛔', '已驳回', `${approval.target_fqdn} 已被驳回，未能开通。`);
  }

  // approve：创建子域名并置为 approved（所有权者已同意）
  const r = await approveOwnerApproval(c.env, approval, siteUrl);
  return r.dupe
    ? page('⚠️', '已存在同名子域名', `${approval.target_fqdn} 已存在，无需重复开通。`)
    : page('✅', '已同意', `${approval.target_fqdn} 已开通，申请用户可开始为其配置解析。`);
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
  const resp = await fetch(url.toString(), { headers: { 'user-agent': 'SubdomainHub/1.0' } });
  const ct = resp.headers.get('content-type') || 'application/octet-stream';
  return new Response(resp.body, {
    status: resp.status,
    // max-age=1 天+ s-maxage=1 天：浏览器本地缓存 + Cloudflare 边缘 CDN 缓存。
    // 首个访客触发 Worker→源站后，同图在 1 天内再次被请求直接命中 CF 边缘缓存，
    // 不再触发 Worker 执行、不计 Worker 请求数、不耗出站 —— 即“走 CDN 分发不耗 Worker”。
    headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400, s-maxage=86400', 'x-content-type-options': 'nosniff' },
  });
});

// 传统 favicon.ico 端点：via 等极简浏览器只请求 /favicon.ico 且仅认 ico/png。
app.get('/favicon.ico', async (c) => {
  const logo = c.env.SITE_LOGO as string | undefined;
  if (!logo) return c.body(null, 204);
  const resp = await fetch(logo, { headers: { 'user-agent': 'SubdomainHub/1.0' } });
  if (!resp.ok) return c.body(null, 404);
  return new Response(resp.body, {
    status: 200,
    headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=86400, s-maxage=86400' },
  });
});

// 固定 logo 端点：HTML 头/导航只引用本站固定路径 /logo，不暴露外链真实域名（SITE_LOGO 仅在服务端 env）。
// 由 Worker → 源站中转 + 边缘 CDN 缓存（s-maxage=1 天），访客不直连外部源站。
app.get('/logo', async (c) => {
  const logo = c.env.SITE_LOGO as string | undefined;
  if (!logo) return c.body(null, 204);
  const resp = await fetch(logo, { headers: { 'user-agent': 'SubdomainHub/1.0' } });
  if (!resp.ok) return c.body(null, 404);
  const ct = resp.headers.get('content-type') || 'image/png';
  return new Response(resp.body, {
    status: 200,
    headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400, s-maxage=86400', 'x-content-type-options': 'nosniff' },
  });
});

// 固定背景端点：HTML 背景只引用 /bg，真实 URL 仅在服务端 env（SITE_BACKGROUND_IMAGE）。
app.get('/bg', async (c) => {
  const bg = c.env.SITE_BACKGROUND_IMAGE as string | undefined;
  if (!bg) return c.body(null, 204);
  const resp = await fetch(bg, { headers: { 'user-agent': 'SubdomainHub/1.0' } });
  if (!resp.ok) return c.body(null, 404);
  const ct = resp.headers.get('content-type') || 'image/jpeg';
  return new Response(resp.body, {
    status: 200,
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
  const result = await verifyEmailByToken(c.env, token);
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

// ==================== Worker 导出（fetch + scheduled） ====================
// scheduled（cron）定时触发 D1 → 镜像后端（MySQL / 自定义 SQLite）自动同步：
// 幂等、离线于请求路径，不耗每次请求的 D1 额度。未配置任何镜像（纯 D1）时
// syncD1ToMirrors 为 no-op，线上行为不变。与 wrangler.toml [triggers] crons 配合。
export default {
  fetch: app.fetch.bind(app),
  scheduled: async (_controller: unknown, env: Env, _ctx: unknown): Promise<void> => {
    await syncD1ToMirrors(env);
  },
};

