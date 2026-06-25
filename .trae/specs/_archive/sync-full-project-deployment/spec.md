# 全项目同步部署修复 Spec

## Why
后台管理新增的 11 个功能模块（审计日志、管理员账户、用户分群、公告、搜索等）以及主应用的公告和功能特性接口，在服务器上因部署不完整导致全部 404 不可用。本地构建全部通过，但远程 dist 目录缺少新增路由的编译产物。

## What Changes
- 完整重新部署 admin/server/dist 到服务器，确保 5 个缺失路由模块（auditLogs、adminAccounts、userSegments、announcements、search）到位
- 完整重新部署 server/dist 到服务器，确保 2 个缺失路由模块（announcements、features）到位
- 重新部署 admin/client/dist 和 client/dist 到服务器
- 检查服务器 MongoDB 连接配置，确保主应用 MongoDB 可用
- 重启 PM2 进程并验证所有端点可访问

## Impact
- Affected specs: enhance-admin-cde, fix-title-conclusion-generation, add-ai-usage-dashboard
- Affected code: admin/server/dist/, server/dist/, admin/client/dist/, client/dist/

## ADDED Requirements

### Requirement: 完整部署同步
系统 SHALL 确保服务器上的编译产物与本地构建结果完全一致。

#### Scenario: 所有新增端点可访问
- **WHEN** 管理员访问后台新增页面（审计日志/管理员/用户分群/公告/导出中心）
- **THEN** 对应 API 端点返回 200 而非 404
- **AND** 页面数据正常加载

#### Scenario: 主应用新增端点可访问
- **WHEN** 主应用客户端请求 /api/announcements 或 /api/features
- **THEN** 端点正常返回数据

### Requirement: MongoDB 连接可用
主应用服务器 SHALL 成功连接 MongoDB。

#### Scenario: MongoDB 连接成功
- **WHEN** 主应用服务启动
- **THEN** 日志中不出现"MongoDB 未连接"警告
- **AND** 向量数据和对话存储功能正常

## MODIFIED Requirements

### Requirement: 部署流程
部署时 SHALL 上传完整的 dist 目录（而非仅 index.js），确保所有路由模块编译产物同步到位。
