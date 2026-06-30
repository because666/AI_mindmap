/**
 * createMapFromTemplate 单元测试
 *
 * 覆盖从模板创建思维导图的正常流程、异常流程、边界情况，
 * 包括节点生成、关系建立、父子关系数组更新、根节点选中、埋点上报等核心逻辑。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 使用 vi.hoisted 确保 mock 函数在 vi.mock 工厂执行前已初始化
const { mockTrack, mockGetPresetAnswer } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
  mockGetPresetAnswer: vi.fn(),
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
  conversationApi: {
    getByNodeId: vi.fn().mockResolvedValue({ success: true, data: { id: 'mock-conv-id' } }),
    sendMessage: vi.fn().mockResolvedValue({ success: true, data: { userMessage: '问题', assistantMessage: '回答' } }),
    // saveMessage 默认返回成功，便于在测试中按需覆盖返回值
    saveMessage: vi.fn().mockResolvedValue({
      success: true,
      data: { _id: 'mock-msg-id', role: 'user', content: '', timestamp: '' },
    }),
  },
  getLocalWorkspaceId: () => 'test-workspace',
  getLocalVisitorId: () => 'test-visitor',
  httpClient: {
    post: vi.fn().mockResolvedValue({ success: true }),
    get: vi.fn().mockResolvedValue({}),
  },
}));

// Mock templateAnswers 模块，getPresetAnswer 由可控的 mockGetPresetAnswer 提供
// 便于在每个测试用例中按需返回不同的预设答案（含空答案、非空答案等场景）
vi.mock('../data/templateAnswers', () => ({
  getPresetAnswer: mockGetPresetAnswer,
}));

// Mock i18next，t() 直接返回 key 便于断言；language 默认为 'zh'
vi.mock('i18next', () => ({
  default: {
    t: (key: string) => key,
    language: 'zh',
  },
}));

import { useAppStore } from './appStore';
import { BUILTIN_TEMPLATES, type TemplateData } from '../data/templates';
import type { PresetAnswer } from '../data/templateAnswers';
import { conversationApi } from '../services/api';
import { TRACK_EVENT_TEMPLATE_USED } from '../services/tracker';
import type { NodeData } from './nodeStore';
import i18n from 'i18next';

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
    const result = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    expect(state.nodes.size).toBe(template.nodes.length);
    expect(result.rootId).toBeTruthy();
    expect(typeof result.rootId).toBe('string');
  });

  it('应返回根节点 ID 并选中根节点', () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    expect(result.rootId).toBeTruthy();
    expect(state.selectedNodeId).toBe(result.rootId);
    const rootNode = state.nodes.get(result.rootId);
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
    const result = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();
    const rootNode = state.nodes.get(result.rootId);

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
    const result = useAppStore.getState().createMapFromTemplate(template);
    const state = useAppStore.getState();

    const rootNode = state.nodes.get(result.rootId);
    expect(rootNode).toBeDefined();
    // 根节点应有 3 个子节点
    expect(rootNode?.childrenIds.length).toBe(3);

    // 每个子节点的 parentIds 应包含根节点 ID
    const childNodes = Array.from(state.nodes.values()).filter((n) => !n.isRoot);
    childNodes.forEach((child) => {
      expect(child.parentIds).toContain(result.rootId);
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
      const result = useAppStore.getState().createMapFromTemplate(template);
      const state = useAppStore.getState();

      expect(state.nodes.size).toBe(template.nodes.length);
      expect(state.relations.length).toBe(template.relations.length);
      expect(result.rootId).toBeTruthy();
      expect(state.selectedNodeId).toBe(result.rootId);
    });
  });
});

describe('createMapFromTemplate - 边界情况', () => {
  beforeEach(() => {
    resetStoreState();
    mockTrack.mockReset();
  });

  it('模板无节点时应返回空 rootId 且不创建节点', () => {
    const emptyTemplate: TemplateData = {
      id: 'empty-template',
      name: '空模板',
      description: '无节点的模板',
      icon: '📭',
      category: 'guide',
      nodes: [],
      relations: [],
    };

    const result = useAppStore.getState().createMapFromTemplate(emptyTemplate);
    const state = useAppStore.getState();

    expect(result.rootId).toBe('');
    expect(result.nodeIds).toEqual([]);
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

    const result = useAppStore.getState().createMapFromTemplate(noRelationTemplate);
    const state = useAppStore.getState();

    expect(state.nodes.size).toBe(2);
    expect(state.relations.length).toBe(0);
    expect(state.selectedNodeId).toBe(result.rootId);
    // 无关系时根节点的 childrenIds 应为空
    const rootNode = state.nodes.get(result.rootId);
    expect(rootNode?.childrenIds).toEqual([]);
  });

  it('模板无根节点时应返回空 rootId', () => {
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

    const result = useAppStore.getState().createMapFromTemplate(noRootTemplate);
    const state = useAppStore.getState();

    // 无根节点时 rootId 为空字符串，但仍会创建节点和关系
    expect(result.rootId).toBe('');
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

    const result = useAppStore.getState().createMapFromTemplate(invalidRelationTemplate);
    const state = useAppStore.getState();

    expect(result.rootId).toBeTruthy();
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

  it('addRelation 抛出异常时应被捕获，console.error 被调用，返回空 rootId', () => {
    const template = BUILTIN_TEMPLATES[0];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 覆盖 addRelation 使其抛出异常
    const originalAddRelation = useAppStore.getState().addRelation;
    useAppStore.setState({
      addRelation: (() => {
        throw new Error('模拟 addRelation 异常');
      }) as never,
    });

    const result = useAppStore.getState().createMapFromTemplate(template);

    // 异常被捕获，返回空 rootId
    expect(result.rootId).toBe('');
    expect(result.nodeIds).toEqual([]);
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

/**
 * createPresetConversationsForTemplate 单元测试
 *
 * 覆盖预设问答对话写入的正常流程、异常流程、边界情况，
 * 包括：有/无预设答案、空答案跳过、索引越界、取消中断、saveMessage 失败/抛异常、
 * getByNodeId 失败、onProgress 回调、summary 更新、语言选择等核心逻辑。
 */
