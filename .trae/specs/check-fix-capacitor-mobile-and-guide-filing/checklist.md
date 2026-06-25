# Checklist

## 一、Capacitor 与 Android 工程配置

- [x] `client/package.json` 中 Capacitor 核心库与插件版本一致且无过期依赖
- [x] `client/capacitor.config.ts` 的 `appId`、`appName`、`webDir`、`bundledWebRuntime` 配置正确
- [x] `client/android/app/src/main/AndroidManifest.xml` 包含必要权限（INTERNET、网络状态等），无多余高危权限
- [x] `AndroidManifest.xml` 中 `applicationId` 与包名一致，`MainActivity` 的 `android:configChanges` 包含方向与屏幕尺寸变化
- [x] `client/android/app/build.gradle` 的 `compileSdk`、`targetSdk`、`minSdk` 符合当前应用商店审核要求
- [x] Android Gradle 插件版本与 Gradle Wrapper 版本兼容
- [ ] Release 构建已配置签名（keystore），或已明确 debug/release 签名策略
  - 状态：已预留配置入口，可读取环境变量 / local.properties；正式发版前需用户提供真实 keystore

## 二、移动端交互与体验

- [x] 返回键行为符合预期：侧边栏打开时优先关闭侧边栏，否则按页面层级返回或退出
- [ ] 软键盘弹出时输入框可见，且不会遮挡聊天输入区域
  - 状态：已在 AndroidManifest 中设置 `adjustResize`；视觉视口动态适配作为后续优化项
- [ ] 状态栏与全屏设置不会导致内容被遮挡或出现白条/黑条
  - 状态：未发现问题，需真机验证
- [x] 移动端画布支持双指缩放与单指拖拽
- [x] 移动端节点支持点击选中与长按菜单
- [ ] 网络状态变化时应用给出合理提示或自动恢复
  - 状态：`mobileService` 已封装网络监听，具体提示 UI 需真机验证

## 三、移动端 UI 适配

- [x] 移动端主界面底部不再固定显示备案信息条
- [x] 移动端侧边栏底部可查看完整 ICP 与公安备案信息
- [x] 移动端侧边栏宽度、字体、按钮尺寸适合触摸操作
- [x] 聊天面板在移动端宽度适配，不超出屏幕右边界
- [x] 设置面板、搜索面板、反馈弹窗在移动端全屏或合理尺寸展示
- [x] 欢迎页、工作区列表在移动端排版正常

## 四、推送与第三方服务

- [ ] 极光推送 SDK 与厂商通道插件（华为、小米、OPPO、vivo、荣耀、魅族）已集成
  - 状态：SDK 与基础插件已集成；厂商通道需要各厂商开发者账号与凭证，已预留配置入口
- [ ] Android 13+ 动态通知权限申请逻辑存在且正常
  - 状态：Manifest 已声明 `POST_NOTIFICATIONS`；代码侧已做权限检查，需真机验证
- [ ] 应用启动时 JPush 初始化无崩溃或报错
  - 状态：构建通过；当前使用 dummy AppKey，配置真实值后需真机验证
- [ ] 后台收到广播/推送消息后能正确跳转或展示
  - 状态：代码逻辑已存在，需配置真实 AppKey 后真机验证

## 五、构建与发布

- [x] `npm install` 在 `client` 目录成功完成
- [x] `npm run build` 在 `client` 目录成功生成生产包
- [x] `npx cap sync android` 成功同步插件与资源
- [x] `./build-android.bat` 或 Gradle 构建成功生成 APK/AAB
- [ ] 生成的 APK 能在 Android 模拟器或真机正常安装并启动
  - 状态：Debug APK 已生成；真机验证需在配置真实 JPush AppKey 与 Release 签名后进行
- [ ] 核心用户流程（启动 → 工作区 → 画布 → 对话 → 返回 → 侧边栏）在真机上可完整走通
  - 状态：静态验证与代码审查通过；真机验证待进行

## 六、备案信息填写

- [x] 已确定应用名称（与界面展示名称一致）
- [x] 已确定运行平台为 Android，并填写正确的应用包名
- [x] 已准备符合尺寸与格式要求的应用 Logo
- [x] 已确定应用类型（建议：计算机应用类 → 应用工具类 G4）
- [x] 已勾选前置许可“人工智能技术/算法”，并准备算法备案说明材料
- [x] 已准备 1–6 张运行截图，覆盖核心功能界面
  - 状态：已给出截图要求与获取方式，用户需按指导自行截取/生成
- [x] 已编写 200–500 字的功能描述，明确服务对象、核心功能、AI 能力
- [x] 已输出最终备案信息填写指导文档供用户逐项参考
