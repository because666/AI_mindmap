import React, { useState, useEffect } from 'react';
import StatsCard from '../../components/StatsCard/StatsCard';
import { dashboardApi } from '../../services/api';
import type {
  DashboardStats,
  RetentionTrendData,
  ConversionFunnelData,
  EventOverviewData,
  EventTrendData,
  EventFunnelData,
  RecentEventItem,
} from '../../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell,
} from 'recharts';
import type { TooltipProps } from 'recharts';

/**
 * 留存率数字卡片属性接口
 */
interface RetentionCardProps {
  label: string;
  value: number;
  color: string;
}

/**
 * 留存率数字卡片组件
 * 展示单个留存率指标
 * @param props - 卡片属性
 */
const RetentionCard: React.FC<RetentionCardProps> = ({ label, value, color }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
    <div className="text-sm text-gray-500 mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color}`}>{value.toFixed(1)}%</div>
  </div>
);

/**
 * 漏斗自定义 Tooltip 组件
 * 展示步骤名称、用户数和转化率
 * @param props - Recharts Tooltip 属性
 */
const FunnelTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload as { name: string; count: number; rate: number };
  return (
    <div className="bg-white px-3 py-2 shadow-lg rounded border border-gray-100 text-sm">
      <div className="font-medium text-gray-700">{data.name}</div>
      <div className="text-gray-500">{data.count} 人</div>
      <div className="text-gray-400">转化率 {data.rate.toFixed(1)}%</div>
    </div>
  );
};

/**
 * 数据大盘页面
 * 展示系统核心运营指标、趋势图表、留存趋势和转化漏斗
 */
