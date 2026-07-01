# 验证数据互通并构建 Android APK Spec

## Why

用户需要确认主网站数据（对话消息、埋点事件）已正确同步到后台，并希望将主网站打包成 APK 安装到手机使用。APK 应直接进入主网站，不需要后台的蜜罐/密码认证。

## 数据同步验证结果

已通过 MongoDB 直接查询确认数据互通正常：

| 集合 | 数据量 | 状态 |
|------|--------|------|
| messages | 376 条 | ✅ 包含用户/AI 对话内容 |
| conversations | 118 条 | ✅ 对话记录正常 |
| events | 4 条 | ✅ 修复埋点结构后新增 |
| PM2 日志 | `POST /api/events HTTP/1.1" 200` | ✅ 事件上报成功 |

后台已修复的 3 项数据互通问题：
1. 对话消息从 `messages` 集合查询（不再读空的 `conv.messages` 数组）
2. 埋点事件结构扁平化（与服务端 `events.ts` 校验逻辑对齐）
3. 仪表盘趋势缓存 TTL 从 5 分钟降到 1 分钟

## What Changes

- 构建并输出 Android Debug APK，基于现有 Capacitor 配置
- APK 通过 `server.url: 'https://deepmindmap.work'` 加载线上主网站
- 主网站使用访客 ID 自动认证（无蜜罐、无密码），APK 打开即用

## Impact

- Affected specs: check-fix-capacitor-mobile-and-guide-filing（Capacitor 构建流程已验证）
- Affected code: 无代码改动，仅构建产物

## ADDED Requirements

### Requirement: 构建 Android APK

系统 SHALL 通过 Capacitor 构建 Android Debug APK，加载线上主网站 `https://deepmindmap.work`，无需登录即可直接使用。

#### Scenario: 用户打开 APK

- **WHEN** 用户在手机上打开 APK
- **THEN** 应用加载 `https://deepmindmap.work` 主网站
- **AND** 自动生成访客 ID，无需输入密码或通过蜜罐验证
- **AND** 用户可正常使用思维导图、对话、模板库等功能

#### Scenario: 数据互通

- **WHEN** 用户在 APK 中产生对话消息或触发埋点事件
- **THEN** 数据写入 MongoDB 对应集合
- **AND** 后台管理界面可查看和分析这些数据
