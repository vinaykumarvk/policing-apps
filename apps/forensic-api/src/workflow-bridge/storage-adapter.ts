import type {
  EntityRef,
  EntityState,
  StorageAdapter,
  TransactionHandle,
  WfDefinition,
} from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import fs from "fs";
import path from "path";
import { parseAndValidateDefinition } from "@puda/workflow-engine";

function getClient(txn: TransactionHandle): PoolClient {
  return txn.client as PoolClient;
}

const definitionCache = new Map<string, WfDefinition>();

function loadDefinitionFromFile(entityType: string): WfDefinition | null {
  const cached = definitionCache.get(entityType);
  if (cached) return cached;
  const filePath = path.resolve(__dirname, "..", "workflow-definitions", `${entityType}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const def = parseAndValidateDefinition(raw);
  definitionCache.set(entityType, def);
  return def;
}

const ENTITY_TABLE_MAP: Record<string, { table: string; idCol: string; stateCol: string }> = {
  forensic_case: { table: "forensic_case", idCol: "case_id", stateCol: "state_id" },
  forensic_evidence: { table: "evidence_source", idCol: "evidence_id", stateCol: "state_id" },
  forensic_import: { table: "import_job", idCol: "import_job_id", stateCol: "state_id" },
  forensic_finding: { table: "ai_finding", idCol: "finding_id", stateCol: "state_id" },
  forensic_report: { table: "report", idCol: "report_id", stateCol: "state_id" },
};

export class ForensicStorageAdapter implements StorageAdapter {
  async loadEntityForUpdate(entityRef: EntityRef, txn: TransactionHandle): Promise<EntityState | null> {
    const client = getClient(txn);
    const mapping = ENTITY_TABLE_MAP[entityRef.entityType];
    if (!mapping) return null;

    const result = await client.query(
      `SELECT ${mapping.idCol}, ${mapping.stateCol}, row_version FROM ${mapping.table} WHERE ${mapping.idCol} = $1 FOR UPDATE`,
      [entityRef.entityId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      entityId: row[mapping.idCol],
      entityType: entityRef.entityType,
      currentStateId: row[mapping.stateCol],
      workflowId: entityRef.entityType,
      workflowVersion: "1.0.0",
      rowVersion: row.row_version,
    };
  }

  async loadWorkflowDefinition(entityState: EntityState, _txn: TransactionHandle): Promise<WfDefinition | null> {
    return loadDefinitionFromFile(entityState.workflowId);
  }

  async updateEntityState(entityRef: EntityRef, newStateId: string, newRowVersion: number, txn: TransactionHandle): Promise<void> {
    const client = getClient(txn);
    const mapping = ENTITY_TABLE_MAP[entityRef.entityType];
    if (!mapping) return;
    await client.query(
      `UPDATE ${mapping.table} SET ${mapping.stateCol} = $1, row_version = $2, updated_at = NOW() WHERE ${mapping.idCol} = $3`,
      [newStateId, newRowVersion, entityRef.entityId]
    );
  }
}
