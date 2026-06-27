import { v4 as uuidv4 } from 'uuid';
import { neo4jService } from '../data/neo4j/connection';
import { mongoDBService } from '../data/mongodb/connection';
import { vectorDBService } from '../data/vector/connection';
import { redisService } from '../data/redis/connection';
import { Node, Relation, NodeType, RelationType } from '../types';

const DEFAULT_POSITION = { x: 100, y: 100 };
const REDIS_CACHE_KEY_PREFIX = 'workspace_cache:';
const REDIS_CACHE_TTL = 3600;

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
 * Redis缓存序列化格式接口
 * 将Map结构转换为可JSON序列化的普通对象，用于Redis存储
 */
interface SerializableWorkspaceCache {
  /** 节点普通对象映射（由Map转换而来） */
  nodes: Record<string, Node>;
  /** 关系列表 */
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
 * MongoDB节点元数据文档接口
 * 用于在MongoDB nodes集合中存储节点的关键元数据，支持快速查询和统计
 */
interface NodeDocument {
  /** 节点唯一标识 */
  id: string;
  /** 所属工作区ID */
  workspaceId: string;
  /** 节点标题 */
  title: string;
  /** 节点类型 */
  type: string;
  /** 创建者访客ID */
  createdBy?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * Neo4j兼容的节点属性接口
 * 将Node中的嵌套对象和Date转换为Neo4j支持的基本类型
 * - position对象序列化为positionJson字符串
 * - Date对象转换为ISO字符串
 * - 移除所有undefined值
 */
interface Neo4jNodeProps {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  type: string;
  isRoot: boolean;
  isComposite: boolean;
  compositeChildren?: string[];
  compositeParent?: string;
  hidden: boolean;
  expanded: boolean;
  conversationId?: string;
  positionJson: string;
  tags: string[];
  parentIds: string[];
  childrenIds: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Neo4j兼容的关系属性接口
 * 将Relation中的Date转换为ISO字符串，移除undefined值
 */
interface Neo4jRelationProps {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
}

/**
 * 节点服务类
 * 提供节点的CRUD操作和关系管理
 * 所有数据按工作区隔离，使用LRU缓存淘汰策略
 * Redis作为二级缓存，内存Map作为一级缓存和降级方案
 */
class NodeService {
  private workspaceCaches: Map<string, WorkspaceCache> = new Map();
  private nodeToWorkspace: Map<string, string> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private static readonly MAX_WORKSPACES: number = 50;
  private static readonly MAX_TOTAL_NODES: number = 10000;

  /**
   * 构建Redis缓存键
   * @param workspaceId - 工作区ID
   * @returns Redis键名，格式为 workspace_cache:{workspaceId}
   */
  private buildRedisKey(workspaceId: string): string {
    return `${REDIS_CACHE_KEY_PREFIX}${workspaceId}`;
  }

  /**
   * 将Node对象转换为Neo4j兼容的属性对象
   * Neo4j只接受string/number/boolean及其数组作为属性值
   * 处理策略：position序列化为JSON字符串，Date转换为ISO字符串，移除undefined值
   * @param node - 原始Node对象
   * @returns Neo4j兼容的扁平属性对象
   */
  private toNeo4jNodeProps(node: Node): Neo4jNodeProps {
    const props: Neo4jNodeProps = {
      id: node.id,
      workspaceId: node.workspaceId,
      title: node.title,
      summary: node.summary,
      type: node.type,
      isRoot: node.isRoot,
      isComposite: node.isComposite,
      hidden: node.hidden,
      expanded: node.expanded,
      positionJson: JSON.stringify(node.position),
      tags: node.tags,
      parentIds: node.parentIds,
      childrenIds: node.childrenIds,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };
    if (node.compositeChildren !== undefined) {
      props.compositeChildren = node.compositeChildren;
    }
    if (node.compositeParent !== undefined) {
      props.compositeParent = node.compositeParent;
    }
    if (node.conversationId !== undefined) {
      props.conversationId = node.conversationId;
    }
    if (node.createdBy !== undefined) {
      props.createdBy = node.createdBy;
    }
    return props;
  }

