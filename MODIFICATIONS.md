# MODIFICATIONS.md — 修改明细（对照上游）

> 依据 GNU GENERAL PUBLIC LICENSE Version 3（29 June 2007）的合规义务，
> 本文件逐项列明本仓库相对上游 `Little100/cloudflare_subdomain_provisioning`
> 的全部修改，供接收者核验与履行「修改明确告知」义务。

---

## 一、来源与基线

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/Little100/cloudflare_subdomain_provisioning` |
| 本仓库（fork） | `https://github.com/<fork维护方>/cloudflare_subdomain_provisioning`（fork 地址由维护方自填） |
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
| 2026-09-15 | 本轮（当前工作区未提交）：安全加固（`src/index.ts`：X-Frame-Options/nosniff/HSTS/Referrer-Policy 安全响应头、CORS 收紧为同源、CSRF 二道防线 `csrfAndAudit` 写操作审计日志、`/api/verification/send` 发邮件限流）、公告端 CSRF 缺口补齐、AES 核对（邮箱验证 24h 过期 / JWT 7 天）确认已存在、全站 escapeHtml 复核、`wrangler` 升级 `@4` 与 `wrangler.toml` 增 `[observability.logs]`/`[observability.traces]`（100% 采样 + 含调用日志 + persist 保留仪表板）、页面标题栏 favicon 复用 siteLogo 图案（`<head>` 新增 `rel="icon"` + `apple-touch-icon`，无 siteLogo 时回退默认 SVG base64）、外链资源本域 `/assets` 白名单代理（HTML 只暴露本站路径、不泄露外链源站域名，防爬虫/扫描发现外链；访客仅接本站、源站仅接 Worker 请求，保源站安全；host 白名单防 SSRF、复用限流、缓存响应头）、头像回 GitHub 直连（公共公开域名、量大避免吃 /assets 额度）、`/assets` 加 Cloudflare 边缘 CDN 缓存（`Cache-Control: public, max-age=86400, s-maxage=86400` → 首请求后同图重复访问命中 CF 边缘缓存，不触发 Worker/不计请求数/不耗出站，即“走 CDN 分发不耗 Worker”） |
| 2026-09-16 | 本轮（当前工作区未提交）：子域申请格式放开为多级 label（支持 `a.b` / `a.b.c`，前后端正则同步放开，配合既有“层级所有权审批 / occupied-chain 链条”）；HTML 不再输出外链真实域名（favicon / apple-touch-icon / 导航 logo / 背景图改本站固定端点 `/logo`、`/bg`，真实 URL 仅存服务端 env，删除 `proxyUrl` 内联外链写法）；主样式表静态化（`<style>` 约 1500 行抽取为独立常量并新增 `/static/app.css` 端点，`Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` → 命中 CF 边缘 CDN 后不触发 Worker/不耗出站，页面 HTML 瘦身；动态背景遮罩改 CSS 变量 `var(--overlay, var(--overlay-fallback))`，仅设背景色时才注入一行）；前端新增分页与 DNS 类型筛选（子域名列表分页 `subPager`、DNS 记录分页 `dnsPager` + 按类型筛选 `dnsTypeFilter`，每页条数可选 5/10/20/50 + «‹›» 翻页控件）；审批面板「已处理」分区（待处理保留主区，已同意 / 驳回 / 超时记录折入底部 `<details>` 折叠区，避免主区随记录增多无限拉长）；删除已审批赋予他人的子域后自动折叠其审批记录（关联 `owner_approvals.status` 置 `deleted`，前端「已处理」区自动隐藏该记录、保留审计）并同步邮件通知二级域名持有人（父级拥有者/审批人，覆盖「管理员删除」与「被授予使用者自行删除」两种场景）；审批面板三分区「待我处理 / 我发起的 / 已处理」各自独立分页（每页 5/10/20/50 + «‹›»，`apprPager`），记录过多时分页、避免面板无限拉长）；DNS 记录删除/代理切换双路定位修复（兼容 CF hex id 与 DB 数字主键：子域约束 `cf_record_id` 索引反查 + 数字主键兜底；**移除全表 `getDnsRecordEntryByCfId` 反查**，避免全表扫描吞噬 D1 rows-read 额度；`proxied` 切换路由改 `/records/:subdomainId/:recordId/proxied`，前端 `toggleProxied` 连同子域 id 传入）；前端记录操作 `onclick` 参数转义修复（`editRecord` 行内拼接引号补为双反斜杠 `\\'`，消除 Hono 模板吞反斜杠导致的整段 `<script>` `Unexpected string` 语法错误、页面转圈） |

