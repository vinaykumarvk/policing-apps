import { query } from "../db";
import { logInfo, logError } from "../logger";

// ── DSL Types ──────────────────────────────────────────────────────────

interface Condition {
  field: string;
  op: string;
  value?: number | string;
  values?: string[];
}

interface RuleExpression {
  operator: "AND" | "OR";
  conditions: Condition[];
}

interface EntityContext {
  category: string;
  threat_score: number;
  platform: string;
  language: string;
  keywords: string;
  sentiment: string;
  [key: string]: unknown;
}

interface ConditionResult {
  field: string;
  op: string;
  matched: boolean;
}

interface RuleEvaluationResult {
  ruleId: string;
  ruleCode: string;
  lawName: string;
  provisionCode: string;
  severityWeight: number;
  matched: boolean;
  confidence: number;
  rationale: string;
  matchedConditions: ConditionResult[];
}

type DbRow = Record<string, unknown>;

// ── Condition Evaluator ────────────────────────────────────────────────

export function evaluateCondition(condition: Condition, ctx: EntityContext): boolean {
  const fieldValue = (ctx as Record<string, unknown>)[condition.field];

  switch (condition.op) {
    case "eq":
      return String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
    case "neq":
      return String(fieldValue).toLowerCase() !== String(condition.value).toLowerCase();
    case "in":
      return (condition.values || []).some(
        (v) => String(fieldValue).toLowerCase() === v.toLowerCase()
      );
    case "not_in":
      return !(condition.values || []).some(
        (v) => String(fieldValue).toLowerCase() === v.toLowerCase()
      );
    case "gte":
      return Number(fieldValue) >= Number(condition.value);
    case "lte":
      return Number(fieldValue) <= Number(condition.value);
    case "gt":
      return Number(fieldValue) > Number(condition.value);
    case "lt":
      return Number(fieldValue) < Number(condition.value);
    case "contains_any": {
      const text = String(fieldValue || "").toLowerCase();
      return (condition.values || []).some((v) => text.includes(v.toLowerCase()));
    }
    case "contains_all": {
      const text = String(fieldValue || "").toLowerCase();
      return (condition.values || []).every((v) => text.includes(v.toLowerCase()));
    }
    default:
      return false;
  }
}

// ── Rule Evaluator ─────────────────────────────────────────────────────

export function evaluateRule(
  expression: RuleExpression,
  ctx: EntityContext
): { matched: boolean; matchedConditions: ConditionResult[] } {
  const results: ConditionResult[] = expression.conditions.map((cond) => ({
    field: cond.field,
    op: cond.op,
    matched: evaluateCondition(cond, ctx),
  }));

  const matched =
    expression.operator === "AND"
      ? results.every((r) => r.matched)
      : results.some((r) => r.matched);

  return { matched, matchedConditions: results };
}

// ── Confidence Calculator ──────────────────────────────────────────────

export function calculateConfidence(
  expression: RuleExpression,
  matchedConditions: ConditionResult[]
): number {
  const total = matchedConditions.length;
  if (total === 0) return 0;
  const matchedCount = matchedConditions.filter((c) => c.matched).length;
  return Math.round((matchedCount / total) * 100 * 100) / 100;
}

// ── Rationale Generator ────────────────────────────────────────────────

export function generateRationale(
  ruleCode: string,
  lawName: string,
  provisionCode: string,
  matchedConditions: ConditionResult[]
): string {
  const matched = matchedConditions.filter((c) => c.matched);
  const parts = matched.map(
    (c) => `${c.field} ${c.op} matched`
  );
  return `Rule ${ruleCode} (${lawName} §${provisionCode}) triggered: ${parts.join("; ")}.`;
}

// ── Entity Context Builder ─────────────────────────────────────────────

export async function buildEntityContext(
  entityType: string,
  entityId: string
): Promise<EntityContext> {
  let text = "";
  let platform = "";
  let language = "";
  let sentiment = "";
  let threatScore = 0;
  let category = "";

  if (entityType === "alert") {
    const alertRes = await query(
      `SELECT a.description, a.source_document_id,
              sd.platform, sd.language, sd.sentiment, sd.threat_score, sd.content_text
       FROM alert a
       LEFT JOIN source_document sd ON sd.document_id = a.source_document_id
       WHERE a.alert_id = $1`,
      [entityId]
    );
    if (alertRes.rows.length > 0) {
      const row = alertRes.rows[0];
      text = [row.description, row.content_text].filter(Boolean).join(" ");
      platform = (row.platform as string) || "";
      language = (row.language as string) || "";
      sentiment = (row.sentiment as string) || "";
      threatScore = Number(row.threat_score) || 0;
    }

    // Get classification category
    const classRes = await query(
      `SELECT category, risk_score FROM classification_result
       WHERE entity_type = 'source_document' AND entity_id = (
         SELECT source_document_id FROM alert WHERE alert_id = $1
       ) ORDER BY updated_at DESC LIMIT 1`,
      [entityId]
    );
    if (classRes.rows.length > 0) {
      category = (classRes.rows[0].category as string) || "";
      if (!threatScore) threatScore = Number(classRes.rows[0].risk_score) || 0;
    }
  } else if (entityType === "dopams_case") {
    const caseRes = await query(
      `SELECT description FROM case_record WHERE case_id = $1`,
      [entityId]
    );
    if (caseRes.rows.length > 0) {
      text = (caseRes.rows[0].description as string) || "";
    }
  }

  return {
    category,
    threat_score: threatScore,
    platform,
    language,
    keywords: text,
    sentiment,
  };
}

