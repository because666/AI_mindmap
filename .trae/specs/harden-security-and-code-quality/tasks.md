# Tasks

- [x] Task 1: 服务端安全加固
  - [x] SubTask 1.1: 启用 CSP - 修改 `server/src/index.ts`，配置 helmet CSP 策略（允许同源、受信任 CDN、Capacitor）
  - [x] SubTask 1.2: 修复时序攻击 - `server/src/index.ts` 内部 API token 比较改用 `crypto.timingSafeEqual`
  - [x] SubTask 1.3: 生产环境错误容忍 - `uncaughtException`/`unhandledRejection` 生产环境记录日志不退出，开发环境退出
  - [x] SubTask 1.4: 优化 morgan 日志 - 生产环境使用 `combined` 格式，开发环境用 `dev`

- [x] Task 2: Admin 后台安全加固
  - [x] SubTask 2.1: 移除默认弱密码 - `admin/server/src/index.ts` 移除 `admin123` 默认值，强制要求环境变量
  - [x] SubTask 2.2: Session Cookie secure - 生产环境设置 `secure: true`
  - [x] SubTask 2.3: Session 密钥加固 - `admin/server/src/config/index.ts` 移除弱默认值
  - [x] SubTask 2.4: 移除蜜罐安全问题硬编码答案

- [x] Task 3: Docker 凭证安全化
  - [x] SubTask 3.1: 修改 `docker-compose.yml`，数据库密码改用 `${env:VAR}` 语法
  - [x] SubTask 3.2: 创建/更新 `.env.example` 提供占位符

- [x] Task 4: 客户端代码质量优化
  - [x] SubTask 4.1: 清理 `client/src` 中的 `console.log`（保留 error/warn）
  - [x] SubTask 4.2: 收紧 `any` 类型，替换为具体类型或 `unknown`
  - [x] SubTask 4.3: 统一 API 客户端 - 提取公共 `httpClient`，api.ts/chatService.ts/pushService.ts 共用
  - [x] SubTask 4.4: 移除重复的 `MODEL_CONTEXT_WINDOWS` 和 `estimateTokens`，统一到一处

- [x] Task 5: 服务端代码质量优化
  - [x] SubTask 5.1: 清理 `server/src` 中的 `console.log`（保留 error/warn）
  - [x] SubTask 5.2: 收紧 `any` 类型，特别是 `index.ts` 中的 `error: any`
  - [x] SubTask 5.3: 移除不必要的 `@types/axios` 依赖

- [x] Task 6: 性能优化
  - [x] SubTask 6.1: Vite 手动分包 - `client/vite.config.ts` 添加 `manualChunks` 配置
  - [x] SubTask 6.2: `MindMapThumbnail` 使用 `React.memo` 优化

- [x] Task 7: 工程规范同步
  - [x] SubTask 7.1: 同步 README.md 技术栈版本（React 18 / Tailwind 3）
  - [x] SubTask 7.2: `@capacitor/cli` 从 dependencies 移到 devDependencies
  - [x] 额外: 修复 honeypot.ts、LoginPage.tsx、auth.ts 残留硬编码安全问题

- [x] Task 8: 备份服务器并部署验证
  - [x] SubTask 8.1: SSH 备份服务器当前 dist 和 server 代码到带时间戳的目录
  - [x] SubTask 8.2: 本地构建客户端，TypeScript 编译检查通过
  - [x] SubTask 8.3: 部署到服务器，验证 Web 端功能正常
  - [x] SubTask 8.4: 重新构建 APK，验证移动端功能正常

# Task Dependencies
- [Task 8] depends on [Task 1] [Task 2] [Task 3] [Task 4] [Task 5] [Task 6] [Task 7]
- [Task 4] 和 [Task 5] 可并行
- [Task 1] [Task 2] [Task 3] 可并行
- [Task 6] [Task 7] 可并行
