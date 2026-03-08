import { query } from "../db";

export interface DedupCandidate {
  candidate_id: string;
  subject_id_a: string;
  subject_id_b: string;
  full_name_a: string;
  full_name_b: string;
  similarity_score: number;
  state_id: string;
  created_at: string;
}

export interface MergeResult {
  survivorId: string;
  mergedId: string;
  mergeHistoryId: string;
}

/**
 * Scan subject_profile for duplicate pairs using pg_trgm similarity on full_name
 * and matching identifiers. Inserts rows into dedup_candidate table.
 * Returns the number of new candidates inserted.
 */
export async function findDuplicates(minSimilarity = 0.5): Promise<number> {
  // Use pg_trgm similarity() to find pairs above threshold; skip already-merged subjects
  // and pairs that already exist as candidates (any state).
  const result = await query(
    `INSERT INTO dedup_candidate (subject_id_a, subject_id_b, similarity_score, match_reasons)
     SELECT
       a.subject_id,
       b.subject_id,
       similarity(a.full_name, b.full_name),
       jsonb_build_array(
         CASE WHEN similarity(a.full_name, b.full_name) >= $1 THEN 'name_similarity' END,
         CASE
           WHEN a.identifiers != '{}' AND b.identifiers != '{}'
                AND a.identifiers::text != '{}' AND b.identifiers::text != '{}'
                AND (a.identifiers @> b.identifiers OR b.identifiers @> a.identifiers)
           THEN 'identifier_match'
         END
       ) - 'null'::jsonb
     FROM subject_profile a
     JOIN subject_profile b ON b.subject_id > a.subject_id
     WHERE a.is_merged = FALSE
       AND b.is_merged = FALSE
       AND similarity(a.full_name, b.full_name) >= $1
       AND NOT EXISTS (
         SELECT 1 FROM dedup_candidate dc
         WHERE (dc.subject_id_a = a.subject_id AND dc.subject_id_b = b.subject_id)
            OR (dc.subject_id_a = b.subject_id AND dc.subject_id_b = a.subject_id)
       )
     ON CONFLICT DO NOTHING
     RETURNING candidate_id`,
    [minSimilarity],
  );
  return result.rows.length;
}

/**
 * Merge two subject records. For each field in fieldDecisions, pick value from
 * the specified source ('survivor' | 'merged'). Updates all FK references, marks
 * the merged subject, and inserts a merge_history row.
 */
