import { query } from "../db";
import { logInfo, logWarn, logError } from "../logger";
import { resolveEntityTable } from "./entity-resolver";
import { isLlmAvailable, llmCompleteJson, type LlmMessage } from "./llm-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DbRow = Record<string, unknown>;

export interface QueryResult {
  summary: string;
  data: DbRow[];
  table: { columns: string[]; rows: unknown[][] } | null;
  citations: { entityType: string; entityId: string; field: string }[];
  source: "llm" | "pattern";
}

interface QueryPattern {
  regex: RegExp;
  buildSql: (matches: RegExpMatchArray, userId: string) => { sql: string; params: unknown[] };
  entityType: string;
  summarize: (rows: DbRow[]) => string;
}

// ---------------------------------------------------------------------------
// Table helper — converts row objects to { columns, rows } for the frontend
// ---------------------------------------------------------------------------

function toTable(rows: DbRow[]): { columns: string[]; rows: unknown[][] } | null {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);
  return { columns, rows: rows.map(r => columns.map(c => r[c])) };
}

// ---------------------------------------------------------------------------
// LLM-powered SQL generation
// ---------------------------------------------------------------------------

const DOPAMS_SCHEMA_PROMPT = `You are a SQL assistant for the DOPAMS (Drug Offenders Profiling, Analysis, and Monitoring System) PostgreSQL database.

Given a natural language question, generate a read-only SELECT query.

=== CORE ENTITIES ===

subject_profile (subject_id UUID PK, full_name, aliases JSONB, date_of_birth, gender, identifiers JSONB, addresses JSONB, photo_url, risk_score NUMERIC, state_id, created_by, created_at, updated_at,
  bank_account_details JSONB, passport_details JSONB, visa_details JSONB, driving_license_details JSONB, vehicle_rc_details JSONB,
  district, police_station, crime_number, section_of_law TEXT[], known_languages JSONB, mobile_numbers JSONB, email_addresses JSONB,
  occupation, marital_status, father_name, mother_name, spouse_name, nationality, religion, caste, education,
  criminal_history JSONB, ndps_history JSONB, offender_status, threat_level, bail_status, monitoring_status,
  last_seen_at TIMESTAMP, last_seen_location, known_associates JSONB, speech_pattern, jail_name, custody_status,
  drug_types_dealt TEXT[], primary_drug, supply_chain_position, transport_routes JSONB, known_code_words JSONB,
  cctns_id, nidaan_id, social_handles JSONB)
  — aliases is JSONB. For text search use: aliases::text ILIKE '%term%'
  — bank_account_details is JSONB array: [{"bank": "Punjab National Bank", "account": "XXXXX6789", "type": "SAVINGS", "status": "FROZEN"}]
  — For bank/financial queries: PREFER querying bank_account_details JSONB directly from subject_profile (always populated) over joining subject_account_link → bank_account (may have gaps). Example: SELECT full_name, bank_account_details FROM subject_profile WHERE full_name % 'name'
  — For passport/visa/DL queries: query the JSONB columns directly from subject_profile
dopams_case (case_id UUID PK, case_number, title, description, case_type, priority, state_id, assigned_to, created_by, created_at, updated_at)
case_subject (case_id, subject_id, role, linked_at) — links subjects to cases
lead (lead_id UUID PK, source_type, summary, details, priority, state_id, subject_id, assigned_to, created_by, created_at, updated_at)
memo (memo_id UUID PK, lead_id, memo_number, subject, body, state_id, created_by, approved_by, created_at, updated_at)
alert (alert_id UUID PK, alert_type, severity, title, description, source_system, subject_id, case_id, state_id, assigned_to, acknowledged_by, created_at, updated_at)
task (task_id UUID PK, entity_type, entity_id, state_id, role_id, status, decision, remarks, assignee_user_id, sla_due_at, completed_at, created_at)
notification (notification_id UUID PK, user_id, type, title, message, entity_type, entity_id, is_read, created_at)

=== USERS & RBAC ===

user_account (user_id UUID PK, username, full_name, user_type, email, phone, is_active, created_at)
role (role_id UUID PK, role_key, display_name, description)
organization_unit (unit_id UUID PK, name, code, parent_unit_id)

=== NETWORK & RELATIONSHIPS ===

subject_subject_link (link_id UUID PK, subject_id_a UUID, subject_id_b UUID, relationship VARCHAR, strength NUMERIC 0-100, evidence_count INT, source_system, created_at)
  — relationship values: ASSOCIATE, FAMILY, GANG, CO_ACCUSED, SUPPLIER, BUYER, UNKNOWN
  — IMPORTANT: subject_id_a < subject_id_b (canonical ordering). To find all links for a subject, check BOTH columns: WHERE subject_id_a = $id OR subject_id_b = $id

subject_family_member (family_member_id UUID PK, subject_id UUID, relative_subject_id UUID NULL, relationship_type VARCHAR, full_name, contact_phone, age, gender, occupation, is_aware_of_activity BOOL, is_involved BOOL, is_dependent BOOL, notes)
  — relationship_type: SPOUSE, BROTHER, SISTER, FATHER, MOTHER, SON, DAUGHTER, UNCLE, AUNT, COUSIN, IN_LAW, OTHER

network_node (node_id UUID PK, node_type VARCHAR, entity_id UUID, label TEXT, properties JSONB, created_at)
  — node_type: SUBJECT, PHONE, BANK_ACCOUNT, DEVICE, VEHICLE, ADDRESS, SOCIAL_ACCOUNT, IDENTITY_DOC, ORGANIZATION

network_edge (edge_id UUID PK, from_node_id UUID, to_node_id UUID, edge_type VARCHAR, is_inferred BOOL, evidence_count INT, confidence NUMERIC 0-100, strength NUMERIC 0-100, first_seen_at, last_seen_at, created_at)
  — edge_type: HAS_PHONE, HAS_ACCOUNT, HAS_DEVICE, HAS_VEHICLE, HAS_ADDRESS, HAS_SOCIAL, HAS_IDENTITY, ASSOCIATE, FAMILY, GANG, CO_ACCUSED, SUPPLIER, BUYER, CALLED, TRANSACTED_WITH, CO_LOCATED, SHARED_DEVICE, SHARED_ACCOUNT

=== LINKED ENTITIES (subject → assets) ===

phone_number (phone_id UUID PK, raw_value, normalized_value, phone_type, carrier)
subject_phone_link (link_id, subject_id, phone_id, relationship, confidence, effective_from, effective_to)
bank_account (account_id UUID PK, account_number, ifsc_code, upi_id, bank_name)
subject_account_link (link_id, subject_id, account_id, relationship, confidence)
device (device_id UUID PK, imei, device_model, manufacturer)
subject_device_link (link_id, subject_id, device_id, relationship, confidence)
vehicle (vehicle_id UUID PK, registration_no, make, model, color, vehicle_type)
subject_vehicle_link (link_id, subject_id, vehicle_id, relationship, confidence)
address (address_id UUID PK, raw_address, district, state, pincode, latitude, longitude, address_type)
subject_address_link (link_id, subject_id, address_id, relationship, is_current)
social_account (social_id UUID PK, platform, handle, profile_url, risk_score)
subject_social_link (link_id, subject_id, social_id, relationship, confidence)
upi_account (upi_id UUID PK, vpa, linked_phone, provider_app, is_active, transaction_volume)
subject_upi_link (link_id, subject_id, upi_id, relationship, confidence)
crypto_wallet (wallet_id UUID PK, wallet_address, currency, wallet_type, exchange_name, is_active)
subject_crypto_link (link_id, subject_id, wallet_id, relationship, confidence)
hawala_contact (hawala_id UUID PK, subject_id, contact_name, contact_phone, contact_location, hawala_route, estimated_volume, is_active)

=== FINANCIAL & COMMUNICATION ===

financial_transaction (txn_id UUID PK, subject_id, case_id, txn_type, amount NUMERIC, currency, counterparty, bank_ref, occurred_at, is_suspicious BOOL, sender_account_id, receiver_account_id)
communication_event (event_id UUID PK, subject_id, case_id, comm_type, direction, counterparty, content_summary, occurred_at)
cdr_record (cdr_id UUID PK, subject_id, calling_number, called_number, call_type, call_start, call_end, duration_seconds, calling_tower_id, called_tower_id, imei)
tower_location (tower_id UUID PK, tower_code, latitude, longitude, address, operator)

=== LEGAL & CRIMINAL HISTORY ===

fir_record (fir_record_id UUID PK, subject_id, case_id, fir_number, fir_date, police_station, district, state, sections_of_law TEXT, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, verdict, sentence_details, bail_type, bail_date)
court_case (court_case_id UUID PK, subject_id, case_id, cnr_number, case_number, court_name, case_type, filing_date, next_hearing_date, legal_status, last_order_summary)
seizure_record (seizure_id UUID PK, subject_id, case_id, fir_record_id, seizure_date, seizure_location, drug_type, gross_weight_grams, net_weight_grams, purity_percentage, estimated_street_value, quantity_category, disposal_status)
warrant_record (warrant_id UUID PK, subject_id, fir_record_id, warrant_type, warrant_number, warrant_date, issuing_court, is_executed, status)
statute_library (statute_id UUID PK, act_name, section, description, keywords TEXT, penalty_summary, is_active)
legal_mapping (mapping_id UUID PK, entity_type, entity_id, statute_id, confidence, confirmed BOOL)
dossier (dossier_id UUID PK, dossier_ref, title, subject_id, case_id, state_id, assembled_at, exported_format)

=== EVIDENCE & DOCUMENTS ===

evidence_item (evidence_id UUID PK, case_id, lead_id, file_name, file_size, mime_type, hash_sha256, legal_hold BOOL, integrity_status, uploaded_by, created_at)
source_document (document_id UUID PK, document_type, source_system, file_url, file_name, metadata_jsonb, uploaded_by, created_at)
identity_document (document_pk UUID PK, document_type, document_value, normalized_value, is_verified)
  — document_type: AADHAAR, PAN, PASSPORT, DRIVING_LICENSE, VOTER_ID

=== PROPERTY & LOCATIONS ===

property_asset (property_id UUID PK, subject_id, property_type, description, location, estimated_value, ownership_type, is_attached BOOL, is_confiscated BOOL)
location_sighting (sighting_id UUID PK, subject_id, latitude, longitude, location_description, sighting_type, observed_at, confidence)

=== WATCHLISTS & MONITORING ===

watchlist (watchlist_id UUID PK, watchlist_name, description, criteria JSONB, alert_on_activity BOOL, owner_id, unit_id, is_active)
watchlist_subject (watchlist_id, subject_id, added_by, added_at, notes) — composite PK
escalation_request (escalation_id UUID PK, alert_id, requested_by, approved_by, status, reason, decision_reason, unit_id, created_at)

=== DRUG DETECTION & TRENDS ===

classification_result (classification_id UUID PK, entity_type, entity_id, category, risk_score, risk_factors JSONB, classified_by, analyst_override)
drug_role_classification (classification_id UUID PK, subject_entity_type, subject_entity_id, role_type, confidence, is_recidivist BOOL, prior_offenses INT, review_status)
slang_dictionary (slang_id UUID PK, term, canonical_form, category, language, term_type, risk_weight, is_active)
emoji_drug_code (emoji_code_id UUID PK, emoji, meaning, drug_category, risk_weight, signal_type, is_active)
trend_detection (trend_id UUID PK, term_type, term_value, category, detection_count, window_start, window_end, unit_id)
trend_spike_alert (spike_id UUID PK, term_type, term_value, baseline_count, spike_count, spike_ratio, time_window, unit_id, created_at)

=== DEDUPLICATION ===

dedup_candidate (candidate_id UUID PK, subject_id_a, subject_id_b, similarity_score, match_fields JSONB, state_id, reviewed_by)
merge_history (merge_id UUID PK, survivor_id, merged_id, field_decisions JSONB, merged_by, merged_at)

=== COMMON JOIN PATTERNS ===

-- Find all people in a subject's network:
-- JOIN subject_subject_link ON (sp.subject_id = ssl.subject_id_a OR sp.subject_id = ssl.subject_id_b)
-- Then join the OTHER side back to subject_profile

-- Find subject by name: WHERE full_name ILIKE '%name%'
-- Find subject's phones: subject_profile → subject_phone_link → phone_number
-- Find subject's cases: subject_profile → case_subject → dopams_case
-- Find subject's FIRs: fir_record WHERE subject_id = ...
-- Find subject's family: subject_family_member WHERE subject_id = ...
-- Graph queries: network_node → network_edge → network_node

=== RULES ===

- Only generate SELECT statements (WITH ... SELECT CTEs are allowed)
- Always include a LIMIT clause (max 50)
- Never use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE, GRANT, or REVOKE
- For date comparisons, use PostgreSQL date functions (NOW(), INTERVAL, etc.)
- Return useful columns that answer the question — not SELECT *
- For network/relationship queries, PREFER the graph layer (network_node + network_edge) as it is the canonical, up-to-date source. Join: network_node nn1 → network_edge → network_node nn2, filtering nn1 by label and nn1.node_type = 'SUBJECT'
- subject_subject_link may be empty; only use it as a fallback if explicitly asked about "direct links"
- When joining subject_subject_link, always check BOTH subject_id_a and subject_id_b due to canonical ordering constraint

=== NAME MATCHING (CRITICAL) ===

The pg_trgm extension is enabled. Indian names have many transliteration variants (Kamaljit/Kamaljeet, Sukhwinder/Sukhvinder, Harpreet/Harprith, etc.).

ALWAYS use trigram fuzzy matching for person name lookups instead of ILIKE:
  WHERE full_name % 'search term' ORDER BY similarity(full_name, 'search term') DESC LIMIT 1
Or for network_node labels:
  WHERE nn.label % 'search term' AND nn.node_type = 'SUBJECT' ORDER BY similarity(nn.label, 'search term') DESC LIMIT 1

The % operator uses pg_trgm with a default threshold of 0.3. This handles spelling variants, transliteration differences, and partial name matches.

IMPORTANT: When a query is about a SPECIFIC person (e.g. "bank details of Raj Kumar Singh"), match ONLY the BEST (highest similarity) subject — use LIMIT 1 in the name-matching CTE. Do NOT return data for multiple similar-named subjects. The user asked about ONE person.

Only use ILIKE for non-name searches (titles, descriptions, keywords).

Respond with JSON: { "sql": "SELECT ...", "summary": "One-sentence direct answer", "entityType": "the primary table name" }

=== SUMMARY RULES (CRITICAL) ===

The "summary" MUST be a direct, concise answer to the user's question — NOT an explanation of the SQL methodology.

GOOD summaries:
- "Kamaljeet Kaur has 1 known associate in the network."
- "Found 5 high-risk subjects in Amritsar district."
- "Mohammed Irfan has 3 active FIRs."
- "No network connections found for this subject."

BAD summaries (NEVER do this):
- "Finds the best-matching SUBJECT node using trigram similarity, then lists connected SUBJECT nodes via relationship edges..."
- "Queries the network_node table joined with network_edge to find associations..."
- "Uses fuzzy matching on full_name to locate the subject, then joins..."

The user does not care HOW the query works. They want the ANSWER.`;

