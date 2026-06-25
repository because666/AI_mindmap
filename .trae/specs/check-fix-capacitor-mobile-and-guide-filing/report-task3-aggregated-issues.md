# Task 3：移动端问题汇总与分级

本报告汇总 Task 1（环境与配置审查）和 Task 2（代码审查）的发现，按阻塞级 / 严重级 / 一般级排列，作为 Task 4 修复阶段的依据。

---

## 一、阻塞级问题（必须修复，否则影响发布 / 审核 / 核心体验）

| 编号 | 问题 | 来源 | 影响 | 建议修复文件 |
|------|------|------|------|--------------|
| T1-B1 | Release 构建未配置签名 | Task 1 | 无法提交应用商店 | client/android/app/build.gradle、client/capacitor.config.ts |
| T1-B2 | 生产环境配置为远程 URL 加载 | Task 1 | 无法离线运行、审核风险、安全风险 | client/capacitor.config.ts |
| T2-B1 | 物理返回键未按“面板 → 页面 → 退出”层级处理 | Task 2 | 面板无法先关闭，双次退出失效 | client/src/components/Layout/MainLayout.tsx、client/src/App.tsx、client/src/hooks/useBackButton.ts |
| T2-B2 | 移动端聊天面板输入框可能被软键盘遮挡 | Task 2 | 用户无法看到输入内容 | client/src/components/Layout/MainLayout.tsx、client/src/components/Chat/ChatPanel.tsx、client/android/app/src/main/AndroidManifest.xml |
| T2-B3 | useLongPress 同时绑定鼠标与触摸事件，触屏易重复触发 | Task 2 | 节点长按菜单与点击冲突 | client/src/hooks/useLongPress.ts、client/src/components/Canvas/CanvasPage.tsx |
| T2-B4 | 极光推送缺少厂商通道集成 | Task 2 | 杀后台后推送无法送达 | client/src/services/pushService.ts、client/android/app/build.gradle、AndroidManifest.xml |
| T2-B5 | 推送权限申请 API 与事件名需真机验证 | Task 2 | 权限申请可能静默失败 | client/src/services/pushService.ts、验证后调整 |

## 二、严重级问题（强烈建议修复，涉及安全 / 体验 / 规范）

| 编号 | 问题 | 来源 | 影响 | 建议修复文件 |
|------|------|------|------|--------------|
| T1-S1 | 极光推送 AppKey 硬编码于配置文件 | Task 1 | 密钥泄露风险 | client/capacitor.config.ts、client/android/app/build.gradle、client/.env.mobile |
| T1-S2 | AndroidManifest 启用全局明文流量 | Task 1 | 中间人攻击风险、扫描高危 | client/android/app/src/main/AndroidManifest.xml |
| T1-S3 | AndroidManifest 开启应用数据备份 | Task 1 | 敏感数据泄露风险 | client/android/app/src/main/AndroidManifest.xml |
| T1-S4 | 极光推送渠道字段不一致 | Task 1 | 渠道统计偏差 | client/capacitor.config.ts、client/android/app/build.gradle |
| T1-S5 | Android 配置启用混合内容 | Task 1 | WebView 安全策略过宽 | client/capacitor.config.ts |
| T2-S1 | useIsMobile 无法区分 Capacitor App 与移动浏览器 | Task 2 | 无法做原生差异化处理 | client/src/hooks/useIsMobile.ts、client/src/hooks/useMobile.ts |
| T2-S2 | NodeContextMenu 仅监听 mousedown | Task 2 | 移动端点击外部无法关闭菜单 | client/src/components/Canvas/NodeContextMenu.tsx |
| T2-S3 | CanvasPage 顶部移动端工具栏在小屏下可能溢出 | Task 2 | 低端机操作按钮被挤出屏幕 | client/src/components/Canvas/CanvasPage.tsx |
| T2-S4 | App.tsx 工作区返回处理器屏蔽双次退出提示 | Task 2 | 工作区内无法双次退出 | client/src/App.tsx、client/src/hooks/useBackButton.ts |
| T2-S5 | 画布节点长按未阻止默认浏览器菜单 | Task 2 | 系统菜单与自定义菜单冲突 | client/src/hooks/useLongPress.ts、client/src/components/Canvas/CanvasPage.tsx |

