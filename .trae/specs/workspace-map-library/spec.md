# 工作区地图库 Spec

## Why

当前用户进入工作区后直接进入画布，缺乏对所有地图的概览和管理。虽然 WelcomePage 有工作区列表，但缺少搜索、排序、节点数/最后编辑时间等元数据展示。用户难以快速找到并继续之前的地图，跨会话价值低。

## What Changes

- 在 MainLayout 侧边栏新增"地图库"入口，点击弹出地图库面板
- 地图库面板展示用户所有工作区（地图）列表，包含节点数、最后编辑时间、创建时间
- 支持按标题搜索地图
- 支持按最近编辑、创建时间排序
- 点击地图可直接切换到该工作区
- 支持创建新地图（复用现有创建工作区逻辑）
- 新增埋点事件 `map_library_opened`、`map_library_search`、`map_library_switch`

## Impact

- Affected specs: nonlinear-conversation-experience（工作区地图管理）
- Affected code:
  - `client/src/components/Workspace/MapLibrary.tsx`（新增，地图库面板组件）
  - `client/src/components/Layout/MainLayout.tsx`（新增地图库入口按钮）
  - `client/src/services/api.ts`（扩展 workspaceApi，获取节点数等元数据）
  - `client/src/stores/visitorWorkspaceStore.ts`（扩展状态和方法）
  - `client/src/locales/`（新增 i18n 键）

## ADDED Requirements

### Requirement: 地图库面板

系统 SHALL 提供地图库面板，展示用户所有工作区（地图）的列表和元数据。

#### Scenario: 打开地图库

- **WHEN** 用户点击 MainLayout 侧边栏的"地图库"按钮
- **THEN** 弹出地图库面板，展示用户所有工作区列表
- **AND** 每个工作区显示名称、节点数、最后编辑时间
- **AND** 上报 `map_library_opened` 埋点

#### Scenario: 搜索地图

- **WHEN** 用户在搜索框输入关键词
- **THEN** 实时过滤工作区列表，匹配名称
- **AND** 上报 `map_library_search` 埋点

#### Scenario: 排序地图

- **WHEN** 用户选择排序方式（最近编辑 / 创建时间）
- **THEN** 列表按选定方式重新排序

#### Scenario: 切换地图

- **WHEN** 用户点击某个地图卡片
- **THEN** 切换到该工作区
- **AND** 关闭地图库面板
- **AND** 上报 `map_library_switch` 埋点

#### Scenario: 创建新地图

- **WHEN** 用户点击"新建地图"按钮
- **THEN** 创建新工作区并切换到该工作区

### Requirement: 地图元数据

系统 SHALL 为每个地图展示关键元数据。

#### Scenario: 展示节点数

- **WHEN** 地图库加载完成
- **THEN** 每个地图卡片显示节点数量

#### Scenario: 展示最后编辑时间

- **WHEN** 地图库加载完成
- **THEN** 每个地图卡片显示最后编辑时间（相对时间，如"昨天"、"3天前"）

## MODIFIED Requirements

### Requirement: MainLayout 侧边栏

在现有侧边栏工具栏中新增"地图库"按钮（Map 图标），位于工作区名称下方。

## REMOVED Requirements

无
