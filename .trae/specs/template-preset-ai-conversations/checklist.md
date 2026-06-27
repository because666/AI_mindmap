# Checklist

> 对应 spec.md：模板预置AI对话内容

---

## 数据模型扩展

- [x] `TemplateNode` 接口新增 `presetQuestion?: string` 字段
- [x] Python入门模板 5 个节点均有预置问题
- [x] 机器学习模板 5 个节点均有预置问题
- [x] 产品分析模板 5 个节点均有预置问题
- [x] 创业验证模板 5 个节点均有预置问题
- [x] DeepMindMap指南模板 4 个节点均有预置问题
- [x] 单元测试验证 presetQuestion 字段存在

## 自动对话创建逻辑

- [x] `createPresetConversationsForTemplate` 方法已实现
- [x] `createMapFromTemplate` 方法已扩展，返回 TemplateCreationResult
- [x] 按顺序创建对话（队列机制）
- [x] 单个节点创建失败时跳过继续后续节点
- [x] 创建完成后更新节点的 conversationId

## 进度展示UI

- [x] TemplateLibrary.tsx 显示进度条
- [x] 进度文案格式："正在为节点 2/5 生成AI回答..."
- [x] 显示"取消"按钮，允许中断创建
- [x] 创建完成后自动关闭弹窗
- [x] 创建完成后选中根节点

## 代码质量

- [x] TypeScript 编译通过
- [x] 单元测试通过（32/32）
- [x] 构建通过
- [x] 无 any 类型
- [x] JSDoc 中文注释完整
