# Tasks

> 对应 spec.md：模板库 MVP + 首次进入体验
> 范围：系统内置模板 + 模板库组件 + 首次进入弹窗 + 工作区入口 + 埋点

---

- [ ] Task 1: 系统内置模板数据
  - [ ] SubTask 1.1: 创建 `client/src/data/systemTemplates.ts`，定义 `SystemTemplate` 类型
  - [ ] SubTask 1.2: 实现 5 个 MVP 模板：DeepMindMap 使用指南、Python 入门、产品经理需求分析、高并发系统、创业想法验证
  - [ ] SubTask 1.3: 每个模板包含根节点、1-3 个子节点、引导问题、节点位置

- [ ] Task 2: 模板库组件
  - [ ] SubTask 2.1: 创建 `client/src/components/TemplateLibrary/TemplateLibrary.tsx`
  - [ ] SubTask 2.2: 实现网格卡片展示（标题、描述、标签、主题色）
  - [ ] SubTask 2.3: 实现搜索过滤功能
  - [ ] SubTask 2.4: 实现分类筛选（全部/学习/产品/技术/创业）
  - [ ] SubTask 2.5: 实现模板详情展开/预览节点结构
  - [ ] SubTask 2.6: 实现"使用此模板"和"创建空白地图"按钮

- [ ] Task 3: 模板复制到工作区逻辑
  - [ ] SubTask 3.1: 在 `visitorWorkspaceStore.ts` 或新建 `templateStore.ts` 中实现 `applyTemplate(templateId, workspaceId)` 方法
  - [ ] SubTask 3.2: 创建新地图（workspace）并设置为当前地图
  - [ ] SubTask 3.3: 根据模板 nodes 数据创建根节点和子节点，设置合理位置
  - [ ] SubTask 3.4: 创建完成后自动选中根节点并打开对话视图

- [ ] Task 4: 空工作区首次进入体验
  - [ ] SubTask 4.1: 在 `CanvasPage.tsx` 中检测当前工作区是否为空（无节点）
  - [ ] SubTask 4.2: 空状态时自动弹出 `TemplateLibrary` 模态框
  - [ ] SubTask 4.3: 选择模板后关闭弹窗并应用模板
  - [ ] SubTask 4.4: 点击"创建空白地图"后关闭弹窗并标记不再自动弹出
  - [ ] SubTask 4.5: 关闭弹窗后当前会话不再打扰

- [ ] Task 5: 工作区内模板库入口
  - [ ] SubTask 5.1: 在 `CanvasPage.tsx` 工具栏新增"模板库"按钮（使用 LayoutTemplate 图标）
  - [ ] SubTask 5.2: 点击按钮打开 `TemplateLibrary` 模态框
  - [ ] SubTask 5.3: 从入口选择模板时在当前工作区新建地图（不覆盖当前地图）

- [ ] Task 6: 埋点与 i18n
  - [ ] SubTask 6.1: 在 `tracker.ts` 新增 3 个事件常量：`template_library_opened`、`template_selected`、`blank_map_created`
  - [ ] SubTask 6.2: 在模板库打开、模板选择、创建空白地图时上报对应事件
  - [ ] SubTask 6.3: 新增 `client/src/locales/template/zh.json` 和 `en.json`，包含模板库相关文案
  - [ ] SubTask 6.4: 在 `i18n.ts` 中注册新的 `template` namespace

- [ ] Task 7: 验证
  - [ ] SubTask 7.1: TypeScript 编译通过
  - [ ] SubTask 7.2: ESLint 检查通过
  - [ ] SubTask 7.3: 客户端构建通过
  - [ ] SubTask 7.4: 手动验证空工作区弹窗、模板选择、入口按钮

---

# Task Dependencies

- Task 1 是前置，Task 2 和 Task 3 依赖 Task 1
- Task 4 依赖 Task 2 和 Task 3
- Task 5 依赖 Task 2 和 Task 3
- Task 6 可与 Task 2-5 并行
- Task 7 依赖 Task 1-6

# Parallelization

- 第一批：Task 1（模板数据）
- 第二批：Task 2（UI 组件）+ Task 3（复制逻辑）+ Task 6（埋点+i18n）并行
- 第三批：Task 4（首次进入体验）+ Task 5（工作区入口）并行
- 第四批：Task 7（全量验证）
