import { query } from "../db";

export interface Actor {
  actor_id: string;
  handles: Array<{ platform: string; handle: string }>;
  display_name: string | null;
  risk_score: number;
  total_flagged_posts: number;
  is_repeat_offender: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

/**
 * Find an existing actor by matching the given platform+handle in the handles JSONB array.
 * If not found, create a new actor record. Returns the actor_id.
 */
export async function upsertActor(
  platform: string,
  handle: string,
  name?: string,
): Promise<string> {
  // Search for existing actor with this handle on this platform
  const existing = await query(
    `SELECT actor_id FROM actor_account
     WHERE handles @> $1::jsonb`,
    [JSON.stringify([{ platform, handle }])],
  );

  if (existing.rows.length > 0) {
    // Update display_name if provided and not already set
    if (name) {
      await query(
        `UPDATE actor_account SET display_name = COALESCE(display_name, $1), last_seen_at = NOW()
         WHERE actor_id = $2`,
        [name, existing.rows[0].actor_id],
      );
    }
    return existing.rows[0].actor_id as string;
  }

  // Create new actor
  const result = await query(
    `INSERT INTO actor_account (handles, display_name, first_seen_at, last_seen_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING actor_id`,
    [JSON.stringify([{ platform, handle }]), name || null],
  );
  return result.rows[0].actor_id as string;
}

/**
 * Link a content_item to an actor by setting actor_id on the content row.
 */
export async function linkContentToActor(contentId: string, actorId: string): Promise<void> {
  await query(
    `UPDATE content_item SET actor_id = $1 WHERE content_id = $2`,
    [actorId, contentId],
  );
}

/**
 * Recalculate actor statistics: count flagged posts and set is_repeat_offender
 * if the actor has 3 or more flagged posts.
 */
export async function updateActorStats(actorId: string): Promise<{ totalFlaggedPosts: number; isRepeatOffender: boolean }> {
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM content_item
     WHERE actor_id = $1 AND threat_score >= 0.5`,
    [actorId],
  );
  const totalFlaggedPosts: number = countResult.rows[0]?.total ?? 0;
  const isRepeatOffender = totalFlaggedPosts >= 3;

  await query(
    `UPDATE actor_account
     SET total_flagged_posts = $1, is_repeat_offender = $2, last_seen_at = NOW()
     WHERE actor_id = $3`,
    [totalFlaggedPosts, isRepeatOffender, actorId],
  );

  return { totalFlaggedPosts, isRepeatOffender };
}

/**
 * Cross-platform link: merge the handles of actorIdB into actorIdA (the survivor).
 * Survivor is chosen by earliest first_seen_at. FK references on content_item are reassigned.
 * ActorIdB is soft-deleted (is_active = false).
 */
export async function crossPlatformLink(actorIdA: string, actorIdB: string): Promise<{ survivorId: string; absorbedId: string }> {
  const client = await (await import("../db")).getClient();
  try {
    await client.query("BEGIN");

    const actorsResult = await client.query(
      `SELECT actor_id, handles, display_name, first_seen_at
       FROM actor_account WHERE actor_id = ANY($1::uuid[])`,
      [[actorIdA, actorIdB]],
    );

    const actorA = actorsResult.rows.find((r: Record<string, unknown>) => r.actor_id === actorIdA);
    const actorB = actorsResult.rows.find((r: Record<string, unknown>) => r.actor_id === actorIdB);

    if (!actorA) throw Object.assign(new Error("Actor A not found"), { code: "ACTOR_A_NOT_FOUND" });
    if (!actorB) throw Object.assign(new Error("Actor B not found"), { code: "ACTOR_B_NOT_FOUND" });

    // Survivor = earliest first_seen_at
    const survivorRow = new Date(actorA.first_seen_at) <= new Date(actorB.first_seen_at) ? actorA : actorB;
    const absorbedRow = survivorRow.actor_id === actorIdA ? actorB : actorA;
    const survivorId: string = survivorRow.actor_id;
    const absorbedId: string = absorbedRow.actor_id;

    // Merge handles arrays, deduplicating on platform+handle
    const survivorHandles: Array<{ platform: string; handle: string }> =
      Array.isArray(survivorRow.handles) ? survivorRow.handles : [];
    const absorbedHandles: Array<{ platform: string; handle: string }> =
      Array.isArray(absorbedRow.handles) ? absorbedRow.handles : [];

    const mergedHandlesMap = new Map<string, { platform: string; handle: string }>();
    for (const h of [...survivorHandles, ...absorbedHandles]) {
      const key = `${h.platform}:${h.handle}`;
      if (!mergedHandlesMap.has(key)) {
        mergedHandlesMap.set(key, h);
      }
    }
    const mergedHandles = Array.from(mergedHandlesMap.values());

    // Update survivor
    await client.query(
      `UPDATE actor_account
       SET handles = $1, display_name = COALESCE(display_name, $2),
           first_seen_at = LEAST(first_seen_at, $3), last_seen_at = NOW()
       WHERE actor_id = $4`,
      [JSON.stringify(mergedHandles), absorbedRow.display_name, absorbedRow.first_seen_at, survivorId],
    );

    // Reassign content_item references
    await client.query(
      `UPDATE content_item SET actor_id = $1 WHERE actor_id = $2`,
      [survivorId, absorbedId],
    );

    // Soft-delete absorbed actor
    await client.query(
      `UPDATE actor_account SET is_active = FALSE WHERE actor_id = $1`,
      [absorbedId],
    );

    await client.query("COMMIT");
    return { survivorId, absorbedId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
