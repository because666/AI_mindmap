# 修复对话面板右边界不对齐 Spec

## Why

对话面板右边界没有对齐屏幕右边界，整体面板向左偏移，右侧出现空白区域。该问题在刷新页面后出现，影响视觉一致性和用户体验。

## What Changes

- ChatPanel 最外层容器添加 `w-full`，确保面板始终占满父容器宽度
- 消息列表容器添加 `scrollbar-gutter: stable`，预留滚动条空间，避免滚动条出现时内容宽度变化
- 消息行容器添加 `w-full`，确保每条消息行占满容器宽度
- 流式消息行、加载中消息行同样添加 `w-full`
- 输入区域添加 `w-full`，确保输入区域占满面板宽度
- ChatPanel 最外层容器添加 `min-w-0`，防止 flex 子元素最小宽度导致溢出

## Impact

- Affected specs: fix-streaming-delay-and-panel-position（补充面板宽度对齐修复）
- Affected code:
  - client/src/components/Chat/ChatPanel.tsx — 最外层容器、消息列表、消息行、输入区域
  - client/src/components/Layout/MainLayout.tsx — ChatPanel 容器（如需调整）

---

## ADDED Requirements

### Requirement: 对话面板右边界精准对齐屏幕右边界

系统 SHALL 确保对话面板右边界始终精准对齐屏幕右边界，无论页面刷新、面板打开/关闭、消息内容多少。

#### Scenario: 刷新页面后面板右边界对齐
- **WHEN** 用户刷新页面，面板自动打开
- **THEN** 面板右边界与屏幕右边界完全贴合
- **AND** 面板右侧无空白间隙

#### Scenario: 滚动条出现后面板宽度不变
- **WHEN** 消息内容增加，消息列表出现垂直滚动条
- **THEN** 面板整体宽度保持不变
- **AND** 内容区域宽度因滚动条预留空间而保持一致
- **AND** 不出现内容区域宽度跳动

#### Scenario: 面板打开/关闭过渡后右边界对齐
- **WHEN** 面板从关闭状态过渡到打开状态
- **THEN** 过渡完成后面板右边界与屏幕右边界完全贴合

---

## MODIFIED Requirements

### Requirement: ChatPanel 容器宽度约束

ChatPanel 最外层容器 SHALL 设置 `w-full min-w-0`，确保在 flex 布局中正确占满父容器宽度。

- 原实现：`className="h-full flex flex-col bg-dark-950/30 backdrop-blur-sm"`
- 修改后：`className="h-full w-full min-w-0 flex flex-col bg-dark-950/30 backdrop-blur-sm"`

### Requirement: 消息列表滚动条空间预留

消息列表容器 SHALL 使用 `scrollbar-gutter: stable` 预留滚动条空间，避免滚动条出现时内容宽度变化。

- 原实现：`className="flex-1 overflow-y-auto p-4 space-y-4 relative"`
- 修改后：添加 `style={{ scrollbarGutter: 'stable' }}`

### Requirement: 消息行宽度占满

所有消息行容器 SHALL 设置 `w-full`，确保每条消息行占满容器宽度。

- 原实现：`className="flex gap-3 justify-start"` 或 `className="flex gap-3 flex-row-reverse justify-end"`
- 修改后：添加 `w-full`
