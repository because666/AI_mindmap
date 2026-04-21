import React, { useState, useEffect } from 'react';
import StatsCard from '../../components/StatsCard/StatsCard';
import { dashboardApi } from '../../services/api';
import type { DashboardStats } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * 数据大盘页面
 * 展示系统核心运营指标和趋势图表
 */
const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, trendRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getTrends('user_growth', 30),
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
    } catch (error) {
      console.error('加载大盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">加载中...</div>;
  }

  if (!stats) {
    return <div className="text-center py-20 text-gray-400">暂无数据</div>;
  }

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
    </div>
  );
};

export default DashboardPage;
