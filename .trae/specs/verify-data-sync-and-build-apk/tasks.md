# Tasks

- [x] Task 1: 验证主网站与后台数据互通
  - [x] SubTask 1.1: 检查 messages 集合（376 条，包含用户/AI 对话）
  - [x] SubTask 1.2: 检查 conversations 集合（118 条对话记录）
  - [x] SubTask 1.3: 检查 events 集合（4 条，埋点修复后新增）
  - [x] SubTask 1.4: 确认 PM2 日志显示 `POST /api/events` 返回 200

- [x] Task 2: 构建 Android Debug APK
  - [x] SubTask 2.1: 确认 Capacitor 配置（server.url 指向 https://deepmindmap.work）
  - [x] SubTask 2.2: 确认 .env.mobile 极光推送 AppKey 已配置
  - [x] SubTask 2.3: 执行 npx cap sync android 同步成功
  - [x] SubTask 2.4: Gradle 构建 Debug APK 成功（BUILD SUCCESSFUL）
  - [x] SubTask 2.5: APK 文件已复制到 D:\study1\DeepMindMap\v2\DeepMindMap.apk（13.64 MB）

# Task Dependencies

- Task 2 依赖 Task 1