> 注：提交后请在本表日期后追加实际 commit 号，或在 git 提交信息中引用本文件。

---

## 二、修改明细（按功能模块）

### 1. 多 Cloudflare 账户支持（新增）
- `migrations/0003_multi_account_encryption.sql`（新增）：新增 `cloudflare_accounts`
  表，支持每用户绑定多个 CF 账户（api_token、zone_id、is_active、is_default）。
- `src/services/cloudflare-accounts.ts`（新增）：账户级 Zone 解析
  `resolveCfAccount` / `resolveZoneIdAndTokenFromAccounts` / `getActiveAccounts`，
  DNS 增删改时遍历 active 账户，优先 zone_id 精确匹配 + fallback 解析，
  使部署者的多个自有主域能够按账户自动分流。
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
| `FRIEND_LINKS` 默认启用 | `[vars]` 写入示例友链（部署者应替换为自有友链） | 七、1 |
| `BANNED_PREFIXES` 更新 | 按用户最新清单去重 + 补 26 个常见保留域，已写入 `[vars]` | 七、1 |
| 公告轮播/缩略展开/置顶/排序 | **已完成**：数据层（0006 加列）+ 后端（排序/置顶/新增序号重排）+ 前端（置顶直出全文、普通轮播、缩略可展开、管理端置顶/排序控件） | 九 |

> 提示：仓库中 `.wrangler-dist/`、`.dryrun-check/` 为 wrangler 构建/试运行
> 产物，源码仓库中通常不应提交；建议加入 `.gitignore`（若已跟踪，可清理）。

---

### 9. 安全加固与可观测性（2026-09-15 本轮）
- `src/index.ts`（修改）：新增全局安全响应头 `X-Frame-Options: DENY`、
  `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`；CORS 由
  `origin:'*'` 收紧为**仅回显同源**（跨源返回空 → 浏览器拒绝）；新增 **CSRF 二道防线**
  （写方法 POST/PUT/DELETE/PATCH 校验 Origin/Referer 同源，跨源 403）并同挂
  `/api/*` 与 `/announcements`（补齐公告端此前无 CSRF 的缺口）；写方法统一输出
  审计日志 `console.log('[audit] <ISO时间> <METHOD> <path> ip=<CF-Connecting-IP>')`
  （零 DB，配合 `[observability].persist` 保留仪表板可回溯，不携私有数据）；
  新增 `/api/verification/send` **发邮件限流**（每 IP 每分钟 5 次，叠加既有
  每用户每日 5 封）。
- 安全核对（本轮）：邮箱验证 token 24h 过期、JWT 7 天有效期**原本已存在**，未改动；
  全站 `escapeHtml` 覆盖复核通过。⚠️ CSP **不启用**：前端（pages.ts）大量内联
  script/style/onclick，严格 CSP 会破坏页面显示与功能。
- `wrangler.toml`（修改）：新增 `[observability.logs]`（`enabled`、`head_sampling_rate=1`、
  `invocation_logs`、`persist`）与 `[observability.traces]`（`enabled`、
  `head_sampling_rate=1`、`persist`）：100% 采样 + 含调用日志/跟踪持久保留到
  Workers 仪表板（需 `wrangler@4` 支持此子块结构）。
- `package.json` / `package-lock.json`（修改）：`wrangler` 升级 `4.131.2`
  （Dev 依赖；`@cloudflare/workers-types@4` 保留，以 `--legacy-peer-deps` 绕过其
  peerOptional 版本冲突）。
- 合规复核（本轮）：新增安全与可观测改动已并入本文件「时间节点」与「明细」，
  仍以 GPL-3.0 授权再分发。

