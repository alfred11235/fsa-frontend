import { useEffect, useState, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { DataTable, Modal } from '@fsa/shared-ui';
import { ClipboardList, Eye } from 'lucide-react';

interface HistoryEntry {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

interface History {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  description: string | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email: string } | null;
  entries: HistoryEntry[];
}

export default function HistoriesPage() {
  const [data, setData] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<History | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    userControlApi.getHistories({ page: 0, size: 100000, sort: 'id,desc' })
      .then((r) => {
        setData(r.data?.content ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = (h: History) => { setSelected(h); setDetailOpen(true); };

  const actionRender = (row: Record<string, unknown>) => {
    const action = row.action as string;
    return <span className="text-[13px]">{action}</span>;
  };

  const descriptionRender = (row: Record<string, unknown>) => {
    const desc = row.description as string | null;
    return desc ? <span className="text-[13px] truncate max-w-[200px] inline-block" title={desc}>{desc}</span> : <span className="text-gray-400">—</span>;
  };

  const emailRender = (row: Record<string, unknown>) => {
    const user = row.user as History['user'];
    return user ? <span className="text-[13px]">{user.email}</span> : <span className="text-gray-400">—</span>;
  };

  const dateRender = (row: Record<string, unknown>) => {
    const dt = row.createdAt as string;
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleString('pt-BR');
    } catch { return dt; }
  };

  return (
    <>
      <DataTable
        title="Auditoria"
        icon={<ClipboardList size={20} className="text-primary-600" />}
        columns={[
          { key: 'action', header: 'Operação', sortable: true, minWidth: '90px', render: actionRender },
          { key: 'entityType', header: 'Nome da Tabela', sortable: true, minWidth: '120px' },
          { key: 'entityId', header: 'ID do Registro', sortable: true, minWidth: '100px' },
          { key: 'description', header: 'Registro', sortable: false, minWidth: '160px', render: descriptionRender },
          { key: 'createdAt', header: 'Data de Atualização', sortable: true, minWidth: '160px', render: dateRender },
          { key: 'user.email', header: 'E-mail', sortable: false, minWidth: '180px', render: emailRender },
        ]}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearch={() => {}}
        rowActions={[
          {
            icon: <Eye size={14} />,
            label: 'Detalhes',
            variant: 'info',
            onClick: (r) => openDetail(r as unknown as History),
          },
        ]}
      />

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Auditoria #${selected?.id ?? ''}`}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-500">Tabela:</span>{' '}
                <span className="text-gray-800">{selected.entityType}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">ID do Registro:</span>{' '}
                <span className="text-gray-800">{selected.entityId}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Operação:</span>{' '}
                <span className="text-gray-800">{selected.action}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">E-mail:</span>{' '}
                <span className="text-gray-800">{selected.user?.email ?? '—'}</span>
              </div>
              {selected.description && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-500">Registro:</span>{' '}
                  <span className="text-gray-800">{selected.description}</span>
                </div>
              )}
              <div className="col-span-2">
                <span className="font-medium text-gray-500">Data:</span>{' '}
                <span className="text-gray-800">
                  {selected.createdAt ? new Date(selected.createdAt).toLocaleString('pt-BR') : '—'}
                </span>
              </div>
            </div>

            {selected.entries && selected.entries.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Alterações</h4>
                <div className="overflow-auto rounded border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Campo</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Valor Anterior</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Novo Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selected.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-2 font-medium text-gray-700">{entry.field}</td>
                          <td className="px-3 py-2 text-red-600">{entry.oldValue ?? '—'}</td>
                          <td className="px-3 py-2 text-green-600">{entry.newValue ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!selected.entries || selected.entries.length === 0) && (
              <p className="text-sm text-gray-400">Nenhuma alteração de campo registrada.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
