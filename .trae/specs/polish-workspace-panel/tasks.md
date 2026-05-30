# Tasks

- [x] Task 1: 工作区面板外层容器改为浮动毛玻璃圆角
  - [x] 外层容器从 `bg-dark-900 border-r border-dark-700` 改为浮动式布局 (`absolute left-16 top-3 bottom-3`)
  - [x] 添加 `rounded-2xl` 圆角
  - [x] 添加 `backdrop-blur-md` 毛玻璃效果
  - [x] 添加半透明背景 `bg-dark-900/80`
  - [x] 添加阴影 `shadow-2xl` 实现悬浮效果
  - [x] 移动端样式保持原有全屏遮罩模式

- [x] Task 2: 工作区面板内部区块样式统一
  - [x] 工作区信息卡片背景改为 `bg-dark-800/80`，边框 `border-primary-500/20`
  - [x] 切换工作区列表项 hover 效果改为 `hover:bg-dark-700/60`
  - [x] 底部按钮区域保持圆角
  - [x] 分隔线改为 `border-dark-600/30`

- [x] Task 3: 构建并部署验证
  - [x] 本地 `npm run build` 无报错
  - [x] 推送代码到 GitHub
  - [x] 服务器 SFTP 上传 + 构建 + PM2 重启
  - [x] 构建产物验证通过

# Task Dependencies
- Task 1 优先执行
- Task 2 依赖 Task 1
- Task 3 依赖所有其他任务