  /**
   * 将Neo4j返回的节点属性还原为Node对象
   * 将positionJson解析为position对象，ISO字符串还原为Date对象
   * @param props - Neo4j返回的原始属性对象
   * @returns 还原后的Node对象
   */
  private fromNeo4jNodeProps(props: Record<string, unknown>): Node {
    let position = DEFAULT_POSITION;
    if (typeof props.positionJson === 'string') {
      try {
        const parsed = JSON.parse(props.positionJson);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          position = { x: parsed.x, y: parsed.y };
        }
      } catch {
        console.warn('Neo4j节点positionJson解析失败，使用默认位置:', props.positionJson);
      }
    }

    return {
      id: props.id as string,
      workspaceId: props.workspaceId as string,
      title: (props.title as string) || '新节点',
      summary: (props.summary as string) || '',
      type: (props.type as NodeType) || 'default',
      isRoot: props.isRoot as boolean,
      isComposite: props.isComposite as boolean,
      compositeChildren: props.compositeChildren as string[] | undefined,
      compositeParent: props.compositeParent as string | undefined,
      hidden: props.hidden as boolean,
      expanded: props.expanded as boolean,
      conversationId: props.conversationId as string | undefined,
      position,
      tags: (props.tags as string[]) || [],
      parentIds: (props.parentIds as string[]) || [],
      childrenIds: (props.childrenIds as string[]) || [],
      createdBy: props.createdBy as string | undefined,
      createdAt: new Date(props.createdAt as string),
      updatedAt: new Date(props.updatedAt as string),
    };
  }

  /**
   * 将Relation对象转换为Neo4j兼容的属性对象
   * Date转换为ISO字符串，移除undefined值
   * @param relation - 原始Relation对象
   * @returns Neo4j兼容的属性对象
   */
  private toNeo4jRelationProps(relation: Relation): Neo4jRelationProps {
    const props: Neo4jRelationProps = {
      id: relation.id,
      workspaceId: relation.workspaceId,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      type: relation.type,
      createdAt: relation.createdAt.toISOString(),
    };
    if (relation.description !== undefined) {
      props.description = relation.description;
    }
    if (relation.createdBy !== undefined) {
      props.createdBy = relation.createdBy;
    }
    return props;
  }

  /**
   * 将Neo4j返回的关系属性还原为Relation对象
   * ISO字符串还原为Date对象
   * @param props - Neo4j返回的原始属性对象
   * @returns 还原后的Relation对象
   */
  private fromNeo4jRelationProps(props: Record<string, unknown>): Relation {
    return {
      id: props.id as string,
      workspaceId: props.workspaceId as string,
      sourceId: props.sourceId as string,
      targetId: props.targetId as string,
      type: props.type as RelationType,
      description: props.description as string | undefined,
      createdBy: props.createdBy as string | undefined,
      createdAt: new Date(props.createdAt as string),
    };
  }

