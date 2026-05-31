import { v4 as uuidv4 } from 'uuid';
import { neo4jService } from '../data/neo4j/connection';
import { mongoDBService } from '../data/mongodb/connection';
import { vectorDBService } from '../data/vector/connection';
import { Node, Relation } from '../types';

const DEFAULT_POSITION = { x: 100, y: 100 };

/**
 * 工作区缓存接口
 * 每个工作区独立的缓存条目，包含节点、关系和最后访问时间
 */
interface WorkspaceCache {
  /** 工作区内的节点映射 */
  nodes: Map<string, Node>;
  /** 工作区内的关系列表 */
  relations: Relation[];
  /** 最后访问时间戳（毫秒） */
  lastAccessTime: number;
}

/**
 * 缓存统计接口
 * 提供缓存命中率和容量信息
 */
export interface CacheStats {
  /** 工作区缓存总数 */
  totalWorkspaces: number;
  /** 节点总数 */
  totalNodes: number;
  /** 关系总数 */
  totalRelations: number;
  /** 缓存命中率（0-1之间） */
  hitRate: number;
}

/**
 * 节点服务类
 * 提供节点的CRUD操作和关系管理
 * 所有数据按工作区隔离，使用LRU缓存淘汰策略
 */
class NodeService {
  private workspaceCaches: Map<string, WorkspaceCache> = new Map();
  private nodeToWorkspace: Map<string, string> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private static readonly MAX_WORKSPACES: number = 50;
  private static readonly MAX_TOTAL_NODES: number = 10000;

  /**
   * 获取或创建工作区缓存
   * 如果超过最大工作区数量限制，先执行LRU淘汰再创建新缓存
   * @param workspaceId - 工作区ID
   * @returns 工作区缓存实例
   */
  private getOrCreateWorkspaceCache(workspaceId: string): WorkspaceCache {
    const existing = this.workspaceCaches.get(workspaceId);
    if (existing) {
      existing.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      return existing;
    }

    while (this.workspaceCaches.size >= NodeService.MAX_WORKSPACES) {
      this.evictLRUWorkspace();
    }

    const cache: WorkspaceCache = {
      nodes: new Map(),
      relations: [],
      lastAccessTime: Date.now(),
    };
    this.workspaceCaches.set(workspaceId, cache);
    return cache;
  }

  /**
   * 更新工作区在Map中的访问顺序
   * 通过删除并重新插入将工作区移到Map末尾，实现LRU排序
   * @param workspaceId - 工作区ID
   */
  private touchWorkspace(workspaceId: string): void {
    const cache = this.workspaceCaches.get(workspaceId);
    if (cache) {
      this.workspaceCaches.delete(workspaceId);
      this.workspaceCaches.set(workspaceId, cache);
    }
  }

  /**
   * 淘汰最久未访问的工作区缓存
   * 基于Map的insert-order特性，第一个条目即为最久未访问的工作区
   */
  private evictLRUWorkspace(): void {
    const oldestKey = this.workspaceCaches.keys().next().value;
    if (oldestKey !== undefined) {
      this.clearWorkspaceCache(oldestKey);
    }
  }

  /**
   * 执行节点总数限制淘汰
   * 当节点总数超过限制且存在多个工作区时，逐个淘汰最久未访问的工作区
   * 仅剩一个工作区时停止淘汰，避免清除正在使用的缓存
   */
  private enforceNodeLimit(): void {
    while (this.getTotalNodeCount() > NodeService.MAX_TOTAL_NODES && this.workspaceCaches.size > 1) {
      this.evictLRUWorkspace();
    }
  }

  /**
   * 计算所有工作区缓存中的节点总数
   * @returns 节点总数
   */
  private getTotalNodeCount(): number {
    let total = 0;
    for (const cache of this.workspaceCaches.values()) {
      total += cache.nodes.size;
    }
    return total;
  }

  /**
   * 从缓存中获取节点
   * 通过nodeToWorkspace索引快速定位工作区缓存，命中时更新访问时间
   * @param id - 节点ID
   * @returns 节点数据或null
   */
  private getNodeFromCache(id: string): Node | null {
    const workspaceId = this.nodeToWorkspace.get(id);
    if (!workspaceId) return null;

    const cache = this.workspaceCaches.get(workspaceId);
    if (!cache) {
      this.nodeToWorkspace.delete(id);
      return null;
    }

    const node = cache.nodes.get(id);
    if (node) {
      cache.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      return node;
    }

    this.nodeToWorkspace.delete(id);
    return null;
  }

