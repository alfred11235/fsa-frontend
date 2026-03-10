import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal, useToast } from '@fsa/shared-ui';
import { Plus, Pencil, Shield } from 'lucide-react';

interface PolicyGroup { id: number; code: string; description: string }
interface Policy { id: number; code: string; description: string; isActive: boolean; policyGroup?: PolicyGroup }
const empty: Partial<Policy> = { code: '', description: '', isActive: true, policyGroup: undefined };

export default function PoliciesPage() {
  const [data, setData] = useState<Policy[]>([]);
  const [policyGroups, setPolicyGroups] = useState<PolicyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Policy>>(empty);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getPolicies({ page: 0, size: 100000, sort: 'id,asc' })
      .then((r) => { setData(r.data?.content ?? r.data ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    userControlApi.getPolicyGroupsPaged({ page: 0, size: 100000 })
      .then((r) => setPolicyGroups(r.data?.content ?? r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...empty }); setModalOpen(true); };
  const openEdit = (item: Policy) => { setEditing({ ...item }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { code: editing.code, description: editing.description, isActive: editing.isActive, policyGroup: editing.policyGroup ? { id: editing.policyGroup.id } : undefined };
      if (editing.id) { await userControlApi.updatePolicy(editing.id, payload); toast.success('Política atualizada com sucesso.'); }
      else { await userControlApi.createPolicy(payload); toast.success('Política criada com sucesso.'); }
      setModalOpen(false); load();
    } catch { toast.error('Erro ao salvar política.'); } finally { setSaving(false); }
  };

  const activeBadge = (row: Record<string, unknown>) => {
    const active = row.isActive as boolean;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Ativo' : 'Inativo'}</span>;
  };

  const groupRender = (row: Record<string, unknown>) => {
    const pg = row.policyGroup as PolicyGroup | null;
    return pg ? <span className="text-[13px]">{pg.code}</span> : <span className="text-gray-400">—</span>;
  };

  return (
    <>
      <DataTable title="Políticas"
        icon={<Shield size={20} className="text-primary-600" />}
        columns={[
          { key: 'code', header: 'Código', sortable: true, minWidth: '150px' },
          { key: 'description', header: 'Descrição', sortable: true, minWidth: '200px' },
          { key: 'policyGroup', header: 'Grupo', sortable: false, minWidth: '120px', render: groupRender },
          { key: 'isActive', header: 'Ativo', sortable: true, minWidth: '80px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]} loading={loading}
        page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}
        onSearch={() => {}}
        headerActions={<Button size="sm" variant="success" onClick={openAdd}><Plus size={16} /> Novo</Button>}
        rowActions={[{ icon: <Pencil size={14} />, label: 'Editar', variant: 'warning', onClick: (r) => openEdit(r as unknown as Policy) }]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Política' : 'Nova Política'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código *</label>
            <input required maxLength={100} value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <input maxLength={200} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Grupo de Política *</label>
            <select required value={editing.policyGroup?.id ?? ''} onChange={(e) => setEditing({ ...editing, policyGroup: e.target.value ? { id: Number(e.target.value), code: '', description: '' } : undefined })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Selecione...</option>
              {policyGroups.map((pg) => <option key={pg.id} value={pg.id}>{pg.code} — {pg.description}</option>)}
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
