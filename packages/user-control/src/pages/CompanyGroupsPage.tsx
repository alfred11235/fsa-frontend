import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil } from 'lucide-react';

interface CompanyGroup { id: number; code: string; description: string; isActive: boolean }
const empty = { code: '', description: '', isActive: true };

export default function CompanyGroupsPage() {
  const [data, setData] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CompanyGroup>>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getCompanyGroups({ page, size: pageSize, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); setTotal(r.data?.totalElements ?? 0); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...empty }); setModalOpen(true); };
  const openEdit = (item: CompanyGroup) => { setEditing({ ...item }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing.id) await userControlApi.updateCompanyGroup(editing.id, editing);
      else await userControlApi.createCompanyGroup(editing);
      setModalOpen(false); load();
    } finally { setSaving(false); }
  };

  const activeBadge = (row: Record<string, unknown>) => {
    const active = row.isActive as boolean;
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{active ? 'Active' : 'Inactive'}</span>;
  };

  return (
    <>
      <DataTable title="Company Groups"
        columns={[
          { key: 'code', header: 'Code', sortable: true, minWidth: '120px' },
          { key: 'description', header: 'Description', sortable: true, minWidth: '120px' },
          { key: 'isActive', header: 'Active', sortable: true, minWidth: '100px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]} loading={loading}
        page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onSearch={() => load()}
        headerActions={<Button size="sm" onClick={openAdd}><Plus size={16} /> Add</Button>}
        rowActions={[{ icon: <Pencil size={16} />, label: 'Edit', variant: 'warning', onClick: (r) => openEdit(r as unknown as CompanyGroup) }]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit Company Group' : 'Add Company Group'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Code *</label>
            <input required maxLength={50} value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <input maxLength={200} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /> Active
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
