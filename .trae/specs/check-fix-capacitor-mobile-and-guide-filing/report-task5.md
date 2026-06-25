# Task 5：移动端构建与验证报告

- **工作目录**：`D:\study1\DeepMindMap\v2`
- **执行环境**：Windows PowerShell
- **执行时间**：2026-06-19
- **Node 包管理器**：npm

---

## 1. 环境准备

### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
npm install
```

### 输出摘要

```text
up to date in 1s

212 packages are looking for funding
  run `npm fund` for details
```

### 状态

- **通过**：依赖已完整安装，`node_modules` 已存在且与 `package-lock.json` / `pnpm-lock.yaml` 一致。

---

## 2. Web 端构建

### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
npm run build
```

### 首次构建结果

**失败**，TypeScript 编译报 3 处错误：

```text
src/components/Canvas/CanvasPage.tsx:184:7 - error TS2783: 'onContextMenu' is specified more than once, so this usage will be overwritten.

src/hooks/useMobile.ts:3:29 - error TS2614: Module '"../services/mobileService"' has no exported member 'NetworkStatus'.

src/services/mobileService.ts:3:19 - error TS1484: 'NetworkStatus' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

### 修复内容

为修复上述构建错误，修改了以下两个文件：

1. **`client/src/services/mobileService.ts`**
   - 将 `import { Network, NetworkStatus } from '@capacitor/network';` 改为 `import { Network, type NetworkStatus } from '@capacitor/network';`，满足 `verbatimModuleSyntax` 要求。
   - 增加 `export type { NetworkStatus };`，供 `useMobile.ts` 导入。

2. **`client/src/components/Canvas/CanvasPage.tsx`**
   - 节点 DOM 上已存在 `onContextMenu` 处理（来自 `useLongPress` 的 `longPressHandlers`），删除重复写死的 `onContextMenu={(e) => e.preventDefault()}`，避免属性覆盖报错。
   - 修复 `flowNodes` 的 `useMemo` 依赖数组：补充 `t`、移除未使用的 `requestOpenChat`，消除 ESLint `react-hooks/exhaustive-deps` 警告。

### 最终构建结果

```text
vite v6.4.1 building for production...
✓ 2295 modules transformed.
dist/index.html                   2.68 kB │ gzip:   0.95 kB
dist/assets/index-DpVwXPSD.css   65.63 kB │ gzip:  11.95 kB
...
dist/assets/index-*.js          935.71 kB │ gzip: 283.39 kB
✓ built in 4.30s
```

- **状态**：通过，产物生成于 `D:\study1\DeepMindMap\v2\client\dist`。
- **注意**：存在 vite 默认的 chunk 体积警告（> 500 kB），不影响构建成功，也不在本次任务修复范围内。

---

## 3. Capacitor 同步

### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
$env:VITE_JPUSH_APPKEY='dummy'; $env:JPUSH_APPKEY='dummy'; $env:JPUSH_CHANNEL='default'; npx cap sync android
```

### 输出摘要

```text
√ Copying web assets from dist to android\app\src\main\assets\public in 16.99ms
√ Creating capacitor.config.json in android\app\src\main\assets in 1.17ms
√ copy android in 73.26ms
√ Updating Android plugins in 15.17ms
[info] Found 6 Capacitor plugins for android:
       @capacitor-community/keep-awake@8.0.1
       @capacitor/app@8.1.0
       @capacitor/haptics@8.0.2
       @capacitor/network@8.0.1
       @capacitor/status-bar@8.0.2
       capacitor-plugin-jpush@4.0.1
√ update android in 186.89ms
[info] Sync finished in 0.342s
```

### 生成的 `capacitor.config.json`

文件路径：`D:\study1\DeepMindMap\v2\client\android\app\src\main\assets\capacitor.config.json`

```json
{
	"appId": "com.deepmindmap.app",
	"appName": "DeepMindMap",
	"webDir": "dist",
	"android": {},
	"plugins": {
		"JPush": {
			"appKey": "dummy",
			"channel": "default"
		}
	}
}
```

### 配置校验

| 检查项 | 结果 |
| --- | --- |
| `appId` 为 `com.deepmindmap.app` | ✅ 正确 |
| `appName` 为 `DeepMindMap` | ✅ 正确 |
| `webDir` 为 `"dist"` | ✅ 正确 |
| 不存在 `server.url` / `server.cleartext` | ✅ 正确 |
| `plugins.JPush.appKey` 存在 | ✅ 正确（当前为 dummy） |
| `android.allowMixedContent` 不存在或为 false | ✅ 不存在 |

- **状态**：通过。

---

## 4. Android 构建

### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client\android
.\gradlew.bat assembleDebug
```

### 输出摘要

```text
BUILD SUCCESSFUL in 2s
275 actionable tasks: 27 executed, 248 up-to-date
```

### 产物信息

| 产物 | 路径 | 大小 | 生成时间 |
| --- | --- | --- | --- |
| Debug APK | `D:\study1\DeepMindMap\v2\client\android\app\build\outputs\apk\debug\app-debug.apk` | 12,962,665 字节（约 12.36 MB） | 2026-06-19 00:46:08 |

> 说明：`app\debug\app-debug.apk` 为旧产物；`app\build\intermediates\apk\debug\app-debug.apk` 是中间产物。最终可安装的正式 Debug APK 为 `app\build\outputs\apk\debug\app-debug.apk`。

### 构建警告

1. **Release 签名未配置**：
   ```text
   未配置 Release 签名信息，当前 release 构建将使用 debug 签名。正式发布前请通过环境变量或 local.properties 配置 keystore。
   ```
   - 按 Task 4.5 要求，此为预留入口，**不视为构建失败**。

2. **`flatDir` 使用警告**：
   ```text
   WARNING: Using flatDir should be avoided because it doesn't support any meta-data formats.
   ```
   - 由 Capacitor / JPush 插件引入，不影响 Debug 构建。

3. **`.so` 文件缺失提示**：
   ```text
   There are no .so files available to package in the APK for armeabi-v7a.
   ```
   - 不影响构建成功，真机运行时若涉及原生库需再确认。

4. **Gradle 弃用特性**：提示未来 Gradle 9.0 不兼容部分特性，建议后续升级插件时关注。

- **状态**：通过。

---

## 5. 静态验证

### 5.1 TypeScript 类型检查

#### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
npx tsc --noEmit
```

