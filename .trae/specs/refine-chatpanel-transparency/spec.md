# ChatPanel 透明化与缩略图恢复 Spec

## Why
ChatPanel 当前使用 `bg-dark-900/90` 半透明背景，视觉上仍然偏重，用户希望面板主体几乎透明、只有淡淡边框线，而输入区和按钮保持不透明。同时 MindMapThumbnail（节点切换缩略图）在透明布局下显示异常，需要恢复。

## What Changes
- ChatPanel 根容器从 `bg-dark-900/90 backdrop-blur-sm` 改为几乎透明（`bg-dark-900/20` 或更低），只保留淡淡边框线
- ChatPanel 节点信息头部改为透明，只保留底部边框分隔线
- ChatPanel 输入区保持不透明背景，确保控件清晰可见
- ChatPanel 内所有按钮/图标保持不透明样式
- MindMapThumbnail 背景改为完全不透明，确保在透明布局下清晰可见
- MainLayout 中 ChatPanel 外层容器同步调整为透明

## Impact
- Affected specs: transparent-floating-ui
- Affected code: ChatPanel.tsx、MindMapThumbnail.tsx、MainLayout.tsx

## ADDED Requirements

### Requirement: ChatPanel 主体透明化
系统 SHALL 将 ChatPanel 主体区域（消息列表区）设为几乎透明，只保留淡淡的边框线，让粒子背景透过面板可见。

#### Scenario: 用户查看 ChatPanel 消息区
- **WHEN** 用户打开 ChatPanel 查看消息列表
- **THEN** 消息区背景几乎透明，粒子背景可透过面板隐约可见
- **AND** 面板左右边缘有淡淡的边框线（border-dark-700/30 级别）
- **AND** 消息文字依然清晰可读

### Requirement: ChatPanel 输入区不透明
系统 SHALL 确保 ChatPanel 底部输入区域保持不透明背景，所有控件（附件按钮、输入框、文件按钮、发送按钮）清晰可见。

#### Scenario: 用户使用 ChatPanel 输入区
- **WHEN** 用户查看 ChatPanel 底部输入区域
- **THEN** 输入区有不透明背景（bg-dark-800 或类似）
- **AND** 所有按钮图标清晰可辨
- **AND** 输入框有明确的边框和背景色

### Requirement: MindMapThumbnail 恢复可见
系统 SHALL 确保 MindMapThumbnail 缩略图在透明布局下完全可见，背景完全不透明。

#### Scenario: 用户打开 ChatPanel
- **WHEN** 用户打开 ChatPanel
- **THEN** MindMapThumbnail 缩略图完全可见，背景不透明
- **AND** 可正常拖动、折叠/展开、点击切换节点

## MODIFIED Requirements

### Requirement: ChatPanel 容器透明化
MainLayout 中 ChatPanel 外层容器从 `bg-dark-900/90 backdrop-blur-sm` 改为几乎透明（`bg-dark-900/20`），边框从 `border-dark-700/50` 改为更淡的 `border-dark-700/30`。

### Requirement: ChatPanel 节点信息头部透明化
ChatPanel 内部节点信息头部从 `bg-dark-800` 改为透明或极低透明度，只保留底部边框作为分隔线。
