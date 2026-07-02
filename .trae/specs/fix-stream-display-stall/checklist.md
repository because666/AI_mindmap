# Checklist

- [x] `flushBufferToDisplay` 函数开头已重置 `animationFrameRef.current = 0`
- [x] `handleStream` 中 `if (!animationFrameRef.current)` 判断能正确调度新的 flush
- [x] 主客户端 `npm run build` 通过
- [x] 部署到服务器，备份验证通过（.bak-20260702-140210）
- [x] PM2 重启成功，健康检查通过（主服务 200、Admin 200）
- [ ] 浏览器实测：AI 回复持续流式显示，不再"首字符后停止"（需用户验证）
