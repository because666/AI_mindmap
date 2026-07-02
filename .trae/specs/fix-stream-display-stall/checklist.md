# Checklist

- [ ] `flushBufferToDisplay` 函数开头已重置 `animationFrameRef.current = 0`
- [ ] `handleStream` 中 `if (!animationFrameRef.current)` 判断能正确调度新的 flush
- [ ] 主客户端 `npm run build` 通过
- [ ] 部署到服务器，备份验证通过
- [ ] 浏览器实测：AI 回复持续流式显示，不再"首字符后停止"
