import { Router, Request, Response } from 'express';
import { workspaceService } from '../services/workspaceService';
import { visitorAuth } from '../middleware';

const router = Router();

/**
 * 注册或更新访客信息
 */
router.post('/visitor/register', async (req: Request, res: Response) => {
  try {
    const { visitorId, nickname } = req.body;
    const visitor = await workspaceService.registerVisitor(visitorId, nickname);
    res.json({ success: true, data: visitor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取访客信息
 */
router.get('/visitor/:visitorId', async (req: Request, res: Response) => {
  try {
    const visitor = await workspaceService.getVisitor(req.params.visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, error: '访客不存在' });
    }
    res.json({ success: true, data: visitor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 创建工作区
 */
router.post('/', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { name, type, description } = req.body;
    const visitorId = req.visitorId!;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '工作区名称不能为空' });
    }

    const workspace = await workspaceService.createWorkspace(
      name,
      visitorId,
      type || 'public',
      description
    );
    res.json({ success: true, data: workspace });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取当前访客的所有工作区
 */
router.get('/mine', visitorAuth, async (req: Request, res: Response) => {
  try {
    const workspaces = await workspaceService.getVisitorWorkspaces(req.visitorId!);
    res.json({ success: true, data: workspaces });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取公开工作区列表
 */
router.get('/public/list', visitorAuth, async (req: Request, res: Response) => {
  try {
    const workspaces = await workspaceService.getPublicWorkspaces(req.visitorId);
    res.json({ success: true, data: workspaces });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取工作区详情
 */
router.get('/:workspaceId', visitorAuth, async (req: Request, res: Response) => {
  try {
    const workspace = await workspaceService.getWorkspace(req.params.workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, error: '工作区不存在' });
    }

    const isMember = await workspaceService.isMember(req.params.workspaceId, req.visitorId!);
    if (!isMember && workspace.type === 'private') {
      return res.status(403).json({ success: false, error: '无权访问该工作区' });
    }

    res.json({ success: true, data: workspace });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 加入工作区
 */
router.post('/:workspaceId/join', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const result = await workspaceService.joinWorkspace(
      req.params.workspaceId,
      req.visitorId!,
      inviteCode
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.workspace });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 通过邀请码加入工作区
 */
router.post('/join-by-code', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ success: false, error: '邀请码不能为空' });
    }

    const result = await workspaceService.joinByInviteCode(inviteCode, req.visitorId!);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.workspace });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 离开工作区
 */
router.post('/:workspaceId/leave', visitorAuth, async (req: Request, res: Response) => {
  try {
    const result = await workspaceService.leaveWorkspace(req.params.workspaceId, req.visitorId!);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 更新工作区
 */
router.put('/:workspaceId', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, type } = req.body;
    const result = await workspaceService.updateWorkspace(
      req.params.workspaceId,
      { name, description, type },
      req.visitorId!
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.workspace });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 刷新邀请码
 */
router.post('/:workspaceId/refresh-invite', visitorAuth, async (req: Request, res: Response) => {
  try {
    const result = await workspaceService.refreshInviteCode(req.params.workspaceId, req.visitorId!);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { inviteCode: result.inviteCode } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 移除成员
 */
router.post('/:workspaceId/remove-member', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { targetVisitorId } = req.body;
    if (!targetVisitorId) {
      return res.status(400).json({ success: false, error: '目标访客ID不能为空' });
    }

    const result = await workspaceService.removeMember(
      req.params.workspaceId,
      targetVisitorId,
      req.visitorId!
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 删除工作区
 */
router.delete('/:workspaceId', visitorAuth, async (req: Request, res: Response) => {
  try {
    const result = await workspaceService.deleteWorkspace(req.params.workspaceId, req.visitorId!);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
