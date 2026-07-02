# Tasks

- [ ] Task 1: 修复 flushBufferToDisplay 的 animationFrameRef 重置问题
  - [ ] SubTask 1.1: 在 `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay` 函数开头添加 `animationFrameRef.current = 0;`，确保后续 SSE 数据能触发新的调度
  - [ ] SubTask 1.2: 构建验证 `npm run build` 通过
  - [ ] SubTask 1.3: 部署到服务器并验证流式输出持续显示
