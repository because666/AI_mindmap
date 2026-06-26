# Checklist

> 对应 spec.md：模板库 MVP + 首次进入体验

---

## 系统内置模板数据

- [ ] `client/src/data/systemTemplates.ts` 已创建
- [ ] `SystemTemplate` 类型完整定义（id/title/description/tags/category/thumbnailColor/nodes）
- [ ] 至少包含 5 个 MVP 模板：DeepMindMap 使用指南、Python 入门、产品经理需求分析、高并发系统、创业想法验证
- [ ] 每个模板包含根节点标题和摘要
- [ ] 每个模板包含 1-3 个一级子节点
- [ ] 每个模板包含预置引导问题
- [ ] 模板节点位置合理（根节点居中，子节点向右展开）

## 模板库组件

- [ ] `TemplateLibrary` 组件已创建
- [ ] 模板以卡片网格形式展示
- [ ] 每张卡片显示标题、描述、标签、主题色块
- [ ] 搜索框可实时过滤标题/描述/标签
- [ ] 分类标签可筛选模板（全部/学习/产品/技术/创业）
- [ ] 点击卡片展开模板详情
- [ ] 详情中展示节点结构预览
- [ ] "使用此模板"按钮功能正常
- [ ] "创建空白地图"按钮功能正常

## 模板复制逻辑

- [ ] `applyTemplate(templateId, workspaceId)` 方法已实现
- [ ] 选择模板后创建新地图（workspace）
- [ ] 新地图自动设为当前地图
- [ ] 根据模板数据创建根节点和子节点
- [ ] 节点位置与模板定义一致
- [ ] 创建完成后自动选中根节点
- [ ] 创建完成后自动打开对话视图
- [ ] 模板原始数据只读，用户修改不影响系统模板

## 空工作区首次进入体验

- [ ] `CanvasPage.tsx` 能正确检测当前工作区是否为空
- [ ] 空工作区首次进入时自动弹出模板库模态框
- [ ] 选择模板后弹窗关闭并应用模板
- [ ] 点击"创建空白地图"后关闭弹窗
- [ ] 点击"创建空白地图"后后续进入不再自动弹出
- [ ] 关闭弹窗后当前会话不再打扰
- [ ] 下次进入空工作区时再次弹出

## 工作区内模板库入口

- [ ] `CanvasPage.tsx` 工具栏新增"模板库"按钮
- [ ] 按钮使用 `LayoutTemplate` 图标
- [ ] 点击按钮打开模板库模态框
- [ ] 从入口选择模板时在当前工作区新建地图（不覆盖当前地图）
- [ ] 新建地图后自动切换到新地图

## 埋点

- [ ] `tracker.ts` 新增 `template_library_opened` 常量
- [ ] `tracker.ts` 新增 `template_selected` 常量
- [ ] `tracker.ts` 新增 `blank_map_created` 常量
- [ ] 打开模板库时上报 `template_library_opened`
- [ ] 选择模板时上报 `template_selected`（含 templateId、workspaceId）
- [ ] 创建空白地图时上报 `blank_map_created`
- [ ] 埋点失败时静默处理

## i18n

- [ ] 创建 `client/src/locales/template/zh.json`
- [ ] 创建 `client/src/locales/template/en.json`
- [ ] 包含模板库标题、搜索占位符、分类标签、按钮文案
- [ ] 在 `i18n.ts` 中注册 `template` namespace
- [ ] 组件中使用 `t('template:key')` 正确引用

## 代码质量

- [ ] 所有新增函数/组件有 JSDoc 中文注释
- [ ] 所有 TypeScript 代码无 `any` 类型
- [ ] 异步操作有异常捕获与错误处理
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过
- [ ] `npm run lint` 通过
- [ ] 手动验证空工作区弹窗、模板选择、入口按钮
