/**
 * StorageAdapter for PUDA — reads/writes the `application` + `service_version` tables.
 */
import type {
  EntityRef,
  EntityState,
  StorageAdapter,
  TransactionHandle,
  WfDefinition,
} from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { convertLegacyConfig } from "./config-converter";
import type { LegacyWorkflowConfig } from "./config-converter";

function getClient(txn: TransactionHandle): PoolClient {
  return txn.client as PoolClient;
}

export class PudaStorageAdapter implements StorageAdapter {
  async loadEntityForUpdate(
    entityRef: EntityRef,
    txn: TransactionHandle
  ): Promise<EntityState | null> {
    const client = getClient(txn);
    const result = await client.query(
      "SELECT arn, state_id, service_key, service_version, row_version, authority_id FROM application WHERE arn = $1 FOR UPDATE",
      [entityRef.entityId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      entityId: row.arn,
      entityType: "application",
      currentStateId: row.state_id,
      workflowId: row.service_key,
      workflowVersion: row.service_version,
      rowVersion: row.row_version,
      metadata: { authorityId: row.authority_id },
    };
  }

  async loadWorkflowDefinition(
    entityState: EntityState,
    txn: TransactionHandle
  ): Promise<WfDefinition | null> {
    const client = getClient(txn);
    const result = await client.query(
      "SELECT config_jsonb FROM service_version WHERE service_key = $1 AND version = $2",
      [entityState.workflowId, entityState.workflowVersion]
    );

    if (result.rows.length === 0) return null;

    const serviceConfig = result.rows[0].config_jsonb;
    const legacyWorkflow: LegacyWorkflowConfig = serviceConfig.workflow;
    return convertLegacyConfig(legacyWorkflow);
  }

  async updateEntityState(
    entityRef: EntityRef,
    newStateId: string,
    newRowVersion: number,
    txn: TransactionHandle
  ): Promise<void> {
    const client = getClient(txn);
    await client.query(
      "UPDATE application SET state_id = $1, row_version = $2, updated_at = NOW() WHERE arn = $3",
      [newStateId, newRowVersion, entityRef.entityId]
    );
  }
}
