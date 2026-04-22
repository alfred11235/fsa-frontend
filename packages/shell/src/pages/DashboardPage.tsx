import { useEffect, useState } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { Users, ClipboardList, MapPin, AlertTriangle, GitBranch } from 'lucide-react';

interface DashboardStats {
  users: number;
  serviceOrders: number;
  geographicPoints: number;
  occurrences: number;
  userFlows: number;
}

const cardConfig = [
  { key: 'users' as const, label: 'Usuários', icon: Users, color: 'bg-blue-50 text-blue-600', border: 'border-blue-200' },
  { key: 'serviceOrders' as const, label: 'Ordens de Serviço', icon: ClipboardList, color: 'bg-amber-50 text-amber-600', border: 'border-amber-200' },
  { key: 'geographicPoints' as const, label: 'Pontos Geográficos', icon: MapPin, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200' },
  { key: 'occurrences' as const, label: 'Ocorrências', icon: AlertTriangle, color: 'bg-rose-50 text-rose-600', border: 'border-rose-200' },
  { key: 'userFlows' as const, label: 'Fluxos de Usuário', icon: GitBranch, color: 'bg-violet-50 text-violet-600', border: 'border-violet-200' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userControlApi.getDashboardStats()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cardConfig.map((c) => {
          const value = stats?.[c.key];
          return (
            <div key={c.key} className={`flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${c.border}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${c.color}`}>
                <c.icon size={22} />
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="h-7 w-16 animate-pulse rounded bg-gray-200" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString('pt-BR') ?? '—'}</p>
                )}
                <p className="truncate text-sm text-gray-500">{c.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
