/**
 * Transaction signal detection for narcotics pipeline.
 * Pure synchronous module — no DB or I/O dependencies.
 *
 * Detects when drug terms co-occur with transaction indicators:
 * purchase signals, sale signals, quantity terms, price patterns, contact patterns.
 * Only scores if a drug term is also present (prevents false positives on normal commerce).
 */

export interface TransactionSignal {
  signalType: "PURCHASE" | "SALE" | "QUANTITY" | "PRICE" | "CONTACT";
  matched: string;
  description: string;
}

export interface TransactionAnalysisResult {
  /** Individual signals detected */
  signals: TransactionSignal[];
  /** Detected activity type (most severe) */
  activityType: "DISTRIBUTION" | "ACTIVE_SALE" | "PURCHASE" | "USE" | "NONE";
  /** Activity multiplier for scoring */
  activityMultiplier: number;
  /** Whether quantity terms were found */
  hasQuantity: boolean;
  /** Whether price patterns were found */
  hasPrice: boolean;
  /** Whether contact/platform info was found */
  hasContact: boolean;
}

/** Purchase signal patterns (case-insensitive) */
const PURCHASE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(?:dm\s+me|DM\s+me)\b/i, description: "DM request" },
  { pattern: /\b(?:hmu|hit\s+me\s+up)\b/i, description: "Hit me up" },
  { pattern: /\b(?:looking\s+for|need\s+some|who\s+got|who\s+has)\b/i, description: "Seeking drugs" },
  { pattern: /\b(?:can\s+anyone|anyone\s+got|anybody\s+got)\b/i, description: "Solicitation" },
  { pattern: /\b(?:where\s+(?:can\s+i|to)\s+(?:get|find|buy|cop))\b/i, description: "Purchase inquiry" },
  { pattern: /\b(?:plug\s+me|hook\s+me\s+up)\b/i, description: "Connection request" },
  // Telugu purchase signals
  { pattern: /(?:కావాలి|kavali)/i, description: "Telugu: I need/want" },
  { pattern: /(?:ఎక్కడ\s*దొరుకుతుంది|ekkada\s*dorukutundi)/i, description: "Telugu: Where to find" },
  { pattern: /(?:ఎవరి\s*దగ్గర\s*ఉంది|evari\s*daggara\s*undi)/i, description: "Telugu: Who has it" },
];

/** Sale signal patterns (case-insensitive) */
const SALE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(?:serving|on\s+deck|in\s+stock)\b/i, description: "Available for sale" },
  { pattern: /\b(?:just\s+landed|just\s+(?:re-?)?(?:up|upped))\b/i, description: "New supply arrived" },
  { pattern: /\b(?:tap\s+in|slide\s+(?:in|through))\b/i, description: "Contact for purchase" },
  { pattern: /\b(?:menu|price\s*list)\b/i, description: "Product listing" },
  { pattern: /\b(?:delivery|drop\s*off|ship(?:ping)?)\b/i, description: "Delivery offered" },
  { pattern: /\b(?:best\s+(?:quality|prices?)|fire\s+(?:quality|pack))\b/i, description: "Quality claim" },
  { pattern: /\b(?:bulk\s+(?:deals?|orders?|discount))\b/i, description: "Bulk sale" },
  { pattern: /\b(?:no\s+(?:cap|boof)|str8|straight)\b/i, description: "Quality assurance" },
  // Telugu sale signals
  { pattern: /(?:సరుకు\s*వచ్చింది|saruku\s*vachchindi)/i, description: "Telugu: Supply arrived" },
  { pattern: /(?:మాల్\s*రెడీ|maal\s*ready)/i, description: "Telugu: Drugs ready" },
  { pattern: /(?:రెడీ\s*ఉంది|ready\s*undi)/i, description: "Telugu: Ready/available" },
];

/** Quantity term patterns */
const QUANTITY_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(?:zip|zipper|z(?:ip)?s?)\b/i, description: "Zip (ounce)" },
  { pattern: /\bQP\b/i, description: "Quarter pound" },
  { pattern: /\b(?:eight\s*ball|8\s*ball|eightball)\b/i, description: "Eight ball (3.5g)" },
  { pattern: /\b(?:ball|half\s*ball)\b/i, description: "Ball (3.5g)" },
  { pattern: /\b(?:brick|ki(?:lo)?)\b/i, description: "Large quantity (kilo)" },
  { pattern: /\b(?:gram|grams?|g(?:ram)?s?)\b/i, description: "Gram quantity" },
  { pattern: /\b(?:ounce|oz|ounces)\b/i, description: "Ounce" },
  { pattern: /\b(?:dime\s*bag|dub\s*(?:sack)?|nick(?:el)?(?:\s*bag)?)\b/i, description: "Small purchase quantity" },
  { pattern: /\b(?:quarter|half|whole)\b/i, description: "Fractional quantity" },
  { pattern: /\b(?:pound|lb|lbs|elbow)\b/i, description: "Pound quantity" },
];

