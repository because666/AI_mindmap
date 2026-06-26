# 缩小移动端节点连接点 Spec

## Why
在移动端（屏幕宽度 < 768px）上，思维导图节点的四个连接点（Handle）当前尺寸为 12px，并带有 16px 的 padding，导致圆点在屏幕上显得过大，遮挡节点标题与摘要内容，影响用户查看和操作体验。

## What Changes
- 缩小移动端节点连接点的视觉尺寸和触摸热区，使其在手机上更精致、不遮挡节点内容。
- 桌面端连接点尺寸保持不变，避免影响桌面用户的既有交互习惯。
- 保持连接点在选中时可见、未选中时低透明度的行为不变。
- 验证方式改为部署到线上服务器后，通过真实移动端浏览器或开发者工具移动端视口确认效果。

## Impact
- Affected specs: 无直接依赖的其他 spec。
- Affected code:
  - `client/src/components/Canvas/CanvasPage.tsx` 中的 `CustomNodeComponent` 及其 `baseHandleStyle` 计算逻辑。

## ADDED Requirements
### Requirement: 移动端连接点尺寸优化
The system SHALL 在移动端设备上将节点四个方向（top / left / right / bottom）连接点的视觉尺寸和触摸区域同时缩小，并保证仍可被手指点击。

#### Scenario: 移动端选中节点
- **WHEN** 用户在移动端点击选中节点
- **THEN** 节点四周显示缩小的连接点，不遮挡节点文本内容

#### Scenario: 移动端未选中节点
- **WHEN** 节点未被选中
- **THEN** 连接点保持较低透明度，且视觉尺寸与选中状态一致缩小

#### Scenario: 桌面端保持不变
- **WHEN** 用户在桌面端访问画布
- **THEN** 连接点保持现有 8px 尺寸和 0 padding，不受本次调整影响

### Requirement: 线上部署验证
The system SHALL 在代码修改后仅通过线上服务器进行效果验证，不依赖本地预览环境。

#### Scenario: 部署后验证
- **WHEN** 前端产物部署到线上服务器后
- **THEN** 在真实移动端设备或浏览器移动端视口中访问线上地址，确认连接点尺寸已明显缩小

## MODIFIED Requirements
无

## REMOVED Requirements
无
