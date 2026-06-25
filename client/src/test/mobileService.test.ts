import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '@capacitor/app';
import mobileService from '../services/mobileService';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve()),
    exitApp: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    addListener: vi.fn(() => Promise.resolve()),
    getStatus: vi.fn(() => Promise.resolve({ connected: true, connectionType: 'wifi' })),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(() => Promise.resolve()),
    notification: vi.fn(() => Promise.resolve()),
    selectionStart: vi.fn(() => Promise.resolve()),
    selectionChanged: vi.fn(() => Promise.resolve()),
    selectionEnd: vi.fn(() => Promise.resolve()),
  },
  ImpactStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: vi.fn(() => Promise.resolve()),
    allowSleep: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn(() => Promise.resolve()),
    setBackgroundColor: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
  },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}));

/**
 * 触发物理返回键事件
 * 等待 MobileService 初始化完成后再调用注册的监听器
 */
async function triggerBackButton(): Promise<void> {
  // 等待构造函数中的异步初始化完成
  await new Promise((resolve) => { setTimeout(resolve, 0); });

  const calls = vi.mocked(App.addListener).mock.calls;
  const backButtonCall = calls.find((call) => call[0] === 'backButton');

  if (!backButtonCall) {
    throw new Error('backButton 监听器未注册');
  }

  const callback = backButtonCall[1] as () => void;
  callback();

  // 等待 handleBackButton 内部的异步处理器执行完成
  await new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('MobileService 返回键处理', () => {
  beforeEach(() => {
    mobileService.clearBackButtonHandlers();
    vi.mocked(App.exitApp).mockClear();
  });

  it('高优先级处理器优先于低优先级处理器执行', async () => {
    const order: string[] = [];

    mobileService.registerBackButtonHandler(async () => {
      order.push('low');
      return false;
    }, 10);

    mobileService.registerBackButtonHandler(async () => {
      order.push('high');
      return false;
    }, 20);

    await triggerBackButton();

    expect(order).toEqual(['high', 'low']);
  });

  it('相同优先级下后注册的处理器先执行', async () => {
    const order: string[] = [];

    mobileService.registerBackButtonHandler(async () => {
      order.push('first');
      return false;
    }, 0);

    mobileService.registerBackButtonHandler(async () => {
      order.push('second');
      return false;
    }, 0);

    await triggerBackButton();

    expect(order).toEqual(['second', 'first']);
  });

  it('处理器返回 true 时阻止后续处理器和默认退出行为', async () => {
    const order: string[] = [];

    mobileService.registerBackButtonHandler(async () => {
      order.push('low');
      return false;
    }, 10);

    mobileService.registerBackButtonHandler(async () => {
      order.push('high');
      return true;
    }, 20);

    await triggerBackButton();

    expect(order).toEqual(['high']);
    expect(App.exitApp).not.toHaveBeenCalled();
  });

  it('所有处理器都返回 false 时触发默认退出', async () => {
    mobileService.registerBackButtonHandler(async () => false, 0);

    await triggerBackButton();

    expect(App.exitApp).toHaveBeenCalledTimes(1);
  });

  it('注销处理器后该处理器不再参与返回键事件', async () => {
    const handler = async () => true;
    const unregister = mobileService.registerBackButtonHandler(handler, 100);

    unregister();
    await triggerBackButton();

    expect(App.exitApp).toHaveBeenCalledTimes(1);
  });
});
