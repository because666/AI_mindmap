import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/**
 * 真实登录页
 * 只有通过问题验证后才能访问此页面
 * 使用 /auth/real-login 接口进行真正的密码验证
 */
const RealLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { realLogin } = useAuthStore();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await realLogin(password);
      if (success) {
        navigate('/');
      } else {
        setError('密码错误');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl p-8 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">管理员登录</h1>
          <p className="text-sm text-gray-400 mt-1">欢迎回来</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="请输入管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
          >
            {loading ? '正在登录...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RealLoginPage;
