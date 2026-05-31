import { useEffect, useCallback, useRef } from 'react';

/**
 * 键盘快捷键处理器接口
 * @property onSearch - 搜索快捷键回调（Ctrl+K / Cmd+K）
 * @property onUndo - 撤销快捷键回调（Ctrl+Z / Cmd+Z）
 * @property onRedo - 重做快捷键回调（Ctrl+Y / Cmd+Shift+Z）
 * @property onDelete - 删除快捷键回调（Delete / Backspace）
 * @property onSave - 保存快捷键回调（Ctrl+S / Cmd+S）
 * @property onEscape - Escape快捷键回调
 */
interface KeyboardShortcutHandlers {
  onSearch?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onEscape?: () => void;
}

/**
 * 判断当前焦点是否在可编辑元素中
 * 当用户在 input、textarea 或 contenteditable 元素中输入时返回true
 * @param target - 事件目标元素
 * @returns 是否在可编辑元素中
 */
const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return false;
};

/**
 * 键盘快捷键 Hook
 * 注册全局键盘快捷键监听，支持Ctrl/Cmd组合键和常用操作快捷键
 * 当用户在可编辑元素（input/textarea/contenteditable）中输入时，不触发快捷键（Escape除外）
 * 组件卸载时自动清理事件监听
 * @param handlers - 快捷键处理器对象，包含各快捷键的回调函数
 */
function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const handlersRef = useRef<KeyboardShortcutHandlers>(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { onSearch, onUndo, onRedo, onDelete, onSave, onEscape } = handlersRef.current;
    const isMod = event.ctrlKey || event.metaKey;
    const inEditable = isEditableElement(event.target);

    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape?.();
      return;
    }

    if (inEditable) {
      return;
    }

    if (isMod && event.key === 'k') {
      event.preventDefault();
      onSearch?.();
      return;
    }

    if (isMod && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      onUndo?.();
      return;
    }

    if ((isMod && event.key === 'y') || (isMod && event.shiftKey && event.key === 'z') || (isMod && event.shiftKey && event.key === 'Z')) {
      event.preventDefault();
      onRedo?.();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete?.();
      return;
    }

    if (isMod && event.key === 's') {
      event.preventDefault();
      onSave?.();
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;
