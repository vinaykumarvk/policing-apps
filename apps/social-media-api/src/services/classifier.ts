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
  const classification = classifyContent(text);

  // Upsert classification result
  const result = await query(
    `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_type, entity_id) DO UPDATE SET
       category = $3, risk_score = $4, risk_factors = $5, updated_at = now()
     RETURNING *`,
    [entityType, entityId, classification.category, classification.riskScore, JSON.stringify(classification.factors)],
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
