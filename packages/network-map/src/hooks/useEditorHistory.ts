import { useState, useCallback, useRef, useEffect } from 'react';
import { topoNetworkApi } from '@fsa/shared-api';
import type { PointRequest, WireRequest } from '@fsa/shared-api';

// ─── Action types ───────────────────────────────────────────────

type WireType = 'mt' | 'lt';

interface CreatePointAction {
  type: 'create-point';
  createdId: number;
  requestData: PointRequest;
}

interface DeletePointAction {
  type: 'delete-point';
  deletedId: number;
  snapshot: Record<string, unknown>;
}

interface MovePointAction {
  type: 'move-point';
  pointId: number;
  oldLng: number;
  oldLat: number;
  newLng: number;
  newLat: number;
}

interface CreateWireAction {
  type: 'create-wire';
  wireType: WireType;
  createdId: number;
  requestData: WireRequest;
}

interface DeleteWireAction {
  type: 'delete-wire';
  wireType: WireType;
  deletedId: number;
  snapshot: Record<string, unknown>;
}

interface EditWireAction {
  type: 'edit-wire';
  wireType: WireType;
  wireId: number;
  endpoint: 'start' | 'end';
  oldPointId: number;
  newPointId: number;
}

export type EditorAction =
  | CreatePointAction
  | DeletePointAction
  | MovePointAction
  | CreateWireAction
  | DeleteWireAction
  | EditWireAction;

// ─── Helper: map server action DTO back to EditorAction ─────────

function serverToAction(dto: Record<string, unknown>): EditorAction | null {
  const actionType = dto.actionType as string;
  const beforeData = (dto.beforeData as Record<string, unknown>) ?? {};
  const afterData = (dto.afterData as Record<string, unknown>) ?? {};
  const entityId = dto.entityId as number;

  switch (actionType) {
    case 'create-point':
      return { type: 'create-point', createdId: entityId, requestData: afterData as unknown as PointRequest };
    case 'delete-point':
      return { type: 'delete-point', deletedId: entityId, snapshot: beforeData };
    case 'move-point':
      return {
        type: 'move-point',
        pointId: entityId,
        oldLng: beforeData.lng as number,
        oldLat: beforeData.lat as number,
        newLng: afterData.lng as number,
        newLat: afterData.lat as number,
      };
    case 'create-wire':
      return {
        type: 'create-wire',
        wireType: (afterData.wireType as WireType) ?? 'mt',
        createdId: entityId,
        requestData: afterData as unknown as WireRequest,
      };
    case 'delete-wire':
      return {
        type: 'delete-wire',
        wireType: (beforeData.wireType as WireType) ?? 'mt',
        deletedId: entityId,
        snapshot: beforeData,
      };
    case 'edit-wire':
      return {
        type: 'edit-wire',
        wireType: (afterData.wireType as WireType) ?? 'mt',
        wireId: entityId,
        endpoint: (afterData.endpoint as 'start' | 'end') ?? 'start',
        oldPointId: beforeData.pointId as number,
        newPointId: afterData.pointId as number,
      };
    default:
      return null;
  }
}

// ─── Helper: build before/after data for server storage ─────────

function actionToServerData(action: EditorAction): {
  actionType: string;
  entityType: string;
  entityId: number | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
} {
  switch (action.type) {
    case 'create-point':
      return {
        actionType: 'create-point',
        entityType: 'geographic-point',
        entityId: action.createdId,
        beforeData: null,
        afterData: action.requestData as unknown as Record<string, unknown>,
      };
    case 'delete-point':
      return {
        actionType: 'delete-point',
        entityType: 'geographic-point',
        entityId: action.deletedId,
        beforeData: action.snapshot,
        afterData: null,
      };
    case 'move-point':
      return {
        actionType: 'move-point',
        entityType: 'geographic-point',
        entityId: action.pointId,
        beforeData: { lng: action.oldLng, lat: action.oldLat },
        afterData: { lng: action.newLng, lat: action.newLat },
      };
    case 'create-wire':
      return {
        actionType: 'create-wire',
        entityType: action.wireType === 'mt' ? 'mt-wire' : 'lt-wire',
        entityId: action.createdId,
        beforeData: null,
        afterData: { ...action.requestData as unknown as Record<string, unknown>, wireType: action.wireType },
      };
    case 'delete-wire':
      return {
        actionType: 'delete-wire',
        entityType: action.wireType === 'mt' ? 'mt-wire' : 'lt-wire',
        entityId: action.deletedId,
        beforeData: { ...action.snapshot, wireType: action.wireType },
        afterData: null,
      };
    case 'edit-wire':
      return {
        actionType: 'edit-wire',
        entityType: action.wireType === 'mt' ? 'mt-wire' : 'lt-wire',
        entityId: action.wireId,
        beforeData: { pointId: action.oldPointId, wireType: action.wireType, endpoint: action.endpoint },
        afterData: { pointId: action.newPointId, wireType: action.wireType, endpoint: action.endpoint },
      };
  }
}

