import { query } from "../db";
import { classifyNarcotics, type NarcoticsClassificationResult } from "./narcotics-scorer";
import { llmCompleteJson, isLlmAvailable } from "./llm-provider";

type DbRow = Record<string, unknown>;

export interface RiskFactor {
  factor: string;
  weight: number;
  score: number;
  detail: string;
}

export interface ClassificationResult {
  category: string;
  riskScore: number;
  factors: RiskFactor[];
  taxonomyVersionId?: string;
}

/** Rich LLM classification output — explainable narcotics-intelligence schema */
export interface LlmClassificationOutput {
  post_id?: string;
  language?: string;
  narcotics_relevance?: {
    label: string;
    score: number;
    reasoning: string;
  };
  primary_category?: {
    label: string;
    score: number;
    reasoning: string;
  };
  secondary_categories?: Array<{
    label: string;
    score: number;
    reasoning: string;
  }>;
  sub_reason_scores?: Array<{
    reason_code: string;
    reason_label: string;
    score: number;
    matched_evidence: string[];
    explanation: string;
  }>;
  matched_entities?: {
    drug_terms?: string[];
    slang_terms?: string[];
    emoji_codes?: string[];
    contact_handles?: string[];
    phone_numbers?: string[];
    payment_indicators?: string[];
    locations?: string[];
    delivery_terms?: string[];
  };
  confidence_band?: string;
  review_recommended?: boolean;
  review_reason?: string;
  final_reasoning?: string;
  // Legacy fields for backward compat
  category?: string;
  confidence?: number;
  risk_score?: number;
  factors?: Array<{ factor: string; detail: string }>;
}

/**
 * Bridge LLM output category names → taxonomy_category.name
 */
const LLM_TO_TAXONOMY: Record<string, string> = {
  DRUGS: "DRUGS_TRAFFICKING",
  FRAUD: "CYBER_FRAUD",
  CYBER_CRIME: "CYBER_FRAUD",
  ILLICIT_LIQUOR: "DRUGS_CONSUMPTION",
  UNCATEGORIZED: "GENERAL",
  GENERAL: "GENERAL",
  // Direct matches: HATE_SPEECH, HARASSMENT, CSAM, TERRORISM, FAKE_NEWS,
  // DEFAMATION, EXTORTION, GAMBLING, IDENTITY_THEFT, DRUGS_TRAFFICKING,
  // DRUGS_CONSUMPTION, CYBER_FRAUD
};

export function normalizeCategoryToTaxonomy(cat: string): string {
  const upper = cat?.toUpperCase() ?? "GENERAL";
  return LLM_TO_TAXONOMY[upper] ?? upper;
}

