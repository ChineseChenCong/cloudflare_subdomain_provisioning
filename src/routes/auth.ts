import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env, User } from '../types';
import { getGitHubAuthUrl, exchangeCodeForToken, getGitHubUser } from '../services/github';
import { upsertUser } from '../db/queries';
import { signJwt } from '../middleware/auth';
import { getAdminUsers, isEmailVerificationRequired, getAllowedEmailDomains } from '../config';

type Variables = { user: User };

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// 发起 GitHub OAuth 登录
auth.get('/github', async (c) => {
  const url = new URL(c.req.url);
  const redirectUri = `${url.origin}/auth/github/callback`;

  // 生成随机 state 防止 CSRF
  const state = crypto.randomUUID();

  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });

  const authUrl = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, redirectUri, state);
  return c.redirect(authUrl);
});

// GitHub OAuth 回调
auth.get('/github/callback', async (c) => {
  const { code, state } = c.req.query();

  if (!code || !state) {
    return c.json({ error: '缺少参数' }, 400);
  }

  // 验证 state
  const savedState = c.req.header('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('oauth_state='))
    ?.split('=')[1]
    ?.trim();

  if (savedState !== state) {
    return c.json({ error: 'State 校验失败，请重新登录' }, 400);
  }

  try {
    // 换取 access token
    const accessToken = await exchangeCodeForToken(
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      code
    );

    // 获取 GitHub 用户信息
    const ghUser = await getGitHubUser(accessToken);

    // 检查是否为管理员
    const adminUsers = getAdminUsers(c.env);
    const isAdmin = adminUsers.includes(ghUser.login.toLowerCase());

    // 检查邮箱是否在白名单中
    const allowedDomains = getAllowedEmailDomains(c.env);
    if (allowedDomains.length > 0 && ghUser.email) {
      const emailDomain = ghUser.email.split('@')[1]?.toLowerCase();
      if (emailDomain && !allowedDomains.includes(emailDomain)) {
        return c.json({
          error: `邮箱域名 @${emailDomain} 不在允许列表中`,
          allowed_domains: allowedDomains,
        }, 403);
      }
    }

    // 创建或更新用户
    const user = await upsertUser(
      c.env.DB,
      ghUser.id,
      ghUser.login,
      ghUser.avatar_url,
      ghUser.email,
      isAdmin
    );

    // 检查是否需要邮箱验证
    const verificationRequired = isEmailVerificationRequired(c.env);

    // 签发 JWT
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        sub: user.id,
        iat: now,
        exp: now + 7 * 24 * 60 * 60, // 7 天有效期
      },
      c.env.JWT_SECRET
    );

    // 清除 oauth_state cookie
    deleteCookie(c, 'oauth_state', { path: '/' });

    // 设置 session cookie
    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // 如果需要邮箱验证且用户未验证，重定向到验证页面
    if (verificationRequired && !user.email_verified && user.email) {
      return c.redirect('/?view=verify-email');
    }

    return c.redirect('/');
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    const msg = err?.message || '未知错误';
    // 如果上游返回了 HTML（常见于 client_secret 错误 / redirect_uri 不匹配），把状态码和内容类型一并暴露
    const detail = /(key|JWT_SECRET|signature|importKey)/i.test(msg)
      ? '服务器 JWT_SECRET 未正确配置'
      : msg;
    return c.json({ error: `登录失败：${detail}`, hint: '检查 GitHub OAuth App 的 Authorization callback URL 是否精确匹配当前域名' }, 500);
  }
});

// 登出
auth.get('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/');
});

export default auth;
