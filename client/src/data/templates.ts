/**
 * 内置思维导图模板数据
 *
 * 提供模板节点/关系的类型定义、5 个内置模板数据，以及按分类/ID 查询模板的工具函数。
 * 模板用于在创建新思维导图时，为用户提供预设的结构化起点，降低空白画布带来的认知成本。
 *
 * 说明：模板使用节点索引（nodes 数组的下标）引用关系，而非节点 ID，
 * 因为模板节点在导入到实际工作区时会生成新的 ID。
 */
import type { RelationType } from '../stores/relationStore';

/**
 * 模板节点定义
 *
 * 描述模板中单个节点的结构，仅包含展示与初始化所需的字段，
 * 不携带运行时状态（如 ID、位置、会话 ID 等），这些字段在导入时由节点 Store 补全。
 */
export interface TemplateNode {
  /** 节点标题 */
  title: string;
  /** 节点摘要（可选，用于引导用户） */
  summary?: string;
  /** 是否为根节点 */
  isRoot: boolean;
}

/**
 * 模板关系定义（用节点索引引用）
 *
 * 通过 source/target 在 nodes 数组中的下标引用节点，
 * 避免在模板中硬编码节点 ID。
 */
export interface TemplateRelation {
  /** 源节点在 nodes 数组中的索引 */
  source: number;
  /** 目标节点在 nodes 数组中的索引 */
  target: number;
  /** 关系类型 */
  type: RelationType;
}

/**
 * 模板数据
 *
 * 一个完整的思维导图模板，包含元信息、节点列表与关系列表。
 */
export interface TemplateData {
  /** 模板唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板图标（emoji） */
  icon: string;
  /** 模板分类 */
  category: 'guide' | 'learning' | 'work' | 'research';
  /** 节点列表 */
  nodes: TemplateNode[];
  /** 关系列表 */
  relations: TemplateRelation[];
}

/**
 * 内置模板列表
 *
 * 包含 5 个预置模板，覆盖使用指南、学习路径、工作框架等场景。
 */
