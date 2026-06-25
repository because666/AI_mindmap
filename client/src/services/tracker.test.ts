import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Tracker,
  track,
  tracker,
  TRACK_EVENT_PAGE_VIEW,
  TRACK_EVENT_NODE_CREATED,
  TRACK_EVENT_BRANCH_CREATED,
  TRACK_EVENT_EXTENSION_DIRECTION_CLICK,
  TRACK_EVENT_SUMMARY_GENERATED,
  TRACK_EVENT_MAP_CREATED,
  type TrackerEvent,
} from './tracker';

const mockPost = vi.fn();
const mockGetLocalVisitorId = vi.fn(() => 'visitor-001');
const mockGetLocalWorkspaceId = vi.fn(() => 'workspace-001');

vi.mock('./api', () => ({
  httpClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
  getLocalVisitorId: () => mockGetLocalVisitorId(),
  getLocalWorkspaceId: () => mockGetLocalWorkspaceId(),
}));

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('Tracker', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGetLocalVisitorId.mockReturnValue('visitor-001');
    mockGetLocalWorkspaceId.mockReturnValue('workspace-001');
    window.localStorage.clear();
  });

  it('应导出所有预定义事件类型常量', () => {
    expect(TRACK_EVENT_PAGE_VIEW).toBe('page_view');
    expect(TRACK_EVENT_NODE_CREATED).toBe('node_created');
    expect(TRACK_EVENT_BRANCH_CREATED).toBe('branch_created');
    expect(TRACK_EVENT_EXTENSION_DIRECTION_CLICK).toBe('extension_direction_click');
    expect(TRACK_EVENT_SUMMARY_GENERATED).toBe('summary_generated');
    expect(TRACK_EVENT_MAP_CREATED).toBe('map_created');
  });

  it('track() 应将事件加入队列并在达到 batchSize 时触发上报', async () => {
    mockPost.mockResolvedValue({ success: true });
    const instance = new Tracker({ batchSize: 2, flushIntervalMs: 10000 });

    instance.track(TRACK_EVENT_PAGE_VIEW, { title: '首页' });
    expect(mockPost).not.toHaveBeenCalled();

    instance.track(TRACK_EVENT_NODE_CREATED, { nodeId: 'node-1' });
    await wait(0);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const body = mockPost.mock.calls[0][1] as { events: TrackerEvent[] };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].eventType).toBe(TRACK_EVENT_PAGE_VIEW);
    expect(body.events[1].eventType).toBe(TRACK_EVENT_NODE_CREATED);

    instance.destroy();
  });

  it('构建的事件应包含公共属性 visitorId、workspaceId、timestamp、url、userAgent', async () => {
    mockPost.mockResolvedValue({ success: true });
    const instance = new Tracker({ batchSize: 1, flushIntervalMs: 10000 });

    instance.track(TRACK_EVENT_MAP_CREATED, { name: '新导图' });
    await wait(0);

    const body = mockPost.mock.calls[0][1] as { events: TrackerEvent[] };
    const event = body.events[0];
    expect(event.commonProps.visitorId).toBe('visitor-001');
    expect(event.commonProps.workspaceId).toBe('workspace-001');
    expect(typeof event.commonProps.timestamp).toBe('number');
    expect(event.commonProps.timestamp).toBeGreaterThan(0);
    expect(event.commonProps.url).toBe(window.location.href);
    expect(event.commonProps.userAgent).toBe(navigator.userAgent);

    instance.destroy();
  });

  it('flush() 失败时应自动重试一次', async () => {
    mockPost.mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce({ success: true });
    const instance = new Tracker({ batchSize: 1, flushIntervalMs: 10000 });

    instance.track(TRACK_EVENT_BRANCH_CREATED);
    await wait(0);

    expect(mockPost).toHaveBeenCalledTimes(2);

    instance.destroy();
  });

  it('flush() 在重试后仍失败时应静默处理，不抛出异常', async () => {
    mockPost.mockRejectedValue(new Error('服务不可用'));
    const instance = new Tracker({ batchSize: 1, flushIntervalMs: 10000 });

    expect(() => {
      instance.track(TRACK_EVENT_SUMMARY_GENERATED);
    }).not.toThrow();

    await wait(0);

    expect(mockPost).toHaveBeenCalledTimes(2);

    instance.destroy();
  });

  it('定时器到达间隔时应自动触发 flush', async () => {
    mockPost.mockResolvedValue({ success: true });
    const instance = new Tracker({ batchSize: 10, flushIntervalMs: 100 });

    instance.track(TRACK_EVENT_EXTENSION_DIRECTION_CLICK, { direction: '方向一' });
    expect(mockPost).not.toHaveBeenCalled();

    await wait(150);

    expect(mockPost).toHaveBeenCalledTimes(1);

    instance.destroy();
  });

  it('页面离开时应使用 navigator.sendBeacon 上报剩余事件', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      configurable: true,
      value: sendBeacon,
    });

    const instance = new Tracker({ batchSize: 10, flushIntervalMs: 10000 });

    instance.track(TRACK_EVENT_PAGE_VIEW);
    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toContain('/events');
    expect(blob).toBeInstanceOf(Blob);

    instance.destroy();
  });

  it('页面离开时 sendBeacon 不可用应降级使用 fetch 上报', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    const instance = new Tracker({ batchSize: 10, flushIntervalMs: 10000 });
    instance.track(TRACK_EVENT_NODE_CREATED);
    window.dispatchEvent(new Event('beforeunload'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0][1] as { method: string; keepalive: boolean };
    expect(callArgs.method).toBe('POST');
    expect(callArgs.keepalive).toBe(true);

    instance.destroy();
    fetchSpy.mockRestore();
  });

  it('便捷函数 track 应委托给 tracker 单例', async () => {
    mockPost.mockResolvedValue({ success: true });
    tracker.destroy();

    track(TRACK_EVENT_MAP_CREATED, { source: 'test' });
    await tracker.flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    const body = mockPost.mock.calls[0][1] as { events: TrackerEvent[] };
    expect(body.events[0].eventType).toBe(TRACK_EVENT_MAP_CREATED);
    expect(body.events[0].payload.source).toBe('test');

    tracker.destroy();
  });
});