describe('createPresetConversationsForTemplate - 预设答案写入', () => {
  beforeEach(() => {
    resetStoreState();
    mockTrack.mockReset();
    mockGetPresetAnswer.mockReset();
    // 重置 saveMessage 与 getByNodeId，并重新设置默认成功返回值
    vi.mocked(conversationApi.saveMessage).mockReset();
    vi.mocked(conversationApi.getByNodeId).mockReset();
    // 使用 as never 绕过 AxiosResponse 包装类型断言（运行时已被拦截器剥离）
    vi.mocked(conversationApi.saveMessage).mockResolvedValue({
      success: true,
      data: { _id: 'mock-msg-id', role: 'user', content: '', timestamp: '' },
    } as never);
    vi.mocked(conversationApi.getByNodeId).mockResolvedValue({
      success: true,
      data: { id: 'mock-conv-id' },
    } as never);
    // 确保 i18n.language 默认为 'zh'
    (i18n as unknown as { language: string }).language = 'zh';
  });

  it('有预设答案时应写入用户问题和助手答案并更新 conversationId', async () => {
    const template = BUILTIN_TEMPLATES[0]; // guide-deepmindmap，4 个节点均有 presetQuestion
    const result = useAppStore.getState().createMapFromTemplate(template);

    // 让 getPresetAnswer 返回非空答案
    const fakeAnswer: PresetAnswer = { zh: '预设中文回答', en: 'preset english answer' };
    mockGetPresetAnswer.mockReturnValue({ ...fakeAnswer });

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 4 个节点都有 presetQuestion 且有答案，应全部成功
    expect(successIds).toHaveLength(4);
    // 每个节点应调用 saveMessage 两次（user + assistant）
    expect(conversationApi.saveMessage).toHaveBeenCalledTimes(8);
    // 应调用 getByNodeId 获取 conversationId
    expect(conversationApi.getByNodeId).toHaveBeenCalledTimes(4);

    // 验证节点的 conversationId 已更新
    result.nodeIds.forEach((nodeId) => {
      const node = useAppStore.getState().nodes.get(nodeId);
      expect(node?.conversationId).toBe('mock-conv-id');
    });
  });

  it('应将预设问答同步写入 Store 的 conversations Map', async () => {
    // 使用仅含一个预置问题节点的模板，避免多节点共用同一 conversationId 的覆盖问题
    const singleNodeTemplate: TemplateData = {
      id: 'single-preset',
      name: '单节点预设',
      description: '仅含一个预置问题节点',
      icon: '✅',
      category: 'guide',
      nodes: [
        { title: '根节点', isRoot: true, presetQuestion: '测试问题？', summary: '测试摘要' },
      ],
      relations: [],
    };
    const result = useAppStore.getState().createMapFromTemplate(singleNodeTemplate);

    // 让 saveMessage 返回与传入 content 一致的内容，便于验证消息内容
    let messageCallCount = 0;
    vi.mocked(conversationApi.saveMessage).mockImplementation(async (_nodeId: string, role: string, content: string) => {
      messageCallCount++;
      return {
        success: true,
        data: {
          _id: `mock-msg-id-${messageCallCount}`,
          role,
          content,
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      } as never;
    });

    const fakeAnswer: PresetAnswer = { zh: '预设中文回答', en: 'preset english answer' };
    mockGetPresetAnswer.mockReturnValue({ ...fakeAnswer });

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    const nodeId = result.nodeIds[0];
    const node = useAppStore.getState().nodes.get(nodeId);
    const conversation = useAppStore.getState().conversations.get('mock-conv-id');

    expect(conversation).toBeDefined();
    expect(conversation?.id).toBe('mock-conv-id');
    expect(conversation?.nodeId).toBe(nodeId);
    expect(conversation?.contextConfig).toEqual({
      includeParentHistory: true,
      includeRelatedNodes: [],
    });
    expect(conversation?.messages).toHaveLength(2);
    expect(conversation?.messages[0].role).toBe('user');
    expect(conversation?.messages[0].content).toBe('测试问题？');
    expect(conversation?.messages[0].timestamp).toBeInstanceOf(Date);
    expect(conversation?.messages[1].role).toBe('assistant');
    expect(conversation?.messages[1].content).toBe('预设中文回答');
    expect(conversation?.messages[1].timestamp).toBeInstanceOf(Date);
    expect(node?.conversationId).toBe(conversation?.id);
  });

  it('应按 zh 语言取用答案字段（i18n.language 以 zh 开头）', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);

    // 返回包含不同语言内容的答案，便于验证取用了 zh
    mockGetPresetAnswer.mockImplementation(
      (_templateId: string, nodeIndex: number) => ({
        zh: `中文答案${nodeIndex}`,
        en: `english${nodeIndex}`,
      }),
    );

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 验证 saveMessage 的 assistant 调用使用了中文答案
    const calls = vi.mocked(conversationApi.saveMessage).mock.calls;
    // 过滤出 role='assistant' 的调用
    const assistantCalls = calls.filter((call) => call[1] === 'assistant');
    expect(assistantCalls).toHaveLength(4);
    assistantCalls.forEach((call, idx) => {
      expect(call[2]).toBe(`中文答案${idx}`);
    });
  });

  it('i18n.language 以 en 开头时应取用 en 字段', async () => {
    // 修改 i18n mock 的 language 为英文
    (i18n as unknown as { language: string }).language = 'en-US';

    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);

    mockGetPresetAnswer.mockImplementation(
      (_templateId: string, nodeIndex: number) => ({
        zh: `中文答案${nodeIndex}`,
        en: `english${nodeIndex}`,
      }),
    );

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 验证 saveMessage 的 assistant 调用使用了英文答案
    const calls = vi.mocked(conversationApi.saveMessage).mock.calls;
    const assistantCalls = calls.filter((call) => call[1] === 'assistant');
    expect(assistantCalls).toHaveLength(4);
    assistantCalls.forEach((call, idx) => {
      expect(call[2]).toBe(`english${idx}`);
    });
  });

  it('预设答案为空字符串时应跳过该节点并 console.warn', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);

    // 返回空答案
    mockGetPresetAnswer.mockReturnValue({ zh: '', en: '' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 无成功节点
    expect(successIds).toHaveLength(0);
    // 未调用 saveMessage
    expect(conversationApi.saveMessage).not.toHaveBeenCalled();
    // 每个节点都输出了警告
    expect(warnSpy).toHaveBeenCalledTimes(4);
    // 警告内容包含节点 ID 和模块标识
    expect(warnSpy.mock.calls[0][0]).toContain('[nodeStore]');
    expect(warnSpy.mock.calls[0][0]).toContain('无预设答案');

    warnSpy.mockRestore();
  });

  it('getPresetAnswer 返回 null 时应跳过该节点并 console.warn', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);

    mockGetPresetAnswer.mockReturnValue(null);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    expect(successIds).toHaveLength(0);
    expect(conversationApi.saveMessage).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(4);

    warnSpy.mockRestore();
  });

  it('节点无 presetQuestion 时应跳过（不查询答案、不写入对话）', async () => {
    // 使用没有 presetQuestion 的自定义模板
    const noPresetTemplate: TemplateData = {
      id: 'no-preset',
      name: '无预置问题',
      description: '节点均无 presetQuestion',
      icon: '🚫',
      category: 'guide',
      nodes: [
        { title: '节点A', isRoot: true },
        { title: '节点B', isRoot: false },
      ],
      relations: [{ source: 0, target: 1, type: 'parent-child' }],
    };
    const result = useAppStore.getState().createMapFromTemplate(noPresetTemplate);

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    expect(successIds).toHaveLength(0);
    expect(conversationApi.saveMessage).not.toHaveBeenCalled();
    // 未调用 getPresetAnswer（因为先检查 presetQuestion，无 presetQuestion 时直接 continue）
    expect(mockGetPresetAnswer).not.toHaveBeenCalled();
  });

  it('节点索引越界时应跳过（nodeIds 长度大于 template.nodes）', async () => {
    const template = BUILTIN_TEMPLATES[0]; // 4 个节点
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    // 传入额外的虚假 nodeId（超出 template.nodes 长度）
    const extendedNodeIds = [...result.nodeIds, 'fake-extra-node-id'];
    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      extendedNodeIds,
      result.template,
    );

    // 仅 4 个有效节点成功，第 5 个因索引越界被跳过
    expect(successIds).toHaveLength(4);
  });

  it('shouldContinue 返回 false 时应中断循环', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    let callCount = 0;
    const shouldContinue = (): boolean => {
      callCount++;
      return callCount <= 1; // 第一次返回 true，第二次返回 false
    };

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
      undefined,
      shouldContinue,
    );

    // shouldContinue 在 i=0 时返回 true（处理第 0 个节点），i=1 时返回 false（中断）
    // 因此仅处理了第 0 个节点
    expect(successIds).toHaveLength(1);
  });

  it('saveMessage 返回 success:false 时应跳过并 console.error', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    // saveMessage 返回失败
    vi.mocked(conversationApi.saveMessage).mockResolvedValue({
      success: false,
      data: { _id: '', role: '', content: '', timestamp: '' },
    } as never);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    expect(successIds).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    // 错误日志包含模块标识和失败说明
    const writeUserFailCalls = errorSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('写入用户问题失败')
    );
    expect(writeUserFailCalls.length).toBeGreaterThan(0);

    errorSpy.mockRestore();
  });

  it('saveMessage 抛出异常时应捕获并跳过，不阻塞后续节点', async () => {
    const template = BUILTIN_TEMPLATES[0]; // 4 个节点
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    // 第 1 次（第 0 个节点的 user 写入）抛异常，后续正常
    vi.mocked(conversationApi.saveMessage)
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValue({
        success: true,
        data: { _id: 'mock-msg-id', role: 'user', content: '', timestamp: '' },
      } as never);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 第 0 个节点失败，后 3 个成功
    expect(successIds).toHaveLength(3);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('getByNodeId 抛出异常时应捕获并继续（conversationId 不更新但流程不中断）', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    // getByNodeId 抛异常
    vi.mocked(conversationApi.getByNodeId).mockRejectedValue(new Error('获取对话失败'));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const successIds = await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 4 个节点都成功写入对话（getByNodeId 失败不影响 successIds）
    expect(successIds).toHaveLength(4);
    // 但 conversationId 未更新（仍为 null）
    result.nodeIds.forEach((nodeId) => {
      const node = useAppStore.getState().nodes.get(nodeId);
      expect(node?.conversationId).toBeNull();
    });
    // 获取对话 ID 失败的日志被调用
    const convFailCalls = errorSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('对话ID失败')
    );
    expect(convFailCalls.length).toBe(4);

    errorSpy.mockRestore();
  });

  it('onProgress 回调应针对每个节点被调用', async () => {
    const template = BUILTIN_TEMPLATES[0]; // 4 个节点
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    const onProgress = vi.fn();

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
      onProgress,
    );

    // 4 个节点，每个节点处理完后调用一次 onProgress
    expect(onProgress).toHaveBeenCalledTimes(4);
    // 验证参数：currentIndex 从 0 开始，totalCount 为 4
    expect(onProgress).toHaveBeenLastCalledWith(3, 4);
  });

  it('有 summary 的节点应更新节点 summary', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // guide-deepmindmap 模板的节点都有 summary
    template.nodes.forEach((templateNode, idx) => {
      const nodeId = result.nodeIds[idx];
      const node = useAppStore.getState().nodes.get(nodeId);
      if (templateNode.summary) {
        expect(node?.summary).toBe(templateNode.summary);
      }
    });
  });

  it('不应调用 conversationApi.sendMessage（已改为预设答案写入）', async () => {
    const template = BUILTIN_TEMPLATES[0];
    const result = useAppStore.getState().createMapFromTemplate(template);
    mockGetPresetAnswer.mockReturnValue({ zh: '答案', en: 'answer' });

    await useAppStore.getState().createPresetConversationsForTemplate(
      result.nodeIds,
      result.template,
    );

    // 验证不再调用 sendMessage（已被 saveMessage 替代）
    expect(conversationApi.sendMessage).not.toHaveBeenCalled();
  });
});
