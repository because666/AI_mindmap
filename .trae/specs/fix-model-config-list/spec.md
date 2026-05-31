# 修复模型配置列表与切换 Spec

## Why
当前API配置面板存在严重交互缺陷：用户添加模型后看不到已保存的模型、无法在已保存的模型之间切换。原因是当前设计把模型配置当作"一次性设置"而非"可管理的配置列表"，自定义模型信息没有完整持久化，面板上也缺少模型列表展示和切换入口。

## What Changes
- 引入 `ModelConfig` 数据结构，完整持久化每个模型配置（名称、provider、modelId、apiKey、baseUrl等）
- Store中新增 `savedConfigs` 数组和 `activeConfigId` 字段
- API配置面板展示已保存的模型配置列表，点击切换当前使用的模型
- "内置服务"作为列表第一项，可随时切换回
- 每个配置项支持删除操作
- AddModelModal保存时写入 `savedConfigs` 数组

## Impact
- Affected code:
  - `client/src/types/index.ts` — 新增 ModelConfig 类型
  - `client/src/stores/apiConfigStore.ts` — 重构为 savedConfigs + activeConfigId 模式
  - `client/src/components/Settings/APIConfigPanel.tsx` — 增加模型配置列表展示和切换
  - `client/src/components/Settings/AddModelModal.tsx` — 保存逻辑改为写入 savedConfigs
  - `client/src/services/chatService.ts` — 从 activeConfig 读取配置

## ADDED Requirements

### Requirement: ModelConfig 数据结构
系统 SHALL 使用 ModelConfig 接口完整持久化每个模型配置。

```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  apiFormat?: 'openai' | 'zhipu' | 'anthropic' | 'deepseek';
  isCustom?: boolean;
  description?: string;
  isMultimodal?: boolean;
}
```

#### Scenario: 模型配置持久化
- **WHEN** 用户通过弹窗添加一个模型配置
- **THEN** 该配置以 ModelConfig 对象完整保存到 localStorage 的 savedConfigs 数组中
- **AND** 配置包含所有必要字段（名称、provider、modelId、apiKey等）

### Requirement: 模型配置列表展示
API配置面板 SHALL 展示所有已保存的模型配置列表。

#### Scenario: 展示已保存配置
- **WHEN** 用户打开API配置面板
- **THEN** 面板展示所有已保存的模型配置卡片
- **AND** 每个卡片显示：模型名称、服务商名称、描述（如有）
- **AND** 当前激活的配置卡片有高亮标识（如蓝色边框或勾选图标）

#### Scenario: 内置服务选项
- **WHEN** 模型配置列表展示时
- **THEN** 列表第一项为"系统内置服务"（智谱AI · glm-4-flash）
- **AND** 该项始终存在，不可删除

#### Scenario: 空列表状态
- **WHEN** 用户没有保存任何自定义模型配置
- **THEN** 列表仅显示"系统内置服务"一项
- **AND** 显示"添加模型配置"按钮

### Requirement: 模型配置切换
用户 SHALL 能在已保存的模型配置之间快速切换。

#### Scenario: 点击切换
- **WHEN** 用户点击列表中某个非激活的模型配置卡片
- **THEN** 该配置被激活为当前使用的模型
- **AND** 面板更新高亮状态
- **AND** 后续AI对话使用新激活的模型配置

#### Scenario: 切换回内置服务
- **WHEN** 用户点击"系统内置服务"选项
- **THEN** 当前配置切换回内置服务
- **AND** 后续AI对话使用内置服务

### Requirement: 模型配置删除
用户 SHALL 能删除已保存的模型配置。

#### Scenario: 删除配置
- **WHEN** 用户点击某个配置的删除按钮
- **THEN** 该配置从 savedConfigs 中移除
- **AND** 如果删除的是当前激活的配置，自动切换回内置服务

#### Scenario: 内置服务不可删除
- **WHEN** 用户查看"系统内置服务"选项
- **THEN** 该项不显示删除按钮

### Requirement: Store重构
apiConfigStore SHALL 使用 savedConfigs + activeConfigId 模式替代原有的 config + customModels 模式。

#### Scenario: Store数据结构
- **GIVEN** Store包含 `savedConfigs: ModelConfig[]` 和 `activeConfigId: string | null`
- **WHEN** `activeConfigId` 为 null
- **THEN** 使用内置服务
- **WHEN** `activeConfigId` 指向某个 savedConfig
- **THEN** 使用该配置的 provider/modelId/apiKey/baseUrl

#### Scenario: 数据迁移
- **WHEN** Store从旧版本（version 1）迁移到新版本（version 2）
- **THEN** 旧的 `config` 和 `customModels` 数据被迁移到 `savedConfigs` 数组
- **AND** 如果旧 config 有 apiKey，将其作为一条 ModelConfig 保存

## MODIFIED Requirements

### Requirement: AddModelModal保存逻辑
原逻辑：保存时调用 `setConfig()` 写入当前配置
新逻辑：保存时调用 `addSavedConfig()` 写入 savedConfigs 数组，并自动激活该配置

### Requirement: chatService读取配置
原逻辑：从 `config` 字段读取
新逻辑：从 `activeConfigId` 对应的 savedConfig 读取，如果 activeConfigId 为 null 则不传自定义配置（使用内置服务）

## REMOVED Requirements
无
