# 反馈数据存储与管理后台集成 - 验收清单

- [ ] 用户提交反馈后数据存储至 MongoDB feedbacks 集合
- [ ] feedbacks 集合有 createdAt、status、type 索引
- [ ] Admin反馈管理API：GET /api/admin/feedbacks 返回分页列表
- [ ] Admin反馈管理API：支持按 type、status、时间范围筛选
- [ ] Admin反馈管理API：GET /api/admin/feedbacks/stats 返回统计数据
- [ ] Admin反馈管理API：PATCH /api/admin/feedbacks/:id/status 更新状态
- [ ] Admin反馈管理API：POST /api/admin/feedbacks/export 导出CSV
- [ ] Admin前端侧边栏显示"反馈管理"导航项
- [ ] Admin反馈管理页面显示统计卡片（总数、待处理、已解决、今日新增）
- [ ] Admin反馈管理页面有筛选栏（类型、状态、时间范围）
- [ ] Admin反馈管理页面有反馈列表（标题、类型标签、状态标签、时间、操作）
- [ ] Admin反馈管理页面有反馈详情弹窗（含状态修改）
- [ ] 反馈状态变更记录审计日志
- [ ] 主服务端 tsc 编译无错误
- [ ] Admin服务端 tsc 编译无错误
- [ ] Admin前端构建无错误
- [ ] 服务器部署后功能正常
