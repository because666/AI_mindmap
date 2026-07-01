# Tasks

- [x] Task 1: 安装 Capacitor 依赖并初始化 Android 平台
  - [x] SubTask 1.1: 在 admin/client 中安装 @capacitor/core、@capacitor/cli、@capacitor/android
  - [x] SubTask 1.2: 创建 `admin/client/capacitor.config.ts`，配置 server.url 指向 `https://admin.deepmindmap.work`
  - [x] SubTask 1.3: 执行 `npx cap add android`，Android 平台添加成功

- [x] Task 2: 修改后台前端跳过蜜罐流程
  - [x] SubTask 2.1: 在 `admin/client/src/App.tsx` 中导入 Capacitor
  - [x] SubTask 2.2: 在 Capacitor 环境下将 /login 路由直接重定向到 /portal（跳过蜜罐）

- [x] Task 3: 构建并生成 APK
  - [x] SubTask 3.1: `npm run build` 构建成功
  - [x] SubTask 3.2: `npx cap sync android` 同步成功
  - [x] SubTask 3.3: Gradle 构建成功（BUILD SUCCESSFUL）
  - [x] SubTask 3.4: APK 在标准路径 `admin/client/android/app/build/outputs/apk/debug/app-debug.apk`

- [x] Task 4: 区分后台 APK 名称和图标
  - [x] SubTask 4.1: 确认 strings.xml 中应用名称为 "DeepMindMap Admin"
  - [x] SubTask 4.2: 生成后台专属图标（深蓝盾牌 + 图表齿轮）
  - [x] SubTask 4.3: 替换所有 mipmap 尺寸图标资源
  - [x] SubTask 4.4: 重新构建 APK

# Task Dependencies

- Task 2 与 Task 1 可并行（无依赖）
- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 3