  /**
   * 将节点元数据同步写入MongoDB
   * 使用upsert模式，存在则更新，不存在则插入
   * 写入失败仅打印警告，不影响主流程
   * @param node - 节点数据
   */
  private async syncNodeToMongoDB(node: Node): Promise<void> {
    try {
      const col = mongoDBService.getCollection('nodes');
      if (!col) return;

      const doc: NodeDocument = {
        id: node.id,
        workspaceId: node.workspaceId,
        title: node.title,
        type: node.type,
        createdBy: node.createdBy,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
      await col.updateOne(
        { id: node.id },
        { $set: doc },
        { upsert: true }
      );
    } catch (error) {
      console.warn('MongoDB同步节点元数据失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 从MongoDB删除节点元数据记录
   * 删除失败仅打印警告，不影响主流程
   * @param nodeId - 节点ID
   */
  private async deleteNodeFromMongoDB(nodeId: string): Promise<void> {
    try {
      await mongoDBService.deleteOne('nodes', { id: nodeId });
    } catch (error) {
      console.warn('MongoDB删除节点元数据失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 从Redis读取工作区缓存
   * 反序列化时将普通对象还原为Map，并将日期字符串还原为Date对象
   * @param workspaceId - 工作区ID
   * @returns 工作区缓存实例，Redis不可用或读取失败时返回null
   */
  private async getFromRedis(workspaceId: string): Promise<WorkspaceCache | null> {
    const client = redisService.getClient();
    if (!client) return null;

    try {
      const data = await client.get(this.buildRedisKey(workspaceId));
      if (!data) return null;

      const parsed: SerializableWorkspaceCache = JSON.parse(data);
      const nodes = new Map<string, Node>();
      for (const [nodeId, nodeData] of Object.entries(parsed.nodes)) {
        nodes.set(nodeId, {
          ...nodeData,
          createdAt: new Date(nodeData.createdAt),
          updatedAt: new Date(nodeData.updatedAt),
        });
      }

      const relations = parsed.relations.map((r: Relation) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));

      return {
        nodes,
        relations,
        lastAccessTime: parsed.lastAccessTime,
      };
    } catch (error) {
      console.error('Redis读取工作区缓存失败:', error);
      return null;
    }
  }

  /**
   * 保存工作区缓存到Redis
   * 序列化时将Map转换为普通对象，设置TTL为1小时
   * @param workspaceId - 工作区ID
   * @param cache - 工作区缓存实例
   */
  private async saveToRedis(workspaceId: string, cache: WorkspaceCache): Promise<void> {
    const client = redisService.getClient();
    if (!client) return;

    try {
      const serializable: SerializableWorkspaceCache = {
        nodes: Object.fromEntries(cache.nodes.entries()),
        relations: cache.relations,
        lastAccessTime: cache.lastAccessTime,
      };
      await client.setex(
        this.buildRedisKey(workspaceId),
        REDIS_CACHE_TTL,
        JSON.stringify(serializable)
      );
    } catch (error) {
      console.error('Redis保存工作区缓存失败:', error);
    }
  }

  /**
   * 从Redis删除工作区缓存
   * @param workspaceId - 工作区ID
   */
  private async removeFromRedis(workspaceId: string): Promise<void> {
    const client = redisService.getClient();
    if (!client) return;

    try {
      await client.del(this.buildRedisKey(workspaceId));
    } catch (error) {
      console.error('Redis删除工作区缓存失败:', error);
    }
  }

  /**
   * 清除所有工作区Redis缓存
   * 使用SCAN+DEL模式匹配 workspace_cache:* 前缀的键，逐批扫描删除
   */
  async clearAllRedisCache(): Promise<void> {
    const client = redisService.getClient();
    if (!client) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          `${REDIS_CACHE_KEY_PREFIX}*`,
          'COUNT',
          100
        );
        if (keys.length > 0) {
          await client.del(...keys);
        }
        cursor = nextCursor;
      } while (cursor !== '0');
    } catch (error) {
      console.error('Redis清除所有缓存失败:', error);
    }
  }

  /**
   * 异步同步工作区缓存到Redis（fire-and-forget模式）
   * 不阻塞主流程，失败时仅打印错误日志
   * @param workspaceId - 工作区ID
   */
  private syncToRedis(workspaceId: string): void {
    const cache = this.workspaceCaches.get(workspaceId);
    if (cache) {
      this.saveToRedis(workspaceId, cache).catch((error: unknown) => {
        console.error('异步同步缓存到Redis失败:', error);
      });
    }
  }

  /**
   * 获取或创建工作区缓存
   * 查找顺序：内存Map → Redis → 创建空缓存
   * Redis命中时同时写入内存Map并重建nodeToWorkspace索引
   * @param workspaceId - 工作区ID
   * @returns 工作区缓存实例
   */
  private async getOrCreateWorkspaceCache(workspaceId: string): Promise<WorkspaceCache> {
    const existing = this.workspaceCaches.get(workspaceId);
    if (existing) {
      existing.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      return existing;
    }

    const redisCache = await this.getFromRedis(workspaceId);
    if (redisCache) {
      while (this.workspaceCaches.size >= NodeService.MAX_WORKSPACES) {
        this.evictLRUWorkspace();
      }
      this.workspaceCaches.set(workspaceId, redisCache);
      for (const nodeId of redisCache.nodes.keys()) {
        this.nodeToWorkspace.set(nodeId, workspaceId);
      }
      this.enforceNodeLimit();
      return redisCache;
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
   * 仅清除内存缓存，保留Redis缓存作为降级数据源
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
   * 同时更新nodeToWorkspace索引，检查节点总数限制，并异步同步到Redis
   * @param node - 节点数据
   */
  private async addNodeToCache(node: Node): Promise<void> {
    const normalizedNode: Node = {
      ...node,
      type: node.type || 'default',
    };
    const cache = await this.getOrCreateWorkspaceCache(normalizedNode.workspaceId);
    cache.nodes.set(normalizedNode.id, normalizedNode);
    this.nodeToWorkspace.set(normalizedNode.id, normalizedNode.workspaceId);
    this.enforceNodeLimit();
    this.syncToRedis(normalizedNode.workspaceId);
  }

  /**
   * 从缓存中移除指定节点
   * 同时清理nodeToWorkspace索引，并异步同步到Redis
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
    this.syncToRedis(workspaceId);
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
          { props: this.toNeo4jNodeProps(node) }
        );
      } catch (error) {
        console.error('Neo4j创建节点失败:', error);
      }
    }

    await this.addNodeToCache(node);
    await this.syncNodeToMongoDB(node);
    return node;
  }

  /**
   * 获取节点
   * 优先从内存缓存获取，未命中则从Neo4j加载并写入缓存
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
        const results = await neo4jService.runQuery<{ n: Record<string, unknown> }>(
          `MATCH (n:Node {id: $id}) RETURN n`,
          { id }
        );
        if (results.length > 0) {
          const node = this.fromNeo4jNodeProps(results[0].n);
          await this.addNodeToCache(node);
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
          { id, props: this.toNeo4jNodeProps(updated) }
        );
      } catch (error) {
        console.error('Neo4j更新节点失败:', error);
      }
    }

    await this.addNodeToCache(updated);
    await this.syncNodeToMongoDB(updated);
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
      await this.deleteNodeFromMongoDB(nodeId);
    }

    if (cache) {
      cache.relations = cache.relations.filter(
        r => !allIds.includes(r.sourceId) && !allIds.includes(r.targetId)
      );
      this.syncToRedis(workspaceId);
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
   * 查找顺序：内存Map → Redis → Neo4j，加载后同时写入内存Map和Redis
   * @param workspaceId - 工作区ID
   * @returns 节点列表
   */
  async getAllNodes(workspaceId: string): Promise<Node[]> {
    const memoryCache = this.workspaceCaches.get(workspaceId);
    if (memoryCache && memoryCache.nodes.size > 0) {
      memoryCache.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      this.hitCount++;
      return Array.from(memoryCache.nodes.values());
    }

    const cache = await this.getOrCreateWorkspaceCache(workspaceId);
    if (cache.nodes.size > 0) {
      this.hitCount++;
      return Array.from(cache.nodes.values());
    }

    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ n: Record<string, unknown> }>(
          `MATCH (n:Node {workspaceId: $workspaceId}) RETURN n`,
          { workspaceId }
        );
        if (results.length > 0) {
          const nodes = results.map(r => this.fromNeo4jNodeProps(r.n));
          for (const node of nodes) {
            cache.nodes.set(node.id, node);
            this.nodeToWorkspace.set(node.id, node.workspaceId);
          }
          this.enforceNodeLimit();
          this.syncToRedis(workspaceId);
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
   * 获取工作区节点数量（优先从缓存获取，缓存未命中时查询Neo4j）
   * @param workspaceId - 工作区ID
   * @returns 节点数量
   */
  async getNodeCount(workspaceId: string): Promise<number> {
    // 优先从内存缓存获取
    const memoryCache = this.workspaceCaches.get(workspaceId);
    if (memoryCache && memoryCache.nodes.size > 0) {
      return memoryCache.nodes.size;
    }

    // 尝试从Redis缓存获取
    const redisCache = await this.getFromRedis(workspaceId);
    if (redisCache && redisCache.nodes.size > 0) {
      return redisCache.nodes.size;
    }

    // 缓存未命中，查询Neo4j COUNT
    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ count: number }>(
          `MATCH (n:Node {workspaceId: $workspaceId}) RETURN count(n) as count`,
          { workspaceId }
        );
        if (results.length > 0) {
          return Number(results[0].count);
        }
      } catch (error) {
        console.error('Neo4j获取节点数量失败:', error);
      }
    }

    return 0;
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
   * @param childData - 子节点额外数据
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

    const cache = await this.getOrCreateWorkspaceCache(workspaceId);
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
          { sourceId: relation.sourceId, targetId: relation.targetId, props: this.toNeo4jRelationProps(relation) }
        );
      } catch (error) {
        console.error('Neo4j创建关系失败:', error);
      }
    }

    cache.relations.push(relation);
    this.syncToRedis(workspaceId);
    return relation;
  }

