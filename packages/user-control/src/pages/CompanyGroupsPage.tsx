import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil, Layers } from 'lucide-react';

interface CompanyGroup { id: number; code: string; description: string; isActive: boolean }
const empty = { code: '', description: '', isActive: true };

export default function CompanyGroupsPage() {
  const [data, setData] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CompanyGroup>>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getCompanyGroups({ page: 0, size: 100000, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

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
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Ativo' : 'Inativo'}</span>;
  };

  return (
    <>
      <DataTable title="Grupos de Empresas"
        icon={<Layers size={20} className="text-primary-600" />}
        columns={[
          { key: 'code', header: 'Código', sortable: true, minWidth: '120px' },
          { key: 'description', header: 'Descrição', sortable: true, minWidth: '120px' },
          { key: 'isActive', header: 'Ativo', sortable: true, minWidth: '100px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]} loading={loading}
        page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} onSearch={() => {}}
        headerActions={<Button size="sm" variant="success" onClick={openAdd}><Plus size={16} /> Novo</Button>}
        rowActions={[{ icon: <Pencil size={14} />, label: 'Editar', variant: 'warning', onClick: (r) => openEdit(r as unknown as CompanyGroup) }]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Grupo de Empresa' : 'Novo Grupo de Empresa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código *</label>
            <input required maxLength={50} value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <input maxLength={200} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /> Ativo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing.id ? 'Atualizar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
