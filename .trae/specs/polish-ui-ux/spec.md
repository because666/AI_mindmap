# UI/UX 精致化优化 Spec

## Why
产品功能完整但缺乏 DeepSeek、豆包等产品的"简洁好用"感，核心原因是视觉精致度不足、交互反馈缺失、面板过渡生硬、信息层次混乱。用户感知到的"怪"本质上是多个微小体验缺陷的叠加效应。

## What Changes
- 统一全局圆角语言（消息气泡、卡片、输入框、面板统一为 rounded-2xl）
- ChatPanel / HistoryPanel / MessageCenter 面板增加平滑展开/收起过渡动画
- 桌面端侧边栏图标增加文字标签（hover 显示），降低新用户学习成本
- 对话输入框增大视觉权重，支持多行自动扩展
- 消息气泡增加时间戳显示
- 清空对话等操作替换原生 confirm() 为自定义确认弹窗
- 移动端抽屉增加滑出动画
- WelcomePage 空状态增加快捷提问建议，提升首屏引导感
- 复制按钮移动端改为长按触发
- Three.js 背景增加 FPS 检测与自动降级

## Impact
- Affected specs: 无冲突
- Affected code: MainLayout.tsx、ChatPanel.tsx、WelcomePage.tsx、MindMapThumbnail.tsx、index.css、DreamyUniverseBackground.tsx

## ADDED Requirements

### Requirement: 面板过渡动画
系统 SHALL 为 ChatPanel、HistoryPanel、MessageCenter 的打开/关闭提供平滑过渡动画，关闭时使用宽度收缩 + 透明度渐变，而非突然消失。

#### Scenario: 用户关闭 ChatPanel
- **WHEN** 用户点击关闭 ChatPanel
- **THEN** ChatPanel 从当前宽度平滑收缩至 0，同时透明度从 1 渐变至 0，过渡时长 300ms
- **AND** 主画布区域同步平滑扩展填充空间

#### Scenario: 用户打开 ChatPanel
- **WHEN** 用户点击打开 ChatPanel
- **THEN** ChatPanel 从 0 宽度平滑展开至目标宽度，同时透明度从 0 渐变至 1

### Requirement: 桌面端侧边栏图标标签
系统 SHALL 在桌面端侧边栏图标 hover 时显示文字标签 tooltip，降低新用户学习成本。

#### Scenario: 新用户首次使用侧边栏
- **WHEN** 用户将鼠标悬停在侧边栏图标上
- **THEN** 在图标右侧显示文字标签（如"对话""历史""设置"），延迟不超过 200ms
- **AND** 标签样式与整体暗色主题协调

### Requirement: 对话输入框多行自动扩展
系统 SHALL 使对话输入框支持多行自动扩展，最大高度不超过 160px。

#### Scenario: 用户输入多行文本
- **WHEN** 用户在输入框中输入多行文本（通过 Shift+Enter 换行）
- **THEN** 输入框高度随内容自动增长，最大不超过 160px
- **AND** 超出最大高度后出现滚动条

### Requirement: 消息时间戳
系统 SHALL 在每条消息气泡下方显示发送时间。

#### Scenario: 用户查看对话历史
- **WHEN** 用户查看对话中的消息
- **THEN** 每条消息下方显示发送时间（格式：HH:MM，跨天显示 MM/DD HH:MM）
- **AND** 时间戳颜色使用低对比度文字（dark-500），不干扰主要阅读

### Requirement: 自定义确认弹窗
系统 SHALL 使用自定义确认弹窗替代原生 confirm()，保持视觉一致性。

#### Scenario: 用户清空对话
- **WHEN** 用户点击清空对话按钮
- **THEN** 弹出自定义确认弹窗，包含标题、描述文字、取消和确认按钮
- **AND** 弹窗样式与整体暗色主题协调，带毛玻璃背景遮罩

### Requirement: 移动端抽屉滑出动画
系统 SHALL 为移动端抽屉式侧边栏增加滑出关闭动画。

#### Scenario: 用户关闭移动端侧边栏
- **WHEN** 用户点击遮罩区域或返回按钮关闭侧边栏
- **THEN** 侧边栏从当前位置平滑滑出至左侧屏幕外，过渡时长 250ms
- **AND** 遮罩层同步淡出

### Requirement: WelcomePage 快捷提问建议
系统 SHALL 在 WelcomePage 已注册用户的工作区列表下方展示快捷提问建议卡片。

#### Scenario: 新用户首次进入工作区
- **WHEN** 用户首次进入工作区并打开 ChatPanel
- **THEN** ChatPanel 空状态区域展示 3-4 个快捷提问建议（如"帮我分析这个主题的关键概念""生成子主题扩展思路"）
- **AND** 点击建议可直接发送到对话

### Requirement: Three.js 背景 FPS 降级
系统 SHALL 检测渲染帧率并自动降级 Three.js 背景粒子数量。

#### Scenario: 低端设备运行时帧率低于 30fps
- **WHEN** Three.js 背景渲染帧率连续 3 秒低于 30fps
- **THEN** 自动将粒子数量减少 50%
- **AND** 帧率恢复至 45fps 以上后不自动恢复（避免反复切换）

## MODIFIED Requirements

### Requirement: 统一圆角语言
全局圆角规范统一为：按钮/输入框 rounded-xl，卡片/面板/消息气泡 rounded-2xl，弹窗 rounded-3xl。当前代码中混用的 rounded-lg、rounded-xl、rounded-2xl 需按此规范统一调整。

### Requirement: 复制按钮移动端适配
当前复制按钮依赖 hover 状态显示（opacity-0 group-hover:opacity-100），移动端无 hover。修改为：桌面端保持 hover 显示，移动端始终显示（opacity-70），长按触发复制。
