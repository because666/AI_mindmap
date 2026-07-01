# 核查服务器文件与本地一致性 Spec

## Why

之前多次部署出现过路径嵌套（`dist/dist/`）等问题，导致服务无法正常运行。需要全面核查服务器上所有部署目录的文件结构，确保与本地构建产物一致，不存在嵌套、遗漏或旧版本残留。

## What Changes

- 核查并修复以下 4 个部署目录的文件结构：
  1. 主网站前端：本地 `client/dist` ↔ 服务器 `/www/wwwroot/AI_mindmap/client/dist`
  2. 主网站后端：本地 `server/dist` ↔ 服务器 `/www/wwwroot/AI_mindmap/server/dist`
  3. 后台前端：本地 `admin/client/dist` ↔ 服务器 `/www/wwwroot/AI_mindmap/admin/client/dist`
  4. 后台后端：本地 `admin/server/dist` ↔ 服务器 `/www/wwwroot/AI_mindmap/admin/server/dist`
- 修复发现的任何路径嵌套、文件缺失、版本不一致问题
- 确保所有服务正常运行

## Impact

- Affected code: 无代码改动，仅部署产物核查与修复

## ADDED Requirements

### Requirement: 服务器文件一致性核查

系统 SHALL 确保服务器上所有部署目录的文件结构与本地最新构建产物完全一致，不存在路径嵌套、文件缺失或旧版本残留。

#### Scenario: 核查通过

- **WHEN** 对比服务器与本地文件
- **THEN** 4 个部署目录的文件结构一致
- **AND** 不存在 `dist/dist/` 路径嵌套
- **AND** 关键入口文件（index.html、index.js）在正确位置
- **AND** PM2 所有服务运行正常，健康检查返回 200
