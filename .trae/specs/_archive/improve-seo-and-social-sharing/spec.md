# 主网站 SEO 与社交分享优化 Spec

## Why
当前主网站在搜索引擎结果中展示效果差：页面标题为默认的"client"，缺少受控的 Meta Description 和 Open Graph 标签，既不利于 SEO，也无法在社交分享时展示产品价值。同时产品已支持中英文切换，需要让搜索引擎和不同语言用户看到对应语言的标题与描述。

## What Changes
- 重写 `client/index.html` 中的 `<title>` 和 `<meta name="description">`，体现"AI + 思维导图 + 协作"核心定位
- 添加 Open Graph 标签（og:title、og:description、og:image、og:url、og:type）
- 添加 Twitter Card 标签（twitter:card、twitter:title、twitter:description、twitter:image）
- 添加 i18n 相关的 hreflang 声明和 alternate 链接（zh/en）
- 添加多语言 `<title>` 和 `<meta name="description">` 的初始默认值（中文优先，由运行时 JS 根据语言切换覆盖）
- 在 React 应用初始化后，根据当前 i18n 语言动态更新 document.title 和 meta description
- 准备一张 OG 封面图用于社交/搜索预览

## Impact
- Affected code:
  - `client/index.html` — SEO 元信息
  - `client/src/i18n.ts` — 动态更新 document.title 和 meta description
  - `client/src/locales/common/zh.json` 和 `en.json` — 新增 `pageTitle` 和 `pageDescription` 键
- Affected assets:
  - `client/public/og-cover.png` — 新增 OG/Twitter 预览图
- 不影响后端、admin 端和业务逻辑

## ADDED Requirements

### Requirement: 基础 SEO 元信息
系统 SHALL 在 `index.html` 中提供清晰、吸引用户的标题和描述，便于搜索引擎抓取和搜索结果展示。

#### Scenario: 搜索引擎抓取首页
- **WHEN** 搜索引擎爬虫访问首页
- **THEN** 页面 `<title>` 为"思流图 DeepMindMap | AI驱动的思维导图协作平台"（默认中文）
- **AND** `<meta name="description">` 包含产品核心卖点与使用场景，长度不超过 120 个字符

### Requirement: Open Graph 与 Twitter Card
系统 SHALL 提供 Open Graph 和 Twitter Card 标签，使链接在社交媒体分享时显示标题、描述和封面图。

#### Scenario: 分享首页到社交平台
- **WHEN** 用户将首页链接分享到微信/微博/Twitter/Facebook
- **THEN** 分享卡片显示站点标题、描述和 `og-cover.png` 封面图
- **AND** 卡片链接指向 `https://deepmindmap.work/`

### Requirement: 多语言 SEO
系统 SHALL 声明页面的多语言版本，并在运行时根据用户选择的语言动态更新标题和描述。

#### Scenario: 中文用户访问
- **WHEN** 用户界面语言为中文
- **THEN** 浏览器标签页标题为"思流图 DeepMindMap | AI驱动的思维导图协作平台"
- **AND** meta description 为中文描述

#### Scenario: 英文用户访问
- **WHEN** 用户界面语言为英文
- **THEN** 浏览器标签页标题为"DeepMindMap | AI-Powered Mind Mapping & Collaborative Thinking"
- **AND** meta description 为英文描述

#### Scenario: 搜索引擎识别多语言版本
- **WHEN** 搜索引擎爬虫访问首页
- **THEN** 页面包含 `<link rel="alternate" hreflang="zh" href="https://deepmindmap.work/">`
- **AND** 包含 `<link rel="alternate" hreflang="en" href="https://deepmindmap.work/">`
- **AND** 包含 `<link rel="alternate" hreflang="x-default" href="https://deepmindmap.work/">`

## MODIFIED Requirements

### Requirement: 浏览器标签页标题
原状态：`index.html` 中 `<title>client</title>`
新需求：改为中文默认标题，并由运行时 JS 根据 i18n 语言切换
