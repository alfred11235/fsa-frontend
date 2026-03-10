import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal, useToast } from '@fsa/shared-ui';
import { Plus, Pencil, GitBranch, Network } from 'lucide-react';
import FlowEditorPage from './FlowEditorPage';

interface SystemModule { id: number; code: string; description: string }
interface UserFlow { id: number; code: string; description: string; systemModuleId: number | null; isActive: boolean }
const empty: Partial<UserFlow> = { code: '', description: '', systemModuleId: null, isActive: true };

export default function SystemFlowsPage() {
  const [data, setData] = useState<UserFlow[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<UserFlow>>(empty);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      userControlApi.getUserFlows({ page: 0, size: 100000, sort: 'id,asc' }),
      userControlApi.getSystemModules({ page: 0, size: 100000 }),
    ]).then(([flowRes, modRes]) => {
      setData(flowRes.data?.content ?? flowRes.data ?? []);
      setModules(modRes.data?.content ?? modRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...empty }); setModalOpen(true); };
  const openEdit = (item: UserFlow) => { setEditing({ ...item }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) { await userControlApi.updateUserFlow(editing.id as number, editing as Record<string, unknown>); toast.success('Fluxo atualizado com sucesso.'); }
      else { await userControlApi.createUserFlow(editing as Record<string, unknown>); toast.success('Fluxo criado com sucesso.'); }
      setModalOpen(false);
      load();
    } catch { toast.error('Erro ao salvar fluxo.'); } finally { setSaving(false); }
  };

  const moduleName = (row: Record<string, unknown>) => {
    const mod = modules.find(m => m.id === row.systemModuleId);
    return mod ? mod.code : '—';
  };

  const activeBadge = (row: Record<string, unknown>) => {
    const active = row.isActive as boolean;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Ativo' : 'Inativo'}</span>;
  };

  if (editingFlowId !== null) {
    return <FlowEditorPage flowId={editingFlowId} onBack={() => { setEditingFlowId(null); load(); }} />;
  }

  return (
    <>
      <DataTable title="Fluxos de Sistema"
        icon={<GitBranch size={20} className="text-primary-600" />}
        columns={[
          { key: 'code', header: 'Código', sortable: true, minWidth: '150px' },
          { key: 'description', header: 'Descrição', sortable: true, minWidth: '200px' },
          { key: 'systemModuleId', header: 'Módulo', sortable: true, minWidth: '150px', render: moduleName },
          { key: 'isActive', header: 'Ativo', sortable: true, minWidth: '80px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}
        onSearch={() => {}}
        headerActions={<Button size="sm" variant="success" onClick={openAdd}><Plus size={16} /> Novo</Button>}
        rowActions={[
          { icon: <Pencil size={14} />, label: 'Editar', variant: 'warning', onClick: (r) => openEdit(r as unknown as UserFlow) },
          { icon: <Network size={14} />, label: 'Fluxo', variant: 'info', onClick: (r) => setEditingFlowId((r as unknown as UserFlow).id) },
        ]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Fluxo' : 'Novo Fluxo'}>
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Módulo de Sistema *</label>
            <select required value={editing.systemModuleId ?? ''} onChange={(e) => setEditing({ ...editing, systemModuleId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Selecione...</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.code} — {m.description}</option>)}
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
