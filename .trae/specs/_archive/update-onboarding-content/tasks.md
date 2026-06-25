# Tasks

- [x] Task 1: 重构 `onboardingContent.ts` 为翻译键结构
  - [x] 移除页面标题、副标题、正文中的硬编码中文文本
  - [x] 为每个页面定义 `titleKey`、`contentKey`、`highlightsKey`
  - [x] 保留 `id`、`icon`、`countdownSeconds` 等非语言相关配置
  - [x] 补充完整的 JSDoc 类型注释

- [x] Task 2: 编写中文引导内容 `locales/onboarding/zh.json`
  - [x] 覆盖 8 个引导页面：项目介绍、思维画布、AI 对话、节点与关系、工具面板（搜索/历史/文件）、工作区与消息、设置与个性化、使用技巧
  - [x] 每个页面包含 `title`、`content` 字符串数组、`highlights` 字符串数组
  - [x] 内容准确对应现有用户功能，不包含后台管理功能
  - [x] 包含欢迎标题、副标题、完成提示等公共文案

- [x] Task 3: 编写英文引导内容 `locales/onboarding/en.json`
  - [x] 与 `zh.json` 结构完全一致
  - [x] 提供准确、自然的英文翻译
  - [x] 不包含后台管理功能描述

- [x] Task 4: 更新 `OnboardingGuide.tsx` 以支持翻译键渲染
  - [x] 使用 `useTranslation('onboarding')` 获取翻译函数
  - [x] 通过翻译键渲染标题、副标题、页面标题、正文和高亮标签
  - [x] 使用 `returnObjects: true` 正确读取数组类型内容并添加类型断言
  - [x] 保持现有响应式布局、倒计时、关闭逻辑不变

- [x] Task 5: 更新设置页引导内容列表
  - [x] 更新 `locales/settings/zh.json` 中 `guideContentIncludes` 列表项
  - [x] 更新 `locales/settings/en.json` 中对应英文列表项
  - [x] 更新 `SettingsModal.tsx` 中引导内容列表项引用，新增 `guideTools` 项并移除不再使用的旧项
  - [x] 列表项与新版引导页面对应，删除“主题配色”等过时项

- [x] Task 6: 语法校验与功能验证
  - [x] 运行 TypeScript 类型检查，确保无类型错误
  - [x] 运行 ESLint/Prettier 检查，确保代码符合项目规范
  - [x] 在浏览器中验证引导弹窗正常显示、翻页正常、中英文切换正常

# Task Dependencies

- Task 2 和 Task 3 依赖于 Task 1（需要先确定翻译键结构）
- Task 4 依赖于 Task 1、Task 2、Task 3
- Task 5 可独立于 Task 1-4 并行进行
- Task 6 依赖于 Task 1-5 全部完成
