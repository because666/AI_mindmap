/**
 * createMapFromTemplate 单元测试
 *
 * 覆盖从模板创建思维导图的正常流程、异常流程、边界情况，
 * 包括节点生成、关系建立、父子关系数组更新、根节点选中、埋点上报等核心逻辑。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 使用 vi.hoisted 确保 mock 函数在 vi.mock 工厂执行前已初始化
const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}));

// Mock tracker 模块（提供 track 函数和事件常量）
vi.mock('../services/tracker', () => ({
  track: mockTrack,
  tracker: { track: mockTrack },
  TRACK_EVENT_NODE_CREATED: 'node_created',
  TRACK_EVENT_TEMPLATE_USED: 'template_used',
  TRACK_EVENT_PAGE_VIEW: 'page_view',
  TRACK_EVENT_BRANCH_CREATED: 'branch_created',
  TRACK_EVENT_EXTENSION_DIRECTION_CLICK: 'extension_direction_click',
  TRACK_EVENT_SUMMARY_GENERATED: 'summary_generated',
  TRACK_EVENT_MAP_CREATED: 'map_created',
  TRACK_EVENT_BRANCH_SUGGESTION_SHOWN: 'branch_suggestion_shown',
  TRACK_EVENT_BRANCH_SUGGESTION_ACCEPTED: 'branch_suggestion_accepted',
  TRACK_EVENT_BRANCH_SUGGESTION_DISMISSED: 'branch_suggestion_dismissed',
  Tracker: class MockTracker {},
}));

// Mock api 模块（避免实际网络请求）
vi.mock('../services/api', () => ({
  nodeApi: {
    create: vi.fn().mockResolvedValue({}),
    createChild: vi.fn().mockResolvedValue({}),
    createRelation: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteRelation: vi.fn().mockResolvedValue({}),
  },
  getLocalWorkspaceId: () => 'test-workspace',
  getLocalVisitorId: () => 'test-visitor',
  httpClient: {
    post: vi.fn().mockResolvedValue({ success: true }),
    get: vi.fn().mockResolvedValue({}),
  },
}));

// Mock i18next，t() 直接返回 key 便于断言
vi.mock('i18next', () => ({
  default: {
    t: (key: string) => key,
  },
}));

import { useAppStore } from './appStore';
import { BUILTIN_TEMPLATES, type TemplateData } from '../data/templates';
import { TRACK_EVENT_TEMPLATE_USED } from '../services/tracker';
import type { NodeData } from './nodeStore';

/**
 * 重置聚合 Store 状态到初始空状态
 * 在每个测试用例执行前调用，确保测试间状态隔离
 */
function resetStoreState(): void {
  useAppStore.setState({
    nodes: new Map<string, NodeData>(),
    relations: [],
    conversations: new Map(),
    selectedNodeId: null,
    hoveredNodeId: null,
    manuallyTitledNodeIds: new Set<string>(),
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    searchQuery: '',
    searchResults: [],
  });
}

