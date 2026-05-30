# Tasks

- [ ] Task 1: 修复ChatPanel打开时的opacity过渡"闪回"
  - [ ] MainLayout.tsx 中 ChatPanel 外层容器的 `transition-[width,opacity]` 改为 `transition-[width]`
  - [ ] 移除 `opacity-100` / `opacity-0` 类名切换，改为始终 `opacity-100`
  - [ ] 保留 `pointer-events-none` 在关闭状态
  - [ ] MessageCenter 外层容器同步修改

- [ ] Task 2: ChatPanel 根容器添加极淡毛玻璃背景
  - [ ] ChatPanel.tsx 根容器从 `bg-dark-900/20` 改为 `bg-dark-950/30 backdrop-blur-sm`
  - [ ] 空状态容器同步修改
  - [ ] MainLayout.tsx 中 ChatPanel 外层容器从 `bg-dark-900/20` 改为 `bg-dark-950/30 backdrop-blur-sm`

- [ ] Task 3: ChatPanel 输入区改用项目工具类替代内联样式
  - [ ] 输入区域容器改用 Tailwind 类名 `bg-dark-800/90 backdrop-blur-sm border-t border-dark-600/50`
  - [ ] 附件按钮改用 `btn-icon` 工具类
  - [ ] 文件按钮改用 `btn-icon` 工具类（激活态用自定义样式）
  - [ ] 发送按钮改用 `btn-primary` 工具类
  - [ ] 输入框改用 `input-field` 工具类
  - [ ] 移除所有内联 style 属性

- [ ] Task 4: 构建并部署验证
  - [ ] 本地 `npm run build` 无报错
  - [ ] 推送代码到 GitHub
  - [ ] 服务器 git pull + npm run build + pm2 restart
  - [ ] 浏览器验证所有修改效果

# Task Dependencies
- Task 1 独立（优先执行，修复闪回根因）
- Task 2 依赖 Task 1（在过渡修复后添加背景层）
- Task 3 依赖 Task 2（在背景层确定后调整按钮样式）
- Task 4 依赖所有其他任务
