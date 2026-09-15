-- =====================================================================
-- 0007 上级所有权审批表（层级子域名所有权模型）
-- ---------------------------------------------------------------------
-- 说明：
--   1. 由 `wrangler d1 migrations apply cf --remote` 按序应用一次；
--      也可在 D1 Console 手动贴（本文件语句均已幂等：IF NOT EXISTS）。
--   2. 模型：
--       - 申请目标更深的子域名（如 d.c.b.rol.moe）时，若其“最近被拥有的
--         真祖先”（如 b.rol.moe / c.b.rol.moe）已被某用户在系统内批准拥有，
--         则由该祖先的所有者审批（邮件含同意/驳回按钮，超时自动驳回）。
--       - 无被拥有祖先，或申请人本人即上层所有者 → 走既有管理员审核。
--       - 占用拦截为运行时递归 CF 检查（见代码），本表只负责“待审批请求”。
-- =====================================================================

CREATE TABLE IF NOT EXISTS owner_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_fqdn    TEXT NOT NULL,   -- 申请人想要的目标子域名 FQDN
  base_fqdn      TEXT NOT NULL,   -- 最近被拥有的祖先 FQDN（审批人拥有）
  approver_user_id  INTEGER NOT NULL, -- 审批人（所有权者）users.id
  applicant_user_id INTEGER NOT NULL, -- 申请人 users.id
  token          TEXT NOT NULL UNIQUE, -- 决策令牌（邮件按钮链接，长随机）
  status         TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/expired
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deadline_at    TEXT NOT NULL,   -- 超时未处理自动驳回（过期节点）
  decided_at     TEXT             -- 决策时间
);

-- 幂等：重复创建同名目标时按 target_fqdn 防重
CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_approvals_target ON owner_approvals(target_fqdn);
-- 按决策令牌快速定位（邮件链接点击校验）
CREATE INDEX IF NOT EXISTS idx_owner_approvals_token ON owner_approvals(token);
-- 列出待审批/该申请人所有申请
CREATE INDEX IF NOT EXISTS idx_owner_approvals_applicant ON owner_approvals(applicant_user_id, status);
-- 列出该所有权者的待处理申请（超时清扫/管理后台）
CREATE INDEX IF NOT EXISTS idx_owner_approvals_approver ON owner_approvals(approver_user_id, status);
