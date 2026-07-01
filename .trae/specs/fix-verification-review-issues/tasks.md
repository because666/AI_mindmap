# Tasks

> 对应 spec.md：修复核验审查发现问题
> 范围：Task 3 审查发现 2 严重 + 7 警告；Task 4 审查发现 2 严重 + 6 警告 + 7 建议

---

- [x] Task 1: 修复活跃度筛选一致性（严重）
  - [x] SubTask 1.1: 修改 `admin/server/src/utils/activityTier.ts` 的 `buildActivityTierFilter`，将 `high_active` 筛选范围从 `lastSeen >= now-24h` 扩展为 `lastSeen >= now-7d`（与 calculateActivityTier 的 1-7 天兜底逻辑一致）
  - [x] SubTask 1.2: 统一 churn_risk/dormant 边界开闭区间（确保 calculate 和 filter 在 7 天、30 天边界判定一致）
  - [x] SubTask 1.3: 为 `activityTier.ts` 补充边界一致性单元测试（7 天边界、30 天边界、1-7 天区间）

- [x] Task 2: 修复 Dashboard 容错加载（严重）
  - [x] SubTask 2.1: 修改 `admin/client/src/pages/Dashboard/DashboardPage.tsx`，将 `Promise.all` 改为 `Promise.allSettled`
  - [x] SubTask 2.2: 为每个模块添加独立的错误状态处理，单个接口失败时显示错误提示而非全盘不可用
  - [x] SubTask 2.3: 添加实时在线模块定时刷新机制（30 秒轮询，页面离开时清除）
  - [x] SubTask 2.4: 为 `ACTIVITY_TIER_CONFIG` 访问添加防御性 fallback（UsersPage.tsx）

- [x] Task 3: 修复静默失败与类型安全（警告）
  - [x] SubTask 3.1: 修复 `dashboardService.ts` 中 5 处 catch 块静默失败，补充 `console.warn` 错误日志
  - [x] SubTask 3.2: 修复 30 分钟活跃曲线循环覆盖范围（`for(i=30;i>=1;i--)` 确保覆盖完整 30 分钟）
  - [x] SubTask 3.3: 修复 `users.ts` 中 `lastSeen as string` 类型断言，改用显式空值检查
  - [x] SubTask 3.4: 修复 `getStats` 中 `onlineNow: 0` 硬编码，改为查询 visitors 集合的 lastSeen 统计
  - [x] SubTask 3.5: 补齐 `users.ts` 中 UserListItem 的 tags 字段填充

- [x] Task 4: 修复 ChatPanel 自动发送错位（严重）
  - [x] SubTask 4.1: 修改 `handleMapFirstConfirm` 循环创建分支逻辑，记录首个成功创建子节点对应的分支索引 `firstSuccessIndex`
  - [x] SubTask 4.2: 自动发送时使用 `branches[firstSuccessIndex]` 而非 `branches[0]`，确保问题主题与选中节点匹配
  - [x] SubTask 4.3: 修复所有 `createChildNode` 调用失败时（`firstChildId` 为空）的体验：Toast 提示并回退到 `sendMessage(question)`

- [x] Task 5: 修复 isBroadQuestion 短句误判（严重）
  - [x] SubTask 5.1: 移除或修改 `broadQuestion.ts` 短句兜底逻辑，增加"包含至少 2 个中文字符"条件，排除纯数字/纯标点/纯英文
  - [x] SubTask 5.2: 统一 `BROAD_KEYWORDS` 检查使用 `lowerTrimmed` 匹配（与 SPECIFIC_KEYWORDS 风格一致）
  - [x] SubTask 5.3: 补充 `broadQuestion.test.ts` 测试用例：纯数字、纯标点、纯英文、无意义字符不误判

- [x] Task 6: 修复大纲生成竞态条件与状态清除
  - [x] SubTask 6.1: 在 ChatPanel.tsx 的 textarea `disabled` 属性增加 `isGeneratingMapOutline` 检查
  - [x] SubTask 6.2: 在 Send 按钮 `disabled` 属性增加 `isGeneratingMapOutline` 检查
  - [x] SubTask 6.3: 在 `handleKeyDown` 中 Enter 触发时检查 `isGeneratingMapOutline`
  - [x] SubTask 6.4: 添加 `nodeId` 变化时清除 `mapFirstPrompt` 和 `isGeneratingMapOutline` 的 useEffect
  - [x] SubTask 6.5: 修复 `handleMapFirstDismiss` 和失败回退路径未检查 `isLoading` 问题，避免问题丢失

- [x] Task 7: 修复 parseMapOutlineJson 校验与正则
  - [x] SubTask 7.1: 在 `parseMapOutlineJson` 增加 4-6 分支数量校验（超出截取前 6 个，不足 4 个返回 null）
  - [x] SubTask 7.2: 修复去除 Markdown 代码块的正则，改为仅清理首尾标记（`^```(?:json)?\s*` 和 `\s*```$`）
  - [x] SubTask 7.3: 导出 `MapOutlineData` 和 `MapOutlineBranch` 接口（添加 `export` 关键字）
  - [x] SubTask 7.4: 补充 `mapOutline.test.ts` 边界场景测试：branches 非数组、rootTitle 非字符串、null/undefined 输入、特殊字符、超长输入、多 JSON 串联

- [x] Task 8: 修复 /map-outline 接口配置
  - [x] SubTask 8.1: 路由从 `req.headers['x-workspace-id']` 读取 workspaceId 并用于用量记录
  - [x] SubTask 8.2: 将 `temperature` 从 0.7 降至 0.3，利于结构化 JSON 输出
  - [x] SubTask 8.3: 为 `/map-outline` 创建独立限流策略（5 次/分钟），避免与 `/chat/stream` 共享额度
  - [x] SubTask 8.4: 在 `zh.json` 和 `en.json` 新增 autoQuestion 分隔符 i18n 键（中文 `：`，英文 `: `）
  - [x] SubTask 8.5: ChatPanel.tsx 中 autoQuestion 使用 i18n 分隔符替代硬编码中文冒号

- [x] Task 9: 验证与回归测试
  - [x] SubTask 9.1: TypeScript 编译无错误（admin/server、admin/client、server、client 四处全部通过）
  - [x] SubTask 9.2: 构建成功（admin/server、admin/client、server、client 四处全部通过）
  - [x] SubTask 9.3: 单元测试全部通过（admin/server 346 通过 + 6 个预先存在的 ipWhitelist 失败；server 591 通过；client 265 通过；新增 activityTier 28 + broadQuestion 39 + mapOutline 47 全部通过）
  - [x] SubTask 9.4: ESLint 无新增错误（client 仅 1 个预先存在的 WelcomePage.tsx warning；其他 3 处未配置 ESLint）

---

# Task Dependencies

- Task 1、Task 2、Task 3 互相独立，可并行（Task 3 后台管理）
- Task 4、Task 5、Task 6、Task 7、Task 8 互相独立，可并行（Task 4 地图优先）
- Task 9 依赖 Task 1-8 全部完成

# Parallelization

- 第一批（并行）：
  - Task 1（activityTier 修复）
  - Task 2（Dashboard 容错）
  - Task 3（静默失败与类型安全）
  - Task 4（自动发送错位）
  - Task 5（isBroadQuestion 误判）
  - Task 6（竞态条件与状态清除）
  - Task 7（parseMapOutlineJson 校验）
  - Task 8（/map-outline 接口配置）
- 第二批：Task 9（全量验证）
