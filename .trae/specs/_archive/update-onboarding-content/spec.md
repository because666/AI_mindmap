# 更新用户新手引导内容 Spec

## Why

DeepMindMap V2 近期新增搜索面板、操作历史、文件导入导出、消息中心、用户反馈、复合节点、多选模式、自动布局、聊天文件上传、结论提炼、标题生成等功能，但新手引导仍停留在旧版本，内容与实际产品能力不符。引导中还存在“主题配色”等未实现功能的描述，容易误导新用户。需要全面更新面向用户的新手引导模块，准确反映当前能力，同时排除后台管理功能。

## What Changes

- 重构 `onboardingContent.ts`：将页面标题、副标题、正文内容迁移到 i18n 翻译键，保留页面结构（id、icon、highlights）和倒计时配置
- 补全 `client/src/locales/onboarding/zh.json` 与 `en.json`：覆盖全部引导页面中文/英文内容
- 更新 `OnboardingGuide.tsx`：使用 `useTranslation('onboarding')` 解析翻译键渲染内容，支持数组类型内容
- 更新 `settings` 命名空间下的 `zh.json` 与 `en.json`：调整设置页“引导内容包含”列表，与新版页面一致
- 删除或修正过时描述：移除“主题配色”、过度强调实时协作等不准确内容；不展示公告发送、成员管理等后台能力

## Impact

- Affected specs: 无依赖的其他 spec
- Affected code:
  - `client/src/data/onboardingContent.ts`
  - `client/src/components/Onboarding/OnboardingGuide.tsx`
  - `client/src/locales/onboarding/zh.json`
  - `client/src/locales/onboarding/en.json`
  - `client/src/locales/settings/zh.json`
  - `client/src/locales/settings/en.json`

## ADDED Requirements

### Requirement: 引导内容必须覆盖当前核心用户功能

系统 SHALL 在新手引导中向用户说明当前产品提供的全部核心用户功能，包括但不限于：思维画布操作、AI 对话、节点与关系、搜索、操作历史、文件导入导出、工作区、消息中心、反馈、设置与个性化。

#### Scenario: 新用户首次查看引导

- **WHEN** 新用户首次进入应用且 localStorage 中无完成标记
- **THEN** 弹出的新手引导应展示更新后的内容，包含最新功能说明

#### Scenario: 从设置页重新打开引导

- **WHEN** 用户在设置页点击“打开新手引导”
- **THEN** 弹出的引导内容应与首次弹出时一致，且均为当前功能描述

### Requirement: 引导内容必须支持中英双语

系统 SHALL 将新手引导的所有展示文本（标题、副标题、页面标题、正文、高亮标签、完成提示）纳入 `onboarding` i18n 命名空间，中文与英文完整对应。

#### Scenario: 用户切换界面语言

- **WHEN** 用户将界面语言从中文切换为英文（或反之）
- **AND** 打开新手引导
- **THEN** 引导内容应随语言切换完整显示为对应语言

### Requirement: 引导不得展示后台管理功能

系统 SHALL 仅在新手引导中展示普通用户可用的功能，不得出现公告发送、成员管理、账号/IP 封禁、工作区删除等后台或管理员专属功能说明。

## MODIFIED Requirements

### Requirement: 新手引导内容结构

`onboardingContent.ts` SHALL 不再直接硬编码中文正文，而是定义页面结构与翻译键；实际文本通过 `useTranslation('onboarding')` 从 `zh.json`/`en.json` 获取。

#### Scenario: 渲染引导页面

- **WHEN** `OnboardingGuide` 渲染当前页面
- **THEN** 页面标题通过 `t(page.titleKey)` 获取
- **AND** 页面正文通过 `t(page.contentKey, { returnObjects: true })` 获取字符串数组
- **AND** 高亮标签通过 `t(page.highlightsKey, { returnObjects: true })` 获取字符串数组

### Requirement: 设置页引导内容列表

设置页中“引导内容包含”列表 SHALL 与新版引导页面保持一致，新增搜索/历史/文件、消息/反馈等说明项，删除过时项。

## REMOVED Requirements

### Requirement: 旧版引导中的“主题配色”说明

**Reason**: 当前 UI 设置面板未提供主题配色切换，保留该描述会造成误导。
**Migration**: 在设置页引导说明中移除“主题配色”，改为“语言设置、性能模式、面板布局、对话面板宽度”等实际存在的配置项。

### Requirement: 旧版引导中过度强调实时协作

**Reason**: 当前工作区以独立项目为主，未实现真正的实时多人同步编辑。
**Migration**: 工作区页面描述聚焦于项目隔离、邀请码加入、数据同步，避免“实时同步更新”等夸大表述。
