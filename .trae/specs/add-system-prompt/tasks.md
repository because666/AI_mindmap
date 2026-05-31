# Tasks

- [x] Task 1: 重写 DEFAULT_SYSTEM_PROMPT 常量
  - [x] 修改 `server/src/config/prompts.ts`：将 DEFAULT_SYSTEM_PROMPT 替换为 spec 中设计的专业版提示词
  - [x] 确保提示词包含7个模块：身份与角色、平台场景认知、核心原则、响应策略、输出格式、分支建议协议、边界与语气

- [x] Task 2: 修复 conversations.ts 构建错误
  - [x] 在 `server/src/routes/conversations.ts` 顶部添加 `import { config } from '../config/index.js';`
  - [x] 验证 config.ai.systemPrompt 引用不再报 TS2304 错误

- [x] Task 3: 服务端构建验证
  - [x] 在 server 目录执行 `npx tsc --noEmit` 确认无 TypeScript 编译错误

- [x] Task 4: 部署并验证
  - [x] 上传修改文件到服务器（prompts.ts、config/index.ts、conversations.ts、ai.ts）
  - [x] 构建服务端（npm run build 成功，退出码0）
  - [x] 重启服务（PM2 deepmindmap-server online）
  - [x] 确认服务器 .env 中有 SYSTEM_PROMPT 配置

# Task Dependencies
- Task 2 与 Task 1 可并行
- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 3
