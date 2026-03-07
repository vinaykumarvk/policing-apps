import { query } from "../db";

export interface EntityRecord {
  entity_id: string;
  case_id: string;
  entity_type: string;
  entity_value: string;
  is_merged: boolean;
  merged_into_id: string | null;
  split_from_id: string | null;
  metadata_jsonb: Record<string, unknown>;
  created_at: string;
}

export interface TimelineEvent {
  timeline_id: string;
  entity_id: string;
  event_type: string;
  description: string;
  actor_entity_id: string | null;
  created_by: string;
  created_at: string;
}

/**
 * Merge two entities. The source entity is marked as merged into the target.
 * All case-level relationships pointing to the source are reassigned to the target.
 * Timeline events are created on both entities recording the operation.
 */
export async function mergeEntities(
  targetId: string,
  sourceId: string,
  userId: string,
): Promise<{ targetId: string; sourceId: string }> {
  const client = await (await import("../db")).getClient();
  try {
    await client.query("BEGIN");

    // Validate both entities exist and are not already merged
    const check = await client.query(
      `SELECT entity_id, entity_type, entity_value, is_merged
       FROM extracted_entity WHERE entity_id = ANY($1::uuid[])`,
      [[targetId, sourceId]],
    );
    const targetRow = check.rows.find((r: Record<string, unknown>) => r.entity_id === targetId);
    const sourceRow = check.rows.find((r: Record<string, unknown>) => r.entity_id === sourceId);

    if (!targetRow) throw Object.assign(new Error("Target entity not found"), { code: "TARGET_NOT_FOUND" });
    if (!sourceRow) throw Object.assign(new Error("Source entity not found"), { code: "SOURCE_NOT_FOUND" });
    if (sourceRow.is_merged) throw Object.assign(new Error("Source entity is already merged"), { code: "ALREADY_MERGED" });

    // Reassign entity_relation rows referencing source → target
    await client.query(
      `UPDATE entity_relation
       SET entity_id_a = $1
       WHERE entity_id_a = $2`,
      [targetId, sourceId],
    );
    await client.query(
      `UPDATE entity_relation
       SET entity_id_b = $1
       WHERE entity_id_b = $2`,
      [targetId, sourceId],
    );

    // Reassign any other metadata references stored in JSONB
    await client.query(
      `UPDATE ai_finding
       SET metadata_jsonb = jsonb_set(COALESCE(metadata_jsonb, '{}'), '{merged_entity_id}', to_jsonb($1::text))
       WHERE metadata_jsonb->>'entity_id' = $2`,
      [targetId, sourceId],
    );

    // Mark source entity as merged
    await client.query(
      `UPDATE extracted_entity
       SET is_merged = TRUE, merged_into_id = $1, updated_at = NOW()
       WHERE entity_id = $2`,
      [targetId, sourceId],
    );

    // Create timeline event on target
    await client.query(
      `INSERT INTO entity_timeline (entity_id, event_type, description, actor_entity_id, created_by)
       VALUES ($1, 'MERGE_TARGET', $2, $3, $4)`,
      [
        targetId,
        `Merged entity ${sourceRow.entity_value} (${sourceRow.entity_type}) into this entity`,
        sourceId,
        userId,
      ],
    );

    // Create timeline event on source
    await client.query(
      `INSERT INTO entity_timeline (entity_id, event_type, description, actor_entity_id, created_by)
       VALUES ($1, 'MERGE_SOURCE', $2, $3, $4)`,
      [
        sourceId,
        `This entity was merged into ${targetRow.entity_value} (${targetRow.entity_type})`,
        targetId,
        userId,
      ],
    );

    await client.query("COMMIT");
    return { targetId, sourceId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Split an entity into multiple new entities. Each new entity is linked back
 * to the original via split_from_id. Timeline events are created for all parties.
 */
export async function splitEntity(
  entityId: string,
  newValues: Array<{ entityType: string; entityValue: string }>,
  userId: string,
): Promise<EntityRecord[]> {
  if (!newValues || newValues.length === 0) {
    throw Object.assign(new Error("newValues must be non-empty"), { code: "INVALID_INPUT" });
  }

  const client = await (await import("../db")).getClient();
  try {
    await client.query("BEGIN");

    // Load original entity
    const origResult = await client.query(
      `SELECT entity_id, case_id, entity_type, entity_value FROM extracted_entity WHERE entity_id = $1`,
      [entityId],
    );
    if (origResult.rows.length === 0) {
      throw Object.assign(new Error("Entity not found"), { code: "ENTITY_NOT_FOUND" });
    }
    const orig = origResult.rows[0] as { entity_id: string; case_id: string; entity_type: string; entity_value: string };

    const created: EntityRecord[] = [];

    for (const nv of newValues) {
      const insResult = await client.query(
        `INSERT INTO extracted_entity (case_id, entity_type, entity_value, split_from_id, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING entity_id, case_id, entity_type, entity_value, is_merged, merged_into_id, split_from_id, metadata_jsonb, created_at`,
        [orig.case_id, nv.entityType, nv.entityValue, entityId, userId],
      );
      const newEntity: EntityRecord = insResult.rows[0];
      created.push(newEntity);

      // Timeline event on the new entity
      await client.query(
        `INSERT INTO entity_timeline (entity_id, event_type, description, actor_entity_id, created_by)
         VALUES ($1, 'SPLIT_TARGET', $2, $3, $4)`,
        [
          newEntity.entity_id,
          `Created by splitting from entity ${orig.entity_value} (${orig.entity_type})`,
          entityId,
          userId,
        ],
      );
    }

    // Timeline event on the original entity
    const newLabels = newValues.map((nv) => `${nv.entityValue} (${nv.entityType})`).join(", ");
    await client.query(
      `INSERT INTO entity_timeline (entity_id, event_type, description, actor_entity_id, created_by)
       VALUES ($1, 'SPLIT_SOURCE', $2, NULL, $3)`,
      [entityId, `Split into ${newValues.length} new entities: ${newLabels}`, userId],
    );

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieve all timeline events for a given entity, ordered newest first.
 */
export async function getEntityTimeline(entityId: string): Promise<TimelineEvent[]> {
  const result = await query(
    `SELECT tl.timeline_id, tl.entity_id, tl.event_type, tl.description,
            tl.actor_entity_id, tl.created_by, tl.created_at
     FROM entity_timeline tl
     WHERE tl.entity_id = $1
     ORDER BY tl.created_at DESC`,
    [entityId],
  );
  return result.rows as TimelineEvent[];
}
