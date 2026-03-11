import { query } from "../db";

type DbRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiValue {
  kpiId: string;
  kpiCode: string;
  kpiName: string;
  unit: string;
  targetValue: number | null;
  actualValue: number | null;
  achievementPct: number | null;
  error?: string;
}

export interface MonthlyReportResult {
  reportId: string;
  reportMonth: string;
  unitId: string | null;
  kpiValues: KpiValue[];
  stateId: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// KPI execution
// ---------------------------------------------------------------------------

/**
 * Execute each active KPI's calculation_query for the given month window and
 * optional unit filter.
 *
 * KPI queries may accept up to two positional parameters:
 *   $1 — start of month (inclusive)
 *   $2 — start of next month (exclusive)
 *
 * Single-scalar KPIs (e.g. COUNT(*)) must return exactly one row with one
 * numeric column.  Any error is caught so a single broken KPI does not abort
 * the entire report.
 */
export async function getKpiValues(
  month: Date,
  unitId: string | null,
): Promise<KpiValue[]> {
  const kpiResult = await query(
    `SELECT kpi_id, kpi_code, kpi_name, description, calculation_query, unit, target_value
     FROM kpi_definition
     WHERE is_active = TRUE
     ORDER BY kpi_name`,
  );

  // Build month window
  const monthStart = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1),
  );

  const results: KpiValue[] = [];

  for (const kpi of kpiResult.rows) {
    let actualValue: number | null = null;

    let kpiError: string | undefined;
    try {
      // Run the KPI query inside a read-only transaction with a statement
      // timeout to prevent runaway queries from blocking the report.
      await query("BEGIN");
      await query("SET TRANSACTION READ ONLY");
      await query("SET LOCAL statement_timeout = '5s'");

      const kpiQueryResult = await query(
        kpi.calculation_query as string,
        [monthStart.toISOString(), monthEnd.toISOString()],
      );

      await query("COMMIT");

      if (kpiQueryResult.rows.length > 0) {
        const firstRow = kpiQueryResult.rows[0] as Record<string, unknown>;
        const firstValue = Object.values(firstRow)[0];
        if (firstValue !== null && firstValue !== undefined) {
          const parsed = parseFloat(String(firstValue));
          if (!Number.isNaN(parsed)) {
            actualValue = parsed;
          }
        }
      }
    } catch (err) {
      // Ensure transaction is rolled back on error
      await query("ROLLBACK").catch(() => {});
      kpiError = err instanceof Error ? err.message : String(err);
    }

    const targetValue =
      kpi.target_value !== null ? parseFloat(String(kpi.target_value)) : null;
    const achievementPct =
      targetValue !== null && targetValue > 0 && actualValue !== null
        ? Math.round((actualValue / targetValue) * 10000) / 100
        : null;

    results.push({
      kpiId: kpi.kpi_id as string,
      kpiCode: kpi.kpi_code as string,
      kpiName: kpi.kpi_name as string,
      unit: (kpi.unit as string) || "count",
      targetValue,
      actualValue,
      achievementPct,
      ...(kpiError ? { error: kpiError } : {}),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate the monthly KPI report for the given month and optional unit.
 *
 * Uses ON CONFLICT to update the existing draft if one already exists for
 * the same (report_month, unit_id) combination, allowing re-generation.
 *
 * Returns the fully populated report row.
 */
export async function generateMonthlyReport(
  month: Date,
  unitId: string | null,
  userId: string,
): Promise<MonthlyReportResult> {
  // Normalise to first-of-month UTC date
  const reportMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
  );

  // Compute KPI values
  const kpiValues = await getKpiValues(reportMonth, unitId);

  // Build compact JSON: { kpiCode: actualValue, ... }
  const kpiJson: Record<string, number | null> = {};
  for (const kv of kpiValues) {
    kpiJson[kv.kpiCode] = kv.actualValue;
  }

  // Upsert report
  const upsertResult = await query(
    `INSERT INTO monthly_report
       (report_month, unit_id, kpi_values, generated_by, state_id, generated_at)
     VALUES ($1::date, $2::uuid, $3, $4::uuid, 'GENERATED', NOW())
     ON CONFLICT (report_month, unit_id) DO UPDATE
       SET kpi_values   = EXCLUDED.kpi_values,
           generated_by = EXCLUDED.generated_by,
           state_id     = CASE
                            WHEN monthly_report.state_id IN ('DRAFT', 'GENERATED') THEN 'GENERATED'
                            ELSE monthly_report.state_id
                          END,
           generated_at = NOW(),
           row_version  = monthly_report.row_version + 1
     RETURNING report_id, report_month, unit_id, state_id, generated_at`,
    [
      reportMonth.toISOString().slice(0, 10),
      unitId,
      JSON.stringify(kpiJson),
      userId,
    ],
  );

  const row = upsertResult.rows[0] as DbRow;

  return {
    reportId: row.report_id as string,
    reportMonth: String(row.report_month).slice(0, 10),
    unitId: (row.unit_id as string | null) ?? null,
    kpiValues,
    stateId: row.state_id as string,
    generatedAt: row.generated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Retrieval helpers
// ---------------------------------------------------------------------------

/**
 * List monthly reports filtered by an optional month string (YYYY-MM).
 * Returns rows in descending month order.
 */
export async function listMonthlyReports(
  monthFilter: string | null,
  limit: number,
  offset: number,
): Promise<{ reports: DbRow[]; total: number }> {
  const result = await query(
    `SELECT report_id, report_month, unit_id, state_id, generated_by,
            generated_at, published_at, row_version,
            COUNT(*) OVER() AS total_count
     FROM monthly_report
     WHERE ($1::text IS NULL OR TO_CHAR(report_month, 'YYYY-MM') = $1)
     ORDER BY report_month DESC
     LIMIT $2 OFFSET $3`,
    [monthFilter || null, limit, offset],
  );

  const total =
    result.rows.length > 0
      ? parseInt(String(result.rows[0].total_count), 10)
      : 0;
  const reports = result.rows.map(({ total_count: _, ...r }) => r);
  return { reports, total };
}

/**
 * Fetch a single report by ID, with the full kpi_values JSONB blob.
 */
export async function getMonthlyReport(
  reportId: string,
): Promise<DbRow | null> {
  const result = await query(
    `SELECT report_id, report_month, unit_id, kpi_values, state_id,
            generated_by, generated_at, published_at, row_version
     FROM monthly_report
     WHERE report_id = $1`,
    [reportId],
  );
  return result.rows[0] || null;
}
