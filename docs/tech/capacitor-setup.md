# Capacitor 移动端打包指南

## 环境准备

### 1. 安装依赖（在本地开发环境执行）

```bash
# 进入前端目录
cd client

# 安装 Capacitor 核心依赖
npm install @capacitor/core @capacitor/cli

# 安装 Android 平台
npm install @capacitor/android
```

### 2. 初始化 Capacitor

```bash
npx cap init DeepMindMap com.deepmindmap.app --web-dir dist
```

### 3. 添加 Android 平台

```bash
npx cap add android
```

### 4. 构建并同步

```bash
# 设置移动端环境变量并构建
# Windows PowerShell:
$env:VITE_API_URL="http://43.139.43.112/api"
npm run build

# CMD:
set VITE_API_URL=http://43.139.43.112/api
npm run build

# 同步到 Android 项目
npx cap sync android
```

### 5. 打开 Android Studio

```bash
npx cap open android
```

### 6. 在 Android Studio 中生成 APK

1. 等待 Gradle 同步完成
2. 点击菜单 Build → Generate Signed Bundle / APK
3. 选择 APK，点击 Next
4. 创建或选择密钥库（Keystore）
   - 如果是第一次，点击 "Create new"
   - 填写密钥库路径、密码、别名等信息
5. 选择 release 版本，点击 Finish
6. APK 文件将生成在 `android/app/release/app-release.apk`

## 注意事项

1. **服务器必须可访问**：确保 43.139.43.112 可以被外网访问
2. **防火墙端口**：确保服务器的 80 端口开放
3. **HTTPS 建议**：正式环境建议配置 HTTPS，Android 9+ 默认禁止明文 HTTP 传输

## 快速命令（Windows CMD）

```batch
cd client
set VITE_API_URL=http://43.139.43.112/api
npm run build
npx cap sync android
npx cap open android
```

## 常见问题

### Android Studio 找不到 Gradle
- 确保已安装 Android Studio 和 Android SDK
- 在 Android Studio 中配置 SDK 路径

### 网络请求失败
- 检查 `android/app/src/main/AndroidManifest.xml` 是否包含网络权限
- Android 9+ 需要在 manifest 中配置允许明文传输
