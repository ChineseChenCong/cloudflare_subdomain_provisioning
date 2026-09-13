# Changelog

## [2.0.0] - 2026-09-13

### 🎉 重大更新

#### ✨ 新功能

**1. Cloudflare 代理开关（黄色云朵）**
- 新增一键切换 DNS 记录代理状态的功能
- 支持 A、AAAA、CNAME 记录的代理开关
- 可视化开关按钮，黄色=已代理，灰色=直接访问
- 支持单个或批量切换

**2. 全新现代化 UI（蓝白色系）**
- 完全重新设计的界面风格
- 清新的蓝白色调配色方案
- 玻璃态（Glassmorphism）设计元素
- 现代化卡片式布局
- 响应式设计，完美适配移动端

**3. 精美动画效果**
- 🍮 果冻动画（Jelly Animation）- 按钮点击效果
- 💧 点击反馈 - 波纹扩散效果
- 🎈 悬浮动画 - 卡片和图标悬浮效果
- 🌊 渐变色彩 - 动态渐变背景
- ✨ 微交互 - 所有可点击元素的精致动效

**4. 数据加密存储**
- 敏感数据（Cloudflare API Token）使用 AES-GCM 256位加密
- `ENCRYPTION_KEY` 环境变量配置加密密钥
- 降级兼容：未配置密钥时自动使用明文（不推荐）

**5. 更高安全性的认证**
- JWT 令牌存储在 HttpOnly + Secure + SameSite Cookie 中
- OAuth State 参数防止 CSRF 攻击
- 邮箱验证机制增强账户安全性
- 邮箱域名白名单控制

**6. 多 Cloudflare 账户支持**
- 支持绑定多个 Cloudflare 账户的 API Token
- 每个账户可独立命名和管理
- 支持设置默认账户
- 支持启用/停用账户
- API Token 加密存储

**7. 多主域名分发**
- 支持配置多个主域名
- 自动解析每个域名的 Zone ID
- 不同域名可绑定不同 Cloudflare 账户

**8. 邮箱验证系统**
- GitHub 登录后强制邮箱验证
- 自动发送验证邮件
- 24小时有效期
- 支持重新发送验证邮件

**9. 邮箱域名白名单**
- 可配置允许注册的邮箱域名
- 下拉选单形式展示可用域名
- 防止恶意注册
- 支持动态添加/删除白名单

### 🔧 技术改进

**后端架构**
- 新增 `cloudflare-accounts.ts` 服务模块
- 新增 `email-verification.ts` 服务模块
- 新增 `crypto.ts` 加密工具模块
- 新增 `accounts.ts` API 路由
- 新增 `verification.ts` API 路由
- 新增 `proxied.ts` API 路由（代理开关）
- 增强 `auth.ts` 中间件，添加邮箱验证检查
- 增强 `auth.ts` 路由，添加邮箱白名单验证

**数据库**
- 新增 `cloudflare_accounts` 表（多账户）
- 新增 `user_email_verifications` 表（邮箱验证）
- 新增 `email_domain_whitelist` 表（邮箱白名单）
- 新增 `system_settings` 表（系统设置）
- 新增 `email_verified` 字段到 `users` 表

**前端**
- 完全重写 `pages.ts`（从 ~900 行扩展到 ~2000+ 行）
- 新增代理开关 UI 组件
- 新增账户管理界面
- 新增邮箱验证提示横幅
- 蓝白色系主题变量
- 50+ CSS 动画和过渡效果

**安全性**
- AES-GCM 256位加密存储敏感数据
- 邮箱验证机制
- 邮箱域名白名单
- 多账户分散风险
- 增强的输入验证和 sanitization

### 📦 新增依赖

- 无新增外部依赖（纯原生实现）

### 🚀 部署变更

**新增必需环境变量**
- `ENCRYPTION_KEY` - 加密密钥
- `EMAIL_VERIFICATION_REQUIRED` - 是否要求邮箱验证
- `ALLOWED_EMAIL_DOMAINS` - 允许的邮箱域名白名单

**数据库迁移**
- 必须运行 `npm run db:migrate:remote` 添加新表

### 🎨 UI/UX 改进

- 蓝白色系配色方案
- 玻璃态 Header（毛玻璃效果）
- 果冻动画按钮
- 代理状态可视化指示器
- 邮箱验证横幅提示
- 精美的加载动画
- 响应式表格和卡片
- 优化的移动端体验

### 📝 文档更新

- 完全重写 README.md
- 新增 API 文档章节
- 新增安全说明
- 新增 UI 特性说明
- 新增配置说明
- 新增部署步骤

### ⚠️  breaking Changes

- 需要运行新的数据库迁移
- 新增必需的环境变量（`ENCRYPTION_KEY`）
- 前端完全重构，可能需要重新测试所有功能
- `email_verified` 字段新增，默认为 0

### 🐛 Bug Fixes

- 修复 State 验证在 Workers 环境中的兼容性问题
- 改进错误处理和用户反馈
- 优化 DNS 记录查询性能

### 🔮 下一步计划

- [ ] 支持更多 DNS 记录类型
- [ ] 添加 DNS 记录导入/导出功能
- [ ] 支持自定义域名模板
- [ ] 添加使用统计和配额提醒
- [ ] 支持 Two-Factor Authentication (2FA)
- [ ] 添加操作日志和审计追踪
- [ ] 支持子域名转移
- [ ] 添加 DNS 记录 TTL 预设模板
