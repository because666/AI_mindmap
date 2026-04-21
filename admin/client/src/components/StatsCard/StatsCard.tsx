import React from 'react';
import { TrendingUp, TrendingDown, Users, Briefcase, MessageSquare, Cpu } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: 'users' | 'workspaces' | 'messages' | 'ai' | 'trend-up' | 'trend-down';
  subtitle?: string;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const iconMap = {
  users: Users,
  workspaces: Briefcase,
  messages: MessageSquare,
  ai: Cpu,
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
};

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
};

/**
 * 统计卡片组件
 * 用于数据大盘展示核心指标
 */
const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'blue',
}) => {
  const IconComponent = iconMap[icon];

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <IconComponent className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-1">
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </span>
          )}
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
