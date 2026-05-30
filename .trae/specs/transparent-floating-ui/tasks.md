# Tasks

- [x] Task 1: 移除 App.tsx 顶部渐变遮挡层 statusBarGradient
  - [x] 删除 statusBarGradient 变量定义
  - [x] 删除所有渲染位置中的 {statusBarGradient}

- [x] Task 2: CanvasPage 顶部工具栏悬浮化
  - [x] 移除工具栏容器的 glass 类，改为无背景
  - [x] 保持每个按钮的 btn-icon / btn-primary 独立半透明背景
  - [x] 确保工具栏在画布上悬浮，粒子背景在间隙可见

- [x] Task 3: ChatPanel 关闭按钮增强
  - [x] MainLayout.tsx 中 ChatPanel 容器头部的关闭按钮增加固定背景色和更大点击区域
  - [x] ChatPanel.tsx 内部节点信息头部的清空按钮保持可见性

- [x] Task 4: ChatPanel 输入区控件可见性修复
  - [x] 确认输入区背景色在透明布局下仍然清晰（bg-dark-800 或类似）
  - [x] 确保附件按钮、输入框、文件按钮、发送按钮图标清晰可辨
  - [x] 输入框边框明确

- [x] Task 5: 备案号底部居中
  - [x] MainLayout.tsx footer 从 fixed bottom-2 right-2 改为 fixed bottom-2 left-1/2 -translate-x-1/2

- [x] Task 6: 移动端 Header 透明悬浮
  - [x] MainLayout.tsx renderMobileHeader 从 bg-dark-900 改为透明/半透明背景
  - [x] 确保移动端图标在透明背景上清晰可见

- [x] Task 7: 构建并部署验证
  - [x] npm run build 无报错
  - [x] 上传 dist 到服务器
  - [x] 验证所有修改效果

# Task Dependencies
- Task 1 和 Task 2 可并行
- Task 3 和 Task 4 可并行
- Task 5 和 Task 6 独立
- Task 7 依赖所有其他任务
