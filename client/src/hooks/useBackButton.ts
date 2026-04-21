import { useEffect, useCallback } from 'react';
import mobileService from '../services/mobileService';

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
 * // 双击退出：第一次按返回显示提示，第二次才退出
 * const { showExitHint } = useBackButton();
 * ```
 */

/**
 * 基础 Hook：注册返回键处理器
 * @param handler - 处理函数，返回 true 表示已消费事件
 * @param active - 是否激活处理器，默认为 true
 */
export function useBackButton(handler?: (() => boolean | Promise<boolean>) | undefined, active: boolean = true): void {
  useEffect(() => {
    if (!active || !handler) return;

    const unregister = mobileService.registerBackButtonHandler(handler);

    return () => {
      unregister();
    };
  }, [handler, active]);
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
   * @param handler - 处理函数，返回 true 表示已消费事件
   * @param active - 是否激活处理器
   */
  const registerHandler = useCallback((handler: () => boolean | Promise<boolean>, active = true) => {
    if (!active) return;

    return mobileService.registerBackButtonHandler(handler);
  }, []);

  /**
   * 注册默认的"再按一次退出"行为
   * 第一次按返回显示提示，2秒内再按才真正退出
   */
  const registerDefaultExit = useCallback(() => {
    return mobileService.registerBackButtonHandler(async () => {
      if (showExitHint) {
        return false; // 第二次按返回，不消费事件，执行默认退出
      }

      setShowExitHint(true);
      mobileService.haptic('light');

      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }

      exitTimerRef.current = setTimeout(() => {
        setShowExitHint(false);
      }, 2000);

      return true; // 消费事件
    });
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
 * 适用于只需要"再按一次退出"行为的场景
 */
export function useDoublePressExit() {
  const [showExitHint, setShowExitHint] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unregister = mobileService.registerBackButtonHandler(async () => {
      if (showExitHint) {
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

      return true;
    });

    return () => {
      unregister();
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [showExitHint]);

  return showExitHint;
}

import { useState, useRef } from 'react';

export default useBackButton;
