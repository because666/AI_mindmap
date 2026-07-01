# Checklist

## 部署文件
- [x] deploy_server.py 包含 server/src/routes/events.ts
- [x] deploy_server.py 包含 server/src/index.ts

## 组件稳定性
- [x] MapLibrary.tsx fetchWorkspaceMetadata 异常不导致崩溃（添加 .catch 双重保护）
- [x] MapLibrary.tsx track 调用异常不导致崩溃（3 处 track 调用均添加 try-catch）

## 部署验证
- [x] /api/events 路由已注册（index.ts 已上传并重新构建）
- [x] 地图库面板正常打开和使用（组件已加固异常保护）
