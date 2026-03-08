# Code Quality & Functional Completeness Review

**Date:** 2026-03-08
**Scope:** apps/dopams-api, apps/forensic-api, apps/social-media-api, packages/api-core, packages/api-integrations
**Focus:** BRD gap closure changes (recent commits)

---

## 1. API Contracts

### [CRITICAL] LDAP Auth Route Uses Wrong User Table Name
- **Location**: `packages/api-core/src/routes/auth-routes.ts:32`
- **Issue**: The LDAP login handler queries `app_user` table (`SELECT user_id, user_type, unit_id FROM app_user WHERE user_id = $1 AND is_active = true`) but the rest of the codebase (local-auth.ts, admin-routes.ts, auth-middleware.ts, oidc-auth.ts) consistently uses `user_account`. This will cause a runtime `relation "app_user" does not exist` error when LDAP login is attempted.
- **Fix**: Change `app_user` to `user_account` on line 32 of auth-routes.ts.

### [CRITICAL] LDAP Auth Route Uses Wrong Role Column Name
- **Location**: `packages/api-core/src/routes/auth-routes.ts:40-43`
- **Issue**: The LDAP login path queries `r.role_name` but local-auth.ts (line 23) uses `r.role_key` for the same join. Since `role_key` is the actual column based on the admin-routes.ts listing query (line 39), using `role_name` will either fail at runtime or return wrong data if both columns exist.
- **Fix**: Change `r.role_name` to `r.role_key` on line 40, and update the map on line 43 from `r.role_name` to `r.role_key`.

### [CRITICAL] LDAP Auth Uses Wrong Table in Credential Lookup
- **Location**: `packages/api-core/src/auth/ldap-auth.ts:55`
- **Issue**: The LDAP stub queries `app_user` with column `username` and field `auth_source`, but the canonical user table is `user_account` and it may not have an `auth_source` column. The LDAP stub will fail at runtime in any deployment that uses the standard schema.
- **Fix**: Align table name to `user_account` and verify `auth_source` column exists in migrations, or add it.

### [CRITICAL] Deduplication Service Uses Wrong Column Name vs Migration
- **Location**: `apps/dopams-api/src/services/deduplication.ts:29` vs `apps/dopams-api/migrations/032_deduplication.sql:10`
- **Issue**: The `findDuplicates` function inserts into column `match_reasons` but the migration defines the column as `match_fields`. This will cause a `column "match_reasons" does not exist` runtime error.
- **Fix**: Either rename the column in the migration to `match_reasons` (requires a new migration) or update the service to use `match_fields`.

### [CRITICAL] Deduplication Service Uses Wrong Primary Key Column Name
- **Location**: `apps/dopams-api/src/services/deduplication.ts:189` vs `apps/dopams-api/migrations/032_deduplication.sql:19`
- **Issue**: The `mergeSubjects` function queries `RETURNING merge_history_id` but the migration defines the primary key as `merge_id`. This will cause a runtime SQL error. The `unmergeSubjects` function also queries `merge_history_id` (line 229).
- **Fix**: Align the code to use `merge_id` or add a new migration renaming the column to `merge_history_id`.

### [CRITICAL] Assertion Conflict Route Uses Wrong Column Name vs Migration
- **Location**: `apps/dopams-api/src/routes/assertion-conflict.routes.ts:73-74` vs `apps/dopams-api/migrations/043_assertion_conflict.sql:9`
- **Issue**: The resolve endpoint updates `resolved_source` but the migration defines the column as `resolution`. The list endpoint also queries `resolved_source` (line 32) which does not exist. The WHERE clause `resolved_by IS NOT NULL` works, but the SELECT list references a non-existent column.
- **Fix**: Align the code column names to match the migration (`resolution` instead of `resolved_source`) or add a new migration with the correct column names.

### [HIGH] LDAP Stub Accepts Any Password
- **Location**: `packages/api-core/src/auth/ldap-auth.ts:66`
- **Issue**: The LDAP stub returns `success: true` for any password. While marked as a stub, there is no compile-time or startup guard preventing this from reaching production. The `password` parameter is accepted but never verified.
- **Fix**: Add a startup check that blocks the LDAP stub in production (e.g., check `NODE_ENV !== 'production'` or require an explicit `LDAP_STUB_ALLOWED=true` env var). At minimum, log a CRITICAL-level warning, not just WARN.

