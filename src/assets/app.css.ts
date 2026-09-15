// Auto-extracted from routes/pages.ts <style> block (CSS 静态化).
// Served via GET /static/app.css with immutable CDN cache.
export const APP_CSS = `
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
      background: var(--overlay, var(--overlay-fallback));
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
      /* 申请子域表单：移动端纵向排布，后缀下拉不遮挡输入框、不横向溢出 */
      .form-inline { flex-direction: column; align-items: stretch; gap: 10px; }
      .form-inline > .form-group { width: 100%; max-width: 100%; margin-bottom: 0; }
      .form-inline > .btn, .form-inline > button { width: 100%; align-self: stretch; margin-bottom: 8px; }
      .subdomain-input-group { width: 100%; min-width: 0; }
      .subdomain-input-group .form-input { flex: 1 1 auto; min-width: 0; text-align: left; }
      .subdomain-input-group .domain-suffix {
        flex: 0 0 auto; max-width: 48%; min-width: 0; margin-left: 0;
        overflow: hidden;
      }
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
  `;
