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
  /** 预置的引导问题（可选），用于自动发起AI对话 */
  presetQuestion?: string;
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
 * 每个节点都包含预置问题，用于自动发起AI对话。
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
        presetQuestion: '请详细介绍 DeepMindMap 的核心功能和使用方法，包括如何创建思维导图、如何与AI对话、如何使用延伸方向按钮等功能',
      },
      {
        title: '什么是非线性对话',
        summary: '主线和支线分离，深入不偏离',
        isRoot: false,
        presetQuestion: '请解释什么是非线性对话，它与传统线性对话有什么区别，为什么非线性对话更适合知识探索',
      },
      {
        title: '延伸方向按钮',
        summary: '点击 AI 回答末尾的方向按钮，自动创建子节点',
        isRoot: false,
        presetQuestion: '请详细讲解延伸方向按钮的工作原理和使用场景，包括如何点击按钮创建子节点、如何管理多个延伸方向',
      },
      {
        title: '节点摘要',
        summary: '聊完支线后生成摘要，知识自动沉淀',
        isRoot: false,
        presetQuestion: '请介绍节点摘要功能，包括摘要是如何生成的、摘要的作用是什么、如何利用摘要快速回顾对话内容',
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
        presetQuestion: '请为Python初学者提供一份完整的学习路线图，包括推荐的学习资源、实践项目和学习建议',
      },
      {
        title: '基础语法',
        summary: '变量、数据类型、控制流',
        isRoot: false,
        presetQuestion: '请系统讲解Python基础语法，包括变量、数据类型、控制流、函数，并提供示例代码',
      },
      {
        title: '函数与模块',
        summary: '定义函数、导入模块、作用域',
        isRoot: false,
        presetQuestion: '请深入讲解Python函数与模块，包括函数定义、参数传递、作用域、模块导入、包管理',
      },
      {
        title: '面向对象编程',
        summary: '类、继承、多态、封装',
        isRoot: false,
        presetQuestion: '请详细讲解Python面向对象编程，包括类定义、继承、多态、封装、魔术方法，并提供实际应用示例',
      },
      {
        title: '常用标准库',
        summary: 'os、sys、json、datetime 等',
        isRoot: false,
        presetQuestion: '请介绍Python常用标准库，包括os、sys、json、datetime、collections、itertools等，每个库提供典型使用场景和代码示例',
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
        presetQuestion: '请提供一个系统化的产品需求分析框架，包括分析步骤、常用工具、评估维度和输出物',
      },
      {
        title: '用户画像与场景',
        summary: '目标用户是谁，在什么场景下使用',
        isRoot: false,
        presetQuestion: '请详细讲解如何进行用户画像分析和使用场景梳理，包括用户调研方法、画像模板、场景描述技巧',
      },
      {
        title: '核心功能拆解',
        summary: 'MVP 功能列表和优先级',
        isRoot: false,
        presetQuestion: '请讲解如何拆解产品核心功能，包括MVP定义、功能优先级排序、用户故事编写、功能依赖分析',
      },
      {
        title: '竞品分析',
        summary: '对比竞品优劣势，找到差异化',
        isRoot: false,
        presetQuestion: '请详细讲解竞品分析的方法论，包括竞品选择、分析维度、SWOT分析、差异化定位策略',
      },
      {
        title: '技术可行性评估',
        summary: '技术方案选型和风险点',
        isRoot: false,
        presetQuestion: '请讲解如何进行技术可行性评估，包括技术选型、架构设计、性能评估、风险识别、开发成本估算',
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
        presetQuestion: '请系统介绍机器学习的核心概念，包括学习类型、算法分类、应用场景和发展趋势',
      },
      {
        title: '监督学习',
        summary: '分类与回归，标注数据驱动',
        isRoot: false,
        presetQuestion: '请深入讲解监督学习，包括分类与回归的区别、常用算法（线性回归、决策树、SVM、神经网络）、模型训练流程、评估指标',
      },
      {
        title: '无监督学习',
        summary: '聚类与降维，发现数据结构',
        isRoot: false,
        presetQuestion: '请详细讲解无监督学习，包括聚类算法（K-means、DBSCAN）、降维方法（PCA、t-SNE）、异常检测、应用场景',
      },
      {
        title: '模型评估',
        summary: '准确率、精确率、召回率、F1',
        isRoot: false,
        presetQuestion: '请系统讲解机器学习模型评估方法，包括准确率、精确率、召回率、F1分数、ROC曲线、交叉验证、过拟合检测',
      },
      {
        title: '过拟合与正则化',
        summary: '偏差-方差权衡，L1/L2 正则',
        isRoot: false,
        presetQuestion: '请深入讲解过拟合与正则化，包括偏差-方差权衡、L1/L2正则化原理、Dropout、早停法、数据增强等防止过拟合的方法',
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
        presetQuestion: '请提供一个完整的创业想法验证清单，包括验证步骤、关键指标、常见陷阱和成功案例',
      },
      {
        title: '问题验证',
        summary: '是否解决真实痛点？市场有多大？',
        isRoot: false,
        presetQuestion: '请详细讲解如何验证创业问题，包括用户访谈方法、痛点验证、市场规模评估、竞争格局分析',
      },
      {
        title: '解决方案设计',
        summary: 'MVP 是什么？核心价值主张？',
        isRoot: false,
        presetQuestion: '请讲解如何设计创业解决方案，包括MVP定义、核心价值主张提炼、用户故事编写、原型设计方法',
      },
      {
        title: '商业模式',
        summary: '如何赚钱？获客成本？LTV？',
        isRoot: false,
        presetQuestion: '请详细讲解创业商业模式设计，包括盈利模式、获客成本（CAC）、用户终身价值（LTV）、单位经济模型、定价策略',
      },
      {
        title: '风险评估',
        summary: '技术、市场、团队、资金风险',
        isRoot: false,
        presetQuestion: '请系统讲解创业风险评估，包括技术风险、市场风险、团队风险、资金风险、竞争风险，以及风险应对策略',
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
