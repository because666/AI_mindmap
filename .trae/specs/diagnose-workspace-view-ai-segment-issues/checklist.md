# Checklist

## 置顶 403 诊断

- [x] 已确认本地 auth.ts 已写入 role: 'super_admin'
- [x] 已确认服务器未部署最新代码
- [x] 已确认 auth/me 401 是 session 失效导致

## 查看工作区按钮诊断

- [x] 已确认 WorkspacesPage.tsx 第 411 行查看按钮未绑定 onClick
- [x] 已确认 GET /:id 接口已存在但前端未调用

## AI 配置重复诊断

- [x] 已对比 AI 服务商管理与 AI 模型管理的字段/存储/路由
- [x] 已确认主服务端 aiService.ts 只读取 ai_model_configs 集合
- [x] 已确认 admin_configs.aiProviders 未被主服务端使用

## 用户分群诊断

- [x] 已确认后端路由已注册到 Express app
- [x] 已确认前端 API 方法与 UI 按钮绑定完整
- [x] 已分析产品设计层面的运营闭环缺失（标签/分群未被其他模块消费）
