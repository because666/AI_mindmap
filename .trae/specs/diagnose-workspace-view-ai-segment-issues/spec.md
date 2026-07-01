# 诊断：工作区查看按钮、置顶 403、AI 配置重复、用户分群问题 Spec

## Why

用户反馈四个问题：置顶工作区仍返回 403、查看工作区按钮无反应、AI 服务商管理与 AI 模型管理疑似重复、用户分群功能不可用。本 spec 为纯诊断任务，不涉及代码修改，仅记录排查结论与建议。

## 诊断结论（基于 2026-07-01 代码审查）

### 问题 1：置顶 403 + auth/me 401

**现象**：浏览器控制台显示 `api/auth/me` 返回 401，`api/admin/workspaces/{id}/pin` 返回 403。

**根因**：**服务器部署的还是旧代码**。

- 本地 [`admin/server/src/routes/auth.ts`](file:///d:/study1/DeepMindMap/v2/admin/server/src/routes/auth.ts) 已在上一轮修复中写入 `role: 'super_admin'`，但**尚未部署到服务器**。
- 服务器上旧代码的 `real-login` 仍不写入 `role`，导致 `requireRole('super_admin', 'operator')` 中间件因 `adminRole` 为空返回 403。
- `auth/me` 返回 401 说明当前 session 已失效（服务器重启或 session 过期），需重新登录。但即使重新登录，服务器旧代码登录后 session 仍无 role 字段，置顶仍会 403。

**解决**：将本地修复后的 `admin/server` 代码部署到服务器。部署后管理员需重新登录，新 session 才会包含 `role: 'super_admin'`。

---

### 问题 2：查看工作区按钮无反应

**现象**：工作区管理页面，每行操作区的"查看"按钮（Eye 图标）点击无任何反应。

**根因**：[`WorkspacesPage.tsx` 第 411 行](file:///d:/study1/DeepMindMap/v2/admin/client/src/pages/Workspaces/WorkspacesPage.tsx#L411) 的"查看"按钮**没有绑定 `onClick` 事件**，是空按钮：

```tsx
<button className="p-1 text-gray-400 hover:text-blue-600" title="查看">
  <Eye className="w-4 h-4" />
</button>
```

- 该按钮没有 `onClick` 处理函数，点击不会触发任何行为。
- 当前页面没有工作区详情页或详情弹窗，`GET /:id` 接口已存在但前端未调用。

**建议**：为"查看"按钮添加点击行为，可选方案：
1. **弹窗方案（推荐）**：点击弹出详情弹窗，展示工作区的节点数、成员数、对话数、创建时间等统计数据（调用已有的 `GET /api/admin/workspaces/:id` 接口）。
2. **跳转方案**：新建工作区详情页，点击跳转到 `/workspaces/:id` 展示完整信息。

---

### 问题 3：AI 服务商管理 vs AI 模型管理重复

**现象**：系统设置中有"AI 服务商"tab，AI 模型管理是独立页面，两者都在管理 AI 连接配置。

**根因**：**确实是重复功能**，且 AI 服务商管理是遗留冗余功能。

| 对比项 | AI 服务商管理（系统设置） | AI 模型管理（独立页面） |
| --- | --- | --- |
| 前端文件 | [`SettingsPage.tsx`](file:///d:/study1/DeepMindMap/v2/admin/client/src/pages/Settings/SettingsPage.tsx) | [`AIModelsPage.tsx`](file:///d:/study1/DeepMindMap/v2/admin/client/src/pages/AIModels/AIModelsPage.tsx) |
| 后端路由 | [`settings.ts`](file:///d:/study1/DeepMindMap/v2/admin/server/src/routes/settings.ts) `/ai-providers` | [`aiModels.ts`](file:///d:/study1/DeepMindMap/v2/admin/server/src/routes/aiModels.ts) `/ai-models` |
| 数据存储 | `admin_configs.aiProviders` | `ai_model_configs` 集合 |
| 数据字段 | id、name、url、model、apiKey、priority | name、provider、apiKey、baseUrl、modelId、temperature、maxTokens、isActive、isDefault、priority |
| **主服务端使用** | **❌ 未被使用** | **✅ 被使用** |

**关键证据**：主服务端 [`aiService.ts` 第 509-555 行](file:///d:/study1/DeepMindMap/v2/server/src/services/aiService.ts#L509) 的 `loadModelConfigsFromDB()` **只从 `ai_model_configs` 集合加载**（即 AI 模型管理的数据），`admin_configs.aiProviders` 的数据**没有被主服务端读取**。

**结论**：AI 服务商管理是遗留功能，已被 AI 模型管理完全取代。在 AI 服务商管理页面做的任何配置修改都不会影响实际 AI 调用。

**建议**：
1. **方案 A（推荐）**：移除系统设置中的"AI 服务商"tab，统一使用 AI 模型管理页面，避免用户混淆。
2. **方案 B**：保留 AI 服务商管理作为简化版，但需要让主服务端也读取它，否则用户会误以为配置生效。

---

### 问题 4：用户分群功能不可用

**现象**：用户反馈"用户分群的功能全部不可用，只是摆设，没有实际使用场景，没有功能，只能点击"。

**根因**：代码层面功能**完整**，但存在两层问题。

#### 4.1 代码完整性检查（通过）

- 后端路由 [`userSegments.ts`](file:///d:/study1/DeepMindMap/v2/admin/server/src/routes/userSegments.ts) 已注册到 [`index.ts`](file:///d:/study1/DeepMindMap/v2/admin/server/src/index.ts) 第 89 行 `app.use('/api/admin/user-segments', userSegmentsRouter)`。
- 后端接口完整：标签 CRUD、用户标签关联、按标签筛选用户、分群 CRUD、执行分群规则、获取分群用户。
- 前端 API 方法 [`api.ts`](file:///d:/study1/DeepMindMap/v2/admin/client/src/services/api.ts) `userSegmentsApi` 完整。
- 前端 UI [`UserSegmentsPage.tsx`](file:///d:/study1/DeepMindMap/v2/admin/client/src/pages/UserSegments/UserSegmentsPage.tsx) 按钮均有 `onClick` 绑定。

#### 4.2 可能的运行时问题

- **API 调用失败**：可能是 `requireAuth` 未登录、IP 白名单拦截、或 `userSegmentService` 内部依赖的数据库集合查询异常。
- **需要用户确认**：建议打开浏览器 Network 面板，点击"创建标签"或"执行分群"按钮，查看具体的 API 请求与响应状态码。

#### 4.3 产品设计层面的功能缺失（"没有实际使用场景"）

即使用户能成功创建标签和分群，当前功能也存在**运营动作缺失**：

- **标签创建后**：只能"查看用户"列表，不能对标签用户做批量操作（如批量推送通知、批量封禁、批量发消息）。
- **分群执行后**：只能"查看用户"列表，不能对分群用户做定向运营动作。
- **标签无法在用户管理页使用**：[`UsersPage.tsx`](file:///d:/study1/DeepMindMap/v2/admin/client/src/pages/Users/UsersPage.tsx) 的筛选条件中没有"按标签筛选"选项。
- **分群无自动更新**：虽然创建分群时可勾选 `autoUpdate`，但 [`userSegmentService`](file:///d:/study1/DeepMindMap/v2/admin/server/src/services/userSegmentService.ts) 中没有定时任务自动更新分群用户数。

**结论**：用户分群功能"能点击但无实际价值"的原因是——创建出来的标签和分群**没有被其他业务模块消费**，无法形成运营闭环。

**建议**：
1. **短期**：确认 API 是否能正常调用（排除运行时错误）。
2. **中期**：在用户管理页增加"按标签筛选"功能，让标签有实际用途。
3. **长期**：增加"对标签/分群用户批量推送通知"功能，形成运营闭环。

## 总结

| 问题 | 根因 | 严重程度 | 建议 |
| --- | --- | --- | --- |
| 置顶 403 | 服务器未部署修复后的代码 | 高 | 部署本地代码到服务器 |
| 查看工作区无反应 | 按钮未绑定 onClick | 中 | 添加详情弹窗或跳转 |
| AI 配置重复 | AI 服务商管理是遗留冗余功能 | 中 | 移除 AI 服务商 tab |
| 用户分群不可用 | 功能完整但缺运营闭环 | 中 | 增加标签筛选与批量操作 |

## Impact

- 本 spec 为纯诊断文档，不涉及代码修改。
- 待用户确认诊断结论后，再针对具体问题创建修复 spec。
