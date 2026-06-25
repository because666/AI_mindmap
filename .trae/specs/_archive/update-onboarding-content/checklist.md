# 更新用户新手引导内容 - 验收清单

- [x] `onboardingContent.ts` 已移除硬编码中文文本，改为翻译键结构
- [x] `onboardingContent.ts` 中每个页面包含 `titleKey`、`contentKey`、`highlightsKey`
- [x] `locales/onboarding/zh.json` 包含完整中文引导内容，覆盖 8 个页面
- [x] `locales/onboarding/en.json` 包含完整英文引导内容，结构与中文一致
- [x] 引导内容包含思维画布、AI 对话、节点关系、搜索、历史、文件、工作区、消息、反馈、设置等用户功能
- [x] 引导内容未包含公告发送、成员管理、账号/IP 封禁、工作区删除等后台管理功能
- [x] `OnboardingGuide.tsx` 使用 `useTranslation('onboarding')` 渲染标题、正文、高亮标签
- [x] 数组类型翻译内容通过 `returnObjects: true` 正确读取，无类型错误
- [x] `locales/settings/zh.json` 与 `en.json` 的 `guideContentIncludes` 列表与新版引导页面对应
- [x] `SettingsModal.tsx` 中引导内容列表项引用已更新，包含新增 `guideTools` 项
- [x] 设置页引导列表顺序与引导弹窗 8 页顺序一致
- [x] 设置页引导列表中已删除“主题配色”等过时项
- [x] TypeScript 类型检查通过，无 `any` 类型滥用
- [x] ESLint/Prettier 检查通过（修改文件无新增错误）
- [x] 浏览器验证：首次访问自动弹出引导、翻页正常、中英文切换后内容正确显示
