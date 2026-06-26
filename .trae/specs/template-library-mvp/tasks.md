# Tasks

> 对应 spec.md：模板库 MVP 与首次进入体验
> 范围：模板数据 + 模板库 UI + 首次进入触发 + 从模板创建地图 + 埋点

---

- [x] Task 1: 模板数据定义
  - [x] SubTask 1.1: 创建 `client/src/data/templates.ts`，定义 `TemplateData` 类型和 5 个内置模板（DeepMindMap 使用指南、Python 入门、产品需求分析、机器学习基础、创业想法验证）
  - [x] SubTask 1.2: 每个模板包含 `id`、`name`、`description`、`icon`、`nodes`（节点数组，含 title/summary/isRoot）、`relations`（关系数组，含 source/target/type）
  - [x] SubTask 1.3: 编写单元测试 `client/src/data/templates.test.ts`，验证模板数据完整性

- [x] Task 2: 从模板创建地图逻辑
  - [x] SubTask 2.1: 在 `nodeStore.ts` 中新增 `createMapFromTemplate(template: TemplateData)` 方法
  - [x] SubTask 2.2: 方法逻辑：遍历模板 nodes 创建节点 → 遍历模板 relations 创建关系 → 返回根节点 ID
  - [x] SubTask 2.3: 创建完成后自动切换到新地图（selectNode 选中根节点）

- [x] Task 3: 模板库 UI 组件
  - [x] SubTask 3.1: 创建 `client/src/components/Workspace/TemplateLibrary.tsx`，展示模板卡片网格
  - [x] SubTask 3.2: 每个卡片展示模板图标、名称、描述、节点数
  - [x] SubTask 3.3: 卡片点击触发 `createMapFromTemplate`，完成后关闭弹窗
  - [x] SubTask 3.4: 弹窗底部提供"创建空白地图"按钮和右上角关闭按钮
  - [x] SubTask 3.5: 新增 i18n 键到 `client/src/locales/canvas/zh.json` 和 `en.json`

- [x] Task 4: 首次进入触发与工具栏入口
  - [x] SubTask 4.1: 在 `CanvasPage.tsx` 中检测工作区无地图且用户未操作过时，自动弹出模板库
  - [x] SubTask 4.2: 在工作区工具栏新增"模板库"按钮（LayoutTemplate 图标），点击打开模板库弹窗
  - [x] SubTask 4.3: 使用 localStorage 记录用户是否已关闭过首次弹窗，避免重复打扰

- [x] Task 5: 模板使用埋点
  - [x] SubTask 5.1: 在 `client/src/services/tracker.ts` 新增 `TRACK_EVENT_TEMPLATE_USED` 常量
  - [x] SubTask 5.2: 用户选择模板创建地图成功后上报 `template_used`（载荷：templateId、templateName）— 在 createMapFromTemplate 内部上报

- [x] Task 6: 构建验证
  - [x] SubTask 6.1: TypeScript 编译通过、ESLint 通过、构建通过、单元测试通过

---

# Task Dependencies

- Task 1 是前置，Task 2 依赖 Task 1
- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 3
- Task 5 可与 Task 3/4 并行
- Task 6 依赖全部完成

# Parallelization

- 第一批：Task 1（模板数据 + 测试）
- 第二批：Task 2 + Task 5（创建逻辑 + 埋点常量，可并行）
- 第三批：Task 3（UI 组件）
- 第四批：Task 4（集成触发）
- 第五批：Task 6（验证）
