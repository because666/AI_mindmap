# Task 1：移动端环境与配置审查报告

**审查日期**：2026-06-19  
**审查范围**：Capacitor 依赖版本、Capacitor 配置文件、Android 原生工程配置（Manifest / Gradle / Wrapper）  
**审查原则**：仅基于现有文件静态审查，未修改任何文件  

---

## 一、检查项总览

| 序号 | 检查项 | 目标文件 | 状态 | 备注 |
|---|---|---|---|---|
| 1 | Capacitor 相关依赖版本一致性 | `client/package.json` | **通过** | 核心库均为 8.x；`capacitor-plugin-jpush@4.0.1` 已确认支持 Capacitor 8 |
| 2 | Capacitor 应用配置 | `client/capacitor.config.ts` | **不通过** | 存在生产环境远程加载、硬编码密钥、Release 签名未配置等问题 |
| 3 | AndroidManifest 权限与组件配置 | `client/android/app/src/main/AndroidManifest.xml` | **不通过** | 存在明文传输、数据备份等安全隐患 |
| 4 | App 级 Gradle 构建配置 | `client/android/app/build.gradle` | **不通过** | Release 签名缺失、JPush 渠道不一致、密钥硬编码 |
| 5 | 根 Gradle 与依赖变量 | `client/android/build.gradle` + `variables.gradle` | **通过** | AGP 8.13.0 与 Gradle 8.14.3 兼容，依赖变量版本可查 |
| 6 | Capacitor 插件注入 | `client/android/app/capacitor.build.gradle` | **通过** | 插件注入与 `capacitor.settings.gradle` 一致 |
| 7 | Gradle Wrapper 版本 | `client/android/gradle/wrapper/gradle-wrapper.properties` | **通过** | Gradle 8.14.3 为有效版本且满足 AGP 8.13 最低要求 |

---

## 二、问题详情（按严重程度分级）

### 2.1 阻塞级（影响审核 / 发布）

#### 问题 1：Release 构建未配置签名
- **具体位置**：
  - `client/android/app/build.gradle` 第 28–32 行
  - `client/capacitor.config.ts` 第 13–18 行
- **现象**：
  - `buildTypes.release` 中未设置 `signingConfig`，默认将使用 debug 签名；
  - `capacitor.config.ts` 中 `android.buildOptions.keystorePath`、`keystoreAlias`、`keystorePassword`、`keystoreAliasPassword` 均为 `undefined`，`releaseType` 为 `'APK'`。
- **影响**：
  - 无法生成可被应用商店识别并接受的正式签名 APK/AAB；
  - 若使用 debug 签名提交，审核会被直接拒绝。
- **修复建议**：
  1. 在 `client/android/app/build.gradle` 中新增 `signingConfigs.release`，从环境变量或本地安全配置文件读取 keystore 路径、别名及密码；
  2. 在 `buildTypes.release` 中设置 `signingConfig signingConfigs.release`；
  3. 同步在 `capacitor.config.ts` 的 `android.buildOptions` 中填写对应 keystore 信息（仅用于 `npx cap build` 场景），并确保 keystore 文件不提交到版本库。

#### 问题 2：生产环境配置为远程 URL 加载
- **具体位置**：`client/capacitor.config.ts` 第 7–10 行
- **现象**：
  - `server.url` 被设置为 `https://deepmindmap.work`；
  - `server.cleartext` 被设置为 `true`；
  - `android.allowMixedContent` 被设置为 `true`。
- **影响**：
  - 应用启动后完全依赖远程站点加载资源，无法离线运行，网络抖动时直接白屏；
  - 远程加载的 Web 内容若被篡改，会导致应用行为不可控；
  - 多数应用商店对“外壳浏览器”类应用审核较严，存在被拒风险；
  - `cleartext: true` 与 `allowMixedContent: true` 进一步放宽安全策略。
- **修复建议**：
  1. 生产环境移除 `server.url` 与 `server.cleartext`，仅保留 `webDir: 'dist'`，让 Capacitor 加载本地构建产物；
  2. 同时移除 `android.allowMixedContent` 或仅在开发调试时启用；
  3. 如果业务确实需要热更新，应使用 Capacitor Live Updates 等官方方案，而非直接指向公网 URL。

---

### 2.2 严重级（影响安全 / 核心功能）

#### 问题 3：极光推送 AppKey 硬编码于配置文件
- **具体位置**：
  - `client/capacitor.config.ts` 第 23 行
  - `client/android/app/build.gradle` 第 16 行