  /**
   * 获取工作区内的所有关系
   * 查找顺序：内存Map → Redis → Neo4j，加载后同时写入内存Map和Redis
   * @param workspaceId - 工作区ID
   * @returns 关系列表
   */
  async getRelations(workspaceId: string): Promise<Relation[]> {
    const memoryCache = this.workspaceCaches.get(workspaceId);
    if (memoryCache && memoryCache.relations.length > 0) {
      memoryCache.lastAccessTime = Date.now();
      this.touchWorkspace(workspaceId);
      this.hitCount++;
      return memoryCache.relations;
    }

    const cache = await this.getOrCreateWorkspaceCache(workspaceId);
    if (cache.relations.length > 0) {
      this.hitCount++;
      return cache.relations;
    }

    if (neo4jService.isConnected()) {
      try {
        const results = await neo4jService.runQuery<{ r: Record<string, unknown> }>(
          `MATCH ()-[r:RELATES_TO {workspaceId: $workspaceId}]->() RETURN r`,
          { workspaceId }
        );
        if (results.length > 0) {
          const relations = results.map(r => this.fromNeo4jRelationProps(r.r));
          for (const relation of relations) {
            if (!cache.relations.find(mr => mr.id === relation.id)) {
              cache.relations.push(relation);
            }
          }
          this.enforceNodeLimit();
          this.syncToRedis(workspaceId);
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
      this.syncToRedis(foundWorkspaceId);
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
   * 从Neo4j全量同步节点元数据到MongoDB
   * 用于服务启动时的一次性数据迁移，确保MongoDB中包含所有已有节点的元数据
   * 同步过程使用upsert模式，不会覆盖已存在的记录
   * 同步失败仅打印警告，不影响服务启动
   */
  async syncNodesToMongoDB(): Promise<void> {
    if (!neo4jService.isConnected()) {
      console.warn('Neo4j未连接，跳过节点元数据同步到MongoDB');
      return;
    }

    if (!mongoDBService.isConnected()) {
      console.warn('MongoDB未连接，跳过节点元数据同步');
      return;
    }

    try {
      const results = await neo4jService.runQuery<{ n: Record<string, unknown> }>(
        `MATCH (n:Node) RETURN n`,
        {}
      );

      if (results.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Neo4j中无节点数据，无需同步到MongoDB');
        }
        return;
      }

      let syncCount = 0;
      let failCount = 0;

      for (const result of results) {
        try {
          const node = this.fromNeo4jNodeProps(result.n);
          await this.syncNodeToMongoDB(node);
          syncCount++;
        } catch (error) {
          failCount++;
          console.warn(
            '同步节点到MongoDB失败，节点ID:',
            (result.n as Record<string, unknown>).id,
            '错误:',
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`节点元数据同步完成: 成功 ${syncCount} 条, 失败 ${failCount} 条`);
      }
    } catch (error) {
      console.warn('从Neo4j全量同步节点到MongoDB失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 清空工作区的所有数据
   * 同时清除内存缓存和Redis缓存
   * @param workspaceId - 工作区ID
   */
  async clearWorkspaceData(workspaceId: string): Promise<void> {
    await this.invalidateWorkspaceCache(workspaceId);
  }

  /**
   * 使指定工作区的缓存失效
   * 同时清除内存Map和Redis中的缓存
   * @param workspaceId - 工作区ID
   */
  async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    this.clearWorkspaceCache(workspaceId);
    await this.removeFromRedis(workspaceId);
  }

  /**
   * 清除所有缓存
   * 同时清除内存Map和Redis中的所有工作区缓存
   */
  async clearAllCache(): Promise<void> {
    this.workspaceCaches.clear();
    this.nodeToWorkspace.clear();
    this.hitCount = 0;
    this.missCount = 0;
    await this.clearAllRedisCache();
  }

  /**
   * 清空所有内存数据
   * 重置所有工作区缓存、节点索引和统计计数器
   * 仅清除内存，不同步清除Redis
   */
  clearMemoryData(): void {
    this.workspaceCaches.clear();
    this.nodeToWorkspace.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * 清除指定工作区的内存缓存
   * 用于LRU淘汰时释放内存，同时清理节点到工作区的索引映射
   * 仅清除内存，不清除Redis（Redis缓存作为降级数据源保留）
   * @param workspaceId - 工作区ID
   */
  private clearWorkspaceCache(workspaceId: string): void {
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
