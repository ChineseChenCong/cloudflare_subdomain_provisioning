# SubDomain Hub - Cloudflare Workers 二级域名分发服务

基于 Cloudflare Workers + D1 的二级域名分发系统。用户通过 GitHub 登录后提交子域名申请，经管理员审核通过后即可获得完整的 DNS 记录控制权。

## ✨ 功能特性

### 核心功能
- **GitHub OAuth 登录** — 仅允许 GitHub 用户申请子域名
- **邮箱验证** — GitHub 登录后需验证邮箱，支持邮箱域名白名单
- **多账户支持** — 支持绑定多个 Cloudflare 账户的 API Token
- **多域名分发** — 支持多个主域名在系统中用于分发
- **管理员审核制度** — 申请需管理员审核，支持通过/拒绝（附原因）
- **邮件通知** — 审核结果自动通过邮件通知用户，新申请通知管理员
- **完整 DNS 控制** — 支持 A、AAAA、CNAME、MX、TXT、SRV、CAA 全类型记录
- **代理开关** — 一键切换 Cloudflare 黄色云朵代理（A/AAAA/CNAME）
- **子域名保护** — 内置 50+ 禁止前缀列表（www、ns1、mc 等）
- **配额管理** — 可配置每用户子域名数量和每子域名 DNS 记录数
- **暗/亮主题** — 自适应主题切换（蓝白色系）
- **可爱动画** — 果冻动效、点击反馈、悬浮动画等精美动效
- **数据加密** — 敏感数据（如 API Token）加密存储
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

### 4. 创建 Cloudflare API Token

1. 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 创建自定义 Token:
   - **权限**: Zone > DNS > Edit **和** Zone > Zone > Read
   - **区域资源**: 选择对应的域名（或所有域名）
3. 记下 API Token

> ⚠️ 需要 **Zone > Zone > Read** 权限用于自动解析域名的 Zone ID

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
CF_API_TOKEN=your_cloudflare_api_token
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
npx wrangler secret put CF_API_TOKEN
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

# 部署
npm run deploy

# 远程数据库迁移
npm run db:migrate:remote
```

## ⚙️ 配置说明

### 环境变量 (wrangler.toml [vars])

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BANNED_PREFIXES` | 禁止使用的子域名前缀 | `www,ns1,ns2,...` |
| `MAX_SUBDOMAINS_PER_USER` | 每用户最多子域名数 | `1` |
| `MAX_RECORDS_PER_SUBDOMAIN` | 每子域名最多 DNS 记录数 | `20` |
| `SITE_NAME` | 站点名称 | `SubDomain Hub` |
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
- 支持绑定多个 Cloudflare 账户，分散风险

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

## 📄 License

GPLv3 License
