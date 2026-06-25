# Tasks

- [ ] Task 1: 安装 i18n 依赖并创建初始化配置
  - [ ] SubTask 1.1: 安装 i18next 和 react-i18next 依赖
  - [ ] SubTask 1.2: 创建 `client/src/locales/` 目录结构，按 namespace 创建 zh.json 和 en.json 文件
  - [ ] SubTask 1.3: 创建 `client/src/i18n.ts` 初始化配置（语言检测、默认语言、namespace 加载、localStorage 持久化）
  - [ ] SubTask 1.4: 在 `client/src/main.tsx` 中导入 i18n 初始化

- [ ] Task 2: 创建翻译资源文件（中文 + 英文）
  - [ ] SubTask 2.1: 创建 common namespace（通用按钮、确认/取消、加载中等）
  - [ ] SubTask 2.2: 创建 nav namespace（导航菜单项）
  - [ ] SubTask 2.3: 创建 canvas namespace（画布页面文本）
  - [ ] SubTask 2.4: 创建 chat namespace（AI 对话面板文本）
  - [ ] SubTask 2.5: 创建 workspace namespace（工作区相关文本）
  - [ ] SubTask 2.6: 创建 settings namespace（设置面板文本）
  - [ ] SubTask 2.7: 创建 search namespace（搜索面板文本）
  - [ ] SubTask 2.8: 创建 feedback namespace（反馈弹窗文本）
  - [ ] SubTask 2.9: 创建 message namespace（消息中心文本）
  - [ ] SubTask 2.10: 创建 history namespace（操作历史文本）
  - [ ] SubTask 2.11: 创建 file namespace（文件管理文本）
  - [ ] SubTask 2.12: 创建 onboarding namespace（新手引导内容）
  - [ ] SubTask 2.13: 创建 announcement namespace（公告弹窗文本）

- [ ] Task 3: 逐组件替换硬编码中文为 t() 调用
  - [ ] SubTask 3.1: MainLayout.tsx — 导航菜单、工具栏文本
  - [ ] SubTask 3.2: CanvasPage.tsx — 画布空状态、工具提示、右键菜单
  - [ ] SubTask 3.3: ChatPanel.tsx — 对话面板按钮、提示、建议文本
  - [ ] SubTask 3.4: WelcomePage.tsx — 欢迎页文本
  - [ ] SubTask 3.5: WorkspaceSettingsModal.tsx — 工作区设置文本
  - [ ] SubTask 3.6: SettingsModal.tsx + APIConfigPanel.tsx + AddModelModal.tsx + UISettingsPanel.tsx — 设置面板文本
  - [ ] SubTask 3.7: SearchPanel.tsx — 搜索面板文本
  - [ ] SubTask 3.8: FeedbackModal.tsx — 反馈弹窗文本
  - [ ] SubTask 3.9: FilePanel.tsx — 文件管理文本
  - [ ] SubTask 3.10: NodeEditor.tsx + RelationEditor.tsx + CompositeNodeCreator.tsx — 节点编辑文本
  - [ ] SubTask 3.11: MessageList.tsx + MessageDetail.tsx + UnreadBadge.tsx — 消息中心文本
  - [ ] SubTask 3.12: HistoryPanel.tsx — 操作历史文本
  - [ ] SubTask 3.13: NodeContextMenu.tsx — 右键菜单文本
  - [ ] SubTask 3.14: ConfirmDialog.tsx — 确认弹窗文本
  - [ ] SubTask 3.15: BroadcastPopup.tsx + AnnouncementBanner.tsx — 公告文本
  - [ ] SubTask 3.16: OnboardingGuide.tsx + onboardingContent.ts — 新手引导文本
  - [ ] SubTask 3.17: MindMapThumbnail.tsx — 思维导图缩略图文本
  - [ ] SubTask 3.18: App.tsx — 网络断开提示、加载中文本

- [ ] Task 4: 替换 Store 和 Service 中的硬编码中文
  - [ ] SubTask 4.1: appStore.ts — 默认节点标题、Toast 消息
  - [ ] SubTask 4.2: chatService.ts — 错误消息、提示消息
  - [ ] SubTask 4.3: visitorWorkspaceStore.ts — 错误消息
  - [ ] SubTask 4.4: api.ts — 错误消息
  - [ ] SubTask 4.5: pushService.ts — 通知文本
  - [ ] SubTask 4.6: toastStore.ts — 默认提示文本
  - [ ] SubTask 4.7: mobileService.ts — 日志消息（可选，非用户可见）

- [ ] Task 5: 添加语言切换 UI
  - [ ] SubTask 5.1: 在 SettingsModal/UISettingsPanel 中添加语言切换下拉框
  - [ ] SubTask 5.2: 在 MainLayout 顶栏添加语言快捷切换图标按钮
  - [ ] SubTask 5.3: 语言切换后自动刷新界面文本（i18next 内置支持）

- [ ] Task 6: 构建验证与部署
  - [ ] SubTask 6.1: client 构建通过
  - [ ] SubTask 6.2: 上传到服务器
  - [ ] SubTask 6.3: 验证中英文切换功能正常

# Task Dependencies
- Task 1 是所有后续任务的前置条件
- Task 2 和 Task 3 可并行（边写翻译资源边替换组件）
- Task 4 依赖 Task 2（需要翻译 key 已定义）
- Task 5 依赖 Task 1（需要 i18n 初始化完成）
- Task 6 依赖所有前置任务