describe('createMapFromTemplate - 正常流程', () => {
  beforeEach(() => {
    resetStoreState();
    mockTrack.mockReset();
  });

  it('应根据模板创建所有节点', () => {
    const template = BUILTIN_TEMPLATES[0]; // guide-deepmindmap，4 个节点
    const rootId = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    expect(state.nodes.size).toBe(template.nodes.length);
    expect(rootId).toBeTruthy();
    expect(typeof rootId).toBe('string');
  });

  it('应返回根节点 ID 并选中根节点', () => {
    const template = BUILTIN_TEMPLATES[0];
    const rootId = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    expect(rootId).toBeTruthy();
    expect(state.selectedNodeId).toBe(rootId);
    const rootNode = state.nodes.get(rootId);
    expect(rootNode).toBeDefined();
    expect(rootNode?.isRoot).toBe(true);
  });

  it('节点的 title 与 summary 应与模板一致（summary 缺省时为空字符串）', () => {
    const template = BUILTIN_TEMPLATES[0];
    useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    template.nodes.forEach((templateNode) => {
      // 在 store 中查找标题匹配的节点
      const matchedNode = Array.from(state.nodes.values()).find(
        (n) => n.title === templateNode.title
      );
      expect(matchedNode).toBeDefined();
      expect(matchedNode?.summary).toBe(templateNode.summary ?? '');
    });
  });

  it('节点的默认字段应正确（type=default, isComposite=false, hidden=false, expanded=true）', () => {
    const template = BUILTIN_TEMPLATES[0];
    useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    state.nodes.forEach((node) => {
      expect(node.type).toBe('default');
      expect(node.isComposite).toBe(false);
      expect(node.hidden).toBe(false);
      expect(node.expanded).toBe(true);
      expect(node.conversationId).toBeNull();
      expect(node.tags).toEqual([]);
    });
  });

  it('根节点位置应为 (100, 100)', () => {
    const template = BUILTIN_TEMPLATES[0];
    const rootId = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();
    const rootNode = state.nodes.get(rootId);

    expect(rootNode?.position).toEqual({ x: 100, y: 100 });
  });

  it('子节点位置应为第一层布局（x=400, y=100+index*120）', () => {
    const template = BUILTIN_TEMPLATES[0];
    useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    // 找到所有非根节点，按创建顺序（模板索引）校验位置
    const nonRootNodes = Array.from(state.nodes.values()).filter((n) => !n.isRoot);
    // 模板中非根节点的索引为 1,2,3
    const expectedIndices = [1, 2, 3];
    nonRootNodes.forEach((node, i) => {
      const idx = expectedIndices[i];
      expect(node.position.x).toBe(400);
      expect(node.position.y).toBe(100 + idx * 120);
    });
  });

  it('应根据模板创建所有关系', () => {
    const template = BUILTIN_TEMPLATES[1]; // learn-python，包含 parent-child 和 prerequisite
    useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    expect(state.relations.length).toBe(template.relations.length);
  });

  it('parent-child 关系应更新节点的 parentIds 与 childrenIds', () => {
    const template = BUILTIN_TEMPLATES[0]; // guide-deepmindmap，3 条 parent-child
    const rootId = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    const rootNode = state.nodes.get(rootId);
    expect(rootNode).toBeDefined();
    // 根节点应有 3 个子节点
    expect(rootNode?.childrenIds.length).toBe(3);

    // 每个子节点的 parentIds 应包含根节点 ID
    const childNodes = Array.from(state.nodes.values()).filter((n) => !n.isRoot);
    childNodes.forEach((child) => {
      expect(child.parentIds).toContain(rootId);
    });
  });

  it('非 parent-child 关系不应更新节点的 parentIds/childrenIds', () => {
    // learn-python 模板包含 prerequisite 关系（source=1, target=2）
    const template = BUILTIN_TEMPLATES[1];
    useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    // 找到 prerequisite 关系的源节点和目标节点
    const prerequisiteRelation = state.relations.find((r) => r.type === 'prerequisite');
    expect(prerequisiteRelation).toBeDefined();

    const sourceNode = state.nodes.get(prerequisiteRelation!.sourceId);
    const targetNode = state.nodes.get(prerequisiteRelation!.targetId);

    // prerequisite 关系不应建立父子关系
    expect(sourceNode?.childrenIds).not.toContain(prerequisiteRelation!.targetId);
    expect(targetNode?.parentIds).not.toContain(prerequisiteRelation!.sourceId);
  });

  it('应上报 TRACK_EVENT_TEMPLATE_USED 埋点（templateId、templateName）', () => {
    const template = BUILTIN_TEMPLATES[0];
    useAppStore.getState().createMapFromTemplate(template);

    // 验证 track 被调用，且包含 template_used 事件和正确的载荷
    const templateUsedCall = mockTrack.mock.calls.find(
      (call) => call[0] === TRACK_EVENT_TEMPLATE_USED
    );
    expect(templateUsedCall).toBeDefined();
    expect(templateUsedCall![1]).toEqual({
      templateId: template.id,
      templateName: template.name,
    });
  });

  it('应对所有内置模板正常创建地图', () => {
    BUILTIN_TEMPLATES.forEach((template) => {
      resetStoreState();
      const rootId = useAppStore.getState().createMapFromTemplate(template);
      const state = useAppStore.getState();

      expect(state.nodes.size).toBe(template.nodes.length);
      expect(state.relations.length).toBe(template.relations.length);
      expect(rootId).toBeTruthy();
      expect(state.selectedNodeId).toBe(rootId);
    });
  });
});

