import type {
  Actor,
  AuditWriter,
  EntityRef,
  TransactionHandle,
} from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

function getClient(txn: TransactionHandle): PoolClient {
  return txn.client as PoolClient;
}

export class DopamsAuditWriter implements AuditWriter {
  async writeTransitionEvent(
    entityRef: EntityRef,
    fromStateId: string,
    toStateId: string,
    transitionId: string,
    actor: Actor,
    remarks: string | undefined,
    txn: TransactionHandle
  ): Promise<void> {
    const client = getClient(txn);
    await client.query(
      `INSERT INTO audit_event (audit_id, entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
       VALUES ($1, $2, $3, 'STATE_CHANGED', $4, $5, $6, $7, $8, $9, NOW())`,
      [
        uuidv4(),
        entityRef.entityType,
        entityRef.entityId,
        fromStateId,
        toStateId,
        transitionId,
        actor.actorType,
        actor.actorId,
        remarks || null,
      ]
    );
  }
}