### 10. UI 与 favicon 细节修复（2026-09-15）
- `src/routes/pages.ts`：修正 `bgStyle` 的 CSS 背景**直出裸外链**为走 `proxyUrl`（消除
  HTML 中残留的 `sukicdn.com` 域名）；favicon 额外增加
  `<link rel="shortcut icon" href="/favicon.ico">`。
- `src/index.ts`：新增 `/favicon.ico` 端点（返回 `SITE_LOGO` 图像，
  `content-type: image/x-icon` + 边缘缓存，无 logo 则 204）——兼容 via 等极简浏览器。
- `src/routes/pages.ts`：移动端 `@media (max-width:768px)` 适配——`.user-name`
  由 `display:none`（隐藏）改为**显示且单行省略限宽**；顶部导航允许换行防挤压；
  表单/卡片/表格容器 `width:100%` + `box-sizing:border-box` 防遮挡；
  全局 `overflow-x:hidden` 防横向溢出。

### 11. DNS 实时读取与存储架构（2026-09-15）
- `wrangler.toml [vars]`：新增 `DNS_LIVE_READ="true"`。
- `src/config.ts`：新增 `isDnsLiveRead(env)`。
- `src/types.ts`（`Env`）：新增 `DNS_LIVE_READ?`。
- `src/services/cloudflare.ts`：新增 `listAllZoneRecords`（分页拉取某 Zone 全量 DNS 记录，
  上限 2000 条，供实时读取侧在代码内按名称前缀过滤，规避 CF `name` 参数不精确匹配）。
- `src/db/queries.ts`：新增 `getDnsRecordByCfId`（按 CF 记录 id 反查，供实时读取下
  更新/删除定位）。
- `src/routes/api.ts`：新增 `readRecordsForSubdomain`——开启 `DNS_LIVE_READ` 时
  `GET /api/subdomains/:id/records` 优先从 Cloudflare DSL 实时查（返回记录 `id` 即 CF 记录 id），
  任何 CF 失败自动回退 D1 全量读取；PUT/DELETE 改为按 `cf_record_id` 定位（实时模式）。
  效果：**高频 DNS 记录读取从 D1 挪到 CF，显著省 D1 读额度**，且保留写/审计/兜底，默认开启、失败回退、不中断。
- `STORAGE.md`（新增）：存储与分发架构总纲——CDN 边缘缓存、DNS 实时读取（✅ 已落地）；
  「自定义 SQLite → S3 → D1」后端链设计（含 **S3 为对象存储、非可查询 SQL 库** 的技术修正，
  S3 仅作快照灾备），`DB_QUERY_ORDER`/`CUSTOM_SQLITE_*`/`S3_*`/`DB_ADMIN_ALERT_EMAIL` 环境变量契约，
  一次性回填（`storage_backfill_done` 标记）与自动故障转移 + 管理员告警；实施作为后续独立提交。

---

### 12. 抢注防护与回收安全（2026-09-15）
- `src/services/cloudflare.ts`：新增 `hasDnsRecordsForFqdn`（判定某 FQDN 名下是否已在 CF 存有解析配置）与
  `deleteDnsRecordsByFqdn`（整组回收某 FQDN 名下记录，**范围精确到「==FQDN 或以 .FQDN 结尾」**，
  绝不误删其它子域名/项目）。
- `src/routes/api.ts`（申请 `POST /subdomains`）：在格式/前缀/配额/库内占用检查之后，新增 **CF DNS 占用检查**——
  若目标 `<subdomain>.<domain>` 名下在 Cloudflare 已存在解析配置，直接 409 拒绝
  （“该子域名名下已存在 DNS 解析配置，为保护既有项目不允许申请”），防止申请者顶掉他人已在用的解析；
  CF 查询失败则回退仅按 DB 判断，保证申请功能在 CF 波动时不被误阻断。
- `src/routes/api.ts`（管理员删除 `DELETE /admin/subdomains/:id`）：支持**可选 JSON 删除理由**；
  先按 FQDN 精确回收该子域名全部 DNS 解析（不误删他人项目，CF 失败回退按 DB 记录逐个删），
  再删除子域名，并**邮件通知所属用户**（新构建器 `buildDeletionNoticeEmail`，含删除理由）。