## 三、一般级问题（建议优化，提升工程化与体验）

| 编号 | 问题 | 来源 | 影响 | 建议修复文件 |
|------|------|------|------|--------------|
| T1-G1 | package.json 缺少 Capacitor 常用脚本 | Task 1 | 开发效率 | client/package.json |
| T1-G2 | NDK ABI 过滤缺少 x86_64 | Task 1 | x86_64 模拟器无法运行 | client/android/app/build.gradle |
| T1-G3 | 未配置 Android 12+ 数据提取规则 | Task 1 | 备份范围不可控 | client/android/app/src/main/AndroidManifest.xml、res/xml/data_extraction_rules.xml |
| T1-G4 | Android 13+ 通知权限需运行时申请 | Task 1 | 推送权限可能未真正获得 | client/src/services/pushService.ts |
| T1-G5 | Release 构建未启用代码压缩与资源精简 | Task 1 | APK 体积大、易被反编译 | client/android/app/build.gradle、proguard-rules.pro |
| T2-G1 | mobileService.ts 使用 any 类型 | Task 2 | 类型规范 | client/src/services/mobileService.ts |
| T2-G2 | 前台收到推送仅打印日志 | Task 2 | 前台消息不可感知 | client/src/services/pushService.ts |
| T2-G3 | useBackButton.ts import 顺序不合理 | Task 2 | 可读性 | client/src/hooks/useBackButton.ts |
| T2-G4 | ChatPanel 消息复制按钮 touchmove 未取消定时器 | Task 2 | 误触复制 | client/src/components/Chat/ChatPanel.tsx |
| T2-G5 | SettingsModal.tsx effect 中 setState | Task 2 | lint 错误、额外渲染 | client/src/components/Settings/SettingsModal.tsx |
| T2-G6 | 备案信息组件引用远程图片 | Task 2 | 弱网/离线无法加载 | client/src/components/Layout/MainLayout.tsx |

## 四、本次修复范围决策

考虑到发布与备案的紧迫性，Task 4 将优先处理以下问题：

1. **必须修复（阻塞级可自动化部分）**：
   - T1-B2 远程 URL 加载
   - T1-S1 AppKey 硬编码改为环境变量读取
   - T1-S2 / T1-S3 / T1-S5 安全策略收紧
   - T1-S4 渠道字段统一
   - T2-B1 返回键层级处理
   - T2-B3 useLongPress 触屏冲突
   - T2-S2 NodeContextMenu touch 关闭
   - T2-S4 双次退出修复
   - T2-S5 阻止默认浏览器菜单
   - T2-S3 工具栏小屏溢出
   - T2-G1 / T2-G3 / T2-G5 lint 问题

2. **需要用户配合或提供凭证（修复受限）**：
   - T1-B1 Release 签名：需要用户提供 keystore 文件、别名、密码；代码侧改为从环境变量读取。
   - T2-B4 厂商通道：需要各厂商（华为、小米、OPPO、vivo 等）开发者账号与 AppID/Secret；代码侧预留配置入口。
   - T2-B5 推送权限 API：需要在真机上运行验证具体 API 名称与事件名。

3. **后续优化（不影响本次备案）**：
   - T1-G1 脚本补充
   - T1-G2 x86_64 支持
   - T1-G3 数据提取规则
   - T1-G4 运行时权限申请增强
   - T1-G5 混淆与资源精简
   - T2-B2 软键盘适配（若 manifest 已设置 adjustResize 可部分缓解，后续做视觉视口监听）
   - T2-S1 useIsMobile 原生识别增强
   - T2-G2 前台本地通知
   - T2-G4 复制按钮 touchmove
   - T2-G6 备案图标本地化

## 五、修复优先级

1. 配置安全修复（远程加载、明文、备份、混合内容、AppKey）
2. 返回键与导航体验（MainLayout、App.tsx、useBackButton）
3. 画布交互修复（useLongPress、NodeContextMenu、CanvasPage 工具栏）
4. 代码质量与 lint（mobileService、SettingsModal、useBackButton import）
5. 签名与厂商通道配置入口预留
