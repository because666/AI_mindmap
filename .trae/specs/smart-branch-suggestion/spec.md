# 输入框智能分叉提示 Spec

## Why

当前用户在节点对话中追问细节时，倾向于直接在当前节点线性追问，导致主线被污染。产品策略指出"用户不是不想用分支，而是分支对他们来说是额外功能"。需要在用户输入问题时，主动识别"深入子主题"意图，提示用户一键创建分支，把线性追问转化为非线性探索。

## What Changes

- 新增前端智能分叉检测工具 `client/src/utils/branchSuggestion.ts`，基于规则匹配判断用户输入是否适合分叉
- 在 `ChatPanel.tsx` 输入框区域新增轻量提示气泡，展示"是否创建分支"的确认文案
- 用户确认后自动调用 `createChildNode` 创建子节点并带入问题
- 用户可忽略提示，直接在当前节点发送
- 新增 `branch_suggestion_shown`、`branch_suggestion_accepted`、`branch_suggestion_dismissed` 三个埋点事件
- 规则匹配不调用模型，零额外 AI 成本

## Impact

- Affected specs: nonlinear-conversation-experience（延伸方向按钮、节点摘要的后续增强）
- Affected code:
  - `client/src/components/Chat/ChatPanel.tsx`（输入框提示 UI + 交互）
  - `client/src/utils/branchSuggestion.ts`（新增，规则检测核心）
  - `client/src/services/tracker.ts`（新增 3 个事件常量）
  - `client/src/locales/chat/zh.json` / `en.json`（新增 i18n 键）

## ADDED Requirements

### Requirement: 智能分叉检测

系统 SHALL 在用户输入问题时，基于规则匹配判断该问题是否更适合作为子节点的独立分支。

#### Scenario: 命中深入关键词

- **WHEN** 用户输入包含"详细解释""深入讲解""展开讲讲""具体说说"等关键词
- **THEN** 触发分叉提示，提示文案包含提取的子主题

#### Scenario: 命中对比类关键词

- **WHEN** 用户输入包含"有什么区别""有什么不同""对比"等关键词
- **THEN** 触发分叉提示

#### Scenario: 语义偏离

- **WHEN** 用户问题中提到的核心概念与当前节点标题交集较低（如当前节点是"泰勒展开"，用户问"麦克劳林展开是什么"）
- **THEN** 触发分叉提示，提示文案包含偏离的核心概念

#### Scenario: 连续追问

- **WHEN** 用户连续 2 轮以上追问同一子主题
- **THEN** 触发分叉提示

#### Scenario: 不命中任何规则

- **WHEN** 用户输入是正常跟进，不匹配任何深入/对比/偏离规则
- **THEN** 不显示提示，不干扰用户正常对话

### Requirement: 分叉提示 UI

系统 SHALL 在输入框上方显示轻量提示气泡，不阻塞用户输入。

#### Scenario: 显示提示

- **WHEN** 分叉检测命中
- **THEN** 在输入框上方显示提示气泡，包含"创建分支"按钮和"忽略"按钮
- **AND** 提示文案格式为："这个问题更像是在聊'{子主题}'，是否创建一个分支？"

#### Scenario: 用户点击创建分支

- **WHEN** 用户点击"创建分支"按钮
- **THEN** 自动创建子节点，标题为提取的子主题
- **AND** 自动切换到子节点
- **AND** 自动将用户的问题发送给子节点的 AI 对话
- **AND** 上报 `branch_suggestion_accepted` 埋点

#### Scenario: 用户忽略提示

- **WHEN** 用户点击"忽略"按钮或直接发送消息
- **THEN** 提示消失，消息正常发送到当前节点
- **AND** 上报 `branch_suggestion_dismissed` 埋点

#### Scenario: 提示频率控制

- **WHEN** 用户在当前节点已忽略过一次分叉提示
- **THEN** 当前节点后续输入不再触发提示，避免打扰

### Requirement: 分叉建议埋点

系统 SHALL 对分叉提示的展示、接受、忽略进行埋点。

#### Scenario: 提示展示

- **WHEN** 分叉提示气泡显示
- **THEN** 上报 `branch_suggestion_shown` 事件，载荷包含 `nodeId`、`suggestionText`、`triggerRule`

#### Scenario: 提示接受

- **WHEN** 用户点击"创建分支"
- **THEN** 上报 `branch_suggestion_accepted` 事件，载荷包含 `nodeId`、`childNodeId`、`suggestionText`

#### Scenario: 提示忽略

- **WHEN** 用户点击"忽略"或直接发送
- **THEN** 上报 `branch_suggestion_dismissed` 事件，载荷包含 `nodeId`、`suggestionText`

## MODIFIED Requirements

### Requirement: 延伸方向点击后自动发送问题

已有：点击延伸方向按钮后自动创建子节点并发送问题"请详细讲解：{方向文本}"。
新增：智能分叉提示接受后，同样自动创建子节点并发送用户原始输入的问题。两者复用同一套子节点创建+发送流程。
