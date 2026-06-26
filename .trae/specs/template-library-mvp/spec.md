# 模板库 MVP + 首次进入体验 Spec

## Why

新用户首次进入 DeepMindMap 时面对空白画布容易产生"不知道该做什么"的焦虑，产品策略指出"啊哈时刻"发生在用户第一次发现自己能自然地深入一个细节又能回到主线时。通过提供预置模板并在空工作区首次进入时展示模板库，可以让新用户从已有结构化内容开始，快速体验非线性对话价值。

## What Changes

- 新增系统内置模板数据文件 `client/src/data/systemTemplates.ts`，包含 4-6 个高频场景模板
- 每个模板包含标题、描述、标签、节点结构（初始节点与 1-2 级子节点）
- 新增 `TemplateLibrary` 组件，支持网格/列表展示、搜索、分类筛选
- 在空工作区首次进入时弹出 `TemplateLibrary` 模态框
- 选择模板后调用现有 `createWorkspace`/复制逻辑，将模板复制到当前工作区并打开
- 模板库提供"创建空白地图"入口，用户可跳过模板
- 在工作区画布界面新增"模板库"入口按钮，用户可随时打开
- 新增埋点：`template_library_opened`、`template_selected`、`blank_map_created`
- 不依赖后端变更，模板数据写死在前端（MVP 阶段）

## Impact

- Affected specs: nonlinear-conversation-experience、smart-branch-suggestion
- Affected code:
  - `client/src/data/systemTemplates.ts`（新增）
  - `client/src/components/TemplateLibrary/TemplateLibrary.tsx`（新增）
  - `client/src/components/Canvas/CanvasPage.tsx`（空状态检测 + 模板库入口）
  - `client/src/stores/visitorWorkspaceStore.ts`（模板复制到工作区逻辑）
  - `client/src/services/tracker.ts`（新增埋点常量）
  - `client/src/locales/template/zh.json` / `en.json`（新增 i18n）

## ADDED Requirements

### Requirement: 系统内置模板数据

系统 SHALL 提供 4-6 个预置模板，覆盖高频使用场景。

#### Scenario: 模板数据结构

- **WHEN** 系统加载模板库
- **THEN** 可读取每个模板的 id、title、description、tags、category、thumbnailColor、nodes 结构

#### Scenario: 模板节点结构

- **WHEN** 查看单个模板详情
- **THEN** 每个模板包含根节点标题、根节点摘要、1-3 个一级子节点标题
- **AND** 子节点带有预置引导问题，帮助用户第一次就触发 AI 回答和延伸方向

#### Scenario: MVP 模板列表

- **WHEN** 用户打开模板库
- **THEN** 至少看到以下模板：
  - DeepMindMap 使用指南（引导用户点击延伸方向、生成摘要）
  - Python 入门学习路径
  - 产品经理需求分析框架
  - 高并发系统设计
  - 创业想法验证清单

### Requirement: 模板库组件

系统 SHALL 提供可复用的模板库 UI 组件。

#### Scenario: 网格展示

- **WHEN** 用户打开模板库
- **THEN** 以卡片网格形式展示所有模板
- **AND** 每张卡片显示标题、描述、标签、主题色块

#### Scenario: 搜索模板

- **WHEN** 用户在模板库搜索框输入关键词
- **THEN** 实时过滤标题/描述/标签匹配的模板

#### Scenario: 分类筛选

- **WHEN** 用户点击分类标签（全部/学习/产品/技术/创业）
- **THEN** 仅显示该分类下的模板

#### Scenario: 模板详情预览

- **WHEN** 用户点击模板卡片
- **THEN** 展开显示模板详情：包含节点结构预览和"使用此模板"按钮

### Requirement: 空工作区首次进入体验

系统 SHALL 在新用户首次进入空工作区时展示模板库。

#### Scenario: 检测空工作区

- **WHEN** 用户进入工作区且该工作区没有任何节点/地图时
- **THEN** 自动弹出模板库模态框

#### Scenario: 选择模板

- **WHEN** 用户在弹出的模板库中选择模板并点击"使用此模板"
- **THEN** 将模板复制到当前工作区
- **AND** 自动创建对应节点结构
- **AND** 打开根节点进入对话视图
- **AND** 上报 `template_selected` 埋点

#### Scenario: 创建空白地图

- **WHEN** 用户点击"创建空白地图"
- **THEN** 关闭模板库，保留空白画布
- **AND** 后续进入该工作区不再自动弹出模板库
- **AND** 上报 `blank_map_created` 埋点

#### Scenario: 不再打扰

- **WHEN** 用户关闭模板库模态框（未选择模板也未创建空白地图）
- **THEN** 当前会话不再弹出
- **AND** 下次进入空工作区时再次弹出

### Requirement: 工作区内模板库入口

系统 SHALL 在工作区画布界面提供模板库入口。

#### Scenario: 入口按钮

- **WHEN** 用户在工作区画布页面
- **THEN** 在左侧工具栏或顶部栏可见"模板库"按钮
- **AND** 点击后打开模板库模态框
- **AND** 上报 `template_library_opened` 埋点

#### Scenario: 从入口选择模板

- **WHEN** 用户从工作区入口打开模板库并选择模板
- **THEN** 在当前工作区新建一个地图（而非覆盖当前地图）
- **AND** 自动切换到新地图

### Requirement: 模板复制逻辑

系统 SHALL 将模板节点结构复制到用户工作区。

#### Scenario: 复制流程

- **WHEN** 用户选择模板
- **THEN** 调用 `createWorkspace` 或等价逻辑，在当前工作区下创建新地图
- **AND** 根据模板 nodes 数据创建根节点和子节点
- **AND** 保持节点位置合理（根节点居中，子节点向右展开）

#### Scenario: 模板数据隔离

- **WHEN** 模板复制到用户工作区后
- **THEN** 用户对该地图的修改不影响系统内置模板
- **AND** 模板原始数据保持只读

## MODIFIED Requirements

### Requirement: 工作区创建流程

已有：用户进入工作区后直接进入空白画布。
新增：空工作区首次进入时优先展示模板库；用户选择模板或创建空白地图后才进入画布。

## REMOVED Requirements

无
