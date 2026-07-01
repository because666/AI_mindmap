## Task 1: 管理员置顶工作区

- [x] 后台 workspaces 路由新增置顶/取消置顶接口
- [x] 工作区模型新增 isPinned / pinnedAt 字段
- [x] 主服务公开列表返回置顶标记并排序
- [x] 客户端工作区选择页显示"推荐工作区"区域
- [x] 用户可浏览置顶工作区公开地图
- [x] 用户可"复制到我自己的工作区"（改为加入工作区）
- [x] 后台工作区列表有置顶/取消置顶按钮
- [x] TypeScript 编译无错误
- [x] 构建成功
- [x] 单元测试通过（14 个新增测试）

## Task 2: 后台 AI 模型 / API 池管理

- [x] ai_model_configs 集合和 aiModelService 实现
- [x] 后台 aiModels 路由提供完整 CRUD
- [x] 后台 AIModels 页面支持增删改查
- [x] 主服务从数据库加载模型配置
- [x] 主服务支持模型 fallback 链路
- [x] Dashboard 展示模型调用量和成本
- [x] TypeScript 编译无错误（admin/server、server、admin/client 三处 tsc -b 均通过）
- [x] 构建成功（admin/server、server、admin/client、client 四处 npm run build 均通过）
- [x] aiModelService 单元测试覆盖核心业务逻辑（CRUD、maskApiKey、normalizeTemperature、normalizeMaxTokens、clearOtherDefaults、setDefault、isValidProvider），覆盖率 ≥ 80%（实际 95.58%）
- [x] aiModelService 单元测试覆盖正常流程、异常流程、边界情况
- [x] aiModels 路由单元测试覆盖 6 个端点的正常与异常分支（93.65%）
- [x] aiUsageService.getModelSummary 单元测试覆盖聚合分组、失败率计算、空数据、日期筛选（95.83%）
- [x] aiService.loadModelConfigsFromDB 单元测试覆盖正常加载、DB 未连接、无启用配置、异常回退（95.83%）
- [x] 单元测试全部通过（vitest）— admin/server 111 通过、server 15 通过
- [x] Git 提交说明符合 Conventional Commits 规范（见交付报告）

## Task 3: 后台管理能力升级

- [x] Dashboard 功能采用矩阵模块
- [x] Dashboard 实时在线模块
- [x] Users 页面活跃度分层标注
- [x] Users 页面按活跃度筛选
- [x] TypeScript 编译无错误（admin/server、admin/client 均通过）
- [x] 构建成功（admin/server、admin/client 均通过）

## Task 4: 地图优先模式

- [x] 空画布宽泛问题检测逻辑
- [x] "是否先展开成地图"提示
- [x] AI 生成结构化大纲
- [x] 自动创建节点和关系
- [x] 用户可点击分支进入对话
- [x] TypeScript 编译无错误（client、server 均通过）
- [x] 单元测试通过（broadQuestion 31 个、mapOutline 21 个）
