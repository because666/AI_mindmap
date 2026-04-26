import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { honeypotApi } from '../../services/api';

interface MyStats {
  ipAddress: string;
  loginAttempts: number;
  attemptedPasswords: string[];
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  totalAttackers: number;
  rank: number;
}

interface RecentLog {
  ipAddress: string;
  loginAttempts: number;
  attemptedPasswords: string[];
  firstAttemptAt: string;
  lastAttemptAt: string;
}

interface RecentLogsData {
  logs: RecentLog[];
  totalAttackers: number;
  totalAttempts: number;
  topPasswords: Array<{ password: string; count: number }>;
}

/**
 * 蜜罐戏耍统计页
 * 显示攻击者信息和挑衅内容
 * 底部隐藏入口：点击"有问题？"弹出问题验证
 */
const HoneypotDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [logsData, setLogsData] = useState<RecentLogsData | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [answer, setAnswer] = useState('');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        honeypotApi.myStats(),
        honeypotApi.recentLogs(10),
      ]);
      if (statsRes.data.data) setMyStats(statsRes.data.data as MyStats);
      if (logsRes.data.data) setLogsData(logsRes.data.data as RecentLogsData);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await honeypotApi.verifyQuestion(answer);
      if (res.data.success) {
        navigate('/portal');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || '答案错误');
    }
  };

  const loadQuestion = async () => {
    try {
      const res = await honeypotApi.getQuestion();
      if (res.data.data) {
        setQuestion((res.data.data as { question: string }).question);
      }
    } catch {
      setQuestion('系统错误');
    }
  };

  const handleShowQuestion = () => {
    setShowQuestion(true);
    loadQuestion();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-green-400 font-mono animate-pulse">正在加载数据...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* 挑衅标题 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">
            恭喜你！成功被耍了！
          </h1>
          <p className="text-gray-400 text-lg">
            你的攻击行为已被记录 ✨
          </p>
        </div>

        {/* 攻击者统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">你的IP</div>
            <div className="text-yellow-400 font-mono text-sm">{myStats?.ipAddress || '***'}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">攻击次数</div>
            <div className="text-red-400 text-2xl font-bold">{myStats?.loginAttempts || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">攻击者总数</div>
            <div className="text-orange-400 text-2xl font-bold">{logsData?.totalAttackers || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">你的排名</div>
            <div className="text-purple-400 text-2xl font-bold">#{myStats?.rank || '-'}</div>
          </div>
        </div>

        {/* 尝试的密码 */}
        {myStats && myStats.attemptedPasswords.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-red-400 mb-3">你尝试过的密码</h2>
            <div className="flex flex-wrap gap-2">
              {myStats.attemptedPasswords.map((pwd, i) => (
                <span key={i} className="bg-red-900/30 text-red-300 px-3 py-1 rounded-full text-sm font-mono">
                  {pwd}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 热门密码TOP5 */}
        {logsData && logsData.topPasswords.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-orange-400 mb-3">热门尝试密码 TOP 5</h2>
            <div className="space-y-2">
              {logsData.topPasswords.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-gray-500 w-6">#{i + 1}</span>
                  <span className="font-mono text-orange-300">{item.password}</span>
                  <span className="text-gray-500 text-sm">({item.count}次)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 攻击日志 */}
        {logsData && logsData.logs.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-400 mb-3">最近攻击记录</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {logsData.logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-700 pb-2">
                  <span className="text-gray-400 font-mono">{log.ipAddress}</span>
                  <span className="text-red-400">{log.loginAttempts}次</span>
                  <span className="text-gray-500 text-xs">
                    {log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleString('zh-CN') : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 挑衅信息 */}
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm">
            💡 提示：你永远也进不去这个系统，放弃吧~
          </p>
        </div>

        {/* 隐藏入口 */}
        <div className="text-center mt-12">
          <button
            onClick={handleShowQuestion}
            className="text-gray-700 hover:text-gray-500 text-xs transition-colors cursor-default"
            style={{ fontSize: '10px' }}
          >
            有问题？
          </button>
        </div>
      </div>

      {/* 问题验证弹窗 */}
      {showQuestion && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🎯</div>
              <h2 className="text-xl font-bold text-yellow-400">终极挑战</h2>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-center text-gray-300">{question}</p>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="输入你的答案..."
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                autoFocus
              />
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-400 font-bold"
              >
                提交答案
              </button>
              <button
                type="button"
                onClick={() => setShowQuestion(false)}
                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm"
              >
                取消
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HoneypotDashboard;
