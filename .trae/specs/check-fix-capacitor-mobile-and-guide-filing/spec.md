# Capacitor 移动端问题排查修复与备案信息填写指导 Spec

## Why

项目已通过 Capacitor 将 Web 应用打包为 Android App，在提交应用商店及完成 APP 备案前，需要系统性检查移动端运行质量，修复可能影响审核或用户体验的问题，并据此准备备案所需信息。

## What Changes

- 全面检查 Capacitor Android 工程配置、权限、插件、版本兼容性
- 检查移动端专属交互：返回键、长按、软键盘、状态栏、网络状态、推送通知
- 检查移动端 UI 适配：视口、缩放、侧边栏、底部备案信息、画布操作
- 检查构建产物与签名配置是否满足发布要求
- 修复排查过程中发现的移动端缺陷
- 输出 APP 备案信息填写指导，明确每个字段应填内容

## Impact

- Affected specs: optimize-mobile-footer-icp、add-feedback-push-notification、add-i18n-english-adaptation
- Affected code:
  - `client/android/` — Capacitor 原生工程
  - `client/capacitor.config.ts` — Capacitor 配置
  - `client/src/hooks/` — 移动端相关 Hooks
  - `client/src/components/` — 移动端适配的 UI 组件
  - `client/src/services/pushService.ts` — 推送服务
  - `client/package.json` — Capacitor 依赖版本

## ADDED Requirements

### Requirement: 移动端问题排查清单

系统 SHALL 提供一份可执行的移动端问题排查清单，覆盖 Capacitor 配置、Android 原生工程、移动端交互、UI 适配、推送通知、构建发布六个维度。

#### Scenario: 执行排查

- **WHEN** 开发/运维人员按清单逐项检查
- **THEN** 能够发现当前移动端存在的配置缺陷或体验问题
- **AND** 每项检查结果可被记录为“通过 / 不通过 / 待验证”

### Requirement: 移动端问题修复

对于排查中发现的影响审核或体验的缺陷，系统 SHALL 进行修复，并确保修复后构建通过、功能正常。

#### Scenario: 修复后验证

- **WHEN** 修复了某个移动端问题
- **THEN** 重新构建 Android App 或运行相关测试
- **AND** 对应检查项状态更新为“通过”

### Requirement: 备案信息填写指导

在移动端问题全部修复并通过验证后，系统 SHALL 提供针对当前 APP 备案表单的逐项填写指导，包括应用名称、运行平台、应用包名、应用类型、前置许可、功能描述、运行截图等字段的准确内容。

#### Scenario: 用户填写备案表单

- **WHEN** 用户打开备案系统的“新增 APP”页面
- **THEN** 能够根据指导文档逐项准确填写
- **AND** 上传的 Logo、截图、算法备案说明等材料符合要求

## MODIFIED Requirements

无

## REMOVED Requirements

无
