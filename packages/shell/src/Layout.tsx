import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Building,
  Layers,
  Handshake,
  FileText,
  Users,
  UserCog,
  Shield,
  Lock,
  Key,
  MapPin,
  Globe,
  Map,
  Landmark,
  Cpu,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Projector,
} from 'lucide-react';
import { useAuth } from './AuthProvider';

interface MenuItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface MenuGroup {
  key: string;
  icon: React.ElementType;
  label: string;
  children: MenuItem[];
}

type NavEntry = MenuItem | MenuGroup;

function isGroup(entry: NavEntry): entry is MenuGroup {
  return 'children' in entry;
}

const nav: NavEntry[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  {
    key: 'empresas',
    icon: Building2,
    label: 'Empresas',
    children: [
      { to: '/empresas', icon: Building, label: 'Empresas' },
      { to: '/grupos-de-empresas', icon: Layers, label: 'Grupos de empresas' },
      { to: '/tipos-de-empresas', icon: Building2, label: 'Tipos de empresas' },
      { to: '/consorcios', icon: Handshake, label: 'Consórcios' },
    ],
  },
  { to: '/contratos', icon: FileText, label: 'Contratos' },
  {
    key: 'usuarios',
    icon: Users,
    label: 'Gestão de Usuários',
    children: [
      { to: '/usuarios', icon: Users, label: 'Usuários' },
      { to: '/grupos-de-usuarios', icon: UserCog, label: 'Grupos de usuários' },
      { to: '/filiacoes', icon: Shield, label: 'Filiações' },
    ],
  },
  {
    key: 'seguranca',
    icon: Lock,
    label: 'Segurança',
    children: [
      { to: '/politicas', icon: Shield, label: 'Políticas' },
      { to: '/grupos-de-politicas', icon: Layers, label: 'Grupos de políticas' },
      { to: '/controle-de-acesso', icon: Key, label: 'Controle de acesso' },
    ],
  },
  {
    key: 'estados',
    icon: MapPin,
    label: 'Estados',
    children: [
      { to: '/estados', icon: Globe, label: 'Estados' },
      { to: '/regioes', icon: Map, label: 'Regiões' },
      { to: '/municipios', icon: Landmark, label: 'Municípios' },
      { to: '/projecoes', icon: Projector, label: 'Projeções' },
    ],
  },
  { to: '/modulos-de-sistema', icon: Cpu, label: 'Módulos de Sistema' },
  { to: '/auditoria', icon: ClipboardList, label: 'Auditoria' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isChildActive = (group: MenuGroup) =>
    group.children.some((c) => location.pathname === c.to);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      {/* Top Header - spans full width */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-[#1e293b] px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-gray-300 hover:bg-[#334155] hover:text-white"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold text-white">FSA ManagementPlatform</span>
        </div>
        <div className="flex items-center gap-4">
          <select className="rounded border border-[#475569] bg-[#334155] px-2 py-1 text-xs text-gray-200 outline-none">
            <option>Humanistic</option>
            <option>Default</option>
          </select>
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
          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
            {nav.map((entry) => {
              if (isGroup(entry)) {
                const open = expandedGroups.has(entry.key);
                const childActive = isChildActive(entry);
                return (
                  <div key={entry.key}>
                    <button
                      onClick={() => { if (!collapsed) toggleGroup(entry.key); }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors ${
                        childActive
                          ? 'bg-[#334155] text-white'
                          : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                      }`}
                    >
                      <entry.icon size={18} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate text-left">{entry.label}</span>
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </>
                      )}
                    </button>
                    {!collapsed && open && (
                      <div className="bg-[#0f172a]">
                        {entry.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              `flex items-center gap-3 py-2 pl-9 pr-3 text-[13px] transition-colors ${
                                isActive
                                  ? 'bg-[#334155] text-white font-medium'
                                  : 'text-gray-400 hover:bg-[#1e293b] hover:text-white'
                              }`
                            }
                          >
                            <child.icon size={16} className="shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[#334155] text-white'
                        : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                    }`
                  }
                >
                  <entry.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{entry.label}</span>}
                </NavLink>
              );
            })}
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
