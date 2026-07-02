// Postgres-backed authorization-decision-evidence ledger (G-SEC-002).
// Persists every platform allow/deny decision into
// platform.authorization_decision_evidence (schema: migration 001).
import { Pool } from "pg";
import type { AuthorizationDecisionEvidence } from "../../../../packages/audit-ledger/src";

export interface EvidenceStore {
  append: (evidence: Readonly<AuthorizationDecisionEvidence>) => Promise<void>;
  listRecent: (limit: number) => Promise<readonly StoredDecisionEvidence[]>;
}

export interface StoredDecisionEvidence {
  decision_id: string;
  occurred_at: string;
  correlation_id: string;
  outcome: string;
  reason: string;
  policy_version: string;
  path: string;
  action: string;
  claims_snapshot: object;
}

export function createPgEvidenceStore(pool: Pool): EvidenceStore {
  return {
    append: async (evidence) => {
      try {
        await pool.query(
          `INSERT INTO platform.authorization_decision_evidence
             (decision_id, evidence_schema_version, occurred_at, correlation_id,
              outcome, reason, policy_version, entitlement_policy_version,
              path, action, claims_snapshot, resource, redaction_decision,
              decision_inputs, retrieval, integrity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            evidence.decision_id,
            evidence.evidence_schema_version,
            evidence.occurred_at,
            evidence.correlation_id,
            evidence.outcome,
            evidence.reason,
            evidence.policy_version,
            evidence.entitlement_policy_version,
            evidence.path,
            evidence.action,
            JSON.stringify(evidence.claims_snapshot),
            JSON.stringify(evidence.resource),
            JSON.stringify(evidence.redaction_decision),
            JSON.stringify(evidence.decision_inputs),
            evidence.retrieval ? JSON.stringify(evidence.retrieval) : null,
            JSON.stringify(evidence.integrity),
          ],
        );
      } catch (error) {
        // The ledger must never take the request path down, but a write
        // failure is an operational incident — log it loudly for alerting.
        console.error(
          JSON.stringify({
            alert: "decision-evidence-write-failed",
            decision_id: evidence.decision_id,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    listRecent: async (limit) => {
      const result = await pool.query<StoredDecisionEvidence>(
        `SELECT decision_id, occurred_at, correlation_id, outcome, reason,
                policy_version, path, action, claims_snapshot
           FROM platform.authorization_decision_evidence
          ORDER BY occurred_at DESC
          LIMIT $1`,
        [Math.min(Math.max(limit, 1), 100)],
      );
      return result.rows;
    },
  };
}
