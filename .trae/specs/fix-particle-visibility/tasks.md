# Tasks

- [ ] Task 1: 修复粒子背景 Canvas 层级
  - [ ] 将 DreamyUniverseBackground.tsx 中 Canvas 的 zIndex 从 -1 改为 0
  - [ ] 确保 Canvas 的 position 保持 fixed

- [ ] Task 2: 移除 MainLayout 主容器不透明背景色
  - [ ] 找到 MainLayout.tsx 中主容器的 bg-dark-950/90 或类似背景色
  - [ ] 将其改为透明或移除背景色类
  - [ ] 确保侧边栏、顶部栏等仍保持自身背景色

- [ ] Task 3: 移除 CanvasPage ReactFlow 画布背景色
  - [ ] 找到 CanvasPage.tsx 中 ReactFlow 组件的背景色设置
  - [ ] 将 ReactFlow 背景设为透明
  - [ ] 确保节点和边仍正常显示

- [ ] Task 4: 部署到服务器并验证
  - [ ] 上传修改后的文件到服务器
  - [ ] 重新构建前端
  - [ ] 重启 PM2 服务
  - [ ] 验证粒子背景可见性

# Task Dependencies
- Task 2 和 Task 3 可并行
- Task 4 依赖 Task 1、2、3
