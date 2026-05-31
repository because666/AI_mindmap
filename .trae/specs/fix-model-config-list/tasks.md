# Tasks

- [x] Task 1: 新增 ModelConfig 类型定义
  - [x] 修改 `client/src/types/index.ts`：新增 `ModelConfig` 接口

- [x] Task 2: 重构 apiConfigStore
  - [x] 修改 `client/src/stores/apiConfigStore.ts`：新增 `savedConfigs: ModelConfig[]` 和 `activeConfigId: string | null` 字段
  - [x] 新增 `addSavedConfig/removeSavedConfig/setActiveConfigId/getActiveConfig/getAPIConfigFromActive` 方法
  - [x] 保留 `temperature` 和 `setTemperature`（全局参数）
  - [x] 添加 version 2 数据迁移逻辑

- [x] Task 3: 修改 AddModelModal 保存逻辑
  - [x] 保存时生成完整 ModelConfig 写入 savedConfigs
  - [x] 保存后自动激活该配置
  - [x] 保存后关闭弹窗

- [x] Task 4: 重写 APIConfigPanel 展示模型配置列表
  - [x] 顶部：当前使用状态提示
  - [x] 中部：模型配置列表（内置服务 + 已保存配置）
  - [x] 点击卡片切换激活配置
  - [x] 删除按钮
  - [x] 添加新模型配置按钮
  - [x] 底部：创意度滑块

- [x] Task 5: 更新 chatService 读取配置逻辑
  - [x] 从 `getAPIConfigFromActive()` 获取配置
  - [x] activeConfigId 为 null 时不传 config
  - [x] ChatPanel.tsx 同步更新调用签名

- [x] Task 6: 构建验证
  - [x] 客户端 `npx tsc --noEmit` 无错误
  - [x] 服务端 `npx tsc --noEmit` 无错误

- [x] Task 7: 部署并验证
  - [x] 上传修改文件到服务器（6个文件）
  - [x] 构建前端（成功）
  - [x] 重启服务（PM2 online）
  - [x] 线上环境待用户验证

# Task Dependencies
- Task 1 是 Task 2 的前置依赖
- Task 2 是 Task 3/4/5 的前置依赖
- Task 3 与 Task 4 可并行
- Task 5 依赖 Task 2
- Task 6 依赖 Task 1-5
- Task 7 依赖 Task 6
