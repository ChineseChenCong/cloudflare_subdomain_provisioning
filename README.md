# SubDomain Hub - Cloudflare Workers 二级域名分发服务

基于 Cloudflare Workers + D1 的二级域名分发系统。用户通过 GitHub 登录后提交子域名申请，经管理员审核通过后即可获得完整的 DNS 记录控制权。

## ✨ 功能特性

### 核心功能
- **GitHub OAuth 登录** — 仅允许 GitHub 用户申请子域名
- **邮箱验证** — GitHub 登录后需验证邮箱，支持邮箱域名白名单
- **多账户支持** — 支持绑定多个 Cloudflare 账户的 API Token（不同域名可绑定到不同账户）
- **多域名分发** — 支持多个主域名在系统中用于分发
- **管理员审核制度** — 申请需管理员审核，支持通过/拒绝（附原因）
- **邮件通知** — 审核结果自动通过邮件通知用户，新申请通知管理员（支持 MailChannels）
- **完整 DNS 控制** — 支持 A、AAAA、CNAME、MX、TXT、SRV、CAA 全类型记录
- **代理开关** — 一键切换 Cloudflare 黄色云朵代理（A/AAAA/CNAME）
- **子域名保护** — 内置 50+ 禁止前缀列表（www、ns1、mc 等）
- **配额管理** — 可配置每用户子域名数量和每子域名 DNS 记录数
- **暗/亮主题** — 自适应主题切换（蓝白色系）
- **可爱动画** — 果冻动效、点击反馈、悬浮动画等精美动效
- **数据加密** — 敏感数据（如 API Token）使用 AES-GCM 加密存储
- **自定义外观** — 支持设置背景图、背景图遮罩、站点 Logo
- **管理员面板** — 待审核队列、全子域名管理、用户列表
- **完全无服务器** — 运行在 Cloudflare Workers 上，零服务器成本

## 🏗️ 技术栈

