/**
 * 命令 Store（Slice）
 * 负责撤销/重做（Undo/Redo）的命令栈管理。
 *
 * 说明：本文件采用 zustand 的 Slice 模式，导出 createCommandSlice 用于在 appStore 中组合。
 * 状态最终由聚合 Store（useAppStore）统一持有。
 */
import type { AppState } from './appStore';
import { useAppStore } from './appStore';

/**
 * 命令接口 - 用于撤销/重做操作
 * 每个命令封装一个可撤销的操作，包含执行和撤销逻辑
 */
export interface Command {
  id: string;
  description: string;
  execute: () => void;
  undo: () => void;
}

/**
 * 最大撤销/重做栈深度
 */
const MAX_STACK_SIZE = 30;

/**
 * 命令 Slice 状态与方法接口
 */
export interface CommandSlice {
  /** 撤销栈 */
  undoStack: Command[];
  /** 重做栈 */
  redoStack: Command[];
  /** 是否可撤销 */
  canUndo: boolean;
  /** 是否可重做 */
  canRedo: boolean;
  /** 撤销操作 */
  undo: () => void;
  /** 重做操作 */
  redo: () => void;
  /** 推送命令到撤销栈 */
  pushCommand: (command: Command) => void;
  /** 撤销到指定位置 */
  undoTo: (targetIndex: number) => void;
}

/**
 * Slice 的 set 函数类型（操作聚合 Store 的全量状态）
 */
type SliceSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>)
) => void;

/**
 * Slice 的 get 函数类型（返回聚合 Store 的全量状态）
 */
type SliceGet = () => AppState;

/**
 * 创建命令 Slice
 * @param set - 聚合 Store 的 set 函数
 * @param get - 聚合 Store 的 get 函数
 * @returns 命令 Slice 的状态与方法
 */
export const createCommandSlice = (set: SliceSet, get: SliceGet): CommandSlice => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  /**
   * 撤销操作
   * 弹出undoStack顶部Command，调用其undo()，推入redoStack
   */
  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const command = undoStack[undoStack.length - 1];
    command.undo();

    set((state) => {
      const newUndoStack = state.undoStack.slice(0, -1);
      const newRedoStack = [...state.redoStack, command];
      return {
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: newRedoStack.length > 0,
      };
    });
  },

  /**
   * 重做操作
   * 弹出redoStack顶部Command，调用其execute()，推入undoStack
   */
  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    const command = redoStack[redoStack.length - 1];
    command.execute();

    set((state) => {
      const newRedoStack = state.redoStack.slice(0, -1);
      const newUndoStack = [...state.undoStack, command];
      if (newUndoStack.length > MAX_STACK_SIZE) {
        newUndoStack.shift();
      }
      return {
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: newRedoStack.length > 0,
      };
    });
  },

  /**
   * 推送命令到撤销栈
   * 将command推入undoStack，清空redoStack
   * @param command - 要推送的命令对象
   */
  pushCommand: (command: Command) => {
    set((state) => {
      const newUndoStack = [...state.undoStack, command];
      if (newUndoStack.length > MAX_STACK_SIZE) {
        newUndoStack.shift();
      }
      return {
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: newUndoStack.length > 0,
        canRedo: false,
      };
    });
  },

  /**
   * 撤销到指定位置
   * 连续执行undo操作直到undoStack长度等于targetIndex+1
   * @param targetIndex - 目标位置在undoStack中的索引
   */
  undoTo: (targetIndex: number) => {
    const { undoStack } = get();
    const stepsToUndo = undoStack.length - 1 - targetIndex;
    for (let i = 0; i < stepsToUndo; i++) {
      get().undo();
    }
  },
});

/**
 * 命令 Slice 便捷 Hook（用于未来逐步迁移组件引用）
 * 调用形式为 useCommandStore(selector)
 *
 * 实现说明：通过 ES Module live binding 引用 useAppStore，循环依赖在运行期安全。
 *
 * @param selector - 选择器函数，从命令 Slice 状态中选取所需片段
 * @returns 选择器返回的值
 */
export function useCommandStore<T>(selector: (s: CommandSlice) => T): T {
  return useAppStore(selector as (s: AppState) => T);
}
