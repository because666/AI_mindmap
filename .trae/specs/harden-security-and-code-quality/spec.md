# 安全加固与代码质量优化 Spec

## Why

基于阶段一审查报告，项目在安全防护、代码质量和性能方面存在多处技术债务。本次优化聚焦低风险高收益的改进，在不破坏现有服务的前提下提升安全性和可维护性。大规模架构重构（如 appStore 拆分、向量数据库持久化）不在本次范围内。

## What Changes

### 安全加固（P0）
- 启用 CSP（Content Security Policy），替代完全禁用
- 内部 API token 比较改用 `crypto.timingSafeEqual`，防止时序攻击
- 生产环境 `uncaughtException` / `unhandledRejection` 改为记录日志而非直接退出
- docker-compose 数据库密码改用环境变量，移除硬编码默认值
- Admin 后台移除默认弱密码 `admin123`，强制要求环境变量配置
- Admin Session Cookie 在生产环境设置 `secure: true`
- Admin Session 密钥移除弱默认值

### 代码质量（P1）
- 清理客户端和服务端的 `console.log`（保留 `console.error` / `console.warn`）
- 收紧 `any` 类型，替换为具体类型或 `unknown`
- 统一客户端 API 层，提取公共 `httpClient`，通过拦截器注入 visitorId/workspaceId
- 移除客户端和服务端重复的 `MODEL_CONTEXT_WINDOWS` 和 `estimateTokens` 定义

### 性能优化（P2）
- Vite 配置手动分包（`manualChunks`），将 react、react-dom、@xyflow/react、react-markdown 等第三方库拆分
- `MindMapThumbnail` 组件使用 `React.memo` 优化，避免重复计算
- 移除不必要的 `@types/axios` 依赖

### 工程规范（P3）
- 同步 README.md 中的技术栈版本信息（React 18 / Tailwind 3）
- `@capacitor/cli` 从 `dependencies` 移到 `devDependencies`

## Impact

- Affected specs: `code-quality-optimization-analysis`（本次为该分析的部分实施）
- Affected code:
  - 服务端: `server/src/index.ts`、`server/src/middleware/index.ts`、`docker-compose.yml`、`admin/server/src/index.ts`、`admin/server/src/config/index.ts`
  - 客户端: `client/src/services/api.ts`、`client/src/services/chatService.ts`、`client/src/services/pushService.ts`、`client/src/components/Chat/ChatPanel.tsx`、`client/vite.config.ts`、`client/package.json`
  - 文档: `README.md`

## ADDED Requirements

### Requirement: 内容安全策略（CSP）
系统 SHALL 在生产环境启用 Content Security Policy，限制脚本、样式、图片等资源的加载来源，同时允许 Capacitor APP 和线上 API 的正常访问。

#### Scenario: 生产环境 CSP 生效
- **WHEN** 服务端运行在生产环境
- **THEN** 响应头包含 CSP，仅允许加载同源资源、受信任的 CDN 和 API 域名
- **AND** 现有功能（画布、聊天、文件上传）不受影响

### Requirement: 时序安全的令牌比较
系统 SHALL 使用恒定时间算法比较内部 API token，防止时序攻击。

#### Scenario: 内部 API 令牌验证
- **WHEN** 请求携带 `X-Internal-Token` 头
- **THEN** 服务端使用 `crypto.timingSafeEqual` 进行比较
- **AND** 无论令牌是否匹配，响应时间差异不可被用于推测正确令牌

### Requirement: 生产环境错误容忍
系统 SHALL 在生产环境捕获未处理异常并记录日志，而非直接退出进程，避免单次异常导致服务中断。

#### Scenario: 未捕获异常
- **WHEN** 发生 `uncaughtException`
- **THEN** 生产环境记录错误日志并继续运行
- **AND** 开发环境仍然退出进程以便调试

### Requirement: 统一 HTTP 客户端
客户端 SHALL 使用统一的 `httpClient` 实例，通过拦截器自动注入 visitorId、workspaceId 和错误处理。

#### Scenario: API 请求自动注入认证信息
- **WHEN** 客户端发起任何 API 请求
- **THEN** 请求头自动包含 `X-Visitor-Id`（如存在）
- **AND** 响应错误时统一处理（如 401 跳转登录）

### Requirement: Vite 代码分包
构建产物 SHALL 按第三方库和路由进行分包，减少首屏加载的 bundle 体积。

#### Scenario: 首屏加载
- **WHEN** 用户首次访问网站
- **THEN** 主 bundle 仅包含应用代码
- **AND** react、react-dom、@xyflow/react 等第三方库在独立 chunk 中按需加载

## MODIFIED Requirements

### Requirement: 数据库凭证管理
docker-compose 中的数据库密码 SHALL 通过环境变量注入，不再硬编码默认值。`.env.example` 提供占位符示例。

### Requirement: Admin 后台认证安全
Admin 后台 SHALL 强制要求通过环境变量配置管理员密码和 Session 密钥，移除所有弱默认值。

### Requirement: 日志输出规范
客户端和服务端 SHALL 移除生产环境中的 `console.log` 调试输出，保留 `console.error` 和 `console.warn` 用于错误追踪。

## REMOVED Requirements

### Requirement: 硬编码默认凭证
**Reason**: docker-compose 中的 `deepmindmap123` 和 admin 的 `admin123` 存在安全风险
**Migration**: 改用环境变量，`.env.example` 提供占位符