- **后端**: [Hono](https://hono.dev/) (Cloudflare Workers)
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: 原生 HTML/CSS/JS (内嵌于 Worker)
- **认证**: GitHub OAuth + JWT + 邮箱验证
- **加密**: AES-GCM 256位加密
- **DNS 管理**: Cloudflare API

## 📦 项目结构

```
├── wrangler.toml              # Workers 配置
├── .dev.vars.example          # 环境变量示例
├── migrations/
│   ├── 0001_init.sql          # D1 数据库初始迁移
│   ├── 0002_add_review.sql    # 审核字段迁移
│   └── 0003_multi_account_encryption.sql  # 多账户、加密、邮箱验证
├── src/
│   ├── index.ts               # 主入口
│   ├── types.ts               # TypeScript 类型
│   ├── config.ts              # 配置解析 (Zone ID 自动解析)
│   ├── middleware/
│   │   └── auth.ts            # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.ts            # GitHub OAuth 路由
│   │   ├── api.ts             # REST API 路由 (含审核接口)
│   │   ├── accounts.ts        # Cloudflare 账户管理 API
│   │   ├── verification.ts    # 邮箱验证 API
│   │   ├── proxied.ts         # 代理开关 API
│   │   └── pages.ts           # 前端页面 (含管理面板)
│   ├── services/
│   │   ├── github.ts          # GitHub API 服务
│   │   ├── cloudflare.ts      # Cloudflare DNS API 服务
│   │   ├── cloudflare-accounts.ts  # 多账户管理
│   │   ├── email.ts           # 邮件通知服务
│   │   ├── email-verification.ts   # 邮箱验证服务
│   │   └── crypto.ts          # 加密工具
│   └── db/
│       └── queries.ts         # D1 数据库查询
└── package.json
```

## 🚀 部署步骤

### 1. 前置准备

- [Cloudflare 账号](https://dash.cloudflare.com/)
- 已托管在 Cloudflare 的域名
- [GitHub OAuth App](https://github.com/settings/developers)
- Node.js 18+

### 2. 克隆并安装依赖

```bash
git clone <repo-url>
cd cloudflare_subdomain_provisioning
npm install
```

### 3. 创建 GitHub OAuth App

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写信息:
   - **Application name**: SubDomain Hub
   - **Homepage URL**: `https://your-worker-domain.workers.dev`
   - **Authorization callback URL**: `https://your-worker-domain.workers.dev/auth/github/callback`
4. 记下 `Client ID` 和 `Client Secret`

### 4. Cloudflare API Token 配置

本系统支持两种模式：

#### 模式 A：全局 Token（向后兼容）
如果所有域名都在同一个 Cloudflare 账户下，可以继续使用全局 `CF_API_TOKEN`。

1. 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 创建自定义 Token:
   - **权限**: Zone > DNS > Edit **和** Zone > Zone > Read
   - **区域资源**: 选择对应的域名（或所有域名）
3. 记下 API Token

> ⚠️ 需要 **Zone > Zone > Read** 权限用于自动解析域名的 Zone ID

#### 模式 B：多账户绑定（推荐）
如果域名分布在多个 Cloudflare 账户下，可以：
1. **不设置** 全局 `CF_API_TOKEN`（或仅用于默认解析）
2. 在系统中为每个账户**单独绑定** API Token（支持不同域名绑定到不同账户）
3. 系统会自动从用户绑定的账户列表中解析 Zone ID

**优势**：
- 不同域名可以使用不同 Cloudflare 账户的 API Token
- 避免单点故障，提高可用性
- 更细粒度的权限控制

### 5. 创建 D1 数据库

```bash
npx wrangler d1 create subdomain-db
```

将返回的 `database_id` 填入 `wrangler.toml`。

### 6. 运行数据库迁移

```bash
# 本地开发
npm run db:migrate:local

# 远程（部署后）
npm run db:migrate:remote
```

### 7. 配置环境变量

复制示例文件：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_SECRET=随机生成的32位以上字符串
CF_API_TOKEN=your_cloudflare_api_token  # 可选，多账户模式可留空
DOMAINS=example.com,example.org
ADMIN_USERS=your_github_username
ENCRYPTION_KEY=随机生成的32位以上字符串（用于加密敏感数据）
EMAIL_VERIFICATION_REQUIRED=true
ALLOWED_EMAIL_DOMAINS=gmail.com,outlook.com,qq.com,163.com
```

**DOMAINS 格式说明**:
- 单域名: `example.com`
- 多域名: `example.com,example.org,example.net`
- Zone ID 将通过 Cloudflare API **自动解析**，无需手动填写

**多账户模式说明**:
- 如果使用多账户绑定模式，可以**不设置** `CF_API_TOKEN`
- 系统会优先使用用户绑定的账户 API Token 来解析 Zone ID 和操作 DNS
- 每个用户可以绑定多个账户，不同域名可以绑定到不同账户

**邮件通知 (可选)**:
```env
# 外部 SMTP（推荐）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_password
SMTP_FROM=noreply@example.com
SMTP_FROM_NAME=SubDomain Hub
```
不配置 SMTP 时将使用 MailChannels（Cloudflare Workers 原生免费邮件服务）。

## 📧 MailChannels 邮件服务说明

### 配置方式
- 如果未配置 SMTP，系统会自动使用 MailChannels（Cloudflare Workers 原生邮件服务）
- 无需额外配置，直接通过 Cloudflare 网络发送邮件
- 在 `wrangler.toml` 中配置 `mail_routes` 绑定：

```toml
[[mail_routes]]
  name = "mail"
  destination = "your-verification@yourdomain.com"
```

### 限制与注意事项
1. **发送频率限制** — 免费版约 100 封/天（官方未明确公开，建议控制发送量）
2. **收件人限制** — 只能发送到已验证的域名（需要在 Cloudflare 上托管）
3. **内容限制** — 避免被标记为垃圾邮件，建议：
   - 使用清晰的发件人名称和地址
   - 避免大量收件人（建议单封邮件最多 10-20 个收件人）
   - 避免使用敏感词和垃圾邮件常见关键词
4. **DKIM/SPF** — 确保域名已配置正确的 DNS 记录（DKIM、SPF、DMARC）
5. **退回处理** — 建议监控退回（bounce）率，过高可能导致发送限制

### 推荐配置
```toml
# wrangler.toml
[[mail_routes]]
  name = "mail"
  destination = "noreply@yourdomain.com"
```

邮件服务中 `from` 地址建议使用 `noreply@yourdomain.com` 或 `subdomain@yourdomain.com`。

### 如果邮件发送失败
1. 检查域名是否已正确配置 Mail DNS 记录
2. 检查发件人地址是否与 `mail_routes` 配置匹配
3. 考虑配置外部 SMTP（如 SendGrid、Mailgun）以获得更高的发送限制和更好的投递率

### 8. 本地开发

```bash
npm run dev
```

访问 `http://localhost:8787`

### 9. 部署到 Cloudflare

```bash
# 设置 Secrets（生产环境）
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put CF_API_TOKEN  # 多账户模式可留空
npx wrangler secret put DOMAINS
npx wrangler secret put ADMIN_USERS
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put EMAIL_VERIFICATION_REQUIRED
npx wrangler secret put ALLOWED_EMAIL_DOMAINS

# 可选: 设置 SMTP Secrets
npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASS
npx wrangler secret put SMTP_FROM
npx wrangler secret put SMTP_FROM_NAME

# 可选: 设置站点外观 Secrets
npx wrangler secret put SITE_NAME
npx wrangler secret put SITE_BACKGROUND_IMAGE
npx wrangler secret put SITE_BACKGROUND_OVERLAY
npx wrangler secret put SITE_LOGO

# 部署
npm run deploy

# 远程数据库迁移
npm run db:migrate:remote
```

## 🔄 部署前品牌替换清单（Rebrand Checklist）

> 本项目为上游 `Little100/cloudflare_subdomain_provisioning` 的 GPL-3.0 派生修改版
> （详见仓库根目录 `NOTICE` / `MODIFICATIONS.md`）。GPL-3.0 **不要求**衍生部署方
> 沿用原项目或其维护方的名称、域名、Logo 或友情链接；为了**不对原项目/原作者造成
> 误导或冒充、也不会让访客误以为本部署与原维护方有关**，请在正式对外部署前，
> **务必把下列所有“可辨识原项目品牌”的默认项替换为你自己的内容**：

| # | 替换项 | 位置 | 说明 |
|---|--------|------|------|
| 1 | 站点名称 | `wrangler.toml [vars]` → `SITE_NAME` | 替换为自有站名（默认 `SubDomain Hub`） |
| 2 | 站点头像/Logo | `wrangler.toml [vars]` → `SITE_LOGO` | 替换为自有 Logo（favicon 亦复用它） |
| 3 | 备案号 | `wrangler.toml [vars]` → `SITE_BEIAN` | 默认注释示例 `浙ICP备…`，替换或删除 |
| 4 | 友情链接 | `wrangler.toml [vars]` → `FRIEND_LINKS` | JSON 数组**全部**替换为自有站点（默认里含原维护方示例友链） |
| 5 | 邮箱域名白名单 | `wrangler.toml [vars]` → `ALLOWED_EMAIL_DOMAINS` | 换成部署者自己的允许邮箱域（默认含原维护方自有邮箱域） |
| 6 | 分发主域 | `DOMAINS`（Secret） | 换成自有主域，勿沿用原维护方域名 |
| 7 | 欢迎/默认公告文案 | `migrations/0004_*.sql`（含 `SubDomain Hub` 欢迎语） | 改成自有文案 |
| 8 | 页面标题/页脚文字 | 由 `SITE_NAME` / `SITE_BEIAN` 渲染 | 若页面仍显示 `SubDomain Hub` 说明变量未被覆盖 |
| 9 | 邮件发件人 | `SMTP_FROM_NAME`（Secret） | 换为自有发件人名称 |
| 10 | 联系管理员邮箱 | `ADMIN_CONTACT_EMAIL`（Secret） | 换为自有邮箱 |
| 11 | 本地示例变量 | `.dev.vars.example` | 校验其中的示例域名/邮箱是否仍带原项目品牌 |
| 12 | 仓库顶部文档 | 本 `README.md` 顶部标题与示例 | 部署方 fork 后可改写为自有标题与示例 |

**合规说明：**
- 上述替换**不受 GPL-3.0 强制**，是出于"避免冒充原项目/尊重原项目品牌"的合理工程建议，
  而非许可证义务；替换品牌不影响本项目以 GPL-3.0 再分发/再修改的合法性。
- **必须保留**（GPL-3.0 §5/§4 义务，不可删除）：随附 `LICENSE`、`NOTICE`、
  `MODIFICATIONS.md`，其中对**上游作者 `Little100` 及上游仓库网址**的著作权/来源告知
  必须保留；可在其中将"fork 维护方署名、品牌名、自有域名"替换为部署者自身内容。

## ⚙️ 配置说明

### 环境变量 (wrangler.toml [vars])

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BANNED_PREFIXES` | 禁止使用的子域名前缀 | `www,ns1,ns2,...` |
| `MAX_SUBDOMAINS_PER_USER` | 每用户最多子域名数 | `5` |
| `MAX_RECORDS_PER_SUBDOMAIN` | 每子域名最多 DNS 记录数 | `1000` |
| `DNS_LIVE_READ` | DNS 记录读取来源：`true`/`1` 时优先从 Cloudflare 实时查（省 D1 读额度），CF 失败自动回退 D1 | `true` |
| `EMAIL_DAILY_EMAIL_LIMIT` | 每用户每日邮件发送上限 | `5` |
| `OWNER_APPROVAL_DEADLINE_HOURS` | 层级审批超时小时，超时自动驳回 | `72` |
| `SITE_NAME` | 站点名称 | `SubDomain Hub` |
| `SITE_BACKGROUND_IMAGE` | 站点背景图 URL（支持任意图片链接） | 无 |
| `SITE_BACKGROUND_OVERLAY` | 背景图遮罩颜色（hex 或 rgba） | `rgba(15, 23, 42, 0.7)` |
| `SITE_LOGO` | 站点 Logo URL（建议 36x36px 透明 PNG，未配置使用内置默认萌系 Logo） | 内置默认 Logo |
| `SITE_BEIAN` | 底部备案信息（虚拟备案项目，如 `浙ICP备12345678号-1`；未配置则不显示） | 空=不显示 |
| `FRIEND_LINKS` | 友情链接（JSON 数组，如 `[{"name":"博客","url":"https://..."}]`） | 空=不显示 |
| `ADMIN_CONTACT_EMAIL` | 联系管理员邮箱（配置后底部显示"联系管理员"按钮，邮件联系） | 空=不显示 |
| `EMAIL_VERIFICATION_REQUIRED` | 是否要求邮箱验证 | `true` |
| `ALLOWED_EMAIL_DOMAINS` | 允许的邮箱域名白名单（逗号分隔） | 空=不限制 |

### Secrets (需通过 wrangler secret 设置)

| 变量 | 说明 |
|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `JWT_SECRET` | JWT 签名密钥 |
| `CF_API_TOKEN` | Cloudflare API Token |
| `DOMAINS` | 域名列表（逗号分隔，Zone ID 自动解析） |
| `ADMIN_USERS` | 管理员 GitHub 用户名 |
| `ENCRYPTION_KEY` | 加密密钥（用于加密敏感数据） |
| `EMAIL_VERIFICATION_REQUIRED` | 是否要求邮箱验证 |
| `ALLOWED_EMAIL_DOMAINS` | 允许的邮箱域名白名单 |
| `SMTP_HOST` | SMTP 服务器地址（可选）|
| `SMTP_PORT` | SMTP 端口（可选）|
| `SMTP_USER` | SMTP 用户名（可选）|
| `SMTP_PASS` | SMTP 密码（可选）|
| `SMTP_FROM` | 发件人邮箱（可选）|
| `SMTP_FROM_NAME` | 发件人名称（可选）|

## 📡 API 文档

所有 API 路径以 `/api` 开头，需要 Cookie 认证（登录后自动获取）。

### 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/me` | 获取当前用户信息 |
| GET | `/api/domains` | 获取可用域名列表及配置 |

### 子域名

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subdomains` | 获取用户子域名列表 |
| POST | `/api/subdomains` | 申请新子域名 |
| DELETE | `/api/subdomains/:id` | 删除子域名（含全部 DNS 记录）|

### DNS 记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subdomains/:id/records` | 获取子域名 DNS 记录 |
| POST | `/api/subdomains/:id/records` | 创建 DNS 记录 |
| PUT | `/api/subdomains/:id/records/:recordId` | 更新 DNS 记录 |
| DELETE | `/api/subdomains/:id/records/:recordId` | 删除 DNS 记录 |

### 代理开关（黄色云朵）

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/proxied/records/:recordId/proxied` | 切换单个 DNS 记录的代理状态 |
| PUT | `/api/proxied/subdomains/:subdomainId/records/proxied` | 批量切换子域名下记录的代理状态 |

请求体：
```json
{ "proxied": true }
```

### Cloudflare 账户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/accounts` | 获取用户的 Cloudflare 账户列表 |
| GET | `/api/accounts/default` | 获取默认账户 |
| POST | `/api/accounts` | 创建新账户 |
| PUT | `/api/accounts/:id` | 更新账户 |
| DELETE | `/api/accounts/:id` | 删除账户 |
| POST | `/api/accounts/verify-token` | 验证 API Token 有效性 |

请求示例：
```json
POST /api/accounts
{
  "account_name": "主账户",
  "api_token": "your_api_token",
  "zone_id": "optional_zone_id"
}
```

### 邮箱验证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/verification/config` | 获取邮箱验证配置 |
| GET | `/api/verification/status` | 获取当前用户邮箱验证状态 |
| POST | `/api/verification/send` | 发送验证邮件 |
| GET | `/api/verification/confirm?token=xxx` | 验证邮箱 |
| POST | `/api/verification/check-domain` | 检查邮箱域名是否允许 |

### 管理员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/pending` | 获取待审核的子域名 |
| POST | `/api/admin/subdomains/:id/approve` | 审核通过子域名 |
| POST | `/api/admin/subdomains/:id/reject` | 拒绝子域名（需 reason）|
| GET | `/api/admin/subdomains` | 获取所有子域名 |
| GET | `/api/admin/users` | 获取所有用户 |
| DELETE | `/api/admin/subdomains/:id` | 强制删除子域名 |

### 请求示例

**申请子域名:**
```json
POST /api/subdomains
{
  "subdomain": "myname",
  "domain": "example.com"
}
// 返回: { "message": "申请已提交，等待管理员审核", "subdomain": {...} }
```

**审核通过:**
```json
POST /api/admin/subdomains/1/approve
{}
```

**拒绝申请:**
```json
POST /api/admin/subdomains/1/reject
{
  "reason": "子域名涉及商标侵权"
}
```

**创建 DNS 记录 (需子域名已通过审核):**
```json
POST /api/subdomains/1/records
{
  "type": "A",
  "name": "@",
  "content": "1.2.3.4",
  "ttl": 1,
  "proxied": true
}
```

子名称说明:
- `@` 或留空 → `myname.example.com`
- `www` → `www.myname.example.com`
- `*` → `*.myname.example.com`

## 🔒 安全说明

- 用户只能管理自己的子域名和 DNS 记录
- **审核通过后**才能操作 DNS 记录
- JWT 令牌存储在 HttpOnly + Secure + SameSite Cookie 中
- OAuth State 参数防止 CSRF
- 子域名格式严格校验
- 内置禁止前缀防止滥用
- 敏感数据（API Token）使用 AES-GCM 加密存储
- 支持邮箱验证和邮箱域名白名单
- **多账户绑定** — 支持绑定多个 Cloudflare 账户（不同域名可绑定到不同账户），不再依赖全局 `CF_API_TOKEN`
- **环境变量保护** — 生产环境使用 `wrangler secret` 设置敏感变量，不会覆盖 Cloudflare Dashboard 已存在的环境变量
- **密钥安全** — 已配置 `.gitignore`，确保敏感文件（`.dev.vars`、`wrangler` 目录）不会提交到 Git 仓库

## 📋 审核流程

1. 用户通过 GitHub 登录
2. **邮箱验证**（如启用）— 用户需验证邮箱地址
3. 用户提交子域名申请 → 状态为 `pending`
4. 管理员收到邮件通知
5. 管理员在管理面板审核：
   - ✅ **通过** → 用户收到邮件通知，可开始管理 DNS
   - ❌ **拒绝** → 用户收到邮件通知（含拒绝原因）
6. 被拒绝的用户可删除后重新申请

## 🎨 UI 特性

- **蓝白色系** — 现代化、清新的视觉风格
- **玻璃态设计** — 毛玻璃效果 Header
- **果冻动画** — 按钮点击时的弹性动画
- **点击反馈** — 波纹效果和缩放动画
- **悬浮效果** — 卡片和按钮的悬浮动画
- **渐变色彩** — 彩色渐变 Logo 和按钮
- **响应式布局** — 完美适配移动端
## 🧩 完整功能清单（已实现但文档未完整覆盖）

- **层级子域名所有权审批**
  - 支持 `a.b` / `a.b.c` 多级 label 格式，前后端正则已放开。
  - 申请时递归检查祖先链是否已被拥有：链上任一层已有 DNS 配置即 `occupied-chain` 阻止申请。
  - 若最近被拥有的祖先非申请人本人，自动创建 `owner_approvals` 待审批请求，邮件通知上级所有者，带同意/驳回链接。
  - 超时自动驳回，超时时长由 `OWNER_APPROVAL_DEADLINE_HOURS` 控制，默认 72 小时。
  - 前端审批面板分三区：`待我处理` / `我发起的` / `已处理`，各区独立分页，每页 5/10/20/50。
  - 删除已审批给他人的子域时，后端自动将对应审批记录 `status` 置 `deleted`，前端已处理区自动折叠隐藏，并邮件通知二级域名持有人。

- **列表分页与筛选**
  - 子域名列表分页 `subPager`，DNS 记录分页 `dnsPager`，每页可选 5/10/20/50，带 « ‹ › » 控件。
  - DNS 记录顶部类型筛选 `dnsTypeFilter`：全部 / A / AAAA / CNAME / MX / TXT / SRV / CAA，显示当前 N/M 条计数。

- **审批面板 UI 优化**
  - `已处理` 记录折入底部 `<details>` 折叠区，避免主区无限拉长。
  - 已处理区过滤 `status==='deleted'`，删除联动后自动消失。
  - 蓝白色系、果冻动画、系统字体栈，与站点主题一致。

- **DNS 记录操作可靠性修复**
  - 前端 `onclick` 参数全部字符串化，避免 CF hex id 被当 JS 标识符导致 `ReferenceError`。
  - 后端 `locateDnsRecord` 双路定位：CF hex id 查 `cf_record_id`，数字 id 查主键。
  - `proxied` 切换路由改为 `/records/:subdomainId/:recordId/proxied`，传入子域 id 后双路定位。
  - 移除全表 `getDnsRecordEntryByCfId`，改为子域约束索引查询，减少 D1 `rows-read` 消耗。

- **静态资源与外链安全**
  - CSS 完全静态化为 `/static/app.css`，`Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` + `nosniff`，命中 CF 边缘 CDN 后不触发 Worker。
  - Logo / 背景图不再输出真实外链，改为固定端点 `/logo`、`/bg`，真实 URL 仅存服务端 env，源码中不再暴露源站域名。
  - 头像走 GitHub 直连，避免占用 `/assets` 额度。
  - `/assets` 白名单仅 `sukicdn.com`，防 SSRF，复用限流与缓存头。

- **公告系统增强**
  - 置顶公告直出全文，普通公告轮播 5s 自动切换 + 圆点手动切换。
  - 普通公告默认 3 行缩略，可展开/收起全文。
  - 管理端支持 `sort_order` 与 `is_pinned`，保存后本地就地更新保持滚动位置。
  - 删除后 `sort_order` 紧凑重排，仅动展示列，不改主键。

- **ICP 备案自动识别**
  - 单变量 `SITE_BEIAN` 自动识别：含「萌」→ 萌ICP备 外链；含 `ICP备/ICP证` 且不含「萌」→ 工信部链接；其他仅文本展示。互斥只启一个，HTML 转义防 XSS。

- **可观测性与安全响应头**
  - 全局响应头：`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Strict-Transport-Security: max-age=31536000; includeSubDomains`。
  - CORS 收紧为同源回显，跨源自动拒绝。
  - CSRF 二道防线：写方法校验 Origin/Referer 同源，跨源 403。
  - 写操作统一输出 `[audit]` 日志到控制台，配合 `[observability.logs]` 100% 采样持久化。
  - `/api/verification/send` 发邮件限流：每 IP 每分钟 5 次，叠加每用户每日 5 封。

## ⚙️ 完整可配置变量

### wrangler.toml [vars] 完整清单
| 变量 | 说明 | 示例默认值 |
|------|------|------------|
| `BANNED_PREFIXES` | 禁止子域名前缀 | `www,ns1,...` |
| `MAX_SUBDOMAINS_PER_USER` | 每用户最多子域名数 | `5` |
| `MAX_RECORDS_PER_SUBDOMAIN` | 每子域名最多 DNS 记录数 | `1000` |
| `DNS_LIVE_READ` | DNS 读优先走 CF 实时，失败回退 D1 | `true` |
| `EMAIL_DAILY_EMAIL_LIMIT` | 每用户每日邮件上限 | `5` |
| `OWNER_APPROVAL_DEADLINE_HOURS` | 层级审批超时小时 | `72` |
| `SITE_NAME` | 站点名称 | `SubDomain Hub` |
| `SITE_LOGO` | Logo URL | 空=内置 |
| `SITE_BACKGROUND_IMAGE` | 背景图 URL | 空 |
| `SITE_BACKGROUND_OVERLAY` | 背景遮罩 | `rgba(15,23,42,0.7)` |
| `SITE_BEIAN` | 备案号，自动识别萌备/工信部 | 空=不显示 |
| `ADMIN_CONTACT_EMAIL` | 联系管理员邮箱 | `admin@example.com` |
| `FRIEND_LINKS` | 友情链接 JSON 数组 | `[]` |
| `EMAIL_VERIFICATION_REQUIRED` | 是否强制邮箱验证 | `true` |
| `ALLOWED_EMAIL_DOMAINS` | 邮箱白名单 | `example.com` |
| `DB_QUERY_ORDER` | 读后端优先级：`mysql,custom-sqlite,d1` | `d1` |
| `DB_ADMIN_ALERT_EMAIL` | 后端异常告警邮箱 | 空=复用 ADMIN_CONTACT_EMAIL |

> 自定义 SQLite / S3 / MySQL 相关变量为可选，非机密普通变量，详见 `STORAGE.md`。

### Secrets 建议
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `JWT_SECRET` / `ENCRYPTION_KEY`
- `CF_API_TOKEN` / `DOMAINS` / `ADMIN_USERS`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_FROM_NAME`
- `RESEND_API_KEY` / `CUSTOM_SQLITE_TOKEN` 等

## 🏗️ 存储与同步架构要点

- **读回退链**：`DB_QUERY_ORDER` 决定 `mysql` → `custom-sqlite` → `d1` 优先级，健康探测失败自动回退，异常邮件告警 `DB_ADMIN_ALERT_EMAIL`。
- **写时增量推**：D1 为唯一写主，写入成功后立即 `mirrorSyncRow` 单行 reconcile 到镜像后端，best-effort 不阻塞请求。
- **日级自愈**：`[triggers] crons = ["0 0 * * *"]` 每天 UTC 0 点全量 `syncD1ToMirrors`，仅兜底冷对齐。
- **S3/R2** 仅作整库快照灾备，不作为实时 SQL 后端。
- **首次迁移**：`npm run db:export` → 导入目标 → 再接 read-through，顺序不可反。

## 🔒 安全与运维承诺

- JWT 含 `exp`，Cookie `HttpOnly + Secure + SameSite=Lax`。
- OAuth `state` 防 CSRF，邮箱验证 token 24h 过期。
- 全站 `escapeHtml` 覆盖，前端内联脚本经 Hono 反引号转义验证，`\\'` 双反斜杠规范。
- 无行内 `<style>`，CSS 静态化 immutable 缓存，改样式需改路径加版本号。
- `wrangler` 4.x 可观测性日志/跟踪 100% 采样持久化，审计日志不含隐私数据。
- D1 额度保护：迁移只跑未应用文件、DDL 离线执行、无整库快照进请求路径。


## 📄 License

GPLv3 License