- `src/routes/api.ts`（用户删除 `DELETE /subdomains/:id`）：改为**按 FQDN 精确回收全部 DNS 解析**
  （防止“权限已删但解析仍生效”的残留；CF 失败回退 DB 逐个删），并**邮件通知管理员**
  （新构建器 `buildUserDeletedAdminEmail`，发往已绑定邮箱的管理员，缺则回退 `ADMIN_CONTACT_EMAIL`）。
- `src/services/email.ts`：新增 `buildDeletionNoticeEmail`、`buildUserDeletedAdminEmail` 两个邮件构建器。

### 13. 层级子域名所有权审批（2026-09-15 本轮）
实现「任意层级子域名的拥有权从属关系」模型：**既有配置即占用、逐级递归拦截、上级所有者审批**。
- `migrations/0007_owner_approvals.sql`：新增 `owner_approvals` 表（待审批请求），记录目标 fqdn、
  最近被拥有的祖先 fqdn、审批人（所有权者）/ 申请人、决策 token、状态（pending/approved/rejected/expired）、
  审批时限 deadline_at、决策时间 decided_at；附带 4 个幂等索引（target 唯一、token、applicant、approver）。
- `src/db/queries.ts`：新增 `enumerateAncestorFqdns`（构造目标 fqdn 的全部真祖先，离根最近者优先）、
  `findApprovedOwnedAncestor`（在祖先链中查“最近被拥有的祖先”，即被批准的子域名，按最长优先）、
  `createOwnerApproval` / `getOwnerApprovalByToken` / `getPendingApprovalByTarget` / `setOwnerApprovalStatus`
  等审批读写函数。
- `src/routes/api.ts`（申请 `POST /subdomains`）：**占用拦截改为递归**——对目标 fqdn 及其每一级祖先
  整条链逐个做 CF 已配置检查（`hasDnsRecordsForFqdn`）；只要链上任一层已有解析配置（该层或其下），
  该层之下的任意深度都不允许再申请（409，code `occupied-chain`）。
  **上级审批**：若目标存在“被拥有的祖先”且其所有者非申请人本人，则不再直接建子域名，而是
  写入 `owner_approvals`（pending）并向该祖先所有者发审批请求邮件（含“同意 / 驳回”按钮，即
  `/decide-approval?token=…&action=approve|reject`）；超时（`OWNER_APPROVAL_DEADLINE_HOURS`，默认 72h）
  未处理自动驳回。若申请人本人即上层所有者（拥有二级者可申请其下三级），则无需外部同意、回退正常流程。
- `src/index.ts`：新增 GET `/decide-approval` 决策落地页——校验 token；超时（now>deadline 且仍 pending）
  自动标 expired（视为自动驳回）；已决定则只读展示；approve 时创建该目标子域名并置为 approved
  （所有权者已同意）并邮件通知申请人结果；reject 时标记 rejected 并通知申请人。
- `src/services/email.ts`：新增 `buildOwnerApprovalRequestEmail`（发给所有权者的审批请求，含同意/驳回按钮）、
  `buildOwnerApprovalResultEmail`（向申请人通知 同意/驳回/超时自动驳回 结果）。
- `src/config.ts` / `src/types.ts` / `wrangler.toml`：新增非机密变量 `OWNER_APPROVAL_DEADLINE_HOURS`（默认 72）。

### 14. 备案自动识别 + 存储后端/自动迁移（2026-09-15 本轮）
- `src/config.ts` `getSiteBeian`：**备案号自动识别**。单一环境变量 `SITE_BEIAN` 只存当前启用的
  一条编号，因此萌ICP备与中国正式 ICP **天然互斥、只能启用一个**：
  - 含「萌」（如 `萌ICP备2024xxxx号`）→ 萌ICP备，仅展示文本、不伪造权威链接。
  - 形如 `…ICP备…号/ICP证…` 且不含「萌」→ 中国正式 ICP，链接工信部官方 `https://beian.miit.gov.cn`
    （`target=_blank rel=noopener noreferrer nofollow` 防劫持）。
  - 其它 → 仅展示文本。编号一律 HTML 转义防 XSS；未配置则不渲染。