const FORBIDDEN_SQL = /\b(DELETE|UPDATE|INSERT|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|EXEC)\b/i;

function validateSql(sql: string): string | null {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return "SQL must start with SELECT or WITH";
  }

  if (FORBIDDEN_SQL.test(trimmed)) {
    return "SQL contains forbidden DML/DDL keywords";
  }

  // Ensure LIMIT clause exists — append if missing
  if (!/\bLIMIT\b/i.test(trimmed)) {
    return null; // We'll append LIMIT below
  }

  return null;
}

function ensureLimit(sql: string): string {
  if (/\bLIMIT\b/i.test(sql)) return sql;
  return `${sql.replace(/;\s*$/, "")} LIMIT 50`;
}

async function tryLlmQuery(
  questionText: string,
  userId: string,
): Promise<QueryResult | null> {
  const available = await isLlmAvailable();
  if (!available) return null;

  const messages: LlmMessage[] = [
    { role: "system", content: DOPAMS_SCHEMA_PROMPT },
    { role: "user", content: questionText },
  ];

  const llmResult = await llmCompleteJson<{ sql: string; summary: string; entityType: string }>(
    {
      messages,
      useCase: "NL_QUERY",
      temperature: 0,
      maxTokens: 512,
    },
    [
      { field: "sql", type: "string" },
      { field: "summary", type: "string" },
      { field: "entityType", type: "string" },
    ],
  );

  if (!llmResult) {
    logWarn("NL query LLM returned null", { question: questionText });
    return null;
  }

  const { sql, summary, entityType } = llmResult.data;

  // Validate SQL safety
  const validationError = validateSql(sql);
  if (validationError) {
    logWarn("NL query LLM SQL rejected", { sql, reason: validationError });
    return null;
  }

  const safeSql = ensureLimit(sql);

  try {
    const startTime = Date.now();
    const result = await query(safeSql);
    const executionTime = Date.now() - startTime;

    const citations = result.rows.map((row: DbRow) => ({
      entityType: (row.entity_type as string) || entityType,
      entityId: String(
        row.entity_id || row.alert_id || row.case_id || row.lead_id ||
        row.subject_id || row.memo_id || row.task_id || row.txn_id ||
        row.event_id || row.user_id || "",
      ),
      field: String(row.title || row.full_name || row.summary || row.subject || row.username || ""),
    }));

    // Log the query
    await query(
      `INSERT INTO nl_query_log (user_id, query_text, generated_sql, result_summary, citations, status, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6)`,
      [userId, questionText, safeSql, summary, JSON.stringify(citations), executionTime],
    ).catch(() => {});

    logInfo("NL query LLM success", {
      question: questionText,
      rowCount: result.rows.length,
      executionTimeMs: executionTime,
    });

    // Strip methodology-style summaries — the user wants a direct answer, not SQL explanation
    const methodologyPattern = /\b(using trigram|trigram similarity|fuzzy match|joins?\b.*\btable|queries the|SELECT|FROM\s+\w|WHERE|node_type|edge_type|relationship edges|ranked by|Lists up to \d+|CTE|subquery)\b/i;
    const cleanSummary = methodologyPattern.test(summary)
      ? (result.rows.length > 0
          ? `Found ${result.rows.length} result${result.rows.length === 1 ? "" : "s"}.`
          : "No results found for your query.")
      : summary;

    return {
      summary: cleanSummary,
      data: result.rows,
      table: toTable(result.rows),
      citations,
      source: "llm",
    };
  } catch (err) {
    logError("NL query LLM SQL execution failed", {
      sql: safeSql,
      error: err instanceof Error ? err.message : String(err),
    });
    return null; // Fall through to regex patterns
  }
}

