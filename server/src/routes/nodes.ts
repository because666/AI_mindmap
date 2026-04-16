import { Router, Request, Response } from 'express';
import { nodeService } from '../services/nodeService';
import { historyService } from '../services/historyService';
import { workspaceMemberAuth } from '../middleware';
import { Node } from '../types';

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

export default router;
