/**
 * Multi-tier narcotics scoring orchestrator.
 * Calls text-normalizer, emoji-drug-decoder, transaction-signal-detector,
 * and slang-normalizer to produce a composite narcotics risk score.
 *
 * Scoring algorithm (DEA/EUROPOL best practices):
 * 1. Substance severity base (fentanyl=100, heroin/meth/cocaine=80, MDMA/LSD=60, cannabis=40)
 * 2. x Activity multiplier (distribution=3x, active sale=2.5x, purchase=1.5x, use=1x)
 * 3. + Context boosters: quantity(+20), price(+15), contact info(+20), repeat offender(+25)
 * 4. + Slang risk bonus (from slang dictionary, up to +20)
 * 5. + Emoji risk contribution (up to +25)
 * 6. Cap at 100
 */

import { normalizeText, KNOWN_DRUG_TERMS } from "./text-normalizer";
import { analyzeEmojis } from "./emoji-drug-decoder";
import { detectTransactionSignals } from "./transaction-signal-detector";
import { normalizeSlangCached, calculateSlangRiskBonus } from "./slang-normalizer";
import { llmCompleteJson } from "./llm-provider";

export interface NarcoticsRiskFactor {
  factor: string;
  contribution: number;
  detail: string;
}

export interface NarcoticsClassificationResult {
  /** Final narcotics risk score (0-100) */
  narcoticsScore: number;
  /** Detected substance category (most severe) */
  substanceCategory: string | null;
  /** Activity type detected */
  activityType: string;
  /** All contributing risk factors */
  riskFactors: NarcoticsRiskFactor[];
  /** Text normalizations applied */
  normalizationsApplied: string[];
  /** Slang dictionary version used */
  slangDictionaryVersion: string;
  /** Pipeline intermediate results for demo/debug display */
  normalizedText?: string;
  keywordsFound?: string[];
  slangMatches?: Array<{ term: string; normalizedForm: string; category: string; riskWeight: number }>;
  emojiMatches?: Array<{ emoji: string; drugCategory: string; signalType: string; riskWeight: number }>;
  transactionSignals?: Array<{ signalType: string; matched: string }>;
  processingTimeMs?: number;
}

/** Substance severity map: drug category -> base score */
const SUBSTANCE_SEVERITY: Record<string, number> = {
  FENTANYL: 100,
  HEROIN: 80,
  METH: 80,
  COCAINE: 80,
  PILLS: 70,
  LEAN: 60,
  PSYCHEDELICS: 60,
  ILLICIT_LIQUOR: 50,
  CANNABIS: 40,
  TRANSACTION: 0,
  QUALITY: 0,
};

/** Map normalized drug keywords to severity categories */
const KEYWORD_TO_CATEGORY: Record<string, string> = {
  fentanyl: "FENTANYL",
  heroin: "HEROIN", "brown sugar": "HEROIN", chitta: "HEROIN",
  meth: "METH", methamphetamine: "METH", crystal: "METH", speed: "METH", amphetamine: "METH",
  cocaine: "COCAINE", coke: "COCAINE", crack: "COCAINE",
  mdma: "METH", ecstasy: "PILLS", molly: "PILLS",
  ketamine: "PILLS", xanax: "PILLS", oxycodone: "PILLS",
  lsd: "PSYCHEDELICS", acid: "PSYCHEDELICS",
  opium: "HEROIN", morphine: "HEROIN", codeine: "LEAN", afeem: "HEROIN",
  cannabis: "CANNABIS", marijuana: "CANNABIS", weed: "CANNABIS",
  ganja: "CANNABIS", charas: "CANNABIS", hashish: "CANNABIS",
  drug: "PILLS", drugs: "PILLS", narcotic: "PILLS", narcotics: "PILLS",
  maal: "PILLS", nashe: "PILLS", sulfa: "CANNABIS", phukki: "CANNABIS",
  // Telugu romanized terms
  ganjayi: "CANNABIS", afeemu: "HEROIN", saarayi: "ILLICIT_LIQUOR",
  naatusaara: "ILLICIT_LIQUOR", kallu: "ILLICIT_LIQUOR", mandu: "PILLS",
  podi: "PILLS", gullu: "PILLS", saruku: "PILLS",
  gaddi: "CANNABIS", gaanja: "CANNABIS", ganji: "CANNABIS",
  poudar: "PILLS", tikke: "PILLS", dose: "PILLS",
};

