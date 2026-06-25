# 部署最新代码到服务器 Spec

## Why

P0/P1 安全加固与代码质量优化已完成并提交到本地 git。为了让线上服务运行最新代码，需要以离线方式将本地代码上传到服务器并重新启动服务。由于服务器网络不稳定，禁止从仓库直接拉取，必须采用本地打包 + scp/rsync 上传的方式。

## What Changes

- 在本地生成服务端、Admin 服务端、客户端的部署产物（或源码包）
- 将产物通过 scp/rsync 上传到服务器
- 在服务器上备份当前运行版本
- 解压/替换服务器上的代码
- 安装依赖并重新构建（如需要）
- 重启服务端与 Admin 服务进程
- 执行健康检查确认服务可用

## Impact

- Affected specs: p0-p1-security-quality-overhaul
- Affected code:
  - `server/` 主服务端
  - `admin/server/` 管理后台服务端
  - `client/dist/` 前端产物
  - 服务器上的 PM2/systemd 进程配置

## ADDED Requirements

### Requirement: 离线部署

The system SHALL provide a way to deploy the latest local code to a remote server without pulling from a git repository.

#### Scenario: 上传成功
- **WHEN** 本地代码被打包并通过 scp/rsync 上传到服务器
- **THEN** 服务器目标目录出现与本地一致的文件内容

### Requirement: 服务平滑重启

The system SHALL restart the server-side services after deployment and keep them running.

#### Scenario: 重启成功
- **WHEN** 部署脚本执行重启命令
- **THEN** PM2/systemd 中对应的进程进入 `online` 或 `active` 状态

### Requirement: 健康检查

The system SHALL verify that the main server and admin server respond correctly after restart.

#### Scenario: 健康检查通过
- **WHEN** 向 `/api/health` 或等效接口发起请求
- **THEN** 返回 HTTP 200 且响应体包含预期字段

## MODIFIED Requirements

### Requirement: 服务器配置

部署脚本 MAY 需要读取用户提供的 SSH 连接信息（IP、端口、用户名、私钥路径或密码）以及服务器上的部署路径和进程名称。

#### Scenario: 配置完整
- **WHEN** 用户在执行前提供准确的连接与部署信息
- **THEN** 脚本可自动完成上传与重启

## REMOVED Requirements

无。