### [HIGH] Content Monitoring Regex Pattern from User Input (ReDoS Risk)
- **Location**: `apps/dopams-api/src/routes/content-monitoring.routes.ts:92`
- **Issue**: Monitoring rules store user-provided regex patterns that are compiled with `new RegExp(rule.pattern, "i")`. A malicious or poorly-written regex (e.g., `(a+)+$`) can cause catastrophic backtracking (ReDoS), blocking the event loop during content ingestion. The same issue exists in `apps/forensic-api/src/routes/report.routes.ts:74` (redaction rules) and `apps/social-media-api/src/services/classifier.ts:56` (taxonomy rules).
- **Fix**: Validate regex patterns at creation time using a safe regex validator (e.g., `safe-regex2` or `re2`). Add a timeout mechanism or use the `re2` library for pattern matching on user-provided content.

### [MEDIUM] Missing Unit ID Scoping on Multiple Endpoints
- **Location**: `apps/dopams-api/src/routes/content-monitoring.routes.ts:176` (GET content/:id), `apps/dopams-api/src/routes/ocr.routes.ts:47-68` (GET ocr/:jobId), `apps/dopams-api/src/routes/graph.routes.ts:94` (GET kingpins)
- **Issue**: Several detail/get endpoints do not filter by `unit_id`, meaning any authenticated user can access resources belonging to other units. The list endpoints correctly apply unit scoping, but the detail endpoints bypass it.
- **Fix**: Add unit_id check to all GET-by-ID endpoints, consistent with the pattern used in subjects and leads.

### [MEDIUM] Missing additionalProperties:false on Some Param Schemas
- **Location**: `apps/forensic-api/src/routes/report.routes.ts:134,211,265,288` (params schemas missing `additionalProperties: false`)
- **Issue**: Several param schemas in the forensic report routes do not set `additionalProperties: false`, which means Fastify will not reject unexpected URL parameters. While not a security vulnerability, it weakens API contract enforcement.
- **Fix**: Add `additionalProperties: false` to all param schemas for consistency.

---

## 2. Database

### [CRITICAL] Column Name Mismatches Between Migrations and Code (3 instances)
- **Location**: See findings above (dedup `match_reasons` vs `match_fields`, merge_history `merge_history_id` vs `merge_id`, assertion_conflict `resolved_source` vs `resolution`)
- **Issue**: These are runtime-breaking column name mismatches. Any call to these features will result in a PostgreSQL error.
- **Fix**: Create corrective migrations that rename columns to match the code, or update the code to match the migrations.

### [HIGH] Missing IF NOT EXISTS on uuid_generate_v4 Extension
- **Location**: `apps/dopams-api/migrations/043_assertion_conflict.sql:2`
- **Issue**: Uses `uuid_generate_v4()` but does not ensure `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`. The dedup migration (032) correctly uses `gen_random_uuid()` which is built-in to PostgreSQL 13+. Inconsistent UUID generation functions across migrations.
- **Fix**: Standardize on `gen_random_uuid()` (no extension needed) or add the extension creation to the migration.

### [MEDIUM] Missing Indexes on Foreign Keys Used in Joins
- **Location**: `apps/dopams-api/migrations/032_deduplication.sql` — `merge_history.merged_by` has no index; `apps/social-media-api/migrations/038_taxonomy_versioning.sql` — `classification_result.taxonomy_version_id` FK has no index
- **Issue**: Foreign key columns used in JOIN conditions or WHERE clauses should have indexes for query performance. `merged_by` is used to filter merge history by user, and `taxonomy_version_id` is used in classification queries.
- **Fix**: Add `CREATE INDEX IF NOT EXISTS` statements for these columns in new migrations.

### [MEDIUM] Scheduled Report next_run_at Uses Fixed Interval Instead of Cron
- **Location**: `apps/social-media-api/src/sla-scheduler.ts:92`
- **Issue**: The scheduled report runner sets `next_run_at = NOW() + INTERVAL '1 day'` regardless of the `cron_expression` stored in the record. The cron expression is stored but never parsed or used.
- **Fix**: Integrate a cron parser (e.g., `cron-parser` npm package) to compute the actual next run time from the stored cron expression.

