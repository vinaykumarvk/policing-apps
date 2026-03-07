import { query } from "../db";

type DbRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FinancialNetworkResult {
  subjectId: string;
  templateType: string;
  nodes: Array<{
    nodeId: string;
    label: string;
    nodeType: string;
    value: number | null;
  }>;
  edges: Array<{
    from: string;
    to: string;
    transactionType: string;
    amount: number | null;
    currency: string;
  }>;
  suspicionScore: number;
  generatedAt: string;
}

export interface UnocrossClient {
  /**
   * Query Unocross for the financial network graph of a subject using the
   * specified analysis template type (e.g. HAWALA, SHELL_COMPANY).
   */
  queryFinancialNetwork(
    subjectId: string,
    templateType: string,
  ): Promise<FinancialNetworkResult>;

  /**
   * Verify that the Unocross endpoint is reachable.
   */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

// ---------------------------------------------------------------------------
// Stub implementation
// ---------------------------------------------------------------------------

export class StubUnocrossClient implements UnocrossClient {
  async queryFinancialNetwork(
    subjectId: string,
    templateType: string,
  ): Promise<FinancialNetworkResult> {
    // Production: POST to Unocross REST API with auth token.
    // Stub: return synthetic network data for integration testing.
    return {
      subjectId,
      templateType,
      nodes: [
        {
          nodeId: subjectId,
          label: "Primary Subject",
          nodeType: "PERSON",
          value: null,
        },
        {
          nodeId: `acct-stub-001`,
          label: "Bank Account ****1234",
          nodeType: "BANK_ACCOUNT",
          value: 1_850_000,
        },
        {
          nodeId: `entity-stub-001`,
          label: "Shell Co. Alpha Pvt Ltd",
          nodeType: "COMPANY",
          value: 5_000_000,
        },
      ],
      edges: [
        {
          from: subjectId,
          to: "acct-stub-001",
          transactionType: "DEPOSIT",
          amount: 850_000,
          currency: "INR",
        },
        {
          from: "acct-stub-001",
          to: "entity-stub-001",
          transactionType: "TRANSFER",
          amount: 1_200_000,
          currency: "INR",
        },
      ],
      suspicionScore: 0.72,
      generatedAt: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    // Production: GET /unocross/health
    return { ok: true, latencyMs: 8 };
  }
}

// Default client — swap for real HTTP implementation in production.
let _client: UnocrossClient = new StubUnocrossClient();

export function setUnocrossClient(client: UnocrossClient): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Analysis functions
// ---------------------------------------------------------------------------

/**
 * Load the unocross_template by its ID, call the Unocross API, and persist
 * the result as a JSON blob for audit and downstream rule evaluation.
 *
 * Returns the raw network result from Unocross.
 */
export async function generateFinancialAnalysis(
  subjectId: string,
  templateId: string,
): Promise<{ network: FinancialNetworkResult; ruleResults: RuleEvalResult[] }> {
  // Load template
  const tplResult = await query(
    `SELECT template_id, template_name, template_type, parameters, query_template
     FROM unocross_template
     WHERE template_id = $1 AND is_active = TRUE`,
    [templateId],
  );
  if (tplResult.rows.length === 0) {
    throw new Error(`Unocross template not found or inactive: ${templateId}`);
  }
  const template = tplResult.rows[0];

  // Call Unocross API
  const network = await _client.queryFinancialNetwork(
    subjectId,
    template.template_type as string,
  );

  // Run active financial rules
  const ruleResults = await evaluateRules(subjectId);

  return { network, ruleResults };
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

export interface RuleEvalResult {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  severity: string;
  triggered: boolean;
  details: string;
}

/**
 * Evaluate all active financial_analysis_rule conditions for the given subject.
 *
 * Each rule carries a JSONB `conditions` object with the following optional fields:
 *   - `minTransactionAmount` — flag if any transaction exceeds this value
 *   - `minNetworkNodes`      — flag if network node count exceeds this
 *   - `patternKeywords`      — array of strings; flag if subject notes contain any
 *   - `minRiskScore`         — flag if the subject's existing risk_score exceeds this
 *
 * Production implementations should replace these simple heuristics with a
 * proper rules engine or ML-based scorer.
 */
export async function evaluateRules(
  subjectId: string,
): Promise<RuleEvalResult[]> {
  const rulesResult = await query(
    `SELECT rule_id, rule_name, rule_type, conditions, severity
     FROM financial_analysis_rule
     WHERE is_active = TRUE
     ORDER BY severity DESC, rule_name`,
  );

  // Load subject context for rule evaluation
  const subjectResult = await query(
    `SELECT risk_score, monitoring_status, notes
     FROM subject_profile
     WHERE subject_id = $1`,
    [subjectId],
  );
  const subject = subjectResult.rows[0] as
    | {
        risk_score: number | null;
        monitoring_status: string | null;
        notes: string | null;
      }
    | undefined;

  const results: RuleEvalResult[] = [];

  for (const rule of rulesResult.rows) {
    const conditions = (rule.conditions as Record<string, unknown>) || {};
    let triggered = false;
    let details = "No condition matched.";

    // THRESHOLD: minRiskScore
    if (
      conditions.minRiskScore !== undefined &&
      subject?.risk_score !== null &&
      subject?.risk_score !== undefined
    ) {
      const threshold = Number(conditions.minRiskScore);
      const score = Number(subject.risk_score);
      if (!Number.isNaN(threshold) && !Number.isNaN(score) && score >= threshold) {
        triggered = true;
        details = `Subject risk score ${score} exceeds threshold ${threshold}.`;
      }
    }

    // PATTERN: patternKeywords in subject notes
    if (
      !triggered &&
      Array.isArray(conditions.patternKeywords) &&
      subject?.notes
    ) {
      const notesLower = String(subject.notes).toLowerCase();
      const matched = (conditions.patternKeywords as string[]).find((kw) =>
        notesLower.includes(String(kw).toLowerCase()),
      );
      if (matched) {
        triggered = true;
        details = `Pattern keyword "${matched}" found in subject notes.`;
      }
    }

    // NETWORK: check against existing graph analysis results
    if (!triggered && conditions.minNetworkNodes !== undefined) {
      const nodeResult = await query(
        `SELECT COUNT(*) AS cnt
         FROM entity_relationship
         WHERE from_entity_id::text = $1 OR to_entity_id::text = $1`,
        [subjectId],
      );
      const cnt = parseInt(String(nodeResult.rows[0]?.cnt ?? "0"), 10);
      const minNodes = Number(conditions.minNetworkNodes);
      if (cnt >= minNodes) {
        triggered = true;
        details = `Network node count ${cnt} meets/exceeds threshold ${minNodes}.`;
      }
    }

    results.push({
      ruleId: rule.rule_id as string,
      ruleName: rule.rule_name as string,
      ruleType: rule.rule_type as string,
      severity: rule.severity as string,
      triggered,
      details,
    });
  }

  return results;
}
