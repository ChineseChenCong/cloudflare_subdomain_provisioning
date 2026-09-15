import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import type { Env, User } from '../types';
import { optionalAuthMiddleware } from '../middleware/auth';
import {
  getBackgroundImage,
  getBackgroundOverlay,
  getSiteLogo,
  getSiteName,
  getSiteBeian,
  getFriendLinks,
  getAdminContactEmail,
} from '../config';

type Variables = { user: User };

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

pages.use('/*', optionalAuthMiddleware);

pages.get('/', (c) => {
  const user = c.get('user');
  const siteName = getSiteName(c.env);
  const backgroundImage = getBackgroundImage(c.env);
  const backgroundOverlay = getBackgroundOverlay(c.env);
  const siteLogo = getSiteLogo(c.env);
  const beian = getSiteBeian(c.env);
  const friendLinks = getFriendLinks(c.env);
  const adminContactEmail = getAdminContactEmail(c.env);

  return c.html(renderPage({
    siteName,
    user,
    backgroundImage,
    backgroundOverlay,
    siteLogo,
    beian,
    friendLinks,
    adminContactEmail,
  }));
});

function renderPage({
  siteName,
  user,
  backgroundImage,
  backgroundOverlay,
  siteLogo,
  beian,
  friendLinks,
  adminContactEmail,
}: {
  siteName: string;
  user?: User;
  backgroundImage?: string | null;
  backgroundOverlay?: string;
  siteLogo?: string | null;
  beian?: string;
  friendLinks?: { name: string; url: string }[];
  adminContactEmail?: string;
}) {
  // 外链→本域中转：HTML 只暴露本站固定路径（/logo、/bg、/assets），不泄露外链真实域名，
  // 真实 URL 只存在于服务端 env；访客只接本站、外部源站只接 Worker（保源站安全）。
  const bgStyle = backgroundImage
    ? `background-image: url('/bg'); background-size: cover; background-position: center; background-attachment: fixed;`
    : '';

  const overlayStyle = backgroundImage
    ? `position: relative;`
    : '';

  // 默认 Logo（萌系 Cloudflare 卫星风格 SVG）
  const defaultLogoSvg = `<svg viewBox="0 0 64 64" width="38" height="38" xmlns="http://www.w3.org/2000/svg" style="border-radius:12px"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="14" fill="url(#lg)"/><circle cx="32" cy="32" r="14" fill="#fff" opacity=".95"/><g fill="#3b82f6"><circle cx="27" cy="28" r="4"/><circle cx="37" cy="28" r="4"/><circle cx="28" cy="25" r="2.2"/><circle cx="38" cy="25" r="2.2"/><path d="M23 34c2-4 5-3 5-3h8s3-1 5 3l1 4H22z" fill="#2563eb"/><path d="M24 35c1.6-2.6 4-2 4-2h8s2.4-.6 4 2" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/></g></svg>`;

  return html`<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  ${raw(siteLogo
    ? `<link rel="icon" href="/logo" type="image/png">`
    : `<link rel="icon" href="data:image/svg+xml;base64,${btoa(defaultLogoSvg)}">`)}
  ${raw(`<link rel="shortcut icon" href="/favicon.ico">`)}
  ${raw(siteLogo
    ? `<link rel="apple-touch-icon" href="/logo">`
    : `<link rel="apple-touch-icon" href="data:image/svg+xml;base64,${btoa(defaultLogoSvg)}">`)}
  <link rel="stylesheet" href="/static/app.css">
  ${raw(backgroundOverlay ? `<style>:root { --overlay: ${backgroundOverlay}; }</style>` : '')}
  
  ${raw(backgroundImage ? `<div class="bg-image-wrapper"><img class="bg-image" src="/bg" alt="background" /><div class="bg-overlay"></div></div>` : '')}
</head>
<body>
  <!-- 可爱的漂浮装饰气泡 -->
  <div class="deco-bubble" style="width:120px;height:120px;top:18%;right:-30px;background:linear-gradient(135deg,#38bdf8,#818cf8);"></div>
  <div class="deco-bubble" style="width:90px;height:90px;bottom:12%;left:-24px;background:linear-gradient(135deg,#f472b6,#a78bfa);animation-delay:-4s;"></div>
  <div class="deco-bubble" style="width:64px;height:64px;top:60%;right:6%;background:linear-gradient(135deg,#34d399,#38bdf8);animation-delay:-8s;"></div>

  <header class="header">
    <div class="container">
      <a href="/" class="logo" onclick="navigate('home'); return false;">
        ${raw(siteLogo ? `<img src="/logo" alt="logo" class="logo-icon" style="width:36px;height:36px;object-fit:contain;background:none;box-shadow:none;border-radius:12px;" />` : `<div class="logo-icon">${defaultLogoSvg}</div>`)}
        <span>${siteName}</span>
      </a>
      <div class="header-actions">
        <button class="theme-toggle" onclick="toggleTheme()" title="切换主题">
          <span id="theme-icon" style="display:flex;align-items:center;"></span>
        </button>
        <div id="header-user"></div>
      </div>
    </div>
  </header>

  <div id="announcements" class="container announcements-container"></div>

  <main id="app" class="container">
    <div class="loading-center"><div class="spinner"></div></div>
  </main>

  <div class="toast-container" id="toast-container"></div>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal-content">
      <h3 id="modal-title">确认</h3>
      <p id="modal-message"></p>
      <div id="modal-body"></div>
      <div class="modal-actions" id="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-danger" id="modal-confirm" onclick="confirmModal()">确认</button>
      </div>
    </div>
  </div>

  <script>
    const icons = {
      themeDark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
      themeLight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
      admin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      pending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      approved: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      rejected: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      globe: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      tool: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
      shield: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      mailbox: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5"></path></svg>',
      clipboard: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      users: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      email: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
      cloud: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>',
      key: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>'
    };

    const state = {
      user: ${raw(user ? `JSON.parse('${JSON.stringify({ id: user.id, github_username: user.github_username, avatar_url: user.avatar_url, is_admin: !!user.is_admin, email: user.email, email_verified: user.email_verified })}')` : 'null')}, // 头像走 GitHub 直连（av 头像域公共公开，无需代理；量大避免吃 /assets 额度）
      domains: [],
      subdomains: [],
      records: [],
      config: {},
      currentSubdomain: null,
      currentView: 'home',
      modalCallback: null,
      editingRecord: null,
      // Admin state
      adminTab: 'pending',
      adminPending: [],
      adminAll: [],
      adminUsers: [],
      adminAnnouncements: [],
      editingAnnouncement: null,
      // Cloudflare accounts
      accounts: [],
      selectedAccount: null,
      // 上级所有权审批（前端待审批面板）
      ownerApprovals: { requester: [], approver: [] },
      // 分页与筛选
      subPager: { page: 1, perPage: 5 },
      dnsPager: { page: 1, perPage: 5 },
      dnsTypeFilter: '',
      // 审批面板分页（待处理·待我处理 / 待处理·我发起 / 已处理折叠区）
      apprPager: { apPage: 1, apPer: 5, rqPage: 1, rqPer: 5, donePage: 1, donePer: 5 },
      // Email verification
      emailVerificationRequired: false,
      allowedEmailDomains: [],
      showVerifyBanner: false,
    };

    // ==================== API ====================
    async function api(path, opts = {}) {
      const res = await fetch('/api' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }

    // 公告接口（挂在顶层 /announcements 而非 /api，公开列表以及 /admin 管理均用 cookie 认证）
    async function annApi(path, opts = {}) {
      const res = await fetch('/announcements' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }

    // ==================== Toast ====================
    function toast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type + ' bounce-in';
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }

    // ==================== Modal ====================
    function showModal(title, message, callback, opts = {}) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').textContent = message;
      document.getElementById('modal-body').innerHTML = opts.bodyHtml || '';
      const actions = document.getElementById('modal-actions');
      const confirmBtn = document.getElementById('modal-confirm');
      confirmBtn.textContent = opts.confirmText || '确认';
      confirmBtn.className = 'btn ' + (opts.confirmClass || 'btn-danger btn-jelly');
      document.getElementById('modal-overlay').classList.add('active');
      state.modalCallback = callback;
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
      state.modalCallback = null;
    }

    function confirmModal() {
      if (state.modalCallback) state.modalCallback();
      closeModal();
    }

    // ==================== Theme ====================
    function getTheme() { return localStorage.getItem('theme') || 'dark'; }
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      document.getElementById('theme-icon').innerHTML = theme === 'dark' ? icons.themeDark : icons.themeLight;
    }
    function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

    // ==================== Navigation ====================
    function navigate(view, data) {
      state.currentView = view;
      if (data !== undefined) state.currentSubdomain = data;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderHeaderUser() {
      const el = document.getElementById('header-user');
      if (state.user) {
        let adminLink = '';
        if (state.user.is_admin) {
          adminLink = '<a href="#" class="btn btn-ghost btn-sm" onclick="navigate(\\'admin\\'); return false;" style="font-size:13px">' + icons.admin + ' 管理</a>';
        }
        el.innerHTML = '<div class="user-info">' +
          '<img class="user-avatar" src="' + (state.user.avatar_url || '') + '" alt="">' +
          '<span class="user-name">' + escapeHtml(state.user.github_username) + '</span>' +
          '</div>' + adminLink +
          '<a href="/auth/logout" class="btn btn-ghost btn-sm">退出</a>';
      } else {
        el.innerHTML = '';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function statusBadge(status) {
      const map = {
        pending: '<span class="badge badge-pending">' + icons.pending + ' 待审核</span>',
        approved: '<span class="badge badge-approved">' + icons.approved + ' 已通过</span>',
        rejected: '<span class="badge badge-rejected">' + icons.rejected + ' 已拒绝</span>',
      };
      return map[status] || status;
    }

    // ==================== Landing ====================
    function renderLanding() {
      return '<div class="hero fade-in">' +
        '<h1 class="gradient-text">获取你的专属子域名</h1>' +
        '<p>通过 GitHub 登录，申请属于自己的二级域名，经管理员审核后即可获得完整 DNS 控制权。</p>' +
        '<a href="/auth/github" class="btn btn-github btn-jelly">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.776.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.604-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>' +
        '使用 GitHub 登录' +
        '</a></div>' +
        '<div class="features">' +
        '<div class="card feature-card card-hover"><div class="feature-icon bounce">' + icons.globe + '</div><h3>安全分配</h3><p>管理员审核通过后，即可获得专属子域名</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon float">' + icons.tool + '</div><h3>完整 DNS 控制</h3><p>支持 A、AAAA、CNAME、MX、TXT、SRV、CAA 全类型记录</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon pulse-soft">' + icons.shield + '</div><h3>Cloudflare 加速</h3><p>依托 Cloudflare 全球网络，享受 CDN 加速与 DDoS 防护</p></div>' +
        '</div>';
    }

    // ==================== Dashboard ====================
    async function loadDashboardData() {
      try {
        const [domainData, subData] = await Promise.all([api('/domains'), api('/subdomains')]);
        state.domains = domainData.domains;
        state.config = {
          max_subdomains: domainData.max_subdomains,
          max_records: domainData.max_records,
          banned_prefixes: domainData.banned_prefixes,
          allowed_record_types: domainData.allowed_record_types,
        };
        state.subdomains = subData.subdomains;
      } catch (err) { toast(err.message, 'error'); }
    }

    async function loadOwnerApprovals() {
      try {
        const data = await api('/owner-approvals');
        state.ownerApprovals = data || { requester: [], approver: [] };
      } catch (err) { console.error('Failed to load owner approvals:', err); }
    }

    // 统一渲染上级审批状态徽标（pending 且已超时 → 按超时显示为已超时）
    function ownerApprovalMeta(a) {
      const expired = a.status === 'pending' && a.deadline_at && new Date(a.deadline_at).getTime() < Date.now();
      const st = expired ? 'expired' : a.status;
      const map = {
        pending: '<span class="badge badge-pending">' + icons.pending + ' 待审批</span>',
        approved: '<span class="badge badge-approved">' + icons.approved + ' 已同意</span>',
        rejected: '<span class="badge badge-rejected">' + icons.rejected + ' 已驳回</span>',
        expired: '<span class="badge badge-rejected">' + icons.rejected + ' 已超时</span>',
      };
      return { st, badge: map[st] || escapeHtml(a.status) };
    }

    // 待审批 · 层级子域面板（普通用户：我发起的 + 我作为所有权者待处理的）
    // ==================== 分页 / 筛选工具 ====================
    // items 按 pager 切片（页码自动夹取合法范围）
    function paginateItems(items, pager) {
      const total = items.length;
      const per = pager.perPage || 5;
      const pages = Math.max(1, Math.ceil(total / per));
      if (pager.page < 1) pager.page = 1;
      if (pager.page > pages) pager.page = pages;
      return { items: items.slice((pager.page - 1) * per, pager.page * per), page: pager.page, pages, total, per };
    }
    // 每页条数选择 + 翻页控件（‹/›/«/»）
    function pagerControl(pager, total, setPageName, setPerName) {
      const per = pager.perPage || 5;
      const pages = Math.max(1, Math.ceil(total / per));
      const cur = Math.min(pager.page, pages);
      const prev = cur > 1 ? cur - 1 : 1;
      const next = cur < pages ? cur + 1 : pages;
      let c = '<div class="pager" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:14px">';
      c += '<label style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px">每页 ' +
        '<select class="form-select" style="width:auto;padding:4px 26px 4px 10px;font-size:12px" onchange="' + setPerName + '(parseInt(this.value))">' +
        [5,10,20,50].map(function (n) { return '<option value="'+n+'"'+(per===n?' selected':'')+'>'+n+' 条</option>'; }).join('') +
        '</select></label>';
      c += '<div style="display:flex;align-items:center;gap:6px">' +
        '<button class="btn btn-sm btn-secondary" onclick="'+setPageName+'(1)"'+(cur<=1?' disabled':'')+'>«</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="'+setPageName+'('+prev+')"'+(cur<=1?' disabled':'')+'>‹</button>' +
        '<span style="font-size:13px;color:var(--text-primary);min-width:64px;text-align:center">' + cur + ' / ' + pages + '</span>' +
        '<button class="btn btn-sm btn-secondary" onclick="'+setPageName+'('+next+')"'+(cur>=pages?' disabled':'')+'>›</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="'+setPageName+'('+pages+')"'+(cur>=pages?' disabled':'')+'>»</button>' +
        '</div></div>';
      return c;
    }
    function subPage(n) { state.subPager.page = n; render(); }
    function setSubPer(n) { state.subPager.perPage = n; state.subPager.page = 1; render(); }
    function dnsPage(n) { state.dnsPager.page = n; render(); }
    function setDnsPer(n) { state.dnsPager.perPage = n; state.dnsPager.page = 1; render(); }
    function setDnsType(t) { state.dnsTypeFilter = t; state.dnsPager.page = 1; render(); }
    // 审批面板翻页：sec=ap(待我处理) | rq(我发起) | done(已处理折叠区)
    function setApprPage(sec, n) {
      if (sec === 'ap') state.apprPager.apPage = n;
      else if (sec === 'rq') state.apprPager.rqPage = n;
      else state.apprPager.donePage = n;
      render();
    }
    function setApprPer(sec, n) {
      if (sec === 'ap') { state.apprPager.apPer = n; state.apprPager.apPage = 1; }
      else if (sec === 'rq') { state.apprPager.rqPer = n; state.apprPager.rqPage = 1; }
      else { state.apprPager.donePer = n; state.apprPager.donePage = 1; }
      render();
    }
    // 审批面板专用分页控件（同 pagerControl 样式，onclick 携带分区参数 sec）
    function apprPagerControl(list, total, sec) {
      const per = list.per;
      const pages = list.pages;
      const cur = list.page;
      const prev = cur > 1 ? cur - 1 : 1;
      const next = cur < pages ? cur + 1 : pages;
      let c = '<div class="pager" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:14px">';
      c += '<label style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px">每页 ' +
        '<select class="form-select" style="width:auto;padding:4px 26px 4px 10px;font-size:12px" onchange="setApprPer(\\'' + sec + '\\',parseInt(this.value))">' +
        [5,10,20,50].map(function (n) { return '<option value="'+n+'"'+(per===n?' selected':'')+'>'+n+' 条</option>'; }).join('') +
        '</select></label>';
      c += '<div style="display:flex;align-items:center;gap:6px">' +
        '<button class="btn btn-sm btn-secondary" onclick="setApprPage(\\'' + sec + '\\',1)"'+(cur<=1?' disabled':'')+'>«</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="setApprPage(\\'' + sec + '\\','+prev+')"'+(cur<=1?' disabled':'')+'>‹</button>' +
        '<span style="font-size:13px;color:var(--text-primary);min-width:64px;text-align:center">' + cur + ' / ' + pages + '</span>' +
        '<button class="btn btn-sm btn-secondary" onclick="setApprPage(\\'' + sec + '\\','+next+')"'+(cur>=pages?' disabled':'')+'>›</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="setApprPage(\\'' + sec + '\\','+pages+')"'+(cur>=pages?' disabled':'')+'>»</button>' +
        '</div></div>';
      return c;
    }

    function renderApprovalsPanel() {
      const rq = state.ownerApprovals.requester || [];
      const ap = state.ownerApprovals.approver || [];

      // 分区：仅「待处理」(pending 且未超时) 留在主区；已处理(同意/驳回/超时)折入底部「已处理」折叠区，避免主区越来越长。
      const apPending = ap.filter((a) => ownerApprovalMeta(a).st === 'pending');
      const apDone = ap.filter((a) => ownerApprovalMeta(a).st !== 'pending' && ownerApprovalMeta(a).st !== 'deleted');
      const rqPending = rq.filter((a) => ownerApprovalMeta(a).st === 'pending');
      const rqDone = rq.filter((a) => ownerApprovalMeta(a).st !== 'pending' && ownerApprovalMeta(a).st !== 'deleted');
      const doneCount = apDone.length + rqDone.length;

      let h = '<div class="section"><div class="section-header">' +
        '<h2 class="section-title">待审批 · 层级子域</h2>' +
        '<span style="font-size:13px;color:var(--text-muted)">' + apPending.length + ' 待我处理 · ' + rqPending.length + ' 我发起的' +
        (doneCount > 0 ? ' · ' + doneCount + ' 已处理' : '') + '</span></div>';

      if (apPending.length === 0 && rqPending.length === 0 && doneCount === 0) {
        h += '<div class="card"><p style="color:var(--text-muted);margin:0">暂无审批请求。申请更深一层的子域名时，若其上级已被他人拥有，该申请会出现在这里等待其所有者同意；若您是所有者，他人申请您名下子域的请求也会在此处理。</p></div>';
        h += '</div>';
        return h;
      }

      const apList = paginateItems(apPending, { page: state.apprPager.apPage, perPage: state.apprPager.apPer });
      const rqList = paginateItems(rqPending, { page: state.apprPager.rqPage, perPage: state.apprPager.rqPer });

      if (apPending.length > 0) {
        h += '<div class="card" style="margin-bottom:12px">' +
          '<div class="record-form-title" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + icons.shield + ' 待我审批·上层所有权请求</div>';
        apList.items.forEach((a) => {
          const m = ownerApprovalMeta(a);
          const dl = a.deadline_at ? new Date(a.deadline_at).toLocaleString('zh-CN') : '';
          h += '<div class="subdomain-card" style="border-bottom:1px solid var(--border);padding:10px 0">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(a.target_fqdn) + ' ' + m.badge + '</h4>' +
            '<p style="margin:2px 0">申请人 ' + escapeHtml(a.applicant_github_name || ('用户#' + a.applicant_user_id)) +
            ' · 申请位于 <b>' + escapeHtml(a.base_fqdn) + '</b> 之下</p>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:0">截止 ' + dl + ' · 超时未处理将自动驳回</p>' +
            '</div><div class="subdomain-actions">' +
            '<button class="btn btn-primary btn-sm btn-jelly" onclick="decideOwnerApproval(' + a.id + ',\\'approve\\')">同意</button>' +
            '<button class="btn btn-danger btn-sm" onclick="decideOwnerApproval(' + a.id + ',\\'reject\\')">驳回</button>' +
            '</div></div>';
        });
        if (apList.pages > 1) h += apprPagerControl(apList, apPending.length, 'ap');
        h += '</div>';
      }

      if (rqPending.length > 0) {
        h += '<div class="card">' +
          '<div class="record-form-title" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + icons.pending + ' 我发起的审批申请</div>';
        rqList.items.forEach((a) => {
          const m = ownerApprovalMeta(a);
          const dlTxt = '截止 ' + (a.deadline_at ? new Date(a.deadline_at).toLocaleString('zh-CN') : '');
          h += '<div class="subdomain-card" style="border-bottom:1px solid var(--border);padding:10px 0">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(a.target_fqdn) + ' ' + m.badge + '</h4>' +
            '<p style="margin:2px 0">位于 <b>' + escapeHtml(a.base_fqdn) + '</b> 之下 · 需上位所有者同意后开通</p>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:0">' + dlTxt + '</p>' +
            '</div><div class="subdomain-actions"></div></div>';
        });
        if (rqList.pages > 1) h += apprPagerControl(rqList, rqPending.length, 'rq');
        h += '</div>';
      }

      if (doneCount > 0) {
        h += '<details style="margin-top:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card)">' +
          '<summary style="cursor:pointer;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;color:var(--text-secondary);font-size:13px">' +
          '<span>已处理 · 共 ' + doneCount + ' 条（同意 / 驳回 / 已超时）</span><span style="color:var(--text-muted)">点此展开查看</span></summary>' +
          '<div style="padding:4px 16px 12px">';
        const doneAll = apDone.concat(rqDone);
        const doneList = paginateItems(doneAll, { page: state.apprPager.donePage, perPage: state.apprPager.donePer });
        doneList.items.forEach((a) => {
          const m = ownerApprovalMeta(a);
          let role = '';
          if (apDone.indexOf(a) >= 0) role = '待我审批 · 我是所有者';
          else role = '我发起的申请';
          const when = a.decided_at
            ? new Date(a.decided_at).toLocaleString('zh-CN')
            : (m.st === 'expired' ? '超时自动驳回' : '');
          h += '<div class="subdomain-card" style="border-bottom:1px solid var(--border);padding:8px 0">' +
            '<div class="subdomain-info">' +
            '<h4 style="font-size:15px">' + escapeHtml(a.target_fqdn) + ' ' + m.badge + '</h4>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:0">' + role + (when ? ' · ' + when : '') + '</p>' +
            '</div><div class="subdomain-actions"></div></div>';
        });
        if (doneList.pages > 1) h += apprPagerControl(doneList, doneAll.length, 'done');
        h += '</div></details>';
      }

      h += '</div>';
      return h;
    }
    function renderDashboard() {
      const subs = state.subdomains;
      const activeSubs = subs.filter(s => s.status !== 'rejected');
      const sp = paginateItems(subs, state.subPager);
      const canCreate = activeSubs.length < state.config.max_subdomains;

      let h = '<div class="dashboard fade-in">';

      // 邮箱验证提示
      if (state.showVerifyBanner) {
        h += '<div class="verify-banner bounce-in">' +
          '<div class="verify-banner-row">' +
          (state.user.email
            ? '<p>📧 请验证您的邮箱 <b>' + escapeHtml(state.user.email) + '</b> 以使用全部功能</p>' +
              '<button class="btn btn-sm" onclick="sendVerificationEmail()">发送验证邮件</button>'
            : '<p>📧 您还没有绑定邮箱，请先绑定邮箱后即可申请子域名</p>' +
              '<div class="verify-binder">' +
              '<input type="email" class="form-input" id="bind-email" placeholder="name@' + ((state.allowedEmailDomains && state.allowedEmailDomains[0]) || 'example.com').replace(/\\*/g, '') + '" onkeydown="if(event.key===\\Enter\\'){bindEmail();}" />' +
              '<button class="btn btn-primary btn-sm btn-jelly" onclick="bindEmail()">绑定并发送验证邮件</button>' +
              '</div>') +
          '</div>' +
          '</div>';
      }

      if (canCreate) {
        h += '<div class="section">' +
          '<div class="section-header"><h2 class="section-title">申请子域名</h2></div>' +
          '<div class="card">' +
          '<div class="form-inline">' +
          '<div class="form-group" style="flex:2">' +
          '<label class="form-label">子域名</label>' +
          '<div class="subdomain-input-group">' +
          '<input type="text" class="form-input" id="new-subdomain" placeholder="your-name" />' +
          '<select class="form-select domain-suffix" id="new-domain" style="width:auto;border-radius:0 var(--radius-sm) var(--radius-sm) 0;border-left:none;">' +
          state.domains.map(d => '<option value="' + d + '">.' + d + '</option>').join('') +
          '</select></div></div>' +
          '<button class="btn btn-primary btn-jelly" onclick="registerSubdomain()" style="margin-bottom:0;align-self:flex-end;">提交申请</button>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--text-muted);margin-top:10px;">仅限小写字母、数字和连字符，长度 ≥ 2 · 提交后需管理员审核</p>' +
          '</div></div>';
      }

      h += '<div class="section"><div class="section-header">' +
        '<h2 class="section-title">我的子域名</h2>' +
        '<span style="font-size:13px;color:var(--text-muted)">' + activeSubs.length + ' / ' + state.config.max_subdomains + '</span></div>';

      if (subs.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.mailbox + '</div><p>还没有子域名，快去申请一个吧</p></div>';
      } else {
        sp.items.forEach(sub => {
          const fqdn = sub.subdomain + '.' + sub.domain;
          h += '<div class="card card-hover subdomain-card">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(fqdn) + ' ' + statusBadge(sub.status) + '</h4>' +
            '<p>创建于 ' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</p>';

          if (sub.status === 'pending') {
            h += '<div class="status-note pending" style="display:flex;align-items:center;gap:6px">' + icons.pending + '正在等待管理员审核，审核通过后即可管理 DNS 记录</div>';
          } else if (sub.status === 'rejected') {
            h += '<div class="status-note rejected" style="display:flex;align-items:center;gap:6px">' + icons.rejected + '拒绝原因: ' + escapeHtml(sub.reject_reason || '未提供') + '</div>';
          }

          h += '</div><div class="subdomain-actions">';

          if (sub.status === 'approved') {
            h += '<button class="btn btn-primary btn-sm btn-jelly" onclick="openDnsManager(' + sub.id + ')">管理 DNS</button>';
          }

          h += '<button class="btn btn-danger btn-sm" onclick="deleteSubdomainConfirm(' + sub.id + ',\\'' + escapeHtml(fqdn) + '\\')">删除</button>' +
            '</div></div>';
        });
      }

      if (subs.length > 0) h += pagerControl(state.subPager, subs.length, 'subPage', 'setSubPer');

      h += renderApprovalsPanel();

      h += '</div></div>';
      return h;
    }

    // 前端面板的「同意/驳回」操作（仅审批人本人可操作，后端校验）
    function decideOwnerApproval(id, action) {
      const label = action === 'approve' ? '同意' : '驳回';
      showModal('上级所有权审批', '确定要' + label + '该层级子域名申请吗？', async () => {
        try {
          const res = await api('/owner-approvals/' + id + '/' + action, { method: 'POST' });
          toast(res.message || (action === 'approve' ? '已同意并开通' : '已驳回'), 'success');
          await loadOwnerApprovals();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    async function registerSubdomain() {
      const subdomain = document.getElementById('new-subdomain').value.trim().toLowerCase();
      const domain = document.getElementById('new-domain').value;
      if (!subdomain) { toast('请输入子域名', 'error'); return; }
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(subdomain)) { toast('子域名格式无效', 'error'); return; }
      if (subdomain.length < 2) { toast('子域名至少 2 个字符', 'error'); return; }
      if (state.config.banned_prefixes && state.config.banned_prefixes.includes(subdomain)) { toast('该子域名前缀已被禁止', 'error'); return; }

      try {
        const res = await api('/subdomains', { method: 'POST', body: JSON.stringify({ subdomain, domain }) });
        toast(res.message || '申请已提交，等待审核', 'success');
        await loadDashboardData();
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteSubdomainConfirm(id, fqdn) {
      showModal('删除子域名', '确定要删除 ' + fqdn + ' 吗？所有关联的 DNS 记录也将被删除。', async () => {
        try {
          await api('/subdomains/' + id, { method: 'DELETE' });
          toast('子域名已删除', 'success');
          await loadDashboardData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== DNS Manager ====================
    async function openDnsManager(subId) {
      state.currentSubdomain = subId;
      state.currentView = 'dns';
      state.editingRecord = null;
      await loadRecords(subId);
      render();
    }

    async function loadRecords(subId) {
      try {
        const data = await api('/subdomains/' + subId + '/records');
        state.records = data.records;
        state.currentSubdomainFqdn = data.subdomain;
        state.currentRecordCount = data.current_count;
        state.maxRecords = data.max_records;
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderDnsManager() {
      const fqdn = state.currentSubdomainFqdn || '';
      const records = state.records || [];
      const types = state.config.allowed_record_types || ['A','AAAA','CNAME','MX','TXT','SRV','CAA'];
      const editing = state.editingRecord;
      const list = records.filter(r => !state.dnsTypeFilter || r.record_type === state.dnsTypeFilter);
      const dp = paginateItems(list, state.dnsPager);

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">← 返回子域名列表</a>' +
        '<div class="dns-header"><h2>' + escapeHtml(fqdn) + ' - DNS 管理</h2></div>' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">记录: ' + (state.currentRecordCount||0) + ' / ' + (state.maxRecords||20) +
        ' · 名称 @ 或留空 = ' + escapeHtml(fqdn) + '，填 "www" = www.' + escapeHtml(fqdn) + '</p>';

      // Add/edit form
      h += '<div class="record-form">' +
        '<div class="record-form-title" style="display:flex;align-items:center;gap:6px">' + (editing ? icons.edit + '编辑记录' : icons.plus + '添加记录') + '</div>' +
        '<div class="form-row-3">' +
        '<div class="form-group"><label class="form-label">类型</label>' +
        '<select class="form-select" id="rec-type" onchange="onTypeChange()">' +
        types.map(t => '<option value="'+t+'"'+(editing&&editing.record_type===t?' selected':'')+'>'+t+'</option>').join('') +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">名称</label>' +
        '<input class="form-input" id="rec-name" placeholder="@ 或子名称" value="'+(editing?escapeHtml(editing.name):'')+'" /></div>' +
        '<div class="form-group"><label class="form-label">内容</label>' +
        '<input class="form-input" id="rec-content" placeholder="记录值" value="'+(editing?escapeHtml(editing.content):'')+'" /></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">TTL</label>' +
        '<select class="form-select" id="rec-ttl">' +
        '<option value="1"'+(editing&&editing.ttl===1?' selected':'')+'>自动</option>' +
        '<option value="60"'+(editing&&editing.ttl===60?' selected':'')+'>1 分钟</option>' +
        '<option value="300"'+(editing&&editing.ttl===300?' selected':'')+'>5 分钟</option>' +
        '<option value="3600"'+(editing&&editing.ttl===3600?' selected':'')+'>1 小时</option>' +
        '<option value="86400"'+(editing&&editing.ttl===86400?' selected':'')+'>1 天</option>' +
        '</select></div>' +
        '<div class="form-group" id="priority-group" style="display:none"><label class="form-label">优先级</label>' +
        '<input class="form-input" type="number" id="rec-priority" placeholder="10" value="'+(editing&&editing.priority!==null?editing.priority:'10')+'" /></div></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">' +
        '<label class="checkbox-label"><input type="checkbox" id="rec-proxied"'+(editing&&editing.proxied?' checked':'')+'> Cloudflare 代理 (A/AAAA/CNAME)</label>' +
        '<div style="display:flex;gap:8px">' +
        (editing?'<button class="btn btn-secondary btn-sm" onclick="cancelEdit()">取消</button>':'') +
        '<button class="btn btn-primary btn-sm btn-jelly" onclick="'+(editing?'updateRecord()':'addRecord()')+'">'+(editing?'更新':'添加')+'</button>' +
        '</div></div></div>';

      if (records.length > 0) {
        // 类型筛选工具栏（DNS 记录按类型筛选）
        h += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">' +
          '<label style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px">类型筛选 ' +
          '<select class="form-select" style="width:auto;padding:4px 26px 4px 10px;font-size:12px" onchange="setDnsType(this.value)">' +
          '<option value=""'+(!state.dnsTypeFilter?' selected':'')+'>全部</option>' +
          types.map(function (t2) { return '<option value="'+t2+'"'+(state.dnsTypeFilter===t2?' selected':'')+'>'+t2+'</option>'; }).join('') +
          '</select></label>' +
          '<span style="font-size:13px;color:var(--text-muted)">当前 ' + list.length + ' / ' + records.length + ' 条</span></div>';
        h += '<div class="card"><div class="table-wrap"><table>' +
          '<thead><tr><th>类型</th><th>名称</th><th>内容</th><th>TTL</th><th>代理</th><th>开关</th><th>操作</th></tr></thead><tbody>';
        if (dp.items.length === 0) {
          h += '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:18px">该类型下暂无 DNS 记录</td></tr>';
        } else {
          dp.items.forEach(r => {
          const ttl = r.ttl===1?'自动':(r.ttl>=3600?(r.ttl/3600)+'h':(r.ttl>=60?(r.ttl/60)+'m':r.ttl+'s'));
          h += '<tr><td><span class="badge badge-type">'+escapeHtml(r.record_type)+'</span></td>' +
            '<td class="mono">'+escapeHtml(r.name)+'</td>' +
            '<td class="mono" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escapeHtml(r.content)+'">'+escapeHtml(r.content)+'</td>' +
            '<td>'+ttl+'</td>' +
            '<td>'+(r.proxied
              ?'<span class="proxy-indicator proxied">' + icons.cloud + ' 已代理</span>'
              :'<span class="proxy-indicator direct">直接</span>')+'</td>' +
            '<td><div class="proxied-toggle ' + (r.proxied ? 'active' : '') + '" onclick="toggleProxied(\\'' + state.currentSubdomain + '\\',\\'' + r.id + '\\', ' + r.proxied + ')" title="切换代理状态"></div></td>' +
            '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="editRecord(\''+r.id+'\')" title="编辑" style="display:flex">' + icons.edit + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="deleteRecordConfirm(\\''+r.id+'\\',\\''+escapeHtml(r.name)+'\\',\\''+escapeHtml(r.record_type)+'\\')" title="删除" style="display:flex">' + icons.trash + '</button>' +
            '</div></td></tr>';
        });
        }
        h += '</tbody></table></div></div>' + pagerControl(state.dnsPager, list.length, 'dnsPage', 'setDnsPer');
      } else {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>还没有 DNS 记录</p></div>';
      }
      h += '</div>';
      return h;
    }

    function onTypeChange() {
      const t = document.getElementById('rec-type').value;
      document.getElementById('priority-group').style.display = (t==='MX'||t==='SRV')?'block':'none';
    }

    async function addRecord() {
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('请填写记录内容', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records', { method:'POST', body:JSON.stringify(body) });
        toast('DNS 记录已添加', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function editRecord(id) {
      const r = state.records.find(r => String(r.id)===String(id));
      if (!r) return;
      state.editingRecord = r;
      render();
      setTimeout(() => onTypeChange(), 0);
    }

    function cancelEdit() { state.editingRecord = null; render(); }

    async function updateRecord() {
      const editing = state.editingRecord; if (!editing) return;
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('请填写记录内容', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records/'+editing.id, { method:'PUT', body:JSON.stringify(body) });
        toast('已更新', 'success');
        state.editingRecord = null;
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteRecordConfirm(id, name, type) {
      showModal('删除 DNS 记录', '确定删除 '+type+' 记录 "'+name+'" 吗？', async () => {
        try {
          await api('/subdomains/'+state.currentSubdomain+'/records/'+id, { method:'DELETE' });
          toast('已删除', 'success');
          await loadRecords(state.currentSubdomain);
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Proxied Toggle ====================
    async function toggleProxied(subdomainId, recordId, currentProxied) {
      try {
        const res = await api('/proxied/records/' + subdomainId + '/' + recordId + '/proxied', {
          method: 'PUT',
          body: JSON.stringify({ proxied: !currentProxied }),
        });
        toast(res.message || '代理状态已切换', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Admin Panel ====================
    async function loadAdminData() {
      try {
        const [pendingData, allData, userData, annData] = await Promise.all([
          api('/admin/pending'),
          api('/admin/subdomains'),
          api('/admin/users'),
          annApi('/admin'),
        ]);
        state.adminPending = pendingData.subdomains;
        state.adminAll = allData.subdomains;
        state.adminUsers = userData.users;
        state.adminAnnouncements = annData.announcements || [];
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAdminPanel() {
      const pendingCount = state.adminPending.length;

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">← 返回面板</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.admin + ' 管理员面板</h2></div>';

      // Tabs
      h += '<div class="tabs">' +
        '<button class="tab'+(state.adminTab==='pending'?' active':'')+'" onclick="switchAdminTab(\\'pending\\')">待审核' +
        (pendingCount > 0 ? '<span class="tab-count">'+pendingCount+'</span>' : '') + '</button>' +
        '<button class="tab'+(state.adminTab==='all'?' active':'')+'" onclick="switchAdminTab(\\'all\\')">所有子域名</button>' +
        '<button class="tab'+(state.adminTab==='users'?' active':'')+'" onclick="switchAdminTab(\\'users\\')">用户管理</button>' +
        '<button class="tab'+(state.adminTab==='announcements'?' active':'')+'" onclick="switchAdminTab(\\'announcements\\')">公告管理</button>' +
        '<button class="tab'+(state.adminTab==='accounts'?' active':'')+'" onclick="switchAdminTab(\\'accounts\\')">' + icons.key + ' Cloudflare 账户</button>' +
        '</div>';

      if (state.adminTab === 'pending') {
        h += renderAdminPending();
      } else if (state.adminTab === 'all') {
        h += renderAdminAll();
      } else if (state.adminTab === 'announcements') {
        h += renderAdminAnnouncements();
      } else if (state.adminTab === 'accounts') {
        h += renderAccountsContent();
      } else {
        h += renderAdminUsers();
      }

      h += '</div>';
      return h;
    }

    function renderAdminPending() {
      const items = state.adminPending;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>暂无待审核的申请</p></div>';
      }

      let h = '';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<div class="card card-hover review-card" style="margin-bottom:10px;padding:20px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
          '<div>' +
          '<h4 style="font-family:var(--font-mono);font-size:16px;font-weight:600">' + escapeHtml(fqdn) + '</h4>' +
          '<div class="review-meta">' +
          '<span style="display:flex;align-items:center">' + icons.user + ' ' + escapeHtml(sub.github_username) + '</span>' +
          '<span style="display:flex;align-items:center">' + icons.calendar + ' ' + new Date(sub.created_at).toLocaleString('zh-CN') + '</span>' +
          (sub.email ? '<span style="display:flex;align-items:center">' + icons.email + ' ' + escapeHtml(sub.email) + '</span>' : '') +
          '</div></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success btn-sm btn-jelly" onclick="approveSubdomain('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">' + icons.approved + ' 通过</button>' +
          '<button class="btn btn-danger btn-sm" onclick="rejectSubdomainModal('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">' + icons.rejected + ' 拒绝</button>' +
          '</div></div></div>';
      });
      return h;
    }

    function renderAdminAll() {
      const items = state.adminAll;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>暂无子域名记录</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>子域名</th><th>用户</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<tr><td class="mono">' + escapeHtml(fqdn) + '</td>' +
          '<td>' + escapeHtml(sub.github_username) + '</td>' +
          '<td>' + statusBadge(sub.status) + '</td>' +
          '<td>' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td><button class="btn btn-danger btn-sm" onclick="adminDeleteSubdomain('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">删除</button></td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function renderAdminUsers() {
      const users = state.adminUsers;
      if (users.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.users + '</div><p>暂无用户</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>头像</th><th>用户名</th><th>邮箱</th><th>身份</th><th>注册时间</th></tr></thead><tbody>';
      users.forEach(u => {
        h += '<tr><td><img src="'+(u.avatar_url||'')+'" style="width:28px;height:28px;border-radius:50%"></td>' +
          '<td>'+escapeHtml(u.github_username)+'</td>' +
          '<td class="mono">'+(u.email? escapeHtml(u.email):'—')+'</td>' +
          '<td>'+(u.is_admin?'<span class="badge badge-approved">管理员</span>':'用户')+'</td>' +
          '<td>'+new Date(u.created_at).toLocaleDateString('zh-CN')+'</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    // ==================== 公告管理 ====================
    function renderAdminAnnouncements() {
      const items = state.adminAnnouncements;

      // 新增/编辑表单（临时用 DOM 输入，编辑时复用）
      let h = '<div class="section" style="margin-bottom:16px">' +
        '<div class="card">' +
        '<div class="card-title">📢 发布 / 编辑公告</div>' +
        '<div class="form-group"><label class="form-label">公告标题</label>' +
        '<input type="text" class="form-input" id="ann-title" placeholder="输入标题…" value="' + (escapeHtml(state.editingAnnouncement?.title || '')) + '" /></div>' +
        '<div class="form-group"><label class="form-label">公告内容</label>' +
        '<textarea class="form-input" id="ann-content" rows="4" placeholder="输入公告内容…" style="min-height:100px">' + (escapeHtml(state.editingAnnouncement?.content || '')) + '</textarea></div>' +
        '<div class="form-group" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
        '<label class="form-label" style="margin:0">排序号</label>' +
        '<input type="number" min="0" class="form-input" id="ann-sort" value="' + (state.editingAnnouncement?.sort_order ?? '') + '" placeholder="0" style="width:100px" />' +
        '<label class="form-label" style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="ann-pinned" ' + (state.editingAnnouncement?.is_pinned ? 'checked' : '') + ' /> 置顶（轮播显示全文）</label>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:4px">' +
        '<button class="btn btn-primary btn-jelly" onclick="saveAnnouncement()">' + (state.editingAnnouncement ? '保存修改' : '发布公告') + '</button>' +
        (state.editingAnnouncement ? '<button class="btn btn-ghost" onclick="cancelEditAnnouncement()">取消编辑</button>' : '') +
        '</div>' +
        '</div></div>';

      if (items.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>暂无公告</p></div>';
        return h;
      }

      h += '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>标题</th><th>排序</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
      items.forEach(a => {
        h += '<tr><td><strong>' + escapeHtml(a.title) + (a.is_pinned ? '<span class="pin-badge">置顶</span>' : '') + '</strong><div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(a.content) + '</div></td>' +
          '<td>' + (a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 0) + '</td>' +
          '<td>' + (a.is_active ? '<span class="badge badge-approved">显示中</span>' : '<span class="badge">已隐藏</span>') + '</td>' +
          '<td>' + new Date(a.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td style="display:flex;gap:6px">' +
          '<button class="btn btn-sm ' + (a.is_pinned ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncementPin(' + a.id + ')">' + (a.is_pinned ? '取消置顶' : '置顶') + '</button>' +
          '<button class="btn btn-sm btn-primary btn-jelly" onclick="startEditAnnouncement(' + a.id + ')">编辑</button>' +
          '<button class="btn btn-sm ' + (a.is_active ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncement(' + a.id + ')">' + (a.is_active ? '隐藏' : '显示') + '</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(' + a.id + ',\\'' + escapeHtml(a.title) + '\\')">删除</button>' +
          '</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function startEditAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (a) { state.editingAnnouncement = a; }
      render();
    }

    function cancelEditAnnouncement() {
      state.editingAnnouncement = null;
      render();
    }

    async function saveAnnouncement() {
      const title = document.getElementById('ann-title')?.value?.trim();
      const content = document.getElementById('ann-content')?.value?.trim();
      if (!title) { toast('请输入公告标题', 'error'); return; }
      if (!content) { toast('请输入公告内容', 'error'); return; }

      // 排序号与置顶
      const sortRaw = document.getElementById('ann-sort')?.value;
      const sortOrder = sortRaw !== undefined && sortRaw !== '' ? parseInt(sortRaw, 10) : NaN;
      const pinned = !!document.getElementById('ann-pinned')?.checked;
      const payload = {
        title, content,
        is_pinned: pinned,
        sort_order: Number.isNaN(sortOrder) ? undefined : sortOrder
      };

      try {
        const editing = state.editingAnnouncement;
        if (editing) {
          const r = await annApi('/admin/' + editing.id, { method: 'PUT', body: JSON.stringify(payload) });
          toast('公告已更新', 'success');
          if (r && r.announcement) {
            for (let i = 0; i < state.adminAnnouncements.length; i++) {
              if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
            }
          }
        } else {
          const r = await annApi('/admin', { method: 'POST', body: JSON.stringify(payload) });
          toast('公告已发布', 'success');
          if (r && r.announcement) { state.adminAnnouncements.push(r.announcement); }
        }
        state.editingAnnouncement = null;
        sortAnnouncements();
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncementPin(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_pinned: !a.is_pinned }) });
        toast(a.is_pinned ? '已取消置顶' : '已置顶（轮播显示全文）', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_active: !a.is_active }) });
        toast(a.is_active ? '公告已隐藏' : '公告已显示', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAnnouncement(id, title) {
      showModal('删除公告', '确定删除公告「' + title + '」吗？', async () => {
        try {
          await annApi('/admin/' + id, { method: 'DELETE' });
          toast('公告已删除', 'success');
          state.adminAnnouncements = state.adminAnnouncements.filter(function (x) { return x.id !== id; });
          sortAnnouncements();
          rerender();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    async function switchAdminTab(tab) {
      state.adminTab = tab;
      if (tab === 'accounts') {
        try { await loadAccounts(); } catch (e) { console.error('Failed to load accounts:', e); }
      }
      render();
    }

    async function approveSubdomain(id, fqdn) {
      showModal('审核通过', '确定通过 ' + fqdn + ' 的申请吗？通过后用户即可管理 DNS 记录。', async () => {
        try {
          await api('/admin/subdomains/'+id+'/approve', { method:'POST', body:'{}' });
          toast('已通过审核', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmText: '通过', confirmClass: 'btn-success btn-jelly' });
    }

    function rejectSubdomainModal(id, fqdn) {
      showModal(
        '拒绝申请',
        '请填写拒绝 ' + fqdn + ' 的原因：',
        async () => {
          const reason = document.getElementById('reject-reason')?.value?.trim();
          if (!reason) { toast('请填写拒绝原因', 'error'); return; }
          try {
            await api('/admin/subdomains/'+id+'/reject', {
              method: 'POST',
              body: JSON.stringify({ reason }),
            });
            toast('已拒绝', 'success');
            await loadAdminData();
            render();
          } catch (err) { toast(err.message, 'error'); }
        },
        {
          bodyHtml: '<textarea class="form-input" id="reject-reason" placeholder="请输入拒绝原因..." style="resize:vertical;min-height:80px;margin-bottom:12px"></textarea>',
          confirmText: '拒绝',
          confirmClass: 'btn-danger btn-jelly',
        }
      );
    }

    async function adminDeleteSubdomain(id, fqdn) {
      showModal('管理员删除', '确定删除 ' + fqdn + ' 吗？此操作不可恢复。', async () => {
        try {
          await api('/admin/subdomains/'+id, { method:'DELETE' });
          toast('已删除', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Email Verification ====================
    async function bindEmail() {
      const input = document.getElementById('bind-email');
      const email = input?.value?.trim().toLowerCase();
      if (!email) { toast('请输入邮箱地址', 'error'); return; }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) { toast('邮箱格式不正确', 'error'); return; }
      try {
        const res = await api('/verification/bind', { method: 'POST', body: JSON.stringify({ email }) });
        state.user.email = email;
        state.user.email_verified = false;
        state.showVerifyBanner = true;
        toast(res.message || '邮箱已绑定，验证邮件已发送', 'success');
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function sendVerificationEmail() {
      try {
        await api('/verification/send', { method: 'POST' });
        toast('验证邮件已发送，请查收', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Cloudflare Accounts ====================
    async function loadAccounts() {
      try {
        const data = await api('/accounts');
        state.accounts = data.accounts || [];
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    }

    async function createAccount() {
      const name = document.getElementById('account-name')?.value?.trim();
      const token = document.getElementById('account-token')?.value?.trim();
      const zoneId = document.getElementById('account-zone')?.value?.trim();

      if (!name || !token) {
        toast('请填写账户名称和 API Token', 'error');
        return;
      }

      try {
        const res = await api('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            account_name: name,
            api_token: token,
            zone_id: zoneId || undefined,
          }),
        });
        toast('账户添加成功', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAccounts() {
      if (state.accounts.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.key + '</div><p>还没有添加 Cloudflare 账户</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>账户名称</th><th>状态</th><th>默认</th><th>操作</th></tr></thead><tbody>';

      state.accounts.forEach(acc => {
        h += '<tr>' +
          '<td><strong>' + escapeHtml(acc.account_name) + '</strong></td>' +
          '<td>' + (acc.is_active ? '<span class="badge badge-approved">活跃</span>' : '<span class="badge badge-rejected">停用</span>') + '</td>' +
          '<td>' + (acc.is_default ? '⭐ 默认' : '—') + '</td>' +
          '<td><div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountDefault(' + acc.id + ')" title="设为默认">⭐</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountActive(' + acc.id + ')" title="启用/停用">' + (acc.is_active ? '👁' : '👁‍🗨') + '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteAccount(' + acc.id + ')" title="删除">' + icons.trash + '</button>' +
          '</div></td></tr>';
      });

      h += '</tbody></table></div></div>';
      return h;
    }

    async function toggleAccountDefault(id) {
      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_default: true }),
        });
        toast('已设为默认账户', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAccountActive(id) {
      const account = state.accounts.find(a => a.id === id);
      if (!account) return;

      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !account.is_active }),
        });
        toast('账户状态已更新', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAccount(id) {
      showModal('删除账户', '确定删除此 Cloudflare 账户吗？', async () => {
        try {
          await api('/accounts/' + id, { method: 'DELETE' });
          toast('账户已删除', 'success');
          await loadAccounts();
          renderAccounts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Main Render ====================
    function render() {
      const app = document.getElementById('app');
      if (!state.user) { app.innerHTML = renderLanding(); return; }

      switch (state.currentView) {
        case 'dns':
          app.innerHTML = renderDnsManager();
          setTimeout(() => onTypeChange(), 0);
          break;
        case 'admin':
          app.innerHTML = renderAdminPanel();
          break;
        case 'accounts':
          app.innerHTML = renderAccountsPage();
          break;
        case 'dashboard':
        default:
          app.innerHTML = renderDashboard();
          break;
      }
    }

    // 保持滚动位置地重绘当前视图：保存后刷新不回到顶部、不重登主页
    function rerender() {
      const y = window.scrollY || 0;
      render();
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    }

    // 与后端一致：启用 → 置顶 → 排序号 → id 排序公告（管理列表展示顺序）
    function sortAnnouncements() {
      const arr = state.adminAnnouncements || [];
      arr.sort(function (a, b) {
        const ak = (a.is_active ? 0 : 1), bk = (b.is_active ? 0 : 1);
        if (ak !== bk) return ak - bk;
        const ap = (a.is_pinned ? 0 : 1), bp = (b.is_pinned ? 0 : 1);
        if (ap !== bp) return ap - bp;
        const aso = (a.sort_order || 0), bso = (b.sort_order || 0);
        if (aso !== bso) return aso - bso;
        return a.id - b.id;
      });
    }

    function renderAccountsPage() {
      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">← 返回面板</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.key + ' Cloudflare 账户管理</h2></div>' +
        renderAccountsContent() + '</div>';
      return h;
    }

    function renderAccountsContent() {
      let h = '<div class="section">' +
        '<div class="card" style="border-left:4px solid var(--accent)">' +
        '<div class="card-title">多账户配置说明</div>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px">本系统支持<strong>多 Cloudflare 账户</strong>：不同域名可绑定不同账户的 Zone。请为每个账户单独创建 API Token，并填写到下方表单。Token 仅用于 DNS 操作，需要 <strong>Zone - Edit</strong> 权限；请勿使用 Global 权限过大的 Token。</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>无需配置环境变量</strong>：账户数据与加密 Token 均存储在 D1 的 <code>cloudflare_accounts</code> 表。环境变量中的 <code>CF_API_TOKEN</code> 仅作为无匹配账户时的后备；优先使用账户列表中的 Token。</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>子域名代理开关</strong>：绑定账户后，审核通过的子域名可在 DNS 管理页切换黄色云朵（代理）。仅管理员审核通过的子域名可开通代理。</p>' +
        '</div>' +
        '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">添加新账户</div>' +
        '<div class="form-group">' +
        '<label class="form-label">账户名称</label>' +
        '<input type="text" class="form-input" id="account-name" placeholder="例如: 主账户、备用账户" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">API Token</label>' +
        '<input type="password" class="form-input" id="account-token" placeholder="输入 Cloudflare API Token" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">Zone ID（可选）</label>' +
        '<input type="text" class="form-input" id="account-zone" placeholder="留空自动从域名配置获取" /></div>' +
        '<button class="btn btn-primary btn-jelly" onclick="createAccount()">添加账户</button>' +
        '</div></div>' +
        '<div class="section"><h3 class="section-title" style="font-size:18px;margin-bottom:16px">我的账户</h3>' +
        renderAccounts() + '</div>';
      return h;
    }

    // ==================== Announcements (公告：置顶全文 + 轮播缩略可展开) ====================
    // 展示规则：is_pinned=1 的公告直出完整内容（带「置顶」徽标）；
    // 其余公告进入轮播区，默认按字数缩略（3 行截断），可点击「展开全文/收起」阅读完整内容。
    async function loadAnnouncements() {
      const container = document.getElementById('announcements');
      if (!container) return;
      try {
        const data = await annApi('');
        const list = data.announcements || [];
        if (!list.length) { container.innerHTML = ''; return; }
        const pinned = list.filter(a => a.is_pinned);
        const normal = list.filter(a => !a.is_pinned);
        let h = '';
        // 置顶：完整内容直出
        pinned.forEach(function (a) {
          const date = (a.created_at || '').slice(0, 10);
          h += '<div class="announcement-card pinned fade-in">' +
            '<div class="announcement-title">📢 ' + escapeHtml(a.title) +
            '<span class="pin-badge">置顶</span><span class="announcement-date">' + date + '</span></div>' +
            '<div class="announcement-content">' + escapeHtml(a.content) + '</div></div>';
        });
        // 普通：进轮播，每张缩略可展开
        if (normal.length) {
          h += '<div class="announcement-carousel">';
          normal.forEach(function (a, i) {
            const date = (a.created_at || '').slice(0, 10);
            h += '<div class="carousel-slide' + (i === 0 ? ' active' : '') + '" id="ann-slide-' + i + '">' +
              '<div class="announcement-card fade-in">' +
              '<div class="announcement-title">📢 ' + escapeHtml(a.title) + '<span class="announcement-date">' + date + '</span></div>' +
              '<div class="announcement-content collapsed" id="ann-body-' + i + '">' + escapeHtml(a.content) + '</div>' +
              '<button type="button" class="announcement-toggle-btn" onclick="toggleAnnouncementBody(' + i + ', this)">展开全文</button>' +
              '</div></div>';
          });
          h += '<div class="carousel-dots">';
          normal.forEach(function (_, i) {
            h += '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="goAnnouncementSlide(' + i + ')"></span>';
          });
          h += '</div></div>';
        }
        container.innerHTML = h;
        // 启动轮播定时切换
        if (normal.length > 1) {
          window.clearInterval(window.__annTimer);
          let idx = 0;
          window.__annTimer = window.setInterval(function () {
            idx = (idx + 1) % normal.length;
            goAnnouncementSlide(idx);
          }, 5000);
        }
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    }

    // 展开/收起某条轮播公告的全文
    function toggleAnnouncementBody(i, btn) {
      const el = document.getElementById('ann-body-' + i);
      if (!el) return;
      el.classList.toggle('collapsed');
      btn.textContent = el.classList.contains('collapsed') ? '展开全文' : '收起';
    }

    // 轮播切到第 i 张
    function goAnnouncementSlide(i) {
      const slides = document.querySelectorAll('#announcements .carousel-slide');
      const dots = document.querySelectorAll('#announcements .carousel-dot');
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
    }

    // ==================== Init ====================
    async function init() {
      // 所有数据加载均单独兜底，一旦某接口失败不能让整段 init 中断，
      // 否则 render() 不执行，页面会一直停在加载转圈（顶/底由服务端渲染、不受影响，正是 “中间转圈” 的现象）。
      try {
        setTheme(getTheme());
        renderHeaderUser();
        try { loadAnnouncements(); }
        catch (err) { console.error('Failed to load announcements:', err); }

        if (state.user) {
          state.currentView = 'dashboard';
          try { await loadDashboardData(); }
          catch (err) { console.error('Failed to load dashboard data:', err); }

          // 加载邮箱验证配置
          try {
            const config = await api('/verification/config');
            state.emailVerificationRequired = config.required;
            state.allowedEmailDomains = config.allowed_domains || [];

            // 检查是否需要显示验证提示
            if (state.emailVerificationRequired && !state.user.email_verified) {
              state.showVerifyBanner = true;
            }
          } catch (err) {
            console.error('Failed to load verification config:', err);
          }

          // 加载账户列表
          try { await loadAccounts(); }
          catch (err) { console.error('Failed to load accounts:', err); }

          // 加载上级所有权审批（待审批面板）
          try { await loadOwnerApprovals(); }
          catch (err) { console.error('Failed to load owner approvals:', err); }

          if (state.user.is_admin) {
            try { loadAdminData(); }
            catch (err) { console.error('Failed to load admin data:', err); }
          }
        }
      } catch (err) {
        console.error('init error:', err);
      }

      // 无论上面数据是否成功加载，都必须渲染，避免停留在加载转圈
      render();
    }

    init();
  </script>

  <footer class="footer">
    <div class="container">
      ${raw(friendLinks && friendLinks.length > 0 ? `
      <div class="footer-friendlinks">
        <span class="friend-link-label">✨ 友情链接：</span>
        ${friendLinks.map((l) => `<a class="friend-link" href="${l.url}" target="_blank" rel="noopener">${l.name}</a>`).join('')}
      </div>` : '')}
      <p>Powered by Cloudflare Workers &amp; D1 · ${siteName}</p>
      <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">
        感谢 <a href="https://github.com/Little100/cloudflare_subdomain_provisioning" target="_blank" rel="noopener">Little100/cloudflare_subdomain_provisioning</a> 开源项目
      </p>
      ${raw(adminContactEmail ? `
      <p style="margin-top:12px;">
        <a href="mailto:${adminContactEmail}" class="btn btn-primary btn-sm btn-jelly contact-admin-btn" target="_blank">
          ✉️ 联系管理员
        </a>
      </p>` : '')}
      ${raw(beian ? `
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">备案信息：${beian}</p>` : '')}
    </div>
  </footer>
</body>
</html>`;
}

export default pages;
