# ChatPanel 输入区可见性修复 Spec

## Why
ChatPanel 输入区域按钮/图标在面板打开后"闪回"到不清晰状态，用户无法方便地辨识和操作输入区控件。经过多轮尝试（Tailwind类名调整、内联样式），问题仍未解决。需要采用全新的方案：为面板添加极淡的毛玻璃背景层，同时修复可能导致"闪回"的CSS过渡动画问题。

## What Changes
- ChatPanel 根容器添加极淡毛玻璃效果（`backdrop-blur-sm` + 极低透明度背景色），提升内容可读性
- ChatPanel 输入区域改用项目已有的 `glass-light` 或类似毛玻璃工具类，确保按钮/图标清晰可辨
- MainLayout 中 ChatPanel 外层容器的 `transition-[width,opacity]` 改为仅过渡宽度（`transition-[width]`），移除opacity过渡以消除"闪回"现象
- ChatPanel 输入区按钮统一使用项目已有的 `btn-ghost` / `btn-icon` 工具类，替代内联样式，确保样式一致性且不被覆盖

## Impact
- Affected specs: refine-chatpanel-transparency
- Affected code: ChatPanel.tsx、MainLayout.tsx

## 根因分析

### "闪回"现象的可能原因（按可能性排序）

1. **CSS opacity过渡（最可能）**：MainLayout中ChatPanel外层容器使用 `transition-[width,opacity] duration-300`，打开面板时opacity从0过渡到1。浏览器可能在过渡开始前渲染一帧完整内容（opacity=1），然后过渡从0开始渐入，造成"先正常后消失再渐入"的视觉闪回。

2. **React条件渲染**：ChatPanel在 `nodeId` 为空时渲染占位符（无输入区），`nodeId` 有值时才渲染完整UI。如果打开面板时 `selectedNodeId` 尚未更新，会导致先渲染占位符再切换到完整UI。

3. **内联样式被覆盖**：虽然内联样式优先级最高，但某些CSS属性（如 `opacity`）在父元素上设置时会级联影响子元素的视觉表现。

### 修复策略

**核心思路**：不再依赖"让按钮本身更亮"来解决问题，而是通过"给面板加一层极淡的背景"来提升整体可读性，同时修复过渡动画。

## ADDED Requirements

### Requirement: ChatPanel 毛玻璃背景层
系统 SHALL 为 ChatPanel 根容器添加极淡的毛玻璃效果，使面板内容在透明背景下依然清晰可读。

#### Scenario: 用户查看 ChatPanel
- **WHEN** 用户打开 ChatPanel
- **THEN** 面板有极淡的毛玻璃背景（backdrop-blur-sm + bg-dark-950/30 或类似）
- **AND** 粒子背景可透过面板隐约可见
- **AND** 面板内所有文字和控件清晰可读

### Requirement: ChatPanel 输入区使用项目工具类
系统 SHALL 将 ChatPanel 输入区按钮的内联样式替换为项目已有的 CSS 工具类（btn-ghost、btn-icon 等），确保样式一致性。

#### Scenario: 用户查看 ChatPanel 输入区
- **WHEN** 用户查看 ChatPanel 底部输入区域
- **THEN** 附件按钮、文件按钮使用 `btn-icon` 工具类样式
- **AND** 发送按钮使用 `btn-primary` 工具类样式
- **AND** 输入框使用 `input-field` 工具类样式
- **AND** 所有按钮和输入框清晰可辨，无需内联样式

### Requirement: 移除 ChatPanel 打开时的 opacity 过渡
系统 SHALL 将 ChatPanel 外层容器的 CSS 过渡从 `transition-[width,opacity]` 改为 `transition-[width]`，仅过渡宽度，移除可能导致"闪回"的 opacity 过渡。

#### Scenario: 用户打开 ChatPanel
- **WHEN** 用户点击打开 ChatPanel
- **THEN** 面板从右侧滑入（宽度从0过渡到目标宽度）
- **AND** 面板内容立即以完整opacity显示，无渐入/渐出效果
- **AND** 无"闪回"现象

## MODIFIED Requirements

### Requirement: ChatPanel 容器背景
ChatPanel 根容器从 `bg-dark-900/20`（几乎透明）改为 `bg-dark-950/30 backdrop-blur-sm`（极淡毛玻璃），提升内容可读性同时保持透明感。

### Requirement: ChatPanel 输入区背景
ChatPanel 输入区域从内联样式 `background: '#334155'` 改为使用 Tailwind 类名 + 项目工具类，确保样式不被覆盖。
