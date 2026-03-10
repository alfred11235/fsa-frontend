import { useEffect, useState, useCallback, useRef } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { Button, Modal, useToast } from '@fsa/shared-ui';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* ── Types ── */
interface IdentityDto { entityId: string; entityType: string; [key: string]: unknown }
interface StatusData { dbId?: number; code: string; description: string; isInitial: boolean; [key: string]: unknown }
interface ActionData { code: string; description: string; identities: IdentityDto[]; [key: string]: unknown }
interface RoleOption { id: number; code: string; description: string }
interface UserOption { id: number; firstName: string; lastName: string; email: string }

/* ── Custom Status Node ── */
function StatusNode({ data }: { data: StatusData & { selected?: boolean } }) {
  const border = data.isInitial ? 'border-blue-400' : 'border-gray-300';
  const bg = data.isInitial ? 'bg-blue-50' : 'bg-white';
  return (
    <div className={`rounded-lg border-2 ${border} ${bg} px-4 py-3 shadow-sm min-w-[140px] text-center`}>
      <Handle type="target" position={Position.Top} id="target" className="!bg-gray-400 !w-3 !h-3" />
      <div className="text-xs font-bold text-gray-800">{data.code || 'Novo Status'}</div>
      {data.description && <div className="text-[10px] text-gray-500 mt-0.5">{data.description}</div>}
      <Handle type="source" position={Position.Bottom} id="source" className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = { status: StatusNode };

/* ── Props ── */
interface Props { flowId: number; onBack: () => void }

export default function FlowEditorPage({ flowId, onBack }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [flowCode, setFlowCode] = useState('');

  // Modals
  const [nodeModal, setNodeModal] = useState(false);
  const [editingNode, setEditingNode] = useState<{ id: string; data: StatusData } | null>(null);
  const [edgeModal, setEdgeModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState<{ id: string; data: ActionData } | null>(null);

  // Lookups for Identity
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const nextId = useRef(1);
  const connectingFrom = useRef<string | null>(null);

  // Load roles + users independently (so a flow error doesn't block them)
  useEffect(() => {
    userControlApi.getRoles({ size: 100000 }).then(res => {
      setRoles(res.data?.content ?? []);
    }).catch(() => {});
    userControlApi.getUsers({ size: 100000 }).then(res => {
      setUsers(res.data?.content ?? []);
    }).catch(() => {});
  }, []);

  // Load flow graph
  useEffect(() => {
    setLoading(true);
    userControlApi.getUserFlow(flowId).then(flowRes => {
      const flow = flowRes.data;
      setFlowCode(flow.code);

      const statuses: typeof flow.statuses = flow.statuses ?? [];
      const actions: typeof flow.actions = flow.actions ?? [];

      // Build nodes
      const builtNodes: Node[] = statuses.map((s: any, i: number) => ({
        id: String(s.id),
        type: 'status',
        position: { x: s.positionX ?? 100 + i * 200, y: s.positionY ?? 100 },
        data: { dbId: s.id, code: s.code, description: s.description ?? '', isInitial: s.isInitial ?? false } as StatusData,
      }));
      nextId.current = Math.max(...statuses.map((s: any) => s.id), 0) + 1000;

      // Build edges
      const builtEdges: Edge[] = actions.map((a: any) => ({
        id: `e-${a.id}`,
        source: String(a.statusFrom?.id),
        target: String(a.statusTo?.id),
        sourceHandle: 'source',
        targetHandle: 'target',
        label: a.code,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { code: a.code, description: a.description ?? '', identities: (a.identities ?? []).map((id: any) => ({ entityId: id.entityId, entityType: id.entityType })) } as ActionData,
        style: { strokeWidth: 2 },
      }));

      setNodes(builtNodes);
      setEdges(builtEdges);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [flowId, setNodes, setEdges]);

  // Add new status node
  const addStatus = () => {
    const id = String(nextId.current++);
    setEditingNode({ id, data: { code: '', description: '', isInitial: false } });
    setNodeModal(true);
  };

  // Node double-click to edit
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as StatusData;
    setEditingNode({ id: node.id, data: { ...d } });
    setNodeModal(true);
  }, []);

  // Save node from modal
  const saveNode = () => {
    if (!editingNode) return;
    const existing = nodes.find(n => n.id === editingNode.id);
    if (existing) {
      setNodes(nds => nds.map(n => n.id === editingNode.id ? { ...n, data: { ...editingNode.data } } : n));
    } else {
      const newNode: Node = {
        id: editingNode.id,
        type: 'status',
        position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
        data: { ...editingNode.data } as StatusData,
      };
      setNodes(nds => [...nds, newNode]);
    }
    setNodeModal(false);
    setEditingNode(null);
  };

  // Delete node
  const deleteNode = () => {
    if (!editingNode) return;
    setNodes(nds => nds.filter(n => n.id !== editingNode.id));
    setEdges(eds => eds.filter(e => e.source !== editingNode.id && e.target !== editingNode.id));
    setNodeModal(false);
    setEditingNode(null);
  };

  // Track which node the user started dragging from
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onConnectStart = useCallback((_: any, params: { nodeId: string | null }) => {
    connectingFrom.current = params.nodeId;
  }, []);

  // Connect two nodes → create edge
  // Use connectingFrom ref to guarantee source = the node the user dragged FROM,
  // target = the node the user dropped ON.
  const onConnect = useCallback((conn: Connection) => {
    const origin = connectingFrom.current;
    let src = conn.source;
    let tgt = conn.target;

    // If ReactFlow swapped source/target relative to the actual drag origin, swap back
    if (origin && src !== origin) {
      src = origin;
      tgt = origin === conn.source ? conn.target : conn.source;
    }

    const id = `e-${nextId.current++}`;
    const newEdge = {
      id,
      source: src,
      target: tgt,
      sourceHandle: 'source',
      targetHandle: 'target',
      label: 'Nova Ação',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { code: 'Nova Ação', description: '', identities: [] } as ActionData,
      style: { strokeWidth: 2 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEdges(eds => addEdge(newEdge, eds as any) as Edge[]);
    // Open edit modal for the new edge
    setEditingEdge({ id, data: { code: '', description: '', identities: [] } });
    setEdgeModal(true);
    connectingFrom.current = null;
  }, [setEdges]);

  // Edge double-click to edit
  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const d = edge.data as ActionData | undefined;
    setEditingEdge({ id: edge.id, data: d ?? { code: (edge.label as string) ?? '', description: '', identities: [] } });
    setEdgeModal(true);
  }, []);

  // Save edge from modal
  const saveEdge = () => {
    if (!editingEdge) return;
    setEdges(eds => eds.map(e => e.id === editingEdge.id ? { ...e, label: editingEdge.data.code, data: { ...editingEdge.data } } : e));
    setEdgeModal(false);
    setEditingEdge(null);
  };

  // Delete edge
  const deleteEdge = () => {
    if (!editingEdge) return;
    setEdges(eds => eds.filter(e => e.id !== editingEdge.id));
    setEdgeModal(false);
    setEditingEdge(null);
  };

  // Add identity to current edge
  const addIdentity = () => {
    if (!editingEdge) return;
    setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, identities: [...editingEdge.data.identities, { entityId: '', entityType: 'Role' }] } });
  };

  const removeIdentity = (idx: number) => {
    if (!editingEdge) return;
    const ids = [...editingEdge.data.identities];
    ids.splice(idx, 1);
    setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, identities: ids } });
  };

  const updateIdentity = (idx: number, field: keyof IdentityDto, value: string) => {
    if (!editingEdge) return;
    const ids = [...editingEdge.data.identities];
    ids[idx] = { ...ids[idx], [field]: value };
    setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, identities: ids } });
  };

  // Save entire graph to backend
  const handleSave = async () => {
    setSaving(true);
    try {
      const statusDtos = nodes.map(n => {
        const d = n.data as StatusData;
        return {
          id: d.dbId ?? null,
          tempId: n.id,
          code: d.code,
          description: d.description,
          isInitial: d.isInitial,
          positionX: n.position.x,
          positionY: n.position.y,
        };
      });

      const actionDtos = edges.map(e => {
        const d = e.data as ActionData | undefined;
        return {
          statusFromTempId: e.source,
          statusToTempId: e.target,
          code: d?.code ?? (e.label as string) ?? '',
          description: d?.description ?? '',
          identities: d?.identities ?? [],
        };
      });

      // Frontend validation: exactly one initial status
      const initialCount = statusDtos.filter(s => s.isInitial).length;
      if (initialCount === 0) { toast.error('O fluxo deve ter exatamente um status inicial.'); setSaving(false); return; }
      if (initialCount > 1) { toast.error('O fluxo deve ter apenas um status inicial.'); setSaving(false); return; }

      // Frontend validation: every action must have at least one identity with a selected entity
      for (const a of actionDtos) {
        const validIdentities = a.identities.filter(i => i.entityId && String(i.entityId).trim() !== '');
        if (validIdentities.length === 0) {
          toast.error(`A ação "${a.code || '(sem código)'}" deve ter pelo menos uma identidade.`); setSaving(false);
          return;
        }
      }

      const res = await userControlApi.saveUserFlowGraph(flowId, { statuses: statusDtos, actions: actionDtos });
      if (res.data?.error) { toast.error(res.data.error); setSaving(false); return; }
      // Reload
      const flowRes = await userControlApi.getUserFlow(flowId);
      const flow = flowRes.data;
      const statuses = flow.statuses ?? [];
      const actions = flow.actions ?? [];

      const reloadedNodes: Node[] = statuses.map((s: any, i: number) => ({
        id: String(s.id),
        type: 'status',
        position: { x: s.positionX ?? 100 + i * 200, y: s.positionY ?? 100 },
        data: { dbId: s.id, code: s.code, description: s.description ?? '', isInitial: s.isInitial ?? false } as StatusData,
      }));
      nextId.current = Math.max(...statuses.map((s: any) => s.id), 0) + 1000;

      const reloadedEdges: Edge[] = actions.map((a: any) => ({
        id: `e-${a.id}`,
        source: String(a.statusFrom?.id),
        target: String(a.statusTo?.id),
        sourceHandle: 'source',
        targetHandle: 'target',
        label: a.code,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { code: a.code, description: a.description ?? '', identities: (a.identities ?? []).map((id: any) => ({ entityId: id.entityId, entityType: id.entityType })) } as ActionData,
        style: { strokeWidth: 2 },
      }));

      setNodes(reloadedNodes);
      setEdges(reloadedEdges);
      toast.success('Fluxo salvo com sucesso.');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Erro ao salvar o fluxo.';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded p-1 text-gray-500 hover:bg-gray-100"><ArrowLeft size={20} /></button>
          <h2 className="text-base font-semibold text-gray-800">Editor de Fluxo — {flowCode}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addStatus}><Plus size={14} /> Status</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>

      {/* Hint */}
      <div className="bg-blue-50 px-4 py-1.5 text-[11px] text-blue-700 border-b border-blue-100">
        Arraste da bolinha inferior de um status para a bolinha superior de outro para criar uma ação. Clique duplo em status ou ação para editar.
      </div>

      {/* Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as (changes: NodeChange[]) => void}
          onEdgesChange={onEdgesChange as (changes: EdgeChange[]) => void}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          className="bg-gray-50"
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} />
        </ReactFlow>
      </div>

      {/* ── Node (Status) Modal ── */}
      <Modal open={nodeModal} onClose={() => { setNodeModal(false); setEditingNode(null); }} title="Editar Status">
        {editingNode && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Código *</label>
              <input required maxLength={50} value={editingNode.data.code} onChange={(e) => setEditingNode({ ...editingNode, data: { ...editingNode.data, code: e.target.value } })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
              <input maxLength={200} value={editingNode.data.description} onChange={(e) => setEditingNode({ ...editingNode, data: { ...editingNode.data, description: e.target.value } })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editingNode.data.isInitial} onChange={(e) => {
                  if (e.target.checked) {
                    // Uncheck isInitial on all other nodes
                    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isInitial: false } })));
                  }
                  setEditingNode({ ...editingNode, data: { ...editingNode.data, isInitial: e.target.checked } });
                }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400" /> Status Inicial
              </label>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={deleteNode} className="text-red-600 border-red-300 hover:bg-red-50"><Trash2 size={14} /> Remover</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setNodeModal(false); setEditingNode(null); }}>Cancelar</Button>
                <Button onClick={saveNode}>Salvar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edge (Action) Modal ── */}
      <Modal open={edgeModal} onClose={() => { setEdgeModal(false); setEditingEdge(null); }} title="Editar Ação">
        {editingEdge && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Código *</label>
              <input required maxLength={50} value={editingEdge.data.code} onChange={(e) => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, code: e.target.value } })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
              <input maxLength={200} value={editingEdge.data.description} onChange={(e) => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, description: e.target.value } })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>

            {/* Identities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Identidades (quem pode executar)</label>
                <button type="button" onClick={addIdentity} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
              {editingEdge.data.identities.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma identidade definida.</p>
              )}
              {editingEdge.data.identities.map((ident, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <select value={ident.entityType} onChange={(e) => {
                    const ids = [...editingEdge.data.identities];
                    ids[idx] = { ...ids[idx], entityType: e.target.value, entityId: '' };
                    setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, identities: ids } });
                  }}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-28">
                    <option value="Role">Função</option>
                    <option value="User">Usuário</option>
                  </select>
                  {ident.entityType === 'Role' ? (
                    <select value={ident.entityId} onChange={(e) => updateIdentity(idx, 'entityId', e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      <option value="">Selecione...</option>
                      {roles.map(r => <option key={r.id} value={String(r.id)}>{r.description} ({r.code})</option>)}
                    </select>
                  ) : (
                    <select value={ident.entityId} onChange={(e) => updateIdentity(idx, 'entityId', e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      <option value="">Selecione...</option>
                      {users.map(u => <option key={u.id} value={String(u.id)}>{u.firstName} {u.lastName} ({u.email})</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => removeIdentity(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={deleteEdge} className="text-red-600 border-red-300 hover:bg-red-50"><Trash2 size={14} /> Remover</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEdgeModal(false); setEditingEdge(null); }}>Cancelar</Button>
                <Button onClick={saveEdge}>Salvar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
