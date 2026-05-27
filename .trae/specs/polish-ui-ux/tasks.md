# Tasks

- [x] Task 1: 面板过渡动画 - ChatPanel / HistoryPanel / MessageCenter 平滑展开/收起
  - [x] 在 index.css 中定义面板展开/收起的关键帧动画
  - [x] 修改 MainLayout.tsx 中 ChatPanel 的关闭逻辑，使用 CSS transition 替代 opacity+absolute 切换
  - [x] 修改 HistoryPanel 和 MessageCenter 的关闭逻辑，保持一致
  - [x] 确保主画布区域同步平滑扩展

- [x] Task 2: 桌面端侧边栏图标标签 tooltip
  - [x] 在 MainLayout.tsx 桌面端侧边栏图标上添加 hover 文字标签
  - [x] 标签延迟不超过 200ms 显示，样式与暗色主题协调

- [x] Task 3: 对话输入框多行自动扩展
  - [x] 修改 ChatPanel.tsx 中 textarea，移除 rows={1} 和 resize-none
  - [x] 实现基于 scrollHeight 的自动高度调整，最大 160px
  - [x] 超出最大高度后显示滚动条

- [x] Task 4: 消息时间戳显示
  - [x] 在 ChatPanel.tsx 消息气泡下方添加时间戳
  - [x] 格式：当天 HH:MM，跨天 MM/DD HH:MM
  - [x] 使用 dark-500 低对比度颜色

- [x] Task 5: 自定义确认弹窗替代 confirm()
  - [x] 创建 ConfirmDialog 组件（毛玻璃遮罩 + 居中弹窗）
  - [x] 替换 ChatPanel.tsx 中清空对话的 confirm() 调用
  - [x] 替换其他使用 confirm() 的地方

- [x] Task 6: 移动端抽屉滑出动画
  - [x] 在 index.css 中定义 slide-out-left 动画
  - [x] 修改 MainLayout.tsx 移动端 Drawer 关闭逻辑，先播放滑出动画再卸载 DOM
  - [x] 遮罩层同步淡出

- [x] Task 7: ChatPanel 空状态快捷提问建议
  - [x] 在 ChatPanel.tsx 空状态区域添加 3-4 个预设提问建议卡片
  - [x] 点击建议直接发送到对话
  - [x] 建议内容与思维导图场景相关

- [x] Task 8: Three.js 背景 FPS 检测与自动降级
  - [x] 在 DreamyUniverseBackground.tsx 中添加 FPS 监测逻辑
  - [x] 连续 3 秒低于 30fps 时自动减少粒子数量 50%
  - [x] 降级后不自动恢复

- [x] Task 9: 统一圆角语言
  - [x] 检查并统一 ChatPanel.tsx 中的圆角（消息气泡 rounded-2xl）
  - [x] 检查并统一 WelcomePage.tsx 中的圆角
  - [x] 检查并统一 MainLayout.tsx 中的圆角

- [x] Task 10: 复制按钮移动端适配
  - [x] 修改 ChatPanel.tsx 复制按钮，移动端始终显示（opacity-70）
  - [x] 添加移动端长按触发复制逻辑

# Task Dependencies
- Task 5（自定义确认弹窗）独立于其他任务
- Task 1（面板过渡）和 Task 6（移动端抽屉）可并行
- Task 9（统一圆角）和 Task 10（复制按钮）可并行
- Task 3（输入框）和 Task 4（时间戳）可并行
