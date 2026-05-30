# 工作区面板毛玻璃圆角美化 Spec

## Why
从截图可见，左侧工作区面板（"工作区"信息面板）当前是直角边框 + 纯深色背景（`bg-dark-900`），与整体的透明浮动UI风格不协调。用户希望将其改为圆角毛玻璃效果，与右侧ChatPanel的毛玻璃风格统一。

## What Changes
- 工作区面板外层容器从直角 `bg-dark-900` 改为圆角毛玻璃（`rounded-2xl` + `backdrop-blur-sm` + 半透明背景）
- 工作区面板改为浮动式布局（从贴边改为有外边距悬浮），增强层次感
- 面板内部各区块（工作区信息卡片、切换列表、底部按钮）同步调整圆角和边框
- 保持现有功能不变（展开/收起、工作区切换、设置等）

## Impact
- Affected specs: transparent-floating-ui, fix-chatpanel-input-visibility
- Affected code: MainLayout.tsx (renderWorkspacePanel)

## ADDED Requirements

### Requirement: 工作区面板毛玻璃圆角化
系统 SHALL 将工作区信息面板改为圆角毛玻璃浮动面板样式。

#### Scenario: 用户查看工作区面板
- **WHEN** 用户点击侧边栏工作区图标打开面板
- **THEN** 面板以圆角（`rounded-2xl`）毛玻璃（`backdrop-blur-sm` + 半透明背景）样式显示
- **AND** 面板与左侧边栏有适当间距（悬浮效果）
- **AND** 面板内部各区块保持清晰可辨
- **AND** 关闭面板后不影响其他UI元素

### Requirement: 工作区面板内部区块样式统一
系统 SHALL 将面板内部的工作区信息卡片、切换列表项、底部按钮等元素的圆角和边框风格统一。

#### Scenario: 用户查看面板内部
- **WHEN** 用户查看工作区信息卡片
- **THEN** 卡片有圆角和淡淡的边框线
- **AND** 切换工作区列表项有圆角和hover效果
- **AND** 底部按钮有圆角和hover效果

## MODIFIED Requirements

### Requirement: 工作区面板容器样式
工作区面板外层容器从 `bg-dark-900 border-r border-dark-700` 改为浮动毛玻璃样式。
