# 模板预置AI对话内容 Spec

## Why

当前地图模板只提供节点结构骨架（标题+可选摘要），用户选择模板后需要手动进入每个节点发起AI对话，使用门槛高、体验一般。用户期望选择模板后立即获得AI分析内容，而不是"空壳"思维导图。

## What Changes

- 扩展 `TemplateNode` 接口，新增 `presetQuestion` 字段，定义每个节点的预置引导问题
- 为 5 个内置模板的所有节点添加预置问题，覆盖各主题场景
- 修改 `createMapFromTemplate` 方法，模板创建后自动为每个节点发起AI对话
- 新增服务端批量对话创建接口（可选，或复用现有接口）
- 前端展示模板创建进度（正在为节点生成AI回答）
- 模板创建完成后，用户可以直接看到每个节点的AI分析内容

## Impact

- Affected specs: template-library-mvp（模板库基础功能）
- Affected code:
  - `client/src/data/templates.ts`（模板数据模型 + 预置问题）
  - `client/src/stores/nodeStore.ts`（createMapFromTemplate 方法）
  - `client/src/stores/chatStore.ts`（创建对话、发送消息）
  - `client/src/components/Canvas/CanvasPage.tsx`（模板库入口）
  - `client/src/components/Workspace/TemplateLibrary.tsx`（模板创建流程）

## ADDED Requirements

### Requirement: 模板节点预置问题

系统 SHALL 为每个模板节点提供预置的引导问题，用于自动发起AI对话。

#### Scenario: 模板节点包含预置问题

- **WHEN** 模板数据中定义了 `presetQuestion` 字段
- **THEN** 该字段为字符串，表示用户选择模板后自动发送给AI的问题

#### Scenario: 模板节点无预置问题

- **WHEN** 模板节点未定义 `presetQuestion`（向后兼容）
- **THEN** 该节点保持空对话状态，用户手动发起

### Requirement: 模板创建后自动发起AI对话

系统 SHALL 在用户选择模板后，自动为每个节点创建对话并发送预置问题。

#### Scenario: 选择模板后自动对话

- **WHEN** 用户点击模板卡片选择模板
- **THEN** 系统按顺序为每个节点：
  1. 创建新对话
  2. 将预置问题作为用户消息发送
  3. 接收AI回答并保存
  4. 更新节点的 conversationId
  5. 生成节点摘要（使用已有的 summary 功能）

#### Scenario: 显示创建进度

- **WHEN** 模板正在自动创建对话
- **THEN** 显示进度提示（如"正在为节点 2/5 生成AI回答..."）
- **AND** 用户可以随时取消剩余节点的对话创建

#### Scenario: 部分节点创建失败

- **WHEN** 某个节点的AI对话创建失败（网络错误、AI服务异常）
- **THEN** 跳过该节点，继续创建后续节点
- **AND** 创建完成后提示用户哪些节点需要手动对话

### Requirement: 优化模板创建体验

系统 SHALL 优化模板创建流程，提供更好的用户体验。

#### Scenario: 模板创建进度条

- **WHEN** 模板正在创建对话
- **THEN** 显示进度条，标注当前完成的节点数/总节点数

#### Scenario: 创建完成后自动选中根节点

- **WHEN** 模板创建完成
- **THEN** 自动选中根节点，展示根节点的AI对话内容

## MODIFIED Requirements

### Requirement: TemplateNode 数据结构

```typescript
// 修改前
interface TemplateNode {
  title: string;
  summary?: string;
  isRoot: boolean;
}

// 修改后
interface TemplateNode {
  title: string;
  summary?: string;
  isRoot: boolean;
  presetQuestion?: string;  // 新增：预置的引导问题
}
```

### Requirement: createMapFromTemplate 方法

现有方法只创建节点骨架，需要扩展为：
1. 创建节点（现有逻辑）
2. 为每个有 presetQuestion 的节点创建对话
3. 发送预置问题并接收AI回答
4. 更新节点的 conversationId
5. 生成节点摘要

## REMOVED Requirements

无

## Implementation Notes

### 模板预置问题设计原则

1. **开放式问题**：鼓励AI提供详细分析，而非简单回答"是/否"
2. **场景化**：问题应贴合模板主题，体现专业性
3. **引导性**：问题应引导用户深入思考，而非泛泛而谈
4. **可延续性**：问题应为后续对话留出空间

### 示例：Python入门模板预置问题

| 节点 | 预置问题 |
|------|----------|
| Python 入门 | "请为Python初学者提供一份完整的学习路线图，包括推荐的学习资源和实践项目" |
| 环境搭建 | "请详细介绍Python环境搭建的步骤，包括Python安装、IDE选择、虚拟环境配置" |
| 基础语法 | "请系统讲解Python基础语法，包括变量、数据类型、控制流、函数，并提供示例代码" |
| 核心概念 | "请深入讲解Python的核心概念，如列表推导式、装饰器、生成器、上下文管理器" |
| 实战项目 | "请推荐3个适合Python初学者的实战项目，包括项目需求、技术栈、学习目标" |

### 性能考虑

- 模板创建涉及多个AI对话，可能耗时较长
- 建议使用队列机制，按顺序创建对话，避免并发请求过多
- 考虑添加"跳过"选项，允许用户只创建部分节点的对话
