# 修复环境配置与凭据安全 Spec

## Why
本地 `server/.env` 缺少 SMTP、JPUSH、INTERNAL_API_TOKEN 等关键配置项（仅44行，而 `.env.example` 有72行），导致反馈邮件、推送通知等功能在本地无法正常工作。同时 `.env.example` 中包含真实API密钥（智谱AI、极光推送），存在凭据泄露风险。

## What Changes
- 修复 `server/.env.example`：将真实API密钥替换为占位符
- 补全 `server/.env` 缺失的配置项（使用占位符，需用户自行填写真实值）
- 修复 `admin/server/.env.example`：检查并替换真实凭据

## Impact
- Affected code:
  - `server/.env.example` — 凭据脱敏
  - `server/.env` — 补全缺失配置
  - `admin/server/.env.example` — 凭据检查

## ADDED Requirements

### Requirement: .env.example 凭据脱敏
系统SHALL在 `.env.example` 文件中使用占位符替代真实密钥，防止凭据泄露到版本控制。

#### Scenario: 智谱AI密钥
- **WHEN** 开发者查看 `.env.example`
- **THEN** `ZHIPU_API_KEY` 值为 `your-zhipu-api-key-here`，而非真实密钥

#### Scenario: 极光推送密钥
- **WHEN** 开发者查看 `.env.example`
- **THEN** `JPUSH_APPKEY` 值为 `your-jpush-appkey-here`，`JPUSH_MASTER_SECRET` 值为 `your-jpush-master-secret-here`

#### Scenario: 内部API令牌
- **WHEN** 开发者查看 `.env.example`
- **THEN** `INTERNAL_API_TOKEN` 值为 `your-internal-api-token-here`

### Requirement: server/.env 配置完整性
系统SHALL确保 `server/.env` 包含所有功能所需的配置项，缺失的配置使用空值或占位符。

#### Scenario: SMTP配置存在
- **WHEN** 反馈邮件功能启动
- **THEN** `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`FEEDBACK_EMAIL` 配置项存在于 `.env` 中

#### Scenario: JPUSH配置存在
- **WHEN** 推送服务启动
- **THEN** `JPUSH_APPKEY`、`JPUSH_MASTER_SECRET` 配置项存在于 `.env` 中