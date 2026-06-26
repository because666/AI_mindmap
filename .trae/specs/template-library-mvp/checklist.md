# Checklist

> 对应 spec.md：模板库 MVP 与首次进入体验

---

## 模板数据

- [ ] `templates.ts` 中定义了 `TemplateData` 类型
- [ ] 包含 5 个内置模板：DeepMindMap 使用指南、Python 入门、产品需求分析、机器学习基础、创业想法验证
- [ ] 每个模板包含 id、name、description、icon、nodes（含 title/content/role）、relations（含 source/target/type）
- [ ] 模板节点内容真实可用，能引导用户体验非线性对话
- [ ] 单元测试验证模板数据完整性

## 从模板创建地图

- [ ] `createMapFromTemplate` 方法已实现
- [ ] 创建新地图并遍历模板节点逐一创建
- [ ] 遍历模板关系创建对应关系
- [ ] 创建完成后自动切换到新地图并选中根节点
- [ ] 异常时有错误处理，不影响现有功能

## 模板库 UI

- [ ] `TemplateLibrary.tsx` 组件已创建
- [ ] 展示模板卡片网格，每个卡片含图标、名称、描述、节点数
- [ ] 卡片点击触发创建地图并关闭弹窗
- [ ] 弹窗底部有"创建空白地图"按钮
- [ ] 右上角有关闭按钮
- [ ] 弹窗有淡入动画
- [ ] i18n 键已添加到 zh.json 和 en.json

## 首次进入触发

- [ ] 工作区无地图时自动弹出模板库
- [ ] 使用 localStorage 记录已关闭状态，避免重复打扰
- [ ] 工具栏新增"模板库"按钮（LayoutTemplate 图标）
- [ ] 点击工具栏按钮可随时打开模板库

## 埋点

- [ ] `tracker.ts` 新增 `TRACK_EVENT_TEMPLATE_USED` 常量
- [ ] 选择模板创建地图成功后上报 `template_used`（含 templateId、templateName、workspaceId、mapId）
- [ ] 埋点上报失败时静默处理

## 代码质量

- [ ] 所有新增函数有 JSDoc 中文注释
- [ ] 所有 TypeScript 代码无 `any` 类型
- [ ] 异步操作有异常捕获与错误处理
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过
- [ ] `npm run lint` 通过
- [ ] 单元测试全部通过
