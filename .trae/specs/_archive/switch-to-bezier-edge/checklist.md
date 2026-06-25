# 贝塞尔曲线集成 - 验收清单

## 曲线类型切换
- [x] `getBezierPath` 已替换 `getSmoothStepPath`
- [x] `RelationEdge` 使用 `getBezierPath` 生成路径
- [x] `edgeTypes` 注册键名为 `bezier`
- [x] `flowEdges` 中边 `type` 为 `'bezier'`
- [x] 复合节点边 `type` 为 `'bezier'`
- [x] `defaultEdgeOptions.type` 为 `'bezier'`
- [x] `connectionLineType` 为 `ConnectionLineType.Bezier`

## 编译验证
- [x] TypeScript 编译通过
- [x] 构建成功
