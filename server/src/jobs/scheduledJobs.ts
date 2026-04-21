import cron from 'node-cron';
import { pushService } from '../services/pushService';
import { mongoDBService } from '../data/mongodb/connection';

const ENABLE_WORKSPACE_STATS_JOB = process.env.ENABLE_WORKSPACE_STATS_JOB === 'true';
const ENABLE_CLEANUP_JOB = process.env.ENABLE_CLEANUP_JOB === 'true';

function startWorkspaceStatsJob(): void {
  if (!ENABLE_WORKSPACE_STATS_JOB) {
    console.log('[Cron] 工作区运营数据推送任务已禁用');
    return;
  }

  const job = cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('[Cron] 开始生成工作区运营数据推送...');

      try {
        const workspaceCollection = mongoDBService.getCollection<any>('workspaces');
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

            const nodeCollection = mongoDBService.getCollection<any>('nodes');
            const messageCollection = mongoDBService.getCollection<any>('messages');
            const memberCollection = mongoDBService.getCollection<any>('workspace_members');

            let newNodes = 0;
            let newMessages = 0;
            let activeMembers = 0;

            if (nodeCollection) {
              newNodes = await nodeCollection.countDocuments({
                workspaceId: workspace.id || workspace._id?.toString(),
                createdAt: { $gte: yesterday, $lt: today },
              });
            }

            if (messageCollection) {
              newMessages = await messageCollection.countDocuments({
                workspaceId: workspace.id || workspace._id?.toString(),
                timestamp: { $gte: yesterday, $lt: today },
              });
            }

            if (memberCollection) {
              activeMembers = await memberCollection.countDocuments({
                workspaceId: workspace.id || workspace._id?.toString(),
                lastActiveAt: { $gte: yesterday },
              });
            }

            if (newNodes === 0 && newMessages === 0 && activeMembers === 0) {
              continue;
            }

            let admins: any[] = [];
            if (memberCollection) {
              admins = await memberCollection
                .find({
                  workspaceId: workspace.id || workspace._id?.toString(),
                  role: { $in: ['owner', 'creator', 'admin'] },
                })
                .toArray();
            }

            const adminIds = admins.map((a) => a.visitorId || a.userId).filter(Boolean);

            if (adminIds.length === 0) {
              continue;
            }

            const title = `工作区"${workspace.name}"昨日动态`;
            const content = `## 昨日数据概览

- **新增节点**：${newNodes} 个
- **新增消息**：${newMessages} 条
- **活跃成员**：${activeMembers} 人

继续加油，让思维流动起来！ 💪`;

            const workspaceId = workspace.id || workspace._id?.toString();

            await pushService.sendWorkspaceAutoNotification(
              workspaceId,
              title,
              content,
              adminIds
            );

            console.log(`[Cron] 工作区 "${workspace.name}" 运营数据推送成功`);
          } catch (error: any) {
            console.error(`[Cron] 处理工作区 ${workspace.name} 失败:`, error.message);
          }
        }

        console.log('[Cron] 工作区运营数据推送完成');
      } catch (error: any) {
        console.error('[Cron] 工作区运营数据推送任务异常:', error.message);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  job.start();
  console.log('[Cron] 工作区运营数据推送任务已启动（每天9点执行）');
}

function startCleanupJob(): void {
  if (!ENABLE_CLEANUP_JOB) {
    console.log('[Cron] 数据清理任务已禁用');
    return;
  }

  const job = cron.schedule(
    '0 3 * * *',
    async () => {
      console.log('[Cron] 开始清理过期数据...');

      try {
        const result = await pushService.cleanupExpiredData();

        console.log(`[Cron] 过期数据清理完成:`);
        console.log(`  - 清理过期消息: ${result.cleanedMessages} 条`);
        console.log(`  - 停用无效设备: ${result.deactivatedDevices} 个`);
      } catch (error: any) {
        console.error('[Cron] 数据清理任务异常:', error.message);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  job.start();
  console.log('[Cron] 数据清理任务已启动（每天凌晨3点执行）');
}

export function initScheduledJobs(): void {
  console.log('');
  console.log('='.repeat(40));
  console.log('📅 初始化定时任务...');
  console.log('='.repeat(40));

  startWorkspaceStatsJob();
  startCleanupJob();

  console.log('✅ 定时任务初始化完成');
  console.log('');
}
