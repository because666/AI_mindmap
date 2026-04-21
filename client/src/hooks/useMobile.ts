import { useEffect, useState, useCallback } from 'react';
import mobileService from '../services/mobileService';
import type { HapticImpact, NetworkStatus } from '../services/mobileService';

/**
 * 移动端原生功能 Hook
 * 提供触觉反馈、网络状态检测、屏幕常亮等功能的 React 封装
 *
 * @example
 * ```tsx
 * const { haptic, isOnline, keepAwake, allowSleep, isNative } = useMobile();
 *
 * // 触觉反馈
 * const handleClick = () => {
 *   haptic('medium'); // 中等震动
 * };
 *
 * // 屏幕常亮（AI对话时）
 * useEffect(() => {
 *   if (isChatting) keepAwake();
 *   else allowSleep();
 * }, [isChatting]);
 * ```
 */
export function useMobile() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isNative] = useState(mobileService.isNativePlatform());

  /** 触发触觉反馈 */
  const haptic = useCallback(async (impact: HapticImpact = 'medium') => {
    await mobileService.haptic(impact);
  }, []);

  /** 触发通知式振动 */
  const notifyHaptic = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    await mobileService.notify(type);
  }, []);

  /** 开启屏幕常亮 */
  const keepAwake = useCallback(async () => {
    await mobileService.keepAwake();
  }, []);

  /** 关闭屏幕常亮 */
  const allowSleep = useCallback(async () => {
    await mobileService.allowSleep();
  }, []);

  /** 获取当前屏幕常亮状态 */
  const getIsKeepAwake = useCallback(() => {
    return mobileService.getIsKeepAwake();
  }, []);

  /** 设置状态栏为深色主题 */
  const setStatusBarDark = useCallback(async (color?: string) => {
    await mobileService.setStatusBarDark(color);
  }, []);

  /** 设置状态栏为浅色主题 */
  const setStatusBarLight = useCallback(async (color?: string) => {
    await mobileService.setStatusBarLight(color);
  }, []);

  /** 隐藏状态栏 */
  const hideStatusBar = useCallback(async () => {
    await mobileService.hideStatusBar();
  }, []);

  /** 显示状态栏 */
  const showStatusBar = useCallback(async () => {
    await mobileService.showStatusBar();
  }, []);

  useEffect(() => {
    let mounted = true;

    const initNetwork = async () => {
      const status = await mobileService.getNetworkStatus();
      if (mounted) {
        setIsOnline(status.connected);
        setConnectionType(status.connectionType);
      }
    };

    initNetwork();

    const unsubscribe = mobileService.onNetworkChange((status: NetworkStatus) => {
      if (mounted) {
        setIsOnline(status.connected);
        setConnectionType(status.connectionType);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    haptic,
    notifyHaptic,
    isOnline,
    connectionType,
    keepAwake,
    allowSleep,
    getIsKeepAwake,
    isNative,
    setStatusBarDark,
    setStatusBarLight,
    hideStatusBar,
    showStatusBar,
  };
}

export default useMobile;