- `src/db/provider.ts`（新增，自洽模块、**默认关闭=纯 D1 等价**）：按 `DB_QUERY_ORDER`
  （custom-sqlite→d1）选择活动后端并做健康探测；实现自定义 SQLite（Turso/libsql over HTTP）
  只读查询客户端、S3/R2 兼容 SigV4 客户端（PUT/GET，仅整库快照灾备，非实时 SQL 查询）、
  `uploadSnapshotToS3`/`downloadSnapshotFromS3`/`exportD1Snapshot`（低频整库快照）。
- `src/types.ts`：Env 补充存储链环境变量 `DB_QUERY_ORDER`/`CUSTOM_SQLITE_URL`/`CUSTOM_SQLITE_TOKEN`/
  `CUSTOM_SQLITE_JWT`/`S3_BACKUP_BUCKET`/`S3_ENDPOINT`/`S3_REGION`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/
  `S3_USE_PATH_STYLE`/`DB_ADMIN_ALERT_EMAIL`。
  **生产逐查询改造（把 queries.ts 的 DB 入口统一走 provider 读回退链）按 STORAGE.md 规划作为独立 commit**。
- `package.json`：迁移脚本改为 `wrangler d1 migrations apply cf --local/--remote`（只应用未执行文件、
  幂等不重复、**不浪费 D1 额度**）；新增 `db:export`（整库导出备份到 snapshot.sql）、
  `deploy:migrate`（迁移+发布一步）。DDL 严禁在 Worker 运行时执行，统一离线应用。

### 15. 前端「待审批」面板 + 共享审批决策服务（2026-09-15 本轮）
把层级子域名审批从「仅邮件按钮」扩展到**普通用户前端面板**（UI 与既有蓝白果冻主题一致，
复用 `.section`/`.card`/`.subdomain-card`/`.badge`/`.btn` 等既有样式，不破坏主题）。
- `src/services/owner-approval.ts`（新增，**统一决策落地层**）：抽取出邮件链接（服务端校验 token）
  与前端面板（会话鉴权+审批人校验）两条入口**共用**的审批逻辑，保证行为完全一致：
  `expireOwnerApproval`（pending 且超时 → 标 expired + 通知申请人，幂等）、
  `rejectOwnerApproval`（标 rejected + 通知申请人）、
  `approveOwnerApproval`（存在同名则只标 approved/通知、dupe=true；否则创建子域名并置 approved +
  通知申请人）、`isOwnerApprovalExpired`/`splitOwnerApprovalTarget` 辅助。
- `src/index.ts`：`GET /decide-approval` **改为调用该服务**（删除原本内联的重复分支），行为不变、
  代码单一来源。
- `src/db/queries.ts`：新增 `getOwnerApprovalsByApplicant`（我发起的）/ `getOwnerApprovalsByApprover`
  （我作为审批人的），均最新优先。
- `src/routes/api.ts`：新增普通用户鉴权接口——
  `GET /owner-approvals`（返回 req 两侧列表，并附带申请人用户名便于展示）、
  `POST /owner-approvals/:id/approve`、`POST /owner-approvals/:id/reject`
  （仅该请求的审批人本人可操作；pending 且超时 → 服务端再次按当前时间为准自动驳回）。
- `src/routes/pages.ts`：新增「待审批 · 层级子域」面板（置于「我的子域名」之后）——两个子卡片：
  ① 待我处理的上级所有权请求（含「同意 / 驳回」按钮，超时显示为已超时）；② 我发起的申请状态；
  新增 `renderApprovalsPanel`/`ownerApprovalMeta`/`loadOwnerApprovals`/`decideOwnerApproval`。
  `init()` 增加独立 try/catch 加载，不破坏既有“加载失败也必达渲染”的兜底。
验证：`npx tsc --noEmit` 通过。

