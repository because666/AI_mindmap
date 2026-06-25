# 主网站英文适配 Spec

## Why
主网站所有 UI 文本均为硬编码中文，无法切换为英文，限制了产品的国际化使用。需要引入 i18n 框架，提取所有用户可见的中文文本为翻译资源文件，并支持中英文切换。

## What Changes
- 引入 `react-i18next` + `i18next` 国际化框架
- 创建 `zh.json` 和 `en.json` 翻译资源文件，按模块分 namespace
- 创建 `i18n.ts` 初始化配置文件
- 逐组件提取硬编码中文为 `t()` 调用
- 添加语言切换 UI 入口（设置面板 + 顶栏快捷切换）
- 语言偏好持久化到 localStorage

## Impact
- Affected code: client/src 下所有包含中文 UI 文本的组件（约 30+ 文件）
- 新增依赖: i18next, react-i18next
- 不影响后端代码和 admin 端

## ADDED Requirements

### Requirement: i18n 框架集成
系统 SHALL 集成 react-i18next 国际化框架，支持中文（zh）和英文（en）两种语言，默认语言为中文。

#### Scenario: 首次访问
- **WHEN** 用户首次访问主网站
- **THEN** 系统根据浏览器语言偏好自动选择语言（中文浏览器显示中文，英文浏览器显示英文）
- **AND** 若浏览器语言无法识别，默认显示中文

#### Scenario: 手动切换语言
- **WHEN** 用户在设置中切换语言
- **THEN** 所有 UI 文本立即切换为对应语言
- **AND** 语言偏好保存到 localStorage，下次访问自动应用

### Requirement: 翻译资源文件管理
翻译资源 SHALL 按 namespace 组织，存放在 `client/src/locales/` 目录下，每个 namespace 包含 `zh.json` 和 `en.json`。

#### Namespace 划分
- `common` — 通用文本（按钮、确认、取消等）
- `nav` — 导航菜单
- `canvas` — 画布相关
- `chat` — AI 对话
- `workspace` — 工作区
- `settings` — 设置面板
- `search` — 搜索
- `feedback` — 反馈
- `message` — 消息中心
- `history` — 操作历史
- `file` — 文件管理
- `onboarding` — 新手引导
- `announcement` — 公告

### Requirement: 语言切换 UI
系统 SHALL 在设置面板中提供语言切换选项，并在顶栏提供快捷切换按钮。

#### Scenario: 设置面板切换
- **WHEN** 用户打开设置面板
- **THEN** 可看到"语言/Language"选项，下拉选择中文或英文

### Requirement: 仅提取用户可见文本
代码注释（JSDoc、行内注释）和测试用例描述中的中文不需要国际化，保持原样。仅提取用户在界面上可见的文本，包括：
- 按钮标签
- 提示/错误消息
- 表单标签和占位符
- 页面/面板标题
- 导航菜单项
- 空状态提示
- 确认弹窗文案
- 新手引导内容

## MODIFIED Requirements

### Requirement: 硬编码中文文本
所有用户可见的硬编码中文文本 SHALL 替换为 i18next 的 `t()` 函数调用，从翻译资源文件读取对应语言的文本。
