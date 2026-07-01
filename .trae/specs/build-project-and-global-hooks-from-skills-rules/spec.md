# 将项目 Skill 与 Rule 制作为全局与项目 Hooks Spec

## Why

项目目前已沉淀了多套 AI 执行规范：`.trae/skills/` 下的 `deploy-assistant`、`server-deploy-checklist`，`README.md` 中的部署与开发说明，以及项目记忆中的工程约定与经验教训。这些规则分散在不同文件，AI 在实际执行任务时容易遗漏。通过在 Trae 的 hooks 机制中固化关键提醒，可以在 `pre-task`、`post-save`、`pre-completion`、`pre-commit` 等时机将规则前置到执行路径中，提升执行一致性与质量。

## What Changes

- **更新全局 hooks**：在现有 `c:\Users\ASUS\.trae-cn\hooks.json` 基础上，保留现有通用规则提醒，追加与项目 skill 触发条件相关的提醒（`deploy-assistant`、`server-deploy-checklist`）。
- **新建项目 hooks**：在 `d:\study1\DeepMindMap\v2\.trae\hooks.json` 中新增项目级 hooks，聚焦 DeepMindMap 项目特定的产品方向、工程约定与经验教训。
- **不引入阻塞操作**：所有 hooks 仅输出提醒文本，`blocking` 保持 `false`，避免影响现有工作流。
- **不新增依赖**：仅修改/新增 JSON 配置文件，无需安装任何第三方依赖。

## Impact

- 全局 AI 行为：所有项目通用的规则提醒得到保留，并新增项目 skill 触发提示。
- 项目 AI 行为：在 DeepMindMap 工作区内，AI 会在关键时机收到项目特定规则的提醒。
- 受影响文件：
  - `c:\Users\ASUS\.trae-cn\hooks.json`（修改）
  - `d:\study1\DeepMindMap\v2\.trae\hooks.json`（新增）

## ADDED Requirements

### Requirement: 全局 Hooks 补充项目 Skill 触发提醒

全局 hooks 应在保留现有通用规则提醒的前提下，提醒 AI 在合适场景下调用项目 skill。

#### Scenario: 全局 pre-task 触发

- **WHEN** 全局 `pre-task` hook 触发
- **THEN** 提醒 AI：若任务涉及服务端、Admin 后台或部署，先参考 `deploy-assistant` 检查环境状态；若任务要将服务端 TypeScript 代码部署到远程服务器，必须参考 `server-deploy-checklist`。

#### Scenario: 全局 pre-completion / pre-commit 触发

- **WHEN** 全局 `pre-completion` 或 `pre-commit` hook 触发
- **THEN** 提醒 AI：在交付/提交前，若涉及服务端代码部署，必须确认已执行远程编译 `npx tsc`、已验证 `dist/` 产物包含新代码、已重启 PM2 服务。

### Requirement: 项目 Hooks 覆盖项目特定规则

项目 hooks 应聚焦 DeepMindMap 项目内的产品方向、工程约定与经验教训。

#### Scenario: 项目 pre-task 触发

- **WHEN** 项目 `pre-task` hook 触发
- **THEN** 提醒 AI：
  - 当前产品核心方向是“非线性对话体验”，分支应成为聊天的自然下一步；
  - 移动端与桌面端 UI 布局需差异化处理，移动端优先优化空间利用率；
  - 安全区域适配使用 `env(safe-area-inset-top)`；
  - 节点连接点尺寸在移动端需单独调整，避免过大影响体验；
  - 创建子节点时必须显式传入父节点 ID，避免未指定父节点 ID 时错误创建为根节点。

#### Scenario: 项目 post-save 触发

- **WHEN** 项目 `post-save` hook 触发
- **THEN** 提醒 AI 检查刚保存的文件是否违背项目特定约定：移动端布局差异、安全区域、节点连接点尺寸、子节点父节点 ID 传递等。

#### Scenario: 项目 pre-completion / pre-commit 触发

- **WHEN** 项目 `pre-completion` 或 `pre-commit` hook 触发
- **THEN** 提醒 AI：
  - 若修改了前后端代码，需确认 `npm run build:client` / `npm run build:server` 通过；
  - 若修改了移动端相关代码，需确认 Capacitor Android 构建无异常；
  - 若涉及部署，需结合 `server-deploy-checklist` 完成编译、验证、重启流程。

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
