import { query, getClient } from "../db";

/**
 * Assertion Engine — per-field multi-source provenance with trust-rank comparison,
 * conflict detection, auto-approve logic, and reviewer workflow.
 * Implements FR-04 AC-02: competing values from multiple sources with confidence scoring.
 */

export interface AssertionInput {
  subjectId: string;
  attributeName: string;
  attributeValue: string;
  sourceSystem: string;
  sourceDocumentId?: string;
  confidenceScore?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdBy: string;
}

export interface AssertionRow {
  assertion_id: string;
  subject_id: string;
  attribute_name: string;
  attribute_value: string;
  source_system: string;
  source_trust_rank: number;
  confidence_score: number | null;
  review_status: string;
  is_current: boolean;
  created_at: string;
}

/**
 * Look up the trust rank for a source system.
 * Returns 1 (lowest) if source is not configured.
 */
export async function getTrustRank(sourceSystem: string): Promise<number> {
  const result = await query(
    `SELECT trust_rank FROM source_trust_config WHERE source_system = $1`,
    [sourceSystem],
  );
  return result.rows.length > 0 ? result.rows[0].trust_rank : 1;
}

/**
 * Insert a new assertion with trust-rank comparison and conflict detection.
 *
 * Rules:
 * - If no current assertion exists for this attribute → auto-approve (APPROVED, is_current=true)
 * - If new source has strictly higher trust rank → auto-supersede existing, new becomes APPROVED
 * - If new source has equal or lower trust rank → mark both as CONFLICTING for human review
 */
export async function insertAssertion(input: AssertionInput): Promise<AssertionRow> {
  const trustRank = await getTrustRank(input.sourceSystem);
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Find current assertion(s) for this subject+attribute
    const existing = await client.query(
      `SELECT assertion_id, attribute_value, source_system, source_trust_rank, review_status
       FROM subject_assertion
       WHERE subject_id = $1 AND attribute_name = $2 AND is_current = TRUE
       ORDER BY source_trust_rank DESC
       LIMIT 1`,
      [input.subjectId, input.attributeName],
    );

    let reviewStatus: string;

    if (existing.rows.length === 0) {
      // No existing assertion — auto-approve
      reviewStatus = "APPROVED";
    } else {
      const current = existing.rows[0];

      // Same value from same or different source — no conflict
      if (current.attribute_value === input.attributeValue) {
        // Just update confidence if higher, don't create duplicate
        if (
          input.confidenceScore !== undefined &&
          input.confidenceScore > (current.confidence_score || 0)
        ) {
          await client.query(
            `UPDATE subject_assertion SET confidence_score = $1 WHERE assertion_id = $2`,
            [input.confidenceScore, current.assertion_id],
          );
        }
        await client.query("COMMIT");
        // Return existing assertion
        const refreshed = await query(
          `SELECT * FROM subject_assertion WHERE assertion_id = $1`,
          [current.assertion_id],
        );
        return refreshed.rows[0];
      }

      if (trustRank > current.source_trust_rank) {
        // Higher trust — auto-supersede existing (superseded_by set after insert)
        reviewStatus = "APPROVED";
        await client.query(
          `UPDATE subject_assertion
           SET is_current = FALSE
           WHERE assertion_id = $1`,
          [current.assertion_id],
        );
      } else {
        // Equal or lower trust — conflict for review
        reviewStatus = "CONFLICTING";
        // Mark existing as conflicting too if it was auto-approved
        if (current.review_status === "APPROVED" || current.review_status === "AUTO_PROPOSED") {
          await client.query(
            `UPDATE subject_assertion SET review_status = 'CONFLICTING' WHERE assertion_id = $1`,
            [current.assertion_id],
          );
        }
      }
    }

    // Insert the new assertion
    const result = await client.query(
      `INSERT INTO subject_assertion
        (subject_id, attribute_name, attribute_value, source_document_id,
         source_system, confidence_score, source_trust_rank, review_status,
         effective_from, effective_to, is_current, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.subjectId,
        input.attributeName,
        input.attributeValue,
        input.sourceDocumentId || null,
        input.sourceSystem,
        input.confidenceScore ?? null,
        trustRank,
        reviewStatus,
        input.effectiveFrom || null,
        input.effectiveTo || null,
        reviewStatus === "APPROVED",
        input.createdBy,
      ],
    );

    // If we auto-superseded, update the superseded_by pointer properly
    if (reviewStatus === "APPROVED" && existing.rows.length > 0) {
      await client.query(
        `UPDATE subject_assertion
         SET superseded_by = $1
         WHERE assertion_id = $2`,
        [result.rows[0].assertion_id, existing.rows[0].assertion_id],
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Approve an assertion — marks it as APPROVED and current, supersedes conflicting peers.
 */
export async function approveAssertion(
  assertionId: string,
  reviewerId: string,
): Promise<AssertionRow> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Get the assertion being approved
    const target = await client.query(
      `SELECT * FROM subject_assertion WHERE assertion_id = $1`,
      [assertionId],
    );
    if (target.rows.length === 0) {
      throw Object.assign(new Error("Assertion not found"), { code: "ASSERTION_NOT_FOUND" });
    }

    const assertion = target.rows[0];

    // Mark all other current assertions for same subject+attribute as superseded
    await client.query(
      `UPDATE subject_assertion
       SET is_current = FALSE, superseded_by = $1, review_status = 'REVIEWED'
       WHERE subject_id = $2 AND attribute_name = $3 AND is_current = TRUE AND assertion_id != $1`,
      [assertionId, assertion.subject_id, assertion.attribute_name],
    );

    // Approve this assertion
    const result = await client.query(
      `UPDATE subject_assertion
       SET review_status = 'APPROVED', is_current = TRUE, reviewed_by = $1, reviewed_at = NOW()
       WHERE assertion_id = $2
       RETURNING *`,
      [reviewerId, assertionId],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reject an assertion — marks it as REJECTED, not current.
 */
export async function rejectAssertion(
  assertionId: string,
  reviewerId: string,
): Promise<AssertionRow> {
  const result = await query(
    `UPDATE subject_assertion
     SET review_status = 'REJECTED', is_current = FALSE, reviewed_by = $1, reviewed_at = NOW()
     WHERE assertion_id = $2
     RETURNING *`,
    [reviewerId, assertionId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Assertion not found"), { code: "ASSERTION_NOT_FOUND" });
  }
  return result.rows[0];
}

/**
 * Get all assertions for a subject, optionally filtered by attribute and/or review status.
 */
export async function getAssertions(
  subjectId: string,
  opts: { attributeName?: string; reviewStatus?: string; currentOnly?: boolean; limit?: number; offset?: number } = {},
): Promise<{ assertions: AssertionRow[]; total: number }> {
  const { attributeName, reviewStatus, currentOnly = false, limit = 50, offset = 0 } = opts;
  const result = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM subject_assertion
     WHERE subject_id = $1
       AND ($2::text IS NULL OR attribute_name = $2)
       AND ($3::text IS NULL OR review_status = $3)
       AND ($4::boolean = FALSE OR is_current = TRUE)
     ORDER BY attribute_name, source_trust_rank DESC, created_at DESC
     LIMIT $5 OFFSET $6`,
    [subjectId, attributeName || null, reviewStatus || null, currentOnly, limit, offset],
  );
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  return {
    assertions: result.rows.map(({ total_count, ...r }: Record<string, unknown>) => r as unknown as AssertionRow),
    total,
  };
}

