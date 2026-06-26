# 模板库 MVP 与首次进入体验 Spec

## Why

新用户进入空工作区时面对空白画布，不知道该做什么，缺乏"啊哈时刻"的引导。产品策略指出需要提供 3-5 个预置模板，让新用户第一次进入就能选择模板开始非线性对话体验，缩短到啊哈时刻的时间。

## What Changes

- 新增前端模板库组件 `client/src/components/Workspace/TemplateLibrary.tsx`，展示预置模板卡片
- 新增模板数据定义 `client/src/data/templates.ts`，包含 5 个内置模板的完整节点结构
- 在工作区首次进入（无地图）时自动弹出模板库弹窗，提供"从模板开始"和"创建空白地图"两个选项
- 选择模板后自动复制模板节点结构到新地图并打开
- 新增 `template_used` 埋点事件，追踪模板选择
- 在工作区工具栏新增"模板库"入口按钮，允许用户随时打开模板库

## Impact

- Affected specs: nonlinear-conversation-experience（冷启动路径优化）
- Affected code:
  - `client/src/components/Workspace/`（新增 TemplateLibrary 组件）
  - `client/src/data/templates.ts`（新增，模板数据）
  - `client/src/stores/appStore.ts` / `nodeStore.ts`（新增从模板创建地图方法）
  - `client/src/components/Canvas/CanvasPage.tsx`（空状态触发模板库）
  - `client/src/services/tracker.ts`（新增 template_used 事件）
  - `client/src/locales/workspace/`（新增 i18n）

## ADDED Requirements

### Requirement: 内置模板数据

系统 SHALL 提供 5 个预置模板，每个模板包含完整的节点结构。

#### Scenario: 模板内容

- **WHEN** 系统加载模板库
- **THEN** 展示以下 5 个模板：
  1. "DeepMindMap 使用指南"：介绍非线性对话用法，含 3-4 个示例节点
  2. "Python 入门学习路径"：Python 基础知识树，含 4-5 个节点
  3. "产品需求分析框架"：产品分析模板，含 3-4 个节点
  4. "机器学习基础概念"：ML 入门知识树，含 4-5 个节点
  5. "创业想法验证清单"：创业验证流程，含 3-4 个节点

### Requirement: 首次进入空工作区展示模板库

系统 SHALL 在用户首次进入无地图的空工作区时，自动弹出模板库弹窗。

#### Scenario: 首次进入空工作区

- **WHEN** 用户进入一个没有任何地图的工作区
- **AND** 该用户从未在此工作区创建过地图
- **THEN** 自动弹出模板库弹窗，展示模板卡片列表
- **AND** 弹窗底部提供"创建空白地图"选项

#### Scenario: 用户选择模板

- **WHEN** 用户在模板库中点击某个模板卡片
- **THEN** 创建新地图，标题为模板名称
- **AND** 将模板中的所有节点和关系复制到新地图
- **AND** 自动切换到新地图的画布
- **AND** 上报 `template_used` 埋点（载荷：templateId、templateName、workspaceId）
- **AND** 关闭模板库弹窗

#### Scenario: 用户选择创建空白地图

- **WHEN** 用户点击"创建空白地图"按钮
- **THEN** 创建一个空的空白地图
- **AND** 自动切换到新地图画布
- **AND** 关闭模板库弹窗

#### Scenario: 用户关闭弹窗

- **WHEN** 用户点击弹窗右上角关闭按钮
- **THEN** 弹窗关闭，不创建任何地图
- **AND** 用户停留在空工作区

### Requirement: 工具栏模板库入口

系统 SHALL 在工作区工具栏中提供"模板库"入口按钮，允许用户随时打开模板库。

#### Scenario: 从工具栏打开模板库

- **WHEN** 用户点击工具栏中的"模板库"按钮
- **THEN** 弹出模板库弹窗
- **AND** 用户选择模板后，将模板内容复制到一个新的地图中

### Requirement: 模板使用埋点

系统 SHALL 追踪用户使用模板的行为。

#### Scenario: 模板使用上报

- **WHEN** 用户选择某个模板并成功创建地图
- **THEN** 上报 `template_used` 事件
- **AND** 载荷包含 `templateId`、`templateName`、`workspaceId`、`mapId`

## MODIFIED Requirements

### Requirement: 工作区空状态

原有空状态仅显示"创建新地图"按钮。修改为：空状态时自动触发模板库弹窗，同时在空状态页面保留"创建空白地图"和"从模板开始"两个入口。
