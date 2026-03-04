import { query } from "../db";

type DbRow = Record<string, unknown>;

interface RoleFactor {
  ruleName: string;
  matchedKeywords: string[];
  weight: number;
  score: number;
}

interface ClassificationResult {
  roleType: string;
  confidence: number;
  factors: RoleFactor[];
  isRecidivist: boolean;
  priorOffenses: number;
}

export async function classifyDrugRole(text: string, subjectEntityId?: string): Promise<ClassificationResult> {
  const lowerText = (text || "").toLowerCase();

  // Load active rules
  const rulesResult = await query(`SELECT * FROM drug_role_rule WHERE is_active = true`);
  const rules = rulesResult.rows;

  // Score each role
  const roleScores = new Map<string, { score: number; factors: RoleFactor[] }>();

  for (const rule of rules) {
    const keywords: string[] = rule.keywords || [];
    const matched = keywords.filter(kw => lowerText.includes(kw.toLowerCase()));

    if (matched.length > 0) {
      const factor: RoleFactor = {
        ruleName: rule.rule_name,
        matchedKeywords: matched,
        weight: parseFloat(rule.weight),
        score: (matched.length / keywords.length) * 100 * parseFloat(rule.weight),
      };

      if (!roleScores.has(rule.role_type)) {
        roleScores.set(rule.role_type, { score: 0, factors: [] });
      }
      const entry = roleScores.get(rule.role_type)!;
      entry.score += factor.score;
      entry.factors.push(factor);
    }
  }

  // Find best matching role
  let bestRole = "UNKNOWN";
  let bestScore = 0;
  let bestFactors: RoleFactor[] = [];

  for (const [role, data] of roleScores) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestRole = role;
      bestFactors = data.factors;
    }
  }

  // Check recidivism
  let isRecidivist = false;
  let priorOffenses = 0;

  if (subjectEntityId) {
    const priorResult = await query(
      `SELECT COUNT(*) as cnt FROM drug_role_classification WHERE subject_entity_id = $1 AND review_status = 'CONFIRMED'`,
      [subjectEntityId],
    );
    priorOffenses = parseInt(priorResult.rows[0]?.cnt || "0", 10);
    isRecidivist = priorOffenses > 0;
  }

  const confidence = Math.min(100, bestScore);

  return {
    roleType: bestRole,
    confidence: Math.round(confidence * 100) / 100,
    factors: bestFactors,
    isRecidivist,
    priorOffenses,
  };
}

export async function classifyAndStore(
  subjectEntityType: string,
  subjectEntityId: string,
  text: string,
): Promise<DbRow> {
  const result = await classifyDrugRole(text, subjectEntityId);

  const stored = await query(
    `INSERT INTO drug_role_classification (subject_entity_type, subject_entity_id, role_type, confidence, factors, is_recidivist, prior_offenses)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [subjectEntityType, subjectEntityId, result.roleType, result.confidence, JSON.stringify(result.factors), result.isRecidivist, result.priorOffenses],
  );

  return stored.rows[0];
}

export async function getClassification(subjectEntityType: string, subjectEntityId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM drug_role_classification WHERE subject_entity_type = $1 AND subject_entity_id = $2 ORDER BY created_at DESC`,
    [subjectEntityType, subjectEntityId],
  );
  return result.rows;
}

export async function reviewClassification(
  classificationId: string,
  reviewStatus: string,
  reviewedBy: string,
): Promise<DbRow> {
  const result = await query(
    `UPDATE drug_role_classification SET review_status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
     WHERE classification_id = $1 RETURNING *`,
    [classificationId, reviewStatus, reviewedBy],
  );
  return result.rows[0];
}

export async function getRoleDistribution(): Promise<DbRow[]> {
  const result = await query(
    `SELECT role_type, COUNT(*) as count, AVG(confidence) as avg_confidence,
            SUM(CASE WHEN is_recidivist THEN 1 ELSE 0 END) as recidivists
     FROM drug_role_classification
     WHERE review_status IN ('PENDING', 'CONFIRMED')
     GROUP BY role_type ORDER BY count DESC`,
  );
  return result.rows;
}

export async function getRecidivists(): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM drug_role_classification WHERE is_recidivist = true ORDER BY prior_offenses DESC, created_at DESC LIMIT 50`,
  );
  return result.rows;
}