export const BUILTIN_TEMPLATES: TemplateData[] = [
  {
    id: 'guide-deepmindmap',
    name: 'DeepMindMap 使用指南',
    description: '快速了解 DeepMindMap 的核心功能与使用方法',
    icon: '🗺️',
    category: 'guide',
    nodes: [
      {
        title: 'DeepMindMap 使用指南',
        summary: '了解如何用非线性对话探索知识',
        isRoot: true,
      },
      {
        title: '什么是非线性对话',
        summary: '主线和支线分离，深入不偏离',
        isRoot: false,
      },
      {
        title: '延伸方向按钮',
        summary: '点击 AI 回答末尾的方向按钮，自动创建子节点',
        isRoot: false,
      },
      {
        title: '节点摘要',
        summary: '聊完支线后生成摘要，知识自动沉淀',
        isRoot: false,
      },
    ],
    relations: [
      { source: 0, target: 1, type: 'parent-child' },
      { source: 0, target: 2, type: 'parent-child' },
      { source: 0, target: 3, type: 'parent-child' },
    ],
  },
  {
    id: 'learn-python',
    name: 'Python 入门学习路径',
    description: '从基础语法到标准库的 Python 学习路线图',
    icon: '🐍',
    category: 'learning',
    nodes: [
      {
        title: 'Python 入门学习路径',
        isRoot: true,
      },
      {
        title: '基础语法',
        summary: '变量、数据类型、控制流',
        isRoot: false,
      },
      {
        title: '函数与模块',
        summary: '定义函数、导入模块、作用域',
        isRoot: false,
      },
      {
        title: '面向对象编程',
        summary: '类、继承、多态、封装',
        isRoot: false,
      },
      {
        title: '常用标准库',
        summary: 'os、sys、json、datetime 等',
        isRoot: false,
      },
    ],
    relations: [
      { source: 0, target: 1, type: 'parent-child' },
      { source: 0, target: 2, type: 'parent-child' },
      { source: 0, target: 3, type: 'parent-child' },
      { source: 0, target: 4, type: 'parent-child' },
      { source: 1, target: 2, type: 'prerequisite' },
    ],
  },
  {
    id: 'work-product-analysis',
    name: '产品需求分析框架',
    description: '系统化的产品需求分析与评估框架',
    icon: '📋',
    category: 'work',
    nodes: [
      {
        title: '产品需求分析框架',
        isRoot: true,
      },
      {
        title: '用户画像与场景',
        summary: '目标用户是谁，在什么场景下使用',
        isRoot: false,
      },
      {
        title: '核心功能拆解',
        summary: 'MVP 功能列表和优先级',
        isRoot: false,
      },
      {
        title: '竞品分析',
        summary: '对比竞品优劣势，找到差异化',
        isRoot: false,
      },
      {
        title: '技术可行性评估',
        summary: '技术方案选型和风险点',
        isRoot: false,
      },
    ],
    relations: [
      { source: 0, target: 1, type: 'parent-child' },
      { source: 0, target: 2, type: 'parent-child' },
      { source: 0, target: 3, type: 'parent-child' },
      { source: 0, target: 4, type: 'parent-child' },
      { source: 2, target: 4, type: 'prerequisite' },
    ],
  },
  {
    id: 'learn-ml-basics',
    name: '机器学习基础概念',
    description: '梳理机器学习核心概念与评估方法',
    icon: '🤖',
    category: 'learning',
    nodes: [
      {
        title: '机器学习基础概念',
        isRoot: true,
      },
      {
        title: '监督学习',
        summary: '分类与回归，标注数据驱动',
        isRoot: false,
      },
      {
        title: '无监督学习',
        summary: '聚类与降维，发现数据结构',
        isRoot: false,
      },
      {
        title: '模型评估',
        summary: '准确率、精确率、召回率、F1',
        isRoot: false,
      },
      {
        title: '过拟合与正则化',
        summary: '偏差-方差权衡，L1/L2 正则',
        isRoot: false,
      },
    ],
    relations: [
      { source: 0, target: 1, type: 'parent-child' },
      { source: 0, target: 2, type: 'parent-child' },
      { source: 0, target: 3, type: 'parent-child' },
      { source: 0, target: 4, type: 'parent-child' },
      { source: 1, target: 3, type: 'prerequisite' },
      { source: 2, target: 3, type: 'prerequisite' },
    ],
  },
  {
    id: 'work-startup-checklist',
    name: '创业想法验证清单',
    description: '从问题验证到风险评估的创业检查清单',
    icon: '🚀',
    category: 'work',
    nodes: [
      {
        title: '创业想法验证清单',
        isRoot: true,
      },
      {
        title: '问题验证',
        summary: '是否解决真实痛点？市场有多大？',
        isRoot: false,
      },
      {
        title: '解决方案设计',
        summary: 'MVP 是什么？核心价值主张？',
        isRoot: false,
      },
      {
        title: '商业模式',
        summary: '如何赚钱？获客成本？LTV？',
        isRoot: false,
      },
      {
        title: '风险评估',
        summary: '技术、市场、团队、资金风险',
        isRoot: false,
      },
    ],
    relations: [
      { source: 0, target: 1, type: 'parent-child' },
      { source: 0, target: 2, type: 'parent-child' },
      { source: 0, target: 3, type: 'parent-child' },
      { source: 0, target: 4, type: 'parent-child' },
      { source: 1, target: 2, type: 'prerequisite' },
      { source: 2, target: 3, type: 'prerequisite' },
    ],
  },
];

/**
 * 根据分类获取模板列表
 *
 * @param category - 模板分类，取值为 'guide' | 'learning' | 'work' | 'research'
 * @returns 返回匹配该分类的所有模板数组，未匹配时返回空数组
 */
export function getTemplatesByCategory(
  category: TemplateData['category'],
): TemplateData[] {
  return BUILTIN_TEMPLATES.filter((t) => t.category === category);
}

/**
 * 根据 ID 获取模板
 *
 * @param id - 模板唯一标识
 * @returns 返回匹配的模板对象，未找到时返回 undefined
 */
export function getTemplateById(id: string): TemplateData | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
