# Checklist

## 安全加固
- [x] 服务端 CSP 已启用，响应头包含 Content-Security-Policy
- [x] 内部 API token 比较使用 `crypto.timingSafeEqual`
- [x] 生产环境 `uncaughtException` 记录日志而非直接退出
- [x] morgan 生产环境使用 `combined` 格式
- [x] docker-compose 数据库密码使用环境变量，无硬编码
- [x] Admin 后台无 `admin123` 默认密码
- [x] Admin Session Cookie 生产环境 `secure: true`
- [x] Admin Session 密钥无弱默认值
- [x] 蜜罐安全问题答案未硬编码

## 代码质量
- [x] 客户端 `console.log` 已清理（保留 error/warn）
- [x] 服务端 `console.log` 已清理（保留 error/warn）
- [x] 客户端 `any` 类型已收紧
- [x] 服务端 `any` 类型已收紧
- [x] 客户端 API 层统一为 `httpClient`
- [x] `MODEL_CONTEXT_WINDOWS` 和 `estimateTokens` 不再重复定义
- [x] `@types/axios` 已移除

## 性能优化
- [x] Vite `manualChunks` 配置生效，第三方库在独立 chunk
- [x] `MindMapThumbnail` 使用 `React.memo`

## 工程规范
- [x] README.md 技术栈版本已同步（React 18 / Tailwind 3）
- [x] `@capacitor/cli` 在 devDependencies 中

## 部署验证
- [x] 服务器已备份当前代码到带时间戳目录
- [x] 客户端 TypeScript 编译检查通过（`npx tsc --noEmit`）
- [x] 服务端 TypeScript 编译检查通过
- [x] Web 端部署后功能正常（画布、聊天、文件上传）
- [x] APK 重新构建成功
- [ ] 移动端功能正常（欢迎页、画布加载、AI 对话）- 需用户安装 APK 后验证
