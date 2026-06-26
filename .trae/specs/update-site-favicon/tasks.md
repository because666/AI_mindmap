# Tasks

- [ ] Task 1: 生成标准尺寸图标
  - [ ] SubTask 1.1: 检查本地是否可用 Pillow/ImageMagick 处理图片
  - [ ] SubTask 1.2: 从 `IMG_20260625_233610..png` 生成 `client/public/favicon.png`（32x32，保留高清细节）
  - [ ] SubTask 1.3: 从 `IMG_20260625_233610..png` 生成 `client/public/apple-touch-icon.png`（180x180）
  - [ ] SubTask 1.4: 从 `IMG_20260625_233610..png` 生成 `client/public/logo.png`（512x512）

- [ ] Task 2: 更新 HTML 图标引用
  - [ ] SubTask 2.1: 在 `client/index.html` 中保留 `/favicon.png` 并添加 `/apple-touch-icon.png` 的 `link rel="apple-touch-icon"`
  - [ ] SubTask 2.2: 可选：添加 192x192 和 512x512 的 manifest/PWA 图标链接

- [ ] Task 3: 构建与本地验证
  - [ ] SubTask 3.1: 运行 `cd client && npm run build`
  - [ ] SubTask 3.2: 确认 `client/dist/` 下包含新的 favicon.png、apple-touch-icon.png、logo.png
  - [ ] SubTask 3.3: 确认 `client/dist/index.html` 中图标链接正确

- [ ] Task 4: 部署到服务器
  - [ ] SubTask 4.1: 将 `client/dist/` 上传到服务器 `/www/wwwroot/AI_mindmap/client/dist`
  - [ ] SubTask 4.2: 刷新浏览器缓存后检查标签页图标是否清晰

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
