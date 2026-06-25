# 修复反馈与推送功能的三个运行时Bug Spec

## Why
用户反馈三个运行时问题：(1) 提交反馈后后台管理无法看到反馈记录；(2) 更新反馈状态后用户收不到推送通知；(3) 发送广播消息后无法查看记录。经代码审查发现，主服务端和Admin服务端使用不同的MongoDB认证凭据连接同一数据库，可能存在连接不一致问题；推送通知链路中 `sendFeedbackNotification` 在无设备注册时提前返回null且不创建消息记录；广播消息写入和读取使用同一 `adminDB` 实例但可能连接失败。

## What Changes
- 为主服务端反馈路由增加更详细的DB写入诊断日志，确认 `insertOne` 结果
- 修改 `pushService.sendFeedbackNotification`：无设备时仍创建 `push_messages` 记录（标记为未发送），不再直接返回null
- 修改 `admin/server/src/routes/push.ts` 广播发送路由：增加 `insertOne` 结果校验和日志
- 修改 `admin/server/src/routes/feedbacks.ts`：增加 `adminDB.isConnected()` 诊断日志，确认DB状态
- 修改 `admin/server/src/services/cacheNotify.ts`：增加 `notifyFeedbackPush` 的错误详情日志（HTTP状态码、响应体）
- 统一 `INTERNAL_API_TOKEN` 的默认值处理：主服务端 `process.env.INTERNAL_API_TOKEN` 无默认值，需确保远程.env配置正确

## Impact
- Affected specs: add-feedback-admin-management, add-feedback-push-notification
- Affected code:
  - `server/src/routes/feedback.ts` — 诊断日志增强
  - `server/src/services/pushService.ts` — sendFeedbackNotification 逻辑修改
  - `admin/server/src/routes/feedbacks.ts` — DB连接状态诊断
  - `admin/server/src/routes/push.ts` — 广播消息写入校验
  - `admin/server/src/services/cacheNotify.ts` — 推送通知错误日志增强

## ADDED Requirements

### Requirement: 反馈写入诊断日志
系统SHALL在反馈写入MongoDB时输出详细的诊断信息，包括数据库连接状态、写入结果（成功/失败/返回null）、集合名称。

#### Scenario: 写入成功
- **WHEN** 反馈提交后 `insertOne` 成功返回ID
- **THEN** 输出 `[Feedback] 反馈数据已存储: {insertedId}`

#### Scenario: 写入失败（DB未连接）
- **WHEN** 反馈提交后 `insertOne` 返回null
- **THEN** 输出 `[Feedback] 反馈数据存储失败: 数据库连接不可用, isConnected=false`

#### Scenario: 写入异常
- **WHEN** 反馈提交后 `insertOne` 抛出异常
- **THEN** 输出完整异常信息包括堆栈

### Requirement: 推送通知消息记录完整性
系统SHALL在发送反馈通知推送时，无论用户是否有注册设备，均在 `push_messages` 集合中创建消息记录。无设备时记录 `sentAt=null` 且 `stats.totalCount=0`，供管理员查看推送历史。

#### Scenario: 有注册设备
- **WHEN** visitorId 对应的用户存在活跃设备
- **THEN** 创建 `push_messages` 记录，调用JPush发送推送，更新 `sentAt`

#### Scenario: 无注册设备
- **WHEN** visitorId 对应的用户无活跃设备，且 visitorId 不是 'anonymous'
- **THEN** 仍然创建 `push_messages` 记录（`sentAt=null`, `stats.totalCount=0`），日志输出 `[Push] 反馈推送已记录但无可用设备`

#### Scenario: anonymous用户
- **WHEN** visitorId 为 'anonymous' 或空值
- **THEN** 不创建任何记录，返回null，日志输出跳过原因

### Requirement: 广播消息写入校验
系统SHALL在管理员发送广播消息时校验 `insertOne` 返回值，若写入失败则返回明确错误信息。

#### Scenario: 写入成功
- **WHEN** 广播消息成功写入 `push_messages`
- **THEN** 正常返回 `messageId`

#### Scenario: 写入失败
- **WHEN** `insertOne` 返回null（DB未连接）
- **THEN** 返回500错误: `{ success: false, error: '消息存储失败，数据库连接不可用' }`

### Requirement: Admin服务端DB连接状态诊断
系统SHALL在Admin反馈列表查询时检测并日志输出 `adminDB` 连接状态，以便快速定位DB连接问题。

#### Scenario: 查询反馈列表
- **WHEN** Admin请求反馈列表
- **THEN** 日志输出 `[Admin反馈] 查询列表, isConnected={状态}, page={页码}, filter={筛选条件}`

### Requirement: 推送通知HTTP调用错误详情
系统SHALL在 `notifyFeedbackPush` HTTP调用失败时输出详细错误信息，包括HTTP状态码、响应体内容，而非仅输出 `error.message`。

#### Scenario: HTTP调用成功
- **WHEN** 主服务端返回200
- **THEN** 无额外日志（或简洁日志）

#### Scenario: HTTP调用失败（网络/服务不可用）
- **WHEN** 主服务端不可达
- **THEN** 输出 `[反馈推送] HTTP调用失败: {status}, {responseData}, {errorMessage}`

#### Scenario: HTTP调用403（Token不匹配）
- **WHEN** 主服务端返回403
- **THEN** 输出 `[反馈推送] 鉴权失败(403): 请检查 INTERNAL_API_TOKEN 配置一致性`

## MODIFIED Requirements

### Requirement: 反馈推送通知（修改自 add-feedback-push-notification）
原需求：visitorId无设备时仅记录日志不发送（不创建消息记录）
新需求：visitorId无设备时仍创建 `push_messages` 记录（sentAt=null），供管理员查看推送历史