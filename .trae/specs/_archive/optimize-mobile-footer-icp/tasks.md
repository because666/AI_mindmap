# Tasks

- [x] Task 1: 分析当前 MainLayout 中的备案信息渲染逻辑
  - [x] SubTask 1.1: 定位底部备案信息条代码
  - [x] SubTask 1.2: 确认桌面端与移动端复用的组件结构
  - [x] SubTask 1.3: 确认已有的移动端检测 hook（如 useIsMobile/useMobile）

- [x] Task 2: 将备案信息抽成可复用组件
  - [x] SubTask 2.1: 在 MainLayout 中创建 BeianFooter 组件
  - [x] SubTask 2.2: 组件包含 ICP 备案和公安备案信息
  - [x] SubTask 2.3: 支持传入 className 或 compact 模式以适配侧边栏

- [x] Task 3: 移动端主界面隐藏底部备案条
  - [x] SubTask 3.1: 在 MainLayout 主内容区域，移动端不再渲染底部 BeianFooter
  - [x] SubTask 3.2: 桌面端继续渲染底部 BeianFooter
  - [x] SubTask 3.3: 调整左下角缩放/全屏按钮的 bottom 间距，避免与屏幕底部过近

- [x] Task 4: 移动端侧边栏底部展示备案信息
  - [x] SubTask 4.1: 在移动端抽屉菜单底部插入 BeianFooter
  - [x] SubTask 4.2: 使用 compact 样式（字号更小、间距更紧凑）
  - [x] SubTask 4.3: 确保侧边栏滚动时备案信息始终固定在底部

- [x] Task 5: 构建验证与部署
  - [x] SubTask 5.1: 客户端 TypeScript 编译通过
  - [x] SubTask 5.2: 客户端构建通过
  - [x] SubTask 5.3: 使用 Puppeteer 移动端模拟器验证效果
  - [x] SubTask 5.4: 部署到服务器

# Task Dependencies
- Task 1 是 Task 2 的前置
- Task 2 是 Task 3 和 Task 4 的前置
- Task 5 依赖所有前置任务
