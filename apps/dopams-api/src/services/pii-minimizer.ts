import { query } from "../db";
import { logInfo } from "../logger";

// Regex patterns for Indian PII
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PHONE_REGEX = /(?:\+91[-\s]?)?[6-9]\d{9}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

const REDACTION_MARKER = "[REDACTED]";

interface RedactionResult {
  text: string;
  redactions: Array<{ field: string; type: string }>;
}

/** Auto-redact non-target PII from content text */
export function autoRedactNonTargetPii(text: string): RedactionResult {
  const redactions: Array<{ field: string; type: string }> = [];

  let result = text;

  const replaced = result.replace(AADHAAR_REGEX, REDACTION_MARKER);
  if (replaced !== result) {
    result = replaced;
    redactions.push({ field: "content_text", type: "AADHAAR" });
  }

  const replaced2 = result.replace(PHONE_REGEX, REDACTION_MARKER);
  if (replaced2 !== result) {
    result = replaced2;
    redactions.push({ field: "content_text", type: "PHONE" });
  }

  const replaced3 = result.replace(EMAIL_REGEX, REDACTION_MARKER);
  if (replaced3 !== result) {
    result = replaced3;
    redactions.push({ field: "content_text", type: "EMAIL" });
  }

  const replaced4 = result.replace(PAN_REGEX, REDACTION_MARKER);
  if (replaced4 !== result) {
    result = replaced4;
    redactions.push({ field: "content_text", type: "PAN" });
  }

  return { text: result, redactions };
}

/** Log PII redaction actions for audit */
export async function logRedactions(
  contentId: string,
  redactions: Array<{ field: string; type: string }>,
): Promise<void> {
  for (const r of redactions) {
    await query(
      `INSERT INTO pii_redaction_log (content_id, field_name, redaction_type) VALUES ($1, $2, 'PARTIAL')`,
      [contentId, `${r.field}:${r.type}`],
    );
  }
  if (redactions.length > 0) {
    logInfo("PII_REDACTED", { contentId, types: redactions.map((r) => r.type) });
  }
}

/** Check if content requires legal authorization for access */
export function checkAuthorizationRequired(sourceType: string): boolean {
  return sourceType === "PRIVATE" || sourceType === "SEMI_PRIVATE";
}
