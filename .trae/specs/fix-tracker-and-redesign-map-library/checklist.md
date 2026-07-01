# Checklist

## Tracker 修复
- [ ] `buildTrackerEvent` 输出的事件结构：`eventType`、`timestamp`、`createdAt` 在顶层
- [ ] `/api/events` 接口返回 `{ success: true }`
- [ ] 控制台无 400/404 错误

## 地图实体后端
- [ ] `mapService.ts` 实现 createMap、getMaps、getMapById、updateMap、deleteMap
- [ ] 地图路由 `/api/workspaces/:workspaceId/maps` 注册并可访问
- [ ] 新建工作区时自动创建默认地图
- [ ] 节点创建时支持 `mapId` 参数
- [ ] 节点查询支持按 `mapId` 过滤

## 地图实体前端
- [ ] `mapApi` 封装地图 CRUD 接口
- [ ] `mapStore` 管理当前地图和地图列表
- [ ] 地图库面板展示当前工作区的地图（非工作区列表）
- [ ] 地图卡片显示名称、节点数、最后编辑时间
- [ ] 创建新地图功能正常
- [ ] 切换地图后画布更新为该地图的节点
- [ ] 切换地图后对话面板关联到新地图

## 部署验证
- [ ] deploy_server.py 文件列表包含所有新增/修改文件
- [ ] 服务器构建成功
- [ ] PM2 重启成功
- [ ] 健康检查通过
- [ ] `/api/events` 返回 200
- [ ] 地图库面板正常打开和使用