- **现象**：极光推送 AppKey `cbba9b691fdd44462072311d` 以明文形式同时出现在 TypeScript 配置与 Android Gradle 的 `manifestPlaceholders` 中。
- **影响**：
  - 敏感凭证随源码提交，存在泄露风险；
  - 一旦泄露，可能被用于伪造推送或滥用极光配额。
- **修复建议**：
  1. 将 AppKey 迁移至环境变量或 CI/CD Secret；
  2. 在 `capacitor.config.ts` 中通过 `process.env.JPUSH_APPKEY` 注入；
  3. 在 `app/build.gradle` 中通过 `System.getenv('JPUSH_APPKEY')` 或本地 `local.properties` 读取；
  4. 同步检查 `.gitignore`，确保 keystore、密钥配置文件不被提交。

#### 问题 4：AndroidManifest 启用全局明文流量
- **具体位置**：`client/android/app/src/main/AndroidManifest.xml` 第 12 行
- **现象**：`application` 节点设置 `android:usesCleartextTraffic="true"`。
- **影响**：
  - 允许所有 HTTP（非 HTTPS）网络请求，存在中间人攻击和数据泄露风险；
  - 应用商店安全扫描可能标记为高危。
- **修复建议**：
  1. 移除 `android:usesCleartextTraffic="true"`；
  2. 若确有明文域名需求，使用 `network_security_config.xml` 按需配置白名单，而非全局放行。

#### 问题 5：AndroidManifest 开启应用数据备份
- **具体位置**：`client/android/app/src/main/AndroidManifest.xml` 第 6 行
- **现象**：`application` 节点设置 `android:allowBackup="true"`。
- **影响**：
  - 应用私有数据可被 Google 云端备份或 adb 备份导出，增加敏感信息泄露风险；
  - 若业务数据包含用户会话、本地缓存等，备份恢复后可能导致权限混乱。
- **修复建议**：
  1. 将 `android:allowBackup="true"` 改为 `android:allowBackup="false"`；
  2. 如需备份，配置 `android:dataExtractionRules` 并仅放行非敏感文件。

#### 问题 6：极光推送渠道字段不一致
- **具体位置**：
  - `client/capacitor.config.ts` 第 24 行：`channel: 'default'`
  - `client/android/app/build.gradle` 第 17 行：`JPUSH_CHANNEL : "developer-default"`
- **现象**：Capacitor 层配置的渠道为 `default`，而 Android Manifest 占位符写入的渠道为 `developer-default`。
- **影响**：
  - 极光推送后台的渠道统计会出现偏差；
  - 若未来按渠道分发或统计，数据口径不统一。
- **修复建议**：
  1. 统一渠道值，建议业务侧确定正式渠道名（如 `default` 或 `production`）；
  2. 确保 `capacitor.config.ts` 与 `app/build.gradle` 中 `JPUSH_CHANNEL` 值一致；
  3. 考虑通过构建变体或环境变量区分 debug / release 渠道。

#### 问题 7：Android 配置启用混合内容
- **具体位置**：`client/capacitor.config.ts` 第 12 行
- **现象**：`android.allowMixedContent: true`。
- **影响**：
  - WebView 允许 HTTPS 页面加载 HTTP 子资源，降低安全性；
  - 与问题 2 的远程加载叠加后，安全风险进一步放大。
- **修复建议**：
  1. 生产环境移除 `allowMixedContent`；
  2. 若调试阶段需要，可在开发配置中单独开启，不进入生产构建。

---

### 2.3 一般级（建议优化 / 后续补齐）

#### 问题 8：package.json 缺少 Capacitor 常用脚本
- **具体位置**：`client/package.json` 第 6–13 行
- **现象**：`scripts` 中未定义 `cap:sync`、`cap:open:android`、`cap:run:android` 等命令。
- **影响**：开发/构建人员需手动记忆并输入 `npx cap ...` 命令，易出错。
- **修复建议**：补充脚本，例如：
  ```json
  "cap:sync": "npx cap sync android",
  "cap:open:android": "npx cap open android",
  "cap:run:android": "npx cap run android"
  ```

#### 问题 9：NDK ABI 过滤缺少 x86_64
- **具体位置**：`client/android/app/build.gradle` 第 20–22 行
- **现象**：`ndk.abiFilters` 仅包含 `armeabi-v7a`、`arm64-v8a`。
- **影响**：在 x86_64 架构的 Android 模拟器上无法运行或需转译，影响开发与自动化测试。
- **修复建议**：补充 `'x86_64'`，最终为 `abiFilters 'armeabi-v7a', 'arm64-v8a', 'x86_64'`。

