# 将节点边曲线类型从SmoothStep切换为Bezier Spec

## Why

用户希望将思维导图节点之间的边从当前的圆角折线（smoothstep）切换为贝塞尔曲线（bezier），让边的弧度更自然流畅。流光效果暂不实现。

## What Changes

* 将 `RelationEdge` 组件中的 `getSmoothStepPath` 替换为 `getBezierPath`

* 将 `flowEdges` 中边的 `type` 从 `'smoothstep'` 改为 `'bezier'`

* 将 `defaultEdgeOptions` 中的 `type` 从 `'smoothstep'` 改为 `'bezier'`

* 将 `connectionLineType` 从 `ConnectionLineType.SmoothStep` 改为 `ConnectionLineType.Bezier`

* 将 `edgeTypes` 注册中的 `smoothstep` 键改为 `bezier`

* 将复合节点边的 `type` 从 `'smoothstep'` 改为 `'bezier'`

* 导入 `getBezierPath` 替换 `getSmoothStepPath`

## Impact

* Affected code: `client/src/components/Canvas/CanvasPage.tsx`

* 不影响节点拖拽、缩放、MiniMap、边标签等现有功能

***

## MODIFIED Requirements

### Requirement: 边曲线类型

边 SHALL 使用贝塞尔曲线（bezier）而非圆角折线（smoothstep）渲染节点之间的连线。

* 原实现：`getSmoothStepPath({ borderRadius: 16 })` + `type: 'smoothstep'`

* 修改后：`getBezierPath()` + `type: 'bezier'`

### Requirement: 连线预览类型

创建新连线时的预览线 SHALL 使用贝塞尔曲线。

* 原实现：`connectionLineType={ConnectionLineType.SmoothStep}`

* 修改后：`connectionLineType={ConnectionLineType.Bezier}`

