# Tasks

- [x] Task 1: 新增移动端 APP ICP 备案号展示组件
  - [x] SubTask 1.1: 在 `client/src/components/Settings/SettingsModal.tsx` 中，仅在 `isMobile` 为 true 时，在设置页面底部渲染 APP ICP 备案号“桂ICP备2026005821号-3A”
  - [x] SubTask 1.2: 备案号区域使用语义化元素，添加 `role="contentinfo"` 与 `aria-label="APP ICP 备案号"`，确保屏幕阅读器可识别
  - [x] SubTask 1.3: 文字大小不小于 12sp（使用 `text-xs` 即 `0.75rem/12px`），颜色使用 `text-dark-400` 在 `bg-dark-900` 背景上确保对比度不低于 4.5:1
  - [x] SubTask 1.4: 备案号区域居中显示，设置 `py-3 px-6` 与 `shrink-0`，不遮挡上方设置内容，不随 Tab 内容滚动而浮动
  - [x] SubTask 1.5: 桌面端（`isMobile === false`）不渲染该备案号

- [x] Task 2: 添加多语言文案
  - [x] SubTask 2.1: 在 `client/src/locales/settings/zh.json` 中添加 `appIcpFiling` 键，值为“桂ICP备2026005821号-3A”
  - [x] SubTask 2.2: 在 `client/src/locales/settings/en.json` 中添加 `appIcpFiling` 键，值为“桂ICP备2026005821号-3A”（备案号保持中文原文）
  - [x] SubTask 2.3: 在 `SettingsModal.tsx` 中通过 `useTranslation('settings')` 读取 `appIcpFiling`，避免硬编码文案

- [x] Task 3: 编写单元测试
  - [x] SubTask 3.1: 新建 `client/src/components/Settings/SettingsModal.test.tsx`
  - [x] SubTask 3.2: 测试移动端（`useIsMobile` 返回 true）打开设置弹窗时，底部显示 APP 备案号“桂ICP备2026005821号-3A”
  - [x] SubTask 3.3: 测试桌面端（`useIsMobile` 返回 false）打开设置弹窗时，底部不显示 APP 备案号
  - [x] SubTask 3.4: 测试备案号元素包含正确的 `aria-label` 和 `role` 属性，可被屏幕阅读器识别
  - [x] SubTask 3.5: 测试移动端设置弹窗三个 Tab（ui/api/guide）切换后，备案号始终可见

- [x] Task 4: 运行语法校验与测试
  - [x] SubTask 4.1: 在 `client` 目录下执行 `npm run lint`，无新增 ESLint 错误（顺带修复 nodeStore.test.ts 中已有的两个未使用参数错误）
  - [x] SubTask 4.2: 执行 `npm run test -- --run`，新增与现有共 226 个单元测试全部通过
  - [x] SubTask 4.3: 执行 `npm run build`，生产构建无异常

- [x] Task 5: 移动端真机/模拟器验证与截图
  - [x] SubTask 5.1: 使用 Playwright 启动 client 预览服务器，通过 mock 后端 API 直接进入主界面并打开设置弹窗，确认备案号完整显示
  - [x] SubTask 5.2: 在 4.7 英寸机型（iPhone SE / 375×667 逻辑分辨率）竖屏截图
  - [x] SubTask 5.3: 在 6.1 英寸机型（Pixel 5 / 393×851 逻辑分辨率，Android）竖屏截图
  - [x] SubTask 5.4: 在 6.7 英寸机型（Samsung S23 Ultra / 412×915 逻辑分辨率，Android）竖屏截图
  - [x] SubTask 5.5: 在 iPhone SE 4.7 英寸机型横屏（667×375）截图，确认备案号位置正确、文字不截断
  - [x] SubTask 5.6: 将截图保存到 `compatibility_screenshots/mobile-icp-filing/` 目录，并按机型命名

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 1、Task 2、Task 3
- Task 5 依赖 Task 4
