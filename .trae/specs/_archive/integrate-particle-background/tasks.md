# Tasks

- [x] Task 1: 将 background-demo/index.html 的粒子网络逻辑移植为 React 组件
  - [x] 读取 background-demo/index.html 中的完整 JS 逻辑
  - [x] 将 DreamyUniverseBackground.tsx 的内容替换为 React 版本的 Canvas 2D 粒子网络组件
  - [x] 使用 useRef 获取 Canvas 元素，useEffect 初始化动画循环
  - [x] 使用基础版配置（80 粒子 + 流光渐变 + 鼠标交互 + FPS 降级）
  - [x] 组件卸载时清理 requestAnimationFrame 和事件监听器
  - [x] 保持默认导出，文件名不变
  - [x] 修复 TypeScript 类型错误（ConfigType 接口替代 as const）

- [x] Task 2: 部署到服务器并验证
  - [x] 上传修改后的文件到服务器
  - [x] 重新构建前端
  - [x] 重启 PM2 服务
  - [x] 验证背景效果和性能指标

# Task Dependencies
- Task 2 依赖 Task 1
