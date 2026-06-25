# 简化API配置面板 Spec

## Why
当前API配置面板过于复杂，模型管理流程繁琐（需手动添加模型、填写模型ID/名称/描述/Token数），与主流AI客户端的简洁体验差距大。用户反馈"很多框框不需要""很不友好"。需要参考业界优秀设计，将设置面板精简为日常快速切换，将复杂配置收敛到"添加模型"弹窗中。

## What Changes
- 重写API配置面板为极简模式：内置服务状态提示 + 当前配置摘要 + 创意度滑块 + 管理模型入口
- 新增"添加模型"弹窗组件，支持"模型服务商"和"自定义配置"两种模式
- 内置丰富的预设模型列表（智谱/OpenAI/Anthropic/DeepSeek各主流模型）
- 支持多模态模型标识
- 自定义配置模式支持：API格式选择、中转URL、模型ID、密钥
- 移除温度参数（用户认为不重要）
- 高级配置（上下文窗口等）暂不做

## Impact
- Affected code:
  - `client/src/components/Settings/APIConfigPanel.tsx` — 完全重写为精简面板
  - `client/src/components/Settings/AddModelModal.tsx` — 新增添加模型弹窗
  - `client/src/stores/apiConfigStore.ts` — 扩展store支持新数据结构
  - `client/src/utils/aiModels.ts` — 扩展内置模型列表
  - `client/src/types/index.ts` — 扩展类型定义
  - `server/src/services/aiService.ts` — 扩展支持deepseek provider
  - `server/src/routes/ai.ts` — 扩展模型列表接口

## ADDED Requirements

### Requirement: 精简API配置面板
设置面板中的API配置页 SHALL 只展示最精简的信息，复杂操作通过"管理模型"入口进入弹窗。

#### Scenario: 使用内置服务
- **WHEN** 用户没有配置自定义模型
- **THEN** 面板显示"当前使用系统内置AI服务"，展示当前服务商和模型名称

#### Scenario: 使用自定义配置
- **WHEN** 用户已配置自定义模型
- **THEN** 面板显示当前选中的模型名称和提供商

#### Scenario: 快速切换创意度
- **WHEN** 用户拖动创意度滑块
- **THEN** 实时更新temperature值（0-2范围），持久化到localStorage

### Requirement: 添加模型弹窗
系统 SHALL 提供"添加模型"弹窗，支持两种配置模式。

#### Scenario: 模型服务商模式
- **WHEN** 用户选择"模型服务商"标签
- **THEN** 显示：服务商选择下拉框、模型选择下拉框（该服务商的预设模型列表）、API密钥输入框
- **AND** 服务商切换时，模型列表自动更新

#### Scenario: 自定义配置模式（中转站）
- **WHEN** 用户选择"自定义配置"标签
- **THEN** 显示：API格式选择（OpenAI兼容/智谱/Anthropic/DeepSeek）、自定义请求地址输入框、模型ID输入框、API密钥输入框
- **AND** API格式决定请求体结构和鉴权方式

#### Scenario: 多模态标识
- **WHEN** 模型支持图片/文件输入
- **THEN** 在模型列表中显示"多模态"标签

### Requirement: 丰富的内置模型列表
系统 SHALL 内置主流AI模型，覆盖多个服务商。

#### 智谱AI预设模型
- glm-4-flash（免费高速）
- glm-4（旗舰版）
- glm-4v（多模态）
- glm-4-plus（增强版）

#### OpenAI预设模型
- gpt-4o（多模态旗舰）
- gpt-4o-mini（轻量版）
- gpt-4-turbo
- o1-preview（推理模型）
- o1-mini

#### Anthropic预设模型
- claude-3-5-sonnet-20241022（推荐）
- claude-3-opus-20240229
- claude-3-haiku-20240307

#### DeepSeek预设模型
- deepseek-chat（V3）
- deepseek-reasoner（R1推理）
- deepseek-coder

### Requirement: 数据结构扩展
系统 SHALL 支持新的API配置数据结构。

#### APIConfig扩展字段
```typescript
interface APIConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  apiFormat?: 'openai' | 'zhipu' | 'anthropic' | 'deepseek'; // 自定义配置模式使用
  temperature?: number; // 创意度，默认0.7
  isCustom?: boolean; // 是否自定义配置模式
}
```

#### AIModel扩展字段
```typescript
interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  maxTokens: number;
  description: string;
  isMultimodal?: boolean; // 是否多模态
  isPreset?: boolean; // 是否预设模型（不可删除）
}
```

## MODIFIED Requirements

### Requirement: AI服务提供商扩展
原类型：`AIProvider = 'zhipu' | 'openai' | 'anthropic'`
新类型：`AIProvider = 'zhipu' | 'openai' | 'anthropic' | 'deepseek'`

### Requirement: 服务端模型列表接口
原接口：`/api/ai/models` 返回固定数组
新接口：返回按服务商分组的模型列表，包含预设模型信息

### Requirement: 服务端AI服务扩展
原支持：openai、zhipu、anthropic
新支持：增加deepseek provider的默认模型和基础URL配置

## REMOVED Requirements

### Requirement: 手动添加模型表单（旧版）
**Reason**：新版通过弹窗统一处理，旧版的面板内表单不再需要
**Migration**：用户已有的自定义模型数据自动迁移到新结构

### Requirement: API基础地址展示（设置面板内）
**Reason**：精简面板不展示技术细节，中转URL在弹窗内配置
**Migration**：已有baseUrl数据保留，在弹窗编辑时可见
