import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { adminDB } from '../config/database';
import { ExportTask } from '../types';
import { requireAuth } from '../middleware/auth';
import { getClientIp } from '../middleware/ipWhitelist';
import { auditLog } from '../middleware/auditLog';

const router = Router();

/**
 * 创建导出任务
 */
router.post('/', requireAuth, auditLog('CREATE_EXPORT', 'export'), async (req: Request, res: Response) => {
  try {
    const { type, format, filter } = req.body;

    if (!type || !format) {
      res.status(400).json({ success: false, error: '请提供导出类型和格式' });
      return;
    }

    if (!['users', 'workspaces', 'messages', 'audit_logs'].includes(type)) {
      res.status(400).json({ success: false, error: '无效的导出类型' });
      return;
    }

    if (!['csv', 'json'].includes(format)) {
      res.status(400).json({ success: false, error: '仅支持csv和json格式' });
      return;
    }

    const processingTask = await adminDB.findOne<ExportTask>('export_tasks', {
      status: 'processing',
    } as never);

    if (processingTask) {
      res.status(400).json({ success: false, error: '已有导出任务进行中，请等待完成' });
      return;
    }

    const exportId = uuidv4();
    await adminDB.insertOne('export_tasks', {
      id: exportId,
      type,
      format,
      filter: filter || {},
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      createdByIp: getClientIp(req),
    });

    processExportTask(exportId, type, format, filter).catch((err) => {
      console.error('导出任务处理失败:', err);
    });

    res.json({
      success: true,
      data: {
        exportId,
        status: 'processing',
        estimatedTime: 10,
      },
    });
  } catch (error) {
    console.error('创建导出任务失败:', error);
    res.status(500).json({ success: false, error: '创建导出任务失败' });
  }
});

/**
 * 查询导出状态
 */
router.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await adminDB.findOne<ExportTask>('export_tasks', { id } as never);

    if (!task) {
      res.status(404).json({ success: false, error: '导出任务不存在' });
      return;
    }

    res.json({
      success: true,
      data: {
        exportId: task.id,
        status: task.status,
        progress: task.progress,
        fileUrl: task.fileUrl,
        fileSize: task.fileSize,
        expiredAt: task.expiredAt,
      },
    });
  } catch (error) {
    console.error('查询导出状态失败:', error);
    res.status(500).json({ success: false, error: '查询导出状态失败' });
  }
});

/**
 * 下载导出文件
 */
router.get('/:id/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await adminDB.findOne<ExportTask>('export_tasks', { id } as never);

    if (!task || task.status !== 'completed') {
      res.status(404).json({ success: false, error: '导出文件不存在或未完成' });
      return;
    }

    if (task.expiredAt && new Date(task.expiredAt) < new Date()) {
      res.status(410).json({ success: false, error: '导出文件已过期' });
      return;
    }

    const exportData = await adminDB.findOne('export_data', { taskId: id } as never);
    if (!exportData) {
      res.status(404).json({ success: false, error: '导出数据不存在' });
      return;
    }

    const data = (exportData as Record<string, unknown>).data;
    const filename = `${task.type}_${new Date().toISOString().split('T')[0]}.${task.format}`;

    if (task.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(data, null, 2));
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const csvContent = convertToCSV(data as Record<string, unknown>[]);
      res.send('\uFEFF' + csvContent);
    }
  } catch (error) {
    console.error('下载导出文件失败:', error);
    res.status(500).json({ success: false, error: '下载导出文件失败' });
  }
});

/**
 * 异步处理导出任务
 * @param exportId - 导出任务ID
 * @param type - 导出类型
 * @param format - 导出格式
 * @param filter - 筛选条件
 */
async function processExportTask(
  exportId: string,
  type: string,
  format: string,
  filter?: Record<string, unknown>
): Promise<void> {
  try {
    await adminDB.updateOne('export_tasks', { id: exportId } as never, {
      $set: { progress: 10 },
    });

    let data: Record<string, unknown>[] = [];
    const collectionMap: Record<string, string> = {
      users: 'visitors',
      workspaces: 'workspaces',
      messages: 'conversations',
      audit_logs: 'audit_logs',
    };

    const collection = collectionMap[type] || type;
    const queryFilter: Record<string, unknown> = {};

    if (filter?.startDate || filter?.endDate) {
      queryFilter.createdAt = {};
      if (filter.startDate) (queryFilter.createdAt as Record<string, unknown>).$gte = new Date(filter.startDate as string);
      if (filter.endDate) (queryFilter.createdAt as Record<string, unknown>).$lte = new Date(filter.endDate as string);
    }
    if (filter?.workspaceId) {
      queryFilter.workspaceId = filter.workspaceId;
    }
    if (filter?.userId) {
      queryFilter.id = filter.userId;
    }

    data = await adminDB.find(collection, queryFilter as never, { limit: 10000 });

    await adminDB.updateOne('export_tasks', { id: exportId } as never, {
      $set: { progress: 70 },
    });

    const sanitizedData = data.map((item) => {
      const sanitized = { ...item };
      delete sanitized._id;
      return sanitized;
    });

    await adminDB.insertOne('export_data', {
      taskId: exportId,
      data: sanitizedData,
      format,
      createdAt: new Date(),
    });

    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 7);

    await adminDB.updateOne('export_tasks', { id: exportId } as never, {
      $set: {
        status: 'completed',
        progress: 100,
        fileUrl: `/api/admin/export/${exportId}/download`,
        fileSize: JSON.stringify(sanitizedData).length,
        completedAt: new Date(),
        expiredAt,
      },
    });
  } catch (error) {
    console.error('导出任务处理失败:', error);
    await adminDB.updateOne('export_tasks', { id: exportId } as never, {
      $set: {
        status: 'failed',
        progress: 0,
      },
    });
  }
}

/**
 * 将数据转换为CSV格式
 * @param data - 数据数组
 * @returns CSV字符串
 */
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      const str = value === null || value === undefined ? '' : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default router;