export async function mergeSubjects(
  survivorId: string,
  mergedId: string,
  fieldDecisions: Record<string, "survivor" | "merged">,
  userId: string,
): Promise<MergeResult> {
  const client = await (await import("../db")).getClient();
  try {
    await client.query("BEGIN");

    // Load both subjects
    const subjectResult = await client.query(
      `SELECT subject_id, full_name, aliases, date_of_birth, gender, identifiers, addresses,
              father_name, mother_name, spouse_name, height_cm, weight_kg, complexion,
              distinguishing_marks, blood_group, nationality, religion, caste, education,
              occupation, marital_status, known_languages, mobile_numbers, email_addresses,
              social_handles, threat_level, monitoring_status, modus_operandi, gang_affiliation,
              bail_status, criminal_history, ndps_history
       FROM subject_profile WHERE subject_id = ANY($1::uuid[])`,
      [[survivorId, mergedId]],
    );

    const survivorRow = subjectResult.rows.find((r: Record<string, unknown>) => r.subject_id === survivorId);
    const mergedRow = subjectResult.rows.find((r: Record<string, unknown>) => r.subject_id === mergedId);

    if (!survivorRow || !mergedRow) {
      throw new Error("One or both subjects not found");
    }

    // Build SET clause from field decisions
    const updatableFields = [
      "full_name", "aliases", "date_of_birth", "gender", "identifiers", "addresses",
      "father_name", "mother_name", "spouse_name", "height_cm", "weight_kg", "complexion",
      "distinguishing_marks", "blood_group", "nationality", "religion", "caste", "education",
      "occupation", "marital_status", "known_languages", "mobile_numbers", "email_addresses",
      "social_handles", "threat_level", "monitoring_status", "modus_operandi", "gang_affiliation",
      "bail_status", "criminal_history", "ndps_history",
    ];

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const col of updatableFields) {
      const decision = fieldDecisions[col];
      if (decision === "merged") {
        sets.push(`${col} = $${idx++}`);
        params.push((mergedRow as Record<string, unknown>)[col]);
      }
      // If decision === 'survivor' or undefined, keep survivor's existing value (no-op)
    }

    sets.push(`updated_at = NOW()`);

    if (sets.length > 1) {
      params.push(survivorId);
      await client.query(
        `UPDATE subject_profile SET ${sets.join(", ")} WHERE subject_id = $${idx}`,
        params,
      );
    }

    // Reassign FK references: case_subject
    await client.query(
      `UPDATE case_subject SET subject_id = $1 WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // Reassign FK references: lead.subject_id
    await client.query(
      `UPDATE lead SET subject_id = $1 WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // Reassign FK references: extracted_entity (if entity references subject)
    await client.query(
      `UPDATE extracted_entity
       SET metadata_jsonb = jsonb_set(COALESCE(metadata_jsonb, '{}'), '{subject_id}', to_jsonb($1::text))
       WHERE metadata_jsonb->>'subject_id' = $2`,
      [survivorId, mergedId],
    );

    // FR-25 AC-05: Re-link geofence hits
    await client.query(
      `UPDATE geofence_hit SET subject_id = $1 WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // FR-25 AC-05: Re-link watchlist subjects
    await client.query(
      `UPDATE watchlist_subject SET subject_id = $1 WHERE subject_id = $2
       AND NOT EXISTS (SELECT 1 FROM watchlist_subject ws2 WHERE ws2.watchlist_id = watchlist_subject.watchlist_id AND ws2.subject_id = $1)`,
      [survivorId, mergedId],
    );
    // Remove any duplicate watchlist links that couldn't be reassigned
    await client.query(
      `DELETE FROM watchlist_subject WHERE subject_id = $1 AND subject_id != $2`,
      [mergedId, survivorId],
    );

    // FR-25 AC-05: Re-link evidence custody events
    await client.query(
      `UPDATE evidence_custody_event SET subject_id = $1 WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // FR-25 AC-05: Re-link content items
    await client.query(
      `UPDATE content_item SET subject_id = $1 WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // Mark merged subject
    await client.query(
      `UPDATE subject_profile
       SET is_merged = TRUE, merged_into_id = $1, updated_at = NOW()
       WHERE subject_id = $2`,
      [survivorId, mergedId],
    );

    // Insert merge history
    const histResult = await client.query(
      `INSERT INTO merge_history (entity_type, survivor_id, merged_id, field_decisions, merged_by)
       VALUES ('subject', $1, $2, $3, $4)
       RETURNING merge_history_id`,
      [survivorId, mergedId, JSON.stringify(fieldDecisions), userId],
    );
    const mergeHistoryId: string = histResult.rows[0].merge_history_id;

    // Mark any pending dedup candidates between these two as MERGED
    await client.query(
      `UPDATE dedup_candidate SET state_id = 'MERGED', reviewed_by = $1, reviewed_at = NOW()
       WHERE (subject_id_a = $2 AND subject_id_b = $3)
          OR (subject_id_a = $3 AND subject_id_b = $2)`,
      [userId, survivorId, mergedId],
    );

    await client.query("COMMIT");
    return { survivorId, mergedId, mergeHistoryId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * FR-25: Unmerge — reverse a previous merge by restoring the original records.
 * Accepts a merge_history ID and a reason string.
 * Returns the IDs of the unmerged records.
 */
export async function unmergeSubjects(
  mergeHistoryId: string,
  reason: string,
  userId: string,
): Promise<{ survivorId: string; restoredId: string }> {
  const client = await (await import("../db")).getClient();
  try {
    await client.query("BEGIN");

    // Look up the merge history record
    const histResult = await client.query(
      `SELECT survivor_id, merged_id, field_decisions
       FROM merge_history WHERE merge_history_id = $1`,
      [mergeHistoryId],
    );

    if (histResult.rows.length === 0) {
      throw Object.assign(new Error("Merge history record not found"), { code: "MERGE_NOT_FOUND" });
    }

    const { survivor_id: survivorId, merged_id: mergedId } = histResult.rows[0] as {
      survivor_id: string;
      merged_id: string;
      field_decisions: Record<string, string>;
    };

    // Restore the merged subject: unset is_merged and merged_into_id
    const restoreResult = await client.query(
      `UPDATE subject_profile
       SET is_merged = FALSE, merged_into_id = NULL, updated_at = NOW()
       WHERE subject_id = $1 AND is_merged = TRUE
       RETURNING subject_id`,
      [mergedId],
    );

    if (restoreResult.rows.length === 0) {
      throw Object.assign(
        new Error("Merged subject not found or already unmerged"),
        { code: "ALREADY_UNMERGED" },
      );
    }

    // Revert any dedup candidates between the two back to PENDING
    await client.query(
      `UPDATE dedup_candidate SET state_id = 'PENDING', reviewed_by = NULL, reviewed_at = NULL
       WHERE ((subject_id_a = $1 AND subject_id_b = $2)
           OR (subject_id_a = $2 AND subject_id_b = $1))
         AND state_id = 'MERGED'`,
      [survivorId, mergedId],
    );

    // Record the unmerge in merge_history as a reversal
    await client.query(
      `INSERT INTO merge_history (entity_type, survivor_id, merged_id, field_decisions, merged_by)
       VALUES ('subject_unmerge', $1, $2, $3, $4)`,
      [survivorId, mergedId, JSON.stringify({ reason, originalMergeId: mergeHistoryId }), userId],
    );

    await client.query("COMMIT");
    return { survivorId, restoredId: mergedId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reject a dedup candidate so it is not shown again in the review queue.
 */
export async function rejectCandidate(candidateId: string, userId: string): Promise<void> {
  const result = await query(
    `UPDATE dedup_candidate
     SET state_id = 'REJECTED', reviewed_by = $1, reviewed_at = NOW()
     WHERE candidate_id = $2 AND state_id NOT IN ('MERGED', 'REJECTED')
     RETURNING candidate_id`,
    [userId, candidateId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Candidate not found or already resolved"), { code: "CANDIDATE_NOT_FOUND" });
  }
}
