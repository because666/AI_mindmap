# UI/UX 精致化优化 - 验收清单

- [x] ChatPanel 关闭时有平滑宽度收缩+透明度渐变动画，非突然消失
- [x] ChatPanel 打开时有平滑宽度展开+透明度渐变动画
- [x] HistoryPanel 和 MessageCenter 同样有平滑过渡动画
- [x] 主画布区域随面板开合同步平滑扩展/收缩
- [x] 桌面端侧边栏图标 hover 时显示文字标签，延迟不超过 200ms
- [x] 对话输入框支持多行自动扩展，最大高度 160px
- [x] 每条消息下方显示发送时间（当天 HH:MM，跨天 MM/DD HH:MM）
- [x] 清空对话使用自定义确认弹窗，非原生 confirm()
- [x] 移动端侧边栏关闭时有滑出动画，遮罩同步淡出
- [x] ChatPanel 空状态展示 3-4 个快捷提问建议，点击可直接发送
- [x] Three.js 背景在低端设备帧率低于 30fps 时自动降级粒子数量
- [x] 全局圆角统一：按钮/输入框 rounded-xl，卡片/面板/气泡 rounded-2xl，弹窗 rounded-3xl
- [x] 复制按钮移动端始终可见（opacity-70），长按触发复制
- [x] 代码无 TypeScript 类型错误
- [x] 所有修改不破坏现有功能
