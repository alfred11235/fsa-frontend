import { useEffect, useState } from 'react';
import { userControlApi } from '@fsa/shared-api';

interface Company {
  id: number;
  name: string;
  cnpj: string;
  active: boolean;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userControlApi
      .getCompanies()
      .then((res) => setCompanies(res.data?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Companies</h2>
        <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Add Company
        </button>
      </div>
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">CNPJ</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{c.id}</td>
                  <td className="px-4 py-3 text-gray-700">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.cnpj}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No companies found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