  /**
   * 将节点添加到对应工作区的缓存中
   * 同时更新nodeToWorkspace索引，并检查节点总数限制
   * @param node - 节点数据
   */
  private addNodeToCache(node: Node): void {
    const normalizedNode: Node = {
      ...node,
      type: node.type || 'default',
    };
    const cache = this.getOrCreateWorkspaceCache(normalizedNode.workspaceId);
    cache.nodes.set(normalizedNode.id, normalizedNode);
    this.nodeToWorkspace.set(normalizedNode.id, normalizedNode.workspaceId);
    this.enforceNodeLimit();
  }

  /**
   * 从缓存中移除指定节点
   * 同时清理nodeToWorkspace索引
   * @param id - 节点ID
   */
  private removeNodeFromCache(id: string): void {
    const workspaceId = this.nodeToWorkspace.get(id);
    if (!workspaceId) return;

    const cache = this.workspaceCaches.get(workspaceId);
    if (cache) {
      cache.nodes.delete(id);
    }
    this.nodeToWorkspace.delete(id);
  }

  /**
   * 创建节点
   * @param nodeData - 节点数据
   * @param workspaceId - 工作区ID
   * @param createdBy - 创建者访客ID
   * @returns 创建的节点
   * @throws 当节点ID已存在时抛出错误
   */
  async createNode(nodeData: Partial<Node>, workspaceId: string, createdBy?: string): Promise<Node> {
    if (nodeData.id && this.nodeToWorkspace.has(nodeData.id)) {
      throw new Error(`节点 ${nodeData.id} 已存在`);
    }

    const node: Node = {
      id: nodeData.id || uuidv4(),
      workspaceId,
      title: nodeData.title?.trim() || '新节点',
      summary: nodeData.summary?.trim() || '',
      type: nodeData.type || 'default',
      isRoot: nodeData.isRoot || false,
      isComposite: nodeData.isComposite || false,
      compositeChildren: nodeData.compositeChildren || [],
      compositeParent: nodeData.compositeParent,
      hidden: nodeData.hidden || false,
      expanded: nodeData.expanded || false,
      conversationId: nodeData.conversationId,
      position: nodeData.position || DEFAULT_POSITION,
      tags: nodeData.tags || [],
      parentIds: nodeData.parentIds || [],
      childrenIds: nodeData.childrenIds || [],
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (neo4jService.isConnected()) {
      try {
        await neo4jService.runQuery(
          `CREATE (n:Node $props)`,
          { props: node }
        );
      } catch (error) {
        console.error('Neo4j创建节点失败:', error);
      }
    }

    this.addNodeToCache(node);
    return node;
  }

  /**
   * 获取节点
   * 优先从缓存获取，未命中则从Neo4j加载并写入缓存
   * @param id - 节点ID
   * @returns 节点数据或null
   */
  async getNode(id: string): Promise<Node | null> {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const cachedNode = this.getNodeFromCache(id);
    if (cachedNode) {
      this.hitCount++;
      return cachedNode;
    }

    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ n: Node }>(
          `MATCH (n:Node {id: $id}) RETURN n`,
          { id }
        );
        if (results.length > 0) {
          const node = results[0].n;
          this.addNodeToCache(node);
          this.missCount++;
          return node;
        }
      } catch (error) {
        console.error('Neo4j获取节点失败:', error);
      }
    }

    this.missCount++;
    return null;
  }

  /**
   * 更新节点
   * @param id - 节点ID
   * @param updates - 更新内容
   * @returns 更新后的节点或null
   */
  async updateNode(id: string, updates: Partial<Node>): Promise<Node | null> {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const existing = await this.getNode(id);
    if (!existing) return null;

    const updated: Node = {
      ...existing,
      ...updates,
      id: existing.id,
      workspaceId: existing.workspaceId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
      updated.title = updates.title.trim() || existing.title;
    }
    if (updates.summary !== undefined) {
      updated.summary = updates.summary.trim();
    }

    if (neo4jService.isConnected()) {
      try {
        await neo4jService.runQuery(
          `MATCH (n:Node {id: $id}) SET n += $props`,
          { id, props: updated }
        );
      } catch (error) {
        console.error('Neo4j更新节点失败:', error);
      }
    }

    this.addNodeToCache(updated);
    return updated;
  }

  /**
   * 删除节点
   * 同时删除所有后代节点和相关关系
   * @param id - 节点ID
   * @returns 是否删除成功
   */
  async deleteNode(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      return false;
    }

    const node = await this.getNode(id);
    if (!node) return false;

    const allChildren = await this.getAllDescendants(id);
    const allIds = [id, ...allChildren.map(c => c.id)];

    if (neo4jService.isConnected()) {
      try {
        for (const nodeId of allIds) {
          await neo4jService.runQuery(
            `MATCH (n:Node {id: $id}) DETACH DELETE n`,
            { id: nodeId }
          );
        }
      } catch (error) {
        console.error('Neo4j删除节点失败:', error);
      }
    }

    const workspaceId = this.nodeToWorkspace.get(id) || node.workspaceId;
    const cache = this.workspaceCaches.get(workspaceId);

    for (const nodeId of allIds) {
      this.removeNodeFromCache(nodeId);
    }

    if (cache) {
      cache.relations = cache.relations.filter(
        r => !allIds.includes(r.sourceId) && !allIds.includes(r.targetId)
      );
    }

    for (const parentId of node.parentIds) {
      const parent = await this.getNode(parentId);
      if (parent) {
        await this.updateNode(parentId, {
          childrenIds: parent.childrenIds.filter(cid => cid !== id),
        });
      }
    }

    return true;
  }

  /**
   * 获取工作区内的所有节点
   * 优先从缓存获取，未命中则从Neo4j加载并批量写入缓存
   * @param workspaceId - 工作区ID
   * @returns 节点列表
   */
  async getAllNodes(workspaceId: string): Promise<Node[]> {
    const cache = this.workspaceCaches.get(workspaceId);
    if (cache && cache.nodes.size > 0) {
      cache.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      this.hitCount++;
      return Array.from(cache.nodes.values());
    }

    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ n: Node }>(
          `MATCH (n:Node {workspaceId: $workspaceId}) RETURN n`,
          { workspaceId }
        );
        if (results.length > 0) {
          const nodes = results.map(r => r.n);
          const targetCache = this.getOrCreateWorkspaceCache(workspaceId);
          for (const node of nodes) {
            targetCache.nodes.set(node.id, node);
            this.nodeToWorkspace.set(node.id, node.workspaceId);
          }
          this.enforceNodeLimit();
          this.missCount++;
          return nodes;
        }
      } catch (error) {
        console.error('Neo4j获取工作区节点失败:', error);
      }
    }

    this.missCount++;
    return [];
  }

  /**
   * 获取节点的所有后代节点
   * @param nodeId - 节点ID
   * @returns 后代节点列表
   */
  async getAllDescendants(nodeId: string): Promise<Node[]> {
    const descendants: Node[] = [];
    const visited = new Set<string>();

    const collect = async (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = await this.getNode(id);
      if (node) {
        for (const childId of node.childrenIds) {
          const child = await this.getNode(childId);
          if (child && !visited.has(childId)) {
            descendants.push(child);
            await collect(childId);
          }
        }
      }
    };

    await collect(nodeId);
    return descendants;
  }

  /**
   * 获取工作区内的根节点
   * @param workspaceId - 工作区ID
   * @returns 根节点列表
   */
  async getRootNodes(workspaceId: string): Promise<Node[]> {
    const nodes = await this.getAllNodes(workspaceId);
    return nodes.filter(n => n.isRoot && !n.hidden);
  }

  /**
   * 创建子节点
   * @param parentId - 父节点ID
   * @param title - 节点标题
   * @param workspaceId - 工作区ID
   * @param createdBy - 创建者访客ID
   * @returns 创建的子节点
   * @throws 当父节点不存在时抛出错误
   */
  async createChildNode(parentId: string, title: string, workspaceId: string, createdBy?: string, childData?: Partial<Node>): Promise<Node> {
    const parent = await this.getNode(parentId);
    if (!parent) {
      throw new Error('父节点不存在');
    }

    const siblingCount = parent.childrenIds.length;
    const defaultPosition = {
      x: parent.position.x + 250,
      y: parent.position.y + siblingCount * 120,
    };

    const child = await this.createNode({
      id: childData?.id,
      title: title.trim() || '新分支',
      parentIds: [parentId],
      position: childData?.position || defaultPosition,
      isRoot: false,
    }, workspaceId, createdBy);

    await this.updateNode(parentId, {
      childrenIds: [...parent.childrenIds, child.id],
    });

    await this.createRelation({
      sourceId: parentId,
      targetId: child.id,
      type: 'parent-child',
    }, workspaceId);

    return child;
  }

  /**
   * 创建关系
   * @param relationData - 关系数据
   * @param workspaceId - 工作区ID
   * @returns 创建的关系
   * @throws 当源节点或目标节点不存在，或ID为空时抛出错误
   */
  async createRelation(relationData: Omit<Relation, 'id' | 'createdAt' | 'workspaceId'> & { id?: string }, workspaceId: string): Promise<Relation> {
    if (!relationData.sourceId || !relationData.targetId) {
      throw new Error('源节点和目标节点ID不能为空');
    }

    const sourceNode = await this.getNode(relationData.sourceId);
    const targetNode = await this.getNode(relationData.targetId);

    if (!sourceNode || !targetNode) {
      throw new Error('源节点或目标节点不存在');
    }

    const cache = this.getOrCreateWorkspaceCache(workspaceId);
    const existingRelation = cache.relations.find(
      r => r.sourceId === relationData.sourceId &&
           r.targetId === relationData.targetId &&
           r.type === relationData.type
    );

    if (existingRelation) {
      return existingRelation;
    }

    const relation: Relation = {
      id: relationData.id || uuidv4(),
      workspaceId,
      sourceId: relationData.sourceId,
      targetId: relationData.targetId,
      type: relationData.type,
      description: relationData.description,
      createdAt: new Date(),
    };

    if (neo4jService.isConnected()) {
      try {
        await neo4jService.runQuery(
          `MATCH (s:Node {id: $sourceId}), (t:Node {id: $targetId})
           CREATE (s)-[r:RELATES_TO $props]->(t)`,
          { sourceId: relation.sourceId, targetId: relation.targetId, props: relation }
        );
      } catch (error) {
        console.error('Neo4j创建关系失败:', error);
      }
    }

    cache.relations.push(relation);
    return relation;
  }

  /**
   * 获取工作区内的所有关系
   * 优先从缓存获取，未命中则从Neo4j加载并写入缓存
   * @param workspaceId - 工作区ID
   * @returns 关系列表
   */
  async getRelations(workspaceId: string): Promise<Relation[]> {
    const cache = this.workspaceCaches.get(workspaceId);
    if (cache && cache.relations.length > 0) {
      cache.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      this.hitCount++;
      return cache.relations;
    }

    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ r: Relation }>(
          `MATCH ()-[r:RELATES_TO {workspaceId: $workspaceId}]->() RETURN r`,
          { workspaceId }
        );
        if (results.length > 0) {
          const relations = results.map(r => r.r);
          const targetCache = this.getOrCreateWorkspaceCache(workspaceId);
          for (const relation of relations) {
            if (!targetCache.relations.find(mr => mr.id === relation.id)) {
              targetCache.relations.push(relation);
            }
          }
          this.enforceNodeLimit();
          this.missCount++;
          return relations;
        }
      } catch (error) {
        console.error('Neo4j获取工作区关系失败:', error);
      }
    }

    this.missCount++;
    return [];
  }

  /**
   * 获取节点相关的所有关系
   * 优先通过nodeToWorkspace索引定位工作区缓存，未命中则遍历所有工作区缓存
   * @param nodeId - 节点ID
   * @returns 关系列表
   */
  async getRelationsForNode(nodeId: string): Promise<Relation[]> {
    if (!nodeId || typeof nodeId !== 'string') {
      return [];
    }

    const workspaceId = this.nodeToWorkspace.get(nodeId);
    if (workspaceId) {
      const cache = this.workspaceCaches.get(workspaceId);
      if (cache) {
        return cache.relations.filter(
          r => r.sourceId === nodeId || r.targetId === nodeId
        );
      }
    }

    const result: Relation[] = [];
    for (const cache of this.workspaceCaches.values()) {
      result.push(...cache.relations.filter(
        r => r.sourceId === nodeId || r.targetId === nodeId
      ));
    }
    return result;
  }

  /**
   * 删除关系
   * 遍历所有工作区缓存查找目标关系，找到后从对应工作区缓存中移除
   * @param id - 关系ID
   * @returns 是否删除成功
   */
  async deleteRelation(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      return false;
    }

    let foundWorkspaceId: string | undefined;
    let foundIndex = -1;

    for (const [workspaceId, cache] of this.workspaceCaches) {
      const index = cache.relations.findIndex(r => r.id === id);
      if (index !== -1) {
        foundWorkspaceId = workspaceId;
        foundIndex = index;
        break;
      }
    }

    if (foundWorkspaceId === undefined || foundIndex === -1) return false;

    if (neo4jService.isConnected()) {
      try {
        await neo4jService.runQuery(
          `MATCH ()-[r:RELATES_TO {id: $id}]->() DELETE r`,
          { id }
        );
      } catch (error) {
        console.error('Neo4j删除关系失败:', error);
      }
    }

    const cache = this.workspaceCaches.get(foundWorkspaceId);
    if (cache) {
      cache.relations.splice(foundIndex, 1);
    }
    return true;
  }

  /**
   * 展开复合节点
   * @param nodeId - 复合节点ID
   * @returns 更新后的节点
   */
  async expandCompositeNode(nodeId: string): Promise<Node | null> {
    const node = await this.getNode(nodeId);
    if (!node || !node.isComposite) {
      return null;
    }

    const isCurrentlyExpanded = node.expanded;

    if (isCurrentlyExpanded) {
      for (const childId of node.compositeChildren || []) {
        await this.updateNode(childId, { hidden: true, compositeParent: nodeId });
      }
      return await this.updateNode(nodeId, { expanded: false });
    } else {
      const childCount = node.compositeChildren?.length || 0;
      const centerX = node.position.x;
      const centerY = node.position.y;

      const baseRadius = 200;
      const radius = Math.max(baseRadius, baseRadius + (childCount - 3) * 30);
      const spreadAngle = Math.min(180, 60 + childCount * 15);
      const startAngle = -spreadAngle / 2;
      const angleStep = childCount > 1 ? spreadAngle / (childCount - 1) : 0;

      for (let index = 0; index < (node.compositeChildren?.length || 0); index++) {
        const childId = node.compositeChildren![index];
        const angle = (startAngle + angleStep * index) * Math.PI / 180;
        const newX = centerX + Math.cos(angle) * radius;
        const newY = centerY + Math.sin(angle) * radius;

        await this.updateNode(childId, {
          hidden: false,
          compositeParent: nodeId,
          position: { x: newX, y: newY }
        });
      }

      return await this.updateNode(nodeId, { expanded: true });
    }
  }

  /**
   * 创建复合节点
   * @param nodeIds - 要聚合的节点ID列表
   * @param title - 复合节点标题
   * @param workspaceId - 工作区ID
   * @param createdBy - 创建者访客ID
   * @returns 创建的复合节点
   * @throws 当节点数量不足时抛出错误
   */
  async createCompositeNode(nodeIds: string[], title: string, workspaceId: string, createdBy?: string): Promise<Node> {
    if (!nodeIds || nodeIds.length < 2) {
      throw new Error('至少需要2个节点才能创建复合节点');
    }

    const nodesToAggregate: Node[] = [];
    for (const id of nodeIds) {
      const node = await this.getNode(id);
      if (node) {
        nodesToAggregate.push(node);
      }
    }

    if (nodesToAggregate.length < 2) {
      throw new Error('至少需要2个有效节点');
    }

    const centerX = nodesToAggregate.reduce((sum, n) => sum + n.position.x, 0) / nodesToAggregate.length;
    const centerY = nodesToAggregate.reduce((sum, n) => sum + n.position.y, 0) / nodesToAggregate.length;

    const compositeNode = await this.createNode({
      title: title.trim() || '复合节点',
      isComposite: true,
      compositeChildren: nodeIds,
      position: { x: centerX, y: centerY },
    }, workspaceId, createdBy);

    for (const nodeId of nodeIds) {
      await this.updateNode(nodeId, {
        hidden: true,
        compositeParent: compositeNode.id
      });
    }

    return compositeNode;
  }

  /**
   * 清空工作区的所有内存数据
   * @param workspaceId - 工作区ID
   */
  clearWorkspaceData(workspaceId: string): void {
    this.clearWorkspaceCache(workspaceId);
  }

  /**
   * 清空所有内存数据
   * 重置所有工作区缓存、节点索引和统计计数器
   */
  clearMemoryData(): void {
    this.workspaceCaches.clear();
    this.nodeToWorkspace.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * 清除指定工作区的缓存
   * 用于工作区切换时释放缓存，同时清理节点到工作区的索引映射
   * @param workspaceId - 工作区ID
   */
  clearWorkspaceCache(workspaceId: string): void {
    const cache = this.workspaceCaches.get(workspaceId);
    if (cache) {
      for (const nodeId of cache.nodes.keys()) {
        this.nodeToWorkspace.delete(nodeId);
      }
      this.workspaceCaches.delete(workspaceId);
    }
  }

  /**
   * 获取缓存统计信息
   * 包含工作区数、节点数、关系数和命中率
   * @returns 缓存统计数据
   */
  getCacheStats(): CacheStats {
    let totalNodes = 0;
    let totalRelations = 0;
    for (const cache of this.workspaceCaches.values()) {
      totalNodes += cache.nodes.size;
      totalRelations += cache.relations.length;
    }
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? this.hitCount / total : 0;
    return {
      totalWorkspaces: this.workspaceCaches.size,
      totalNodes,
      totalRelations,
      hitRate,
    };
  }
}

export const nodeService = new NodeService();
