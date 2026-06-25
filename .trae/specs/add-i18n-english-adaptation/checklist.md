# 主网站英文适配 - 检查清单

## i18n 框架
- [ ] i18next 和 react-i18next 已安装
- [ ] i18n.ts 初始化配置正确（语言检测、默认中文、localStorage 持久化）
- [ ] main.tsx 中导入了 i18n 初始化

## 翻译资源文件
- [ ] locales/ 目录结构正确（按 namespace 组织）
- [ ] 每个 namespace 都有 zh.json 和 en.json
- [ ] 中文翻译与原硬编码文本一致
- [ ] 英文翻译准确、自然

## 组件替换
- [ ] MainLayout 导航菜单文本已替换
- [ ] CanvasPage 画布文本已替换
- [ ] ChatPanel 对话面板文本已替换
- [ ] WelcomePage 欢迎页文本已替换
- [ ] WorkspaceSettingsModal 工作区设置文本已替换
- [ ] SettingsModal + 子面板设置文本已替换
- [ ] SearchPanel 搜索面板文本已替换
- [ ] FeedbackModal 反馈弹窗文本已替换
- [ ] FilePanel 文件管理文本已替换
- [ ] NodeEditor + RelationEditor 节点编辑文本已替换
- [ ] MessageCenter 消息中心文本已替换
- [ ] HistoryPanel 操作历史文本已替换
- [ ] NodeContextMenu 右键菜单文本已替换
- [ ] ConfirmDialog 确认弹窗文本已替换
- [ ] BroadcastPopup + AnnouncementBanner 公告文本已替换
- [ ] OnboardingGuide 新手引导文本已替换
- [ ] App.tsx 全局提示文本已替换

## Store/Service 替换
- [ ] appStore 默认标题和 Toast 消息已替换
- [ ] chatService 错误消息已替换
- [ ] visitorWorkspaceStore 错误消息已替换
- [ ] api.ts 错误消息已替换
- [ ] pushService 通知文本已替换

## 语言切换 UI
- [ ] 设置面板中有语言切换选项
- [ ] 顶栏有语言快捷切换按钮
- [ ] 切换语言后界面文本立即更新
- [ ] 语言偏好持久化到 localStorage

## 构建与部署
- [ ] client 构建通过
- [ ] 线上验收通过
