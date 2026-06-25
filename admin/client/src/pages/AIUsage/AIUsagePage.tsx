import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Download,
  Zap,
  Activity,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { aiUsageApi } from '../../services/api';

interface AIUsageStats {
  totalTokens: number;
  totalCalls: number;
  avgResponseTime: number;
  successRate: number;
  changes: {
    totalTokens: number;
    totalCalls: number;
    avgResponseTime: number;
    successRate: number;
  };
}

interface TrendItem {
  date: string;
  tokens: number;
  calls: number;
}

interface ModelDistributionItem {
  model: string;
  count: number;
  percentage: number;
}

interface QueueStatusData {
  activeCount: number;
  maxConcurrency: number;
  p0QueueLength: number;
  p1QueueLength: number;
  lastUpdatedAt: string;
}

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type Granularity = 'day' | 'week' | 'month';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];

const TIME_RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近30天' },
  { key: 'custom', label: '自定义' },
];

/**
 * AI 用量监控页面
 * 实时监控 AI 调用成本与性能，展示 Token 消耗趋势、模型分布、队列状态
 */
const AIUsagePage: React.FC = () => {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [modelDistribution, setModelDistribution] = useState<ModelDistributionItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const now = new Date();
    const fmt = 'yyyy-MM-dd';
    const endOfDay = 'T23:59:59';
    switch (timeRange) {
      case 'today':
        return { startDate: format(now, fmt), endDate: format(now, fmt) + endOfDay };
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: format(yesterday, fmt), endDate: format(yesterday, fmt) + endOfDay };
      }
      case '7d': {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { startDate: format(start, fmt), endDate: format(now, fmt) + endOfDay };
      }
      case '30d': {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        return { startDate: format(start, fmt), endDate: format(now, fmt) + endOfDay };
      }
      case 'custom':
        return {
          startDate: customStartDate,
          endDate: customEndDate ? customEndDate + endOfDay : customEndDate,
        };
      default:
        return { startDate: format(now, fmt), endDate: format(now, fmt) + endOfDay };
    }
  }, [timeRange, customStartDate, customEndDate]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { startDate, endDate } = getDateRange();
      const statsParams: { startDate?: string; endDate?: string; model?: string } = {};
      if (startDate) statsParams.startDate = startDate;
      if (endDate) statsParams.endDate = endDate;
      if (selectedModel) statsParams.model = selectedModel;

      const [statsRes, trendsRes, modelRes, queueRes] = await Promise.all([
        aiUsageApi.getStats(statsParams),
        aiUsageApi.getTrends({
          startDate: startDate || format(new Date(), 'yyyy-MM-dd'),
          endDate: endDate || format(new Date(), 'yyyy-MM-dd'),
          granularity,
          ...(selectedModel ? { model: selectedModel } : {}),
        }),
        aiUsageApi.getModelDistribution(
          startDate || endDate ? { startDate, endDate } : undefined
        ),
        aiUsageApi.getQueueStatus(),
      ]);

      if (statsRes.data?.data) {
        setStats(statsRes.data.data as AIUsageStats);
      }
      if (trendsRes.data?.data) {
        const trends = trendsRes.data.data;
        setTrendData(Array.isArray(trends) ? (trends as TrendItem[]) : []);
      }
      if (modelRes.data?.data) {
        const dist = modelRes.data.data;
        setModelDistribution(Array.isArray(dist) ? (dist as ModelDistributionItem[]) : []);
      }
      if (queueRes.data?.data) {
        setQueueStatus(queueRes.data.data as QueueStatusData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载数据失败';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateRange, granularity, selectedModel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData]);

  const handleExport = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const params: { startDate?: string; endDate?: string; model?: string } = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedModel) params.model = selectedModel;

      const blob = await aiUsageApi.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([blob as unknown as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败';
      setError(message);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatXAxisDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'MM/dd');
    } catch {
      return dateStr;
    }
  };

  const queueUtilization = queueStatus
    ? Math.round((queueStatus.activeCount / queueStatus.maxConcurrency) * 100)
    : 0;

  const totalModelCalls = modelDistribution.reduce((sum, item) => sum + item.count, 0);

  const handlePieClick = (entry: ModelDistributionItem) => {
    setSelectedModel(entry.model === selectedModel ? '' : entry.model);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-80 animate-pulse" />
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => loadData()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 用量监控</h1>
          <p className="text-sm text-gray-500 mt-1">实时监控 AI 调用成本与性能</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">导出</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>自动刷新</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  autoRefresh ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-1 flex-wrap">
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setTimeRange(option.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === option.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {timeRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="md:ml-auto">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">全部模型</option>
              {modelDistribution.map((item) => (
                <option key={item.model} value={item.model}>
                  {item.model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="总 Token 消耗"
          value={stats ? formatNumber(stats.totalTokens) : '-'}
          change={stats?.changes?.totalTokens}
          icon={<Zap className="w-4 h-4" />}
          color="blue"
          refreshing={refreshing}
        />
        <MetricCard
          title="总调用次数"
          value={stats ? formatNumber(stats.totalCalls) : '-'}
          change={stats?.changes?.totalCalls}
          icon={<Activity className="w-4 h-4" />}
          color="green"
          refreshing={refreshing}
        />
        <MetricCard
          title="平均响应时间"
          value={stats ? `${stats.avgResponseTime}ms` : '-'}
          change={stats?.changes?.avgResponseTime}
          icon={<Clock className="w-4 h-4" />}
          color="purple"
          refreshing={refreshing}
        />
        <MetricCard
          title="成功率"
          value={stats ? `${stats.successRate}%` : '-'}
          change={stats?.changes?.successRate}
          icon={<CheckCircle className="w-4 h-4" />}
          color="orange"
          refreshing={refreshing}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-700">Token 消耗趋势</h3>
            <div className="flex items-center gap-1">
              {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    granularity === g
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {g === 'day' ? '日' : g === 'week' ? '周' : '月'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={formatXAxisDate} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="tokens" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="calls" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'tokens') return [formatNumber(value), 'Token 消耗'];
                  return [value, '调用次数'];
                }}
                labelFormatter={(label: string) => format(new Date(label), 'yyyy-MM-dd')}
              />
              <Line
                yAxisId="tokens"
                type="monotone"
                dataKey="tokens"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="tokens"
              />
              <Line
                yAxisId="calls"
                type="monotone"
                dataKey="calls"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="calls"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-base font-medium text-gray-700 mb-4">模型使用分布</h3>
          {modelDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modelDistribution}
                  dataKey="count"
                  nameKey="model"
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  innerRadius={50}
                  onClick={handlePieClick}
                  cursor="pointer"
                >
                  {modelDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string, entry: Record<string, unknown>) => {
                    const pct = (entry.payload as { percentage?: number } | undefined)?.percentage;
                    return pct !== undefined ? `${value} ${pct}%` : value;
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              暂无数据
            </div>
          )}
          <div className="text-center mt-2">
            <span className="text-2xl font-bold text-gray-800">{formatNumber(totalModelCalls)}</span>
            <span className="text-sm text-gray-500 ml-1">总调用</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-base font-medium text-gray-700 mb-4">请求队列状态</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QueueMetric
            label="当前并发 / 最大并发"
            value={queueStatus ? `${queueStatus.activeCount} / ${queueStatus.maxConcurrency}` : '-'}
          />
          <QueueMetric
            label="P0 队列长度（对话等待）"
            value={queueStatus?.p0QueueLength ?? '-'}
          />
          <QueueMetric
            label="P1 队列长度（后台任务等待）"
            value={queueStatus?.p1QueueLength ?? '-'}
          />
          <div>
            <span className="text-sm text-gray-500">队列利用率</span>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-gray-800">{queueUtilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    queueUtilization >= 80
                      ? 'bg-red-500'
                      : queueUtilization >= 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(queueUtilization, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        {queueStatus?.lastUpdatedAt && (
          <div className="mt-4 text-xs text-gray-400">
            最后更新：{format(new Date(queueStatus.lastUpdatedAt), 'yyyy-MM-dd HH:mm:ss')}
          </div>
        )}
      </div>

      {error && stats && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => loadData(true)}
            className="ml-2 text-red-700 font-medium hover:underline"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  refreshing: boolean;
}

const colorBgMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
};

/**
 * 指标卡片组件
 * 展示单个 AI 用量指标及其变化趋势
 */
const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color, refreshing }) => {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorBgMap[color]}`}>{icon}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {refreshing && (
          <RefreshCw className="w-3.5 h-3.5 text-gray-300 animate-spin" />
        )}
      </div>
      {change !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          {change >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-600" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-600" />
          )}
          <span className={`text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
          <span className="text-xs text-gray-400">较昨日</span>
        </div>
      )}
    </div>
  );
};

interface QueueMetricProps {
  label: string;
  value: string | number;
}

/**
 * 队列指标展示组件
 * 用于请求队列状态面板中的单个指标
 */
const QueueMetric: React.FC<QueueMetricProps> = ({ label, value }) => {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-lg font-bold text-gray-800 mt-1">{value}</div>
    </div>
  );
};

export default AIUsagePage;
