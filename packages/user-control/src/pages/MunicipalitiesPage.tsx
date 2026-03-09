import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal } from '@fsa/shared-ui';
import { Plus, Pencil, Landmark } from 'lucide-react';

interface Municipality { id: number; ibge: number | ''; name: string; state: { id: number } | null; isActive: boolean }
interface State { id: number; description: string; abbreviation: string }
const empty: Partial<Municipality> = { ibge: '', name: '', state: null, isActive: true };

export default function MunicipalitiesPage() {
  const [data, setData] = useState<Municipality[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Municipality>>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getMunicipalities({ page: 0, size: 100000, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? r.data ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    userControlApi.getStates({ size: 1000 }).then((r) => setStates(r.data?.content ?? r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...empty, state: null }); setModalOpen(true); };
  const openEdit = (item: Municipality) => { setEditing({ ...item }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing.id) await userControlApi.updateMunicipality(editing.id, editing);
      else await userControlApi.createMunicipality(editing);
      setModalOpen(false); load();
    } finally { setSaving(false); }
  };

  const activeBadge = (row: Record<string, unknown>) => {
    const active = row.isActive as boolean;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Ativo' : 'Inativo'}</span>;
  };

  return (
    <>
      <DataTable title="Municípios"
        icon={<Landmark size={20} className="text-primary-600" />}
        columns={[
          { key: 'ibge', header: 'IBGE', sortable: true, minWidth: '100px' },
          { key: 'name', header: 'Nome', sortable: true, minWidth: '200px' },
          { key: 'state.description', header: 'Estado', sortable: true, minWidth: '120px' },
          { key: 'isActive', header: 'Ativo', sortable: true, minWidth: '80px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]} loading={loading}
        page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}
        onSearch={() => {}}
        headerActions={<Button size="sm" variant="success" onClick={openAdd}><Plus size={16} /> Novo</Button>}
        rowActions={[{ icon: <Pencil size={14} />, label: 'Editar', variant: 'warning', onClick: (r) => openEdit(r as unknown as Municipality) }]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Município' : 'Novo Município'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">IBGE *</label>
            <input required type="number" value={editing.ibge ?? ''} onChange={(e) => setEditing({ ...editing, ibge: e.target.value ? Number(e.target.value) : '' })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
            <input required maxLength={200} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado *</label>
            <select required value={editing.state?.id ?? ''} onChange={(e) => setEditing({ ...editing, state: e.target.value ? { id: Number(e.target.value) } : null })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Selecione...</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.description} ({s.abbreviation})</option>)}
            </select>
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
