# 节点边流光渐变效果 Spec

## Why

用户希望给思维导图节点之间的边添加流光渐变色彩效果，让边不再死板，增加呼吸感和视觉吸引力。之前的演示页面中，流光效果只是色块运动，用户认为不是真正的"流光"和"渐变"效果，需要重新设计更自然、更丝滑的流光渐变动画。

## What Changes

- 重写演示页面 `bezier-curve-demo.html`，实现真正的流光渐变效果
- 流光效果要求：不是色块运动，而是光线沿路径自然流动，带有渐变过渡和发光感
- 使用 SVG `<linearGradient>` + `<animate>` 或 CSS 动画实现光线沿路径流动
- 保持 Bezier 曲线作为基础路径形状

## Impact

- Affected code: `bezier-curve-demo.html`（演示页面，不集成到项目）
- 不修改 client/、server/、admin/ 等正式项目代码

---

## ADDED Requirements

### Requirement: 真正的流光渐变效果

演示页面 SHALL 展示沿 Bezier 曲线自然流动的光线效果，而非简单的色块运动。

#### Scenario: 用户观察流光效果
- **WHEN** 页面展示流光边
- **THEN** 光线沿 Bezier 曲线自然流动，从一端到另一端
- **AND** 光线有渐变过渡（亮→暗→亮），不是纯色块
- **AND** 光线带有发光/辉光效果（glow）
- **AND** 光线流动连续平滑，无跳跃感

#### Scenario: 多种流光效果对比
- **WHEN** 页面展示多种流光方案
- **THEN** 至少展示3种不同的流光实现方式供用户选择
- **AND** 每种方案都使用真正的渐变流光，而非色块运动

### Requirement: 保持项目色彩体系

流光颜色 SHALL 使用项目已有的关系类型颜色体系。

#### Scenario: 颜色与项目一致
- **WHEN** 流光展示不同关系类型的边
- **THEN** 颜色使用 RELATION_COLORS 中定义的颜色（绿色、红色、橙色、蓝色、紫色、青色、黄色）
- **AND** 流光在基础色上增加亮度和发光效果

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