### [LOW] Inconsistent Use of SELECT * in Service Queries
- **Location**: Multiple files across all three APIs (see grep results: ~80+ instances)
- **Issue**: `SELECT *` is used extensively in service-layer queries. This fetches unnecessary columns, increases memory usage, and creates implicit coupling to schema changes. Some queries in routes correctly enumerate columns while their service counterparts use `SELECT *`.
- **Fix**: Replace `SELECT *` with explicit column lists in service queries, especially for frequently-called endpoints and tables with large JSONB columns.

---

## 3. Error Handling

### [HIGH] OCR Processor Uses console.error Instead of Structured Logger
- **Location**: `apps/dopams-api/src/services/ocr-processor.ts:36-37`
- **Issue**: The fire-and-forget OCR processing catch uses `console.error("OCR processing error:", err)` instead of the structured logger (`request.log.error` or the shared `logError`). This error will not appear in structured log aggregation, lacks request context, and may leak stack traces to stdout in production.
- **Fix**: Pass a logger reference into `submitOcrJob` and use structured logging. The same pattern appears in `forensic-api/src/services/ocr-processor.ts:23` and `social-media-api/src/services/ocr-processor.ts:23`.

### [HIGH] DOPAMS Sync Service Uses console.log for Production Logging
- **Location**: `apps/forensic-api/src/services/dopams-sync.ts:78`
- **Issue**: `console.log` is used to log sync POST details including the DOPAMS API URL and payload counts. In production, this bypasses structured logging, lacks correlation IDs, and cannot be filtered or routed.
- **Fix**: Use the shared logger infrastructure from `@puda/api-core`.

### [HIGH] Email Relay Uses console.warn Without Structured Logging
- **Location**: `apps/dopams-api/src/services/email-relay.ts:21`
- **Issue**: `console.warn` outputs recipient email address and subject line to stdout. In production this leaks PII to unstructured logs and bypasses redaction.
- **Fix**: Use `logWarn` from `@puda/api-core` with redacted values.

### [MEDIUM] Catch-All Swallows Errors in Content Monitoring Rule Evaluation
- **Location**: `apps/dopams-api/src/routes/content-monitoring.routes.ts:105-107`
- **Issue**: Invalid regex patterns in monitoring rules are silently skipped with an empty `catch {}` block. Administrators will not know their rules are failing to match.
- **Fix**: Log a warning with the rule ID and the regex error message.

### [MEDIUM] Generic "An internal error occurred" Messages Throughout
- **Location**: All route files across all three APIs
- **Issue**: While the generic error message is correct (avoids leaking internals), the error code is always `INTERNAL_ERROR`. It would be more useful for API consumers to have distinctive error codes per domain (e.g., `OCR_SUBMISSION_FAILED`, `GRAPH_ANALYSIS_FAILED`) while keeping the message generic.
- **Fix**: Consider making error codes more specific while keeping messages generic. Low priority but improves debuggability for API consumers.

### [LOW] Missing Error Handling on Sequence Generation Queries
- **Location**: `apps/dopams-api/src/routes/lead.routes.ts:97`, `apps/dopams-api/src/routes/subject.routes.ts:130`, multiple report routes
- **Issue**: Sequence generation queries (`SELECT 'DOP-LEAD-' || ... || nextval(...)`) are not wrapped in try/catch. If the sequence does not exist, the error will propagate as a generic 500 rather than a specific error about missing database sequences.
- **Fix**: Wrap sequence calls in try/catch with a specific error message about sequence initialization.

---

## 4. Code Maintainability

### [HIGH] Duplicated buildReportTemplate Between Forensic and Social Media APIs
- **Location**: `apps/forensic-api/src/routes/report.routes.ts:11-68` and `apps/social-media-api/src/routes/report.routes.ts:12-67`
- **Issue**: Nearly identical `buildReportTemplate` functions exist in both APIs with only minor differences (subtitle text, section field names). This is a DRY violation that will lead to divergent behavior as one copy gets updated but not the other.
- **Fix**: Extract a shared `buildReportTemplate` factory into `packages/api-integrations` that accepts a configuration object for app-specific customization.

