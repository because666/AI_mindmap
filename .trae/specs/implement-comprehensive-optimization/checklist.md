# 全面优化实施 - 检查清单

## 阶段一：数据安全与可靠性（P0）
- [x] NodeService LRU 缓存淘汰策略已实现，memoryNodes 和 memoryRelations 有最大容量限制
- [x] NodeService 支持按工作区按需加载和卸载缓存
- [x] 客户端数据同步操作队列已实现，支持失败重试（最多3次，间隔递增）
- [x] 同步失败时通过 Toast 通知用户
- [x] 工具栏同步按钮显示待同步数量
- [x] CORS 配置已从 origin: '*' 改为环境变量控制的域名白名单
- [x] 内部 API 令牌未设置环境变量时拒绝启动
- [x] 服务端启动时校验关键环境变量，未设置时拒绝启动或输出警告

## 阶段二：用户体验基础（P0）
- [x] Toast 组件已创建，支持 success/warning/error/info 四种类型
- [x] Toast 支持堆叠显示、自动消失、手动关闭
- [x] CompositeNodeCreator.tsx 中的 alert() 已替换为 Toast
- [x] RelationEditor.tsx 中的 alert() 已替换为 Toast
- [x] 关键操作（同步、复制、保存、删除）已添加 Toast 反馈
- [x] ConfirmDialog 支持 variant 属性（danger/primary）
- [x] 所有 ConfirmDialog 调用点已根据操作类型传入正确的 variant

## 阶段三：核心功能补齐（P1）
- [x] 撤销/重做已使用命令模式重构，每个操作有描述和反向逻辑
- [x] 撤销删除节点操作可恢复节点及其关系
- [x] HistoryPanel 显示操作描述
- [x] 结论提炼功能已实现，AI 可自动总结对话结论
- [x] 结论节点以 conclusion 关系类型连接到源节点
- [x] 结论节点在画布上有特殊样式
- [x] 关系权重已影响 AI 上下文策略
- [x] contradicts 关系在上下文中标注"以下内容与当前观点矛盾"
- [x] supports 关系增强上下文权重
- [x] 节点智能标题已实现，AI 首次回复后自动生成不超过10字的标题
- [x] 用户可手动修改标题，手动修改后不再自动覆盖
- [x] 标题重新生成按钮已添加

## 阶段四：交互体验提升（P1）
- [x] Ctrl+K 可打开搜索面板
- [x] Ctrl+Z/Y 可撤销/重做
- [x] Delete 可删除选中节点
- [x] Ctrl+S 可手动同步
- [x] Escape 可关闭当前面板/弹窗
- [x] 工具栏按钮按创建/编辑/视图/操作四组显示
- [x] 移动端次要操作收入"更多"菜单
- [x] 工具栏按钮 tooltip 显示快捷键
- [x] 移动端连接点始终可见（opacity: 0.4）
- [x] 选中节点时连接点完全可见（opacity: 1）
- [x] 搜索输入有300ms防抖
- [x] 搜索结果高亮匹配关键词
- [x] 点击搜索结果可定位到节点并居中
- [x] 搜索历史记录功能已实现（最近5条）
- [x] MessageList.tsx 色值已统一为 dark-*/primary-*
- [x] MessageDetail.tsx 色值已统一为 dark-*/primary-*
- [x] FilePanel.tsx 已添加移动端全屏适配
- [x] WorkspaceSettingsModal.tsx 已添加移动端全屏适配
- [x] MessageDetail.tsx 中的 any 类型已修复

## 阶段五：AI 能力与性能（P2）
- [x] AI 调用的 Token 用量已持久化到 MongoDB
- [x] AI 用量查询 API 已实现
- [x] Provider 故障自动降级到备用 Provider
- [x] 流式响应30秒超时控制已实现
- [x] 降级时通知客户端当前使用备用模型
- [x] 上下文构建根据模型窗口大小动态截断
- [x] ChatPanel 显示当前上下文使用量指示器
- [x] 低 FPS 时自动启用性能模式，毛玻璃效果降级为纯色半透明背景
- [x] 设置中有"性能模式"开关
- [x] visitors.id 唯一索引已创建
- [x] workspaces.id 唯一索引已创建
- [x] attack_logs.ipAddress 索引已创建
- [x] Dashboard 趋势查询已使用聚合管道优化
- [x] 趋势数据有5分钟缓存

## 编译验证
- [x] client TypeScript 编译通过（exit code 0）
- [x] server TypeScript 编译通过（exit code 0）
- [x] admin/server TypeScript 编译通过（exit code 0）
