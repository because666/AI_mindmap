# Tasks

- [x] Task 1: 创建 background-demo 文件夹和独立 HTML 页面
  - [x] 在项目根目录创建 `background-demo/` 文件夹
  - [x] 创建 `background-demo/index.html`，包含基础 HTML 结构、Canvas 元素、内联 CSS 和 JS
  - [x] 页面使用深色背景色 #020617，全屏 Canvas

- [x] Task 2: 实现粒子系统核心逻辑
  - [x] 定义粒子接口（位置、速度、大小、透明度、颜色）
  - [x] 初始化 80 个粒子，随机分布在画布上
  - [x] 实现粒子漂移动画（requestAnimationFrame 循环）
  - [x] 实现粒子边界环绕（到达边界从对侧重新进入）

- [x] Task 3: 实现粒子间连线效果
  - [x] 遍历粒子对，距离小于 150px 时绘制连线
  - [x] 连线透明度 = 1 - distance / 150，随距离衰减
  - [x] 连线颜色使用 rgba(14, 165, 233, alpha) 蓝色系

- [x] Task 4: 实现鼠标交互反馈
  - [x] 监听 mousemove 事件，记录鼠标位置
  - [x] 鼠标附近 120px 内的粒子受到轻微排斥力
  - [x] 鼠标与附近粒子之间也绘制连线

- [x] Task 5: 实现 FPS 检测与自动降级
  - [x] 计算实时 FPS 并在右上角显示
  - [x] 连续 3 秒低于 30fps 时减少粒子数量 50%
  - [x] 降级后不自动恢复

- [x] Task 6: 添加 Demo 页面说明文字
  - [x] 页面中央显示标题和效果说明
  - [x] 底部显示简短的效果参数说明
  - [x] 文字样式与深色背景协调，不遮挡粒子效果

# Task Dependencies
- Task 2 依赖 Task 1（需要 HTML 页面基础）
- Task 3 依赖 Task 2（需要粒子系统运行）
- Task 4 依赖 Task 2（需要粒子系统运行）
- Task 5 依赖 Task 2（需要渲染循环运行）
- Task 3、Task 4、Task 5 可并行开发
- Task 6 独立，可随时添加
