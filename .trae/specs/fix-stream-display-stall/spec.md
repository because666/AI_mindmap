# 修复流式输出停止问题 Spec

## Why
上一个修复（移除每帧 3 字符限制）引入了新 bug：`flushBufferToDisplay` 执行后没有重置 `animationFrameRef.current`，导致 `handleStream` 中的 `if (!animationFrameRef.current)` 条件永远为 false，后续 SSE 数据无法触发新的 flush，用户只看到开头几个字符就停止，直到 stream 结束才一次性显示剩余内容。

## What Changes
- 修复 `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay` 函数：在函数开头将 `animationFrameRef.current` 重置为 0，确保后续 SSE 数据能正确触发新的 `requestAnimationFrame` 调度

## Impact
- 受影响的代码：`client/src/components/Chat/ChatPanel.tsx` 第 752-780 行
- 受影响的功能：AI 对话流式显示

## MODIFIED Requirements

### Requirement: flushBufferToDisplay 调度逻辑
`flushBufferToDisplay` 函数在执行时必须立即将 `animationFrameRef.current` 重置为 0，使得 `handleStream` 回调在收到新 SSE 数据时能正确判断并调度新的 `requestAnimationFrame`。

#### Scenario: 连续 SSE 数据正确流式显示
- **WHEN** 后端持续推送 SSE content 事件
- **THEN** 每个 chunk 到达后应触发 flush，内容持续追加显示
- **AND** 不出现"首字符后停止"的现象
