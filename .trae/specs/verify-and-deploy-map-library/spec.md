# 核验并部署工作区地图库功能 Spec

## Why

工作区地图库功能已完成开发，需要在部署前进行全面系统的核验，确保新增代码无语法错误、无类型问题、无依赖缺失、功能逻辑正确，且不影响已有功能的正常运行。

## What Changes

- 对 workspace-map-library 功能涉及的所有文件进行 TypeScript 编译验证
- 对 client 和 server 执行全量单元测试回归
- 检查新增代码的类型安全性（无 any 类型）
- 检查 i18n 翻译键完整性
- 检查埋点事件常量与组件中使用的一致性
- 核验后端新增接口的路由顺序和中间件配置
- 核验前端组件的 import 路径和依赖关系
- 更新 deploy_server.py 文件列表（新增 MapLibrary.tsx）
- **用户确认无问题后**才执行部署

## Impact

- Affected specs: workspace-map-library
- Affected code:
  - `server/src/services/nodeService.ts`（新增 getNodeCount）
  - `server/src/routes/workspaces.ts`（新增 /mine/metadata 路由）
  - `client/src/services/api.ts`（新增 getMineMetadata）
  - `client/src/stores/visitorWorkspaceStore.ts`（新增 workspaceMetadata）
  - `client/src/components/Workspace/MapLibrary.tsx`（新建）
  - `client/src/components/Layout/MainLayout.tsx`（集成入口）
  - `client/src/services/tracker.ts`（新增埋点常量）
  - `client/src/locales/nav/zh.json`（新增翻译）
  - `client/src/locales/nav/en.json`（新增翻译）

## ADDED Requirements

### Requirement: 构建验证
系统 SHALL 通过 TypeScript 编译检查，无类型错误。

#### Scenario: 前端编译
- **WHEN** 执行 `npx tsc --noEmit` 在 client 目录
- **THEN** 零错误退出

#### Scenario: 后端编译
- **WHEN** 执行 `npx tsc --noEmit` 在 server 目录
- **THEN** 零错误退出

### Requirement: 单元测试回归
系统 SHALL 通过所有已有单元测试，确保新增代码不破坏已有功能。

### Requirement: 代码质量
新增代码 SHALL 无 any 类型、无硬编码敏感信息、ESLint 无 error。

### Requirement: 部署安全
部署 SHALL 仅在用户确认核验结果无问题后执行。

## MODIFIED Requirements

无

## REMOVED Requirements

无