### 16. D1 → 镜像后端自动同步（Scheduled / cron，2026-09-15 本轮）
此前把 D1 数据灌入 MySQL / 自定义 SQLite 需维护者手跑
`npm run db:export` + `turso db shell` / `mysql -h … < snapshot.sql`。本轮改为
**Worker 内置定时自动同步**，无需手动执行：
- `src/services/sync.ts`（新增）：从 D1 读取全部业务表（0001–0007 共 11 张）快照，
  逐表对启用且已配置的镜像后端（`DB_QUERY_ORDER` 中的 `mysql` / `custom-sqlite`）做
  全表替换（DELETE + 重灌）；表级 try/catch、单表失败不影响其余；任一张表 D1 读取失败
  则本次同步中止（避免半桶镜像）。纯只读消费 D1、写仅作用于镜像，绝不反向回写 D1。
- `src/db/provider.ts`（新增）：`sqliteExec`（libsql HTTP 批量写）/ `mysqlExec`
  （Hyperdrive `?` 占位写）。
- `src/index.ts`：Worker 导出改为标准 `{ fetch, scheduled }`，`scheduled` 调用
  `syncD1ToMirrors(env)`（cron）——幂等、离线于请求路径，不耗每次请求的 D1 额度。
- `wrangler.toml`：新增 `[triggers] crons = ["0 0 * * *"]`（每天一次，UTC 0 点），
  及注释待启用 `[[hyperdrive]]` 绑定模板。频率定为日级：镜像新鲜度由「写时增量推」
  (write-through，见 STORAGE.md) 维持，此 cron 仅作全量自愈/冷对齐，不承担实时职责。
设计约束：未配置任何镜像（纯 D1 缺省）时同步为 no-op，线上行为与现状完全一致；
新增/删除表需同步更新 `sync.ts` 的 `SYNC_TABLES` 常量。
验证：`npx tsc --noEmit` 与 `npx wrangler deploy --dry-run`（437.77 KiB / gzip 94.18 KiB）通过。

### 17. 写时增量推镜像（write-through，2026-09-15 本轮）
此前镜像的新鲜度依赖每日全量 cron；本次改为**每次 D1 写提交后立即增量推该行到镜像**，
实现「没写入 → 读只走镜像、不碰 D1；一有写入 → 该行立即同步；回退才回 D1」的目标。
- `src/services/mirror.ts`（新增）：`mirrorSyncRow(env, table, keyVal)` 对单行做
  **reconcile**（D1 回读该行权威数据 → 镜像 DELETE 旧行 + INSERT 新行；D1 无该行则
  DELETE 清残留）。**best-effort**：任一镜像失败只记 `[audit]`，绝不抛出、绝不阻塞写、
  绝不反向回写 D1。复合主键表（`email_send_log` 的 `user_id+send_date`）不适用单行推，
  由日级 cron 全量对齐。
- 写入口接线（覆盖 api.ts / owner-approval.ts / announcements.ts / proxied.ts /
  cloudflare-accounts.ts）：`subdomains`（创建/删除/审核）、`dns_records`（新建/更新/删除）、
  `owner_approvals`（创建/同意/驳回/过期）、`announcements`（增/改/删）、
  `cloudflare_accounts`（创建/更新）。删除类写点若拿不到 env（如 accounts delete）
  靠日级 cron 对齐，不影响安全。
- 一致性模型：D1 为唯一写主与权威；镜像为可降级副本；未覆盖/漏推/半成功由
  `syncD1ToMirrors` 每日全量自愈兜底，最终一致、无数据丢失。
- 触发条件：与用户请求路径绑定（每次写 handler 执行后），不再依赖高频定时；
  `wrangler.toml [triggers] crons = ["0 0 * * *"]` 仅作全量自愈/冷对齐。
- 验证：`npx tsc --noEmit` 与 `npx wrangler deploy --dry-run`（441.68 KiB / gzip 94.99 KiB）通过。
- 注意：`queries.ts` 的读回退链尚未接线，当前读仍全走 D1；`DB_QUERY_ORDER` 在读接线完成前
  不影响读路径。写时增量推已独立生效，与读回退链无依赖关系。

---

## 四、合规义务履行声明

1. 本仓库为上游 GPL 授权项目的 **fork / 派生修改版**，已在 LICENSE、NOTICE、
   本文件三处明确「来源 + 基线 + 修改明细」，满足「修改明确告知」。
