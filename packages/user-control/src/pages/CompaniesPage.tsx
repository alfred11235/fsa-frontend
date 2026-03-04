import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil } from 'lucide-react';

interface Company {
  id: number;
  name: string;
  description: string;
  email: string;
  phone: string;
  logoUrl: string;
  logoName: string;
  isActive: boolean;
  companyType: { id: number; code: string; description: string } | null;
  companyGroup: { id: number; code: string; description: string } | null;
  consortium: { id: number; code: string; description: string } | null;
  municipality: { id: number; name: string; state?: { id: number; code?: string; description?: string } } | null;
}

interface SelectOption { id: number; code?: string; description?: string; name?: string }

const emptyCompany: Partial<Company> = {
  name: '', description: '', email: '', phone: '', isActive: true,
  companyType: null, companyGroup: null, consortium: null, municipality: null,
};

export default function CompaniesPage() {
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Company>>(emptyCompany);
  const [saving, setSaving] = useState(false);

  const [companyTypes, setCompanyTypes] = useState<SelectOption[]>([]);
  const [companyGroups, setCompanyGroups] = useState<SelectOption[]>([]);
  const [consortiums, setConsortiums] = useState<SelectOption[]>([]);
  const [states, setStates] = useState<SelectOption[]>([]);
  const [municipalities, setMunicipalities] = useState<SelectOption[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getCompanies({ page, size: pageSize, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); setTotal(r.data?.totalElements ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const loadDropdowns = () => {
    userControlApi.getCompanyTypes({ size: 1000 })
      .then((r) => setCompanyTypes(r.data?.content ?? []))
      .catch(() => {});
    userControlApi.getCompanyGroups({ size: 1000 })
      .then((r) => setCompanyGroups(r.data?.content ?? []))
      .catch(() => {});
    userControlApi.getConsortiums({ size: 1000 })
      .then((r) => setConsortiums(r.data?.content ?? []))
      .catch(() => {});
    userControlApi.getStates({ size: 1000 })
      .then((r) => setStates(r.data?.content ?? []))
      .catch(() => {});
  };

  const openAdd = () => { setEditing({ ...emptyCompany }); setSelectedStateId(''); setMunicipalities([]); loadDropdowns(); setModalOpen(true); };
  const openEdit = (c: Company) => {
    setEditing({ ...c });
    loadDropdowns();
    const stId = c.municipality?.state?.id;
    if (stId) {
      setSelectedStateId(stId);
      userControlApi.getMunicipalitiesByState(stId)
        .then((r) => setMunicipalities(r.data ?? []))
        .catch(() => {});
    } else {
      setSelectedStateId('');
      setMunicipalities([]);
    }
    setModalOpen(true);
  };

  const handleStateChange = (stateId: number) => {
    setSelectedStateId(stateId);
    userControlApi.getMunicipalitiesByState(stateId)
      .then((r) => setMunicipalities(r.data ?? []))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: editing.name, description: editing.description, email: editing.email,
        phone: editing.phone, isActive: editing.isActive,
        companyType: editing.companyType ? { id: editing.companyType.id } : null,
        companyGroup: editing.companyGroup ? { id: editing.companyGroup.id } : null,
        consortium: editing.consortium ? { id: editing.consortium.id } : null,
        municipality: editing.municipality ? { id: editing.municipality.id } : null,
      };
      if (editing.id) await userControlApi.updateCompany(editing.id, payload);
      else await userControlApi.createCompany(payload);
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true, minWidth: '120px' },
    { key: 'companyType.description', header: 'Company Type', sortable: true, minWidth: '120px' },
    { key: 'companyGroup.code', header: 'Company Group', sortable: true, minWidth: '120px' },
    { key: 'consortium.code', header: 'Consortium', sortable: true, minWidth: '120px' },
    { key: 'email', header: 'Email', sortable: true, minWidth: '120px' },
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
        title="Companies"
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={setPage}
        onSearch={() => load()}
        headerActions={<Button size="sm" onClick={openAdd}><Plus size={16} /> Add Company</Button>}
        rowActions={[
          { icon: <Pencil size={16} />, label: 'Edit', variant: 'warning' as const, onClick: (r) => openEdit(r as unknown as Company) },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit Company' : 'Add Company'} className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input required minLength={2} maxLength={100} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
            <textarea required minLength={2} maxLength={255} rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
              <input required value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
              <input required type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company Type *</label>
            <select required value={editing.companyType?.id ?? ''} onChange={(e) => {
              const ct = companyTypes.find((t) => t.id === Number(e.target.value));
              setEditing({ ...editing, companyType: ct ? { id: ct.id, code: ct.code ?? '', description: ct.description ?? '' } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Select...</option>
              {companyTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.description}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company Group</label>
              <select value={editing.companyGroup?.id ?? ''} onChange={(e) => {
                const cg = companyGroups.find((g) => g.id === Number(e.target.value));
                setEditing({ ...editing, companyGroup: cg ? { id: cg.id, code: cg.code ?? '', description: cg.description ?? '' } : null });
              }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">None</option>
                {companyGroups.map((g) => <option key={g.id} value={g.id}>{g.description}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Consortium</label>
              <select value={editing.consortium?.id ?? ''} onChange={(e) => {
                const co = consortiums.find((c) => c.id === Number(e.target.value));
                setEditing({ ...editing, consortium: co ? { id: co.id, code: co.code ?? '', description: co.description ?? '' } : null });
              }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">None</option>
                {consortiums.map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}
              </select>
            </div>
          </div>
          {editing.companyType?.code === 'Pre' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
                <select value={selectedStateId} onChange={(e) => handleStateChange(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  <option value="">Select...</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.description || s.code}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Municipality</label>
                <select value={editing.municipality?.id ?? ''} onChange={(e) => {
                  const m = municipalities.find((m) => m.id === Number(e.target.value));
                  setEditing({ ...editing, municipality: m ? { id: m.id, name: m.name ?? '' } : null });
                }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  <option value="">Select...</option>
                  {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          )}
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
