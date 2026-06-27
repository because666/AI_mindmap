# 修复埋点路由 404 和地图库闪退 Spec

## Why

部署后出现两个问题：
1. `/api/events` 接口返回 404，导致埋点上报全部失败
2. 点击侧边栏"地图库"后面板闪退，无法正常使用

根本原因：`server/src/routes/events.ts` 和 `server/src/index.ts` 未在 `deploy_server.py` 文件列表中，导致服务器上的 `index.ts` 是旧版本，未注册 events 路由。地图库闪退可能是埋点 404 错误传播或元数据接口异常导致。

## What Changes

- 在 `deploy_server.py` 文件列表中补充 `server/src/routes/events.ts` 和 `server/src/index.ts`
- 在 MapLibrary 组件中添加错误边界保护，防止埋点或 API 异常导致组件崩溃
- 重新部署到生产服务器

## Impact

- Affected specs: workspace-map-library, verify-and-deploy-map-library
- Affected code:
  - `deploy_server.py`（补充缺失文件）
  - `client/src/components/Workspace/MapLibrary.tsx`（添加错误保护）

## ADDED Requirements

### Requirement: 埋点路由可用
系统 SHALL 正确注册 `/api/events` 路由，埋点上报返回 200。

### Requirement: 地图库面板稳定
系统 SHALL 在埋点或 API 异常时仍能正常展示地图库面板，不发生闪退。

## MODIFIED Requirements

无

## REMOVED Requirements

无
