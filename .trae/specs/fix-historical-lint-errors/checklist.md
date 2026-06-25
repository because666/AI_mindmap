# Checklist

## 配置

- [x] `.eslintignore` 已存在或已创建
- [x] `android/app/build`、`dist`、`node_modules` 已加入忽略
- [x] `npm run lint` 不再报告 `android/app/build` 下的文件

## set-state-in-effect 修复

- [x] `client/src/App.tsx` 无 `react-hooks/set-state-in-effect` 错误
- [x] `client/src/components/Common/AnnouncementBanner.tsx` 无该规则错误
- [x] `client/src/components/Common/BroadcastPopup.tsx` 无该规则错误
- [x] `client/src/components/Node/NodeEditor.tsx` 无该规则错误
- [x] `client/src/components/Node/RelationEditor.tsx` 无该规则错误
- [x] `client/src/components/Search/SearchPanel.tsx` 无该规则错误
- [x] `client/src/components/Settings/AddModelModal.tsx` 无该规则错误
- [x] `client/src/hooks/useKeyboardShortcuts.ts` 无 `Cannot access refs during render` 错误

## 未使用变量修复

- [x] `client/src/components/History/HistoryPanel.tsx` 无未使用变量错误
- [x] `client/src/components/MessageCenter/UnreadBadge.tsx` 无未使用变量错误
- [x] `client/src/components/Search/SearchPanel.tsx` 无未使用变量错误
- [x] `client/src/components/Settings/AddModelModal.tsx` 无未使用变量错误
- [x] `client/src/hooks/useKeyboardShortcuts.ts` 无未使用变量错误
- [x] `client/src/services/pushService.ts` 无未使用变量错误

## exhaustive-deps 修复

- [x] `client/src/components/Chat/ChatPanel.tsx` 无新增 `react-hooks/exhaustive-deps` 警告

## 验证

- [x] `npm run lint` 在 `client` 目录执行退出码为 0
- [x] `npx tsc -b --noEmit` 通过
- [x] `npm run build` 通过
- [x] 单测无由本次修改引入的新失败

## 代码质量

- [x] 所有新增/重构函数、方法有 JSDoc 注释
- [x] 无 `any` 类型新增
- [x] 异步操作有异常捕获
