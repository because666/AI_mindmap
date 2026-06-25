import { useEffect, useState, useRef, useCallback } from 'react';
import mobileService from '../services/mobileService';

/**
 * 返回键处理函数类型
 * 返回 true 表示已消费事件，阻止后续处理；返回 false 表示继续传递
 */
export type BackButtonHandler = () => boolean | Promise<boolean>;

/**
 * 返回键处理器优先级类型
 * 数值越大优先级越高，相同优先级遵循后注册先执行的栈式语义
 */
export type BackButtonPriority = number;

/**
 * 返回键处理 Hook
 * 用于在移动端原生应用中自定义物理返回键/手势返回的行为
 *
 * @example
 * ```tsx
 * // 基础用法：拦截返回键
 * useBackButton(() => {
 *   handleClose();
 *   return true; // 返回 true 表示已消费事件
 * });
 *
 * // 条件用法：只在面板打开时拦截
 * useBackButton(
 *   () => {
 *     closePanel();
 *     return true;
 *   },
 *   isPanelOpen
 * );
 *
 * // 带优先级用法：数值越大越优先执行
 * useBackButton(() => {
 *   closeHighPriorityPanel();
 *   return true;
 * }, active, 100);
 * ```
 */

/**
 * 基础 Hook：注册返回键处理器
 *
 * @param handler - 处理函数，返回 true 表示已消费事件，返回 false 表示继续传递
 * @param active - 是否激活处理器，默认为 true
 * @param priority - 处理器优先级，数值越大优先级越高，相同优先级后注册的先执行
 */
export function useBackButton(
  handler?: BackButtonHandler,
  active: boolean = true,
  priority: BackButtonPriority = 0
): void {
  useEffect(() => {
    if (!active || !handler) {
      return;
    }

    const unregister = mobileService.registerBackButtonHandler(handler, priority);

    return () => {
      unregister();
    };
  }, [handler, active, priority]);
}

/**
 * 高级 Hook：提供双击退出功能 + 自定义返回键处理
 * 返回包含双击退出提示状态和注册方法的对象
 */
export function useBackButtonAdvanced() {
  const [showExitHint, setShowExitHint] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 注册返回键处理器
   *
   * @param handler - 处理函数，返回 true 表示已消费事件
   * @param active - 是否激活处理器
   * @param priority - 处理器优先级，数值越大优先级越高
   * @returns 取消注册函数，调用后移除此处理器
   */
  const registerHandler = useCallback(
    (handler: BackButtonHandler, active = true, priority: BackButtonPriority = 0) => {
      if (!active) {
        return () => {};
      }

      return mobileService.registerBackButtonHandler(handler, priority);
    },
    []
  );

  /**
   * 注册默认的“再按一次退出”行为
   * 第一次按返回显示提示，2 秒内再按才真正退出
   */
  const registerDefaultExit = useCallback(() => {
    return mobileService.registerBackButtonHandler(async () => {
      if (showExitHint) {
        // 第二次按返回，不消费事件，执行默认退出
        return false;
      }

      setShowExitHint(true);
      mobileService.haptic('light');

      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }

      exitTimerRef.current = setTimeout(() => {
        setShowExitHint(false);
      }, 2000);

      // 消费事件，避免触发默认退出
      return true;
    }, 0);
  }, [showExitHint]);

  useEffect(() => {
    const unregister = registerDefaultExit();

    return () => {
      unregister();
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [registerDefaultExit]);

  return { showExitHint, registerHandler };
}

/**
 * 简化版 Hook：只提供双击退出提示功能
 * 适用于只需要“再按一次退出”行为的场景
 *
 * @param active - 是否激活处理器，默认为 true
 * @param priority - 处理器优先级，数值越大优先级越高
 * @returns 当前是否正在显示退出提示
 */
export function useDoublePressExit(active: boolean = true, priority: BackButtonPriority = 0) {
  const [showExitHint, setShowExitHint] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      return () => {};
    }

    const unregister = mobileService.registerBackButtonHandler(async () => {
      if (showExitHint) {
        // 第二次按返回，不消费事件，执行默认退出
        return false;
      }

      setShowExitHint(true);
      mobileService.haptic('light');

      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }

      exitTimerRef.current = setTimeout(() => {
        setShowExitHint(false);
      }, 2000);

      // 消费事件，避免触发默认退出
      return true;
    }, priority);

    return () => {
      unregister();
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [active, priority, showExitHint]);

  return showExitHint;
}

export default useBackButton;
