# 修复中转站URL处理 Spec

## Why
用户从中转站文档复制的URL通常包含 `/chat/completions` 后缀，但OpenAI SDK会自动追加该路径，导致实际请求URL变成 `/chat/completions/chat/completions`，返回404错误。需要自动处理URL格式并提供清晰的示例提示。

## What Changes
- AddModelModal 自定义配置模式的请求地址输入框：保存时自动去除末尾的 `/chat/completions`
- 优化 placeholder 为带示例的提示文案
- 输入框下方增加格式说明文字

## Impact
- Affected code:
  - `client/src/components/Settings/AddModelModal.tsx` — URL处理和提示文案

## ADDED Requirements

### Requirement: 自动去除URL末尾路径
系统 SHALL 在保存模型配置时自动去除 baseUrl 末尾的 `/chat/completions`。

#### Scenario: URL包含/chat/completions后缀
- **WHEN** 用户填写的请求地址为 `https://juliang.pro/proxy/v1/chat/completions`
- **THEN** 保存时自动截断为 `https://juliang.pro/proxy/v1`

#### Scenario: URL不包含后缀
- **WHEN** 用户填写的请求地址为 `https://juliang.pro/proxy/v1`
- **THEN** 保存时保持不变

### Requirement: 提供示例URL和格式说明
请求地址输入框 SHALL 显示示例URL和格式说明。

#### Scenario: 输入框提示
- **WHEN** 用户查看自定义配置的请求地址输入框
- **THEN** placeholder 显示示例URL：`如 https://api.openai.com/v1`
- **AND** 输入框下方显示提示文字："请填写API基础地址，无需包含 /chat/completions"
