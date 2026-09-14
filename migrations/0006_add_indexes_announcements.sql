-- =====================================================================
-- 0006 索引优化 + 公告系统改造（幂等）
-- ---------------------------------------------------------------------
-- 说明：
--   1. 本文件由 `wrangler d1 migrations apply cf --remote` 按序应用，
--      每次部署只执行「尚未应用」的迁移文件（由 migration 记录表控制），
--      因此天然不会重复执行、不浪费额度。
--   2. 所有 CREATE INDEX 均带 IF NOT EXISTS，重复执行也安全。
--   3. 目标：为高频查询补索引，减少 D1 全表扫描，降低查询时延与
--      Worker 资源消耗（用户诉求的「索引优化 / 减少查找消耗」）。
--   4. 公告系统新增「排序 + 置顶」列，支撑轮播/置顶/排序（0004 建表时
--      仅有 is_active，缺这两列）。
-- =====================================================================

-- ---------- A. subdomains ----------
-- 按创建时间排序/倒序（管理后台列表、最近申请）
CREATE INDEX IF NOT EXISTS idx_subdomains_created_at ON subdomains(created_at);
-- 按(用户, 时间)组合查询「我申请的子域名」
CREATE INDEX IF NOT EXISTS idx_subdomains_user_created ON subdomains(user_id, created_at);

-- ---------- B. dns_records ----------
-- 按 CF record id 反查（增删改 DNS 后回查）
CREATE INDEX IF NOT EXISTS idx_dns_records_cf_record_id ON dns_records(cf_record_id);
-- 按域名(name)精确反查记录（DNS 操作常按 name 定位）
CREATE INDEX IF NOT EXISTS idx_dns_records_name ON dns_records(name);

-- ---------- C. cloudflare_accounts ----------
-- resolveCfAccount 按「active + default」遍历与偏好匹配
CREATE INDEX IF NOT EXISTS idx_cf_accounts_active_default ON cloudflare_accounts(is_active, is_default);

-- ---------- D. users ----------
-- 按 email 查找（绑定/校验邮箱、管理员定位）
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------- E. user_email_verifications ----------
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON user_email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON user_email_verifications(is_verified);

-- ---------- F. announcements（公告）----------
-- 轮播/置顶/排序查询复合索引：先过滤启用，再按置顶优先、sort_order 升序
CREATE INDEX IF NOT EXISTS idx_announcements_pin_sort ON announcements(is_active, is_pinned, sort_order);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

-- ---------- G. 公告系统数据层改造（排序 + 置顶）----------
-- 迁移文件只应用一次，ADD COLUMN 幂等。新列为可选、有默认值，未改前端前无副作用。
ALTER TABLE announcements ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE announcements ADD COLUMN is_pinned INTEGER DEFAULT 0;

-- 备注：friend_links 的 idx_friend_links_sort、email_send_log 的
-- UNIQUE(user_id, send_date)（自带复合索引，每日限额查询已覆盖）在旧迁移已建，无需重复。
