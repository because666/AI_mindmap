# 移动端 APP ICP 备案号悬挂 Spec

## Why

项目已通过 Capacitor 打包为 Android App，APP 备案资质文件中的备案号为“桂ICP备2026005821号-3A”，与现有网站备案号“桂ICP备2026005821号”属于不同资质文件。当前移动端界面未单独展示 APP 备案号，存在合规风险，需在移动端设置页面底部独立、清晰地悬挂 APP 备案号，并满足可读性、对比度、无障碍等规范要求。

## What Changes

- 在移动端设置页面（`SettingsModal`）底部新增 APP ICP 备案号展示区域
- 展示备案号固定为“桂ICP备2026005821号-3A”，不得与网站备案号混淆或相互替代
- 备案号文字大小不小于 12sp（CSS 中对应 `text-xs` 以上，即至少 `0.75rem/12px`）
- 颜色对比度符合 WCAG AA 级标准（不低于 4.5:1）
- 支持竖屏与横屏自适应，适配 4.7 英寸至 6.7 英寸主流机型
- 添加屏幕阅读器可识别的语义化标记（`role`、`aria-label`）
- 桌面端设置页面不显示 APP 备案号（仅移动端展示）
- 现有网站备案号（桌面端底部、移动端侧边栏底部）保持不变

## Impact

- Affected specs: optimize-mobile-footer-icp
- Affected code:
  - `client/src/components/Settings/SettingsModal.tsx` — 新增移动端底部备案号区域
  - `client/src/locales/settings/zh.json` — 新增备案号相关中文文案
  - `client/src/locales/settings/en.json` — 新增备案号相关英文文案
  - `client/src/components/Settings/SettingsModal.test.tsx`（如不存在则新建）— 覆盖移动端渲染、文案、可访问性

## ADDED Requirements

### Requirement: 移动端设置页面底部展示 APP ICP 备案号

系统 SHALL 在移动端设置页面底部固定展示 APP ICP 备案号“桂ICP备2026005821号-3A”，且不得与网站备案号混用或替代。

#### Scenario: 用户在移动端打开设置页面

- **WHEN** 用户在移动端（屏幕宽度小于 768px）打开设置页面
- **THEN** 设置页面底部居中显示“桂ICP备2026005821号-3A”
- **AND** 备案号文字大小不小于 12sp
- **AND** 备案号颜色与背景对比度不低于 4.5:1
- **AND** 备案号不被任何浮动按钮、Tab 栏或核心功能区域遮挡
- **AND** 屏幕阅读器可正确朗读备案号内容

#### Scenario: 用户在桌面端打开设置页面

- **WHEN** 用户在桌面端（屏幕宽度大于等于 768px）打开设置页面
- **THEN** 设置页面底部不显示 APP ICP 备案号

#### Scenario: 用户旋转屏幕或切换横竖屏

- **WHEN** 用户在移动端从竖屏旋转为横屏，或从横屏旋转为竖屏
- **THEN** 备案号区域始终位于设置页面底部
- **AND** 备案号文字完整可见，不截断、不重叠

## MODIFIED Requirements

无

## REMOVED Requirements

无
