/**
 * 关系 Store（Slice）
 * 负责节点间关系（Relation）的增删改查及关系类型定义。
 *
 * 说明：本文件采用 zustand 的 Slice 模式，导出 createRelationSlice 用于在 appStore 中组合。
 * 状态最终由聚合 Store（useAppStore）统一持有，跨 Slice 的状态依赖通过 get() 访问。
 */
import type { AppState } from './appStore';
import { useAppStore } from './appStore';
import { generateId } from './storeUtils';
import { nodeApi } from '../services/api';
import i18n from 'i18next';

/**
 * 关系类型定义
 */
export type RelationType =
  | 'parent-child'
  | 'supports'
  | 'contradicts'
  | 'prerequisite'
  | 'elaborates'
  | 'references'
  | 'conclusion'
  | 'custom';

/**
 * 关系数据接口
 */
export interface RelationData {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  description?: string;
  createdAt: Date;
}

/**
 * 关系 Slice 状态与方法接口
 */
export interface RelationSlice {
  /** 全部关系列表 */
  relations: RelationData[];
  /** 添加关系 */
  addRelation: (relation: Omit<RelationData, 'id' | 'createdAt'>) => string;
  /** 更新关系 */
  updateRelation: (id: string, updates: Partial<RelationData>) => void;
  /** 删除关系 */
  deleteRelation: (id: string) => void;
  /** 获取节点相关的所有关系 */
  getRelationsForNode: (nodeId: string) => RelationData[];
}

/**
 * Slice 的 set 函数类型（操作聚合 Store 的全量状态）
 */
type SliceSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>)
) => void;

/**
 * Slice 的 get 函数类型（返回聚合 Store 的全量状态）
 */
type SliceGet = () => AppState;

/**
 * 获取关系类型标签映射
 * 使用函数形式以支持 i18n 动态翻译
 * @returns 关系类型标签映射对象
 */
export const getRelationTypeLabels = (): Record<RelationType, { label: string; color: string; description: string }> => ({
  'parent-child': { label: i18n.t('relationParentChild', { ns: 'canvas' }), color: '#2dd4bf', description: i18n.t('relationParentChildDesc', { ns: 'canvas' }) },
  supports: { label: i18n.t('relationSupports', { ns: 'canvas' }), color: '#34d399', description: i18n.t('relationSupportsDesc', { ns: 'canvas' }) },
  contradicts: { label: i18n.t('relationContradicts', { ns: 'canvas' }), color: '#f87171', description: i18n.t('relationContradictsDesc', { ns: 'canvas' }) },
  prerequisite: { label: i18n.t('relationPrerequisite', { ns: 'canvas' }), color: '#fbbf24', description: i18n.t('relationPrerequisiteDesc', { ns: 'canvas' }) },
  elaborates: { label: i18n.t('relationElaborates', { ns: 'canvas' }), color: '#0d9488', description: i18n.t('relationElaboratesDesc', { ns: 'canvas' }) },
  references: { label: i18n.t('relationReferences', { ns: 'canvas' }), color: '#c084fc', description: i18n.t('relationReferencesDesc', { ns: 'canvas' }) },
  conclusion: { label: i18n.t('relationConclusion', { ns: 'canvas' }), color: '#22d3ee', description: i18n.t('relationConclusionDesc', { ns: 'canvas' }) },
  custom: { label: i18n.t('relationCustom', { ns: 'canvas' }), color: '#f59e0b', description: i18n.t('relationCustomDesc', { ns: 'canvas' }) }
});

/** @deprecated 使用 getRelationTypeLabels() 替代，以支持 i18n */
export const RELATION_TYPE_LABELS = getRelationTypeLabels();

/**
 * 迁移关系数据格式
 * 兼容两种输入格式：普通数组和 Map.entries() 格式的 [key, value] 二元组数组
 * @param relations - 原始关系数据，可能是数组、Map entries 或 null/undefined
 * @returns 迁移后的关系数据数组，过滤掉缺少必要字段的无效项
 */
export const migrateRelationsData = (relations: unknown): RelationData[] => {
  if (!relations || !Array.isArray(relations)) return [];

  const arr = relations as unknown[];
  if (arr.length === 0) return [];

  /**
   * 判断值是否为有效的关系数据
   * @param r - 待判断的值
   * @returns 是否为包含 type/id/sourceId/targetId 必要字段的关系数据
   */
  const isValidRelation = (r: unknown): r is RelationData => {
    if (!r || typeof r !== 'object') return false;
    const obj = r as Record<string, unknown>;
    return Boolean(obj.type && obj.id && obj.sourceId && obj.targetId);
  };

  const firstItem = arr[0];
  if (Array.isArray(firstItem) && firstItem.length === 2) {
    return arr
      .map((entry) => (entry as [unknown, unknown])[1])
      .filter(isValidRelation);
  }

  return arr.filter(isValidRelation);
};