// ---------------------------------------------------------------------------
// Smart intent detectors — extract person names from natural phrasings
// ---------------------------------------------------------------------------

function detectNetworkQuery(text: string): string | null {
  const lower = text.toLowerCase();
  if (!/\b(network|associates?|connections?|connected|linked|circle)\b/.test(lower)) return null;

  let m: RegExpMatchArray | null;

  // "people <name> has in her/his network"
  m = text.match(/(?:people|persons?)\s+(.+?)\s+(?:has|have)\s+in\s+(?:her|his|their)\s+(?:network|circle)/i);
  if (m) return m[1].trim();

  // "people in <name>'s network" or "people in <name> network"
  m = text.match(/(?:people|persons?|members?)\s+in\s+(.+?)(?:'s|'s)\s*(?:network|circle)/i);
  if (m) return m[1].trim();
  m = text.match(/(?:people|persons?|members?)\s+in\s+(.+?)\s+(?:network|circle)/i);
  if (m) return m[1].trim();

  // "<name>'s network/associates/connections" (strip command prefixes)
  m = text.match(/([A-Za-z][\w ]*?)\s*(?:'s|'s)\s*(?:network|associates?|connections?|circle)/i);
  if (m) {
    return m[1].replace(/^(?:show|list|find|get|display|what\s+(?:is|are)|who\s+(?:is|are))\s+(?:me\s+)?(?:the\s+)?/i, "").trim();
  }

  // "network/associates/connections of <name>"
  m = text.match(/(?:network|associates?|connections?)\s+(?:of|for)\s+(.+?)(?:[?.]|$)/i);
  if (m) return m[1].trim();

  // "connected/linked to <name>"
  m = text.match(/(?:connected|linked|associated)\s+(?:to|with)\s+(.+?)(?:[?.]|$)/i);
  if (m) return m[1].trim();

  return null;
}