// ── Evaluate All Published Rules ───────────────────────────────────────

export async function evaluateRulesForEntity(
  entityType: string,
  entityId: string
): Promise<RuleEvaluationResult[]> {
  const ctx = await buildEntityContext(entityType, entityId);

  const rulesRes = await query(
    `SELECT * FROM legal_mapping_rule
     WHERE approval_status = 'PUBLISHED'
       AND (effective_from IS NULL OR effective_from <= NOW())
       AND (effective_to IS NULL OR effective_to >= NOW())
     ORDER BY severity_weight DESC`
  );

  const results: RuleEvaluationResult[] = [];

  for (const rule of rulesRes.rows) {
    const expression = rule.rule_expression as RuleExpression;
    if (!expression || !expression.conditions) continue;

    const { matched, matchedConditions } = evaluateRule(expression, ctx);
    const confidence = calculateConfidence(expression, matchedConditions);
    const rationale = generateRationale(
      rule.rule_code as string,
      rule.law_name as string,
      rule.provision_code as string,
      matchedConditions
    );

    results.push({
      ruleId: rule.rule_id as string,
      ruleCode: rule.rule_code as string,
      lawName: rule.law_name as string,
      provisionCode: rule.provision_code as string,
      severityWeight: Number(rule.severity_weight),
      matched,
      confidence,
      rationale,
      matchedConditions,
    });
  }

  return results;
}

// ── Auto-Map Entity Using Rules ────────────────────────────────────────

export async function autoMapEntityWithRules(
  entityType: string,
  entityId: string
): Promise<DbRow[]> {
  const results = await evaluateRulesForEntity(entityType, entityId);
  const matched = results.filter((r) => r.matched);
  const mappings: DbRow[] = [];

  for (const result of matched) {
    // Find the matching statute_id from statute_library
    const statuteRes = await query(
      `SELECT statute_id FROM statute_library
       WHERE act_name = $1 AND section = $2 AND is_active = true LIMIT 1`,
      [result.lawName, result.provisionCode]
    );

    const statuteId = statuteRes.rows.length > 0
      ? (statuteRes.rows[0].statute_id as string)
      : null;

    if (!statuteId) {
      logInfo("No statute_library entry for rule", { ruleCode: result.ruleCode });
      continue;
    }

    // Skip duplicates
    const existing = await query(
      `SELECT 1 FROM legal_mapping WHERE entity_type = $1 AND entity_id = $2 AND statute_id = $3`,
      [entityType, entityId, statuteId]
    );
    if (existing.rows.length > 0) continue;

    const insertRes = await query(
      `INSERT INTO legal_mapping
         (entity_type, entity_id, statute_id, mapping_source, confidence,
          rule_id, provision_code, rationale_text, confidence_score, reviewer_status)
       VALUES ($1, $2, $3, 'RULE_ENGINE', $4, $5, $6, $7, $8, 'PENDING')
       RETURNING *`,
      [
        entityType,
        entityId,
        statuteId,
        result.confidence,
        result.ruleId,
        result.provisionCode,
        result.rationale,
        result.confidence,
      ]
    );

    mappings.push({
      ...insertRes.rows[0],
      rule_code: result.ruleCode,
      law_name: result.lawName,
    });
  }

  return mappings;
}

// ── Test Rule Against Sample Context ───────────────────────────────────

export function testRuleExpression(
  expression: RuleExpression,
  ctx: EntityContext
): { matched: boolean; confidence: number; rationale: string; matchedConditions: ConditionResult[] } {
  const { matched, matchedConditions } = evaluateRule(expression, ctx);
  const confidence = calculateConfidence(expression, matchedConditions);
  const rationale = matchedConditions
    .map((c) => `${c.field} ${c.op}: ${c.matched ? "PASS" : "FAIL"}`)
    .join("; ");

  return { matched, confidence, rationale, matchedConditions };
}
