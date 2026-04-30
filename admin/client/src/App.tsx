import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AdminLayout from './components/Layout/AdminLayout';
import FakeLoginPage from './pages/Login/FakeLoginPage';
import RealLoginPage from './pages/Login/RealLoginPage';
import HoneypotDashboard from './pages/Honeypot/HoneypotDashboard';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UsersPage from './pages/Users/UsersPage';
import WorkspacesPage from './pages/Workspaces/WorkspacesPage';
import ChatAuditPage from './pages/ChatAudit/ChatAuditPage';
import PushPage from './pages/Push/PushPage';
import SettingsPage from './pages/Settings/SettingsPage';
import IpBansPage from './pages/IpBans/IpBansPage';

/**
 * 受保护的路由组件
 * 未登录时重定向到蜜罐登录页
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

/**
 * 应用根组件
 * 配置路由和认证守卫
 * 
 * 三层蜜罐认证流程：
 * 1. /login → 蜜罐假登录页（任何密码都"成功"）
 * 2. /honeypot → 戏耍统计页（挑衅 + 隐藏问题入口）
 * 3. /portal → 真实登录页（问题验证后才能访问）
 */
const App: React.FC = () => {
  const { isAuthenticated, fetchMe, isLoading } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 第一层：蜜罐假登录页 */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <FakeLoginPage />
        } />
        {/* 第二层：戏耍统计页 */}
        <Route path="/honeypot" element={<HoneypotDashboard />} />
        {/* 第三层：真实登录页 */}
        <Route path="/portal" element={<RealLoginPage />} />
        {/* 受保护的后台页面 */}
        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout>
              <DashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute>
            <AdminLayout>
              <UsersPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/workspaces" element={
          <ProtectedRoute>
            <AdminLayout>
              <WorkspacesPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/chat-audit" element={
          <ProtectedRoute>
            <AdminLayout>
              <ChatAuditPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/push" element={
          <ProtectedRoute>
            <AdminLayout>
              <PushPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <AdminLayout>
              <SettingsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/ip-bans" element={
          <ProtectedRoute>
            <AdminLayout>
              <IpBansPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