2. 完整对应源码在本仓库公开提供（GitHub 公开仓库），满足 GPL-3.0
   第 4/5/6 条「提供源码」义务。
3. 任何再分发/再修改须保留本 LICENSE、NOTICE、MODIFICATIONS.md，并继续以
   GPL-3.0 条款发布。
4. 软件按 GPL-3.0 第 11/12 条「无担保」条款提供。

---

## 五、AI 使用与 Vibe Coding 声明（AI-Assisted Development Notice）

> 依 GPL-3.0「再分发/修改明确告知」精神并经维护者确认：
> **本仓库相对上游的全部修改，均以 Vibe Coding（AI 辅助编码）流程生成**，
> 特此披露 AI 使用相关信息，供接收者核验与追溯。

### 1. 修改生成方式（Vibe Coding）
本 fork 的每一处功能、安全、迁移与合规改动，均由「人类维护者 + AI 辅助代理」
的 **Vibe Coding** 协作流程逐轮产生——
1. 维护者在仓库工作区给出**意图 / 需求提示**（如「多 CF 账户支持」「修复验证死锁」、
   「安全加固」「加入 0006 索引迁移」）。
2. **AI 辅助代理**据此读取现有源码，生成并自动写入**代码、SQL 迁移、前端脚本、
   配置文件与合规文档**，并在同轮内持续审查、修正与验证
   （`npx tsc --noEmit`、`npx wrangler deploy --dry-run` 等）。
3. 维护者**复核确认后**手动执行 `git commit` 与线上部署。

即：所有生成内容（源码、`migrations/*.sql`、`wrangler.toml`、`MODIFICATIONS.md`
等）即本仓库的实际内容，不存在另存的“AI 私有成果”。

### 2. AI 使用相关信息
| 项 | 值 |
|---|---|
| 开发/代理框架 | **QwenPaw**（AgentScope 团队 / Qwen lab 开源的 agent 框架，MIT 许可） |
| 生成所用大模型 | **deepseek-ai/DeepSeek-V4-Flash**（后台代理服务运行的对话模型） |
| 协作方式 | 后台代理自动读写工作区源码/配置；git 提交与部署由维护者手动执行 |
| 生成覆盖范围 | 2026-09-13 起的功能演化 → 2026-09-14 索引/公告/合规 →
  2026-09-15 安全加固/可观测性（详见「时间节点」表） |
| 可复现性 | 全部改动在公开 git 历史与本文件「修改明细」中可完全定位，无第三方闭源组件 |

### 3. 质量与合规归属
- AI 生成的每批改动均经 `npx tsc --noEmit`、`npx wrangler deploy --dry-run`
  等验证通过后才提交；未引入未知依赖（依赖改动已在 `package.json`/`package-lock.json` 明确）。
- **AI 辅助生成不影响 GPL-3.0 义务**：上述生成内容与人工修改同等落入本仓库、
  同受 GPL-3.0 授权，接收者仍须遵守随附 `LICENSE` / `NOTICE` / 本 `MODIFICATIONS.md`。

—— Fork 维护方（Vibe Coding 演化版）

> 增补（同日）：**MySQL 最高优先级后端**已加入 `provider.ts` 与 `DB_QUERY_ORDER` 合法项
> （`mysql` > `custom-sqlite` > `d1`；缺省 `d1` 现状不变）。MySQL 经 Cloudflare Hyperdrive
> （`env.HYPERDRIVE.connectionString`）接入，`mysqlSelect` 用非字面量动态 import `mysql2`，
> 缺失/连不上自动回退，tsc 不依赖 mysql2 是否安装。选择 MySQL 而非 Mongo：本项目为关系型+SQL，
> 与既有表/迁移/占位符语义一致，可零改写复用。另：`config.getSiteBeian` 萌ICP备现已跳转
> 萌备官方 `https://icp.gov.moe/?keyword=<数字串>`（数字由正则提取、仅数字、防注入，rel=noopener nofollow），
> 与中国ICP在单一 `SITE_BEIAN` 变量下互斥。
