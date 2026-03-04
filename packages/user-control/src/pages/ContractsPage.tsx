import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil } from 'lucide-react';

interface Contract {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  subCompanyId: number | null;
  company: { id: number; name: string } | null;
  systemModule: { id: number; code: string; description: string } | null;
}

interface SelectOption { id: number; name?: string; code?: string; description?: string }

const empty: Partial<Contract> = {
  name: '', description: '', startDate: '', endDate: '', isActive: true,
  company: null, systemModule: null, subCompanyId: null,
};

export default function ContractsPage() {
  const [data, setData] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Contract>>(empty);
  const [saving, setSaving] = useState(false);

  const [companies, setCompanies] = useState<SelectOption[]>([]);
  const [systemModules, setSystemModules] = useState<SelectOption[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getContracts({ page, size: pageSize, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); setTotal(r.data?.totalElements ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const loadDropdowns = () => {
    Promise.all([
      userControlApi.getCompanies({ size: 1000 }),
      userControlApi.getSystemModules({ size: 1000 }),
    ]).then(([c, sm]) => {
      setCompanies(c.data?.content ?? []);
      setSystemModules(sm.data?.content ?? []);
    });
  };

  const openAdd = () => { setEditing({ ...empty }); loadDropdowns(); setModalOpen(true); };
  const openEdit = (c: Contract) => { setEditing({ ...c }); loadDropdowns(); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: editing.name, description: editing.description,
        startDate: editing.startDate, endDate: editing.endDate,
        isActive: editing.isActive, subCompanyId: editing.subCompanyId || null,
        company: editing.company ? { id: editing.company.id } : null,
        systemModule: editing.systemModule ? { id: editing.systemModule.id } : null,
      };
      if (editing.id) await userControlApi.updateContract(editing.id, payload);
      else await userControlApi.createContract(payload);
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true, minWidth: '120px' },
    { key: 'company.name', header: 'Company', sortable: true, minWidth: '120px' },
    { key: 'systemModule.description', header: 'System Module', sortable: true, minWidth: '120px' },
    { key: 'startDate', header: 'Start Date', sortable: true, minWidth: '120px',
      render: (r: Record<string, unknown>) => { const d = r.startDate as string; return d ? new Date(d).toLocaleDateString() : ''; },
    },
    { key: 'endDate', header: 'End Date', sortable: true, minWidth: '120px',
      render: (r: Record<string, unknown>) => { const d = r.endDate as string; return d ? new Date(d).toLocaleDateString() : ''; },
    },
    { key: 'isActive', header: 'Active', sortable: true, minWidth: '100px',
      render: (r: Record<string, unknown>) => {
        const active = r.isActive as boolean;
        return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{active ? 'Active' : 'Inactive'}</span>;
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Contracts"
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={setPage}
        onSearch={() => load()}
        headerActions={<Button size="sm" onClick={openAdd}><Plus size={16} /> Add Contract</Button>}
        rowActions={[
          { icon: <Pencil size={16} />, label: 'Edit', variant: 'warning' as const, onClick: (r) => openEdit(r as unknown as Contract) },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit Contract' : 'Add Contract'} className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input required minLength={2} maxLength={100} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
            <textarea required minLength={10} maxLength={255} rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company *</label>
            <select required value={editing.company?.id ?? ''} onChange={(e) => {
              const c = companies.find((x) => x.id === Number(e.target.value));
              setEditing({ ...editing, company: c ? { id: c.id, name: c.name ?? '' } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Select...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">System Module *</label>
            <select required value={editing.systemModule?.id ?? ''} onChange={(e) => {
              const sm = systemModules.find((x) => x.id === Number(e.target.value));
              setEditing({ ...editing, systemModule: sm ? { id: sm.id, code: sm.code ?? '', description: sm.description ?? '' } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Select...</option>
              {systemModules.map((sm) => <option key={sm.id} value={sm.id}>{sm.description}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sub Company</label>
            <select value={editing.subCompanyId ?? ''} onChange={(e) => setEditing({ ...editing, subCompanyId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">None</option>
              {companies.filter((c) => c.id !== editing.company?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Date *</label>
              <input required type="date" value={editing.startDate ? editing.startDate.substring(0, 10) : ''} onChange={(e) => setEditing({ ...editing, startDate: e.target.value + 'T00:00:00' })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Date *</label>
              <input required type="date" value={editing.endDate ? editing.endDate.substring(0, 10) : ''} onChange={(e) => setEditing({ ...editing, endDate: e.target.value + 'T00:00:00' })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing.id ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