/**
 * Get conflicting assertions that need review.
 */
export async function getConflicts(
  opts: { subjectId?: string; limit?: number; offset?: number } = {},
): Promise<{ conflicts: AssertionRow[]; total: number }> {
  const { subjectId, limit = 50, offset = 0 } = opts;
  const result = await query(
    `SELECT sa.*, sp.full_name AS subject_name, sp.subject_ref,
            COUNT(*) OVER() AS total_count
     FROM subject_assertion sa
     JOIN subject_profile sp ON sp.subject_id = sa.subject_id
     WHERE sa.review_status = 'CONFLICTING'
       AND ($1::uuid IS NULL OR sa.subject_id = $1)
     ORDER BY sa.created_at DESC
     LIMIT $2 OFFSET $3`,
    [subjectId || null, limit, offset],
  );
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  return {
    conflicts: result.rows.map(({ total_count, ...r }: Record<string, unknown>) => r as unknown as AssertionRow),
    total,
  };
}

/**
 * Bulk review — approve or reject multiple assertions at once.
 */
export async function bulkReview(
  decisions: Array<{ assertionId: string; action: "approve" | "reject" }>,
  reviewerId: string,
): Promise<{ approved: number; rejected: number }> {
  let approved = 0;
  let rejected = 0;

  for (const { assertionId, action } of decisions) {
    if (action === "approve") {
      await approveAssertion(assertionId, reviewerId);
      approved++;
    } else {
      await rejectAssertion(assertionId, reviewerId);
      rejected++;
    }
  }

  return { approved, rejected };
}

/**
 * Get the trust config table for admin display/editing.
 */
export async function getTrustConfig(): Promise<Array<{ source_system: string; trust_rank: number; description: string }>> {
  const result = await query(
    `SELECT source_system, trust_rank, description FROM source_trust_config ORDER BY trust_rank DESC, source_system`,
  );
  return result.rows;
}

/**
 * Update a trust rank for a source system.
 */
export async function updateTrustRank(
  sourceSystem: string,
  trustRank: number,
): Promise<void> {
  const result = await query(
    `UPDATE source_trust_config SET trust_rank = $1, updated_at = NOW() WHERE source_system = $2 RETURNING source_system`,
    [trustRank, sourceSystem],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Source system not found"), { code: "SOURCE_NOT_FOUND" });
  }
}
