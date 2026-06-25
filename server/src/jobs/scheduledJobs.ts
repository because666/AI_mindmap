import cron from 'node-cron';
import { Document } from 'mongodb';
import { pushService } from '../services/pushService';
import { mongoDBService } from '../data/mongodb/connection';

const ENABLE_WORKSPACE_STATS_JOB = process.env.ENABLE_WORKSPACE_STATS_JOB === 'true';
const ENABLE_CLEANUP_JOB = process.env.ENABLE_CLEANUP_JOB === 'true';

/**
 * 工作区成员文档接口（用于运营数据推送任务）
 */
interface WorkspaceMemberDocument extends Document {
  workspaceId?: string;
  visitorId?: string;
  userId?: string;
  role?: string;
  lastActiveAt?: Date;
}

/**
 * 工作区文档接口（用于运营数据推送任务）
 */
interface WorkspaceStatsDocument extends Document {
  id?: string;
  _id?: { toString(): string };
  name?: string;
  status?: string;
}

function startWorkspaceStatsJob(): void {
  if (!ENABLE_WORKSPACE_STATS_JOB) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Cron] 工作区运营数据推送任务已禁用');
    }
    return;
  }

  const job = cron.schedule(
    '0 9 * * *',
    async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Cron] 开始生成工作区运营数据推送...');
      }

      try {
        const workspaceCollection = mongoDBService.getCollection<WorkspaceStatsDocument>('workspaces');
        if (!workspaceCollection) {
          console.warn('[Cron] 工作区集合不可用，跳过');
          return;
        }

        const workspaces = await workspaceCollection.find({ status: 'active' }).toArray();

        for (const workspace of workspaces) {
          try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const today = new Date(yesterday);
            today.setDate(today.getDate() + 1);

            const nodeCollection = mongoDBService.getCollection<Document>('nodes');
            const messageCollection = mongoDBService.getCollection<Document>('messages');
            const memberCollection = mongoDBService.getCollection<WorkspaceMemberDocument>('workspace_members');

            let newNodes = 0;
            let newMessages = 0;
            let activeMembers = 0;

            const workspaceId = workspace.id || workspace._id?.toString();

            if (nodeCollection && workspaceId) {
              newNodes = await nodeCollection.countDocuments({
                workspaceId,
                createdAt: { $gte: yesterday, $lt: today },
              });
            }

            if (messageCollection && workspaceId) {
              newMessages = await messageCollection.countDocuments({
                workspaceId,
                timestamp: { $gte: yesterday, $lt: today },
              });
            }

            if (memberCollection && workspaceId) {
              activeMembers = await memberCollection.countDocuments({
                workspaceId,
                lastActiveAt: { $gte: yesterday },
              });
            }

            if (newNodes === 0 && newMessages === 0 && activeMembers === 0) {
              continue;
            }

            let admins: WorkspaceMemberDocument[] = [];
            if (memberCollection && workspaceId) {
              admins = await memberCollection
                .find({
                  workspaceId,
                  role: { $in: ['owner', 'creator', 'admin'] },
                })
                .toArray();
            }

            const adminIds = admins
              .map((a) => a.visitorId || a.userId)
              .filter((id): id is string => Boolean(id));

            if (adminIds.length === 0) {
              continue;
            }

            const workspaceName = workspace.name || '未命名工作区';
            const title = `工作区"${workspaceName}"昨日动态`;
            const content = `## 昨日数据概览

- **新增节点**：${newNodes} 个
- **新增消息**：${newMessages} 条
- **活跃成员**：${activeMembers} 人

继续加油，让思维流动起来！ 💪`;

            if (!workspaceId) {
              continue;
            }

            await pushService.sendWorkspaceAutoNotification(
              workspaceId,
              title,
              content,
              adminIds
            );

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[Cron] 工作区 "${workspaceName}" 运营数据推送成功`);
            }
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Cron] 处理工作区 ${workspace.name || ''} 失败:`, errorMsg);
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Cron] 工作区运营数据推送完成');
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[Cron] 工作区运营数据推送任务异常:', errorMsg);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  job.start();
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Cron] 工作区运营数据推送任务已启动（每天9点执行）');
  }
}

function startCleanupJob(): void {
  if (!ENABLE_CLEANUP_JOB) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Cron] 数据清理任务已禁用');
    }
    return;
  }

  const job = cron.schedule(
    '0 3 * * *',
    async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Cron] 开始清理过期数据...');
      }

      try {
        const result = await pushService.cleanupExpiredData();

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Cron] 过期数据清理完成:`);
          console.log(`  - 清理过期消息: ${result.cleanedMessages} 条`);
          console.log(`  - 停用无效设备: ${result.deactivatedDevices} 个`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[Cron] 数据清理任务异常:', errorMsg);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  job.start();
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Cron] 数据清理任务已启动（每天凌晨3点执行）');
  }
}

export function initScheduledJobs(): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log('');
    console.log('='.repeat(40));
    console.log('📅 初始化定时任务...');
    console.log('='.repeat(40));
  }

  startWorkspaceStatsJob();
  startCleanupJob();

  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ 定时任务初始化完成');
    console.log('');
  }
}