// ─── Hook ───────────────────────────────────────────────────────

export interface EditorHistoryOptions {
  /** ID of the current user — each user only sees/undoes their own actions */
  userId: number;
  /** Maximum undo entries stored per user on the server (default 50) */
  maxEntries?: number;
}

export interface EditorHistory {
  /** Push a completed action — persists to server and clears redo stack */
  push: (action: EditorAction) => void;
  /** Undo the last action for this user. Returns false if nothing to undo. */
  undo: () => Promise<boolean>;
  /** Redo the last undone action for this user. Returns false if nothing to redo. */
  redo: () => Promise<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  undoCount: number;
  redoCount: number;
}

export function useEditorHistory(
  options: EditorHistoryOptions,
  onAfterAction?: () => void,
): EditorHistory {
  const { userId, maxEntries = 50 } = options;
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const onAfterActionRef = useRef(onAfterAction);
  onAfterActionRef.current = onAfterAction;

  // Fetch initial counts from server
  useEffect(() => {
    if (!userId) return;
    topoNetworkApi.getEditorHistoryStatus(userId).then((res) => {
      const data = res.data as { undoCount: number; redoCount: number };
      setUndoCount(data.undoCount);
      setRedoCount(data.redoCount);
    }).catch(() => { /* ignore */ });
  }, [userId]);

  // ── Record a new action to the server ──

  const push = useCallback(
    (action: EditorAction) => {
      const serverData = actionToServerData(action);
      topoNetworkApi
        .recordEditorAction({ userId, ...serverData, maxEntries })
        .then(() => {
          setUndoCount((prev) => Math.min(prev + 1, maxEntries));
          setRedoCount(0);
        })
        .catch((err) => console.error('[EditorHistory] Failed to record action:', err));
    },
    [userId, maxEntries],
  );

  // ── Execute the inverse of an action (undo) ──

  const executeUndo = useCallback(async (action: EditorAction): Promise<number | null> => {
    switch (action.type) {
      case 'create-point': {
        await topoNetworkApi.deleteGeographicPoint(action.createdId);
        return null;
      }
      case 'delete-point': {
        const snap = action.snapshot;
        const data: PointRequest = {
          lng: snap.lng as number,
          lat: snap.lat as number,
          geographicPointTypeId: (snap.geographicPointTypeId as number) ?? null,
          basement: (snap.basement as string) ?? null,
          ownerId: (snap.ownerId as number) ?? null,
          materialId: (snap.materialId as number) ?? null,
          heightId: (snap.heightId as number) ?? null,
          effortId: (snap.effortId as number) ?? null,
          municipalityId: (snap.municipalityId as number) ?? null,
          zone: (snap.zone as string) ?? null,
          address: (snap.address as string) ?? null,
          neighborhood: (snap.neighborhood as string) ?? null,
        };
        const res = await topoNetworkApi.createGeographicPoint(data);
        return (res.data as Record<string, unknown>).id as number;
      }
      case 'move-point': {
        await topoNetworkApi.updateGeographicPoint(action.pointId, {
          lng: action.oldLng,
          lat: action.oldLat,
        });
        return null;
      }
      case 'create-wire': {
        if (action.wireType === 'mt') {
          await topoNetworkApi.deleteMTWire(action.createdId);
        } else {
          await topoNetworkApi.deleteLTWire(action.createdId);
        }
        return null;
      }
      case 'delete-wire': {
        const snap = action.snapshot;
        const data: WireRequest = {
          geographicPointStartId: snap.geographicPointStartId as number,
          geographicPointEndId: snap.geographicPointEndId as number,
          wireOfLine: (snap.wireOfLine as string) ?? null,
          feederId: (snap.feederId as number) ?? null,
          transformerParentId: (snap.transformerParentId as number) ?? null,
        };
        let newId: number;
        if (action.wireType === 'mt') {
          const res = await topoNetworkApi.createMTWire(data);
          newId = (res.data as Record<string, unknown>).id as number;
        } else {
          const res = await topoNetworkApi.createLTWire(data);
          newId = (res.data as Record<string, unknown>).id as number;
        }
        return newId;
      }
      case 'edit-wire': {
        const payload: Partial<WireRequest> = action.endpoint === 'start'
          ? { geographicPointStartId: action.oldPointId }
          : { geographicPointEndId: action.oldPointId };
        if (action.wireType === 'mt') {
          await topoNetworkApi.updateMTWire(action.wireId, payload);
        } else {
          await topoNetworkApi.updateLTWire(action.wireId, payload);
        }
        return null;
      }
      default:
        return null;
    }
  }, []);

  // ── Execute the forward replay of an action (redo) ──

  const executeRedo = useCallback(async (action: EditorAction): Promise<number | null> => {
    switch (action.type) {
      case 'create-point': {
        const res = await topoNetworkApi.createGeographicPoint(action.requestData);
        return (res.data as Record<string, unknown>).id as number;
      }
      case 'delete-point': {
        await topoNetworkApi.deleteGeographicPoint(action.deletedId);
        return null;
      }
      case 'move-point': {
        await topoNetworkApi.updateGeographicPoint(action.pointId, {
          lng: action.newLng,
          lat: action.newLat,
        });
        return null;
      }
      case 'create-wire': {
        let newId: number;
        if (action.wireType === 'mt') {
          const res = await topoNetworkApi.createMTWire(action.requestData);
          newId = (res.data as Record<string, unknown>).id as number;
        } else {
          const res = await topoNetworkApi.createLTWire(action.requestData);
          newId = (res.data as Record<string, unknown>).id as number;
        }
        return newId;
      }
      case 'delete-wire': {
        if (action.wireType === 'mt') {
          await topoNetworkApi.deleteMTWire(action.deletedId);
        } else {
          await topoNetworkApi.deleteLTWire(action.deletedId);
        }
        return null;
      }
      case 'edit-wire': {
        const payload: Partial<WireRequest> = action.endpoint === 'start'
          ? { geographicPointStartId: action.newPointId }
          : { geographicPointEndId: action.newPointId };
        if (action.wireType === 'mt') {
          await topoNetworkApi.updateMTWire(action.wireId, payload);
        } else {
          await topoNetworkApi.updateLTWire(action.wireId, payload);
        }
        return null;
      }
      default:
        return null;
    }
  }, []);

  // ── Undo: get action from server, execute inverse, update server ──

  const undo = useCallback(async (): Promise<boolean> => {
    if (undoCount === 0) return false;
    setBusy(true);
    try {
      // Ask server which action to undo (marks it as undone)
      const res = await topoNetworkApi.undoEditorAction(userId);
      const dto = res.data as Record<string, unknown>;
      if (dto.empty) return false;

      const action = serverToAction(dto);
      if (!action) return false;

      const historyId = dto.id as number;
      const newEntityId = await executeUndo(action);

      // If undo re-created an entity, update the server entry with the new ID
      if (newEntityId != null) {
        await topoNetworkApi.updateEditorHistoryEntityId(historyId, newEntityId);
      }

      setUndoCount((prev) => Math.max(0, prev - 1));
      setRedoCount((prev) => prev + 1);
      onAfterActionRef.current?.();
      return true;
    } catch (err) {
      console.error('[EditorHistory] Undo failed:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId, undoCount, executeUndo]);

  // ── Redo: get action from server, execute forward, update server ──

  const redo = useCallback(async (): Promise<boolean> => {
    if (redoCount === 0) return false;
    setBusy(true);
    try {
      // Ask server which action to redo (marks it as not-undone)
      const res = await topoNetworkApi.redoEditorAction(userId);
      const dto = res.data as Record<string, unknown>;
      if (dto.empty) return false;

      const action = serverToAction(dto);
      if (!action) return false;

      const historyId = dto.id as number;
      const newEntityId = await executeRedo(action);

      // If redo re-created an entity, update the server entry with the new ID
      if (newEntityId != null) {
        await topoNetworkApi.updateEditorHistoryEntityId(historyId, newEntityId);
      }

      setRedoCount((prev) => Math.max(0, prev - 1));
      setUndoCount((prev) => prev + 1);
      onAfterActionRef.current?.();
      return true;
    } catch (err) {
      console.error('[EditorHistory] Redo failed:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId, redoCount, executeRedo]);

  return {
    push,
    undo,
    redo,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    busy,
    undoCount,
    redoCount,
  };
}
