import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  Menu,
  Lightbulb,
  LayoutDashboard,
  ClipboardList,
  Wrench,
  FilePlus,
  List,
  FileOutput,
  ChevronDown,
  ChevronRight,
  CircleDot,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useContract, canSeeServiceMenu, canSeeServiceOrderMenu } from './ContractProvider';
import { useFlowStatuses } from './hooks/useFlowStatuses';

interface MenuItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface MenuGroup {
  key: string;
  icon: React.ElementType;
  label: string;
  children: (MenuItem | MenuGroup)[];
}

type NavEntry = MenuItem | MenuGroup;

function isGroup(entry: NavEntry): entry is MenuGroup {
  return 'children' in entry;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { user, logout } = useAuth();
  const { contracts, selectedContract, setSelectedContractId } = useContract();
  const flowStatuses = useFlowStatuses();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isChildActive = (group: MenuGroup): boolean =>
    group.children.some((c) =>
      isGroup(c) ? isChildActive(c) : location.pathname === c.to
    );

  // Build navigation based on user role
  const nav: NavEntry[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  if (canSeeServiceMenu(selectedContract)) {
    nav.push({
      key: 'solicitacoes',
      icon: ClipboardList,
      label: 'Solicitações de Serviços',
      children: [
        {
          key: 'manutencao',
          icon: Wrench,
          label: 'Manutenção',
          children: [
            { to: '/solicitacoes/manutencao/abrir', icon: FilePlus, label: 'Abrir Solicitação' },
            { to: '/solicitacoes/manutencao/lista', icon: List, label: 'Solicitações' },
          ],
        },
      ],
    });
    if (canSeeServiceOrderMenu(selectedContract)) {
      const statusMenuItems: (MenuItem | MenuGroup)[] = [
        { to: '/ordens-de-servico/manutencao/gerar', icon: FilePlus, label: 'Gerar OS' },
      ];
      for (const status of flowStatuses) {
        statusMenuItems.push({
          to: `/ordens-de-servico/manutencao/status/${status.code}`,
          icon: CircleDot,
          label: status.description,
        });
      }
      nav.push({
        key: 'ordens-de-servico',
        icon: FileOutput,
        label: 'Ordens de Serviço',
        children: [
          {
            key: 'os-manutencao',
            icon: Wrench,
            label: 'Manutenção',
            children: statusMenuItems,
          },
        ],
      });
    }
  }

  const renderNavEntry = (entry: NavEntry, depth: number = 0) => {
    if (isGroup(entry)) {
      const open = expandedGroups.has(entry.key);
      const childActive = isChildActive(entry);
      const pl = depth === 0 ? 'px-3' : depth === 1 ? 'pl-9 pr-3' : 'pl-14 pr-3';

      return (
        <div key={entry.key}>
          <button
            onClick={() => { if (!collapsed) toggleGroup(entry.key); }}
            className={`flex w-full items-center gap-3 ${pl} py-2 text-[13px] font-medium transition-colors ${
              childActive
                ? 'bg-[#334155] text-white'
                : 'text-gray-300 hover:bg-[#334155] hover:text-white'
            }`}
          >
            <entry.icon size={depth === 0 ? 18 : 16} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{entry.label}</span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </>
            )}
          </button>
          {!collapsed && open && (
            <div className={depth === 0 ? 'bg-[#0f172a]' : ''}>
              {entry.children.map((child) => renderNavEntry(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const pl = depth === 0 ? 'px-3' : depth === 1 ? 'pl-9 pr-3' : 'pl-14 pr-3';

    return (
      <NavLink
        key={entry.to}
        to={entry.to}
        end={entry.to === '/'}
        className={({ isActive }) =>
          `flex items-center gap-3 ${pl} py-2 text-[13px] font-medium transition-colors ${
            isActive
              ? 'bg-[#334155] text-white'
              : depth === 0
                ? 'text-gray-300 hover:bg-[#334155] hover:text-white'
                : 'text-gray-400 hover:bg-[#1e293b] hover:text-white'
          }`
        }
      >
        <entry.icon size={depth === 0 ? 18 : 16} className="shrink-0" />
        {!collapsed && <span className="truncate">{entry.label}</span>}
      </NavLink>
    );
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
          {/* Contract selector */}
          {contracts.length > 0 && (
            <select
              value={selectedContract?.id ?? ''}
              onChange={(e) => setSelectedContractId(Number(e.target.value))}
              className="rounded border border-[#475569] bg-[#334155] px-2 py-1 text-xs text-gray-200 outline-none"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
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
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
            {nav.map((entry) => renderNavEntry(entry))}
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
