/**
 * AuditWriter for PUDA — writes status history to data_jsonb and audit_event records.
 */
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

export class PudaAuditWriter implements AuditWriter {
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
    const arn = entityRef.entityId;

    // 1. Append status change to data_jsonb.application.statusHistory
    const statusChange = {
      from: fromStateId,
      to: toStateId,
      changedAt: new Date().toISOString(),
      changedBy: actor.actorId,
      changedByRole: actor.actorType === "OFFICER" ? actor.roles[0] : actor.actorType,
      remarks: remarks || undefined,
    };

    await client.query(
      `UPDATE application
         SET data_jsonb = jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(data_jsonb, '{}'::jsonb),
               '{application}',
               COALESCE(data_jsonb->'application', '{}'::jsonb),
               true
             ),
             '{application,status}',
             to_jsonb($1::text),
             true
           ),
           '{application,statusHistory}',
           COALESCE(
             CASE
               WHEN jsonb_typeof(data_jsonb->'application'->'statusHistory') = 'array'
                 THEN data_jsonb->'application'->'statusHistory'
               ELSE '[]'::jsonb
             END,
             '[]'::jsonb
           ) || jsonb_build_array($2::jsonb),
           true
         )
       WHERE arn = $3`,
      [toStateId, JSON.stringify(statusChange), arn]
    );

    // 2. Insert audit_event record
    await client.query(
      "INSERT INTO audit_event (event_id, arn, event_type, actor_type, actor_id, payload_jsonb) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        uuidv4(),
        arn,
        "STATE_CHANGED",
        actor.actorType,
        actor.actorId,
        JSON.stringify({
          fromState: fromStateId,
          toState: toStateId,
          transitionId,
          remarks,
        }),
      ]
    );
  }
}
