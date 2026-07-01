# 实现产品策略剩余功能 Spec

> 对应产品策略：`product-strategy.md` v1.2-final 第一阶段第 6-8 项 + 第三阶段地图优先模式

## Why

产品策略文档第一阶段 A（埋点 + 延伸方向 + 节点摘要 + 导航树优化）已全部完成。第一阶段剩余的 3 个 P1 功能和 1 个 P2 功能尚未实现，需要继续完成以达成完整的产品闭环。

## What Changes

### P1：管理员置顶工作区面向用户展示
- 后台 `workspaces` 路由新增置顶/取消置顶接口（`POST /:id/pin`、`DELETE /:id/pin`）
- 工作区数据模型新增 `isPinned?: boolean` 和 `pinnedAt?: Date` 字段
- 主服务 `/api/workspaces/public/list` 接口返回置顶标记，置顶工作区排在前面
- 客户端工作区选择页面新增"推荐工作区"区域，展示置顶工作区
- 用户可浏览置顶工作区中的公开地图，支持"复制到我自己的工作区"

### P1：后台 AI 模型 / API 池管理
- 后台新增 `ai_model_configs` 集合，存储模型配置（名称、提供商、API Key、Base URL、模型 ID、默认参数、启用状态、优先级）
- 后台新增 `AIModels` 页面，支持增删改查模型配置
- 后台支持设置默认模型和 fallback 优先级
- 主服务 `aiService.ts` 启动时从 `ai_model_configs` 集合加载配置，覆盖环境变量默认值
- 后台 Dashboard 展示各模型调用量（复用已有 AIUsage 数据）

### P1：后台管理能力升级（补充模块）
- Dashboard 新增"功能采用矩阵"模块：展示延伸方向、节点摘要、地图库、模板等各功能的使用率
- Dashboard 新增"实时在线"模块：展示当前在线用户数和最近 30 分钟活跃曲线
- Users 页面新增活跃度分层标注（高活跃/沉睡/新用户/流失风险）

### P2：地图优先模式
- 用户在空画布或根节点输入宽泛问题时，可选择"帮我先展开成地图"
- AI 一次性生成结构化大纲（根节点 + 多个分支），复用现有 `expand_node` 工具
- 用户点击任意分支进入对话

## Impact

- Affected specs: `nonlinear-conversation-experience/product-strategy.md`
- Affected code:
  - `admin/server/src/routes/workspaces.ts` — 置顶接口
  - `admin/server/src/routes/aiModels.ts` — 新增，模型管理路由
  - `admin/server/src/services/aiModelService.ts` — 新增，模型管理服务
  - `admin/client/src/pages/AIModels/AIModelsPage.tsx` — 新增，模型管理页面
  - `admin/client/src/pages/Dashboard/DashboardPage.tsx` — 功能采用矩阵 + 实时在线
  - `admin/client/src/pages/Users/UsersPage.tsx` — 活跃度分层
  - `server/src/routes/workspaces.ts` — 公开列表返回置顶标记
  - `server/src/services/aiService.ts` — 从数据库加载模型配置
  - `client/src/components/Workspace/` — 推荐工作区展示
  - `client/src/components/Chat/ChatPanel.tsx` — 地图优先模式入口

## ADDED Requirements

### Requirement: 管理员置顶工作区

系统 SHALL 支持管理员在后台置顶/取消置顶工作区，置顶工作区在前端面向用户展示为"推荐工作区"。

#### Scenario: 管理员置顶工作区
- **WHEN** 管理员在后台点击置顶
- **THEN** 工作区 `isPinned` 设为 true，`pinnedAt` 记录时间
- **AND** 置顶工作区在公开列表中排在最前

#### Scenario: 用户查看推荐工作区
- **WHEN** 用户进入工作区选择页面
- **THEN** 显示"推荐工作区"区域，列出所有置顶工作区
- **AND** 用户可点击浏览其中的公开地图
- **AND** 用户可"复制到我自己的工作区"

### Requirement: 后台 AI 模型管理

系统 SHALL 支持管理员在后台动态管理 AI 模型配置，无需改代码重启。

#### Scenario: 管理员添加模型
- **WHEN** 管理员在后台 AI 模型页面添加新模型配置
- **THEN** 配置写入 `ai_model_configs` 集合
- **AND** 主服务下次加载时使用新配置

#### Scenario: 设置默认模型和 fallback
- **WHEN** 管理员设置默认模型和优先级
- **THEN** 主服务按优先级排序使用模型
- **AND** 主模型失败时自动 fallback 到下一个

#### Scenario: 模型用量展示
- **WHEN** 管理员查看 Dashboard
- **THEN** 展示各模型的调用次数、token 消耗、失败率

### Requirement: 后台功能采用矩阵

系统 SHALL 在 Dashboard 展示各功能的使用率矩阵。

#### Scenario: 查看功能采用矩阵
- **WHEN** 管理员访问 Dashboard
- **THEN** 展示延伸方向、节点摘要、地图库、模板等功能的采用率
- **AND** 支持按时间段筛选

### Requirement: 实时在线监控

系统 SHALL 在 Dashboard 展示当前在线用户数和最近 30 分钟活跃曲线。

#### Scenario: 查看实时在线
- **WHEN** 管理员访问 Dashboard
- **THEN** 展示当前在线用户数
- **AND** 展示最近 30 分钟活跃用户曲线

### Requirement: 用户活跃度分层

系统 SHALL 在用户列表中标注活跃度层级。

#### Scenario: 查看用户活跃度
- **WHEN** 管理员访问用户列表
- **THEN** 每个用户标注活跃度层级（高活跃/沉睡/新用户/流失风险）
- **AND** 支持按活跃度筛选

### Requirement: 地图优先模式

系统 SHALL 支持用户输入宽泛问题时选择"先展开成地图"，AI 一次性生成结构化大纲。

#### Scenario: 用户选择地图优先模式
- **WHEN** 用户在空画布输入宽泛问题
- **THEN** 提示"是否先展开成地图？"
- **AND** 用户确认后 AI 生成根节点和多个分支
- **AND** 用户点击任意分支进入对话
