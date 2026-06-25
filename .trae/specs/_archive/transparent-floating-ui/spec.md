# 透明悬浮 UI 优化 Spec

## Why
移除 z-10 包裹层后粒子背景可见，但顶部工具栏有 glass 背景条遮挡、ChatPanel 输入区控件不可见、关闭按钮不明显、备案号位置偏右。需要统一透明悬浮风格，让所有 UI 元素像侧边栏一样悬浮在粒子背景之上。

## What Changes
- CanvasPage 顶部工具栏移除整体 glass 背景，改为纯悬浮图标组
- App.tsx 移除 statusBarGradient 不透明顶部渐变遮挡层
- ChatPanel 输入区确保控件（附件按钮、输入框、发送按钮）可见且美观
- ChatPanel 关闭按钮增强视觉权重（固定背景色 + 增大点击区域）
- MainLayout 中 ChatPanel 容器头部关闭按钮同步增强
- 备案号从右下角改为底部居中
- MainLayout 移动端 header 改为透明悬浮

## Impact
- Affected specs: fix-particle-visibility
- Affected code: CanvasPage.tsx、App.tsx、ChatPanel.tsx、MainLayout.tsx

## ADDED Requirements

### Requirement: 顶部工具栏悬浮化
系统 SHALL 将 CanvasPage 顶部工具栏从 glass 背景条改为纯悬浮图标组，移除整体容器背景，每个按钮保持独立的 btn-icon 半透明背景。

#### Scenario: 用户查看画布顶部
- **WHEN** 用户进入画布页面
- **THEN** 顶部工具栏无整体背景色，图标独立悬浮在画布上
- **AND** 粒子背景在图标间隙中可见
- **AND** 按钮交互（hover、active）保持正常

### Requirement: 移除顶部渐变遮挡层
系统 SHALL 移除 App.tsx 中的 statusBarGradient 组件，该组件使用不透明渐变遮挡了顶部粒子背景。

#### Scenario: 粒子背景在顶部可见
- **WHEN** 用户查看页面顶部区域
- **THEN** 粒子背景在顶部完全可见，无渐变遮挡

### Requirement: ChatPanel 输入区控件可见性
系统 SHALL 确保 ChatPanel 底部输入区域的附件按钮、输入框、文件按钮、发送按钮清晰可见，不受透明背景影响。

#### Scenario: 用户使用 ChatPanel 输入区
- **WHEN** 用户打开 ChatPanel 查看输入区域
- **THEN** 附件按钮、输入框、文件按钮、发送按钮均清晰可见
- **AND** 输入框有明确的边框和背景色
- **AND** 按钮图标清晰可辨

### Requirement: ChatPanel 关闭按钮增强
系统 SHALL 为 ChatPanel 的关闭按钮增加固定背景色和更大的点击区域，使其在透明悬浮布局中更明显。

#### Scenario: 用户需要关闭 ChatPanel
- **WHEN** 用户查看 ChatPanel 右上角
- **THEN** 关闭按钮有固定背景色（非仅 hover 显示），视觉上明显可辨
- **AND** 点击区域足够大（至少 32x32px）

### Requirement: 备案号底部居中
系统 SHALL 将备案号从右下角改为底部水平居中显示。

#### Scenario: 用户查看页面底部
- **WHEN** 用户查看页面底部
- **THEN** 备案号在底部水平居中显示
- **AND** 不遮挡画布核心内容

## MODIFIED Requirements

### Requirement: 移动端 Header 透明悬浮
MainLayout 移动端顶部 header 从 `bg-dark-900` 不透明背景改为透明悬浮样式，与桌面端侧边栏风格一致。
