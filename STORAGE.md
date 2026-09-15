# STORAGE.md — 存储与分发架构（CDN / DNS 读取 / 数据库后端链）

> 目标：**在“不影响正常使用与可靠性”的前提下，用 Cloudflare 边缘能力分担查询与分发、\n> 节省 D1 额度、加速用户访问**，并在数据库后端异常时自动降级 + 邮件告警管理。\n> 本文档是设计与契约；标「✅ 已落地」的为已实现，其余为评审后实施。

---

## 一、CDN 分发与边缘缓存（✅ 已落地）

沿用既有方案，已在 `/assets` 代理上做边缘 CDN 缓存：

| 资源 | 分发方式 | 说明 |
|---|---|---|
| 站点 Logo / 背景 / favicon | 本域 `/assets` 代理 + `Cache-Control: public, max-age=86400, s-maxage=86400` | 首请求后命中 CF 边缘缓存，**不触发 Worker、不耗出站** |
| favicon | `/favicon.ico` 端点返回 `SITE_LOGO`，`image/x-icon` + 边缘缓存 | 极简浏览器也可用 |
| 头像 | GitHub 直连（公共公开域名，量大） | 避免吃 `/assets` 额度 |

`ALLOWED_ASSET_HOSTS` 仅 `sukicdn.com`，协议限 http(s) 防 SSRF；复用 `rateLimit`。\nHTML 不再残留外链源站域名，源站仅接 Worker 回源、不直接暴露。

---

## 二、DNS 记录读取来源（✅ 已落地：CF 实时为主，D1 兜底）

**此前**：`GET /api/subdomains/:id/records` 一律 `SELECT * FROM dns_records`（DB 读）。

**现状改造**：新增 `DNS_LIVE_READ=true`（`wrangler.toml [vars]`），开启后：

- 读取优先走 **Cloudflare API 实时查**（`listAllZoneRecords` 分页拉该 Zone 全量，\n  在代码内按「名称 == 子域名FQDN 或以 `.FQDN` 结尾」过滤，避免 CF `name` 参数的不精确匹配）。
- 返回记录 `id` 即 **CF 记录 id**；PUT/DELETE 改为按 `cf_record_id` 反查定位\n  （`getDnsRecordByCfId`），写路径更新 DB（审计/状态），**读路径几乎不再读 D1**。
- **任何 CF 查询失败 → 自动回退 D1 全量读取**（旧行为），可靠、无中断。
- 未配置或关闭时完全维持旧行为（向后兼容）。默认 `DNS_LIVE_READ=true`。

要点：D1 仍保有 `dns_records` 作为**写入/审计/兜底**；高频读取从 DB 挪到 CF，显著省读额度。\n> 说明：CF `per_page` 上限 100，已加页数安全上限（最多 2000 条）防死循环。

---

## 三、数据库后端链：自定义 SQLite → S3 → D1（设计 + 契约）

> ⚠️ **S3 技术修正**：S3 / R2 是**对象存储**，**不是可查询的 SQL 数据库**，\n> 无法像 D1/自定义 SQLite 那样执行 `SELECT`。因此“S3 作为活动查询后端”并不可行。\n> 合理角色划分（已在“确保数据安全”目标下自洽）：
>
> - **活动查询后端（可执行 SQL）**：**MySQL（Hyperdrive）** → **自定义 SQLite**（Turso/libsql over HTTP）→ 后备 **D1**（缺省 `d1`=现状不变）。
> - **S3 / R2**：作为**持久化快照/灾备副本**（把主库整库快照上传，用于冷备份/恢复），\n>   不承担实时查询。这让“尽量别用 D1 额度、保证数据安全”同时成立。

### 启用顺序（环境变量驱动，缺省即保持现状=纯 D1）

| 变量 | 说明 | 缺省 |
|---|---|---|
| `DB_QUERY_ORDER` | 逗号分隔的活动查询后端，越靠前越优先。合法项：`mysql`、`custom-sqlite`、`d1`。示例 `mysql,custom-sqlite,d1` | `d1`（现状不变） |
| `CUSTOM_SQLITE_URL` | 自定义 SQLite（Turso/libsql）HTTP 接入地址，形如 `https://<org>-<db>.turso.io` | 空 |
| `CUSTOM_SQLITE_TOKEN` | 访问该 SQLite 的 Bearer Token | 空 |
| `CUSTOM_SQLITE_JWT` | （可选）Turso JWT 授权串 | 空 |
| `S3_BACKUP_BUCKET` | 快照灾备桶名（CF R2 桶 或 自定义 S3） | 空=不启用 |
| `S3_ENDPOINT` | S3 兼容端点（用 CF R2 时可不填） | 空 |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 自定义 S3 凭据（CF R2 可用绑定代替，不落环境变量） | 空 |
| `DB_ADMIN_ALERT_EMAIL` | 后端异常时管理告警收件箱 | 复用 `ADMIN_CONTACT_EMAIL` |

### 行为契约

