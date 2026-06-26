import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import MindMapThumbnail from './MindMapThumbnail';
import type { NodeData, RelationData } from '../../stores/appStore';

/**
 * 使用 vi.hoisted 创建 Mock 函数，确保在 vi.mock 工厂（会被提升到文件顶部）执行时可访问
 * 这些函数用于验证组件内部对 store 和 API 的调用
 */
const { mockUpdateNode, mockGetActiveConfig, mockGenerateSummary } = vi.hoisted(() => ({
  mockUpdateNode: vi.fn(),
  mockGetActiveConfig: vi.fn(),
  mockGenerateSummary: vi.fn(),
}));

/**
 * 模拟 appStore，仅提供 handleBackToParent 中使用到的 useAppStore.getState().updateNode
 */
vi.mock('../../stores/appStore', () => ({
  useAppStore: {
    getState: () => ({
      updateNode: mockUpdateNode,
    }),
  },
}));

/**
 * 模拟 apiConfigStore，提供 useAPIConfigStore.getState().getActiveConfig
 */
vi.mock('../../stores/apiConfigStore', () => ({
  useAPIConfigStore: {
    getState: () => ({
      getActiveConfig: mockGetActiveConfig,
    }),
  },
}));

/**
 * 模拟 services/api，仅提供 nodeApi.generateSummary
 */
vi.mock('../../services/api', () => ({
  nodeApi: {
    generateSummary: mockGenerateSummary,
  },
}));

/**
 * 模拟 react-i18next 的 useTranslation hook
 * t 函数对带 options 的调用返回 "key:value" 形式，便于通过 title 属性定位按钮
 * i18n.language 固定为 'zh'，测试中文分支
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && 'title' in options) {
        return `${key}:${String(options.title)}`;
      }
      if (options && 'count' in options) {
        return `${key}:${String(options.count)}`;
      }
      return key;
    },
    i18n: { language: 'zh' },
  }),
}));

/**
 * 创建测试用节点数据
 * @param overrides - 覆盖默认字段的对象
 * @returns 完整的 NodeData 对象
 */
