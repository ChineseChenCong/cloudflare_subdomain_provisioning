# MODIFICATIONS.md — 修改明细（对照上游）

> 依据 GNU GENERAL PUBLIC LICENSE Version 3（29 June 2007）的合规义务，
> 本文件逐项列明本仓库相对上游 `Little100/cloudflare_subdomain_provisioning`
> 的全部修改，供接收者核验与履行「修改明确告知」义务。

---

## 一、来源与基线

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/Little100/cloudflare_subdomain_provisioning` |
| 本仓库（fork） | `https://github.com/ChineseChenCong/cloudflare_subdomain_provisioning` |
| 上游基线 commit | `42e0779`（`upstream/main` HEAD） |
| 本仓库类型 | 上游之 **fork / 派生修改版本**，非上游原样分发 |

本仓库在 `42e0779` 基线上进行派生演化，当前相对上游的全部差异见
`git diff 42e0779..HEAD`。以下按功能模块列出修改明细（不含逐行 diff，
完整 diff 可从 git 直接生成）。

---

## 〇、修改时间节点（Compliance Dates）

> GPL-3.0 §5a 要求修改品必须显著声明「已修改」并给出**相关日期**。下表为
> 本仓库全部修改的时间节点。

| 时间 | 事件 |
|---|---|
| 2026-03-15 | 上游基线 commit `42e0779`（作者 Little_100）——fork 起点；此后的任何差异均属本仓库增量 |
| 2026-09-13 | 本仓库首轮功能演化（单日 8 提交，HEAD=`2492c37`）：多 CF 账户、AES-GCM+SHA-256 密钥派生、GitHub 登录 + 邮箱强制验证 + 死锁/404 修复、公告/友链表、每日限额、前端 UI 定制与转圈修复、`wrangler.toml [vars]` |
| 2026-09-14 | 本轮（当前工作区未提交）：索引优化迁移 `0006`、公告轮播/缩略展开/置顶/排序前后端、`FRIEND_LINKS` 启用、`BANNED_PREFIXES` 去重并补充「常见保留域」、GPL-3.0 合规文件（LICENSE / NOTICE / MODIFICATIONS.md / MODIFICATIONS.diff） |

> 注：提交后请在本表日期后追加实际 commit 号，或在 git 提交信息中引用本文件。

---

## 二、修改明细（按功能模块）

### 1. 多 Cloudflare 账户支持（新增）
- `migrations/0003_multi_account_encryption.sql`（新增）：新增 `cloudflare_accounts`
  表，支持每用户绑定多个 CF 账户（api_token、zone_id、is_active、is_default）。
- `src/services/cloudflare-accounts.ts`（新增）：账户级 Zone 解析
  `resolveCfAccount` / `resolveZoneIdAndTokenFromAccounts` / `getActiveAccounts`，
  DNS 增删改时遍历 active 账户，优先 zone_id 精确匹配 + fallback 解析，
  使 rol.moe 与 kivotos.edu.kg 多域名自动分流。
- `src/services/cloudflare.ts`：DNS 创建/更新/删除改用 `resolveCfAccount` 替代
  原来全局 `CF_API_TOKEN + getZoneIdForDomain`（修复第二域名解析空报错的根因）。
- `src/config.ts`：新增按账户解析 zone/token 的逻辑。
- `src/routes/accounts.ts`（新增）：CF 账户添加/列表/启用/默认/删除接口。
- `src/db/queries.ts`：新增账户 CRUD、`finalZoneId ?? null` 兜底
  （修复第二账户未填 zone_id 时 `D1_TYPE_ERROR: Type 'undefined' not supported`）。

### 2. 密钥安全：AES-GCM + SHA-256 派生（修改/新增）
- `src/services/crypto.ts`（新增）：`getEncryptionKey` 由「直接 UTF-8 字符串当
  raw key（64 字符=512 位，超出 AES-GCM 上限）」改为 **SHA-256 派生固定 32 字节**，
  任意长度 `ENCRYPTION_KEY` 均可使用。
- `src/types.ts`：`Env` 接口新增 `ENCRYPTION_KEY`、`JWT_SECRET`、
  `CF_API_TOKEN`、`RESEND_API_KEY`、CF 账户相关环境变量等。

### 3. GitHub 登录 + 邮箱强制验证（新增/修改）
- `src/services/email-verification.ts`（新增）：验证 token 生成/校验、
  `verifyEmailByToken` 三态返回。
- `src/routes/verification.ts`（新增）：`/api/verification/config|send|bind`、
  邮箱绑定；验证邮件每日限额（每用户每天 `EMAIL_DAILY_EMAIL_LIMIT=5`）。
- `src/services/email.ts`：邮件改走 **Resend** 第三方（设 `RESEND_API_KEY` 即走），
  MailChannels DNS 方案弃用；申请审核通知给有邮箱的 admin，
  并回退到 `ADMIN_CONTACT_EMAIL` 必达。
- `src/middleware/auth.ts`：新增 `emailVerifiedMiddleware`（未验证用户对
  accounts/api/proxied 受保护路由返回 `EMAIL_NOT_VERIFIED`）。
- `src/index.ts`：修复邮箱验证**死锁**——把 `/api/verification/*` 提前到
  `apiRouter /*`（挂邮箱中间件）**之前**注册，未验证用户不再整段 403；
  新增 `GET /verify-email` 路由（邮件链接不再 404）。
- `migrations/0004_email_verify_announcements.sql`（新增）：`users` 加
  `email_verified` 列、`user_email_verifications` 表、`email_domain_whitelist` 表、
  `system_settings` 表、`announcements` 表、`friend_links` 表。

