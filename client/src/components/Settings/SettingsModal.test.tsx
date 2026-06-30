import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import SettingsModal from './SettingsModal';

/**
 * APP ICP 备案号文案
 * 用于断言移动端底部是否展示正确的备案信息
 */
const APP_ICP_FILING_TEXT = '桂ICP备2026005821号-3A';

/**
 * 模拟 react-i18next 的 useTranslation hook
 * 返回 settings 命名空间的 t 函数，appIcpFiling 返回实际备案号文案，其他键返回键名
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'appIcpFiling' ? APP_ICP_FILING_TEXT : key),
  }),
}));

/**
 * 模拟移动端检测 hook
 * 通过可变变量控制返回值，便于在不同测试中切换桌面/移动端
 */
let mockIsMobile = false;
vi.mock('../../hooks/useIsMobile', () => ({
  default: () => mockIsMobile,
}));

/**
 * 模拟子面板组件
 * 避免测试 SettingsModal 时引入 store、服务、路由等外部依赖
 */
vi.mock('./UISettingsPanel', () => ({
  default: () => <div data-testid="ui-settings-panel">UISettingsPanel</div>,
}));

vi.mock('./APIConfigPanel', () => ({
  default: () => <div data-testid="api-config-panel">APIConfigPanel</div>,
}));

vi.mock('../Onboarding/OnboardingGuide', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="onboarding-guide">OnboardingGuide</div> : null,
}));

describe('SettingsModal - APP ICP 备案号展示', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockIsMobile = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  });

  /**
   * 在容器内渲染组件
   * @param element - 需要渲染的 React 元素
   */
  const renderElement = async (element: React.ReactElement) => {
    await act(async () => {
      root?.render(element);
    });
  };

  /**
   * 获取 APP ICP 备案号元素
   * @returns 备案号 footer 元素或 null
   */
  const getAppIcpFilingElement = (): HTMLElement | null => {
    return container?.querySelector('[aria-label="APP ICP 备案号"]') ?? null;
  };

  it('移动端打开设置弹窗时，底部应显示 APP ICP 备案号', async () => {
    mockIsMobile = true;

    await renderElement(
      <SettingsModal isOpen={true} onClose={() => {}} />
    );

    const filingElement = getAppIcpFilingElement();
    expect(filingElement).not.toBeNull();
    expect(filingElement?.textContent).toContain(APP_ICP_FILING_TEXT);
  });

  it('桌面端打开设置弹窗时，底部不应显示 APP ICP 备案号', async () => {
    mockIsMobile = false;

    await renderElement(
      <SettingsModal isOpen={true} onClose={() => {}} />
    );

    const filingElement = getAppIcpFilingElement();
    expect(filingElement).toBeNull();
  });

  it('APP ICP 备案号元素应包含正确的 aria-label 和 role 属性', async () => {
    mockIsMobile = true;

    await renderElement(
      <SettingsModal isOpen={true} onClose={() => {}} />
    );

    const filingElement = getAppIcpFilingElement();
    expect(filingElement).not.toBeNull();
    expect(filingElement?.getAttribute('role')).toBe('contentinfo');
    expect(filingElement?.getAttribute('aria-label')).toBe('APP ICP 备案号');
  });

  it('切换 ui/api/guide 三个 Tab 后，移动端设置弹窗底部备案号始终可见', async () => {
    mockIsMobile = true;

    await renderElement(
      <SettingsModal isOpen={true} onClose={() => {}} />
    );

    const tabIds: Array<'ui' | 'api' | 'guide'> = ['ui', 'api', 'guide'];

    for (const tabId of tabIds) {
      const tabButton = container?.querySelector(`button[data-tab="${tabId}"]`) as HTMLElement | null;
      expect(tabButton).not.toBeNull();

      await act(async () => {
        tabButton?.click();
      });

      const filingElement = getAppIcpFilingElement();
      expect(filingElement).not.toBeNull();
      expect(filingElement?.textContent).toContain(APP_ICP_FILING_TEXT);
    }
  });
});
