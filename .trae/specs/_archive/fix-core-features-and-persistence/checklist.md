# 修复核心功能与数据持久化 - 检查清单

## Neo4j 节点创建
- [x] 创建节点不再报 "Property values can only be of primitive types" 错误
- [x] 更新节点不再报同类错误
- [x] 思维导图数据在服务重启后不丢失

## 节点数据 MongoDB 同步
- [x] 创建节点后 MongoDB nodes 集合有对应记录
- [x] 更新节点后 MongoDB nodes 集合同步更新
- [x] 删除节点后 MongoDB nodes 集合同步删除
- [x] 工作区排行节点数不再全为0
- [x] Dashboard 总节点数统计正确

## 公告横幅
- [x] 主应用页面顶部显示公告横幅
- [x] 后台创建公告后主应用能实时看到
- [x] 关闭公告后不再重复弹出（localStorage 记录）

## 用户分群标签
- [x] 创建标签后数据写入 MongoDB user_tags 集合
- [x] 编辑标签名称/颜色后数据同步更新
- [x] 删除标签后所有用户的标签引用被清理（非仅第一个）
- [x] 创建分群后数据写入 MongoDB user_segments 集合
- [x] 编辑分群规则后数据同步更新
- [x] 执行分群规则后 userCount 正确更新

## 推送消息
- [x] 非法 messageId 返回错误而非 500 BSONError
- [x] 广播可选择展示形式（公告弹窗/小红点）
- [x] 工作区创建者可向成员发送广播

## 多 AI 服务商
- [x] 可配置多个 AI 服务商 URL+Key+Model
- [x] AI 请求按配置路由到不同服务商
- [x] 原有智谱 API 不受影响

## 构建与部署
- [x] server 构建通过
- [x] client 构建通过
- [x] admin/server 构建通过
- [x] admin/client 构建通过
- [x] 服务器 PM2 进程 online
- [x] 线上手动验收通过
