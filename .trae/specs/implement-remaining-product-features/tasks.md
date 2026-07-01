# Tasks

> 对应 spec.md：实现产品策略剩余功能
> 范围：P1 置顶工作区 + P1 AI 模型池 + P1 后台升级 + P2 地图优先

---

- [x] Task 1: 管理员置顶工作区面向用户展示（P1）
  - [x] SubTask 1.1: 后台 `workspaces.ts` 新增 `POST /:id/pin` 和 `DELETE /:id/pin` 接口，工作区模型新增 `isPinned` / `pinnedAt` 字段
  - [x] SubTask 1.2: 主服务 `server/src/routes/workspaces.ts` 的 `GET /public/list` 返回置顶标记，置顶工作区排在最前
  - [x] SubTask 1.3: 客户端工作区选择页面新增"推荐工作区"区域，展示置顶工作区卡片
  - [x] SubTask 1.4: 用户可点击浏览置顶工作区的公开地图，支持"复制到我自己的工作区"
  - [x] SubTask 1.5: 后台工作区列表页面增加置顶/取消置顶按钮

- [ ] Task 2: 后台 AI 模型 / API 池管理（P1）
  - [x] SubTask 2.1: 新增 `ai_model_configs` 集合和 `aiModelService.ts`，支持 CRUD 操作
  - [x] SubTask 2.2: 新增 `admin/server/src/routes/aiModels.ts` 路由，提供模型列表/创建/更新/删除/设置默认接口
  - [x] SubTask 2.3: 新增 `admin/client/src/pages/AIModels/AIModelsPage.tsx` 页面，支持增删改查模型配置
  - [x] SubTask 2.4: 主服务 `aiService.ts` 启动时从 `ai_model_configs` 集合加载配置，覆盖环境变量默认值
  - [x] SubTask 2.5: 主服务支持模型 fallback 链路（主模型失败自动切换下一个）
  - [x] SubTask 2.6: Admin Dashboard 展示各模型调用量、token 消耗、失败率（复用 AIUsage 数据）
  - [x] SubTask 2.7: 为 `aiModelService.ts` 编写单元测试，覆盖正常流程、异常流程、边界情况（maskApiKey 掩码、normalizeTemperature/maxTokens 归一化、create/update/delete/setDefault CRUD、clearOtherDefaults 默认唯一性、isValidProvider 校验），核心业务逻辑覆盖率 ≥ 80%（实际 95.58%）
  - [x] SubTask 2.8: 为 `aiModels.ts` 路由编写单元测试，覆盖 6 个端点（GET/POST/PUT/:id/DELETE/:id/PUT/:id/default/PUT/:id/toggle）的正常与异常分支，校验 provider 白名单、必填字段校验、notifyAIModelsRefresh 异步通知（93.65%）
  - [x] SubTask 2.9: 为 `aiUsageService.getModelSummary` 编写单元测试，覆盖聚合管道分组、失败率计算、空数据、日期筛选（95.83%）
  - [x] SubTask 2.10: 为 `aiService.loadModelConfigsFromDB` / `refreshModelConfigs` 编写单元测试，覆盖正常加载、数据库未连接、无启用配置、异常回退到环境变量（95.83%）
  - [ ] SubTask 2.11: 生成符合 Conventional Commits 规范的 Git 提交说明（类型(模块): 描述），同步说明修改文件列表、核心实现逻辑、运行验证方式、注意事项

- [x] Task 3: 后台管理能力升级（P1）
  - [x] SubTask 3.1: Dashboard 新增"功能采用矩阵"模块，展示各功能使用率
  - [x] SubTask 3.2: Dashboard 新增"实时在线"模块，展示当前在线用户数和 30 分钟活跃曲线
  - [x] SubTask 3.3: Users 页面新增活跃度分层标注（高活跃/沉睡/新用户/流失风险）
  - [x] SubTask 3.4: Users 页面支持按活跃度筛选

- [x] Task 4: 地图优先模式（P2）
  - [x] SubTask 4.1: ChatPanel 在空画布或根节点输入时，检测宽泛问题并提示"是否先展开成地图？"
  - [x] SubTask 4.2: 用户确认后调用 AI 生成结构化大纲（根节点 + 多个分支），复用 `expand_node` 工具
  - [x] SubTask 4.3: 大纲生成后自动创建节点和关系，用户可点击任意分支进入对话

---

# Task Dependencies

- Task 1、Task 2、Task 3 互相独立，可并行
- Task 4 依赖 Task 2（AI 模型配置就绪后再实现地图优先模式）
- 建议顺序：Task 1 → Task 2 → Task 3 → Task 4（按优先级和复杂度递增）

# Parallelization

- 第一批：Task 1（最简单，快速完成）
- 第二批：Task 2（中等复杂度，核心基础设施）
- 第三批：Task 3（依赖 Task 2 的模型用量数据）
- 第四批：Task 4（依赖 Task 2 的模型配置）
