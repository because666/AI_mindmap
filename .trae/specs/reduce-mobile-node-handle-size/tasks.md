# Tasks
- [x] Task 1: 调整移动端节点连接点尺寸
  - [x] SubTask 1.1: 在 `client/src/components/Canvas/CanvasPage.tsx` 的 `CustomNodeComponent` 中，将移动端 `handleSize` 从 12 缩小到 8
  - [x] SubTask 1.2: 将移动端 `handlePadding` 从 16 缩小到 4，降低触摸热区对节点内容的遮挡
  - [x] SubTask 1.3: 保持桌面端 `handleSize = 8`、`handlePadding = 0` 不变
  - [x] SubTask 1.4: 验证 `handleOpacity` 在移动端和桌面端的原有逻辑不变
- [x] Task 2: 本地构建
  - [x] SubTask 2.1: 运行 `npm run lint` 确认无 ESLint 报错
  - [x] SubTask 2.2: 运行 `npm run build` 确认客户端构建成功
- [x] Task 3: 部署到线上服务器
  - [x] SubTask 3.1: 将 `client/dist` 打包为 `client-dist.tar.gz`
  - [x] SubTask 3.2: 通过 SFTP/SCP 上传到服务器 `/tmp/deploy-artifacts`
  - [x] SubTask 3.3: 在服务器上备份原 `client/dist` 并解压新的构建产物
  - [x] SubTask 3.4: 确认线上静态资源已更新（可选：清除 CDN/浏览器缓存）
- [x] Task 4: 线上移动端效果验证
  - [x] SubTask 4.1: 在浏览器开发者工具的移动端视口（宽度 < 768px）下访问线上地址
  - [x] SubTask 4.2: 确认节点连接点明显变小，不再大面积遮挡节点文本
  - [x] SubTask 4.3: 确认选中/未选中状态下的透明度行为正常

# Task Dependencies
- Task 2 依赖于 Task 1
- Task 3 依赖于 Task 2
- Task 4 依赖于 Task 3