const KEYWORD_CATEGORIES: Record<string, string[]> = {
  HATE_SPEECH: ["hate", "threat", "violence", "kill", "attack", "extremist"],
  FRAUD: ["scam", "fraud", "fake", "phishing", "money laundering"],
  HARASSMENT: ["harass", "stalk", "bully", "intimidat", "abuse"],
  CSAM: ["child", "minor", "underage"],
  TERRORISM: ["terror", "bomb", "radicali", "jihad", "extremis"],
  DRUGS: [
    "drug", "narcotic", "cocaine", "heroin", "meth", "cannabis", "ganja",
    "ganjayi", "afeemu", "naatusaara", "saarayi", "mandu", "podi",
    "gullu", "saruku", "gaddi", "gaanja", "ganji",
  ],
  ILLICIT_LIQUOR: ["naatusaara", "kallu", "saarayi", "belt shop", "kaltee"],
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

/**
 * LLM-enhanced classifier: tries LLM first, falls back to rules on any failure.
 * Returns result with llmUsed flag and optional llmConfidence.
 */
export async function classifyContentWithLlm(
  text: string,
  actorFlaggedPosts = 0,
  isRepeatOffender = false,
): Promise<ClassificationResult & { narcoticsResult?: NarcoticsClassificationResult; llmUsed: boolean; llmConfidence?: number; llmClassification?: LlmClassificationOutput; llmError?: string }> {
  // Always run the rule-based pipeline (narcotics + standard)
  const rulesResult = await classifyContentEnhanced(text, actorFlaggedPosts, isRepeatOffender);

  // Check if rule-based pipeline found any meaningful signals worth sending to LLM
  const nr = rulesResult.narcoticsResult;
  const hasMeaningfulSignals =
    (nr?.keywordsFound?.length ?? 0) > 0 ||
    (nr?.slangMatches?.length ?? 0) > 0 ||
    (nr?.emojiMatches?.length ?? 0) > 0 ||
    (nr?.transactionSignals?.length ?? 0) > 0 ||
    (rulesResult.riskScore > 0 && rulesResult.category !== "UNCATEGORIZED");

  if (!hasMeaningfulSignals) {
    return {
      category: "GENERAL",
      riskScore: 0,
      factors: [],
      narcoticsResult: nr,
      llmUsed: false,
      llmConfidence: undefined,
      llmClassification: undefined,
    };
  }

  // Build pre-extracted signals from the rule-based pipeline for the LLM
  const preExtractedSignals = nr ? {
    drug_terms: nr.keywordsFound || [],
    slang_terms: nr.slangMatches?.map(s => s.term) || [],
    emoji_codes: nr.emojiMatches?.map(e => e.emoji) || [],
    sale_terms: nr.transactionSignals?.filter(s => s.signalType === "SALE" || s.signalType === "PURCHASE").map(s => s.matched) || [],
    delivery_terms: nr.transactionSignals?.filter(s => s.signalType === "CONTACT").map(s => s.matched) || [],
    payment_terms: nr.transactionSignals?.filter(s => s.signalType === "PRICE").map(s => s.matched) || [],
    quantity_terms: nr.transactionSignals?.filter(s => s.signalType === "QUANTITY").map(s => s.matched) || [],
    locations: [] as string[],
    contact_handles: [] as string[],
  } : undefined;

  const userContent = preExtractedSignals
    ? `Return JSON using the required schema.\n\nINPUT:\n${JSON.stringify({
        post_id: "content",
        raw_text: text,
        language_hint: "auto-detect",
        pre_extracted_signals: preExtractedSignals,
      }, null, 2)}`
    : text;

  // Check if LLM provider is available before attempting
  const llmAvailable = await isLlmAvailable();
  if (!llmAvailable) {
    return {
      ...rulesResult,
      llmUsed: false,
      llmError: "NO_API_KEY",
    };
  }

  // Try LLM classification with JSON mode
  try {
    const llmResult = await llmCompleteJson<LlmClassificationOutput>(
      {
        messages: [{ role: "user", content: userContent }],
        useCase: "CLASSIFICATION",
        maxTokens: 2048,
        temperature: 0.2,
      },
      [
        { field: "primary_category", type: "object" },
        { field: "narcotics_relevance", type: "object" },
      ],
    );

    if (llmResult) {
      const parsed = llmResult.data;

      // Extract score: prefer primary_category.score, fallback to risk_score, narcotics_relevance.score
      const llmScore = parsed.primary_category?.score
        ?? parsed.risk_score
        ?? parsed.narcotics_relevance?.score
        ?? 0;

      // Map confidence band to numeric confidence
      const confidenceMap: Record<string, number> = { high: 0.9, medium: 0.65, low: 0.35 };
      const llmConfidence = parsed.confidence
        ?? (parsed.confidence_band ? confidenceMap[parsed.confidence_band] : undefined)
        ?? undefined;

      // Extract category from rich format
      const llmCategory = parsed.primary_category?.label
        ?? parsed.category
        ?? rulesResult.category;

      // Build factors from sub_reason_scores
      const llmFactors: RiskFactor[] = Array.isArray(parsed.sub_reason_scores)
        ? parsed.sub_reason_scores.map(sr => ({
            factor: sr.reason_code || "llm_factor",
            weight: 1.0,
            score: sr.score || 0,
            detail: `${sr.reason_label}: ${sr.explanation}${sr.matched_evidence?.length ? ` [${sr.matched_evidence.join(", ")}]` : ""}`,
          }))
        : Array.isArray(parsed.factors)
          ? parsed.factors.map(f => ({
              factor: String(f.factor || "llm_factor"),
              weight: 1.0,
              score: llmScore,
              detail: String(f.detail || "LLM classification"),
            }))
          : [{ factor: "llm_classification", weight: 1.0, score: llmScore, detail: `LLM classified as ${llmCategory}` }];

      // Use whichever scores higher (LLM or rules)
      if (llmScore > rulesResult.riskScore) {
        return {
          category: llmCategory.toUpperCase(),
          riskScore: llmScore,
          factors: llmFactors,
          narcoticsResult: rulesResult.narcoticsResult,
          llmUsed: true,
          llmConfidence,
          llmClassification: parsed,
        };
      }

      // Rules scored higher, but still attach the LLM output
      return { ...rulesResult, llmUsed: true, llmConfidence, llmClassification: parsed };
    }
  } catch (err) {
    // LLM failed — fall through to rules with error info
    return {
      ...rulesResult,
      llmUsed: false,
      llmError: `LLM_CALL_FAILED: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ...rulesResult, llmUsed: false, llmError: "LLM_NO_RESULT" };
}

/**
 * Enhanced classifier: runs standard classification + narcotics pipeline,
 * returns whichever scores higher. Used in the ingestion pipeline.
 */
export async function classifyContentEnhanced(
  text: string,
  actorFlaggedPosts = 0,
  isRepeatOffender = false,
): Promise<ClassificationResult & { narcoticsResult?: NarcoticsClassificationResult }> {
  // Run standard classification
  const standard = classifyContent(text);

  // Run narcotics pipeline
  const narcoticsResult = await classifyNarcotics(text, actorFlaggedPosts, isRepeatOffender);

  // If narcotics score is higher, build a ClassificationResult from it
  if (narcoticsResult.narcoticsScore > standard.riskScore) {
    const factors: RiskFactor[] = narcoticsResult.riskFactors.map(rf => ({
      factor: rf.factor,
      weight: 1.0,
      score: rf.contribution,
      detail: rf.detail,
    }));

    return {
      category: narcoticsResult.substanceCategory ? `DRUGS_${narcoticsResult.substanceCategory}` : "DRUGS",
      riskScore: narcoticsResult.narcoticsScore,
      factors,
      narcoticsResult,
    };
  }

  // Standard result is higher — return with actor history if applicable
  if (isRepeatOffender || actorFlaggedPosts >= 3) {
    return { ...classifyContentWithActorHistory(text, actorFlaggedPosts, isRepeatOffender), narcoticsResult };
  }

  return { ...standard, narcoticsResult };
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
    case "content_item": tableName = "content_item"; textColumn = "content_text"; idColumn = "content_id"; break;
    default: throw new Error(`Unknown entity type: ${entityType}`);
  }

  const entityResult = await query(`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`, [entityId]);
  if (entityResult.rows.length === 0) throw new Error("Entity not found");

  const text = entityResult.rows[0][textColumn] || "";

  // For content_item, use LLM-enhanced classification; otherwise taxonomy-backed
  const isContentItem = entityType === "content_item";
  const classification = isContentItem
    ? await classifyContentWithLlm(text)
    : await classifyContentWithTaxonomy(text);

  // Build pipeline_metadata from narcotics result if available
  const narcoticsResult = "narcoticsResult" in classification
    ? (classification as { narcoticsResult?: NarcoticsClassificationResult }).narcoticsResult
    : undefined;
  const llmClassification = "llmClassification" in classification
    ? (classification as { llmClassification?: LlmClassificationOutput }).llmClassification
    : undefined;
  const pipelineMetadata = narcoticsResult ? {
    normalizedText: narcoticsResult.normalizedText,
    keywordsFound: narcoticsResult.keywordsFound,
    slangMatches: narcoticsResult.slangMatches,
    emojiMatches: narcoticsResult.emojiMatches,
    transactionSignals: narcoticsResult.transactionSignals,
    normalizationsApplied: narcoticsResult.normalizationsApplied,
    substanceCategory: narcoticsResult.substanceCategory,
    activityType: narcoticsResult.activityType,
    narcoticsScore: narcoticsResult.narcoticsScore,
    slangDictionaryVersion: narcoticsResult.slangDictionaryVersion,
    processingTimeMs: narcoticsResult.processingTimeMs,
    llmUsed: "llmUsed" in classification ? (classification as { llmUsed: boolean }).llmUsed : false,
    llmError: "llmError" in classification ? (classification as { llmError?: string }).llmError : undefined,
    classifiedAt: new Date().toISOString(),
    ...(llmClassification ? {
      llmClassification: {
        narcoticsRelevance: llmClassification.narcotics_relevance,
        primaryCategory: llmClassification.primary_category,
        secondaryCategories: llmClassification.secondary_categories,
        subReasonScores: llmClassification.sub_reason_scores,
        matchedEntities: llmClassification.matched_entities,
        confidenceBand: llmClassification.confidence_band,
        reviewRecommended: llmClassification.review_recommended,
        reviewReason: llmClassification.review_reason,
        finalReasoning: llmClassification.final_reasoning,
      },
    } : {}),
  } : {};

  // Upsert classification result with taxonomy_version_id, LLM metadata, and pipeline metadata
  const result = await query(
    `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors, taxonomy_version_id, classified_by_llm, llm_confidence, pipeline_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (entity_type, entity_id) DO UPDATE SET
       category = $3, risk_score = $4, risk_factors = $5, taxonomy_version_id = $6,
       classified_by_llm = $7, llm_confidence = $8, pipeline_metadata = $9, updated_at = now()
     RETURNING *`,
    [
      entityType, entityId, classification.category, classification.riskScore,
      JSON.stringify(classification.factors),
      ("taxonomyVersionId" in classification ? classification.taxonomyVersionId : null) || null,
      "llmUsed" in classification ? classification.llmUsed : false,
      "llmConfidence" in classification ? (classification.llmConfidence ?? null) : null,
      JSON.stringify(pipelineMetadata),
    ],
  );

  // For content_item, sync category_id and threat_score back
  if (isContentItem) {
    try {
      const taxName = normalizeCategoryToTaxonomy(classification.category);
      const catResult = await query(
        `SELECT category_id FROM taxonomy_category WHERE name = $1 LIMIT 1`,
        [taxName],
      );
      if (catResult.rows.length > 0) {
        await query(
          `UPDATE content_item SET category_id = $1, threat_score = $2 WHERE content_id = $3`,
          [catResult.rows[0].category_id, classification.riskScore, entityId],
        );
      }
    } catch {
      // Category FK sync failed — non-fatal
    }
  }

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
