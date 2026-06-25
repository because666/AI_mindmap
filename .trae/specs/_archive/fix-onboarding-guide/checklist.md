# 修复新手引导不显示 - 验收清单

- [x] App.tsx 中 OnboardingGuide 组件已移到最外层，所有页面分支共享
- [x] 新用户首次访问 WelcomePage 阶段时，新手引导能自动弹出
- [x] 新用户首次访问已进入工作区时，新手引导能自动弹出
- [x] OnboardingGuide 关闭时，无论 isForced 是否为 true，都调用 markOnboardingCompleted()
- [x] 已完成引导的用户不会再次看到引导弹窗
- [x] 代码无语法错误，无 TypeScript 类型错误
