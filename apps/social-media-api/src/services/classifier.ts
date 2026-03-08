import { query } from "../db";

type DbRow = Record<string, unknown>;

interface RiskFactor {
  factor: string;
  weight: number;
  score: number;
  detail: string;
}

interface ClassificationResult {
  category: string;
  riskScore: number;
  factors: RiskFactor[];
  taxonomyVersionId?: string;
}

const KEYWORD_CATEGORIES: Record<string, string[]> = {
  HATE_SPEECH: ["hate", "threat", "violence", "kill", "attack", "extremist"],
  FRAUD: ["scam", "fraud", "fake", "phishing", "money laundering"],
  HARASSMENT: ["harass", "stalk", "bully", "intimidat", "abuse"],
  CSAM: ["child", "minor", "underage"],
  TERRORISM: ["terror", "bomb", "radicali", "jihad", "extremis"],
  DRUGS: ["drug", "narcotic", "cocaine", "heroin", "meth", "cannabis", "ganja"],
  CYBER_CRIME: ["hack", "malware", "ransomware", "phish", "ddos"],
};

/**
 * FR-06 AC-02: Taxonomy-backed classification.
 * Queries the active taxonomy_version + taxonomy_rule from DB first;
 * falls back to hardcoded KEYWORD_CATEGORIES when no active taxonomy exists.
 */
export async function classifyContentWithTaxonomy(text: string): Promise<ClassificationResult> {
  const lowerText = (text || "").toLowerCase();
  const factors: RiskFactor[] = [];
  let bestCategory = "UNCATEGORIZED";
  let maxScore = 0;
  let taxonomyVersionId: string | undefined;

  // Try taxonomy rules from active version
  const activeVersion = await query(
    `SELECT tv.version_id FROM taxonomy_version tv WHERE tv.is_active = TRUE LIMIT 1`,
  );

  if (activeVersion.rows.length > 0) {
    taxonomyVersionId = activeVersion.rows[0].version_id;
    const rulesResult = await query(
      `SELECT category, pattern, threshold, risk_weight FROM taxonomy_rule
       WHERE version_id = $1 AND is_active = TRUE ORDER BY category`,
      [taxonomyVersionId],
    );

    for (const rule of rulesResult.rows) {
      try {
        // Guard against ReDoS: reject patterns with nested quantifiers or excessive length
        const pattern = String(rule.pattern);
        if (pattern.length > 200 || /(\+|\*|\{)\??\)(\+|\*|\{)/.test(pattern)) continue;
        const regex = new RegExp(pattern, "gi");
        const matches = lowerText.match(regex);
        if (matches && matches.length > 0) {
          const score = Math.min(matches.length * 20, 100);
          const weight = parseFloat(rule.risk_weight) || 0.3;
          factors.push({
            factor: `taxonomy_match_${rule.category.toLowerCase()}`,
            weight,
            score,
            detail: `Taxonomy rule matched: ${matches.length} hit(s)`,
          });
          if (score * weight > maxScore) {
            maxScore = score * weight;
            bestCategory = rule.category;
          }
        }
      } catch {
        // Invalid regex in rule — skip silently
      }
    }
  }

  // Fall back to hardcoded categories if taxonomy produced no matches
  if (factors.length === 0) {
    const result = classifyContent(text);
    return { ...result, taxonomyVersionId };
  }

  // Text length factor
  if (lowerText.length > 500) {
    factors.push({ factor: "lengthy_content", weight: 0.1, score: 30, detail: "Content exceeds 500 characters" });
  }

  const riskScore = factors.length > 0
    ? Math.min(100, factors.reduce((sum, f) => sum + f.weight * f.score, 0) / factors.reduce((sum, f) => sum + f.weight, 0))
    : 0;

  return { category: bestCategory, riskScore: Math.round(riskScore * 100) / 100, factors, taxonomyVersionId };
}

/**
 * Synchronous fallback classifier using hardcoded keyword categories.
 */
export function classifyContent(text: string): ClassificationResult {
  const lowerText = (text || "").toLowerCase();
  const factors: RiskFactor[] = [];
  let bestCategory = "UNCATEGORIZED";
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    const matches = keywords.filter(kw => lowerText.includes(kw));
    if (matches.length > 0) {
      factors.push({
        factor: `keyword_match_${category.toLowerCase()}`,
        weight: 0.3,
        score: Math.min(matches.length * 20, 100),
        detail: `Matched keywords: ${matches.join(", ")}`,
      });
      if (matches.length > maxMatches) {
        maxMatches = matches.length;
        bestCategory = category;
      }
    }
  }

  // Text length factor
  if (lowerText.length > 500) {
    factors.push({ factor: "lengthy_content", weight: 0.1, score: 30, detail: "Content exceeds 500 characters" });
  }

  // Calculate weighted risk score
  const riskScore = factors.length > 0
    ? Math.min(100, factors.reduce((sum, f) => sum + f.weight * f.score, 0) / factors.reduce((sum, f) => sum + f.weight, 0))
    : 0;

  return { category: bestCategory, riskScore: Math.round(riskScore * 100) / 100, factors };
}

