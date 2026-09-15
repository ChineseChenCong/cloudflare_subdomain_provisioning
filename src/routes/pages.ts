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
  // 外链→本域中转：HTML 只暴露本站 /assets 路径，不泄露外链真实域名，
  // 且访客只接本站、外部源站只接 Worker（保源站安全）。
  const proxyUrl = (u?: string | null) => (u ? `/assets?src=${encodeURIComponent(u)}` : '');
  const bgStyle = backgroundImage
    ? `background-image: url('${proxyUrl(backgroundImage)}'); background-size: cover; background-position: center; background-attachment: fixed;`
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
    ? `<link rel="icon" href="${proxyUrl(siteLogo)}" type="image/png">`
    : `<link rel="icon" href="data:image/svg+xml;base64,${btoa(defaultLogoSvg)}">`)}
  ${raw(`<link rel="shortcut icon" href="/favicon.ico">`)}
  ${raw(`<link rel="apple-touch-icon" href="${proxyUrl(siteLogo) || `data:image/svg+xml;base64,${btoa(defaultLogoSvg)}`}">`)}
  <style>
    :root {
      --font-sans: 'Comic Sans MS', 'YouYuan', '幼圆', 'KaiTi', '楷体', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
      --font-mono: 'Comic Sans MS', 'Consolas', 'Courier New', monospace;
      --radius: 16px;
      --radius-sm: 10px;
      --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ========== 蓝白色系主题 ========== */
    [data-theme="dark"] {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --bg-input: #0f172a;
      --border: #334155;
      --border-hover: #475569;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --accent-bg: rgba(59, 130, 246, 0.15);
      --accent-border: rgba(59, 130, 246, 0.4);
      --danger: #ef4444;
      --danger-hover: #f87171;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --success: #22c55e;
      --success-bg: rgba(34, 197, 94, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --pending-bg: rgba(139, 92, 246, 0.15);
      --pending: #8b5cf6;
      --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.3);
      --glass-bg: rgba(30, 41, 59, 0.8);
      --bg-image: var(--bg-image-dark);
      --overlay-fallback: rgba(15, 23, 42, 0.7);
    }

    [data-theme="light"] {
      --bg-primary: #eff5ff;
      --bg-secondary: #ffffff;
      --bg-tertiary: #e4efff;
      --bg-card: #ffffff;
      --bg-hover: #e4efff;
      --bg-input: #ffffff;
      --border: #d4e4f8;
      --border-hover: #b3cef6;
      --text-primary: #0b2b4f;
      --text-secondary: #3c5e85;
      --text-muted: #7b9dc2;
      --accent: #1d7dfa;
      --accent-hover: #3b82f6;
      --accent-bg: rgba(29, 125, 250, 0.10);
      --accent-border: rgba(29, 125, 250, 0.32);
      --danger: #d64040;
      --danger-hover: #ef4444;
      --danger-bg: rgba(214, 64, 64, 0.08);
      --success: #14914b;
      --success-bg: rgba(20, 145, 75, 0.08);
      --warning: #d97706;
      --warning-bg: rgba(217, 119, 6, 0.08);
      --pending-bg: rgba(124, 58, 237, 0.08);
      --pending: #7c3aed;
      --shadow: 0 8px 26px rgba(29, 78, 138, 0.10);
      --shadow-sm: 0 4px 12px rgba(29, 78, 138, 0.06);
      --glass-bg: rgba(255, 255, 255, 0.80);
      --overlay-fallback: rgba(230, 243, 255, 0.70);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      transition: background var(--transition), color var(--transition);
      position: relative;
    }

    /* 背景图与遮罩 */
    .bg-image-wrapper {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
    }
    .bg-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(2px);
      transform: scale(1.05);
    }
    .bg-overlay {
      position: absolute;
      inset: 0;
      background: ${backgroundOverlay || 'var(--overlay-fallback)'};
    }
    a { color: var(--accent); text-decoration: none; transition: all var(--transition); }
    a:hover { color: var(--accent-hover); }

    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

    /* ========== 可爱玻璃态 Header ========== */
    .header {
      background: var(--glass-bg);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
      transition: all var(--transition);
    }
    .header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { 
      font-size: 20px; 
      font-weight: 700; 
      color: var(--text-primary); 
      display: flex; 
      align-items: center; 
      gap: 10px;
      transition: all var(--transition);
    }
    .logo-icon { 
      width: 36px; 
      height: 36px; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      border-radius: 12px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      font-size: 18px; 
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .logo:hover .logo-icon {
      transform: scale(1.1) rotate(-5deg);
    }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .user-info { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      padding: 8px 14px; 
      background: var(--bg-tertiary); 
      border-radius: var(--radius-sm); 
      border: 1px solid var(--border);
      transition: all var(--transition);
    }
    .user-info:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }
    .user-avatar { 
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      border: 2px solid var(--accent);
      transition: transform 0.3s ease;
    }
    .user-info:hover .user-avatar {
      transform: scale(1.1);
    }
    .user-name { 
      font-size: 14px; 
      font-weight: 500; 
      color: var(--text-primary); 
    }

    /* ========== 果冻按钮样式 ========== */
    .btn { 
      display: inline-flex; 
      align-items: center; 
      justify-content: center; 
      gap: 8px; 
      padding: 12px 24px; 
      border: none; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 600; 
      font-family: var(--font-sans); 
      cursor: pointer; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap; 
      text-decoration: none;
      position: relative;
      overflow: hidden;
    }
    .btn:active {
      transform: scale(0.95);
    }
    .btn:disabled { 
      opacity: 0.5; 
      cursor: not-allowed;
      transform: none !important;
    }
    .btn-primary { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
    .btn-primary:active {
      transform: scale(0.95) translateY(0);
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
    }
    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }
    .btn-success {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
    }
    .btn-success:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
    }
    [data-theme="light"] .btn-primary {
      box-shadow: 0 4px 14px rgba(29, 125, 250, 0.25);
    }
    [data-theme="light"] .btn-primary:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(29, 125, 250, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-secondary {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    [data-theme="light"] .btn-secondary:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(29, 78, 138, 0.10);
      transform: translateY(-2px);
    }
    [data-theme="light"] .btn-danger {
      box-shadow: 0 4px 14px rgba(214, 64, 64, 0.25);
    }
    [data-theme="light"] .btn-danger:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(214, 64, 64, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-success {
      box-shadow: 0 4px 14px rgba(20, 145, 75, 0.25);
    }
    [data-theme="light"] .btn-success:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(20, 145, 75, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-github {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    [data-theme="light"] .btn-github:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      transform: translateY(-3px);
    }
    .btn-ghost { 
      background: transparent; 
      color: var(--text-secondary); 
      border: none; 
      padding: 8px; 
      border-radius: var(--radius-sm);
    }
    .btn-ghost:hover { 
      color: var(--text-primary); 
      background: var(--bg-hover);
      transform: scale(1.1);
    }
    .btn-sm { 
      padding: 8px 16px; 
      font-size: 13px; 
    }
    .btn-github { 
      background: linear-gradient(135deg, #24292e, #373e47); 
      color: white; 
      border: none; 
      padding: 14px 32px; 
      font-size: 16px; 
      border-radius: var(--radius);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .btn-github:hover { 
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .btn-github:active {
      transform: scale(0.95) translateY(0);
    }

    /* 果冻动画 */
    @keyframes jelly {
      0% { transform: scale(1, 1); }
      30% { transform: scale(1.25, 0.75); }
      40% { transform: scale(0.75, 1.25); }
      50% { transform: scale(1.15, 0.85); }
      65% { transform: scale(0.95, 1.05); }
      75% { transform: scale(1.05, 0.95); }
      100% { transform: scale(1, 1); }
    }
    .btn-jelly:active {
      animation: jelly 0.6s ease;
    }

    /* 点击波纹效果 */
    .btn::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    .btn:active::after {
      width: 200px;
      height: 200px;
      opacity: 0;
    }

    .theme-toggle { 
      width: 40px; 
      height: 40px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      cursor: pointer; 
      background: var(--bg-tertiary); 
      border: 1px solid var(--border); 
      color: var(--text-secondary); 
      font-size: 18px; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .theme-toggle:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--border-hover);
      transform: rotate(180deg) scale(1.1);
    }
    [data-theme="light"] .theme-toggle:hover {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent-border);
    }

    /* ========== 可爱卡片 ========== */
    .card { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
      opacity: 0;
      transition: opacity var(--transition);
    }
    .card-hover:hover { 
      border-color: var(--border-hover); 
      box-shadow: var(--shadow-sm);
      transform: translateY(-4px);
    }
    .card-hover:hover::before {
      opacity: 1;
    }
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
      transform: translateY(-3px);
    }
    [data-theme="light"] .card:hover::before {
      opacity: 1;
    }
    .card-title { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
    }

    /* ========== 表单样式 ========== */
    .form-group { margin-bottom: 16px; }
    .form-label { 
      display: block; 
      font-size: 13px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .form-input, .form-select { 
      width: 100%; 
      padding: 12px 16px; 
      background: var(--bg-input); 
      border: 2px solid var(--border); 
      border-radius: var(--radius-sm); 
      color: var(--text-primary); 
      font-size: 14px; 
      font-family: var(--font-sans); 
      transition: all var(--transition); 
      outline: none;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-bg);
      transform: translateY(-2px);
    }
    [data-theme="light"] .form-input:focus,
    [data-theme="light"] .form-select:focus {
      box-shadow: 0 0 0 6px rgba(29, 125, 250, 0.12);
      transform: translateY(-2px);
      border-color: var(--accent-hover);
    }
    .form-input::placeholder { color: var(--text-muted); }
    .form-select {
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      padding-right: 38px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 14px;
      position: relative;
    }
    .form-select:hover { border-color: var(--accent-hover); }
    .form-select option { background: var(--bg-card); color: var(--text-primary); padding: 6px 10px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-row-3 { display: grid; grid-template-columns: 140px 1fr 1fr; gap: 12px; }
    .form-inline { display: flex; align-items: flex-end; gap: 8px; }
    .form-inline .form-group { flex: 1; margin-bottom: 0; }
    .subdomain-input-group { display: flex; align-items: center; gap: 0; }
    .subdomain-input-group .form-input { 
      border-radius: var(--radius-sm) 0 0 var(--radius-sm); 
      border-right: none; 
      text-align: right;
    }
    .subdomain-input-group .domain-suffix { 
      padding: 12px 16px; 
      background: var(--bg-tertiary); 
      border: 2px solid var(--border); 
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0; 
      color: var(--text-secondary); 
      font-size: 14px; 
      white-space: nowrap; 
      font-family: var(--font-mono);
      border-left: none;
    }
    textarea.form-input { resize: vertical; min-height: 80px; }

    /* ========== 表格 ========== */
    .table-wrap { overflow-x: auto; border-radius: var(--radius-sm); }
    table { width: 100%; border-collapse: collapse; }
    th { 
      text-align: left; 
      padding: 12px 16px; 
      font-size: 12px; 
      font-weight: 600; 
      color: var(--text-muted); 
      text-transform: uppercase; 
      letter-spacing: 0.08em;
      border-bottom: 2px solid var(--border);
      background: var(--bg-tertiary);
    }
    td { 
      padding: 14px 16px; 
      font-size: 14px; 
      border-bottom: 1px solid var(--border); 
      color: var(--text-primary); 
      transition: background var(--transition);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { 
      background: var(--bg-hover);
    }
    .mono { 
      font-family: var(--font-mono); 
      font-size: 13px;
      background: var(--bg-tertiary);
      padding: 4px 8px;
      border-radius: 4px;
    }

    /* ========== 标签 ========== */
    .badge { 
      display: inline-flex; 
      align-items: center; 
      gap: 4px;
      padding: 4px 12px; 
      border-radius: 999px; 
      font-size: 12px; 
      font-weight: 600;
      transition: all var(--transition);
    }
    .badge-type { 
      background: var(--accent-bg); 
      color: var(--accent); 
      border: 1px solid var(--accent-border);
    }
    .badge-proxied { 
      background: var(--warning-bg); 
      color: var(--warning);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }
    .badge-pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      animation: pulse 2s ease-in-out infinite;
    }
    .badge-approved { 
      background: var(--success-bg); 
      color: var(--success);
    }
    .badge-rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
    }

    /* 脉冲动画 */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ========== Hero 区域 ========== */
    .hero { 
      text-align: center; 
      padding: 80px 0 60px; 
    }
    .hero h1 { 
      font-size: 52px; 
      font-weight: 800; 
      letter-spacing: -0.03em; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      -webkit-background-clip: text; 
      -webkit-text-fill-color: transparent; 
      background-clip: text; 
      margin-bottom: 20px;
      animation: gradientShift 3s ease infinite;
      background-size: 200% 200%;
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .hero p { 
      font-size: 18px; 
      color: var(--text-secondary); 
      max-width: 520px; 
      margin: 0 auto 32px;
      line-height: 1.7;
    }
    .features { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 48px 0; 
    }
    .feature-card { 
      text-align: center; 
      padding: 32px 20px;
      transition: all var(--transition);
    }
    .feature-card:hover {
      transform: translateY(-8px);
    }
    .feature-icon { 
      font-size: 40px; 
      margin-bottom: 16px;
      display: inline-block;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .feature-card:hover .feature-icon {
      transform: scale(1.2) rotate(-10deg);
    }
    .feature-card h3 { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 8px; 
    }
    .feature-card p { 
      font-size: 13px; 
      color: var(--text-secondary); 
    }

    /* ========== Dashboard ========== */
    .dashboard { padding: 32px 0; }
    .section { margin-bottom: 32px; }
    .section-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      margin-bottom: 20px; 
    }
    .section-title { 
      font-size: 24px; 
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .empty { 
      text-align: center; 
      padding: 64px 20px; 
      color: var(--text-muted); 
    }
    .empty-icon { 
      font-size: 64px; 
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ========== 子域名卡片 ========== */
    .subdomain-card { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      padding: 20px 24px; 
      margin-bottom: 12px;
      transition: all var(--transition);
    }
    .subdomain-card:hover {
      transform: translateX(8px);
    }
    .subdomain-info h4 { 
      font-size: 18px; 
      font-weight: 700; 
      font-family: var(--font-mono);
      margin-bottom: 4px;
    }
    .subdomain-info p { 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 4px;
    }
    .subdomain-actions { 
      display: flex; 
      gap: 8px; 
      align-items: center; 
    }

    .status-note { 
      margin-top: 10px; 
      padding: 12px 16px; 
      border-radius: var(--radius-sm); 
      font-size: 13px; 
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 3px solid;
    }
    .status-note.pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      border-left-color: var(--pending);
    }
    .status-note.rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
      border-left-color: var(--danger);
    }

    /* ========== DNS 管理 ========== */
    .dns-header { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      margin-bottom: 24px; 
    }
    .dns-header h2 { 
      font-size: 24px; 
      font-weight: 700;
    }
    .back-link { 
      display: inline-flex; 
      align-items: center; 
      gap: 6px; 
      color: var(--text-secondary); 
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition);
    }
    .back-link:hover { 
      color: var(--text-primary);
      transform: translateX(-4px);
    }
    .record-form { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      margin-bottom: 24px;
      transition: all var(--transition);
    }
    .record-form:hover {
      border-color: var(--border-hover);
    }
    .record-form-title { 
      font-size: 14px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ========== 代理开关按钮（黄色云朵） ========== */
    .proxied-toggle {
      position: relative;
      width: 56px;
      height: 28px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .proxied-toggle.active {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      border-color: #f59e0b;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
    }
    .proxied-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .proxied-toggle.active::after {
      transform: translateX(28px);
    }
    .proxied-toggle:hover {
      transform: scale(1.1);
    }
    .proxied-toggle:active {
      transform: scale(0.95);
    }

    /* 代理状态指示器 */
    .proxy-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      transition: all var(--transition);
    }
    .proxy-indicator.proxied {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #92400e;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
    }
    .proxy-indicator.direct {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    /* ========== 管理标签页 ========== */
    .tabs { 
      display: flex; 
      gap: 4px; 
      margin-bottom: 20px; 
      border-bottom: 1px solid var(--border); 
      padding-bottom: 0; 
    }
    .tab { 
      padding: 12px 24px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      border-bottom: 2px solid transparent; 
      transition: all var(--transition); 
      background: none; 
      border-top: none; 
      border-left: none; 
      border-right: none; 
      font-family: var(--font-sans);
      position: relative;
    }
    .tab:hover { 
      color: var(--text-primary); 
      transform: translateY(-2px);
    }
    .tab.active { 
      color: var(--accent); 
      border-bottom-color: var(--accent);
    }
    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 2px;
      background: var(--accent);
      border-radius: 2px;
    }
    .tab .tab-count { 
      background: var(--danger); 
      color: white; 
      border-radius: 999px; 
      padding: 2px 8px; 
      font-size: 11px; 
      margin-left: 6px;
      animation: pulse 2s ease-in-out infinite;
    }

    /* ========== 模态框 ========== */
    .modal-overlay { 
      position: fixed; 
      inset: 0; 
      background: rgba(0, 0, 0, 0.6); 
      backdrop-filter: blur(8px);
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 200; 
      opacity: 0; 
      pointer-events: none; 
      transition: opacity 0.3s ease; 
    }
    .modal-overlay.active { 
      opacity: 1; 
      pointer-events: auto; 
    }
    .modal { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 32px; 
      max-width: 480px; 
      width: 90%; 
      box-shadow: var(--shadow); 
      transform: scale(0.9) translateY(20px); 
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .modal-overlay.active .modal { 
      transform: scale(1) translateY(0); 
    }
    .modal h3 { 
      font-size: 20px; 
      font-weight: 700; 
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal p { 
      color: var(--text-secondary); 
      font-size: 14px; 
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .modal-actions { 
      display: flex; 
      gap: 10px; 
      justify-content: flex-end; 
    }

    /* ========== Toast 通知 ========== */
    .toast-container { 
      position: fixed; 
      top: 80px; 
      right: 20px; 
      z-index: 300; 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
    }
    .toast { 
      padding: 14px 24px; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 500; 
      box-shadow: var(--shadow); 
      animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                 slideOutRight 0.4s ease 2.6s forwards; 
      max-width: 380px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast-success { 
      background: linear-gradient(135deg, #22c55e, #16a34a); 
      color: white; 
    }
    .toast-error { 
      background: linear-gradient(135deg, #ef4444, #dc2626); 
      color: white; 
    }
    .toast-info { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
    }
    @keyframes slideInRight { 
      from { transform: translateX(120%); opacity: 0; } 
      to { transform: translateX(0); opacity: 1; } 
    }
    @keyframes slideOutRight { 
      to { opacity: 0; transform: translateX(120%); } 
    }

    /* ========== 加载动画 ========== */
    .spinner { 
      display: inline-block; 
      width: 24px; 
      height: 24px; 
      border: 3px solid var(--border); 
      border-top-color: var(--accent); 
      border-radius: 50%; 
      animation: spin 0.8s linear infinite; 
    }
    @keyframes spin { 
      to { transform: rotate(360deg); } 
    }
    .loading-center { 
      display: flex; 
      justify-content: center; 
      padding: 60px; 
    }

    /* ========== 复选框 ========== */
    .checkbox-label { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      cursor: pointer; 
      font-size: 14px; 
      color: var(--text-secondary);
      transition: all var(--transition);
    }
    .checkbox-label:hover {
      color: var(--text-primary);
    }
    .checkbox-label input[type="checkbox"] { 
      width: 18px; 
      height: 18px; 
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* ========== 审核卡片 ========== */
    .review-card { 
      border-left: 4px solid var(--pending); 
    }
    .review-card .review-meta { 
      display: flex; 
      gap: 16px; 
      align-items: center; 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 8px; 
      flex-wrap: wrap;
    }

    /* ========== 响应式 ========== */
    @media (max-width: 768px) {
      .hero h1 { font-size: 36px; }
      .features { grid-template-columns: 1fr; }
      .form-row, .form-row-3 { grid-template-columns: 1fr; }
      .form-row > *, .form-row-3 > * { width: 100%; max-width: 100%; }
      .subdomain-card { 
        flex-direction: column; 
        gap: 16px; 
        align-items: flex-start; 
      }
      .section-title { font-size: 20px; }

      /* 用户名：移动端也显示，单行省略限宽，不隐藏、不撑破 */
      .user-name { 
        display: inline-block; 
        max-width: 130px; 
        overflow: hidden; 
        text-overflow: ellipsis; 
        white-space: nowrap; 
        vertical-align: middle; 
      }
      /* 顶部导航/用户区允许换行、不溢出挤压 */
      .user-info, .nav-bar, .top-bar, .navbar { flex-wrap: wrap; overflow: hidden; min-width: 0; }
      /* 全局防横向滚动/框被遮挡：容器撑满并在内部滚动 */
      body { overflow-x: hidden; }
      .container, .main-wrap, .page, main, .dashboard-wrap { 
        width: 100%; 
        max-width: 100%; 
        padding-left: 12px; 
        padding-right: 12px; 
        box-sizing: border-box; 
      }
      .card, .panel, .box, .form-container, .table-wrap, .status-card, .account-card { 
        width: 100%; 
        max-width: 100%; 
        box-sizing: border-box; 
      }
      .table-wrap { -webkit-overflow-scrolling: touch; }

      /* ---- 移动端美学与流畅性优化 ---- */
      html { -webkit-text-size-adjust: 100%; }
      .hero { padding: 28px 0; }
      .subdomain-card, .card, .panel, .status-card, .account-card {
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(15, 23, 42, 0.10);
      }
      button, .btn, input, select, textarea {
        font-size: 16px;      /* 防 iOS 输入聚焦自动缩放 */
        border-radius: 10px;
      }
      input, select, textarea { box-sizing: border-box; }
      .section-title { letter-spacing: 0.2px; }

      /* 触屏点击反馈 + 更顺滑动效（只动 transform/shadow，走 GPU） */
      .btn, a.btn, .friend-link {
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.18s ease,
                    background var(--transition);
        will-change: transform;
      }
      .btn:active, a.btn:active { transform: scale(0.96); }
    }

    /* 尊重「减弱动态效果」系统偏好：动画/过渡切换克制，避免晕动与刺眼 */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* 全局平滑滚动（锚点/轮播切换更顺滑）——仅在非降动效下生效 */
    html { scroll-behavior: smooth; }

    /* ========== 滚动条 ========== */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { 
      background: var(--border); 
      border-radius: 4px; 
    }
    ::-webkit-scrollbar-thumb:hover { 
      background: var(--border-hover); 
    }

    /* ========== 动画 ========== */
    .fade-in { 
      animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
    }
    @keyframes fadeIn { 
      from { opacity: 0; transform: translateY(12px); } 
      to { opacity: 1; transform: translateY(0); } 
    }

    .jelly {
      animation: jelly 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .bounce-in {
      animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes bounceIn {
      0% { transform: scale(0.8); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* 浮动动画 */
    .float {
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    /* 弹跳动画 */
    .bounce {
      animation: bounce 2s ease-in-out infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }

    /* 摇晃动画 */
    .shake:hover {
      animation: shake 0.5s ease;
    }

    /* 持续脉动发光（Cloudflare 加速图标用，自动播放） */
    .pulse-soft {
      display: inline-block;
      animation: pulseSoft 2.4s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.5));
    }
    @keyframes pulseSoft {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.18); opacity: 0.75; }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .footer { 
      text-align: center; 
      padding: 40px 0; 
      color: var(--text-muted); 
      font-size: 13px; 
      border-top: 1px solid var(--border); 
      margin-top: 60px; 
    }
    .footer-friendlinks {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .friend-link-label {
      font-weight: 600;
      color: var(--text-secondary);
    }
    .friend-link {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .friend-link:hover {
      color: white;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: transparent;
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }
    .contact-admin-btn {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      padding: 10px 20px;
    }
    .contact-admin-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
      color: #fff;
    }

    /* 账户选择下拉 */
    .account-select {
      position: relative;
    }
    .account-select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-top: 4px;
      box-shadow: var(--shadow);
      z-index: 50;
      max-height: 200px;
      overflow-y: auto;
    }
    .account-select-item {
      padding: 10px 14px;
      cursor: pointer;
      transition: all var(--transition);
      border-bottom: 1px solid var(--border);
    }
    .account-select-item:last-child {
      border-bottom: none;
    }
    .account-select-item:hover {
      background: var(--bg-hover);
    }
    .account-select-item.active {
      background: var(--accent-bg);
      color: var(--accent);
    }

    /* ========== 公告横幅 ========== */
    .announcements-container {
      margin-top: 16px;
    }
    .announcement-card {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12));
      border: 1px solid var(--accent-border);
      border-radius: var(--radius);
      padding: 14px 18px;
      margin-bottom: 12px;
      backdrop-filter: blur(8px);
      transition: all var(--transition);
    }
    .announcement-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .announcement-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .announcement-date {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 400;
      margin-left: auto;
    }
    .announcement-content {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    /* ===== 公告轮播 + 置顶 + 缩略展开 ===== */
    .announcement-carousel {
      position: relative;
      /* 不能 here overflow:hidden，否则展开后的全文会被裁剪；
         用 visible，让「展开」可自然撑高阅读全文。未展开时各卡片
         缩略同高（3 行）+ min-height 兜底，切换轮播不上下跳动。 */
      overflow: visible;
      min-height: 134px;
    }
    /* 轮播内标题单行省略，防止标题换行造成高度差异 */
    .announcement-carousel .announcement-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* 缩略区固定 3 行占位高度（与 -webkit-line-clamp:3 一致，1.7 行高），
       保证未展开时每张公告卡片同高，切换轮播平稳 */
    .announcement-carousel .announcement-content.collapsed {
      height: 5.1em;
      overflow: hidden;
      white-space: normal;
    }
    .carousel-slide {
      display: none;
    }
    .carousel-slide.active {
      display: block;
      animation: fadeInUp var(--transition);
    }
    .announcement-card.pinned {
      border-color: var(--accent);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.18);
    }
    .pin-badge {
      display: inline-block;
      font-size: 10px;
      color: #fff;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 999px;
      padding: 1px 8px;
      margin-left: 6px;
      font-weight: 600;
    }
    .announcement-content.collapsed {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .announcement-toggle-btn {
      margin-top: 6px;
      padding: 2px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--accent-border);
      border-radius: 999px;
      transition: all var(--transition);
    }
    .announcement-toggle-btn:hover {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
    }
    .carousel-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 8px;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--text-muted);
      cursor: pointer;
      opacity: 0.5;
      transition: all var(--transition);
    }
    .carousel-dot.active {
      background: var(--accent);
      opacity: 1;
      width: 18px;
    }

    /* 邮箱验证提示 */
    .verify-banner {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 16px 20px;
      border-radius: var(--radius);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }
    .verify-banner p {
      margin: 0;
      font-size: 14px;
    }
    .verify-banner .btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .verify-banner .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .verify-banner-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
    }
    .verify-binder {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .verify-binder .form-input {
      max-width: 300px;
      padding: 9px 14px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.95);
      color: #1f2937;
      border-color: rgba(255, 255, 255, 0.4);
      font-family: var(--font-mono);
    }
    .verify-binder .form-input:focus {
      border-color: #fff;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.25);
      transform: none;
    }
    .verify-banner-row .btn-primary {
      background: #fff;
      color: #2563eb;
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    .verify-banner-row .btn-primary:hover {
      background: #f0f4ff;
      color: #1d4ed8;
      transform: translateY(-2px);
    }

    /* 多账户管理卡片 */
    .account-card {
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .account-info {
      flex: 1;
    }
    .account-info h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .account-info p {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .account-actions {
      display: flex;
      gap: 8px;
    }

    /* 开关样式 */
    .switch {
      position: relative;
      width: 48px;
      height: 24px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }
    .switch.active {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-color: #3b82f6;
    }
    .switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .switch.active::after {
      transform: translateX(24px);
    }

    /* ========== 可爱 UI 增强 ========== */
    /* 品牌渐变文字 */
    .gradient-text {
      background: linear-gradient(120deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    /* 特性卡片悬浮轻微上浮 + 柔和光晕 */
    .feature-card {
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease;
    }
    .feature-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 14px 30px rgba(139, 92, 246, 0.18), 0 2px 8px rgba(0,0,0,0.06);
    }
    /* 主要按钮果冻呼吸光晕（仅主按钮，安全叠加） */
    .btn-primary.btn-jelly {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      background-size: 200% 200%;
      animation: gradientShift 6s ease infinite;
    }
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    /* 页面右侧/底部可爱的漂浮装饰气泡 */
    .deco-bubble {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
      filter: blur(3px);
      opacity: 0.35;
      animation: bubbleFloat 12s ease-in-out infinite;
    }
    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0) translateX(0); }
      50% { transform: translateY(-26px) translateX(14px); }
    }
    /* 面板切换淡入 */
    .section-header { animation: fadeIn 0.5s ease; }
  </style>
  
  ${raw(backgroundImage ? `<div class="bg-image-wrapper"><img class="bg-image" src="${proxyUrl(backgroundImage)}" alt="background" /><div class="bg-overlay"></div></div>` : '')}
</head>
<body>
  <!-- 可爱的漂浮装饰气泡 -->
  <div class="deco-bubble" style="width:120px;height:120px;top:18%;right:-30px;background:linear-gradient(135deg,#38bdf8,#818cf8);"></div>
  <div class="deco-bubble" style="width:90px;height:90px;bottom:12%;left:-24px;background:linear-gradient(135deg,#f472b6,#a78bfa);animation-delay:-4s;"></div>
  <div class="deco-bubble" style="width:64px;height:64px;top:60%;right:6%;background:linear-gradient(135deg,#34d399,#38bdf8);animation-delay:-8s;"></div>

  <header class="header">
    <div class="container">
      <a href="/" class="logo" onclick="navigate('home'); return false;">
        ${raw(siteLogo ? `<img src="${proxyUrl(siteLogo)}" alt="logo" class="logo-icon" style="width:36px;height:36px;object-fit:contain;background:none;box-shadow:none;border-radius:12px;" />` : `<div class="logo-icon">${defaultLogoSvg}</div>`)}
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
    function renderApprovalsPanel() {
      const rq = state.ownerApprovals.requester || [];
      const ap = state.ownerApprovals.approver || [];

      // 始终渲染该板块（空数据也给提示，让普通用户知道功能存在）；
      // 有记录时再展开两个子卡片。
      let h = '<div class="section"><div class="section-header">' +
        '<h2 class="section-title">待审批 · 层级子域</h2>' +
        '<span style="font-size:13px;color:var(--text-muted)">' + ap.length + ' 待我处理 · ' + rq.length + ' 我发起的</span></div>';

      if (rq.length === 0 && ap.length === 0) {
        h += '<div class="card"><p style="color:var(--text-muted);margin:0">暂无审批请求。申请更深一层的子域名时，若其上级已被他人拥有，该申请会出现在这里等待其所有者同意；若您是所有者，他人申请您名下子域的请求也会在此处理。</p></div>';
        h += '</div>';
        return h;
      }

      if (ap.length > 0) {
        h += '<div class="card" style="margin-bottom:12px">' +
          '<div class="record-form-title" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + icons.shield + ' 待我审批·上层所有权请求</div>';
        ap.forEach((a) => {
          const m = ownerApprovalMeta(a);
          const dl = a.deadline_at ? new Date(a.deadline_at).toLocaleString('zh-CN') : '';
          h += '<div class="subdomain-card" style="border-bottom:1px solid var(--border);padding:10px 0">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(a.target_fqdn) + ' ' + m.badge + '</h4>' +
            '<p style="margin:2px 0">申请人 ' + escapeHtml(a.applicant_github_name || ('用户#' + a.applicant_user_id)) +
            ' · 申请位于 <b>' + escapeHtml(a.base_fqdn) + '</b> 之下</p>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:0">截止 ' + dl + ' · 超时未处理将自动驳回</p>' +
            '</div><div class="subdomain-actions">' +
            (m.st === 'pending'
              ? '<button class="btn btn-primary btn-sm btn-jelly" onclick="decideOwnerApproval(' + a.id + ',\\'approve\\')">同意</button>' +
                '<button class="btn btn-danger btn-sm" onclick="decideOwnerApproval(' + a.id + ',\\'reject\\')">驳回</button>'
              : '<span style="font-size:12px;color:var(--text-muted)">已处理</span>') +
            '</div></div>';
        });
        h += '</div>';
      }

      if (rq.length > 0) {
        h += '<div class="card">' +
          '<div class="record-form-title" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + icons.pending + ' 我发起的审批申请</div>';
        rq.forEach((a) => {
          const m = ownerApprovalMeta(a);
          const dlTxt = m.st === 'pending'
            ? '截止 ' + (a.deadline_at ? new Date(a.deadline_at).toLocaleString('zh-CN') : '')
            : (a.decided_at ? '处理于 ' + new Date(a.decided_at).toLocaleString('zh-CN') : '');
          h += '<div class="subdomain-card" style="border-bottom:1px solid var(--border);padding:10px 0">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(a.target_fqdn) + ' ' + m.badge + '</h4>' +
            '<p style="margin:2px 0">位于 <b>' + escapeHtml(a.base_fqdn) + '</b> 之下 · 需上位所有者同意后开通</p>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:0">' + dlTxt + '</p>' +
            '</div><div class="subdomain-actions"></div></div>';
        });
        h += '</div>';
      }

      h += '</div>';
      return h;
    }

    function renderDashboard() {
      const subs = state.subdomains;
      const activeSubs = subs.filter(s => s.status !== 'rejected');
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
        subs.forEach(sub => {
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
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) { toast('子域名格式无效', 'error'); return; }
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
        h += '<div class="card"><div class="table-wrap"><table>' +
          '<thead><tr><th>类型</th><th>名称</th><th>内容</th><th>TTL</th><th>代理</th><th>开关</th><th>操作</th></tr></thead><tbody>';
        records.forEach(r => {
          const ttl = r.ttl===1?'自动':(r.ttl>=3600?(r.ttl/3600)+'h':(r.ttl>=60?(r.ttl/60)+'m':r.ttl+'s'));
          h += '<tr><td><span class="badge badge-type">'+escapeHtml(r.record_type)+'</span></td>' +
            '<td class="mono">'+escapeHtml(r.name)+'</td>' +
            '<td class="mono" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escapeHtml(r.content)+'">'+escapeHtml(r.content)+'</td>' +
            '<td>'+ttl+'</td>' +
            '<td>'+(r.proxied
              ?'<span class="proxy-indicator proxied">' + icons.cloud + ' 已代理</span>'
              :'<span class="proxy-indicator direct">直接</span>')+'</td>' +
            '<td><div class="proxied-toggle ' + (r.proxied ? 'active' : '') + '" onclick="toggleProxied(' + r.id + ', ' + r.proxied + ')" title="切换代理状态"></div></td>' +
            '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="editRecord('+r.id+')" title="编辑" style="display:flex">' + icons.edit + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="deleteRecordConfirm('+r.id+',\\''+escapeHtml(r.name)+'\\',\\''+escapeHtml(r.record_type)+'\\')" title="删除" style="display:flex">' + icons.trash + '</button>' +
            '</div></td></tr>';
        });
        h += '</tbody></table></div></div>';
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
      const r = state.records.find(r => r.id===id);
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
    async function toggleProxied(recordId, currentProxied) {
      try {
        const res = await api('/proxied/records/' + recordId + '/proxied', {
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