/**
 * Detect drug terms in text, checking against KNOWN_DRUG_TERMS.
 * Returns matched terms and the highest-severity category.
 */
function detectDrugTerms(text: string): { terms: string[]; topCategory: string | null; topSeverity: number } {
  const lowerText = text.toLowerCase();
  const terms: string[] = [];
  let topCategory: string | null = null;
  let topSeverity = 0;

  for (const term of KNOWN_DRUG_TERMS) {
    // Word-boundary check to avoid partial matches
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lowerText)) {
      terms.push(term);
      const category = KEYWORD_TO_CATEGORY[term];
      if (category) {
        const severity = SUBSTANCE_SEVERITY[category] || 0;
        if (severity > topSeverity) {
          topSeverity = severity;
          topCategory = category;
        }
      }
    }
  }

  return { terms, topCategory, topSeverity };
}

/**
 * Main narcotics classification pipeline.
 * Orchestrates all detection modules and computes a composite score.
 */
export async function classifyNarcotics(
  text: string,
  actorFlaggedPosts = 0,
  isRepeatOffender = false,
): Promise<NarcoticsClassificationResult> {
  const riskFactors: NarcoticsRiskFactor[] = [];
  let narcoticsScore = 0;
  const startTime = Date.now();

  if (!text) {
    return {
      narcoticsScore: 0,
      substanceCategory: null,
      activityType: "NONE",
      riskFactors: [],
      normalizationsApplied: [],
      slangDictionaryVersion: "",
    };
  }

  // Step 1: Normalize text (leetspeak, homoglyphs, unicode, etc.)
  const normalized = normalizeText(text);
  const workingText = normalized.normalizedText;

  // Step 2: Slang normalization (cached, matches romanized_form too)
  const slangResult = await normalizeSlangCached(workingText);
  const enrichedText = slangResult.normalizedText;

  // Step 3: Detect drug terms in the enriched text
  const drugDetection = detectDrugTerms(enrichedText);
  const hasDrugTerm = drugDetection.terms.length > 0;

  // Step 4: Emoji analysis
  const emojiResult = analyzeEmojis(text); // Use original text for emoji extraction

  // Step 5: Transaction signal detection
  const txResult = detectTransactionSignals(
    enrichedText,
    hasDrugTerm || emojiResult.hasSubstanceEmoji,
  );

  // If no drug signals at all, return zero
  if (!hasDrugTerm && !emojiResult.hasSubstanceEmoji) {
    return {
      narcoticsScore: 0,
      substanceCategory: null,
      activityType: "NONE",
      riskFactors: [],
      normalizationsApplied: normalized.appliedTransforms,
      slangDictionaryVersion: slangResult.dictionaryVersion,
      normalizedText: workingText,
      keywordsFound: [],
      slangMatches: slangResult.matches.map(m => ({ term: m.term, normalizedForm: m.normalizedForm, category: m.category, riskWeight: m.riskWeight })),
      emojiMatches: [],
      transactionSignals: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // --- Scoring Algorithm ---

  // 1. Substance severity base
  let baseSeverity = drugDetection.topSeverity;
  let substanceCategory = drugDetection.topCategory;

  // If emoji detected a substance but text didn't, use emoji category
  if (!hasDrugTerm && emojiResult.hasSubstanceEmoji) {
    const topEmojiMatch = emojiResult.matches
      .filter(m => m.signalType === "SUBSTANCE")
      .sort((a, b) => (SUBSTANCE_SEVERITY[b.drugCategory] || 0) - (SUBSTANCE_SEVERITY[a.drugCategory] || 0))[0];
    if (topEmojiMatch) {
      baseSeverity = SUBSTANCE_SEVERITY[topEmojiMatch.drugCategory] || 40;
      substanceCategory = topEmojiMatch.drugCategory;
    }
  }

  if (baseSeverity > 0) {
    riskFactors.push({
      factor: "substance_severity",
      contribution: baseSeverity,
      detail: `${substanceCategory} detected (base severity ${baseSeverity}). Terms: ${drugDetection.terms.join(", ") || "emoji-only"}`,
    });
  }

  // 2. Activity multiplier
  const multipliedScore = Math.min(baseSeverity * txResult.activityMultiplier, 100);
  if (txResult.activityMultiplier > 1) {
    riskFactors.push({
      factor: "activity_multiplier",
      contribution: multipliedScore - baseSeverity,
      detail: `${txResult.activityType} activity (x${txResult.activityMultiplier}). Signals: ${txResult.signals.map(s => s.matched).join(", ")}`,
    });
  }
  narcoticsScore = multipliedScore;

  // 3. Context boosters
  if (txResult.hasQuantity) {
    narcoticsScore += 20;
    riskFactors.push({ factor: "quantity_terms", contribution: 20, detail: "Quantity terms detected" });
  }
  if (txResult.hasPrice) {
    narcoticsScore += 15;
    riskFactors.push({ factor: "price_pattern", contribution: 15, detail: "Price patterns detected" });
  }
  if (txResult.hasContact) {
    narcoticsScore += 20;
    riskFactors.push({ factor: "contact_info", contribution: 20, detail: "Contact/platform info detected" });
  }
  if (isRepeatOffender || actorFlaggedPosts >= 3) {
    const bonus = Math.min(25, 10 + actorFlaggedPosts * 3);
    narcoticsScore += bonus;
    riskFactors.push({
      factor: "repeat_offender",
      contribution: bonus,
      detail: `Repeat offender (${actorFlaggedPosts} flagged posts)`,
    });
  }

  // 4. Slang risk bonus
  const slangBonus = calculateSlangRiskBonus(slangResult.matches);
  if (slangBonus > 0) {
    narcoticsScore += slangBonus;
    riskFactors.push({
      factor: "slang_match",
      contribution: slangBonus,
      detail: `Slang matches: ${slangResult.matches.map(m => m.term).join(", ")}`,
    });
  }

  // 5. Emoji risk contribution
  if (emojiResult.totalRiskContribution > 0) {
    narcoticsScore += emojiResult.totalRiskContribution;
    riskFactors.push({
      factor: "emoji_drug_code",
      contribution: emojiResult.totalRiskContribution,
      detail: `Emoji codes: ${emojiResult.matches.map(m => `${m.emoji}(${m.drugCategory})`).join(", ")}`,
    });
  }

  // 6. Cap at 100
  narcoticsScore = Math.min(Math.round(narcoticsScore * 100) / 100, 100);

  // 7. LLM enhancement for ambiguous scores (20-60 range)
  if (narcoticsScore >= 20 && narcoticsScore <= 60) {
    try {
      const llmResult = await llmCompleteJson<{
        narcotics_score?: number;
        substance_category?: string;
        activity_type?: string;
        confidence_band?: string;
        sub_reason_scores?: Array<{ reason_code: string; score: number; matched_evidence?: string[]; explanation?: string }>;
        final_reasoning?: string;
      }>(
        {
          messages: [{ role: "user", content: text }],
          useCase: "NARCOTICS_ANALYSIS",
          maxTokens: 1536,
          temperature: 0.2,
        },
        [{ field: "narcotics_score", type: "number" }],
      );

      if (llmResult) {
        const parsed = llmResult.data;
        const llmScore = typeof parsed.narcotics_score === "number" ? parsed.narcotics_score : 0;

        if (llmScore > narcoticsScore) {
          const prevScore = narcoticsScore;
          narcoticsScore = Math.min(llmScore, 100);
          if (parsed.substance_category && !substanceCategory) {
            substanceCategory = parsed.substance_category;
          }
          riskFactors.push({
            factor: "llm_narcotics_analysis",
            contribution: narcoticsScore - prevScore,
            detail: `LLM elevated score: ${parsed.final_reasoning || parsed.activity_type || "N/A"}`,
          });
        }
      }
    } catch {
      // LLM failed — keep rule-based score
    }
  }

  return {
    narcoticsScore,
    substanceCategory,
    activityType: txResult.activityType,
    riskFactors,
    normalizationsApplied: normalized.appliedTransforms,
    slangDictionaryVersion: slangResult.dictionaryVersion,
    normalizedText: workingText,
    keywordsFound: drugDetection.terms,
    slangMatches: slangResult.matches.map(m => ({ term: m.term, normalizedForm: m.normalizedForm, category: m.category, riskWeight: m.riskWeight })),
    emojiMatches: emojiResult.matches.map(m => ({ emoji: m.emoji, drugCategory: m.drugCategory, signalType: m.signalType, riskWeight: m.riskWeight })),
    transactionSignals: txResult.signals.map(s => ({ signalType: s.signalType, matched: s.matched })),
    processingTimeMs: Date.now() - startTime,
  };
}
