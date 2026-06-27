# Tasks

> 对应 spec.md：模板预置AI对话内容
> 范围：模板数据模型扩展 + 自动对话创建 + 进度展示

---

- [x] Task 1: 扩展模板数据模型
  - [x] SubTask 1.1: 修改 `client/src/data/templates.ts` 中 `TemplateNode` 接口，新增 `presetQuestion?: string` 字段
  - [x] SubTask 1.2: 为 5 个内置模板的所有节点添加预置问题（Python入门、机器学习、产品分析、创业验证、DeepMindMap指南）
  - [x] SubTask 1.3: 更新单元测试 `templates.test.ts`，验证 presetQuestion 字段存在

- [x] Task 2: 实现自动对话创建逻辑
  - [x] SubTask 2.1: 在 `nodeStore.ts` 中新增 `createPresetConversationsForTemplate` 方法，为模板节点批量发起AI对话
  - [x] SubTask 2.2: 修改 `createMapFromTemplate` 方法，返回 TemplateCreationResult（包含 nodeIds 和 template 引用）
  - [x] SubTask 2.3: 实现顺序创建机制（队列），避免并发请求过多
  - [x] SubTask 2.4: 实现错误处理，单个节点创建失败时跳过继续后续节点

- [x] Task 3: 实现进度展示UI
  - [x] SubTask 3.1: 在 `TemplateLibrary.tsx` 中新增进度状态（isCreating, progress, cancelRef）
  - [x] SubTask 3.2: 显示进度条和提示文案（"正在为节点 2/5 生成AI回答..."）
  - [x] SubTask 3.3: 实现"取消"按钮，允许用户中断剩余节点的对话创建
  - [x] SubTask 3.4: 创建完成后自动关闭弹窗，选中根节点

- [x] Task 4: 验证与测试
  - [x] SubTask 4.1: TypeScript 编译通过
  - [x] SubTask 4.2: 单元测试通过（32/32）
  - [x] SubTask 4.3: 构建通过
  - [x] SubTask 4.4: 功能测试：选择模板后自动创建对话，节点显示AI回答

---

# Task Dependencies

- Task 1 是前置，Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 1-3

# Parallelization

- 第一批：Task 1（数据模型扩展）
- 第二批：Task 2（自动对话创建）
- 第三批：Task 3（进度展示UI）
- 第四批：Task 4（验证与测试）
