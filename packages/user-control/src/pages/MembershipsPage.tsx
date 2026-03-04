import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil } from 'lucide-react';

interface Membership {
  id: number;
  isActive: boolean;
  user: { id: number; email: string; firstName: string; company?: { id: number; name: string } } | null;
  role: { id: number; code: string; description: string } | null;
  contract: { id: number; name: string; systemModule?: { id: number; description: string } } | null;
}

interface SelectOption { id: number; [k: string]: unknown }

const empty: Partial<Membership> = { user: null, role: null, contract: null, isActive: true };

export default function MembershipsPage() {
  const [data, setData] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Membership>>(empty);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<SelectOption[]>([]);
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [contracts, setContracts] = useState<SelectOption[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getMemberships({ page, size: pageSize, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); setTotal(r.data?.totalElements ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const loadDropdowns = () => {
    Promise.all([
      userControlApi.getUsers({ size: 1000 }),
      userControlApi.getRoles({ size: 1000 }),
      userControlApi.getContracts({ size: 1000 }),
    ]).then(([u, r, c]) => {
      setUsers(u.data?.content ?? []);
      setRoles(r.data?.content ?? []);
      setContracts(c.data?.content ?? []);
    });
  };

  const openAdd = () => { setEditing({ ...empty }); loadDropdowns(); setModalOpen(true); };
  const openEdit = (m: Membership) => { setEditing({ ...m }); loadDropdowns(); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        user: editing.user ? { id: editing.user.id } : null,
        role: editing.role ? { id: editing.role.id } : null,
        contract: editing.contract ? { id: editing.contract.id } : null,
        isActive: editing.isActive,
      };
      if (editing.id) await userControlApi.updateMembership(editing.id, payload);
      else await userControlApi.createMembership(payload);
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'user.email', header: 'Email', sortable: true, minWidth: '120px' },
    { key: 'role.description', header: 'Role', sortable: true, minWidth: '120px' },
    { key: 'contract.name', header: 'Contract', sortable: true, minWidth: '120px' },
    { key: 'user.company.name', header: 'Company', sortable: true, minWidth: '120px' },
    { key: 'contract.systemModule.description', header: 'System Module', sortable: true, minWidth: '120px' },
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
        title="Memberships"
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={setPage}
        onSearch={() => load()}
        headerActions={<Button size="sm" onClick={openAdd}><Plus size={16} /> Add Membership</Button>}
        rowActions={[
          { icon: <Pencil size={16} />, label: 'Edit', variant: 'warning' as const, onClick: (r) => openEdit(r as unknown as Membership) },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit Membership' : 'Add Membership'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">User *</label>
            <select required value={editing.user?.id ?? ''} disabled={!!editing.id} onChange={(e) => {
              const u = users.find((x) => x.id === Number(e.target.value)) as any;
              setEditing({ ...editing, user: u ? { id: u.id, email: u.email, firstName: u.firstName } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100">
              <option value="">Select...</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
            <select required value={editing.role?.id ?? ''} disabled={!!editing.id} onChange={(e) => {
              const r = roles.find((x) => x.id === Number(e.target.value)) as any;
              setEditing({ ...editing, role: r ? { id: r.id, code: r.code, description: r.description } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100">
              <option value="">Select...</option>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contract</label>
            <select value={editing.contract?.id ?? ''} disabled={!!editing.id} onChange={(e) => {
              const c = contracts.find((x) => x.id === Number(e.target.value)) as any;
              setEditing({ ...editing, contract: c ? { id: c.id, name: c.name } : null });
            }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100">
              <option value="">None</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
