import { Router, Request, Response } from 'express';
import { Parser } from 'json2csv';
import { requireAuth } from '../middleware/auth';
import { auditLogService } from '../services/auditLogService';
import { AuditLogFilter } from '../services/auditLogService';

const router = Router();

/**
 * GET /
 * 获取审计日志分页列表
 * 查询参数：page、pageSize、action、adminNickname、startDate、endDate
 * 所有端点需通过 requireAuth 中间件认证
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));

    const filter: AuditLogFilter = {
      action: req.query.action as string | undefined,
      adminNickname: req.query.adminNickname as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const result = await auditLogService.getLogs(filter, page, pageSize);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取审计日志列表失败:', error);
    res.status(500).json({ success: false, error: '获取审计日志列表失败' });
  }
});

/**
 * GET /stats
 * 获取审计日志统计数据
 * 返回总数、今日操作数、成功/失败数、操作类型分布、每日趋势
 */
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await auditLogService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取审计日志统计失败:', error);
    res.status(500).json({ success: false, error: '获取审计日志统计失败' });
  }
});

/**
 * GET /export
 * 导出审计日志为CSV文件
 * 查询参数同列表筛选：action、adminNickname、startDate、endDate
 * 返回UTF-8 BOM编码的CSV文件流
 */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const filter: AuditLogFilter = {
      action: req.query.action as string | undefined,
      adminNickname: req.query.adminNickname as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const exportData = await auditLogService.exportCSV(filter);

    const fields = ['时间', '管理员', '管理员IP', '操作', '目标类型', '目标ID', '结果', '错误信息'];
    const parser = new Parser({ fields });
    const csv = parser.parse(exportData);

    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出审计日志失败:', error);
    res.status(500).json({ success: false, error: '导出审计日志失败' });
  }
});

export default router;
