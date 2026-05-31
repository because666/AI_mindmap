# Tasks

- [x] Task 1: 扩展类型定义和数据结构
  - [x] 修改 `client/src/types/index.ts`：扩展 `AIProvider` 增加 `'deepseek'`，扩展 `AIModel` 增加 `isMultimodal`/`isPreset`，扩展 `APIConfig` 增加 `apiFormat`/`temperature`/`isCustom`
  - [x] 修改 `client/src/utils/aiModels.ts`：定义丰富的预设模型列表（智谱/OpenAI/Anthropic/DeepSeek），更新 `AI_PROVIDERS` 增加DeepSeek
  - [x] 修改 `server/src/services/aiService.ts`：增加deepseek的默认模型和基础URL
  - [x] 修改 `server/src/routes/ai.ts`：更新 `/models` 接口返回按服务商分组的预设模型列表

- [x] Task 2: 扩展API配置Store
  - [x] 修改 `client/src/stores/apiConfigStore.ts`：支持temperature持久化、支持预设模型选择、支持自定义配置模式标记
  - [x] 添加数据迁移逻辑：将旧版自定义模型数据迁移到新结构

- [x] Task 3: 创建添加模型弹窗组件
  - [x] 创建 `client/src/components/Settings/AddModelModal.tsx`
  - [x] 实现"模型服务商"标签页：服务商选择 + 预设模型选择 + API密钥
  - [x] 实现"自定义配置"标签页：API格式选择 + 中转URL + 模型ID + API密钥
  - [x] 实现多模态标识展示
  - [x] 实现表单验证和提交逻辑

- [x] Task 4: 重写API配置面板
  - [x] 重写 `client/src/components/Settings/APIConfigPanel.tsx`
  - [x] 实现内置服务状态提示
  - [x] 实现当前配置摘要展示
  - [x] 实现创意度滑块（0-2范围，默认0.7）
  - [x] 实现"管理模型"入口按钮，点击打开添加模型弹窗
  - [x] 移除旧版的复杂表单和模型卡片列表

- [x] Task 5: 更新聊天服务传递temperature
  - [x] 修改 `client/src/services/chatService.ts`：sendMessage和sendMessageStream传递temperature参数
  - [x] 修改 `client/src/components/Chat/ChatPanel.tsx`：从store读取temperature并传入chatService

- [x] Task 6: 构建验证
  - [x] 客户端 `npx tsc --noEmit` 无错误
  - [x] 服务端 `npx tsc --noEmit` 无错误

- [x] Task 7: 部署并验证
  - [x] 上传修改文件到服务器（8个文件）
  - [x] 构建客户端和服务端（均成功，退出码0）
  - [x] 重启服务（PM2 deepmindmap-server online）
  - [x] 线上环境验证待用户确认

# Task Dependencies
- Task 1 是 Task 2/3/4 的前置依赖
- Task 2 是 Task 4/5 的前置依赖
- Task 3 与 Task 4 可并行（都依赖Task 1/2）
- Task 5 依赖 Task 2
- Task 6 依赖 Task 1-5
- Task 7 依赖 Task 6