#### 输出摘要

```text
（无输出，退出码 0）
```

- **状态**：通过，无类型错误。

### 5.2 ESLint 检查

#### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
npx eslint src/hooks/useBackButton.ts src/services/mobileService.ts src/components/Layout/MainLayout.tsx src/components/Canvas/CanvasPage.tsx src/components/Canvas/NodeContextMenu.tsx src/hooks/useLongPress.ts src/services/pushService.ts src/components/Settings/SettingsModal.tsx
```

#### 输出摘要

```text
（无输出，退出码 0）
```

- **状态**：通过，无错误、无警告。

---

## 6. 补充：单元测试结果（非任务强制项，但用于回归验证）

### 执行命令

```powershell
cd D:\study1\DeepMindMap\v2\client
npx vitest --run
```

### 输出摘要

```text
Test Files  1 failed | 6 passed (7)
     Tests  2 failed | 105 passed (107)
```

### 失败用例

- `src/test/markdownRenderer.test.ts > Markdown Preprocessing > Headings > should handle headings with extra spaces`
- `src/test/markdownRenderer.test.ts > Markdown Preprocessing > Lists > should handle nested lists`

### 说明

这两个失败属于 `MarkdownRenderer` 预处理逻辑，与本次移动端构建、Capacitor 同步、Android 打包及修改的文件无关，未在本次任务范围内修复。

---

## 7. 修改文件列表

| 文件 | 修改说明 |
| --- | --- |
| `client/src/services/mobileService.ts` | 类型化导入 `NetworkStatus` 并重新导出，修复 `verbatimModuleSyntax` 与 `useMobile.ts` 的导入错误 |
| `client/src/components/Canvas/CanvasPage.tsx` | 删除重复 `onContextMenu`；修正 `flowNodes` 的 `useMemo` 依赖数组 |

---

## 8. 运行验证方式

按顺序执行以下命令即可复现本次验证结果：

```powershell
# 1. 环境准备
cd D:\study1\DeepMindMap\v2\client
npm install

# 2. Web 构建
npm run build

# 3. Capacitor 同步（dummy 为占位值，正式打包需替换真实 AppKey）
$env:VITE_JPUSH_APPKEY='dummy'; $env:JPUSH_APPKEY='dummy'; $env:JPUSH_CHANNEL='default'; npx cap sync android

# 4. Android Debug 构建
cd D:\study1\DeepMindMap\v2\client\android
.\gradlew.bat assembleDebug

# 5. 静态验证
cd D:\study1\DeepMindMap\v2\client
npx tsc --noEmit
npx eslint src/hooks/useBackButton.ts src/services/mobileService.ts src/components/Layout/MainLayout.tsx src/components/Canvas/CanvasPage.tsx src/components/Canvas/NodeContextMenu.tsx src/hooks/useLongPress.ts src/services/pushService.ts src/components/Settings/SettingsModal.tsx
```

---

## 9. 注意事项

1. **极光推送 AppKey**：当前使用 `dummy` 占位值，真机测试或发布前必须通过环境变量 `VITE_JPUSH_APPKEY` 注入真实值。
2. **Release 签名**：正式 APK 发布前需按 Task 4.5 在 `local.properties` 或 CI Secret 中配置 keystore，否则 release 构建将使用 debug 签名。
3. **Gradle 警告**：`flatDir` 与 Gradle 弃用特性不影响 Debug 构建，但建议后续升级 Capacitor / JPush 插件时跟进官方适配。
4. **单元测试失败**：`markdownRenderer.test.ts` 的 2 处失败与本次任务无关，如需修复请单独安排任务。
5. **未提交代码**：本次任务未执行 Git 提交，所有修改均为工作区变更。

---

## 10. 下一步真机验证建议

1. **安装 APK**：
   ```powershell
   adb install D:\study1\DeepMindMap\v2\client\android\app\build\outputs\apk\debug\app-debug.apk
   ```

2. **基础功能验证**：
   - 启动 App 后确认 splash 页面正常消失，进入主界面无白屏。
   - 验证节点长按/右键能否弹出 `NodeContextMenu`（已修复重复 `onContextMenu`）。
   - 验证移动端底部工具栏、返回键、状态栏、屏幕常亮等原生行为是否正常。

3. **网络与推送验证**：
   - 在真机上切换飞行模式/数据网络，观察网络状态提示。
   - 配置真实 JPush AppKey 后，测试推送通知能否正常到达。

4. **性能与兼容性验证**：
   - 在 Android 10/12/14 等不同系统版本上测试安装与启动。
   - 使用 Android Studio Profiler 检查启动内存与包体积，必要时开启 ProGuard / R8 压缩。

---

## 结论

Task 5 的移动端构建与验证整体 **通过**：

- Web 端构建成功；
- Capacitor 同步配置正确；
- Android Debug APK 构建成功；
- TypeScript 与 ESLint 静态验证通过；
- 仅存在与本次任务无关的 Markdown 单元测试失败和已预留的 Release 签名配置项。
