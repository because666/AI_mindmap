# Tasks

- [x] Task 1: 恢复基础版粒子背景
  - [x] 读取 `background-demo/index-basic-backup.html` 内容
  - [x] 将 `background-demo/index.html` 替换为基础版内容

- [x] Task 2: 添加流光渐变背景层
  - [x] 在 CONFIG 中添加流光配置（3 个光斑的位置、颜色、透明度、移动速度）
  - [x] 定义流光对象结构（x, y, radius, color, alpha, vx, vy）
  - [x] 初始化 3 个流光光斑，使用项目品牌色
  - [x] 实现 drawFlowingGradients 函数，在粒子层下方绘制径向渐变
  - [x] 实现 updateFlows 函数，让光斑缓慢漂移并在边界反弹
  - [x] 在 animate 循环中调用流光绘制（在粒子之前、清屏之后）

- [x] Task 3: 验证效果
  - [x] 确认 index.html 无外部依赖
  - [x] 确认流光透明度极低（0.03-0.06），不干扰粒子
  - [x] 确认流光颜色使用项目品牌色系
  - [x] 确认流光移动速度极慢
  - [x] 更新 checklist.md

# Task Dependencies
- Task 1 必须先执行
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
