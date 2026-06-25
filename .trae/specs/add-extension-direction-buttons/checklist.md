# Checklist

- [x] `client/src/utils/extensionDirections.ts` 实现 `parseExtensionDirections` 并返回 `{ directions, cleanContent }`
- [x] 解析函数覆盖中文 `🌱 延伸方向：` 与英文 `🌱 Extension Directions:` 格式
- [x] 解析函数覆盖 `- `、`* `、数字列表等多种 Markdown 列表形式
- [x] `client/src/utils/extensionDirections.test.ts` 单测通过，覆盖正常、空、错误格式、中英文场景
- [x] `client/src/locales/chat/zh.json` 已添加按钮相关中文文案
- [x] `client/src/locales/chat/en.json` 已添加按钮相关英文文案
- [x] `ChatPanel.tsx` 中对 assistant 消息调用解析函数并渲染按钮
- [x] 消息正文显示 `cleanContent`，隐藏原始 `🌱 延伸方向：` 文本块
- [x] 流式生成中的消息不显示延伸方向按钮
- [x] 点击按钮后在当前节点下创建子节点，标题为方向文本
- [x] 点击按钮后自动选中子节点并打开其对话面板
- [x] 点击按钮后自动向子节点发送生成的追问
- [x] 桌面端按钮水平排列并自动换行
- [x] 移动端按钮垂直堆叠且宽度适配
- [x] 按钮视觉风格与现有 primary-400 主题一致
- [x] `npm run build` 通过（client）
- [x] `npm run lint` 无新增错误（修改文件）
- [x] 本地端到端验证：核心流程通过单测与构建验证；完整浏览器点击验证需启动后端服务
