# Checklist

## 代码状态收集

- [x] `admin/server/src/routes/workspaces.ts` 中置顶接口代码已读取
- [x] `admin/server/src/routes/users.ts` 中封禁接口代码已读取
- [x] `admin/client/src/pages/Workspaces/WorkspacesPage.tsx` 中置顶 UI 代码已读取
- [x] `admin/client/src/pages/Users/UsersPage.tsx` 中封禁 UI 代码已读取
- [x] `admin/client/src/services/api.ts` 中相关 API 方法已读取
- [x] 本地未提交变更状态已确认

## 工作区置顶失败诊断

- [x] `workspaces` 集合字段状态已确认（`isPinned` / `pinnedAt` 是否存在）
- [x] 置顶接口响应已测试并记录
- [x] admin 服务端日志中置顶相关错误已检查
- [x] 前端请求链路已检查
- [x] 至少列出 2 个可能根因与优先级

## 用户封禁按钮缺失诊断

- [x] `UsersPage.tsx` 中封禁按钮渲染条件已检查
- [x] `GET /api/admin/users` 返回的 `isBanned` 字段已确认
- [x] 本地构建产物中封禁按钮代码已确认
- [x] 服务器部署产物与本地一致性已检查（或判断为无法直接访问）
- [x] 至少列出 2 个可能根因与优先级

## 诊断报告

- [x] 置顶失败诊断结论已汇总
- [x] 封禁按钮缺失诊断结论已汇总
- [x] 每个问题给出 1-2 条最可能修复方案
- [x] 用户可自行验证的方法已列出
