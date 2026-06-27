# Checklist

## 部署文件
- [ ] deploy_server.py 包含 server/src/routes/events.ts
- [ ] deploy_server.py 包含 server/src/index.ts

## 组件稳定性
- [ ] MapLibrary.tsx fetchWorkspaceMetadata 异常不导致崩溃
- [ ] MapLibrary.tsx track 调用异常不导致崩溃

## 部署验证
- [ ] /api/events 返回 200
- [ ] 地图库面板正常打开和使用
