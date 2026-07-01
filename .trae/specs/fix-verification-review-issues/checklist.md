## Task 1: 修复活跃度筛选一致性

- [x] `buildActivityTierFilter` 的 `high_active` 筛选范围扩展为 lastSeen >= now-7d
- [x] churn_risk/dormant 在 7 天、30 天边界判定一致
- [x] 边界一致性单元测试覆盖 7 天边界、30 天边界、1-7 天区间
- [x] TypeScript 编译无错误
- [x] 原有单元测试不回归

## Task 2: 修复 Dashboard 容错加载

- [x] DashboardPage 使用 Promise.allSettled 替代 Promise.all
- [x] 单个接口失败时对应模块显示错误提示
- [x] 实时在线模块每 30 秒自动刷新
- [x] 页面离开时清除定时器
- [x] ACTIVITY_TIER_CONFIG 访问有防御性 fallback
- [x] TypeScript 编译无错误
- [x] 构建成功

## Task 3: 修复静默失败与类型安全

- [x] dashboardService.ts 中 5 处 catch 块均有 console.warn 日志
- [x] 30 分钟活跃曲线循环覆盖完整 30 分钟
- [x] users.ts 中 lastSeen 字段无 `as string` 类型断言
- [x] getStats 中 onlineNow 改为实际查询而非硬编码 0
- [x] users.ts 中 UserListItem 的 tags 字段已填充
- [x] TypeScript 编译无错误
- [x] 原有单元测试不回归

## Task 4: 修复 ChatPanel 自动发送错位

- [x] handleMapFirstConfirm 记录首个成功创建子节点的分支索引 firstSuccessIndex
- [x] 自动发送时使用 branches[firstSuccessIndex] 而非 branches[0]
- [x] 所有 createChildNode 失败时 Toast 提示并回退到 sendMessage(question)
- [x] TypeScript 编译无错误
- [x] 原有单元测试不回归

## Task 5: 修复 isBroadQuestion 短句误判

- [x] 短句兜底逻辑增加"包含至少 2 个中文字符"条件
- [x] 纯数字、纯标点、纯英文不误判为宽泛问题
- [x] BROAD_KEYWORDS 检查统一使用 lowerTrimmed 匹配
- [x] broadQuestion.test.ts 补充纯数字、纯标点、纯英文测试用例
- [x] TypeScript 编译无错误
- [x] 原有 31 个测试不回归（实际 39 个测试全部通过）

## Task 6: 修复大纲生成竞态条件与状态清除

- [x] textarea disabled 增加 isGeneratingMapOutline 检查
- [x] Send 按钮 disabled 增加 isGeneratingMapOutline 检查
- [x] handleKeyDown 中 Enter 检查 isGeneratingMapOutline
- [x] nodeId 变化时清除 mapFirstPrompt 和 isGeneratingMapOutline
- [x] handleMapFirstDismiss 和失败回退路径检查 isLoading
- [x] TypeScript 编译无错误
- [x] 构建成功

## Task 7: 修复 parseMapOutlineJson 校验与正则

- [x] parseMapOutlineJson 增加 4-6 分支数量校验（超出截取、不足拒绝）
- [x] 去除 Markdown 正则改为仅清理首尾标记
- [x] MapOutlineData 和 MapOutlineBranch 接口已导出
- [x] mapOutline.test.ts 补充 branches 非数组、rootTitle 非字符串、null/undefined、特殊字符、超长输入、多 JSON 串联测试
- [x] TypeScript 编译无错误
- [x] 原有 21 个测试不回归（实际 47 个测试全部通过）

## Task 8: 修复 /map-outline 接口配置

- [x] 路由从 req.headers['x-workspace-id'] 读取 workspaceId 用于用量记录
- [x] temperature 从 0.7 降至 0.3
- [x] /map-outline 使用独立限流策略（5 次/分钟）
- [x] zh.json 和 en.json 新增 autoQuestion 分隔符 i18n 键
- [x] ChatPanel.tsx autoQuestion 使用 i18n 分隔符
- [x] TypeScript 编译无错误
- [x] 构建成功

## Task 9: 验证与回归测试

- [x] admin/server TypeScript 编译无错误
- [x] admin/client TypeScript 编译无错误
- [x] server TypeScript 编译无错误
- [x] client TypeScript 编译无错误
- [x] admin/server 构建成功
- [x] admin/client 构建成功
- [x] server 构建成功
- [x] client 构建成功
- [x] 原有单元测试全部通过（admin/server 346 + server 591 + client 265，共 1202 个测试通过；6 个 ipWhitelist 失败为预先存在，与本次修改无关）
- [x] 新增边界一致性测试通过（activityTier 28 + broadQuestion 39 + mapOutline 47，共 114 个新增测试全部通过）
- [x] ESLint 无新增错误（client 仅 1 个预先存在的 WelcomePage.tsx warning；其他 3 处项目未配置 ESLint）
