# 修复埋点 400 + 重构地图库为独立实体 Spec

## Why

两个问题需要解决：

1. **埋点 400 错误**：Tracker 发送的事件结构（`commonProps` 包裹 `timestamp`、`visitorId`）与服务端 `validateEvent` 期望的扁平结构不匹配，导致所有事件上报失败
2. **地图库概念错误**：当前地图库展示的是工作区列表，但用户期望地图是工作区内的独立实体——一个工作区包含多个地图，每个地图承载不同方向的内容，避免所有节点混在一张图中

## What Changes

### 紧急修复

* 修复 tracker.ts 中 `buildTrackerEvent` 的数据结构，将 `commonProps` 中的字段展平到事件顶层

* 修复 MapLibrary 面板闪退问题（try-catch 保护已在上一轮添加，需排查其他原因）

### 架构重构：地图成为独立实体

* **数据模型**：新增 `Map` 实体，包含 `id`、`workspaceId`、`name`、`description`、`createdAt`、`updatedAt`

* **节点归属**：节点新增 `mapId` 字段，归属到具体地图而非直接归属工作区

* **层级关系**：用户 → 工作区(多对多) → 地图(一对多) → 节点(一对多)

* **后端 API**：新增地图 CRUD 接口

* **前端地图库**：展示当前工作区下的所有地图，支持创建、切换、搜索、排序

* **默认地图**：每个工作区自动创建一个默认地图，迁移现有节点

## Impact

* Affected specs: workspace-map-library, verify-and-deploy-map-library

* Affected code:

  * `client/src/services/tracker.ts`（修复数据结构）

  * `server/src/routes/events.ts`（验证逻辑适配）

  * `server/src/models/` 或 `server/src/services/`（新增 Map 服务）

  * `server/src/routes/`（新增地图路由）

  * `server/src/services/nodeService.ts`（节点增加 mapId）

  * `client/src/stores/`（新增 mapStore 或扩展现有 store）

  * `client/src/components/Workspace/MapLibrary.tsx`（重写为地图管理）

  * `client/src/services/api.ts`（新增地图 API）

  * `client/src/components/Layout/MainLayout.tsx`（地图库入口）

## ADDED Requirements

### Requirement: 埋点数据格式修复

Tracker 发送的事件数据 SHALL 符合服务端 `validateEvent` 的扁平结构要求。

#### Scenario: 事件上报成功

* **WHEN** Tracker 发送批量事件到 `/api/events`

* **THEN** 服务端返回 `{ success: true }`

### Requirement: 地图实体管理

系统 SHALL 支持在工作区内创建和管理多个独立地图。

#### Scenario: 创建地图

* **WHEN** 用户在地图库中点击"新建地图"

* **THEN** 在当前工作区下创建新地图

* **AND** 自动切换到新创建的地图

#### Scenario: 切换地图

* **WHEN** 用户在地图库中点击某个地图

* **THEN** 画布切换到该地图的节点视图

* **AND** 对话面板关联到该地图

#### Scenario: 默认地图

* **WHEN** 工作区首次创建时

* **THEN** 自动创建一个名为"主地图"的默认地图

* **AND** 现有节点自动归属到默认地图

### Requirement: 节点归属地图

所有节点 SHALL 归属到具体的地图，通过 `mapId` 字段关联。

#### Scenario: 新建节点归属当前地图

* **WHEN** 用户在画布中创建新节点

* **THEN** 节点自动关联当前地图的 `mapId`

#### Scenario: 切换地图后画布更新

* **WHEN** 用户切换到不同地图

* **THEN** 画布仅展示该地图下的节点

## MODIFIED Requirements

### Requirement: 地图库面板

地图库面板 SHALL 展示当前工作区下的所有地图（而非所有工作区）。

## REMOVED Requirements

### Requirement: 旧地图库设计

**Reason**：旧设计将工作区等同于地图，不符合用户的多地图需求
**Migration**：现有工作区自动创建默认地图，节点迁移 `mapId` 字段

<br />

<br />

先设计好一切，先把前置工作做好，这是一个比较大的重构，先不要写代码
