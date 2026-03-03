import { useEffect, useState } from 'react';
import { userControlApi } from '@fsa/shared-api';

interface Role {
  id: number;
  name: string;
  description: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userControlApi
      .getRoles()
      .then((res) => setRoles(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Roles</h2>
        <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Add Role
        </button>
      </div>
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold text-gray-900">{r.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{r.description}</p>
            </div>
          ))}
          {roles.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-400">No roles found</div>
          )}
        </div>
      )}
    </div>
  );
}