#### 问题 10：未配置 Android 12+ 数据提取规则
- **具体位置**：`client/android/app/src/main/AndroidManifest.xml` 第 5–13 行
- **现象**：`allowBackup="true"` 已启用，但未声明 `android:dataExtractionRules`。
- **影响**：在 Android 12+ 设备上无法精细控制备份范围，默认规则可能备份过多数据。
- **修复建议**：
  1. 若决定保留备份，新增 `res/xml/data_extraction_rules.xml` 并在 Manifest 中引用；
  2. 更推荐直接禁用备份（见问题 5）。

#### 问题 11：Android 13+ 通知权限需运行时申请
- **具体位置**：`client/android/app/src/main/AndroidManifest.xml` 第 47 行
- **现象**：已声明 `android.permission.POST_NOTIFICATIONS`，但未在配置中体现运行时申请逻辑。
- **影响**：仅在 Manifest 声明权限，在 Android 13+ 上不会自动获得通知权限，推送功能可能静默失效。
- **修复建议**：
  1. 在应用启动或首次需要推送时，调用 Capacitor 权限 API 或 JPush 插件提供的 `checkPermissions` / `requestPermissions`；
  2. 在 Task 2 代码审查中重点检查 `client/src/services/pushService.ts` 是否包含该逻辑。

#### 问题 12：Release 构建未启用代码压缩与资源精简
- **具体位置**：`client/android/app/build.gradle` 第 29–32 行
- **现象**：`minifyEnabled false`，且未配置 `shrinkResources`。
- **影响**：APK 体积偏大，存在被反编译后直接阅读代码的风险。
- **修复建议**：
  1. 在充分测试后，对 release 开启 `minifyEnabled true` 与 `shrinkResources true`；
  2. 配置 `proguard-rules.pro` 保留 Capacitor 与插件所需的类和方法。

---

## 三、补充说明

### 3.1 已验证无问题的项

| 项 | 结论 |
|---|---|
| `@capacitor/core`、`@capacitor/android`、`@capacitor/cli` 版本 | 均为 `^8.3.1`，一致 |
| 官方插件版本（app/haptics/network/status-bar） | 均为 8.x，与 Capacitor 8 兼容 |
| `capacitor-plugin-jpush` 版本 | `^4.0.1` 已明确支持 Capacitor 8 |
| AGP 8.13.0 与 Gradle 8.14.3 | AGP 8.13 最低要求 Gradle 8.13，当前版本满足 |
| `compileSdkVersion = 36` / `targetSdkVersion = 36` / `minSdkVersion = 24` | 符合 Capacitor 8 要求（最低 Android 7.0 / API 24） |
| `cordovaAndroidVersion = '14.0.1'` | 与 Capacitor 8 兼容 |
| `capacitor.build.gradle` 与 `capacitor.settings.gradle` | 插件列表一致，注入路径正确 |

### 3.2 关联文件清单

本次审查实际读取的文件：

- `d:\study1\DeepMindMap\v2\client\package.json`
- `d:\study1\DeepMindMap\v2\client\capacitor.config.ts`
- `d:\study1\DeepMindMap\v2\client\android\app\src\main\AndroidManifest.xml`
- `d:\study1\DeepMindMap\v2\client\android\app\build.gradle`
- `d:\study1\DeepMindMap\v2\client\android\build.gradle`
- `d:\study1\DeepMindMap\v2\client\android\variables.gradle`
- `d:\study1\DeepMindMap\v2\client\android\app\capacitor.build.gradle`
- `d:\study1\DeepMindMap\v2\client\android\gradle\wrapper\gradle-wrapper.properties`
- `d:\study1\DeepMindMap\v2\client\android\settings.gradle`
- `d:\study1\DeepMindMap\v2\client\android\capacitor.settings.gradle`
- `d:\study1\DeepMindMap\v2\client\android\app\src\main\res\xml\file_paths.xml`

---

## 四、结论

本次 Task 1 静态审查共发现 **2 项阻塞级问题**、**5 项严重级问题**、**5 项一般级问题**。其中：

- **阻塞级**主要集中于 Release 签名缺失与生产环境远程加载，必须修复后才能进入构建与商店审核；
- **严重级**主要集中于安全策略过宽（明文传输、数据备份、混合内容）与敏感信息硬编码；
- **一般级**为工程化与体验优化项，可在修复阻塞/严重问题后逐步补齐。

建议 Task 4 修复阶段优先处理阻塞级与严重级问题，并在修复后重新运行 `npx cap sync android` 与 Gradle 构建验证。
