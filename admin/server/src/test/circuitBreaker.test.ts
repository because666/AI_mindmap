import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * cacheNotify 模块在加载时会检查 INTERNAL_API_TOKEN 环境变量
 * 使用 vi.hoisted 确保在模块导入前设置环境变量，避免模块加载时抛出异常
 */
vi.hoisted(() => {
  process.env.INTERNAL_API_TOKEN = 'test-token-for-circuit-breaker';
});

import { CircuitBreaker, CircuitBreakerOpenError } from '../services/cacheNotify';

/**
 * 熔断器单元测试
 * 覆盖 closed/open/half-open 三态状态机的所有流转路径
 */
describe('CircuitBreaker', () => {
  /** 每个测试用例使用的熔断器实例 */
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // 每个测试创建全新的熔断器实例，默认配置：失败阈值5次，熔断窗口30秒
    breaker = new CircuitBreaker(5, 30000);
    vi.useRealTimers();
  });

  afterEach(() => {
    // 恢复真实定时器，避免影响后续测试
    vi.useRealTimers();
  });

  /**
   * 测试组：closed 状态正常请求通过
   * 验证初始状态下请求正常执行，状态保持 closed
   */
  it('closed 状态正常请求通过', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await breaker.execute(mockFn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试组：连续失败 5 次触发熔断，切换到 open
   * 验证失败计数达到阈值时状态从 closed 切换到 open
   */
  it('连续失败 5 次触发熔断，切换到 open', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 连续失败 5 次（达到阈值）
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(mockFn)).rejects.toThrow('请求失败');
    }

    // 第5次失败后应切换到 open 状态
    expect(breaker.getState()).toBe('open');
    expect(mockFn).toHaveBeenCalledTimes(5);
  });

  /**
   * 测试组：连续失败 4 次不触发熔断，状态仍为 closed
   * 验证未达阈值时不会误触发熔断
   */
  it('连续失败 4 次不触发熔断，状态仍为 closed', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    for (let i = 0; i < 4; i++) {
      await expect(breaker.execute(mockFn)).rejects.toThrow('请求失败');
    }

    expect(breaker.getState()).toBe('closed');
    expect(mockFn).toHaveBeenCalledTimes(4);
  });

  /**
   * 测试组：open 状态快速失败不执行实际请求
   * 验证熔断状态下请求被快速拒绝，不调用实际请求函数
   */
  it('open 状态快速失败不执行实际请求', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('open');

    // 熔断状态下，新的请求应被快速拒绝
    const successFn = vi.fn().mockResolvedValue('success');
    await expect(breaker.execute(successFn)).rejects.toThrow(CircuitBreakerOpenError);
    await expect(breaker.execute(successFn)).rejects.toThrow('熔断器处于打开状态');

    // 实际请求函数不应被调用
    expect(successFn).not.toHaveBeenCalled();
    // 状态仍为 open
    expect(breaker.getState()).toBe('open');
  });

  /**
   * 测试组：熔断 30 秒后进入 half-open 状态
   * 使用 fake timers 模拟时间流逝，验证熔断窗口过后允许试探请求
   */
  it('熔断 30 秒后进入 half-open 状态', async () => {
    vi.useFakeTimers();

    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('open');

    // 熔断窗口内（29秒）仍应快速失败
    vi.advanceTimersByTime(29000);
    const probeFn1 = vi.fn().mockResolvedValue('success');
    await expect(breaker.execute(probeFn1)).rejects.toThrow(CircuitBreakerOpenError);
    expect(probeFn1).not.toHaveBeenCalled();
    expect(breaker.getState()).toBe('open');

    // 推进到 30 秒后，下一次 execute 应切换到 half-open 并执行试探请求
    vi.advanceTimersByTime(1000);

    // 使用可控 Promise 捕获 half-open 状态
    let resolveProbe: (value: string) => void;
    const probePromise = new Promise<string>(resolve => {
      resolveProbe = resolve;
    });
    const probeFn2 = vi.fn().mockReturnValue(probePromise);

    // 启动 execute，状态应切换到 half-open 并调用 fn
    const executePromise = breaker.execute(probeFn2);

    // fn 被调用后、Promise resolve 前，状态应为 half-open
    expect(probeFn2).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe('half-open');

    // resolve 试探请求，应恢复到 closed
    resolveProbe!('success');
    const result = await executePromise;
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
  });

  /**
   * 测试组：half-open 状态试探成功恢复到 closed
   * 验证半开状态下试探请求成功后，熔断器恢复到 closed 并重置失败计数
   */
  it('half-open 状态试探成功恢复到 closed', async () => {
    vi.useFakeTimers();

    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('open');

    // 推进 30 秒，进入 half-open
    vi.advanceTimersByTime(30000);

    // 试探请求成功
    const probeFn = vi.fn().mockResolvedValue('success');
    const result = await breaker.execute(probeFn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
    expect(probeFn).toHaveBeenCalledTimes(1);

    // 恢复 closed 后，后续请求应正常通过
    const normalFn = vi.fn().mockResolvedValue('ok');
    await breaker.execute(normalFn);
    expect(normalFn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe('closed');
  });

  /**
   * 测试组：half-open 状态试探失败重新熔断到 open
   * 验证半开状态下试探请求失败后，熔断器重新切换到 open
   */
  it('half-open 状态试探失败重新熔断到 open', async () => {
    vi.useFakeTimers();

    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('open');

    // 推进 30 秒，进入 half-open
    vi.advanceTimersByTime(30000);

    // 试探请求失败
    const probeFn = vi.fn().mockRejectedValue(new Error('试探失败'));
    await expect(breaker.execute(probeFn)).rejects.toThrow('试探失败');

    // 应重新切换到 open
    expect(breaker.getState()).toBe('open');
    expect(probeFn).toHaveBeenCalledTimes(1);

    // 重新熔断后，后续请求应被快速拒绝
    const normalFn = vi.fn().mockResolvedValue('ok');
    await expect(breaker.execute(normalFn)).rejects.toThrow(CircuitBreakerOpenError);
    expect(normalFn).not.toHaveBeenCalled();
  });

  /**
   * 测试组：成功请求重置失败计数
   * 验证成功请求会将连续失败计数清零，避免历史失败累积导致误触发熔断
   */
  it('成功请求重置失败计数', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));
    const successFn = vi.fn().mockResolvedValue('success');

    // 失败 4 次（未达阈值 5）
    for (let i = 0; i < 4; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('closed');

    // 成功一次，重置失败计数
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe('closed');

    // 再失败 4 次，因计数已重置，不应触发熔断
    for (let i = 0; i < 4; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('closed');

    // 第5次连续失败应触发熔断
    await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    expect(breaker.getState()).toBe('open');
  });

  /**
   * 测试组：reset 方法重置熔断器到初始状态
   * 验证 reset 后状态回到 closed，失败计数清零
   */
  it('reset 方法重置熔断器到初始 closed 状态', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('请求失败'));

    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(failFn)).rejects.toThrow('请求失败');
    }
    expect(breaker.getState()).toBe('open');

    // 重置熔断器
    breaker.reset();
    expect(breaker.getState()).toBe('closed');

    // 重置后请求应正常通过
    const successFn = vi.fn().mockResolvedValue('success');
    const result = await breaker.execute(successFn);
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
  });

  /**
   * 测试组：getState 方法返回当前状态
   * 验证初始状态为 closed
   */
  it('getState 方法返回初始 closed 状态', () => {
    const freshBreaker = new CircuitBreaker();
    expect(freshBreaker.getState()).toBe('closed');
  });
});
