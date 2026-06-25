# 修复标题生成与结论提炼失效 Spec

## Why
当前用户在聊天面板中点击“提炼结论”会提示“结论提炼失败，请确保对话有足够内容”，同时生成标题也无法正常实现，影响 AI 思维导图的核心闭环：对话沉淀为节点标题与结论节点。

## What Changes
- 修复标题生成与结论提炼在流式端点改造后的客户端/服务端协议不一致问题。
- 修复结论提炼只依赖节点 ID 导致服务端拿不到足够消息内容时误判内容不足的问题。
- 强化标题生成和结论提炼的错误处理，让用户能看到可定位的失败原因。
- 补充对应单元测试或可执行验证用例，覆盖正常流程、内容不足、服务端错误和限流场景。

## Impact
- Affected specs: add-ai-priority-queue, implement-comprehensive-optimization
- Affected code: client/src/components/Chat/ChatPanel.tsx, client/src/services/chatService.ts, server/src/routes/conversations.ts, server/src/services/aiService.ts, client/src/stores/appStore.ts

## MODIFIED Requirements

### Requirement: 节点智能标题生成
系统 SHALL 在用户触发重新生成标题或首次有效 AI 回复后，基于当前节点最近对话内容生成简短、准确的中文标题，并将标题更新到当前节点。

#### Scenario: 标题生成成功
- **WHEN** 当前节点存在至少一轮有效对话内容，用户点击重新生成标题
- **THEN** 系统通过流式 AI 端点生成标题
- **AND** 当前节点标题被更新为生成结果
- **AND** 不出现空白、静默失败或错误 Toast

#### Scenario: 标题生成内容不足
- **WHEN** 当前节点没有足够消息内容用于生成标题
- **THEN** 系统不调用无效 AI 请求或在服务端明确拒绝
- **AND** 前端展示“标题生成失败，请先发送有效对话内容”等可理解提示

#### Scenario: 标题生成限流或服务异常
- **WHEN** 标题生成端点返回限流、网络错误或服务端错误
- **THEN** 前端展示可定位的失败提示
- **AND** 不影响用户继续发送普通对话消息

### Requirement: 结论提炼
系统 SHALL 基于当前节点完整有效对话内容提炼结论，并在成功后创建结论节点和结论关系。

#### Scenario: 结论提炼成功
- **WHEN** 当前节点存在足够对话内容，用户点击“提炼结论”
- **THEN** 系统通过流式 AI 端点生成结论文本
- **AND** 前端创建结论节点
- **AND** 结论节点与源节点建立 conclusion 关系
- **AND** 用户看到“结论提炼成功”反馈

#### Scenario: 结论提炼内容不足
- **WHEN** 当前节点有效对话内容不足以生成结论
- **THEN** 系统展示清晰提示，说明需要更多对话内容
- **AND** 不创建空结论节点

#### Scenario: 结论提炼服务异常
- **WHEN** 结论提炼端点返回错误、流式解析失败或 AI 返回空内容
- **THEN** 前端展示失败原因
- **AND** 页面不白屏、不阻塞输入、不破坏已有对话

### Requirement: 流式协议兼容
标题生成和结论提炼端点 SHALL 与客户端 SSE 解析逻辑保持一致。

#### Scenario: SSE done 事件解析
- **WHEN** 服务端完成标题或结论生成
- **THEN** 服务端发送客户端可解析的 done 事件数据
- **AND** 客户端能稳定读取最终 title 或 conclusion 字段

#### Scenario: SSE error 事件解析
- **WHEN** 服务端发生业务错误或异常
- **THEN** 服务端发送客户端可解析的 error 事件数据
- **AND** 客户端将错误转化为中文提示
