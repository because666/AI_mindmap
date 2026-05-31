# Tasks

## 阶段一：数据安全与可靠性（P0）

- [x] Task 1: NodeService 内存缓存 LRU 淘汰策略
  - [x] SubTask 1.1: 在 server/src/services/nodeService.ts 中实现 LRU 缓存类
  - [x] SubTask 1.2: 将 memoryNodes 改为按工作区分组的 LRU 缓存
  - [x] SubTask 1.3: 将 memoryRelations 改为按工作区分组的缓存
  - [x] SubTask 1.4: 添加缓存命中率统计和最大容量监控
  - [x] SubTask 1.5: 编写 nodeService LRU 缓存单元测试

- [x] Task 2: 客户端数据同步操作队列
  - [x] SubTask 2.1: 新增 syncQueue 状态和操作队列管理逻辑
  - [x] SubTask 2.2: 将所有 fire-and-forget API 调用改为入队操作
  - [x] SubTask 2.3: 添加 pendingSyncCount 状态和同步按钮徽标
  - [x] SubTask 2.4: 同步失败时通过 Toast 通知用户

- [x] Task 3: CORS 安全加固
  - [x] SubTask 3.1: 添加 CORS_ORIGINS 配置项
  - [x] SubTask 3.2: 修改 CORS 中间件配置
  - [x] SubTask 3.3: 更新 .env.example

- [x] Task 4: 内部 API 令牌安全加固
  - [x] SubTask 4.1: 修改 cacheNotify.ts 移除弱默认值
  - [x] SubTask 4.2: 修改 server 内部 API 令牌校验
  - [x] SubTask 4.3: 更新 .env.example

- [x] Task 5: 服务端配置启动校验
  - [x] SubTask 5.1: 添加配置校验函数
  - [x] SubTask 5.2: 生产环境关键配置未设置时拒绝启动
  - [x] SubTask 5.3: 非关键配置未设置时输出警告

## 阶段二：用户体验基础（P0）

- [x] Task 6: 全局 Toast 通知组件
  - [x] SubTask 6.1: 创建 Toast.tsx 组件
  - [x] SubTask 6.2: 创建 toastStore.ts
  - [x] SubTask 6.3: 在 App.tsx 中挂载 Toast 容器
  - [x] SubTask 6.4: 添加 Toast 动画样式
  - [x] SubTask 6.5: 替换 CompositeNodeCreator.tsx 中的 alert()
  - [x] SubTask 6.6: 替换 RelationEditor.tsx 中的 alert()
  - [x] SubTask 6.7: 关键操作添加 Toast 反馈

- [x] Task 7: ConfirmDialog 按钮变体支持
  - [x] SubTask 7.1: 添加 variant 属性
  - [x] SubTask 7.2: 更新所有 ConfirmDialog 调用点

## 阶段三：核心功能补齐（P1）

- [x] Task 8: 撤销/重做命令模式实现
  - [x] SubTask 8.1: 定义 Command 接口
  - [x] SubTask 8.2: 重构 pushHistory 为 pushCommand
  - [x] SubTask 8.3: 重构 undo/redo
  - [x] SubTask 8.4: 为所有关键操作实现 Command
  - [x] SubTask 8.5: 更新 HistoryPanel 显示操作描述

- [x] Task 9: 结论提炼功能
  - [x] SubTask 9.1: 添加结论提炼提示词模板
  - [x] SubTask 9.2: 添加结论提炼 API 端点
  - [x] SubTask 9.3: 添加结论提炼 API 调用
  - [x] SubTask 9.4: 添加"提炼结论"按钮
  - [x] SubTask 9.5: 添加创建结论节点逻辑
  - [x] SubTask 9.6: 结论节点特殊样式

- [x] Task 10: 关系权重影响上下文
  - [x] SubTask 10.1: 添加关系权重逻辑
  - [x] SubTask 10.2: 定义上下文标注模板
  - [x] SubTask 10.3: 根据关系类型插入系统提示

