import { query } from "../db";

const JUSTIFICATION_WINDOW_MINUTES = 30;

/** Submit access justification */
export async function submitJustification(
  userId: string,
  entityType: string,
  entityId: string,
  justificationType: string,
  reasonText: string,
  caseId?: string,
): Promise<string> {
  const result = await query(
    `INSERT INTO access_justification (user_id, entity_type, entity_id, case_id, justification_type, reason_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING justification_id`,
    [userId, entityType, entityId, caseId || null, justificationType, reasonText],
  );
  return result.rows[0].justification_id;
}

/** Check if user has an active justification (within 30-min window) */
export async function hasActiveJustification(
  userId: string, entityType: string, entityId: string,
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM access_justification
     WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
       AND accessed_at >= NOW() - ($4 || ' minutes')::interval
     LIMIT 1`,
    [userId, entityType, entityId, JUSTIFICATION_WINDOW_MINUTES],
  );
  return result.rows.length > 0;
}

/** Get supervisor audit stats */
export async function getSupervisorAuditStats(
  filters?: { dateFrom?: string; dateTo?: string; userId?: string },
): Promise<Array<Record<string, unknown>>> {
  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters?.dateFrom) {
    whereClause += ` AND accessed_at >= $${paramIdx++}`;
    params.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    whereClause += ` AND accessed_at <= $${paramIdx++}`;
    params.push(filters.dateTo);
  }
  if (filters?.userId) {
    whereClause += ` AND aj.user_id = $${paramIdx++}`;
    params.push(filters.userId);
  }

  const result = await query(
    `SELECT aj.user_id, u.full_name, u.username,
            COUNT(*) AS total_accesses,
            COUNT(DISTINCT entity_id) AS unique_entities,
            MAX(aj.accessed_at) AS last_access,
            COUNT(*) FILTER (WHERE justification_type = 'EMERGENCY') AS emergency_count,
            COUNT(*) FILTER (WHERE aj.accessed_at >= NOW() - INTERVAL '24 hours') AS accesses_24h
     FROM access_justification aj
     JOIN user_account u ON u.user_id = aj.user_id
     ${whereClause}
     GROUP BY aj.user_id, u.full_name, u.username
     ORDER BY total_accesses DESC`,
    params,
  );
  return result.rows;
}

/** Get detailed access log for supervisor review */
export async function getAccessLog(
  limit: number, offset: number,
  filters?: { userId?: string; entityType?: string; dateFrom?: string; dateTo?: string },
): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters?.userId) {
    whereClause += ` AND aj.user_id = $${paramIdx++}`;
    params.push(filters.userId);
  }
  if (filters?.entityType) {
    whereClause += ` AND aj.entity_type = $${paramIdx++}`;
    params.push(filters.entityType);
  }
  if (filters?.dateFrom) {
    whereClause += ` AND aj.accessed_at >= $${paramIdx++}`;
    params.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    whereClause += ` AND aj.accessed_at <= $${paramIdx++}`;
    params.push(filters.dateTo);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS c FROM access_justification aj ${whereClause}`,
    params,
  );

  const dataResult = await query(
    `SELECT aj.*, u.full_name, u.username
     FROM access_justification aj
     JOIN user_account u ON u.user_id = aj.user_id
     ${whereClause}
     ORDER BY aj.accessed_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  return { rows: dataResult.rows, total: Number(countResult.rows[0].c) };
}