### 4. 公告与友情链接
- `migrations/0004` 建 announcements / friend_links 表。
- `src/routes/announcements.ts`（新增）：公告 CRUD 接口。
- `migrations/0006_add_indexes_announcements.sql`（新增，本轮）：为公告加
  `sort_order`、`is_pinned` 列（支撑轮播 + 置顶 + 排序）并新增批量索引，
  全部 `CREATE INDEX IF NOT EXISTS` 幂等。
- **公告系统改造（本轮前后端）**：
  - `src/db/queries.ts`：排序改为 `is_pinned DESC, sort_order ASC, id ASC`；
    `createAnnouncement` 支持 `sort_order`（缺省自动取 max+1）与 `is_pinned`；
    `updateAnnouncement` 支持排序/置顶字段；`deleteAnnouncement` 删除后对
    剩余公告做**展示序号紧凑重排**（`ROW_NUMBER` 重编 `sort_order`，只动展示
    列、绝不触碰被外键引用的主键 id，满足“删除后有序替补空白、序号不再增大”）。
  - `src/types.ts`：`Announcement` 增加 `is_pinned`、`sort_order`。
  - `src/routes/announcements.ts`：发布/编辑接口接收 `is_pinned`、`sort_order`。
  - `src/routes/pages.ts`（前端）：公告区升级为「**置顶公告直出全文**（带置顶
    徽标）+ **普通公告轮播**（默认按字数 3 行缩略，点击「展开全文/收起」阅读
    完整内容，自动定时切换，圆点可手动切）」；管理端表单新增「排序号 +
    置顶」控件、列表新增「排序」列与「置顶/取消置顶」操作。

### 5. 邮件发送日志与每日限额
- `migrations/0005_email_send_log.sql`（新增）：`email_send_log` 表
  `UNIQUE(user_id, send_date)`，支撑每用户每日 5 封限额。

### 6. 前端 UI 全面定制（页面层）
- `src/routes/pages.ts`（大改 ~1988 行）：蓝白配色、果冻动画、点击反馈、
  背景图/半透明遮罩/Logo 定制与默认值兜底；白天浅蓝白、系统字体栈（不使用
  外网 Google Fonts）；账户管理 tab、邮箱绑定输入框；公告/友链渲染区；
  多个 `onclick` / 正则的 **hono html 模板转义修正**（双反斜杠 `\\'X\\'`
  定界修复，消除模板转义丢反斜杠导致的 SyntaxError / 无限转圈）。
- `src/routes/proxied.ts`（新增，214 行）：CF 代理开关管理接口。

### 7. 部署与配置（wrangler.toml 等）
- `wrangler.toml`：`[[d1_databases]]` 绑定 `DB`；`[vars]` 段写入
  **12 项非机密普通变量**（幂等部署、永不消失），含最新
  `BANNED_PREFIXES`（去重 + 补充常见保留域）与启用的 `FRIEND_LINKS`；
  加密 Secret（`CF_API_TOKEN`、`RESEND_API_KEY`、`GITHUB_*`、`JWT_SECRET`、
  `ENCRYPTION_KEY`、`SMTP_PASS` 等）**绝不入 repo**，只留 CF 后台加密。
- `README.md`：改写文档；`CHANGELOG.md`（新增 204 行）。
- `package.json`：补充依赖（crypto/hono html 等）、脚本。

### 8. 合规与交付文件（本轮新增）
- `LICENSE`：GPL-3.0（29 June 2007）完整文本。
- `NOTICE`：合规声明（含「无担保声明」与再分发义务说明）。
- `MODIFICATIONS.md`（本文件）：相对上游的修改明细。
- `migrations/0006_add_indexes_announcements.sql`：索引优化 + 公告数据列。

---

## 三、本轮「索引 / 保留域 / 友链 / 公告 / 合规」改动对照

| 诉求 | 落地方式 | 依据 |
|---|---|---|
| 数据库索引优化 | 新增 `0006` 迁移，全 `IF NOT EXISTS` 幂等；`migrations apply` 机制天然只执行未应用文件，不重复不浪费额度 | B 节 |
| 减少查找消耗 | 为 `subdomains/dns_records/cloudflare_accounts/users/user_email_verifications/announcements` 高频查询补复合索引 | B 节 |
| `FRIEND_LINKS` 默认启用 | `[vars]` 写入莉莉安尼亚邮箱系统友链 | 七、1 |
| `BANNED_PREFIXES` 更新 | 按用户最新清单去重 + 补 26 个常见保留域，已写入 `[vars]` | 七、1 |
| 公告轮播/缩略展开/置顶/排序 | **已完成**：数据层（0006 加列）+ 后端（排序/置顶/新增序号重排）+ 前端（置顶直出全文、普通轮播、缩略可展开、管理端置顶/排序控件） | 九 |

> 提示：仓库中 `.wrangler-dist/`、`.dryrun-check/` 为 wrangler 构建/试运行
> 产物，源码仓库中通常不应提交；建议加入 `.gitignore`（若已跟踪，可清理）。

---

## 四、合规义务履行声明

1. 本仓库为上游 GPL 授权项目的 **fork / 派生修改版**，已在 LICENSE、NOTICE、
   本文件三处明确「来源 + 基线 + 修改明细」，满足「修改明确告知」。
2. 完整对应源码在本仓库公开提供（GitHub 公开仓库），满足 GPL-3.0
   第 4/5/6 条「提供源码」义务。
3. 任何再分发/再修改须保留本 LICENSE、NOTICE、MODIFICATIONS.md，并继续以
   GPL-3.0 条款发布。
4. 软件按 GPL-3.0 第 11/12 条「无担保」条款提供。