1. **健康探测与选路**：进程冷启动/首次查询时按 `DB_QUERY_ORDER` 依序对各后端做轻量健康检查\n   （如 `SELECT 1` 或读 `system_settings`），选第一个健康者作为本次活动后端。
2. **自动故障转移**：活动后端单次执行异常 → 立即按序回退下一个健康后端，并把该事件\n   **邮件告警**给 `DB_ADMIN_ALERT_EMAIL`（可复用既有 `services/email.ts` 发送通道），\n   经 `[audit]` 日志留痕；回退全程对用户不可见、不中断。
3. **一次性回填（首次读取同步）**：若新后端**无数据**而 D1 **已有数据**，\n   在第一次读取时执行**一次性全量同步**（把 D1 各表迁移到目标后端），完成后在\n   `system_settings` 写入 `storage_backfill_done=1` 标记；此后**不再查询/同步到 D1**，\n   避免持续占用 D1 额度。回填失败则停在 D1（安全态）并告警，绝不半迁移。
4. **数据安全**：仅在“目标空 + D1 有数据”时回填；绝不双写制造不一致；\n   故障回退**只读不做破坏性写**；S3 侧仅做整库快照，不承载活动读。

> 状态：本设计已定稿（含 S3 ≠ 数据库的修正、顺序、回填、故障转移、告警与全部环境变量）。\n> **实施为独立 commit**：新增 `src/db/provider.ts`（按 `DB_QUERY_ORDER` 选路 + 健康检查 +\n> 回填标记 + 故障转移 + 告警），把 `queries.ts` 的 DB 入口统一走 provider，\n> 自定义 SQLite/自定义 S3 客户端按上述环境变量接入。D1 仍为缺省与最终兜底。

---

## 四、优先级与风险评估

- 改动均**默认关闭或保持现状**（`DB_QUERY_ORDER=d1` 时与现在完全等价），**不回退既有功能**。
- 高风险项（S3 快照客户端、远程 SQLite 客户端、provider 全量接线）独立提交并在\n  `npx tsc --noEmit` + `npx wrangler deploy --dry-run` 通过后再上线，避免破坏线上。

---

## 增补（2026-09-15）：MySQL 最高优先后端 + 实施状态更新

**1) MySQL 作为最高优先活动后端（优先于自定义 SQLite）**
- 选择 **MySQL 而非 MongoDB**：本项目是关系型 + SQL 体系（D1/custom-sqlite 均可用相同 `SELECT/INSERT`），
  MySQL 与既有表结构/迁移/占位符(`?`)语义完全一致，可零改写复用；Mongo 是文档模型，需重写查询层与迁移，代价高。
- Worker 无法原生建 TCP → MySQL 通过 **Cloudflare Hyperdrive**（连接池 + 内网安全通道）接入。
  `wrangler.toml` 配置：
  ```toml
  [[hyperdrive]]
  binding = "HYPERDRIVE"
  id = "<hyperdrive-id>"
  ```
  在 CF 控制台 Hyperdrive 页填入 MySQL 访问信息（host/port/user/pass/db）生成连接串。
  运行时代码经 `env.HYPERDRIVE.connectionString`（`mysql://user:pass@host:port/db`）。
- 启用顺序：`DB_QUERY_ORDER="mysql,custom-sqlite,d1"` → 健康探测先查 MySQL，其次 SQLite，最后 D1。
  MySQL 未配置(Hyperdrive 缺失）/连不上 → 自动回退下一后端。
- `provider.ts` 已实现 `mysqlSelect`（非字面量动态 import `mysql2`，缺依赖不阻塞 tsc，运行时缺失自动回退）。
  启用 MySQL 需在部署侧 `npm install mysql2`（当前因 wrangler 4 / workers-types ^4↔^5 的 peer 冲突未装入，
  升级需谨慎，见风险）。

**2) 自定义 SQLite 配置与接线**
- 变量：`CUSTOM_SQLITE_URL`（Turso/libsql HTTP，形如 `https://<org>-<db>.turso.io`）、
  `CUSTOM_SQLITE_TOKEN`（Bearer，建议转 Secret）、`CUSTOM_SQLITE_JWT`（可选）。
- 需预先按 0001→0007 同一套 schema 建好表 `users/subdomains/dns_records/cloudflare_accounts/announcements/friend_links/system_settings/owner_approvals/user_email_verifications/email_send_log`，
  并在 `system_settings` 记录 `storage_backfill_done=1`（否则首次读取触发 D1→目标 一次性回填）。

**3) 实施状态**
- `provider.ts`（选路+健康探测+sqlite/mysql 客户端+S3 SigV4 快照）**已落地且默认关闭**（`DB_QUERY_ORDER` 缺省 `d1` = 现状等价）。
- **仍未做**：把 `queries.ts` 的 DB 入口**逐查询**统一走 provider 读回退链（生产接线）。此接线为独立 commit，
  需 `tsc --noEmit` + `wrangler deploy --dry-run` 通过后再上线。