const createNode = (overrides: Partial<NodeData>): NodeData => ({
  id: 'node-id',
  title: '测试节点',
  summary: '',
  type: 'default',
  parentIds: [],
  childrenIds: [],
  isRoot: false,
  isComposite: false,
  hidden: false,
  conversationId: null,
  position: { x: 0, y: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  expanded: true,
  ...overrides,
});

/**
 * 创建测试用的根节点 + 子节点 + parent-child 关系
 * @param childOverrides - 子节点的覆盖字段（用于控制 summary、conversationId 等）
 * @returns 节点 Map、关系数组、根节点、子节点
 */
const createTestTree = (childOverrides: Partial<NodeData> = {}) => {
  const rootNode = createNode({ id: 'root', title: '根节点', isRoot: true });
  const childNode = createNode({
    id: 'child',
    title: '子节点',
    parentIds: ['root'],
    ...childOverrides,
  });
  rootNode.childrenIds = ['child'];
  const nodes = new Map<string, NodeData>([
    ['root', rootNode],
    ['child', childNode],
  ]);
  const relations: RelationData[] = [{
    id: 'rel-1',
    sourceId: 'root',
    targetId: 'child',
    type: 'parent-child',
    createdAt: new Date(),
  }];
  return { nodes, relations, rootNode, childNode };
};

/**
 * 创建 window.confirm 的 spy
 * 封装为独立函数以让 TypeScript 正确推断返回类型，
 * 避免 ReturnType<typeof vi.spyOn> 解析为过于宽泛的通用重载类型
 * @returns confirm 方法的 MockInstance
 */
function createConfirmSpy() {
  return vi.spyOn(window, 'confirm');
}

describe('MindMapThumbnail - 回到上一级摘要提示', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let confirmSpy: ReturnType<typeof createConfirmSpy>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    confirmSpy = createConfirmSpy();
    mockUpdateNode.mockClear();
    mockGetActiveConfig.mockClear();
    mockGenerateSummary.mockClear();
    mockGetActiveConfig.mockReturnValue(null);
    mockGenerateSummary.mockResolvedValue({ success: true, data: { summary: '摘要内容' } });
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
    confirmSpy.mockRestore();
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
   * 查找"回到上一级"按钮
   * 按钮的 title 属性以 "backToParent" 开头（mock 的 t 函数返回 "backToParent:标题"）
   * @returns 按钮元素或 null
   */
  const findBackButton = (): HTMLButtonElement | null => {
    return container?.querySelector('button[title^="backToParent"]') as HTMLButtonElement | null;
  };

  it('节点已有摘要时，点击回到上一级应直接切换，不弹出确认框也不生成摘要', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '已有摘要',
      conversationId: 'conv-1',
    });

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    // 已有摘要，不应弹出确认框
    expect(confirmSpy).not.toHaveBeenCalled();
    // 不应调用生成摘要接口
    expect(mockGenerateSummary).not.toHaveBeenCalled();
    // 应直接切换到父节点
    expect(onNodeClick).toHaveBeenCalledWith('root');
  });

  it('节点无摘要且有对话时，点击回到上一级应弹出确认框，用户确认后异步生成摘要并切换到父节点', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '',
      conversationId: 'conv-1',
    });
    confirmSpy.mockReturnValue(true);

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    // 应弹出确认框
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // 应调用生成摘要接口（无激活配置时传入 undefined）
    expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    expect(mockGenerateSummary).toHaveBeenCalledWith('child', undefined, 'zh');
    // 无论摘要是否生成完成，都应切换到父节点
    expect(onNodeClick).toHaveBeenCalledWith('root');

    // 等待异步生成摘要完成后，验证 updateNode 被调用以更新节点摘要
    await act(async () => {
      await vi.waitFor(() => {
        expect(mockUpdateNode).toHaveBeenCalledWith('child', { summary: '摘要内容' });
      });
    });
  });

  it('节点无摘要且有对话时，用户取消确认框后应直接切换，不生成摘要', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '',
      conversationId: 'conv-1',
    });
    confirmSpy.mockReturnValue(false);

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    // 应弹出确认框
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // 用户取消，不应调用生成摘要接口
    expect(mockGenerateSummary).not.toHaveBeenCalled();
    // 仍应切换到父节点
    expect(onNodeClick).toHaveBeenCalledWith('root');
  });

  it('节点无摘要且无对话时，点击回到上一级应直接切换，不弹出确认框', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '',
      conversationId: null,
    });

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    // 无对话内容，不应弹出确认框
    expect(confirmSpy).not.toHaveBeenCalled();
    // 不应调用生成摘要接口
    expect(mockGenerateSummary).not.toHaveBeenCalled();
    // 应直接切换到父节点
    expect(onNodeClick).toHaveBeenCalledWith('root');
  });

  it('生成摘要失败时应静默处理错误，仍切换到父节点且不更新节点摘要', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '',
      conversationId: 'conv-1',
    });
    confirmSpy.mockReturnValue(true);
    mockGenerateSummary.mockRejectedValue(new Error('网络异常'));

    // 捕获 console.error 以验证静默处理并避免测试输出污染
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    // 即使生成失败，也应切换到父节点
    expect(onNodeClick).toHaveBeenCalledWith('root');

    // 等待 catch 回调执行，验证错误被记录
    await act(async () => {
      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[MindMapThumbnail] 离开时生成摘要失败:',
          expect.any(Error)
        );
      });
    });

    // 不应调用 updateNode（因为生成失败）
    expect(mockUpdateNode).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('用户配置了 API Key 时，生成摘要应携带配置参数', async () => {
    const onNodeClick = vi.fn();
    const { nodes, relations } = createTestTree({
      summary: '',
      conversationId: 'conv-1',
    });
    confirmSpy.mockReturnValue(true);
    mockGetActiveConfig.mockReturnValue({
      id: 'cfg-1',
      name: '测试配置',
      provider: 'openai',
      modelId: 'gpt-4',
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.test.com',
    });

    await renderElement(
      <MindMapThumbnail
        nodes={nodes}
        relations={relations}
        activeNodeId="child"
        onNodeClick={onNodeClick}
      />
    );

    const backButton = findBackButton();
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    expect(mockGenerateSummary).toHaveBeenCalledWith(
      'child',
      {
        model: 'gpt-4',
        provider: 'openai',
        apiKey: 'sk-test-key',
        baseUrl: 'https://api.test.com',
      },
      'zh'
    );
    expect(onNodeClick).toHaveBeenCalledWith('root');
  });
});
