# Tasks

- [x] Task 1: MindMapThumbnail 背景恢复不透明
  - [x] MindMapThumbnail.tsx 中 `bg-dark-800/95` 改为 `bg-dark-800`（完全不透明）
  - [x] 确保缩略图在透明布局下清晰可见

- [x] Task 2: ChatPanel 主体透明化
  - [x] ChatPanel.tsx 根容器从 `bg-dark-900/90 backdrop-blur-sm` 改为 `bg-dark-900/20`（几乎透明）
  - [x] 空状态容器同步修改
  - [x] 节点信息头部从 `bg-dark-800` 改为透明，只保留底部边框
  - [x] 消息列表区域保持透明

- [x] Task 3: ChatPanel 输入区保持不透明
  - [x] 输入区域 `bg-dark-800/80` 改为 `bg-dark-800`（完全不透明）
  - [x] 确保附件按钮、输入框、文件按钮、发送按钮清晰可见
  - [x] 文件面板 `bg-dark-800` 保持不透明

- [x] Task 4: MainLayout ChatPanel 外层容器透明化
  - [x] ChatPanel 容器从 `bg-dark-900/90 backdrop-blur-sm` 改为 `bg-dark-900/20`
  - [x] 边框从 `border-dark-700/50` 改为 `border-dark-700/30`
  - [x] ChatPanel 头部关闭按钮区域背景同步调整
  - [x] MessageCenter 容器同步调整

- [x] Task 5: 构建并部署验证
  - [x] npm run build 无报错
  - [x] 上传 dist 到服务器
  - [x] 验证所有修改效果

# Task Dependencies
- Task 1 独立
- Task 2 和 Task 3 可并行
- Task 4 依赖 Task 2 和 Task 3 的方案确认
- Task 5 依赖所有其他任务
