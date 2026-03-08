/**
 * Emoji drug code detection for narcotics pipeline.
 * Pure synchronous module — no DB or I/O dependencies.
 *
 * Based on DEA's published emoji drug code guide.
 * Detects substance, transaction, and quality emojis,
 * plus high-priority combinations.
 */

export interface EmojiMatch {
  emoji: string;
  drugCategory: string;
  signalType: "SUBSTANCE" | "TRANSACTION" | "QUALITY";
  riskWeight: number;
  description: string;
}

export interface EmojiCombination {
  emojis: string[];
  description: string;
  bonusWeight: number;
}

export interface EmojiAnalysisResult {
  /** Individual emoji matches found */
  matches: EmojiMatch[];
  /** High-priority emoji combinations detected */
  combinations: EmojiCombination[];
  /** Total risk contribution from emojis (capped at 25) */
  totalRiskContribution: number;
  /** Whether any substance emojis were found */
  hasSubstanceEmoji: boolean;
  /** Whether any transaction emojis were found */
  hasTransactionEmoji: boolean;
}

/** Emoji → drug mapping table (based on DEA published guide) */
const EMOJI_DRUG_MAP: EmojiMatch[] = [
  // Cocaine
  { emoji: "❄️", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Snowflake — cocaine" },
  { emoji: "❄", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Snowflake (no VS16) — cocaine" },
  { emoji: "⛷️", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Skier — cocaine use" },
  { emoji: "⛷", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Skier (no VS16) — cocaine use" },
  { emoji: "🎿", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Ski — cocaine" },
  { emoji: "🔑", drugCategory: "COCAINE", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Key — kilo of cocaine" },
  // Methamphetamine
  { emoji: "💎", drugCategory: "METH", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Diamond — crystal meth" },
  { emoji: "🧊", drugCategory: "METH", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Ice cube — crystal meth/ice" },
  { emoji: "💙", drugCategory: "METH", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Blue heart — blue meth" },
  // Pills / MDMA / Fentanyl pills
  { emoji: "💊", drugCategory: "PILLS", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Pill — prescription/MDMA/fentanyl pills" },
  { emoji: "🍬", drugCategory: "PILLS", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Candy — MDMA/ecstasy" },
  { emoji: "🎉", drugCategory: "PILLS", signalType: "SUBSTANCE", riskWeight: 0.5, description: "Party — MDMA/party drugs" },
  // Cannabis
  { emoji: "🍁", drugCategory: "CANNABIS", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Maple leaf — marijuana" },
  { emoji: "🌿", drugCategory: "CANNABIS", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Herb — marijuana" },
  { emoji: "🍃", drugCategory: "CANNABIS", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Leaf — marijuana" },
  { emoji: "🌲", drugCategory: "CANNABIS", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Tree — marijuana" },
  // Heroin
  { emoji: "🐉", drugCategory: "HEROIN", signalType: "SUBSTANCE", riskWeight: 2.0, description: "Dragon — chasing the dragon/heroin" },
  { emoji: "🍫", drugCategory: "HEROIN", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Chocolate — heroin (brown)" },
  { emoji: "🥄", drugCategory: "HEROIN", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Spoon — heroin preparation" },
  // Fentanyl
  { emoji: "💀", drugCategory: "FENTANYL", signalType: "SUBSTANCE", riskWeight: 2.5, description: "Skull — fentanyl/deadly potency" },
  { emoji: "☠️", drugCategory: "FENTANYL", signalType: "SUBSTANCE", riskWeight: 2.5, description: "Skull and crossbones — fentanyl" },
  { emoji: "☠", drugCategory: "FENTANYL", signalType: "SUBSTANCE", riskWeight: 2.5, description: "Skull and crossbones (no VS16) — fentanyl" },
  // Lean / Codeine
  { emoji: "💜", drugCategory: "LEAN", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Purple heart — lean/purple drank" },
  { emoji: "🍇", drugCategory: "LEAN", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Grapes — lean/purple drank" },
  { emoji: "🥤", drugCategory: "LEAN", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Cup — lean/styrofoam cup" },
  // Psychedelics
  { emoji: "🍄", drugCategory: "PSYCHEDELICS", signalType: "SUBSTANCE", riskWeight: 1.5, description: "Mushroom — psilocybin mushrooms" },
  { emoji: "👁️", drugCategory: "PSYCHEDELICS", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Eye — LSD/psychedelic experience" },
  { emoji: "👁", drugCategory: "PSYCHEDELICS", signalType: "SUBSTANCE", riskWeight: 1.0, description: "Eye (no VS16) — LSD" },
  // Transaction signals
  { emoji: "🔌", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 2.0, description: "Plug — drug dealer/connection" },
  { emoji: "📦", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 1.5, description: "Package — drug shipment" },
  { emoji: "💸", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 1.5, description: "Money with wings — payment" },
  { emoji: "🤑", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 1.5, description: "Money face — for sale" },
  { emoji: "📬", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 1.5, description: "Mailbox — mail-order drugs" },
  { emoji: "🏧", drugCategory: "TRANSACTION", signalType: "TRANSACTION", riskWeight: 1.0, description: "ATM — cash transaction" },
  // Quality / potency signals
  { emoji: "🔥", drugCategory: "QUALITY", signalType: "QUALITY", riskWeight: 1.5, description: "Fire — potent/high quality" },
  { emoji: "💣", drugCategory: "QUALITY", signalType: "QUALITY", riskWeight: 1.5, description: "Bomb — very potent" },
  { emoji: "🚀", drugCategory: "QUALITY", signalType: "QUALITY", riskWeight: 1.0, description: "Rocket — strong effect" },
  { emoji: "💯", drugCategory: "QUALITY", signalType: "QUALITY", riskWeight: 1.0, description: "Hundred — pure/uncut" },
  { emoji: "⭐", drugCategory: "QUALITY", signalType: "QUALITY", riskWeight: 0.5, description: "Star — top quality" },
  { emoji: "⛽", drugCategory: "CANNABIS", signalType: "QUALITY", riskWeight: 1.5, description: "Gas pump — high-grade weed" },
];

/** Build a Set of emojis for O(1) lookup */
const EMOJI_SET = new Map<string, EmojiMatch>();
for (const entry of EMOJI_DRUG_MAP) {
  EMOJI_SET.set(entry.emoji, entry);
}

/** High-priority emoji combinations */
interface ComboDef {
  /** All emojis that must be present */
  required: string[];
  description: string;
  bonusWeight: number;
}

const COMBO_DEFS: ComboDef[] = [
  { required: ["❄️", "💸", "📦"], description: "Cocaine sale with delivery", bonusWeight: 5.0 },
  { required: ["❄️", "💸"], description: "Cocaine sale", bonusWeight: 3.0 },
  { required: ["💊", "💸"], description: "Pill sale", bonusWeight: 3.0 },
  { required: ["💎", "🔌"], description: "Meth dealer", bonusWeight: 3.0 },
  { required: ["💀", "💊"], description: "Fentanyl pills", bonusWeight: 4.0 },
  { required: ["🍁", "🔌"], description: "Cannabis dealer", bonusWeight: 2.0 },
  { required: ["🐉", "💸"], description: "Heroin sale", bonusWeight: 3.0 },
  { required: ["💊", "📦"], description: "Pill shipment", bonusWeight: 3.0 },
  { required: ["🔥", "🔌"], description: "Potent supply available", bonusWeight: 2.0 },
];

/**
 * Extract all emoji characters/sequences from text.
 * Uses a broad Unicode emoji regex to capture multi-codepoint sequences.
 */
function extractEmojis(text: string): string[] {
  // Match emoji sequences including variation selectors and ZWJ sequences
  const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
  const matches = text.match(emojiRegex);
  return matches || [];
}

/**
 * Analyze text for drug-related emoji codes.
 */
export function analyzeEmojis(text: string): EmojiAnalysisResult {
  if (!text) {
    return { matches: [], combinations: [], totalRiskContribution: 0, hasSubstanceEmoji: false, hasTransactionEmoji: false };
  }

  const emojis = extractEmojis(text);
  const matches: EmojiMatch[] = [];
  const foundEmojis = new Set<string>();

  for (const emoji of emojis) {
    const entry = EMOJI_SET.get(emoji);
    if (entry && !foundEmojis.has(emoji)) {
      matches.push(entry);
      foundEmojis.add(emoji);
    }
  }

  // Detect combinations
  const combinations: EmojiCombination[] = [];
  for (const combo of COMBO_DEFS) {
    // Check with and without variation selector
    const allPresent = combo.required.every(req => {
      if (foundEmojis.has(req)) return true;
      // Try without variation selector (strip \uFE0F)
      const stripped = req.replace(/\uFE0F/g, "");
      if (stripped !== req && foundEmojis.has(stripped)) return true;
      // Try with variation selector
      if (!req.includes("\uFE0F") && foundEmojis.has(req + "\uFE0F")) return true;
      return false;
    });
    if (allPresent) {
      combinations.push({
        emojis: combo.required,
        description: combo.description,
        bonusWeight: combo.bonusWeight,
      });
    }
  }

  // Calculate total risk contribution
  const baseRisk = matches.reduce((sum, m) => sum + m.riskWeight, 0);
  const comboRisk = combinations.reduce((sum, c) => sum + c.bonusWeight, 0);
  const totalRiskContribution = Math.min(baseRisk + comboRisk, 25);

  const hasSubstanceEmoji = matches.some(m => m.signalType === "SUBSTANCE");
  const hasTransactionEmoji = matches.some(m => m.signalType === "TRANSACTION");

  return { matches, combinations, totalRiskContribution, hasSubstanceEmoji, hasTransactionEmoji };
}
