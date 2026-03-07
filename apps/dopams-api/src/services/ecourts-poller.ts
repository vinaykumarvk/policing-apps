import { query } from "../db";

type DbRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CaseStatusResult {
  cnrNumber: string;
  caseNumber: string;
  courtName: string;
  caseType: string;
  filingDate: string | null;
  nextHearingDate: string | null;
  legalStatus: string;
  lastOrderSummary: string | null;
}

export interface CaseSearchResult {
  cnrNumber: string;
  caseNumber: string;
  courtName: string;
  subjectName: string;
  filingDate: string | null;
  legalStatus: string;
}

export interface EcourtsClient {
  /**
   * Fetch the current status of a case by its CNR number.
   * Returns null when the case is not found in eCourts.
   */
  fetchCaseStatus(cnrNumber: string): Promise<CaseStatusResult | null>;

  /**
   * Search eCourts for cases involving the given subject name.
   * Returns a (possibly empty) list of matching cases.
   */
  searchCases(subjectName: string): Promise<CaseSearchResult[]>;

  /**
   * Verify that the eCourts integration endpoint is reachable.
   */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

// ---------------------------------------------------------------------------
// Stub implementation
// ---------------------------------------------------------------------------

export class StubEcourtsClient implements EcourtsClient {
  async fetchCaseStatus(cnrNumber: string): Promise<CaseStatusResult | null> {
    // Production: call eCourts REST/SOAP API and parse response.
    // Stub: return synthetic data so downstream logic can be tested end-to-end.
    if (!cnrNumber) return null;

    const statuses = [
      "PENDING",
      "BAIL_GRANTED",
      "BAIL_REJECTED",
      "CONVICTED",
      "ACQUITTED",
    ] as const;

    return {
      cnrNumber,
      caseNumber: `CNR/${cnrNumber.slice(-4)}/2024`,
      courtName: "District & Sessions Court, Ludhiana",
      caseType: "Sessions",
      filingDate: "2024-01-15",
      nextHearingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      legalStatus:
        statuses[Math.floor(Math.random() * statuses.length)] || "PENDING",
      lastOrderSummary:
        "[Stub] Next date fixed for arguments. Both parties present.",
    };
  }

  async searchCases(subjectName: string): Promise<CaseSearchResult[]> {
    // Production: search eCourts by party name.
    // Stub: return one synthetic result for non-empty queries.
    if (!subjectName) return [];

    return [
      {
        cnrNumber: `PBNVV01000012024`,
        caseNumber: `ST-42/2024`,
        courtName: "District & Sessions Court, Amritsar",
        subjectName,
        filingDate: "2024-03-10",
        legalStatus: "PENDING",
      },
    ];
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    // Production: HEAD /ecourts/api/health and measure RTT.
    return { ok: true, latencyMs: 12 };
  }
}

// Default client used by the poller functions below.
// Swap this for a real HTTP implementation in production.
let _client: EcourtsClient = new StubEcourtsClient();

export function setEcourtsClient(client: EcourtsClient): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Poller functions
// ---------------------------------------------------------------------------

/**
 * Poll eCourts for all court_case rows whose next_hearing_date falls within
 * the next `lookaheadDays` days (default: 7).  Updates legal_status and
 * last_order_summary in place and records the sync timestamp.
 *
 * Designed to be called from a cron job / SLA scheduler.
 */
export async function pollCourtCases(lookaheadDays = 7): Promise<{
  synced: number;
  failed: number;
  errors: { cnrNumber: string; error: string }[];
}> {
  const result = await query(
    `SELECT court_case_id, cnr_number
     FROM court_case
     WHERE next_hearing_date IS NOT NULL
       AND next_hearing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
       AND cnr_number IS NOT NULL
     ORDER BY next_hearing_date ASC`,
    [lookaheadDays],
  );

  let synced = 0;
  let failed = 0;
  const errors: { cnrNumber: string; error: string }[] = [];

  for (const row of result.rows) {
    const cnrNumber = row.cnr_number as string;
    try {
      const status = await _client.fetchCaseStatus(cnrNumber);
      if (!status) {
        // Case not found in eCourts — record the sync attempt but keep existing data.
        await query(
          `UPDATE court_case
           SET last_synced_at = NOW(),
               sync_error = 'Case not found in eCourts',
               updated_at = NOW()
           WHERE cnr_number = $1`,
          [cnrNumber],
        );
        failed++;
        errors.push({ cnrNumber, error: "Case not found in eCourts" });
        continue;
      }

      await query(
        `UPDATE court_case
         SET legal_status = $2,
             next_hearing_date = $3::date,
             last_order_summary = $4,
             last_synced_at = NOW(),
             sync_error = NULL,
             updated_at = NOW()
         WHERE cnr_number = $1`,
        [
          cnrNumber,
          status.legalStatus,
          status.nextHearingDate,
          status.lastOrderSummary,
        ],
      );
      synced++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await query(
        `UPDATE court_case
         SET last_synced_at = NOW(),
             sync_error = $2,
             updated_at = NOW()
         WHERE cnr_number = $1`,
        [cnrNumber, errMsg],
      ).catch(() => {
        // best-effort — don't let an audit-write failure mask the original error
      });
      failed++;
      errors.push({ cnrNumber, error: errMsg });
    }
  }

  return { synced, failed, errors };
}

/**
 * Force-sync a single court case by its CNR number.
 * Upserts into court_case if the row does not yet exist.
 *
 * Returns the updated/inserted row.
 */
export async function syncCourtCase(
  cnrNumber: string,
): Promise<DbRow | null> {
  const status = await _client.fetchCaseStatus(cnrNumber);
  if (!status) {
    // Mark as sync-failed if the row already exists.
    await query(
      `UPDATE court_case
       SET last_synced_at = NOW(),
           sync_error = 'Case not found in eCourts',
           updated_at = NOW()
       WHERE cnr_number = $1`,
      [cnrNumber],
    );
    return null;
  }

  const upsertResult = await query(
    `INSERT INTO court_case
       (cnr_number, case_number, court_name, case_type, filing_date,
        next_hearing_date, legal_status, last_order_summary, last_synced_at)
     VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, NOW())
     ON CONFLICT (cnr_number) DO UPDATE
       SET case_number       = EXCLUDED.case_number,
           court_name        = EXCLUDED.court_name,
           case_type         = EXCLUDED.case_type,
           filing_date       = EXCLUDED.filing_date,
           next_hearing_date = EXCLUDED.next_hearing_date,
           legal_status      = EXCLUDED.legal_status,
           last_order_summary = EXCLUDED.last_order_summary,
           last_synced_at    = NOW(),
           sync_error        = NULL,
           updated_at        = NOW()
     RETURNING *`,
    [
      status.cnrNumber,
      status.caseNumber,
      status.courtName,
      status.caseType,
      status.filingDate,
      status.nextHearingDate,
      status.legalStatus,
      status.lastOrderSummary,
    ],
  );

  return upsertResult.rows[0] || null;
}
