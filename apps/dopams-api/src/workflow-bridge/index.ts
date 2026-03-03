import { getDopamsEngine } from "./engine-factory";
import type { TransactionHandle } from "@puda/workflow-engine";
import pg from "pg";

export async function executeTransition(
  entityId: string,
  entityType: string,
  transitionId: string,
  actorUserId: string,
  actorType: string,
  actorRoles: string[],
  remarks?: string,
  payload?: Record<string, unknown>,
  existingClient?: pg.PoolClient
): Promise<{ success: boolean; newStateId?: string; error?: string }> {
  const engine = getDopamsEngine();

  const existingTxn: TransactionHandle | undefined = existingClient
    ? { client: existingClient }
    : undefined;

  const result = await engine.executeTransition(
    {
      entityRef: { entityId, entityType },
      transitionId,
      actor: { actorId: actorUserId, actorType, roles: actorRoles },
      remarks,
      payload,
    },
    existingTxn
  );

  return {
    success: result.success,
    newStateId: result.newStateId,
    error: result.errorCode ?? result.error,
  };
}
