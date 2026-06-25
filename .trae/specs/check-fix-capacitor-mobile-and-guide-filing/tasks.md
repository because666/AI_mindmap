# Tasks

- [ ] Task 1: 移动端环境与配置审查
  - [ ] SubTask 1.1: 读取 `client/package.json`，确认 Capacitor 相关依赖版本（@capacitor/core、@capacitor/android、@capacitor/app、capacitor-plugin-jpush 等）
  - [ ] SubTask 1.2: 读取 `client/capacitor.config.ts`，核对 appId、appName、webDir、server 配置是否合理
  - [ ] SubTask 1.3: 读取 `client/android/app/src/main/AndroidManifest.xml`，检查权限声明、application、activity、intent-filter、uses-sdk 等配置
  - [ ] SubTask 1.4: 读取 `client/android/app/build.gradle`，检查 compileSdk、targetSdk、minSdk、依赖项、签名配置
  - [ ] SubTask 1.5: 读取 `client/android/build.gradle` 与 `variables.gradle`，检查 Gradle 插件与依赖版本兼容性

- [ ] Task 2: 移动端代码审查
  - [ ] SubTask 2.1: 审查 `client/src/hooks/useBackButton.ts`、`useMobile.ts`、`useIsMobile.ts`、`useLongPress.ts` 的实现与引用
  - [ ] SubTask 2.2: 审查 `client/src/components/Layout/MainLayout.tsx` 移动端布局、抽屉菜单、底部备案信息处理
  - [ ] SubTask 2.3: 审查 `client/src/components/Chat/ChatPanel.tsx` 在移动端的宽度、高度、输入框可见性
  - [ ] SubTask 2.4: 审查 `client/src/components/Canvas/CanvasPage.tsx` 及相关节点组件的移动端触摸交互
  - [ ] SubTask 2.5: 审查 `client/src/services/pushService.ts` 与极光推送初始化、权限申请、厂商通道配置

- [x] Task 3: 移动端问题记录与分级
  - [x] SubTask 3.1: 汇总 Task 1 与 Task 2 中发现的配置问题、兼容性问题、体验问题
  - [x] SubTask 3.2: 对问题进行分级：阻塞级（影响审核/发布）、严重级（影响核心体验）、一般级（可后续优化）
  - [x] SubTask 3.3: 输出问题清单到 `report-task3-aggregated-issues.md`

- [x] Task 4: 修复阻塞级与严重级移动端问题
  - [x] SubTask 4.1: 修复 Capacitor / Android 原生配置问题（远程加载、明文流量、数据备份、混合内容、AppKey 硬编码、渠道不一致）
  - [x] SubTask 4.2: 修复返回键层级与双次退出问题（MainLayout、App.tsx、useBackButton）
  - [x] SubTask 4.3: 修复画布触摸交互问题（useLongPress 重复触发、NodeContextMenu touch 关闭、工具栏小屏溢出、阻止默认菜单）
  - [x] SubTask 4.4: 修复 lint 与代码质量问题（mobileService any 类型、SettingsModal effect setState、useBackButton import 顺序）
  - [x] SubTask 4.5: 为 Release 签名与厂商通道预留配置入口（需要用户提供 keystore 与厂商凭证）

- [x] Task 5: 移动端构建与验证
  - [x] SubTask 5.1: 在 `client` 目录执行 `npm install` 并确保依赖完整
  - [x] SubTask 5.2: 执行 `npm run build`，确保 Web 端构建无报错
  - [x] SubTask 5.3: 执行 `npx cap sync android`，同步 Web 资源与插件到 Android 工程
  - [x] SubTask 5.4: 执行 `./build-android.bat` 或 Gradle 构建，生成 APK/AAB
  - [x] SubTask 5.5: 静态验证通过；真机运行验证需在配置真实 JPush AppKey 与 Release 签名后执行

- [x] Task 6: 备案信息整理与填写指导
  - [x] SubTask 6.1: 确认应用名称（建议与 App 名称、商标一致）
  - [x] SubTask 6.2: 确认运行平台（Android）与应用包名（applicationId）
  - [x] SubTask 6.3: 准备应用 Logo（png/jpg，≤2MB，1 张）
  - [x] SubTask 6.4: 确定应用类型与二级分类（计算机应用类 / 应用工具类 G4 或 其他Z）
  - [x] SubTask 6.5: 确认前置许可：勾选“人工智能技术/算法”，准备算法备案说明材料
  - [x] SubTask 6.6: 准备运行截图（png/jpg，≤5MB，最多 6 张，需体现核心功能界面）
  - [x] SubTask 6.7: 编写功能描述（控制在 200–500 字，说明核心功能、服务对象、AI 能力）
  - [x] SubTask 6.8: 输出最终备案信息填写指导文档，逐项说明应填内容

# Task Dependencies

- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 4
- Task 6 依赖 Task 5（必须在移动端验证通过后再填写备案）
