# Tasks

- [x] Task 1: 将 CanvasPage.tsx 中的边曲线类型从 smoothstep 切换为 bezier
  - [x] 1.1 导入 `getBezierPath` 替换 `getSmoothStepPath`
  - [x] 1.2 `RelationEdge` 组件中 `getSmoothStepPath` 替换为 `getBezierPath`，移除 `borderRadius` 参数
  - [x] 1.3 `edgeTypes` 注册中 `smoothstep` 键改为 `bezier`
  - [x] 1.4 `flowEdges` 中边的 `type` 从 `'smoothstep'` 改为 `'bezier'`
  - [x] 1.5 复合节点边的 `type` 从 `'smoothstep'` 改为 `'bezier'`
  - [x] 1.6 `defaultEdgeOptions` 中 `type` 改为 `'bezier'`
  - [x] 1.7 `connectionLineType` 改为 `ConnectionLineType.Bezier`

- [x] Task 2: 编译验证
  - [x] 2.1 TypeScript 编译通过
  - [x] 2.2 构建成功

# Task Dependencies

- Task 2 依赖 Task 1
