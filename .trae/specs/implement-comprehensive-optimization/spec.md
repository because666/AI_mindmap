# DeepMindMap V2 全面优化实施规格

## Why

基于产品优化分析，项目在数据安全、用户体验一致性、核心功能完整度、AI能力深度等方面存在明显短板。本规格覆盖 P0-P2 级优化方向，共 19 个优化项，分 5 个阶段实施。

## What Changes

### 阶段一：数据安全与可靠性（P0）
- NodeService 内存缓存添加 LRU 淘汰策略和工作区按需加载/卸载
- 客户端数据同步添加操作队列和失败重试机制
- CORS 配置从 `origin: '*'` 改为环境变量控制的域名白名单
- 内部 API 令牌强制要求环境变量设置
- 服务端配置启动时校验必要环境变量

### 阶段二：用户体验基础（P0）
- 新增全局 Toast 通知组件，替换所有 `alert()` 调用
- ConfirmDialog 支持自定义按钮变体（危险/普通）

### 阶段三：核心功能补齐（P1）
- 撤销/重做功能完善（命令模式实现）
- 结论提炼功能（AI 自动总结对话结论生成结论节点）
- 关系权重影响 AI 上下文策略
- 节点智能标题（AI 生成精炼标题）

### 阶段四：交互体验提升（P1）
- 键盘快捷键系统（Ctrl+K 搜索、Ctrl+Z/Y 撤销重做、Delete 删除等）
- 画布工具栏分组优化（创建/编辑/视图/操作四组，移动端折叠）
- 连接点可见性优化（移动端始终显示、选中节点显示连接点）
- 搜索功能增强（结果高亮、定位节点、搜索历史、防抖）
- UI 一致性修复（MessageCenter 色值统一、弹窗移动端适配、alert 替换）

### 阶段五：AI 能力与性能（P2）
- AI 用量追踪与配额管理
- AI 服务降级与容错（Provider 故障自动切换）
- 上下文窗口管理（Token 数量限制和动态截断）
- 毛玻璃效果性能降级（低端设备自动降级）
- MongoDB 索引补齐
- Dashboard 趋势查询优化（聚合管道替代逐日查询）

## Impact

- Affected specs: product-optimization-analysis
- Affected code:
  - 客户端：appStore.ts、CanvasPage.tsx、ChatPanel.tsx、SearchPanel.tsx、ConfirmDialog.tsx、CompositeNodeCreator.tsx、RelationEditor.tsx、MessageList.tsx、MessageDetail.tsx、FilePanel.tsx、WorkspaceSettingsModal.tsx、index.css、main.tsx
  - 服务端：nodeService.ts、index.ts、config/index.ts、aiService.ts、conversations.ts
  - 管理后台：cacheNotify.ts

---

## ADDED Requirements

### Requirement: Toast 通知系统

系统 SHALL 提供全局 Toast 通知组件，支持成功/警告/错误/信息四种类型，支持堆叠显示、自动消失（3秒）、手动关闭。

#### Scenario: 操作成功反馈
- **WHEN** 用户执行复制、同步、保存等操作成功
- **THEN** 显示绿色成功 Toast，3秒后自动消失

#### Scenario: 操作失败反馈
- **WHEN** 用户执行操作失败（如网络错误、服务端错误）
- **THEN** 显示红色错误 Toast，需手动关闭或10秒后消失

#### Scenario: 数据同步失败
- **WHEN** 客户端与服务端数据同步失败
- **THEN** 显示警告 Toast 提示同步失败，并提供重试入口

---

### Requirement: 键盘快捷键系统

系统 SHALL 支持以下键盘快捷键：
- Ctrl+K / Cmd+K：打开搜索面板
- Ctrl+Z / Cmd+Z：撤销
- Ctrl+Y / Cmd+Shift+Z：重做
- Delete / Backspace：删除选中节点
- Ctrl+S / Cmd+S：手动同步数据
- Escape：关闭当前面板/弹窗

#### Scenario: 快捷键触发搜索
- **WHEN** 用户按下 Ctrl+K
- **THEN** 搜索面板打开并自动聚焦输入框

#### Scenario: 快捷键撤销
- **WHEN** 用户按下 Ctrl+Z 且撤销栈非空
- **THEN** 执行撤销操作，恢复上一状态

---

### Requirement: 结论提炼功能

