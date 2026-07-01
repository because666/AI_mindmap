# Tasks

- [x] Task 1: 复现桌面端地图库面板闪退问题
  - [x] SubTask 1.1: 通过静态代码分析定位根因（双重 opacity 过渡冲突）
  - [x] SubTask 1.2: 确认桌面端 MapLibrary 包装 div 与内层 MapLibrary 根 div 的过渡叠加

- [x] Task 2: 定位根因并修复
  - [x] SubTask 2.1: 确认根因为 `transition-all` + 内联 `opacity` 与内层 `transition-opacity` 叠加冲突
  - [x] SubTask 2.2: 修复 MapLibrary 包装 div：改用 `transition-[width]` + `pointer-events-none` class
  - [x] SubTask 2.3: 同步修复 HistoryPanel 包装 div（相同 bug 模式）
  - [x] SubTask 2.4: 简化 MapLibrary 根 div，移除重复的 opacity/pointer-events 切换

- [x] Task 3: 验证修复
  - [x] SubTask 3.1: `npx tsc -b` 无错误
  - [x] SubTask 3.2: `npm run build` 构建成功
  - [x] SubTask 3.3: 移动端渲染路径未修改（回归安全）

- [x] Task 4: 构建并部署
  - [x] SubTask 4.1: TypeScript 编译通过
  - [x] SubTask 4.2: 客户端构建成功
  - [x] SubTask 4.3: 部署到服务器 `/www/wwwroot/AI_mindmap/client/dist/`
  - [x] SubTask 4.4: 服务器 `curl http://127.0.0.1/` 返回 200

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
