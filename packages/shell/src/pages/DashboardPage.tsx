import { Users, ClipboardList, Network, Map } from 'lucide-react';

const stats = [
  { label: 'Users', value: '—', icon: Users, color: 'bg-blue-50 text-blue-700' },
  { label: 'Service Orders', value: '—', icon: ClipboardList, color: 'bg-amber-50 text-amber-700' },
  { label: 'Geographic Points', value: '—', icon: Network, color: 'bg-emerald-50 text-emerald-700' },
  { label: 'Map Layers', value: '—', icon: Map, color: 'bg-violet-50 text-violet-700' },
];

export default function DashboardPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
