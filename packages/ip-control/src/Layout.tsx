import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Lightbulb } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      {/* Top Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-[#1e293b] px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-gray-300 hover:bg-[#334155] hover:text-white"
          >
            <Menu size={18} />
          </button>
          <Lightbulb size={18} className="text-yellow-400" />
          <span className="text-sm font-semibold text-white">FSA IP Control</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-300">
            Olá, {user?.name ?? 'Usuário'} ▾
          </span>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`flex flex-col bg-[#1e293b] transition-all duration-300 ${
            collapsed ? 'w-[52px]' : 'w-60'
          }`}
        >
          {/* Nav items - empty for now */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
            {!collapsed && (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Nenhum item de menu disponível.
              </div>
            )}
          </nav>

          {/* Logout */}
          <div className="border-t border-[#334155] p-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-[13px] font-medium text-gray-300 hover:bg-[#334155] hover:text-white"
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
