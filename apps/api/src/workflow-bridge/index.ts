/**
 * PUDA Workflow Bridge — backward-compatible wrapper.
 *
 * Exposes the exact same `executeTransition` signature as the original
 * workflow.ts so all callers (applications.ts, tasks.ts, routes) work
 * unchanged.
 */
import pg from "pg";
import { getPudaEngine } from "./puda-engine-factory";
import type { TransactionHandle } from "@puda/workflow-engine";

// Re-export legacy types for backward compatibility
export type { LegacyWorkflowConfig as WorkflowConfig } from "./config-converter";
export type { LegacyWorkflowState as WorkflowState } from "./config-converter";
export type { LegacyWorkflowTransition as WorkflowTransition } from "./config-converter";

export async function executeTransition(
  arn: string,
  transitionId: string,
  actorUserId: string,
  actorType: "CITIZEN" | "OFFICER" | "SYSTEM",
  actorSystemRoles: string[],
  remarks?: string,
  actionPayload?: any,
  existingClient?: pg.PoolClient
): Promise<{ success: boolean; newStateId?: string; error?: string }> {
  const engine = getPudaEngine();

  const existingTxn: TransactionHandle | undefined = existingClient
    ? { client: existingClient }
    : undefined;

  const result = await engine.executeTransition(
    {
      entityRef: { entityId: arn, entityType: "application" },
      transitionId,
      actor: {
        actorId: actorUserId,
        actorType,
        roles: actorSystemRoles,
      },
      remarks,
      payload: actionPayload,
    },
    existingTxn
  );

  return {
    success: result.success,
    newStateId: result.newStateId,
    error: result.errorCode ?? result.error,
  };
}
