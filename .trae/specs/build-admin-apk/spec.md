# 构建后台管理 APK Spec

## Why

用户需要后台管理系统的 Android APK，方便在手机上随时查看和管理数据。APK 应加载线上后台网站，并简化登录流程（跳过蜜罐假登录页，直接进入真实登录）。

## What Changes

- 在 `admin/client` 中安装 Capacitor 依赖并初始化 Android 平台
- 配置 Capacitor 加载后台网站 `https://admin.deepmindmap.work`
- 修改后台前端路由，在 Capacitor 环境中跳过蜜罐假登录页，直接显示真实登录页
- 构建 Debug APK，按标准项目结构存放于 `admin/client/android/app/build/outputs/apk/debug/`

## Impact

- Affected code:
  - `admin/client/package.json`（新增 Capacitor 依赖）
  - `admin/client/capacitor.config.ts`（新建）
  - `admin/client/src/App.tsx`（跳过蜜罐逻辑）
  - `admin/client/android/`（新建 Android 工程）

## ADDED Requirements

### Requirement: 后台 APK 构建

系统 SHALL 为后台管理前端构建 Android APK，加载线上后台地址。

#### Scenario: APK 构建与存放

- **WHEN** 构建完成
- **THEN** APK 存放在 `admin/client/android/app/build/outputs/apk/debug/app-debug.apk`
- **AND** 不额外复制到项目根目录或其他非标准路径

### Requirement: 简化登录流程

系统 SHALL 在 Capacitor（移动端）环境中跳过蜜罐假登录页，直接进入真实登录页。

#### Scenario: 移动端打开后台 APK

- **WHEN** 用户打开后台 APK
- **THEN** 直接加载后台真实登录页（/portal 或简化后的登录页）
- **AND** 不显示蜜罐假登录页（/login）
- **AND** 用户输入密码后即可进入后台
