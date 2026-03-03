import type { Actor, EntityRef, TaskManager, TransactionHandle } from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

function getClient(txn: TransactionHandle): PoolClient {
  return txn.client as PoolClient;
}

export class ForensicTaskManager implements TaskManager {
  async createTask(entityRef: EntityRef, stateId: string, roleId: string, slaDueAt: Date | null, _metadata: Record<string, unknown>, txn: TransactionHandle): Promise<string> {
    const client = getClient(txn);
    const taskId = uuidv4();
    await client.query(
      `INSERT INTO task (task_id, entity_type, entity_id, state_id, role_id, status, sla_due_at, created_at) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, NOW())`,
      [taskId, entityRef.entityType, entityRef.entityId, stateId, roleId, slaDueAt]
    );
    return taskId;
  }

  async completeCurrentTask(entityRef: EntityRef, actor: Actor, decision: string, remarks: string | undefined, txn: TransactionHandle): Promise<void> {
    const client = getClient(txn);
    await client.query(
      `UPDATE task SET status = 'COMPLETED', completed_at = NOW(), decision = $1, remarks = $2 WHERE entity_id = $3 AND entity_type = $4 AND status IN ('PENDING', 'IN_PROGRESS')`,
      [decision, remarks || null, entityRef.entityId, entityRef.entityType]
    );
  }

  async hasOpenTask(entityRef: EntityRef, stateId: string, txn: TransactionHandle): Promise<boolean> {
    const client = getClient(txn);
    const result = await client.query(
      `SELECT 1 FROM task WHERE entity_id = $1 AND entity_type = $2 AND state_id = $3 AND status IN ('PENDING', 'IN_PROGRESS') LIMIT 1`,
      [entityRef.entityId, entityRef.entityType, stateId]
    );
    return result.rows.length > 0;
  }
}