function detectFamilyQuery(text: string): string | null {
  const lower = text.toLowerCase();
  if (!/\b(family|relatives?|kin|household|spouse|brother|sister|father|mother|son|daughter)\b/.test(lower)) return null;

  let m: RegExpMatchArray | null;

  // "family of <name>", "relatives of <name>"
  m = text.match(/(?:family|relatives?|kin|household)\s+(?:of|for|members?\s+of)\s+(.+?)(?:[?.]|$)/i);
  if (m) return m[1].replace(/[''`]/g, "").trim();

  // "<name>'s family"
  m = text.match(/([A-Za-z][\w ]*?)\s*(?:'s|'s)\s*(?:family|relatives?|household)/i);
  if (m) {
    return m[1].replace(/^(?:show|list|find|get|who\s+(?:is|are))\s+(?:me\s+)?(?:the\s+)?/i, "").trim();
  }

  return null;
}

// ---------------------------------------------------------------------------
// DOPAMS-specific regex query patterns (fallback)
// ---------------------------------------------------------------------------

const PATTERNS: QueryPattern[] = [
  // ── Count queries ──────────────────────────────────────────────────────
  {
    regex: /how many (alerts?|cases?|leads?|subjects?|profiles?)/i,
    buildSql: (matches) => {
      const { table } = resolveEntityTable(matches[1].toLowerCase());
      return { sql: `SELECT COUNT(*) AS count FROM ${table}`, params: [] };
    },
    entityType: "count",
    summarize: (rows) => `Total count: ${rows[0]?.count || 0}`,
  },

  // ── Subject search / who is X ──────────────────────────────────────────
  {
    regex: /(?:who\s+is|find\s+subject|search\s+(?:for\s+)?(?:subject|person)?|show\s+(?:me\s+)?(?:subject|profile)(?:\s+(?:of|for))?)\s+(.+?)(?:\?|$)/i,
    buildSql: (matches) => {
      const name = matches[1].replace(/[''`]/g, "").trim();
      return {
        sql: `SELECT subject_id, full_name AS title, aliases, gender, risk_score, state_id, created_at
              FROM subject_profile
              WHERE full_name % $1 OR aliases::text ILIKE '%' || $1 || '%'
              ORDER BY similarity(full_name, $1) DESC, risk_score DESC NULLS LAST
              LIMIT 20`,
        params: [name],
      };
    },
    entityType: "subject_profile",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} matching subject profiles`
        : "No subjects found matching that name",
  },

  // ── Cases for a person ─────────────────────────────────────────────────
  {
    regex: /(?:cases?|investigations?)\s+(?:of|for|involving|against|linked\s+to|related\s+to)\s+(.+?)(?:\?|$)/i,
    buildSql: (matches) => {
      const name = matches[1].replace(/[''`]/g, "").trim();
      return {
        sql: `SELECT dc.case_id, dc.case_number, dc.title, dc.case_type, dc.priority, dc.state_id, cs.role, dc.created_at
              FROM subject_profile sp
              JOIN case_subject cs ON sp.subject_id = cs.subject_id
              JOIN dopams_case dc ON cs.case_id = dc.case_id
              WHERE sp.full_name % $1
              ORDER BY similarity(sp.full_name, $1) DESC, dc.created_at DESC
              LIMIT 20`,
        params: [name],
      };
    },
    entityType: "dopams_case",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} cases`
        : "No cases found for this person",
  },

  // ── FIR / criminal history for a person ────────────────────────────────
  {
    regex: /(?:fir|criminal\s+history|criminal\s+record|arrest|charge\s*sheet)\s+(?:of|for|against|history\s+of)\s+(.+?)(?:\?|$)/i,
    buildSql: (matches) => {
      const name = matches[1].replace(/[''`]/g, "").trim();
      return {
        sql: `SELECT fr.fir_record_id, fr.fir_number, fr.fir_date, fr.police_station, fr.district,
                     fr.sections_of_law, fr.role_in_case, fr.case_stage, fr.verdict
              FROM subject_profile sp
              JOIN fir_record fr ON sp.subject_id = fr.subject_id
              WHERE sp.full_name % $1
              ORDER BY similarity(sp.full_name, $1) DESC, fr.fir_date DESC NULLS LAST
              LIMIT 20`,
        params: [name],
      };
    },
    entityType: "fir_record",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} FIR records`
        : "No FIR records found for this person",
  },

  // ── Financial transactions for a person ────────────────────────────────
  {
    regex: /(?:transactions?|financial|payments?|money)\s+(?:of|for|by|involving)\s+(.+?)(?:\?|$)/i,
    buildSql: (matches) => {
      const name = matches[1].replace(/[''`]/g, "").trim();
      return {
        sql: `SELECT ft.txn_id, ft.txn_type, ft.amount, ft.currency, ft.counterparty, ft.bank_ref,
                     ft.occurred_at, ft.is_suspicious
              FROM subject_profile sp
              JOIN financial_transaction ft ON sp.subject_id = ft.subject_id
              WHERE sp.full_name % $1
              ORDER BY similarity(sp.full_name, $1) DESC, ft.occurred_at DESC NULLS LAST
              LIMIT 30`,
        params: [name],
      };
    },
    entityType: "financial_transaction",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} financial transactions`
        : "No financial transactions found for this person",
  },

  // ── Open / pending / active items ──────────────────────────────────────
  {
    regex: /(?:show|list|find)\s+(?:all\s+)?(?:open|pending|active)\s+(alerts?|cases?|leads?)/i,
    buildSql: (matches) => {
      const NL_TITLE_COL: Record<string, string> = { alert: "title", dopams_case: "title", lead: "summary" };
      const { table, idCol } = resolveEntityTable(matches[1].toLowerCase());
      const titleCol = NL_TITLE_COL[table] || "title";
      const priorityCol = table === "alert" ? "severity" : "priority";
      return {
        sql: `SELECT ${idCol}, ${titleCol} AS title, state_id, ${priorityCol} AS priority, created_at FROM ${table} WHERE state_id NOT IN ('CLOSED', 'RESOLVED', 'ARCHIVED') ORDER BY created_at DESC LIMIT 20`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Found ${rows.length} open items`,
  },

  // ── High / critical severity alerts ────────────────────────────────────
  {
    regex: /(?:alerts?)\s+(?:with|having)\s+(?:high|critical)\s+(?:severity|priority)/i,
    buildSql: () => ({
      sql: `SELECT alert_id, title, state_id, severity, created_at FROM alert WHERE severity IN ('HIGH', 'CRITICAL') ORDER BY created_at DESC LIMIT 20`,
      params: [],
    }),
    entityType: "alert",
    summarize: (rows) => `Found ${rows.length} high/critical severity alerts`,
  },

  // ── High-risk subjects ─────────────────────────────────────────────────
  {
    regex: /(?:high[- ]?risk|risky)\s+(subjects?|profiles?)/i,
    buildSql: () => ({
      sql: `SELECT subject_id, full_name AS title, state_id, risk_score, created_at FROM subject_profile WHERE risk_score >= 70 ORDER BY risk_score DESC LIMIT 20`,
      params: [],
    }),
    entityType: "subject_profile",
    summarize: (rows) => `Found ${rows.length} high-risk subject profiles`,
  },

  // ── Recent / latest ────────────────────────────────────────────────────
  {
    regex: /(?:recent|latest|new)\s+(alerts?|cases?|leads?|subjects?|profiles?|memos?)/i,
    buildSql: (matches) => {
      const NL_TITLE_COL: Record<string, string> = {
        alert: "title", dopams_case: "title", lead: "summary",
        subject_profile: "full_name", memo: "subject",
      };
      const { table, idCol } = resolveEntityTable(matches[1].toLowerCase());
      const titleCol = NL_TITLE_COL[table] || "title";
      return {
        sql: `SELECT ${idCol}, ${titleCol} AS title, state_id, created_at FROM ${table} ORDER BY created_at DESC LIMIT 10`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Showing ${rows.length} most recent items`,
  },

  // ── Fallback: cross-table search (subjects, alerts, cases, leads) ─────
  {
    regex: /.+/,
    buildSql: (matches) => {
      const term = matches[0].trim();
      return {
        sql: `SELECT subject_id AS entity_id, 'subject_profile' AS entity_type, full_name AS title, 'Risk: ' || COALESCE(risk_score::text, 'N/A') AS snippet FROM subject_profile WHERE full_name % $1 OR aliases::text ILIKE '%' || $1 || '%' ORDER BY similarity(full_name, $1) DESC LIMIT 10`,
        params: [term],
      };
    },
    entityType: "search",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} matching results`
        : "No results found for your query",
  },
];

// ---------------------------------------------------------------------------
// Build result from query execution
// ---------------------------------------------------------------------------

function buildCitations(rows: DbRow[], entityType: string) {
  return rows.map((row: DbRow) => ({
    entityType: (row.entity_type as string) || entityType,
    entityId: String(
      row.entity_id || row.alert_id || row.case_id || row.lead_id ||
      row.subject_id || row.memo_id || row.task_id || row.txn_id || "",
    ),
    field: String(row.title || row.full_name || row.snippet || row.summary || ""),
  }));
}

async function logQuery(
  userId: string, queryText: string, sql: string, summary: string,
  citations: unknown[], executionTime: number, status: string, errorMessage?: string,
) {
  try {
    if (status === "COMPLETED") {
      await query(
        `INSERT INTO nl_query_log (user_id, query_text, generated_sql, result_summary, citations, status, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, queryText, sql, summary, JSON.stringify(citations), status, executionTime],
      );
    } else {
      await query(
        `INSERT INTO nl_query_log (user_id, query_text, generated_sql, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, queryText, sql, status, errorMessage],
      );
    }
  } catch {
    // nl_query_log insert failure must never crash the query
  }
}

// ---------------------------------------------------------------------------
// Execute NL query — LLM first, network detector, then regex fallback
// ---------------------------------------------------------------------------

export async function executeNlQuery(
  queryText: string,
  userId: string,
  _unitId: string | null,
): Promise<QueryResult> {
  const startTime = Date.now();

  // ── 1. Try LLM-powered path first ──────────────────────────────────────
  try {
    const llmResult = await tryLlmQuery(queryText, userId);
    if (llmResult) return llmResult;
  } catch (err) {
    logWarn("NL query LLM path failed, falling back to patterns", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 2. Smart intent detectors (network, family) ────────────────────────

  const networkName = detectNetworkQuery(queryText);
  if (networkName) {
    // Try graph layer first (network_node + network_edge), then subject_subject_link
    const graphSql = `SELECT nn2.label AS title, nn2.node_type, ne.edge_type AS relationship, ne.strength, ne.confidence, ne.is_inferred
                      FROM network_node nn1
                      JOIN network_edge ne ON (nn1.node_id = ne.from_node_id OR nn1.node_id = ne.to_node_id)
                      JOIN network_node nn2 ON nn2.node_id = CASE
                        WHEN nn1.node_id = ne.from_node_id THEN ne.to_node_id
                        ELSE ne.from_node_id END
                      WHERE nn1.label % $1 AND nn1.node_type = 'SUBJECT'
                      ORDER BY similarity(nn1.label, $1) DESC, ne.strength DESC NULLS LAST
                      LIMIT 30`;
    const linkSql = `SELECT sp2.subject_id, sp2.full_name AS title, ssl.relationship, ssl.strength, ssl.evidence_count
                     FROM subject_profile sp1
                     JOIN subject_subject_link ssl ON (sp1.subject_id = ssl.subject_id_a OR sp1.subject_id = ssl.subject_id_b)
                     JOIN subject_profile sp2 ON sp2.subject_id = CASE
                       WHEN sp1.subject_id = ssl.subject_id_a THEN ssl.subject_id_b
                       ELSE ssl.subject_id_a END
                     WHERE sp1.full_name % $1
                     ORDER BY similarity(sp1.full_name, $1) DESC, ssl.strength DESC NULLS LAST
                     LIMIT 30`;

    for (const sql of [graphSql, linkSql]) {
      try {
        const result = await query(sql, [networkName]);
        if (result.rows.length > 0) {
          const executionTime = Date.now() - startTime;
          const citations = buildCitations(result.rows, "subject_profile");
          const summary = `Found ${result.rows.length} connections in ${networkName}'s network`;
          await logQuery(userId, queryText, sql, summary, citations, executionTime, "COMPLETED");
          return { summary, data: result.rows, table: toTable(result.rows), citations, source: "pattern" };
        }
      } catch (err) {
        logWarn("Network pattern SQL failed, trying next", { error: err instanceof Error ? err.message : String(err) });
      }
    }
    // Both returned 0 rows — report that
    const summary = `No network connections found for ${networkName}`;
    await logQuery(userId, queryText, graphSql, summary, [], Date.now() - startTime, "COMPLETED");
    return { summary, data: [], table: null, citations: [], source: "pattern" };
  }

  const familyName = detectFamilyQuery(queryText);
  if (familyName) {
    const sql = `SELECT sfm.family_member_id, sfm.full_name AS title, sfm.relationship_type, sfm.age, sfm.gender, sfm.occupation,
                        sfm.is_involved, sfm.is_dependent
                 FROM subject_profile sp
                 JOIN subject_family_member sfm ON sp.subject_id = sfm.subject_id
                 WHERE sp.full_name % $1
                 ORDER BY similarity(sp.full_name, $1) DESC, sfm.relationship_type
                 LIMIT 30`;
    try {
      const result = await query(sql, [familyName]);
      const executionTime = Date.now() - startTime;
      const citations = buildCitations(result.rows, "subject_family_member");
      const summary = result.rows.length > 0
        ? `Found ${result.rows.length} family members of ${familyName}`
        : `No family members found for ${familyName}`;
      await logQuery(userId, queryText, sql, summary, citations, executionTime, "COMPLETED");
      return { summary, data: result.rows, table: toTable(result.rows), citations, source: "pattern" };
    } catch (err) {
      logWarn("Family pattern SQL failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── 3. Regex patterns ──────────────────────────────────────────────────

  for (const pattern of PATTERNS) {
    const matches = queryText.match(pattern.regex);
    if (!matches) continue;

    const { sql, params } = pattern.buildSql(matches, userId);

    try {
      const result = await query(sql, params);
      const executionTime = Date.now() - startTime;
      const citations = buildCitations(result.rows, pattern.entityType);
      const summary = pattern.summarize(result.rows);
      await logQuery(userId, queryText, sql, summary, citations, executionTime, "COMPLETED");

      return { summary, data: result.rows, table: toTable(result.rows), citations, source: "pattern" };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logQuery(userId, queryText, sql, "", [], 0, "FAILED", errMsg);
      logWarn("NL pattern SQL failed, trying next pattern", { sql, error: errMsg });
      // Continue to next pattern instead of throwing
      continue;
    }
  }

  return { summary: "Could not understand the query", data: [], table: null, citations: [], source: "pattern" };
}

// ---------------------------------------------------------------------------
// Query history
// ---------------------------------------------------------------------------

export async function getQueryHistory(userId: string, limit = 20): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM nl_query_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}