系统 SHALL 支持从对话中提炼结论并生成结论节点。

#### Scenario: 单节点结论提炼
- **WHEN** 用户在对话面板点击"提炼结论"按钮
- **THEN** AI 自动总结当前对话核心结论，生成结论节点，以 `conclusion` 关系类型连接到源节点

#### Scenario: 结论节点编辑
- **WHEN** 用户双击结论节点
- **THEN** 可手动编辑结论内容

---

### Requirement: 撤销/重做命令模式

系统 SHALL 使用命令模式实现撤销/重做，每个操作记录描述、正向执行逻辑和反向撤销逻辑。

#### Scenario: 撤销删除节点
- **WHEN** 用户撤销一个删除节点操作
- **THEN** 被删除的节点及其关系恢复到画布上

#### Scenario: 历史记录描述
- **WHEN** 用户打开历史面板
- **THEN** 每条历史记录显示操作描述（如"删除节点：xxx"、"创建关系：xxx"）

---

### Requirement: 关系权重影响上下文

系统 SHALL 根据关系类型调整 AI 对话上下文的权重和排列策略。

#### Scenario: 矛盾关系上下文
- **WHEN** 当前节点与某祖先节点通过 `contradicts` 关系连接
- **THEN** 上下文中标注"以下内容与当前观点矛盾"，AI 在回复时考虑矛盾信息

#### Scenario: 支持关系上下文
- **WHEN** 当前节点与某祖先节点通过 `supports` 关系连接
- **THEN** 该祖先节点的上下文权重增强，优先提供给 AI

---

### Requirement: 节点智能标题

系统 SHALL 在 AI 对话首次回复后自动生成精炼的节点标题。

#### Scenario: 自动标题生成
- **WHEN** AI 对话首次回复完成
- **THEN** 自动调用 AI 生成不超过10字的节点标题，替换默认截取标题

#### Scenario: 手动修改标题
- **WHEN** 用户手动编辑节点标题
- **THEN** 保留用户手动编辑的标题，后续 AI 回复不再自动覆盖

---

### Requirement: NodeService LRU 缓存

系统 SHALL 为 NodeService 的内存缓存实现 LRU 淘汰策略，设置最大缓存条目数，支持按工作区按需加载和卸载。

#### Scenario: 缓存淘汰
- **WHEN** 缓存节点数量超过最大限制（默认10000）
- **THEN** 自动淘汰最久未访问的工作区缓存

#### Scenario: 工作区切换
- **WHEN** 用户切换到新工作区
- **THEN** 释放旧工作区的节点和关系缓存，加载新工作区数据

---

### Requirement: 数据同步操作队列

系统 SHALL 实现客户端操作队列，支持失败重试和同步状态提示。

#### Scenario: 同步失败重试
- **WHEN** 客户端与服务端数据同步失败
- **THEN** 操作进入重试队列，自动重试最多3次，间隔递增（1s/2s/4s）

#### Scenario: 同步状态提示
- **WHEN** 存在未同步的操作
- **THEN** 画布工具栏同步按钮显示待同步数量标记

---

### Requirement: CORS 安全加固

系统 SHALL 将 CORS 配置从 `origin: '*'` 改为环境变量控制的域名白名单。

#### Scenario: 生产环境 CORS
- **WHEN** 生产环境设置了 `CORS_ORIGINS` 环境变量
- **THEN** 仅允许指定域名的跨域请求

#### Scenario: 开发环境 CORS
- **WHEN** 开发环境未设置 `CORS_ORIGINS` 环境变量
- **THEN** 允许 localhost 的跨域请求

---

### Requirement: 画布工具栏分组优化

系统 SHALL 将画布工具栏按钮按功能分组，移动端折叠次要操作。

#### Scenario: 桌面端分组显示
- **WHEN** 用户在桌面端查看工具栏
- **THEN** 按钮按创建/编辑/视图/操作四组显示，组间有视觉分隔

#### Scenario: 移动端折叠菜单
- **WHEN** 用户在移动端查看工具栏
- **THEN** 仅显示核心操作按钮，次要操作收入"更多"菜单

---

### Requirement: 连接点可见性优化

系统 SHALL 优化节点连接点的可见性，移动端始终显示连接点，选中节点时显示连接点。

#### Scenario: 移动端连接点
- **WHEN** 用户在移动端查看节点
- **THEN** 连接点以降低透明度（opacity: 0.4）始终可见

