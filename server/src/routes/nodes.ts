import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { nodeService } from '../services/nodeService';
import { conversationService } from '../services/conversationService';
import { historyService } from '../services/historyService';
import { workspaceMemberAuth } from '../middleware';
import { Node, Relation, RelationType } from '../types';

const router = Router();

/**
 * 获取工作区内的所有节点和关系
 * 需要 X-Visitor-Id 和 X-Workspace-Id 请求头
 */
router.get('/', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const nodes = await nodeService.getAllNodes(workspaceId);
    const relations = await nodeService.getRelations(workspaceId);

    res.json({
      success: true,
      data: { nodes, relations },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 创建节点
 */
router.post('/', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const node = await nodeService.createNode(req.body, workspaceId, req.visitorId);
    await historyService.recordAction('create_node', `创建节点: ${node.title}`, undefined, node as unknown as Record<string, unknown>, workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取单个节点
 */
router.get('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const node = await nodeService.getNode(req.params.id);

    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    if (node.workspaceId !== req.workspaceId) {
      return res.status(403).json({ success: false, error: '无权访问该节点' });
    }

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 更新节点
 */
router.put('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const before = await nodeService.getNode(req.params.id);
    const node = await nodeService.updateNode(req.params.id, req.body);

    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    await historyService.recordAction('update_node', `更新节点: ${node.title}`, before as unknown as Record<string, unknown>, node as unknown as Record<string, unknown>, req.workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 删除节点
 */
router.delete('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const before = await nodeService.getNode(req.params.id);
    const success = await nodeService.deleteNode(req.params.id);

    if (!success) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    await historyService.recordAction('delete_node', '删除节点', before as unknown as Record<string, unknown>, undefined, req.workspaceId, req.visitorId);

    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 创建子节点
 */
router.post('/:id/child', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { title, id, position } = req.body;
    const workspaceId = req.workspaceId!;
    const childData: Partial<Node> = {};
    if (id) childData.id = id;
    if (position) childData.position = position;
    const node = await nodeService.createChildNode(req.params.id, title || '新分支', workspaceId, req.visitorId, childData);
    await historyService.recordAction('create_child', `创建子节点: ${node.title}`, undefined, node as unknown as Record<string, unknown>, workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取工作区根节点
 */
router.get('/roots/list', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const nodes = await nodeService.getRootNodes(req.workspaceId!);
    res.json({ success: true, data: nodes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/relations', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const relation = await nodeService.createRelation(req.body, workspaceId);
    res.json({ success: true, data: relation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/relations/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const success = await nodeService.deleteRelation(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: '关系不存在' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 导出工作区数据
 * 包含节点、关系和对话的完整数据
 * 支持格式：json（默认）、markdown
 */
router.get('/export', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const format = (req.query.format as string) || 'json';
    const nodes = await nodeService.getAllNodes(workspaceId);
    const relations = await nodeService.getRelations(workspaceId);
    const conversations = await conversationService.getConversationsByWorkspaceId(workspaceId);

    if (format === 'markdown') {
      const markdown = convertToMarkdown(nodes, relations);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="deepmindmap-export.md"`);
      return res.send(markdown);
    }

    const exportData = {
      version: '2.0',
      appName: 'DeepMindMap',
      exportedAt: new Date().toISOString(),
      workspaceId,
      nodes: nodes.map(({ workspaceId: _ws, createdBy: _cb, ...rest }) => rest),
      relations: relations.map(({ workspaceId: _ws, ...rest }) => rest),
      conversations: conversations.map(conv => ({
        id: conv.id,
        nodeId: conv.nodeId,
        messages: conv.messages,
        contextConfig: conv.contextConfig,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deepmindmap-export.json"`);
    res.json(exportData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 批量导入数据到工作区
 * 支持格式：json、markdown
 * 导入时会重新生成ID以避免冲突，并关联到当前工作区
 */
router.post('/import', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const visitorId = req.visitorId!;
    const { format, data } = req.body;

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ success: false, error: '导入数据不能为空' });
    }

    let importedCount = { nodes: 0, relations: 0, conversations: 0 };

    if (format === 'markdown') {
      importedCount = await importMarkdown(data, workspaceId, visitorId);
    } else {
      importedCount = await importJson(data, workspaceId, visitorId);
    }

    await historyService.recordAction(
      'import', `导入数据: ${importedCount.nodes}个节点, ${importedCount.relations}个关系`,
      undefined, undefined, workspaceId, visitorId
    );

    res.json({ success: true, data: importedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 将节点和关系转换为Markdown大纲格式
 * @param nodes - 节点列表
 * @param relations - 关系列表
 * @returns Markdown字符串
 */
function convertToMarkdown(nodes: Node[], relations: Relation[]): string {
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const rootNodes = nodes.filter(n => n.isRoot && !n.hidden);
  const nonParentChildRelations = relations.filter(r => r.type !== 'parent-child');

  const lines: string[] = [];
  lines.push('# DeepMindMap 思维导图导出');
  lines.push('');
  lines.push(`> 导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  /**
   * 递归渲染节点树
   * @param nodeId - 节点ID
   * @param depth - 缩进层级
   */
  const renderNode = (nodeId: string, depth: number) => {
    const node = nodeMap.get(nodeId);
    if (!node || node.hidden) return;

    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '- ' : '  '.repeat(0) + '- ';

    if (depth === 0) {
      lines.push(`## ${node.title}`);
    } else {
      lines.push(`${indent}- ${node.title}`);
    }

    if (node.summary) {
      lines.push(`${indent}  > ${node.summary.replace(/\n/g, ' ')}`);
    }

    if (node.tags.length > 0) {
      lines.push(`${indent}  标签: ${node.tags.join(', ')}`);
    }

    for (const childId of node.childrenIds) {
      renderNode(childId, depth + 1);
    }
  };

  for (const root of rootNodes) {
    renderNode(root.id, 0);
    lines.push('');
  }

  if (nonParentChildRelations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 关系');
    lines.push('');
    for (const rel of nonParentChildRelations) {
      const source = nodeMap.get(rel.sourceId);
      const target = nodeMap.get(rel.targetId);
      if (source && target) {
        const typeLabel = getRelationTypeLabel(rel.type);
        const desc = rel.description ? ` — ${rel.description}` : '';
        lines.push(`- **${source.title}** → [${typeLabel}] → **${target.title}**${desc}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 获取关系类型的中文标签
 * @param type - 关系类型
 * @returns 中文标签
 */
function getRelationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'supports': '支持',
    'contradicts': '矛盾',
    'prerequisite': '前提',
    'elaborates': '细化',
    'references': '参考',
    'conclusion': '结论',
    'custom': '自定义',
  };
  return labels[type] || type;
}

/**
 * 导入JSON格式数据
 * @param data - JSON字符串
 * @param workspaceId - 目标工作区ID
 * @param visitorId - 操作者访客ID
 * @returns 导入计数
 */
async function importJson(data: string, workspaceId: string, visitorId: string): Promise<{ nodes: number; relations: number; conversations: number }> {
  let parsed: {
    nodes: Array<Record<string, unknown>>;
    relations: Array<Record<string, unknown>>;
    conversations: Array<Record<string, unknown>>;
  };

  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('JSON格式无效，请检查文件内容');
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('导入数据缺少nodes字段或格式不正确');
  }

  const idMapping = new Map<string, string>();
  let nodeCount = 0;
  let relationCount = 0;
  let conversationCount = 0;

  for (const nodeData of parsed.nodes) {
    const oldId = String(nodeData.id || '');
    const newId = uuidv4();
    idMapping.set(oldId, newId);

    const remappedParentIds = (nodeData.parentIds as string[] || []).map(
      (pid: string) => idMapping.get(pid) || pid
    );
    const remappedChildrenIds = (nodeData.childrenIds as string[] || []).map(
      (cid: string) => idMapping.get(cid) || cid
    );
    const remappedCompositeChildren = (nodeData.compositeChildren as string[] || []).map(
      (ccid: string) => idMapping.get(ccid) || ccid
    );
    const remappedCompositeParent = nodeData.compositeParent
      ? idMapping.get(String(nodeData.compositeParent)) || String(nodeData.compositeParent)
      : undefined;

    await nodeService.createNode({
      id: newId,
      title: String(nodeData.title || '未命名节点'),
      summary: String(nodeData.summary || ''),
      isRoot: Boolean(nodeData.isRoot),
      isComposite: Boolean(nodeData.isComposite),
      compositeChildren: remappedCompositeChildren,
      compositeParent: remappedCompositeParent,
      hidden: Boolean(nodeData.hidden),
      expanded: Boolean(nodeData.expanded),
      position: (nodeData.position as { x: number; y: number }) || { x: 100, y: 100 },
      tags: (nodeData.tags as string[]) || [],
      parentIds: remappedParentIds,
      childrenIds: remappedChildrenIds,
    }, workspaceId, visitorId);
    nodeCount++;
  }

  if (parsed.relations && Array.isArray(parsed.relations)) {
    for (const relData of parsed.relations) {
      const oldSourceId = String(relData.sourceId || '');
      const oldTargetId = String(relData.targetId || '');
      const newSourceId = idMapping.get(oldSourceId);
      const newTargetId = idMapping.get(oldTargetId);

      if (!newSourceId || !newTargetId) continue;

      await nodeService.createRelation({
        sourceId: newSourceId,
        targetId: newTargetId,
        type: String(relData.type || 'parent-child') as RelationType,
        description: relData.description ? String(relData.description) : undefined,
      }, workspaceId);
      relationCount++;
    }
  }

  if (parsed.conversations && Array.isArray(parsed.conversations)) {
    for (const convData of parsed.conversations) {
      const oldNodeId = String(convData.nodeId || '');
      const newNodeId = idMapping.get(oldNodeId);
      if (!newNodeId) continue;

      const newConvId = uuidv4();
      const conv = await conversationService.createConversation(newNodeId, workspaceId, visitorId, newConvId);

      const messages = (convData.messages as Array<Record<string, unknown>>) || [];
      for (const msg of messages) {
        await conversationService.addMessage(conv.id, {
          role: String(msg.role || 'user') as 'user' | 'assistant' | 'system',
          content: String(msg.content || ''),
        });
      }
      conversationCount++;
    }
  }

  return { nodes: nodeCount, relations: relationCount, conversations: conversationCount };
}

/**
 * 导入Markdown大纲格式数据
 * 解析Markdown标题/列表层级结构，生成节点树
 * @param data - Markdown字符串
 * @param workspaceId - 目标工作区ID
 * @param visitorId - 操作者访客ID
 * @returns 导入计数
 */
async function importMarkdown(data: string, workspaceId: string, visitorId: string): Promise<{ nodes: number; relations: number; conversations: number }> {
  const lines = data.split('\n');
  let nodeCount = 0;
  let relationCount = 0;

  const stack: Array<{ id: string; depth: number }> = [];
  let currentRootId: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith('# ') || line.startsWith('> ') || line.startsWith('---') || line.startsWith('标签:')) {
      if (line.startsWith('## ')) {
        const title = line.replace(/^##\s+/, '').trim();
        if (!title) continue;

        const rootNode = await nodeService.createNode({
          title,
          isRoot: true,
          position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 80 },
        }, workspaceId, visitorId);
        currentRootId = rootNode.id;
        stack.length = 0;
        stack.push({ id: rootNode.id, depth: 0 });
        nodeCount++;
      }
      continue;
    }

    const listMatch = line.match(/^(\s*)-\s+(.+)/);
    if (!listMatch || !currentRootId) continue;

    const indent = listMatch[1].length;
    const depth = Math.floor(indent / 2) + 1;
    let title = listMatch[2].trim();

    const summaryMatch = title.match(/^(.+?)\s*>\s*(.+)$/);
    let summary = '';
    if (summaryMatch) {
      title = summaryMatch[1].trim();
      summary = summaryMatch[2].trim();
    }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parentId = stack[stack.length - 1].id;
    const childNode = await nodeService.createChildNode(parentId, title, workspaceId, visitorId, {
      position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 80 },
    });

    if (summary) {
      await nodeService.updateNode(childNode.id, { summary });
    }

    stack.push({ id: childNode.id, depth });
    nodeCount++;
    relationCount++;
  }

  if (nodeCount === 0) {
    const h1Match = data.match(/^#\s+(.+)/m);
    if (h1Match) {
      const title = h1Match[1].trim();
      const rootNode = await nodeService.createNode({
        title,
        isRoot: true,
        position: { x: 100, y: 100 },
      }, workspaceId, visitorId);
      currentRootId = rootNode.id;
      nodeCount++;
    }
  }

  return { nodes: nodeCount, relations: relationCount, conversations: 0 };
}

export default router;
