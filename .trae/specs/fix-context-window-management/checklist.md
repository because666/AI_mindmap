# 上下文窗口管理修复 - 检查清单

## 核心修复
- [x] 流式聊天路径 /api/ai/chat/stream 已添加上下文截断逻辑
- [x] 截断逻辑已提取为独立工具模块 contextUtils.ts
- [x] 截断后通过 SSE 事件通知客户端（event: context_truncated）

## 按节点粒度截断
- [x] 消息按节点边界分组，整组保留或移除
- [x] 不会出现对话被截断到半截的情况
- [x] 直接父节点链优先保留

## 摘要替代
- [x] 被省略的节点插入了摘要替代消息
- [x] 有 summary 的节点显示前50字摘要
- [x] 无 summary 的节点仅显示标题

## Token 估算
- [x] 服务端 estimateTokens 系数已改为 1.2
- [x] 客户端 estimateTokens 系数已改为 1.2

## 模型映射
- [x] 服务端 MODEL_CONTEXT_WINDOWS 已补全所有模型
- [x] 客户端 MODEL_CONTEXT_WINDOWS 已补全所有模型（与服务端同步）

## 参数调整
- [x] 客户端深度限制已改为 15
- [x] 服务端深度限制已改为 15
- [x] 截断阈值已改为 85%

## 编译验证
- [x] client TypeScript 编译通过（exit code 0）
- [x] server TypeScript 编译通过（仅 searchService.ts:69 预已存在错误，与本次修改无关）