/** Price patterns */
const PRICE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\$\s*\d+/i, description: "Dollar amount" },
  { pattern: /\b\d+\s*(?:per|\/)\s*(?:g(?:ram)?|oz|zip|qp|lb)\b/i, description: "Price per unit" },
  { pattern: /\b(?:price|cost|rate|going\s+for)\s*[:=]?\s*\d+/i, description: "Price listing" },
  { pattern: /\b\d+\s*(?:a\s+)?(?:pop|each|apiece)\b/i, description: "Per-unit price" },
  { pattern: /₹\s*\d+/i, description: "Rupee amount" },
  // Telugu price signals
  { pattern: /(?:ధర|dhara|ఎంత|entha)\s*[:=]?\s*\d+/i, description: "Telugu: Price/how much" },
  { pattern: /\b\d+\s*(?:రూపాయలు|rupaayalu)\b/i, description: "Telugu: X rupees" },
];

/** Contact/platform patterns */
const CONTACT_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(?:wickr|telegram|signal|tox)\s*[:@]?\s*\S+/i, description: "Encrypted messaging handle" },
  { pattern: /\b(?:dm\s+(?:for|4)\s+(?:menu|prices?|list|details?))\b/i, description: "DM for menu" },
  { pattern: /\b(?:snap(?:chat)?|ig|insta(?:gram)?)\s*[:@]?\s*\S+/i, description: "Social media handle" },
  { pattern: /\b(?:holla|txt|text|call|ring)\s+(?:me|at)\b/i, description: "Contact request" },
  { pattern: /\b(?:whatsapp|wa)\s*[:@]?\s*\S+/i, description: "WhatsApp handle" },
];

function matchPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; description: string }>,
  signalType: TransactionSignal["signalType"],
): TransactionSignal[] {
  const signals: TransactionSignal[] = [];
  for (const { pattern, description } of patterns) {
    const match = text.match(pattern);
    if (match) {
      signals.push({ signalType, matched: match[0], description });
    }
  }
  return signals;
}

/**
 * Detect transaction signals in text.
 * Only scores meaningfully if hasDrugTerm is true (prevents false positives on normal commerce).
 */
export function detectTransactionSignals(
  text: string,
  hasDrugTerm: boolean,
): TransactionAnalysisResult {
  const emptyResult: TransactionAnalysisResult = {
    signals: [],
    activityType: "NONE",
    activityMultiplier: 1.0,
    hasQuantity: false,
    hasPrice: false,
    hasContact: false,
  };

  if (!text) return emptyResult;

  // Always detect signals (useful for reporting), but only assign activity type if drug term present
  const purchaseSignals = matchPatterns(text, PURCHASE_PATTERNS, "PURCHASE");
  const saleSignals = matchPatterns(text, SALE_PATTERNS, "SALE");
  const quantitySignals = matchPatterns(text, QUANTITY_PATTERNS, "QUANTITY");
  const priceSignals = matchPatterns(text, PRICE_PATTERNS, "PRICE");
  const contactSignals = matchPatterns(text, CONTACT_PATTERNS, "CONTACT");

  const allSignals = [
    ...purchaseSignals,
    ...saleSignals,
    ...quantitySignals,
    ...priceSignals,
    ...contactSignals,
  ];

  if (!hasDrugTerm || allSignals.length === 0) {
    return { ...emptyResult, signals: hasDrugTerm ? allSignals : [] };
  }

  const hasQuantity = quantitySignals.length > 0;
  const hasPrice = priceSignals.length > 0;
  const hasContact = contactSignals.length > 0;

  // Determine activity type (most severe)
  let activityType: TransactionAnalysisResult["activityType"] = "USE";
  let activityMultiplier = 1.0;

  if (saleSignals.length > 0 && (hasQuantity || hasPrice || hasContact)) {
    // Distribution: sale + quantity/price/contact = large-scale
    activityType = "DISTRIBUTION";
    activityMultiplier = 3.0;
  } else if (saleSignals.length > 0) {
    activityType = "ACTIVE_SALE";
    activityMultiplier = 2.5;
  } else if (purchaseSignals.length > 0) {
    activityType = "PURCHASE";
    activityMultiplier = 1.5;
  }

  return {
    signals: allSignals,
    activityType,
    activityMultiplier,
    hasQuantity,
    hasPrice,
    hasContact,
  };
}
