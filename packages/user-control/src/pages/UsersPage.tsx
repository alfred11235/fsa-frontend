import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil } from 'lucide-react';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  company: { id: number; name: string } | null;
  memberships: { id: number; role: { code: string; description: string } }[];
}

const emptyUser = { firstName: '', lastName: '', email: '', phone: '', password: '', isActive: true };

export default function UsersPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown>>(emptyUser);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getUsers({ page, size: pageSize, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); setTotal(r.data?.totalElements ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...emptyUser }); setModalOpen(true); };
  const openEdit = (u: User) => { setEditing({ ...u, password: '' }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: editing.firstName, lastName: editing.lastName,
        email: editing.email, phone: editing.phone, isActive: editing.isActive,
      };
      if (editing.password) payload.password = editing.password;
      if (editing.id) await userControlApi.updateUser(editing.id as number, payload);
      else {
        payload.password = editing.password || 'TempPass@123';
        await userControlApi.createUser(payload);
      }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'firstName', header: 'First Name', sortable: true, minWidth: '120px' },
    { key: 'lastName', header: 'Last Name', sortable: true, minWidth: '120px' },
    { key: 'email', header: 'Email', sortable: true, minWidth: '120px' },
    { key: 'company.name', header: 'Company', sortable: true, minWidth: '120px' },
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
        title="Users"
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={setPage}
        onSearch={() => load()}
        headerActions={<Button size="sm" onClick={openAdd}><Plus size={16} /> Add User</Button>}
        rowActions={[
          { icon: <Pencil size={16} />, label: 'Edit', variant: 'warning' as const, onClick: (r) => openEdit(r as unknown as User) },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit User' : 'Add User'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
              <input required value={(editing.firstName as string) ?? ''} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
              <input required value={(editing.lastName as string) ?? ''} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input required type="email" value={(editing.email as string) ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input value={(editing.phone as string) ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{editing.id ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" required={!editing.id} value={(editing.password as string) ?? ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={(editing.isActive as boolean) ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
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
