# 修复粒子背景被遮挡 Spec

## Why
粒子网络背景已成功集成到项目中，但实际运行时几乎不可见。从用户截图可见，画布区域呈现纯深色（#020617），粒子效果被完全遮挡。根因是上层容器（MainLayout、CanvasPage、ReactFlow）均设置了不透明的深色背景色，覆盖了 z-index: -1 的 Canvas。

## What Changes
- 将粒子背景 Canvas 的 z-index 从 -1 改为 0
- 将 MainLayout 主容器的背景色从 `bg-dark-950/90` 改为透明或移除
- 将 CanvasPage 中 ReactFlow 画布的背景色改为透明
- 确保粒子背景在所有内容层之下、但在 body 背景之上可见

## Impact
- Affected specs: integrate-particle-background
- Affected code: DreamyUniverseBackground.tsx、MainLayout.tsx、CanvasPage.tsx

## ADDED Requirements

### Requirement: 粒子背景可见性
系统 SHALL 确保粒子网络背景在所有页面状态下均可见，不被上层元素遮挡。

#### Scenario: 用户进入工作区画布
- **WHEN** 用户进入工作区，显示 CanvasPage
- **THEN** 粒子网络背景应清晰可见，不被 ReactFlow 画布或 MainLayout 遮挡
- **AND** 上层 UI 元素（节点、侧边栏、ChatPanel）保持正常交互

## MODIFIED Requirements

### Requirement: 背景层级与透明度
- 粒子背景 Canvas：z-index 从 -1 改为 0，保持 fixed 定位
- MainLayout 主容器：移除或透明化背景色
- CanvasPage ReactFlow：背景色设为透明
- 各面板（ChatPanel、HistoryPanel 等）：保持自身背景色以确保内容可读
