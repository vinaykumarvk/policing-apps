import { query } from "../db";

/**
 * Resolve the unit hierarchy for a given unit.
 * Returns all ancestor and descendant unit IDs from the cache.
 */
export async function resolveUnitHierarchy(unitId: string): Promise<{
  ancestors: string[];
  descendants: string[];
}> {
  const result = await query(
    `SELECT ancestor_ids, descendant_ids FROM jurisdiction_cache WHERE unit_id = $1`,
    [unitId],
  );
  if (result.rows.length === 0) {
    return { ancestors: [], descendants: [] };
  }
  return {
    ancestors: result.rows[0].ancestor_ids || [],
    descendants: result.rows[0].descendant_ids || [],
  };
}

/**
 * Get all unit IDs visible to a given unit (self + descendants).
 */
export async function getVisibleUnitIds(unitId: string): Promise<string[]> {
  const { descendants } = await resolveUnitHierarchy(unitId);
  return [unitId, ...descendants];
}

/**
 * Refresh the jurisdiction cache.
 */
export async function refreshCache(): Promise<void> {
  await query(`SELECT refresh_jurisdiction_cache()`);
}

/**
 * Get unit tree from a root unit.
 */
export async function getUnitTree(rootUnitId?: string): Promise<Record<string, unknown>[]> {
  if (rootUnitId) {
    const result = await query(
      `WITH RECURSIVE tree AS (
        SELECT unit_id, unit_name, parent_id, unit_type, level, 0 AS depth
        FROM organization_unit WHERE unit_id = $1
        UNION ALL
        SELECT o.unit_id, o.unit_name, o.parent_id, o.unit_type, o.level, t.depth + 1
        FROM organization_unit o JOIN tree t ON o.parent_id = t.unit_id
        WHERE t.depth < 10
      ) SELECT * FROM tree ORDER BY depth, unit_name`,
      [rootUnitId],
    );
    return result.rows;
  }

  const result = await query(
    `SELECT unit_id, unit_name, parent_id, unit_type, level, path
     FROM organization_unit ORDER BY COALESCE(path, unit_name)`,
  );
  return result.rows;
}
