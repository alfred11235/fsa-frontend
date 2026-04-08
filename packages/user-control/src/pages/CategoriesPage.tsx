import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Button, Modal, useToast } from '@fsa/shared-ui';
import { Plus, Pencil, Tag } from 'lucide-react';

interface SystemModule { id: number; code: string; description: string }
interface ContractOption { id: number; name: string; description: string }
interface UserFlowOption { id: number; code: string; description: string }
interface CategoryRow {
  id: number;
  code: string;
  description: string;
  systemModule: { id: number; code: string; description: string } | null;
  contract: { id: number; name: string } | null;
  userFlowId: number | null;
  isActive: boolean;
}

const empty: Record<string, unknown> = { code: '', description: '', systemModule: null, contract: null, userFlowId: null, isActive: true };

export default function CategoriesPage() {
  const [data, setData] = useState<CategoryRow[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [userFlows, setUserFlows] = useState<UserFlowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown>>({ ...empty });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      userControlApi.getCategories({ page: 0, size: 100000, sort: 'id,asc' }),
      userControlApi.getSystemModules({ page: 0, size: 100000 }),
      userControlApi.getContracts({ page: 0, size: 100000 }),
      userControlApi.getUserFlows({ page: 0, size: 100000 }),
    ]).then(([catRes, modRes, conRes, flowRes]) => {
      setData(catRes.data?.content ?? catRes.data ?? []);
      setModules(modRes.data?.content ?? modRes.data ?? []);
      setContracts(conRes.data?.content ?? conRes.data ?? []);
      setUserFlows(flowRes.data?.content ?? flowRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ ...empty }); setModalOpen(true); };
  const openEdit = (item: CategoryRow) => {
    setEditing({
      id: item.id,
      code: item.code,
      description: item.description ?? '',
      systemModule: item.systemModule,
      contract: item.contract,
      userFlowId: item.userFlowId,
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...editing };
      if (editing.id) {
        await userControlApi.updateCategory(editing.id as number, payload);
        toast.success('Categoria atualizada com sucesso.');
      } else {
        await userControlApi.createCategory(payload);
        toast.success('Categoria criada com sucesso.');
      }
      setModalOpen(false);
      load();
    } catch { toast.error('Erro ao salvar categoria.'); } finally { setSaving(false); }
  };

  const moduleName = (row: Record<string, unknown>) => {
    const mod = row.systemModule as { code: string } | null;
    return mod ? mod.code : '—';
  };

  const contractName = (row: Record<string, unknown>) => {
    const con = row.contract as { name: string } | null;
    return con ? con.name : '—';
  };

  const flowName = (row: Record<string, unknown>) => {
    const fId = row.userFlowId as number | null;
    if (!fId) return '—';
    const f = userFlows.find(uf => uf.id === fId);
    return f ? f.code : String(fId);
  };

  const activeBadge = (row: Record<string, unknown>) => {
    const active = row.isActive as boolean;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Ativo' : 'Inativo'}</span>;
  };

  const selectedModuleId = (editing.systemModule as { id: number } | null)?.id ?? '';
  const selectedContractId = (editing.contract as { id: number } | null)?.id ?? '';

  return (
    <>
      <DataTable title="Categorias"
        icon={<Tag size={20} className="text-primary-600" />}
        columns={[
          { key: 'code', header: 'Código', sortable: true, minWidth: '120px' },
          { key: 'description', header: 'Descrição', sortable: true, minWidth: '200px' },
          { key: 'systemModule', header: 'Módulo', sortable: false, minWidth: '150px', render: moduleName },
          { key: 'contract', header: 'Contrato', sortable: false, minWidth: '150px', render: contractName },
          { key: 'userFlowId', header: 'Fluxo', sortable: false, minWidth: '120px', render: flowName },
          { key: 'isActive', header: 'Ativo', sortable: true, minWidth: '80px', render: activeBadge },
        ]}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}
        onSearch={() => {}}
        headerActions={<Button size="sm" variant="success" onClick={openAdd}><Plus size={16} /> Nova</Button>}
        rowActions={[
          { icon: <Pencil size={14} />, label: 'Editar', variant: 'warning', onClick: (r) => openEdit(r as unknown as CategoryRow) },
        ]}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código *</label>
            <input required maxLength={50} value={(editing.code as string) ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <input maxLength={200} value={(editing.description as string) ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Módulo de Sistema *</label>
            <select required value={selectedModuleId} onChange={(e) => {
              const mod = modules.find(m => m.id === Number(e.target.value));
              setEditing({ ...editing, systemModule: mod ? { id: mod.id } : null });
            }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Selecione...</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.code} — {m.description}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contrato *</label>
            <select required value={selectedContractId} onChange={(e) => {
              const con = contracts.find(c => c.id === Number(e.target.value));
              setEditing({ ...editing, contract: con ? { id: con.id } : null });
            }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Selecione...</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.name} — {c.description}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fluxo de Usuário</label>
            <select value={(editing.userFlowId as number) ?? ''} onChange={(e) => setEditing({ ...editing, userFlowId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Nenhum</option>
              {userFlows.map(f => <option key={f.id} value={f.id}>{f.code} — {f.description}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={(editing.isActive as boolean) ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
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
