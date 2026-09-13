-- Cloudflare 多账户管理
CREATE TABLE IF NOT EXISTS cloudflare_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  account_name TEXT NOT NULL,
  api_token TEXT NOT NULL,
  zone_id TEXT,
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户邮箱验证
CREATE TABLE IF NOT EXISTS user_email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  is_verified INTEGER DEFAULT 0,
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, email)
);

-- 邮箱域名白名单
CREATE TABLE IF NOT EXISTS email_domain_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 系统加密设置
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  encrypted_value TEXT,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cf_accounts_user_id ON cloudflare_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON user_email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON user_email_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- 插入默认邮箱白名单（常用域名）
INSERT OR IGNORE INTO email_domain_whitelist (domain, description) VALUES
  ('gmail.com', 'Google Gmail'),
  ('outlook.com', 'Microsoft Outlook'),
  ('hotmail.com', 'Microsoft Hotmail'),
  ('live.com', 'Microsoft Live'),
  ('qq.com', '腾讯 QQ'),
  ('163.com', '网易 163'),
  ('126.com', '网易 126'),
  ('yeah.net', '网易 Yeah'),
  ('foxmail.com', '腾讯 Foxmail'),
  ('icloud.com', 'Apple iCloud'),
  ('me.com', 'Apple Me'),
  ('mac.com', 'Apple Mac'),
  ('proton.me', 'Proton Mail'),
  ('protonmail.com', 'Proton Mail'),
  ('zoho.com', 'Zoho Mail'),
  ('yandex.com', 'Yandex Mail'),
  ('gmx.com', 'GMX Mail'),
  ('mail.com', 'Mail.com');