### [HIGH] Duplicated Dynamic UPDATE Pattern Across Multiple Routes
- **Location**: `apps/dopams-api/src/routes/ingestion.routes.ts:180-194`, `apps/dopams-api/src/routes/subject.routes.ts:194-213`, `apps/social-media-api/src/routes/queue-routing.routes.ts:86-101`, `apps/forensic-api/src/routes/dashboard.routes.ts:232-239`, and 5+ more
- **Issue**: The pattern of building dynamic SET clauses with `$${idx++}` is copy-pasted across 8+ files with minor variations. Each instance has the same risk of off-by-one errors in parameter indexing.
- **Fix**: Extract a shared `buildUpdateQuery(tableName, fieldMap, body)` utility into `packages/api-core` that handles the SET clause building, parameter indexing, and `updated_at = NOW()` addition.

### [HIGH] Services Duplicated Across All Three API Apps
- **Location**: `*/services/ocr-processor.ts`, `*/services/geofence.ts`, `*/services/legal-mapper.ts`, `*/services/graph-analysis.ts`, `*/services/drug-classifier.ts`, `*/services/model-governance.ts`, `*/services/search.ts`, `*/services/nl-query.ts`, `*/services/translator.ts`
- **Issue**: At least 9 service files are near-identical copies across all three API apps. For example, the `geofence.ts` service has the same functions with the same implementations in dopams-api, forensic-api, and social-media-api. This was likely done to meet feature parity but creates a massive maintenance burden.
- **Fix**: Extract shared services into `packages/api-integrations` or a new `packages/shared-services` package. Each app can then import and optionally extend them.

### [MEDIUM] Graph Analysis Stores Results One-by-One in a Loop
- **Location**: `apps/dopams-api/src/services/graph-analysis.ts:247-253`
- **Issue**: After computing graph analysis, results are stored with individual INSERT queries in a loop. For a graph with thousands of nodes, this means thousands of individual INSERT statements, which is extremely slow.
- **Fix**: Batch the inserts using `unnest()` arrays or a multi-row VALUES clause. Alternatively, use `COPY` for bulk insertion.

### [MEDIUM] OCR Stub Always Returns Zero Confidence
- **Location**: `apps/dopams-api/src/services/ocr-processor.ts:56`
- **Issue**: `const stubConfidence = 0` means the three-tier confidence routing will always route to `FAILED` status. While this is a stub, it makes it impossible to test the MANUAL_REVIEW and COMPLETED paths without modifying the code.
- **Fix**: Make the stub confidence configurable via an environment variable (e.g., `OCR_STUB_CONFIDENCE=0.8`) so developers can test all three paths.

### [MEDIUM] Unused `remarks` Parameter in Assertion Conflict Resolution
- **Location**: `apps/dopams-api/src/routes/assertion-conflict.routes.ts:67`
- **Issue**: The `remarks` field is destructured from the request body but never stored in the database UPDATE query on line 70-75. The API accepts remarks but silently discards them.
- **Fix**: Add a `remarks` column to the `assertion_conflict` table and include it in the UPDATE statement.

### [MEDIUM] Dead Import in errors.ts
- **Location**: `packages/api-core/src/errors.ts:1`
- **Issue**: `import { resolve } from "node:path"` is imported at the top of errors.ts but only used in `validateFilePath`. While not broken, `resolve` is re-imported locally for the function. The import is used, but the file mixes two concerns: HTTP error helpers and path validation. Consider separating.
- **Fix**: Move `validateFilePath` to its own utility file or keep it but document the dual purpose of the module.

### [LOW] Inconsistent Error Response Patterns
- **Location**: `packages/api-core/src/middleware/auth-middleware.ts:161-162` vs `packages/api-core/src/errors.ts:5-8`
- **Issue**: Auth middleware sends error responses inline (`reply.code(401).send({ error: ..., message: ..., statusCode: ... })`) while route handlers use `sendError()`. This means error shape could drift if `sendError` is updated.
- **Fix**: Use `sendError` / `send401` consistently in the auth middleware as well.

