import { useState, useCallback, useRef } from 'react';
import { topoNetworkApi } from '@fsa/shared-api';
import type { PointRequest, WireRequest } from '@fsa/shared-api';

// ─── Action types ───────────────────────────────────────────────

type WireType = 'mt' | 'lt';

interface CreatePointAction {
  type: 'create-point';
  /** ID of the created point (captured from API response) */
  createdId: number;
  /** The request data used to create it (for redo) */
  requestData: PointRequest;
}

interface DeletePointAction {
  type: 'delete-point';
  /** ID that was deleted */
  deletedId: number;
  /** Full snapshot fetched before deletion (for undo re-creation) */
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

// ─── Hook ───────────────────────────────────────────────────────

export interface EditorHistory {
  /** Push a completed action onto the history (clears redo stack) */
  push: (action: EditorAction) => void;
  /** Undo the last action. Returns false if nothing to undo or if the undo failed. */
  undo: () => Promise<boolean>;
  /** Redo the last undone action. Returns false if nothing to redo or if the redo failed. */
  redo: () => Promise<boolean>;
  /** Whether there are actions to undo */
  canUndo: boolean;
  /** Whether there are actions to redo */
  canRedo: boolean;
  /** Whether an undo/redo operation is currently in progress */
  busy: boolean;
  /** The full undo stack (most recent last) */
  undoStack: EditorAction[];
  /** The full redo stack (most recent last) */
  redoStack: EditorAction[];
}

export function useEditorHistory(onAfterAction?: () => void): EditorHistory {
  const [undoStack, setUndoStack] = useState<EditorAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditorAction[]>([]);
  const [busy, setBusy] = useState(false);

  const onAfterActionRef = useRef(onAfterAction);
  onAfterActionRef.current = onAfterAction;

  const push = useCallback((action: EditorAction) => {
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]); // new action clears redo history
  }, []);

  // ── Execute the inverse of an action (undo) ──

  const executeUndo = useCallback(async (action: EditorAction): Promise<EditorAction | null> => {
    switch (action.type) {
      case 'create-point': {
        // Undo create → delete
        await topoNetworkApi.deleteGeographicPoint(action.createdId);
        return action;
      }
      case 'delete-point': {
        // Undo delete → re-create from snapshot
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
        const newId = (res.data as Record<string, unknown>).id as number;
        // Return modified action so redo knows the new ID
        return { ...action, deletedId: newId };
      }
      case 'move-point': {
        // Undo move → move back to old position
        await topoNetworkApi.updateGeographicPoint(action.pointId, {
          lng: action.oldLng,
          lat: action.oldLat,
        });
        return action;
      }
      case 'create-wire': {
        // Undo create → delete
        if (action.wireType === 'mt') {
          await topoNetworkApi.deleteMTWire(action.createdId);
        } else {
          await topoNetworkApi.deleteLTWire(action.createdId);
        }
        return action;
      }
      case 'delete-wire': {
        // Undo delete → re-create from snapshot
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
        return { ...action, deletedId: newId };
      }
      case 'edit-wire': {
        // Undo edit → reassign back to old point
        const payload: Partial<WireRequest> = action.endpoint === 'start'
          ? { geographicPointStartId: action.oldPointId }
          : { geographicPointEndId: action.oldPointId };
        if (action.wireType === 'mt') {
          await topoNetworkApi.updateMTWire(action.wireId, payload);
        } else {
          await topoNetworkApi.updateLTWire(action.wireId, payload);
        }
        return action;
      }
      default:
        return null;
    }
  }, []);

  // ── Execute the forward replay of an action (redo) ──

  const executeRedo = useCallback(async (action: EditorAction): Promise<EditorAction | null> => {
    switch (action.type) {
      case 'create-point': {
        // Redo create → create again
        const res = await topoNetworkApi.createGeographicPoint(action.requestData);
        const newId = (res.data as Record<string, unknown>).id as number;
        return { ...action, createdId: newId };
      }
      case 'delete-point': {
        // Redo delete → fetch snapshot then delete
        const snapRes = await topoNetworkApi.getGeographicPoint(action.deletedId);
        const snapshot = snapRes.data as Record<string, unknown>;
        await topoNetworkApi.deleteGeographicPoint(action.deletedId);
        return { ...action, snapshot };
      }
      case 'move-point': {
        // Redo move → move to new position
        await topoNetworkApi.updateGeographicPoint(action.pointId, {
          lng: action.newLng,
          lat: action.newLat,
        });
        return action;
      }
      case 'create-wire': {
        // Redo create → create again
        let newId: number;
        if (action.wireType === 'mt') {
          const res = await topoNetworkApi.createMTWire(action.requestData);
          newId = (res.data as Record<string, unknown>).id as number;
        } else {
          const res = await topoNetworkApi.createLTWire(action.requestData);
          newId = (res.data as Record<string, unknown>).id as number;
        }
        return { ...action, createdId: newId };
      }
      case 'delete-wire': {
        // Redo delete → fetch snapshot then delete
        let snapshot: Record<string, unknown>;
        if (action.wireType === 'mt') {
          const snapRes = await topoNetworkApi.getMTWire(action.deletedId);
          snapshot = snapRes.data as Record<string, unknown>;
          await topoNetworkApi.deleteMTWire(action.deletedId);
        } else {
          const snapRes = await topoNetworkApi.getLTWire(action.deletedId);
          snapshot = snapRes.data as Record<string, unknown>;
          await topoNetworkApi.deleteLTWire(action.deletedId);
        }
        return { ...action, snapshot };
      }
      case 'edit-wire': {
        // Redo edit → reassign to new point
        const payload: Partial<WireRequest> = action.endpoint === 'start'
          ? { geographicPointStartId: action.newPointId }
          : { geographicPointEndId: action.newPointId };
        if (action.wireType === 'mt') {
          await topoNetworkApi.updateMTWire(action.wireId, payload);
        } else {
          await topoNetworkApi.updateLTWire(action.wireId, payload);
        }
        return action;
      }
      default:
        return null;
    }
  }, []);

  const undo = useCallback(async (): Promise<boolean> => {
    const stack = undoStack;
    if (stack.length === 0) return false;

    const action = stack[stack.length - 1];
    setBusy(true);
    try {
      const result = await executeUndo(action);
      if (!result) return false;
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, result]);
      onAfterActionRef.current?.();
      return true;
    } catch (err) {
      console.error('[EditorHistory] Undo failed:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [undoStack, executeUndo]);

  const redo = useCallback(async (): Promise<boolean> => {
    const stack = redoStack;
    if (stack.length === 0) return false;

    const action = stack[stack.length - 1];
    setBusy(true);
    try {
      const result = await executeRedo(action);
      if (!result) return false;
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, result]);
      onAfterActionRef.current?.();
      return true;
    } catch (err) {
      console.error('[EditorHistory] Redo failed:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [redoStack, executeRedo]);

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    busy,
    undoStack,
    redoStack,
  };
}
