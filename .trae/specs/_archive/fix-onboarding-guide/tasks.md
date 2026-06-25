# Tasks

- [x] Task 1: 修复 App.tsx 中 OnboardingGuide 渲染位置
  - [x] 将 OnboardingGuide 组件从第三个 return 分支移到最外层（所有分支共享）
  - [x] 确保引导在 WelcomePage 阶段也能显示

- [x] Task 2: 修复 OnboardingGuide 关闭逻辑
  - [x] 将 markOnboardingCompleted() 调用从 isForced 条件内移出
  - [x] 无论 isForced 是否为 true，关闭时都标记完成

# Task Dependencies
- Task 2 独立于 Task 1，可并行执行
