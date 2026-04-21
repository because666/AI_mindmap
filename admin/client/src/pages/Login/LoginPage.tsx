import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/**
 * 登录页面
 * 支持三种状态：首次初始化、登录、设置昵称
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isIpAllowed,
    isFirstVisit,
    hasPassword,
    needNickname,
    isLoading,
    checkIp,
    init,
    login,
    setNickname,
  } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNicknameValue] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'checking' | 'init' | 'login' | 'nickname' | 'denied'>('checking');

  useEffect(() => {
    checkIp();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isIpAllowed && !isFirstVisit) {
      setStep('denied');
    } else if (isFirstVisit) {
      setStep('init');
    } else if (needNickname) {
      setStep('nickname');
    } else {
      setStep('login');
    }
  }, [isLoading, isIpAllowed, isFirstVisit, needNickname]);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }
    const success = await init(password, confirmPassword);
    if (success) {
      setStep('login');
      setPassword('');
    } else {
      setError('初始化失败');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(password);
    if (success) {
      navigate('/');
    } else {
      setError('密码错误');
    }
  };

  const handleSetNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nickname.trim().length < 2) {
      setError('昵称至少2个字符');
      return;
    }
    const success = await setNickname(nickname.trim());
    if (success) {
      navigate('/');
    } else {
      setError('设置昵称失败');
    }
  };

  if (step === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">正在检查访问权限...</div>
      </div>
    );
  }

  if (step === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl p-8 shadow-sm max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">访问被拒绝</h2>
          <p className="text-gray-500">您的IP地址不在管理员白名单中</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl p-8 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">DeepMindMap 后台管理</h1>
        </div>

        {step === 'init' && (
          <form onSubmit={handleInit} className="space-y-4">
            <p className="text-sm text-gray-500 text-center">首次访问，请设置管理员密码</p>
            <input
              type="password"
              placeholder="设置密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              初始化系统
            </button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              登录
            </button>
          </form>
        )}

        {step === 'nickname' && (
          <form onSubmit={handleSetNickname} className="space-y-4">
            <div className="text-center">
              <UserPlus className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">请设置您的管理员昵称</p>
            </div>
            <input
              type="text"
              placeholder="昵称（2-20字符）"
              value={nickname}
              onChange={(e) => setNicknameValue(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              确认
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
