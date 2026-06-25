# 修复历史 Lint 错误 Spec

## Why

项目 `client` 目录执行 `npm run lint` 时存在大量历史遗留 ESLint 错误（约 25 处错误行），导致代码质量门禁无法通过、CI 阻塞，也掩盖了新增代码可能引入的新问题。必须先清理这些历史错误，才能为后续功能开发建立干净的基线。

## What Changes

- 修复 `client/src` 中的历史 ESLint 错误，主要包括：
  - `react-hooks/set-state-in-effect`：将 effect 中直接调用 `setState` 的写法重构为事件驱动或派生状态
  - `@typescript-eslint/no-unused-vars`：移除或重命名未使用变量
  - `react-hooks/exhaustive-deps`：补充依赖或使用 `useMemo` 包裹派生状态
- 将 `client/android/app/build` 等生成产物目录加入 `.eslintignore`，避免对构建输出执行 lint
- 运行 `npm run lint`、`npm run build`、`npm run test` 验证修复结果

## Impact

- Affected specs: 非线性对话体验产品策略中所有后续任务的质量基线
- Affected code: `client/src/App.tsx`、`client/src/components/**` 中 10+ 个组件、`client/src/hooks/useKeyboardShortcuts.ts`、`client/src/services/pushService.ts`、`.eslintignore`

## ADDED Requirements

### Requirement: Lint 基线干净

The system SHALL ensure `npm run lint` in `client` exits with zero errors.

#### Scenario: Success case
- **WHEN** developer runs `npm run lint` in `client`
- **THEN** no `error` level output is produced
- **AND** pre-existing `warning` count is not increased

### Requirement: 生成产物不参与 Lint

The system SHALL exclude generated build artifacts from ESLint scanning.

#### Scenario: Success case
- **WHEN** `npm run lint` runs
- **THEN** files under `client/android/app/build` are not reported

## MODIFIED Requirements

### Requirement: 修复 `setState` 在 effect 中的调用

The system SHALL eliminate synchronous `setState` calls inside `useEffect` bodies.

#### Scenario: App.tsx
- **GIVEN** the offline banner and workspace loading state management
- **WHEN** network status or workspace changes
- **THEN** state updates happen through event handlers or derived state, not directly in `useEffect`

#### Scenario: AnnouncementBanner.tsx / BroadcastPopup.tsx
- **GIVEN** announcement fetching and visibility logic
- **WHEN** component mounts or announcements update
- **THEN** fetching is triggered by user events or state changes are computed without effect-body setState

#### Scenario: NodeEditor.tsx / RelationEditor.tsx
- **GIVEN** form state derived from selected node
- **WHEN** selected node changes
- **THEN** form state is initialized through controlled component pattern or memoized defaults, not effect-body setState

### Requirement: 修复未使用变量

The system SHALL remove or underscore-prefix unused variables reported by `@typescript-eslint/no-unused-vars`.

#### Scenario: HistoryPanel.tsx / UnreadBadge.tsx / SearchPanel.tsx / AddModelModal.tsx / useKeyboardShortcuts.ts / pushService.ts
- **WHEN** lint runs
- **THEN** no `'_xxx' is defined but never used` or `is defined but never used` errors appear

## REMOVED Requirements

无
