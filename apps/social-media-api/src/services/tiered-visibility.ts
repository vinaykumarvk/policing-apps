import { query } from "../db";

/** Get all unit IDs visible to a given unit (self + all descendants) */
export async function getVisibleUnitIds(unitId: string): Promise<string[]> {
  const result = await query(
    `WITH RECURSIVE descendants AS (
       SELECT unit_id FROM organization_unit WHERE unit_id = $1
       UNION ALL
       SELECT ou.unit_id FROM organization_unit ou
       JOIN descendants d ON ou.parent_unit_id = d.unit_id
     )
     SELECT unit_id FROM descendants`,
    [unitId],
  );
  return result.rows.map((r) => r.unit_id);
}

/** Check whether a user from unitId can access an entity belonging to entityUnitId */
export async function canAccessEntity(unitId: string, entityUnitId: string): Promise<boolean> {
  const visibleIds = await getVisibleUnitIds(unitId);
  return visibleIds.includes(entityUnitId);
}

/** Get the parent unit of a given unit */
export async function getParentUnit(unitId: string): Promise<{ unit_id: string; unit_name: string; tier_level: string } | null> {
  const result = await query(
    `SELECT ou.unit_id, ou.unit_name, ou.tier_level
     FROM organization_unit ou
     JOIN organization_unit child ON child.parent_unit_id = ou.unit_id
     WHERE child.unit_id = $1`,
    [unitId],
  );
  return result.rows[0] || null;
}

/** Get tier level for a unit */
export async function getUnitTier(unitId: string): Promise<string | null> {
  const result = await query(
    "SELECT tier_level FROM organization_unit WHERE unit_id = $1",
    [unitId],
  );
  return result.rows[0]?.tier_level || null;
}
