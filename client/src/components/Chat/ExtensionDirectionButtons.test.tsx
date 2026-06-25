import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ExtensionDirectionButtons } from './ExtensionDirectionButtons';

/**
 * 模拟 react-i18next 的 useTranslation hook
 * 返回一个简单的 t 函数，直接返回翻译键名
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/**
 * 模拟移动端检测 hook
 * 通过 mutable 变量控制返回值，便于在不同测试中切换桌面/移动端
 */
let mockIsMobile = false;
vi.mock('../../hooks/useIsMobile', () => ({
  default: () => mockIsMobile,
}));

describe('ExtensionDirectionButtons', () => {
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

  it('当 directions 为空数组时，不应渲染任何内容', async () => {
    await renderElement(
      <ExtensionDirectionButtons
        directions={[]}
        onDirectionClick={() => {}}
      />
    );

    expect(container?.firstChild).toBeNull();
  });

  it('应渲染标题和所有方向按钮', async () => {
    const directions = ['方向一', '方向二', '方向三'];

    await renderElement(
      <ExtensionDirectionButtons
        directions={directions}
        onDirectionClick={() => {}}
      />
    );

    expect(container?.textContent).toContain('extensionDirectionsTitle');
    directions.forEach((direction) => {
      expect(container?.textContent).toContain(direction);
    });
  });

  it('点击按钮时应调用 onDirectionClick 并传入对应方向文本', async () => {
    const handleClick = vi.fn();
    const directions = ['方向一', '方向二'];

    await renderElement(
      <ExtensionDirectionButtons
        directions={directions}
        onDirectionClick={handleClick}
      />
    );

    const buttons = container?.querySelectorAll('button');
    expect(buttons).toHaveLength(2);

    await act(async () => {
      buttons?.item(1).click();
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith('方向二');
  });

  it('当某个方向处于加载状态时，该按钮应显示加载文案并禁用所有按钮', async () => {
    const handleClick = vi.fn();
    const directions = ['方向一', '方向二'];

    await renderElement(
      <ExtensionDirectionButtons
        directions={directions}
        onDirectionClick={handleClick}
        loadingDirection="方向一"
      />
    );

    expect(container?.textContent).toContain('creatingBranch');

    const buttons = container?.querySelectorAll('button');
    buttons?.forEach((button) => {
      expect(button.disabled).toBe(true);
    });
  });

  it('在移动端应使用垂直堆叠布局且按钮宽度占满容器', async () => {
    mockIsMobile = true;
    const directions = ['方向一', '方向二'];

    await renderElement(
      <ExtensionDirectionButtons
        directions={directions}
        onDirectionClick={() => {}}
      />
    );

    const buttonContainer = container?.querySelector('.flex.flex-col');
    expect(buttonContainer).not.toBeNull();

    const buttons = container?.querySelectorAll('button');
    buttons?.forEach((button) => {
      expect(button.className).toContain('w-full');
    });
  });
});
