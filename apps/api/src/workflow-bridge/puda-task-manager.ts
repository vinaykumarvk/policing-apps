/**
 * TaskManager for PUDA — manages task records in the `task` table.
 */
import type {
  Actor,
  EntityRef,
  TaskManager,
  TransactionHandle,
} from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { logInfo, logWarn } from "../logger";

function getClient(txn: TransactionHandle): PoolClient {
  return txn.client as PoolClient;
}

export class PudaTaskManager implements TaskManager {
  async createTask(
    entityRef: EntityRef,
    stateId: string,
    roleId: string,
    slaDueAt: Date | null,
    metadata: Record<string, unknown>,
    txn: TransactionHandle
  ): Promise<string> {
    const client = getClient(txn);
    const taskId = uuidv4();

    await client.query(
      "INSERT INTO task (task_id, arn, state_id, system_role_id, status, sla_due_at) VALUES ($1, $2, $3, $4, 'PENDING', $5)",
      [taskId, entityRef.entityId, stateId, roleId, slaDueAt]
    );

    // Auto-create inspection record if the state requires site verification
    try {
      const { maybeCreateInspectionForTask } = await import("../inspections");
      // Reconstruct the state-like object that maybeCreateInspectionForTask expects
      const stateObj = { stateId, taskUi: metadata.taskUi } as any;
      const inspection = await maybeCreateInspectionForTask(
        entityRef.entityId,
        taskId,
        stateId,
        roleId,
        stateObj,
        client
      );
      if (inspection) {
        logInfo("Auto-created inspection for workflow task", {
          arn: entityRef.entityId,
          taskId,
          stateId,
          inspectionId: inspection.inspection_id,
        });
      }
    } catch (inspErr: any) {
      logWarn("Failed to auto-create inspection for workflow task", {
        arn: entityRef.entityId,
        taskId,
        stateId,
        error: inspErr?.message || "unknown_error",
      });
    }

    return taskId;
  }

  async completeCurrentTask(
    entityRef: EntityRef,
    actor: Actor,
    decision: string,
    remarks: string | undefined,
    txn: TransactionHandle
  ): Promise<void> {
    const client = getClient(txn);
    await client.query(
      "UPDATE task SET status = 'COMPLETED', completed_at = NOW(), decision = $1, remarks = $2 WHERE arn = $3 AND status IN ('PENDING', 'IN_PROGRESS') AND assignee_user_id = $4",
      [decision, remarks || null, entityRef.entityId, actor.actorId]
    );
  }

  async hasOpenTask(
    entityRef: EntityRef,
    stateId: string,
    txn: TransactionHandle
  ): Promise<boolean> {
    const client = getClient(txn);
    const result = await client.query(
      "SELECT 1 FROM task WHERE arn = $1 AND state_id = $2 AND status IN ('PENDING', 'IN_PROGRESS') LIMIT 1",
      [entityRef.entityId, stateId]
    );
    return result.rows.length > 0;
  }
}
