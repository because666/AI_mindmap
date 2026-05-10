# 修复新手引导不显示 Spec

## Why
新用户反馈新手引导没有正常显示，导致用户不知道如何使用系统功能。经代码审查发现，新手引导组件 `OnboardingGuide` 仅在用户已进入工作区后才渲染，但新用户首次访问时处于 `WelcomePage`（未选择工作区），此时引导组件根本不会被渲染到DOM中。

## What Changes
- 修复 `App.tsx` 中新手引导的渲染位置：将 `OnboardingGuide` 从"已进入工作区"分支移到全局层级，确保无论用户处于哪个页面都能显示
- 修复 `OnboardingGuide` 关闭逻辑：非强制模式下关闭也应标记完成，避免用户从设置页打开引导后关闭又反复弹出
- 增加引导触发时机的可靠性：在 `WelcomePage` 阶段也能检测并展示引导

## Impact
- Affected code: `client/src/App.tsx`, `client/src/components/Onboarding/OnboardingGuide.tsx`

## ADDED Requirements

### Requirement: 新手引导应在所有页面阶段可显示
系统 SHALL 在用户首次访问时自动弹出新手引导，无论用户当前处于欢迎页还是工作区页面。

#### Scenario: 新用户首次访问未选择工作区
- **WHEN** 新用户首次访问网站，处于 WelcomePage 阶段
- **AND** localStorage 中没有 `deepmindmap_onboarding_completed` 标记
- **THEN** 新手引导弹窗应自动弹出

#### Scenario: 新用户首次访问已选择工作区
- **WHEN** 新用户首次访问网站，已进入工作区
- **AND** localStorage 中没有 `deepmindmap_onboarding_completed` 标记
- **THEN** 新手引导弹窗应自动弹出

## MODIFIED Requirements

### Requirement: 新手引导渲染位置
`OnboardingGuide` 组件 SHALL 渲染在 App 组件的最外层，而非仅在工作区页面内渲染。当前代码将引导组件放在 `return` 的第三个分支（已进入工作区）内，导致前两个分支（加载中、欢迎页）时引导无法显示。

### Requirement: 非强制模式关闭也应标记完成
`OnboardingGuide` 关闭时，无论 `isForced` 是否为 true，都 SHALL 调用 `markOnboardingCompleted()`。当前代码仅在 `isForced=true` 时标记完成，导致从设置页打开引导后关闭不会标记完成，可能造成重复弹出。
