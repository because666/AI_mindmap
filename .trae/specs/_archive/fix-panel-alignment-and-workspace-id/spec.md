# 修复面板右边界偏移、用户消息对齐、工作区标识缺失 Spec

## Why

对话面板右边界仍未对齐屏幕右边界（面板渲染顺序错误导致被其他面板推挤），用户消息没有右对齐（flex-row-reverse + justify-end 逻辑冲突），提炼结论和生成标题功能报错"缺少工作区标识"（chatService 请求头缺少 X-Workspace-Id）。三个问题直接影响核心交互体验。

## What Changes

- 调整 MainLayout.tsx 中 ChatPanel 容器的渲染顺序，移到 HistoryPanel 和 MessageCenter 之后，确保右边界对齐屏幕右边界
- 为所有固定宽度面板容器添加 `flex-shrink-0`，防止 flex 布局压缩面板宽度
- 修复 ChatPanel.tsx 用户消息对齐：将 `flex-row-reverse justify-end` 改为 `flex-row-reverse justify-start`（在反转主轴下 justify-start 才是视觉右对齐）
- 在 chatService.ts 的 `buildHeaders` 函数中添加 `X-Workspace-Id` 请求头

## Impact

- Affected specs: fix-chatpanel-right-boundary-alignment（面板渲染顺序和 flex-shrink 补充）
- Affected code:
  - client/src/components/Layout/MainLayout.tsx — 面板渲染顺序调整
  - client/src/components/Chat/ChatPanel.tsx — 用户消息对齐修复
  - client/src/services/chatService.ts — 添加 X-Workspace-Id 请求头

---

## ADDED Requirements

### Requirement: ChatPanel 右边界精准对齐屏幕右边界

系统 SHALL 确保 ChatPanel 作为 main flex 容器的最后一个子项渲染，使其右边界始终对齐屏幕右边界。

#### Scenario: ChatPanel 单独打开时右边界对齐
- **WHEN** 仅 ChatPanel 打开，其他面板关闭
- **THEN** ChatPanel 右边界与屏幕右边界完全贴合

#### Scenario: 多面板同时打开时 ChatPanel 仍在最右侧
- **WHEN** ChatPanel 和 HistoryPanel 或 MessageCenter 同时打开
- **THEN** ChatPanel 仍然渲染在最右侧
- **AND** 其他面板渲染在 ChatPanel 左侧

### Requirement: chatService 请求头包含工作区标识

系统 SHALL 在 chatService 发出的所有请求中包含 X-Workspace-Id 请求头。

#### Scenario: 生成标题请求包含工作区标识
- **WHEN** 客户端调用生成标题接口
- **THEN** 请求头中包含 X-Workspace-Id
- **AND** 服务端 workspaceMemberAuth 中间件正常通过

#### Scenario: 提炼结论请求包含工作区标识
- **WHEN** 客户端调用提炼结论接口
- **THEN** 请求头中包含 X-Workspace-Id
- **AND** 服务端 workspaceMemberAuth 中间件正常通过

---

## MODIFIED Requirements

### Requirement: 用户消息右对齐

用户消息 SHALL 在对话面板中右对齐显示（头像在右侧，气泡在头像左侧）。

- 原实现：`flex-row-reverse justify-end` — 在 flex-row-reverse 下 justify-end 推向主轴终点（左侧），导致用户消息左对齐
- 修改后：`flex-row-reverse justify-start` — 在 flex-row-reverse 下 justify-start 推向主轴起点（右侧），实现视觉右对齐

### Requirement: 固定宽度面板不被 flex 压缩

所有固定宽度面板容器 SHALL 设置 `flex-shrink-0`，防止在 flex 布局中被压缩。

- 原实现：面板容器无 flex-shrink-0，可能被 flex 布局等比压缩
- 修改后：ChatPanel、HistoryPanel、MessageCenter 容器均添加 `flex-shrink-0`