/**
 * FR-07: Classify content with actor history risk bonus.
 * If the actor is a repeat offender or has 3+ flagged posts, add a risk bonus.
 */
export function classifyContentWithActorHistory(
  text: string,
  actorFlaggedPosts: number,
  isRepeatOffender: boolean,
): ClassificationResult {
  const base = classifyContent(text);

  if (isRepeatOffender || actorFlaggedPosts >= 3) {
    const bonus = Math.min(actorFlaggedPosts * 5, 30);
    base.factors.push({
      factor: "repeat_offender_history",
      weight: 0.4,
      score: bonus,
      detail: `Actor has ${actorFlaggedPosts} flagged posts, repeat_offender=${isRepeatOffender}`,
    });
    // Recalculate
    const totalWeight = base.factors.reduce((s, f) => s + f.weight, 0);
    base.riskScore = Math.min(100, Math.round(
      (base.factors.reduce((s, f) => s + f.weight * f.score, 0) / totalWeight) * 100,
    ) / 100);
  }

  return base;
}

export async function classifyEntity(entityType: string, entityId: string): Promise<DbRow> {
  // Determine table and text column based on entity type
  let tableName: string;
  let textColumn: string;
  let idColumn: string;

  switch (entityType) {
    case "sm_alert": tableName = "sm_alert"; textColumn = "description"; idColumn = "alert_id"; break;
    case "sm_case": tableName = "case_record"; textColumn = "description"; idColumn = "case_id"; break;
    case "sm_evidence": tableName = "evidence_item"; textColumn = "description"; idColumn = "evidence_id"; break;
    default: throw new Error(`Unknown entity type: ${entityType}`);
  }

  const entityResult = await query(`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`, [entityId]);
  if (entityResult.rows.length === 0) throw new Error("Entity not found");

  const text = entityResult.rows[0][textColumn] || "";
  // FR-06 AC-02: Use taxonomy-backed classification
  const classification = await classifyContentWithTaxonomy(text);

  // Upsert classification result with taxonomy_version_id
  const result = await query(
    `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors, taxonomy_version_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (entity_type, entity_id) DO UPDATE SET
       category = $3, risk_score = $4, risk_factors = $5, taxonomy_version_id = $6, updated_at = now()
     RETURNING *`,
    [entityType, entityId, classification.category, classification.riskScore, JSON.stringify(classification.factors), classification.taxonomyVersionId || null],
  );

  return result.rows[0];
}

export async function getClassification(entityType: string, entityId: string): Promise<DbRow | null> {
  const result = await query(
    `SELECT * FROM classification_result WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [entityType, entityId],
  );
  return result.rows[0] || null;
}

export async function overrideClassification(
  classificationId: string,
  overrideBy: string,
  category: string,
  riskScore: number,
  reason: string,
): Promise<DbRow> {
  const result = await query(
    `UPDATE classification_result SET category = $2, risk_score = $3, analyst_override = true, override_by = $4, override_reason = $5, updated_at = now()
     WHERE classification_id = $1 RETURNING *`,
    [classificationId, category, riskScore, overrideBy, reason],
  );
  return result.rows[0];
}