#### Scenario: 选中节点连接点
- **WHEN** 用户选中某个节点
- **THEN** 该节点的连接点完全可见（opacity: 1）

---

### Requirement: 搜索功能增强

系统 SHALL 增强搜索功能，支持结果高亮、节点定位、搜索历史和输入防抖。

#### Scenario: 搜索结果高亮
- **WHEN** 用户输入搜索关键词
- **THEN** 搜索结果中匹配的关键词高亮显示

#### Scenario: 点击结果定位节点
- **WHEN** 用户点击搜索结果
- **THEN** 画布自动定位到对应节点并居中显示

#### Scenario: 搜索历史
- **WHEN** 用户打开搜索面板
- **THEN** 显示最近5条搜索历史记录

---

### Requirement: UI 一致性修复

系统 SHALL 统一 MessageCenter 组件色值为项目主题色，所有弹窗组件统一移动端全屏适配。

#### Scenario: MessageCenter 色值统一
- **WHEN** 用户查看消息中心
- **THEN** 色值使用 `dark-*/primary-*` 体系，与项目其他组件一致

#### Scenario: 弹窗移动端全屏
- **WHEN** 用户在移动端打开 FilePanel 或 WorkspaceSettingsModal
- **THEN** 弹窗以全屏模式显示

---

### Requirement: AI 用量追踪

系统 SHALL 持久化每次 AI 调用的 Token 用量、模型和响应时间。

#### Scenario: Token 用量记录
- **WHEN** AI 调用完成
- **THEN** 将 prompt_tokens、completion_tokens、model、response_time_ms 持久化到 MongoDB

---

### Requirement: AI 服务降级容错

系统 SHALL 在主 Provider 失败时自动切换到备用 Provider，流式响应添加超时控制。

#### Scenario: Provider 故障降级
- **WHEN** 主 Provider 请求失败
- **THEN** 自动尝试备用 Provider，并通知用户"当前使用备用模型"

#### Scenario: 流式超时
- **WHEN** 流式响应30秒内无新数据
- **THEN** 自动断开连接并提示用户

---

### Requirement: 上下文窗口管理

系统 SHALL 根据目标模型的上下文窗口大小动态截断对话上下文。

#### Scenario: 上下文超出窗口
- **WHEN** 收集的对话上下文 Token 数量超过模型窗口的80%
- **THEN** 自动截断最早的对话，优先保留最近和最相关的对话

---

### Requirement: 毛玻璃效果性能降级

系统 SHALL 在低端设备上自动降级毛玻璃效果为纯色半透明背景。

#### Scenario: 低 FPS 自动降级
- **WHEN** 设备 FPS 持续低于30帧
- **THEN** 自动将 `backdrop-blur` 替换为纯色半透明背景

---

### Requirement: MongoDB 索引补齐

系统 SHALL 为缺少索引的集合添加必要索引。

#### Scenario: visitors 集合索引
- **WHEN** 服务端启动
- **THEN** 确保 `visitors.id` 唯一索引已创建

---

### Requirement: Dashboard 趋势查询优化

系统 SHALL 使用 MongoDB 聚合管道替代逐日查询趋势数据。

#### Scenario: 趋势数据查询
- **WHEN** 管理后台请求30天趋势数据
- **THEN** 使用单次聚合管道查询获取所有天数据，而非30次独立查询

---

## MODIFIED Requirements

### Requirement: ConfirmDialog 按钮变体

ConfirmDialog SHALL 支持自定义按钮变体（danger/warning/primary），默认为 danger。

- 原实现：确认按钮固定为 `bg-red-600`
- 修改后：通过 `variant` 属性控制按钮颜色，`danger` 为红色，`primary` 为蓝色

### Requirement: 内部 API 令牌安全

内部 API 令牌 SHALL 通过环境变量强制设置，不再使用弱默认值。

- 原实现：`INTERNAL_TOKEN` 默认为 `'deepmindmap-internal-2024'`
- 修改后：未设置环境变量时拒绝启动

### Requirement: 服务端配置启动校验

服务端 SHALL 在启动时校验必要的环境变量，未设置时拒绝启动或输出明确警告。

- 原实现：所有配置项使用默认值静默运行
- 修改后：生产环境关键配置（JWT_SECRET、数据库密码、内部令牌）未设置时拒绝启动