/**
 * 创建关系 Slice
 * @param set - 聚合 Store 的 set 函数
 * @param get - 聚合 Store 的 get 函数
 * @returns 关系 Slice 的状态与方法
 */
export const createRelationSlice = (set: SliceSet, get: SliceGet): RelationSlice => ({
  relations: [],

  /**
   * 添加关系
   * @param relation - 关系数据
   * @returns 关系ID
   */
  addRelation: (relation) => {
    const id = generateId();
    const newRelation: RelationData = {
      ...relation,
      id,
      createdAt: new Date()
    };

    const sourceNode = get().nodes.get(relation.sourceId);
    const targetNode = get().nodes.get(relation.targetId);
    const sourceTitle = sourceNode?.title ?? relation.sourceId;
    const targetTitle = targetNode?.title ?? relation.targetId;

    set((state) => ({
      relations: [...state.relations, newRelation]
    }));

    nodeApi.createRelation({
      id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      type: relation.type,
      description: relation.description,
    }).catch((error: unknown) => {
      console.error('[relationStore] 同步创建关系到服务端失败:', error);
    });

    get().pushCommand({
      id: generateId(),
      description: `创建关系: ${sourceTitle} → ${targetTitle}`,
      execute: () => {
        set((state) => ({
          relations: [...state.relations, { ...newRelation }]
        }));
        nodeApi.createRelation({
          id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type,
          description: relation.description,
        }).catch((error: unknown) => {
          console.error('[relationStore] 同步创建关系到服务端失败:', error);
        });
      },
      undo: () => {
        set((state) => ({
          relations: state.relations.filter(r => r.id !== id)
        }));
        nodeApi.deleteRelation(id).catch((error: unknown) => {
          console.error('[relationStore] 同步删除关系到服务端失败:', error);
        });
      },
    });

    return id;
  },

  /**
   * 更新关系
   * @param id - 关系ID
   * @param updates - 更新内容
   */
  updateRelation: (id, updates) => {
    set((state) => ({
      relations: state.relations.map(relation =>
        relation.id === id ? { ...relation, ...updates } : relation
      )
    }));
  },

  /**
   * 删除关系
   * @param id - 关系ID
   */
  deleteRelation: (id) => {
    const relation = get().relations.find(r => r.id === id);
    if (!relation) return;

    const sourceNode = get().nodes.get(relation.sourceId);
    const targetNode = get().nodes.get(relation.targetId);
    const sourceTitle = sourceNode?.title ?? relation.sourceId;
    const targetTitle = targetNode?.title ?? relation.targetId;

    const capturedRelation = { ...relation };

    set((state) => ({
      relations: state.relations.filter(r => r.id !== id)
    }));

    nodeApi.deleteRelation(id).catch((error: unknown) => {
      console.error('[relationStore] 同步删除关系到服务端失败:', error);
    });

    get().pushCommand({
      id: generateId(),
      description: `删除关系: ${sourceTitle} → ${targetTitle}`,
      execute: () => {
        set((state) => ({
          relations: state.relations.filter(r => r.id !== id)
        }));
        nodeApi.deleteRelation(id).catch((error: unknown) => {
          console.error('[relationStore] 同步删除关系到服务端失败:', error);
        });
      },
      undo: () => {
        set((state) => ({
          relations: [...state.relations, capturedRelation]
        }));
        nodeApi.createRelation({
          id: capturedRelation.id,
          sourceId: capturedRelation.sourceId,
          targetId: capturedRelation.targetId,
          type: capturedRelation.type,
          description: capturedRelation.description,
        }).catch((error: unknown) => {
          console.error('[relationStore] 同步恢复关系到服务端失败:', error);
        });
      },
    });
  },

  /**
   * 获取节点相关的所有关系
   * @param nodeId - 节点ID
   * @returns 关系列表
   */
  getRelationsForNode: (nodeId) => {
    return get().relations.filter(
      relation => relation.sourceId === nodeId || relation.targetId === nodeId
    );
  },
});

/**
 * 关系 Slice 便捷 Hook（用于未来逐步迁移组件引用）
 * 调用形式为 useRelationStore(selector)
 *
 * 实现说明：通过 ES Module live binding 引用 useAppStore，循环依赖在运行期安全。
 *
 * @param selector - 选择器函数，从关系 Slice 状态中选取所需片段
 * @returns 选择器返回的值
 */
export function useRelationStore<T>(selector: (s: RelationSlice) => T): T {
  return useAppStore(selector as (s: AppState) => T);
}
