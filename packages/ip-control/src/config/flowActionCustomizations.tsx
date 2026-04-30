/**
 * Per-action customizations for the generic ServiceOrdersByStatusPage.
 *
 * Each key is an Action code (e.g. "Despachar"). The generic page checks
 * this map before opening its default confirmation modal, allowing custom
 * behaviour (extra fields, pre/post hooks) without polluting the generic code.
 */

import type { ReactNode } from 'react';

export interface ActionCustomization {
  /**
   * If provided, replaces the default modal body.
   * Receives helpers to manage custom state and must call `onConfirm` to proceed.
   */
  renderModal?: (ctx: ActionModalContext) => ReactNode;

  /**
   * Called AFTER the flow action has been executed successfully.
   * Use for side-effects (e.g. updating assignedTo on the ServiceOrder).
   */
  afterExecute?: (ctx: AfterExecuteContext) => Promise<void>;
}

export interface ActionModalContext {
  serviceOrderId: number;
  serviceOrderCode: string;
  actionDescription: string;
  contractId: number;
  /** Call this with optional observation to execute the action */
  onConfirm: (observation?: string, extraData?: Record<string, unknown>) => void;
  onCancel: () => void;
  executing: boolean;
  /** Store for custom data set during the modal phase — passed to afterExecute */
  extraData: Record<string, unknown>;
  setExtraData: (data: Record<string, unknown>) => void;
}

export interface AfterExecuteContext {
  serviceOrderId: number;
  extraData: Record<string, unknown>;
}

// ─── Customizations registry ────────────────────────────────────────────────

const customizations: Record<string, ActionCustomization> = {};

export function getActionCustomization(actionCode: string): ActionCustomization | undefined {
  return customizations[actionCode];
}

export function registerActionCustomization(actionCode: string, config: ActionCustomization) {
  customizations[actionCode] = config;
}
