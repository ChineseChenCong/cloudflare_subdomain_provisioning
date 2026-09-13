-- 用户邮箱验证字段（修复 GitHub 登录失败：users 表缺 email_verified）
-- 注意：需在全新数据库上按顺序执行 0001 -> 0003 -> 0004。
-- 若 users 表已存在 email_verified 字段，本行会报 duplicate，请勿重复执行本文件。
-- 如需为已升级的旧库补字段，请单独执行：
--   ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;

-- 公告表（后台公告系统）
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 友情链接表（可选，也可通过环境变量 FRIEND_LINKS 配置）
CREATE TABLE IF NOT EXISTS friend_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_friend_links_sort ON friend_links(sort_order);

-- 默认公告（可在后台修改/关闭）
INSERT OR IGNORE INTO announcements (id, title, content, is_active) VALUES
  (1, '🎉 欢迎使用 SubDomain Hub', '系统已上线！通过 GitHub 登录后即可申请专属子域名，经管理员审核通过后获得完整 DNS 控制权。', 1);