### [LOW] Content Monitoring Dashboard Not Unit-Scoped
- **Location**: `apps/dopams-api/src/routes/content-monitoring.routes.ts:224-255`
- **Issue**: The content dashboard endpoint aggregates across all units. Other dashboard endpoints in the codebase (forensic, social-media) scope by unit_id. This inconsistency could lead to data leakage across organizational boundaries.
- **Fix**: Add unit_id filtering to the content dashboard queries, consistent with other dashboard implementations.

---

## 5. Security

### [CRITICAL] LDAP Stub Bypasses Password Verification in Pseudo-Production
- **Location**: `packages/api-core/src/auth/ldap-auth.ts:66`
- **Issue**: (Duplicate of finding above, listed here for security context.) Any password is accepted when LDAP auth is configured but still in stub mode. There is no runtime guard to prevent this in production.
- **Fix**: Reject all LDAP auth attempts when `NODE_ENV === 'production'` and the stub is active. Log a CRITICAL alert.

### [HIGH] User-Provided Regex Compiled Without Safety Limits
- **Location**: `apps/dopams-api/src/routes/content-monitoring.routes.ts:92`, `apps/forensic-api/src/routes/report.routes.ts:74`, `apps/social-media-api/src/services/classifier.ts:56`
- **Issue**: (Duplicate, listed here for security context.) User-provided regex patterns from DB are compiled and executed against potentially large text bodies. ReDoS can be used as a denial-of-service vector.
- **Fix**: Use `re2` (Google's regex library, immune to ReDoS) or validate patterns with `safe-regex2` at write time.

### [MEDIUM] Assertion Conflict Insert Uses Previous Value Placeholder
- **Location**: `apps/dopams-api/src/routes/subject.routes.ts:236`
- **Issue**: When detecting assertion conflicts during subject update, `value_a` is hardcoded as `"previous_value"` instead of fetching the actual previous value from the database. This means the conflict record is useless for auditing what the previous value actually was.
- **Fix**: Query the current value of the field before updating, and store it as `value_a` in the conflict record.

### [MEDIUM] CSV Export Lacks Proper Escaping
- **Location**: `apps/forensic-api/src/routes/dashboard.routes.ts:81-82,144-145`
- **Issue**: CSV generation uses manual string concatenation with only double-quote escaping for titles. Fields containing commas, newlines, or other CSV-special characters in non-title fields (case_id, state_id, etc.) are not escaped, which could produce malformed CSV output.
- **Fix**: Use a proper CSV serialization library or wrap all field values in double quotes with internal quote escaping.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 6     |
| HIGH     | 9     |
| MEDIUM   | 11    |
| LOW      | 4     |
| **Total**| **30**|

### Severity Breakdown

**CRITICAL (6):** All are runtime-breaking issues -- SQL column name mismatches between code and migrations (3), table name mismatch in LDAP auth routes (2), and LDAP stub accepting any password without production guard (1).

**HIGH (9):** ReDoS via user-provided regex (2 findings), console.log/warn bypassing structured logging (3), duplicated code across apps (3), missing unit-scoping on detail endpoints (1).

**MEDIUM (11):** Missing indexes, unused parameters being silently discarded, CSV escaping issues, inconsistent error patterns, hard-coded stub values, and other maintainability concerns.

**LOW (4):** SELECT * usage, inconsistent error response patterns, minor import issues.

---

## Quality Verdict: **FAIL**

The 6 CRITICAL findings are all runtime-breaking bugs that will cause PostgreSQL errors or security bypass on first use of the affected features. These must be fixed before deployment:

1. LDAP auth routes reference non-existent `app_user` table and `role_name` column
2. LDAP auth stub reference non-existent `app_user` table with `auth_source` column
3. Deduplication service uses `match_reasons` column that does not exist (migration defines `match_fields`)
4. Deduplication service uses `merge_history_id` column that does not exist (migration defines `merge_id`)
5. Assertion conflict routes use `resolved_source` column that does not exist (migration defines `resolution`)
6. LDAP stub accepts any password with no production guard

Until these are resolved, the BRD gap closure changes should not be considered deployment-ready.
