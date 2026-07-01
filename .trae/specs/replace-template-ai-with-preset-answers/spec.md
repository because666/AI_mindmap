# 模板预设答案替换AI调用 Spec

## Why
当前模板库点击模板后会调用AI为每个带预置问题的节点生成回答，AI响应缓慢导致进度弹窗长时间卡住，用户体验差。改为直接写入预设的问答对到对话历史，去掉AI调用和进度弹窗，实现"点击即完成"。

## What Changes
- 新建 `templateAnswers.ts` 数据文件，存储各模板节点的预设答案（中英文），与模板结构数据分离
- `TemplateNode` 接口新增 `presetAnswer` 可选字段（类型引用自新文件）
- 重构 `createPresetConversationsForTemplate`：移除 `conversationApi.sendMessage` 的AI调用，改为循环调用 `save-message` 接口直接写入 user + assistant 消息对
- 移除 `TemplateLibrary.tsx` 中的进度覆盖层（`isCreating` 状态、进度条、取消按钮）
- 模板选择弹窗保留，点击模板后瞬间完成节点创建和预设问答写入
- 预设答案支持多语言（zh/en），根据当前 i18n 语言选择对应答案
- **BREAKING**：`createPresetConversationsForTemplate` 的 `onProgress` 和 `shouldContinue` 参数不再需要（保留签名以避免破坏性变更，但不再使用）

## Impact
- Affected specs: `template-preset-ai-conversations`（原AI对话创建逻辑被替换）
- Affected code:
  - `client/src/data/templates.ts`（TemplateNode 类型扩展）
  - `client/src/data/templateAnswers.ts`（**新增**）
  - `client/src/stores/nodeStore.ts`（`createPresetConversationsForTemplate` 重构）
  - `client/src/components/Workspace/TemplateLibrary.tsx`（移除进度弹窗）
  - `client/src/data/templates.test.ts`（测试更新）

## ADDED Requirements

### Requirement: 预设答案数据存储
系统 SHALL 在独立的 `templateAnswers.ts` 文件中存储各模板节点的预设答案，与模板结构数据分离，支持中英文两种语言。

#### Scenario: 答案查询
- **WHEN** 系统需要获取某模板某节点的预设答案
- **THEN** 通过 `getPresetAnswer(templateId, nodeIndex, lang)` 函数查询
- **AND** 返回对应语言的答案文本
- **AND** 若该节点无预设答案，返回 `null`

#### Scenario: 多语言支持
- **WHEN** 当前 i18n 语言为英文
- **THEN** 写入对话历史的问答对使用英文版本
- **WHEN** 当前 i18n 语言为中文
- **THEN** 写入对话历史的问答对使用中文版本

### Requirement: 预设问答写入对话历史
系统 SHALL 在创建模板思维导图时，对每个带预置问题的节点，直接写入一对 user + assistant 消息到对话历史，不调用AI。

#### Scenario: 正常写入
- **WHEN** 用户点击模板且模板节点有预置问题和预设答案
- **THEN** 系统调用 `POST /:nodeId/save-message` 写入 user 消息（预置问题）
- **AND** 调用 `POST /:nodeId/save-message` 写入 assistant 消息（预设答案）
- **AND** 更新节点的 `conversationId`
- **AND** 更新节点的 `summary`（来自模板）
- **AND** 模板选择弹窗立即关闭

#### Scenario: 答案缺失容错
- **WHEN** 节点有预置问题但无预设答案（答案尚未编写）
- **THEN** 系统跳过该节点的对话写入
- **AND** 不阻塞其他节点的处理
- **AND** 控制台输出警告日志

## MODIFIED Requirements

### Requirement: 模板创建流程
原 `createPresetConversationsForTemplate` 通过 `conversationApi.sendMessage` 调用AI生成回答。修改为：直接调用 `conversationApi.saveMessage` 写入预设的问答对，不发起AI请求。`onProgress` 和 `shouldContinue` 参数保留但不再产生实际作用（兼容性保留）。

## REMOVED Requirements

### Requirement: 进度展示UI
**Reason**: 不再调用AI，写入预设问答耗时极短（1-2秒内完成所有节点），无需进度反馈。
**Migration**: `TemplateLibrary.tsx` 中移除 `isCreating`、`progress`、`cancelRef` 状态及对应的进度覆盖层 JSX。模板选择弹窗保留，点击后直接关闭。
