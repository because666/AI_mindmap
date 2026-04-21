import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AdminLayout from './components/Layout/AdminLayout';
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UsersPage from './pages/Users/UsersPage';
import WorkspacesPage from './pages/Workspaces/WorkspacesPage';
import ChatAuditPage from './pages/ChatAudit/ChatAuditPage';
import PushPage from './pages/Push/PushPage';
import SettingsPage from './pages/Settings/SettingsPage';

/**
 * 受保护的路由组件
 * 未登录时重定向到登录页
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
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