- [x] Task 11: 节点智能标题
  - [x] SubTask 11.1: 添加标题生成提示词
  - [x] SubTask 11.2: 添加标题生成 API
  - [x] SubTask 11.3: 添加标题生成 API 调用
  - [x] SubTask 11.4: AI 首次回复后自动调用标题生成
  - [x] SubTask 11.5: 添加标题重新生成按钮

## 阶段四：交互体验提升（P1）

- [x] Task 12: 键盘快捷键系统
  - [x] SubTask 12.1: 创建 useKeyboardShortcuts Hook
  - [x] SubTask 12.2: 实现所有快捷键
  - [x] SubTask 12.3: 在 CanvasPage 中集成
  - [x] SubTask 12.4: tooltip 显示快捷键提示

- [x] Task 13: 画布工具栏分组优化
  - [x] SubTask 13.1: 按创建/编辑/视图/操作四组布局
  - [x] SubTask 13.2: 桌面端组间添加视觉分隔线
  - [x] SubTask 13.3: 移动端核心操作+更多菜单
  - [x] SubTask 13.4: tooltip 显示功能名称和快捷键

- [x] Task 14: 连接点可见性优化
  - [x] SubTask 14.1: 修改 Handle 样式逻辑
  - [x] SubTask 14.2: 移动端连接点 opacity: 0.4
  - [x] SubTask 14.3: 选中节点时连接点 opacity: 1
  - [x] SubTask 14.4: 修改 CSS Handle 样式

- [x] Task 15: 搜索功能增强
  - [x] SubTask 15.1: 搜索输入防抖 300ms
  - [x] SubTask 15.2: 搜索结果高亮匹配关键词
  - [x] SubTask 15.3: 点击结果定位到节点
  - [x] SubTask 15.4: 搜索历史记录
  - [x] SubTask 15.5: 搜索面板自动聚焦

- [x] Task 16: UI 一致性修复
  - [x] SubTask 16.1: MessageList 色值统一
  - [x] SubTask 16.2: MessageDetail 色值统一
  - [x] SubTask 16.3: FilePanel 移动端全屏适配
  - [x] SubTask 16.4: WorkspaceSettingsModal 移动端全屏适配
  - [x] SubTask 16.5: 修复 MessageDetail any 类型

## 阶段五：AI 能力与性能（P2）

- [x] Task 17: AI 用量追踪
  - [x] SubTask 17.1: 创建 ai_usage 集合及索引
  - [x] SubTask 17.2: 添加用量记录逻辑
  - [x] SubTask 17.3: 流式响应完成后记录用量
  - [x] SubTask 17.4: 添加 AI 用量查询 API

- [x] Task 18: AI 服务降级与容错
  - [x] SubTask 18.1: 实现 Provider 降级链
  - [x] SubTask 18.2: 添加30秒超时控制
  - [x] SubTask 18.3: 降级时通知客户端

- [x] Task 19: 上下文窗口管理
  - [x] SubTask 19.1: 添加 Token 估算函数
  - [x] SubTask 19.2: 上下文动态截断
  - [x] SubTask 19.3: ChatPanel 上下文使用量指示器

- [x] Task 20: 毛玻璃效果性能降级
  - [x] SubTask 20.1: 添加 performanceMode 状态
  - [x] SubTask 20.2: FPS 检测和自动降级
  - [x] SubTask 20.3: 性能模式 CSS 降级
  - [x] SubTask 20.4: 设置面板性能模式开关

- [x] Task 21: MongoDB 索引补齐
  - [x] SubTask 21.1: 添加启动时索引创建逻辑
  - [x] SubTask 21.2: visitors.id 唯一索引
  - [x] SubTask 21.3: workspaces.id 唯一索引
  - [x] SubTask 21.4: attack_logs.ipAddress 索引

- [x] Task 22: Dashboard 趋势查询优化
  - [x] SubTask 22.1: 重构 getTrends 方法
  - [x] SubTask 22.2: 使用聚合管道一次查询
  - [x] SubTask 22.3: 添加5分钟缓存
