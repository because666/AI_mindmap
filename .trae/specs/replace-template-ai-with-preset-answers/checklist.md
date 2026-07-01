# Checklist

> 对应 spec.md：模板预设答案替换AI调用

---

## 数据结构

- [x] `templateAnswers.ts` 文件已创建，包含 `PresetAnswer` 接口和 `TemplateAnswerMap` 类型
- [x] `BUILTIN_TEMPLATE_ANSWERS` 常量已定义，覆盖全部 5 个内置模板
- [x] `getPresetAnswer(templateId, nodeIndex, lang)` 函数已实现
- [x] `TemplateNode` 接口已新增 `presetAnswer?` 可选字段

## AI调用移除

- [x] `createPresetConversationsForTemplate` 中不再调用 `conversationApi.sendMessage`
- [x] 改为调用 `conversationApi.saveMessage` 写入 user + assistant 消息对
- [x] 根据 i18n 当前语言选择对应答案
- [x] 答案缺失时跳过节点并输出 `console.warn`
- [x] `onProgress` 和 `shouldContinue` 参数签名保留（兼容）

## 进度弹窗移除

- [x] `TemplateLibrary.tsx` 中移除 `isCreating` 状态
- [x] 移除 `progress` 状态
- [x] 移除 `cancelRef` 引用
- [x] 移除 `handleCancel` 函数
- [x] 移除进度覆盖层 JSX
- [x] 移除遮罩点击中 `isCreating` 判断
- [x] `handleSelectTemplate` 简化为创建后直接关闭弹窗

## 多语言支持

- [x] 中文答案已编写（5 个模板，共 24 个节点）
- [x] 英文答案已编写（5 个模板，共 24 个节点）
- [x] 答案内容质量审核通过（准确、简洁、有引导价值）

## 测试与构建

- [x] `getPresetAnswer` 单元测试通过（正常查询、语言切换、无答案返回 null）
- [x] `templates.test.ts` 更新通过（presetAnswer 为可选字段，现有测试不破坏）
- [x] TypeScript 编译通过（`tsc -b`）
- [x] 客户端构建通过（`npm run build`）
- [x] 现有测试全部通过（nodeStore.test.ts 32/32 通过）

## 部署

- [x] 客户端构建产物已上传至服务器（/www/wwwroot/AI_mindmap/client/dist/）
- [x] 服务器 index.html 已引用新版本（index-iTeuSNjm.js）
- [x] Nginx 已配置 index.html 禁用缓存（no-cache, no-store, must-revalidate）

## 预设问答 Store 同步

- [x] `createPresetConversationsForTemplate` 写入消息后同步更新前端 `conversations` Map
- [x] Store 中的对话包含 user 与 assistant 两条预设消息
- [x] 节点 `conversationId` 与 Store 中的对话 ID 一致
- [x] 新增/更新的单元测试通过

## 功能验证（需用户在浏览器实际测试）

- [ ] 点击模板后弹窗立即关闭，无卡顿
- [ ] 画布上出现模板节点和关系
- [ ] 进入节点对话面板能看到预设的问答对
- [ ] 节点摘要正确显示
- [ ] 切换到英文后预设问答为英文版本
