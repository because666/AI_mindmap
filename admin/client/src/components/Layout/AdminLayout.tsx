import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageSquare,
  Megaphone,
  Settings,
  Menu,
  X,
  LogOut,
  ShieldBan,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { path: '/', label: '数据大盘', icon: LayoutDashboard },
  { path: '/users', label: '用户管理', icon: Users },
  { path: '/workspaces', label: '工作区管理', icon: Briefcase },
  { path: '/chat-audit', label: '对话审计', icon: MessageSquare },
  { path: '/ip-bans', label: 'IP封禁', icon: ShieldBan },
  { path: '/push', label: '消息推送', icon: Megaphone },
  { path: '/settings', label: '系统设置', icon: Settings },
];

/**
 * 后台管理主布局组件
 * 包含侧边栏导航、顶部栏、移动端抽屉菜单
 */
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { nickname, ipAddress, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentPage = navItems.find((item) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex md:flex-col md:w-52 md:fixed md:inset-y-0 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <span className="text-lg font-bold text-gray-800">DeepMindMap</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">
            {nickname} ({ipAddress?.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.***.***')})
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 移动端顶部栏 */}
      <header className="md:hidden h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30">
        <button onClick={() => setMobileMenuOpen(true)} className="p-1">
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <span className="font-medium text-gray-800">
          {currentPage?.label || 'DeepMindMap'}
        </span>
        <button onClick={handleLogout} className="p-1">
          <LogOut className="w-5 h-5 text-gray-500" />
        </button>
      </header>

      {/* 移动端抽屉菜单 */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
              <span className="text-lg font-bold text-gray-800">DeepMindMap</span>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="py-4 space-y-1 px-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">{nickname}</div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-red-600"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <main className="md:ml-52 min-h-screen flex flex-col">
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</div>

        {/* ICP备案号与联系邮箱 */}
        <footer className="shrink-0 bg-white border-t border-gray-200 py-3 text-center space-y-1">
          <div>
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 text-xs transition-colors"
              style={{ fontSize: '12px' }}
            >
              桂ICP备2026005821号-2
            </a>
          </div>
          <div>
            <a
              href="mailto:3694224048@qq.com"
              className="text-gray-500 hover:text-gray-700 text-xs transition-colors"
              style={{ fontSize: '12px' }}
            >
              联系邮箱：3694224048@qq.com
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AdminLayout;
