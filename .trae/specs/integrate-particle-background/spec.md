# 集成粒子网络背景 Spec

## Why
当前项目使用纯 CSS 渐变背景（替换了之前的 Three.js 粒子背景），视觉上过于单调，缺乏品牌辨识度和交互感。background-demo 中的 Canvas 2D 粒子网络效果（80 粒子 + 连线 + 鼠标交互 + 流光渐变）是性能与视觉的最佳平衡点，需要将其集成到项目中。

## What Changes
- 将 background-demo/index.html 中的粒子网络逻辑移植为 React 组件，替换当前的 MinimalBackground
- 保持文件名 DreamyUniverseBackground.tsx 不变（避免修改 App.tsx 导入路径）
- 移除 Three.js 相关的残留依赖（如 @react-three/fiber 等）
- 粒子参数使用基础版配置（80 粒子 + 流光渐变），不使用增强版（270 粒子）

## Impact
- Affected specs: polish-ui-ux（背景组件替换）
- Affected code: DreamyUniverseBackground.tsx、App.tsx（无需修改导入）

## ADDED Requirements

### Requirement: Canvas 2D 粒子网络背景
系统 SHALL 使用 Canvas 2D 渲染粒子网络背景，替代当前的纯 CSS 渐变背景。

#### Scenario: 用户访问网站
- **WHEN** 用户访问网站任意页面
- **THEN** 背景呈现深色底色 + 缓慢漂移的流光渐变 + 80 个蓝色粒子 + 粒子间连线
- **AND** 粒子网络不影响页面交互（pointer-events: none）

#### Scenario: 用户移动鼠标
- **WHEN** 用户在页面上移动鼠标
- **THEN** 鼠标附近 120px 内的粒子受到轻微排斥力
- **AND** 鼠标与附近粒子之间绘制连线

#### Scenario: 低端设备帧率不足
- **WHEN** 背景渲染帧率连续 3 秒低于 30fps
- **THEN** 自动将粒子数量从 80 减少到 40
- **AND** 降级后不自动恢复

## MODIFIED Requirements

### Requirement: 背景组件实现方式
将 MinimalBackground（纯 CSS 渐变）替换为 ParticleNetworkBackground（Canvas 2D 粒子网络），文件名保持 DreamyUniverseBackground.tsx 不变。

## REMOVED Requirements
（无）