const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; value: number }>>([]);
  const [retentionData, setRetentionData] = useState<RetentionTrendData | null>(null);
  const [funnelData, setFunnelData] = useState<ConversionFunnelData | null>(null);
  const [eventOverview, setEventOverview] = useState<EventOverviewData | null>(null);
  const [eventTrendData, setEventTrendData] = useState<Array<{ date: string; value: number }>>([]);
  const [eventFunnelData, setEventFunnelData] = useState<EventFunnelData | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEventItem[]>([]);
  const [eventType, setEventType] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadEventData();
  }, [eventType]);

  /**
   * 加载大盘全部数据
   * 并行请求统计指标、趋势数据、留存趋势、转化漏斗、事件概览、事件漏斗、最近事件
   */
  const loadData = async () => {
    try {
      const [statsRes, trendRes, retentionRes, funnelRes, eventOverviewRes, eventFunnelRes, recentEventsRes] =
        await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getTrends('user_growth', 30),
          dashboardApi.getRetentionTrends(30),
          dashboardApi.getConversionFunnel(),
          dashboardApi.getEventOverview(),
          dashboardApi.getEventFunnel(),
          dashboardApi.getRecentEvents(20),
        ]);
      setStats(statsRes.data.data as DashboardStats);
      const trend = trendRes.data.data as { dates: string[]; values: number[] };
      if (trend) {
        setTrendData(
          trend.dates.map((date, i) => ({
            date: date.substring(5),
            value: trend.values[i],
          }))
        );
      }
      if (retentionRes.data.data) {
        setRetentionData(retentionRes.data.data as RetentionTrendData);
      }
      if (funnelRes.data.data) {
        setFunnelData(funnelRes.data.data as ConversionFunnelData);
      }
      if (eventOverviewRes.data.data) {
        setEventOverview(eventOverviewRes.data.data as EventOverviewData);
      }
      if (eventFunnelRes.data.data) {
        setEventFunnelData(eventFunnelRes.data.data as EventFunnelData);
      }
      if (recentEventsRes.data.data) {
        setRecentEvents(recentEventsRes.data.data as RecentEventItem[]);
      }
    } catch (error) {
      console.error('加载大盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载事件趋势数据
   * 根据当前选中的事件类型筛选，默认统计全部事件
   */
  const loadEventData = async () => {
    try {
      const trendRes = await dashboardApi.getEventTrend(7, eventType);
      const trend = trendRes.data.data as EventTrendData;
      if (trend) {
        setEventTrendData(
          trend.dates.map((date, i) => ({
            date: date.substring(5),
            value: trend.values[i],
          }))
        );
      }
    } catch (error) {
      console.error('加载事件趋势数据失败:', error);
    }
  };

  /**
   * 处理事件类型筛选变化
   * @param e - select 元素的 change 事件
   */
  const handleEventTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEventType(e.target.value);
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">加载中...</div>;
  }

  if (!stats) {
    return <div className="text-center py-20 text-gray-400">暂无数据</div>;
  }

  /**
   * 将留存趋势数据转换为 Recharts LineChart 可用的格式
   */
  const retentionChartData = retentionData
    ? retentionData.dates.map((date, i) => ({
        date: date.substring(5),
        DAU: retentionData.dau[i],
        WAU: retentionData.wau[i],
        MAU: retentionData.mau[i],
      }))
    : [];

  /**
   * 计算留存率的最新值（取最后一天有数据的日子）
   * @param arr - 留存率数组
   * @returns 最新的留存率值
   */
  const getLatestRetention = (arr: number[]): number => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] > 0) return arr[i];
    }
    return 0;
  };

  /**
   * 漏斗步骤颜色映射
   */
  const FUNNEL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">数据大盘</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatsCard title="总用户" value={stats.users.total} icon="users" color="blue" />
        <StatsCard title="今日新增" value={stats.users.todayNew} icon="trend-up" color="green" />
        <StatsCard title="今日活跃" value={stats.users.todayActive} icon="trend-up" color="green" />
        <StatsCard title="总工作区" value={stats.workspaces.total} icon="workspaces" color="purple" />
        <StatsCard title="今日消息" value={stats.content.todayMessages} icon="messages" color="orange" />
        <StatsCard title="AI交互" value={stats.content.aiInteractions} icon="ai" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-base font-medium text-gray-700 mb-4">用户增长趋势（近30天）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-base font-medium text-gray-700 mb-4">内容统计</h3>
          <div className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">总节点数</span>
              <span className="text-lg font-bold text-gray-800">{stats.content.totalNodes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">总消息数</span>
              <span className="text-lg font-bold text-gray-800">{stats.content.totalMessages}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">公开工作区</span>
              <span className="text-lg font-bold text-gray-800">{stats.workspaces.publicCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">本周活跃用户</span>
              <span className="text-lg font-bold text-gray-800">{stats.users.weekActive}</span>
            </div>
          </div>
        </div>
      </div>

      {retentionData && (
        <div className="mt-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-medium text-gray-700 mb-4">留存趋势（近30天）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={retentionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="DAU" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="WAU" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="MAU" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <RetentionCard
                label="次日留存率"
                value={getLatestRetention(retentionData.nextDayRetention)}
                color="text-blue-600"
              />
              <RetentionCard
                label="7日留存率"
                value={getLatestRetention(retentionData.day7Retention)}
                color="text-purple-600"
              />
              <RetentionCard
                label="30日留存率"
                value={getLatestRetention(retentionData.day30Retention)}
                color="text-amber-600"
              />
            </div>
          </div>
        </div>
      )}

      {funnelData && funnelData.steps.length > 0 && (
        <div className="mt-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-medium text-gray-700 mb-4">转化漏斗</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={funnelData.steps}
                layout="vertical"
                margin={{ left: 80, right: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 13 }}
                  width={70}
                />
                <Tooltip content={<FunnelTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                  {funnelData.steps.map((_step, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-4 gap-3 mt-4">
              {funnelData.steps.map((step, index) => (
                <div
                  key={step.name}
                  className="text-center p-3 rounded-lg border border-gray-100"
                >
                  <div
                    className="w-3 h-3 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length] }}
                  />
                  <div className="text-sm text-gray-500">{step.name}</div>
                  <div className="text-lg font-bold text-gray-800">{step.count}</div>
                  <div className="text-xs text-gray-400">{step.rate.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {eventOverview && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">用户行为事件</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatsCard title="总事件数" value={eventOverview.total} icon="messages" color="blue" />
            <StatsCard title="今日事件" value={eventOverview.today} icon="trend-up" color="green" />
            <StatsCard title="独立访客" value={eventOverview.uniqueVisitors} icon="users" color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-gray-700">事件趋势（近7天）</h3>
                <select
                  value={eventType}
                  onChange={handleEventTypeChange}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部事件</option>
                  <option value="page_view">页面浏览</option>
                  <option value="node_created">节点创建</option>
                  <option value="branch_created">分支创建</option>
                  <option value="extension_direction_click">延伸方向点击</option>
                  <option value="summary_generated">摘要生成</option>
                  <option value="map_created">地图创建</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={eventTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {eventFunnelData && eventFunnelData.steps.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-base font-medium text-gray-700 mb-4">关键事件漏斗</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={eventFunnelData.steps}
                    layout="vertical"
                    margin={{ left: 80, right: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 13 }}
                      width={70}
                    />
                    <Tooltip content={<FunnelTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                      {eventFunnelData.steps.map((_step, index) => (
                        <Cell key={`event-cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-5 gap-2 mt-4">
                  {eventFunnelData.steps.map((step, index) => (
                    <div
                      key={step.name}
                      className="text-center p-2 rounded-lg border border-gray-100"
                    >
                      <div
                        className="w-3 h-3 rounded-full mx-auto mb-1"
                        style={{ backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length] }}
                      />
                      <div className="text-xs text-gray-500">{step.name}</div>
                      <div className="text-base font-bold text-gray-800">{step.count}</div>
                      <div className="text-xs text-gray-400">{step.rate.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {recentEvents.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-base font-medium text-gray-700 mb-4">最近事件流</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">事件类型</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">访客ID</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">工作区ID</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((event, index) => (
                      <tr key={`event-${index}`} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 px-3 text-gray-800">{event.eventType}</td>
                        <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">
                          {event.visitorId || '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">
                          {event.workspaceId || '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString('zh-CN') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
