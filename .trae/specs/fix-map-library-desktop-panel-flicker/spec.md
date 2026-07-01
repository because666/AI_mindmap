# 修复桌面端地图库面板闪退 Spec

## Why

用户在桌面浏览器打开网站后，点击侧边栏“地图库”按钮，面板会先正常显示内容，但很快变得不可见；与此同时面板内的按钮依然可以被点击（盲点）。该问题只在桌面端出现，移动端正常——因为移动端使用 `fixed inset-0 z-50` 全屏浮层渲染，桌面端使用内联 flex 侧栏渲染，两条渲染路径的样式与过渡逻辑完全不同。

桌面端 `MapLibrary` 容器同时叠加了“宽度 + 透明度”过渡和“内部 opacity + pointer-events”切换，存在过渡冲突或状态翻转，导致面板渲染后短暂可见又消失。

## What Changes

- 排查并修复 `client/src/components/Layout/MainLayout.tsx` 中桌面端 `MapLibrary` 外层包装 `div` 的样式/过渡逻辑
- 排查并修复 `client/src/components/Workspace/MapLibrary.tsx` 根 `div` 的 `opacity` / `pointer-events` 切换与外层包装之间的冲突
- 确保桌面端打开地图库后面板保持可见且可正常交互；关闭后面板真正消失且不响应点击
- 不修改移动端渲染路径（已正常工作）

## Impact

- Affected specs: workspace-map-library、verify-and-deploy-map-library
- Affected code:
  - `client/src/components/Layout/MainLayout.tsx`（桌面端 MapLibrary 包装 div，约 1025-1035 行）
  - `client/src/components/Workspace/MapLibrary.tsx`（根 div 的 opacity/pointer-events 切换，约 153-158 行）

## ADDED Requirements

### Requirement: 桌面端地图库面板稳定显示

系统 SHALL 在桌面端（屏幕宽度 ≥ 768px）点击“地图库”按钮后，保持 `MapLibrary` 面板持续可见且可交互，直到用户主动关闭。

#### Scenario: 桌面端打开地图库

- **WHEN** 桌面端用户点击侧边栏“地图库”按钮
- **THEN** `MapLibrary` 面板从右侧滑入并稳定显示
- **AND** 面板内容（搜索框、地图列表、新建按钮）持续可见
- **AND** 面板内所有按钮可正常点击
- **AND** 不出现“先显示后消失”的闪烁

#### Scenario: 桌面端关闭地图库

- **WHEN** 用户点击地图库面板内的关闭按钮（X）
- **THEN** 面板平滑收起
- **AND** 收起后面板不响应点击
- **AND** 画布区域重新占满可用宽度

#### Scenario: 移动端不受影响

- **WHEN** 移动端用户点击“地图库”
- **THEN** 仍然使用 `fixed inset-0 z-50` 全屏浮层渲染（保持现状）
- **AND** 行为与之前一致

## MODIFIED Requirements

### Requirement: 桌面端 MapLibrary 包装容器样式

修改 `MainLayout.tsx` 中桌面端 `MapLibrary` 外层包装 `div`，避免“宽度过渡 + 透明度过渡 + 内部 opacity 切换”三者叠加导致的状态闪烁。具体修改方向（实现阶段确认）：

- 方案 A：外层包装只控制宽度（`transition-[width]`），不控制 opacity；由内层 `MapLibrary` 组件统一负责显隐
- 方案 B：外层包装保留宽度与 opacity，但移除内层 `MapLibrary` 根 div 的重复 opacity/pointer-events 切换，避免双重过渡冲突
- 方案 C：移除外层包装的 `transition-all`，改为只过渡 `width`，关闭时通过 `pointer-events-none` 立即禁用交互

实现阶段需通过浏览器实际复现确认根因后再选择最小改动方案。
