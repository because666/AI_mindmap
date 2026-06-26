# 全面审计与部署 Spec

## Why

项目经过多轮功能迭代后需要全面核验，确保功能完整、代码质量达标、无安全漏洞，然后部署到服务器。
后续多次迭代可能引入隐性回归，需在原有审计基础上追加集成测试、兼容性验证、依赖安全扫描与线上服务状态核验，
形成"迭代后回归 → 部署 → 线上验证"的闭环质量保障流程。

## What Changes

### 第一轮（已完成）
- 四个子项目 TypeScript 编译检查和构建验证
- 全量单元测试运行
- 安全审计：硬编码密钥、敏感信息泄露
- 代码质量检查：ESLint
- 修复发现的问题
- 部署到服务器并验证

### 第二轮（本次追加）
- **回归测试**：重新运行全量单元测试，确保多次迭代未引入新缺陷
- **集成测试**：对核心 API 端到端流程进行接口级验证（健康检查、对话、节点、模板）
- **兼容性验证**：核查客户端 viewport 适配、移动端工具栏与桌面端入口一致性
- **依赖安全扫描**：使用 `npm audit` 检查 server/client 依赖漏洞
- **类型安全复核**：对所有子项目执行 `tsc --noEmit`
- **重新部署 + 线上验证**：按 deploy_server.py 流程同步部署，并验证 PM2 状态、健康检查、关键接口可用性

## Impact
- Affected specs: 无新增 spec，仅扩展本 spec 的核验维度
- Affected code: 不修改业务代码，仅更新 spec 文档与 deploy_server.py（如需）
- Affected systems: 服务器 deepmindmap-server / deepmindmap-admin PM2 进程

## ADDED Requirements

### Requirement: 全面构建验证
系统 SHALL 对所有子项目进行编译和构建验证。
- **WHEN** 执行 tsc --noEmit 和 build
- **THEN** 四个项目全部通过

### Requirement: 单元测试验证
系统 SHALL 运行全量单元测试。
- **WHEN** 执行测试
- **THEN** 所有测试通过

### Requirement: 安全审计
系统 SHALL 检查硬编码密钥和敏感信息。
- **WHEN** 扫描代码
- **THEN** 无硬编码敏感信息

### Requirement: 部署到服务器
系统 SHALL 在检查通过后部署。
- **WHEN** 执行部署
- **THEN** 健康检查返回 200

### Requirement: 回归测试（追加）
系统 SHALL 在每次迭代后重新运行全量单元测试。
- **WHEN** 执行 client 与 server 的 vitest
- **THEN** 所有现有测试用例全部通过，无新增失败

### Requirement: 集成测试（追加）
系统 SHALL 对核心 API 端到端流程进行接口级验证。
- **WHEN** 调用健康检查、对话创建、节点创建、模板加载等关键接口
- **THEN** 接口返回符合预期，无 5xx 错误，关键功能可正常使用

### Requirement: 兼容性验证（追加）
系统 SHALL 验证客户端在不同视口下的可用性。
- **WHEN** 桌面端与移动端 viewport 切换
- **THEN** 模板库入口、ChatPanel、CanvasPage 等核心 UI 在两种视口下均可见且可用

### Requirement: 依赖安全扫描（追加）
系统 SHALL 对 server 和 client 执行 npm audit。
- **WHEN** 执行 npm audit
- **THEN** 输出漏洞报告；若存在高危漏洞需评估处置方案

### Requirement: 线上服务状态核验（追加）
系统 SHALL 在部署完成后验证线上服务运行状态。
- **WHEN** 部署完成
- **THEN** PM2 进程状态为 online、健康检查返回 200、近 100 行日志无未捕获异常

## MODIFIED Requirements
无

## REMOVED Requirements
无