describe('createMapFromTemplate - 边界情况', () => {
  beforeEach(() => {
    resetStoreState();
    mockTrack.mockReset();
  });

  it('模板无节点时应返回空字符串且不创建节点', () => {
    const emptyTemplate: TemplateData = {
      id: 'empty-template',
      name: '空模板',
      description: '无节点的模板',
      icon: '📭',
      category: 'guide',
      nodes: [],
      relations: [],
    };

    const rootId = useAppStore.getState().createMapFromTemplate(emptyTemplate);
    const state = useAppStore.getState();

    expect(rootId).toBe('');
    expect(state.nodes.size).toBe(0);
    expect(state.relations.length).toBe(0);
    expect(state.selectedNodeId).toBeNull();
  });

  it('模板无关系时应仅创建节点（无关系）', () => {
    const noRelationTemplate: TemplateData = {
      id: 'no-relation',
      name: '无关系模板',
      description: '只有节点没有关系',
      icon: '🧩',
      category: 'guide',
      nodes: [
        { title: '根节点', isRoot: true },
        { title: '子节点 A', isRoot: false },
      ],
      relations: [],
    };

    const rootId = useAppStore.getState().createMapFromTemplate(noRelationTemplate);
    const state = useAppStore.getState();

    expect(state.nodes.size).toBe(2);
    expect(state.relations.length).toBe(0);
    expect(state.selectedNodeId).toBe(rootId);
    // 无关系时根节点的 childrenIds 应为空
    const rootNode = state.nodes.get(rootId);
    expect(rootNode?.childrenIds).toEqual([]);
  });

  it('模板无根节点时应返回空字符串', () => {
    const noRootTemplate: TemplateData = {
      id: 'no-root',
      name: '无根节点模板',
      description: '没有根节点的模板',
      icon: '❓',
      category: 'guide',
      nodes: [
        { title: '节点 A', isRoot: false },
        { title: '节点 B', isRoot: false },
      ],
      relations: [{ source: 0, target: 1, type: 'parent-child' }],
    };

    const rootId = useAppStore.getState().createMapFromTemplate(noRootTemplate);
    const state = useAppStore.getState();

    // 无根节点时 rootId 为空字符串，但仍会创建节点和关系
    expect(rootId).toBe('');
    expect(state.nodes.size).toBe(2);
    expect(state.relations.length).toBe(1);
    // selectedNodeId 不会被设置（因为 rootId 为空）
    expect(state.selectedNodeId).toBeNull();
  });

  it('关系索引越界时应跳过无效关系', () => {
    const invalidRelationTemplate: TemplateData = {
      id: 'invalid-relation',
      name: '越界关系模板',
      description: '包含越界关系索引的模板',
      icon: '⚠️',
      category: 'guide',
      nodes: [
        { title: '根节点', isRoot: true },
        { title: '子节点', isRoot: false },
      ],
      // source=5 越界（只有 2 个节点），应被跳过
      relations: [
        { source: 0, target: 1, type: 'parent-child' },
        { source: 5, target: 1, type: 'parent-child' },
        { source: 0, target: 10, type: 'parent-child' },
      ],
    };

    const rootId = useAppStore.getState().createMapFromTemplate(invalidRelationTemplate);
    const state = useAppStore.getState();

    expect(rootId).toBeTruthy();
    expect(state.nodes.size).toBe(2);
    // 只有第一条关系有效，后两条因索引越界被跳过
    expect(state.relations.length).toBe(1);
  });

  it('summary 为 undefined 时应默认为空字符串', () => {
    const noSummaryTemplate: TemplateData = {
      id: 'no-summary',
      name: '无摘要模板',
      description: '节点无 summary 字段',
      icon: '📝',
      category: 'guide',
      nodes: [
        { title: '根节点', isRoot: true },
        { title: '无摘要子节点', isRoot: false },
      ],
      relations: [{ source: 0, target: 1, type: 'parent-child' }],
    };

    useAppStore.getState().createMapFromTemplate(noSummaryTemplate);
    const state = useAppStore.getState();

    state.nodes.forEach((node) => {
      expect(node.summary).toBe('');
    });
  });
});

describe('createMapFromTemplate - 异常处理', () => {
  beforeEach(() => {
    resetStoreState();
    mockTrack.mockReset();
  });

  it('addRelation 抛出异常时应被捕获，console.error 被调用，返回空字符串', () => {
    const template = BUILTIN_TEMPLATES[0];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 覆盖 addRelation 使其抛出异常
    const originalAddRelation = useAppStore.getState().addRelation;
    useAppStore.setState({
      addRelation: (() => {
        throw new Error('模拟 addRelation 异常');
      }) as never,
    });

    const rootId = useAppStore.getState().createMapFromTemplate(template);

    // 异常被捕获，返回空字符串
    expect(rootId).toBe('');
    // console.error 被调用
    expect(consoleErrorSpy).toHaveBeenCalled();
    // 错误日志包含模块标识
    const errorCall = consoleErrorSpy.mock.calls[0];
    expect(errorCall[0]).toContain('[nodeStore]');

    // 恢复
    consoleErrorSpy.mockRestore();
    useAppStore.setState({ addRelation: originalAddRelation });
  });

  it('正常执行时不应调用 console.error（针对模板创建逻辑）', () => {
    const template = BUILTIN_TEMPLATES[0];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    useAppStore.getState().createMapFromTemplate(template);

    // 正常流程不应有 [nodeStore] 从模板创建 开头的错误日志
    const nodeStoreErrors = consoleErrorSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('[nodeStore] 从模板创建')
    );
    expect(nodeStoreErrors).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });
});
