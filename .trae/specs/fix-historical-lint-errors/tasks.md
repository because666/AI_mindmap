# Tasks

> 对应 spec.md：修复历史 Lint 错误
> 范围：仅 client 目录，目标 `npm run lint` 零错误

- [x] Task 1: 生成产物加入 `.eslintignore`
  - [x] SubTask 1.1: 检查 `.eslintignore` 是否存在，不存在则创建
  - [x] SubTask 1.2: 将 `android/app/build`、`dist`、`node_modules` 等生成目录加入忽略列表
  - [x] SubTask 1.3: 验证 `npm run lint` 不再扫描 `native-bridge.js`

- [x] Task 2: 修复 `react-hooks/set-state-in-effect` 错误
  - [x] SubTask 2.1: 重构 `client/src/App.tsx` 中离线横幅与加载状态的 setState
  - [x] SubTask 2.2: 重构 `client/src/components/Common/AnnouncementBanner.tsx`
  - [x] SubTask 2.3: 重构 `client/src/components/Common/BroadcastPopup.tsx`
  - [x] SubTask 2.4: 重构 `client/src/components/Node/NodeEditor.tsx`
  - [x] SubTask 2.5: 重构 `client/src/components/Node/RelationEditor.tsx`
  - [x] SubTask 2.6: 运行 `npm run lint` 确认该规则无新增错误

- [x] Task 3: 修复 `@typescript-eslint/no-unused-vars` 错误
  - [x] SubTask 3.1: 修复 `client/src/components/History/HistoryPanel.tsx`
  - [x] SubTask 3.2: 修复 `client/src/components/MessageCenter/UnreadBadge.tsx`
  - [x] SubTask 3.3: 修复 `client/src/components/Search/SearchPanel.tsx`
  - [x] SubTask 3.4: 修复 `client/src/components/Settings/AddModelModal.tsx`
  - [x] SubTask 3.5: 修复 `client/src/hooks/useKeyboardShortcuts.ts`
  - [x] SubTask 3.6: 修复 `client/src/services/pushService.ts`

- [x] Task 4: 修复 `react-hooks/exhaustive-deps` 警告
  - [x] SubTask 4.1: 修复 `client/src/components/Chat/ChatPanel.tsx` 中 `messages` 派生导致的依赖警告
  - [x] SubTask 4.2: 运行 `npm run lint` 确认无新增警告

- [x] Task 5: 端到端验证
  - [x] SubTask 5.1: `npm run lint` 通过（零错误）
  - [x] SubTask 5.2: `npx tsc -b --noEmit` 通过
  - [x] SubTask 5.3: `npm run build` 通过
  - [x] SubTask 5.4: `npm run test -- --run` 通过（允许已有失败，但新增代码不能引入新失败）

# Task Dependencies

- Task 2 与 Task 3 可并行
- Task 4 与 Task 2、Task 3 可并行
- Task 5 依赖 Task 1、Task 2、Task 3、Task 4
