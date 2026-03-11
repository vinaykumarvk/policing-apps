# DOPAMS API Services — Code Quality Review

**Date:** 2026-03-11
**Scope:** 41 service files in `apps/dopams-api/src/services/`
**Categories:** Error handling, type safety, SQL injection, code duplication, resource leaks, edge cases

---

## CRITICAL

- **pii-crypto.ts:13** — Static salt `"puda-pii-salt"` in `scryptSync` defeats the purpose of key derivation; every key maps to the same derived key regardless of deployment. Should use a per-deployment random salt stored alongside the ciphertext or in config.

- **pii-crypto.ts:8-13** — `getEncryptionKey()` derives the key via `scryptSync` on every call (both `encryptPii` and `decryptPii`). `scryptSync` is intentionally CPU-expensive and blocks the event loop. High-throughput PII operations will stall the server. Cache the derived key in module scope.

- **search.ts:137** — ILIKE fallback `${table.textColumn} ILIKE '%' || $1 || '%'` is vulnerable to SQL wildcard injection. If `searchTerm` contains `%` or `_`, results are unpredictable. Escape `%`/`_` in `searchTerm` before passing.

- **classifier.ts:78** — Dynamic column/table names `SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1` use unparameterized string interpolation. Although values come from an internal switch, the pattern is fragile — a future case could introduce injection. Use an allowlist lookup or query builder.

- **monthly-report.ts:71-73** — `kpi.calculation_query` is executed as raw SQL loaded from the database (`getKpiValues`). A malicious or misconfigured KPI row can execute arbitrary SQL (e.g., `DROP TABLE`). KPI queries should run in a read-only transaction or a restricted role.

- **llm-provider.ts:186** — Gemini adapter puts the API key in the URL query string: `?key=${config.api_key_enc}`. This key will appear in server logs, proxy logs, and browser histories. Use header-based auth.

- **llm-provider.ts:112** — API key stored in `api_key_enc` column is used directly as a Bearer token, not decrypted. If the column is actually encrypted, it will send garbage; if plaintext, the column name is misleading and keys are stored unencrypted in the DB.

## HIGH

- **pii-minimizer.ts:23-39** — Regex `test()` then `replace()` on the same global regex fails intermittently. `RegExp.test()` advances `lastIndex` on a global regex, so the subsequent `replace()` may miss matches. Either use non-global regexes for `test()` or remove the `test()` call and rely solely on `replace()`.

- **geofence.ts:136-163** — `uploadTowerDumpRecords` inserts records one-by-one in a loop with no transaction. A failure midway leaves partial data with no rollback. Wrap in a transaction or use batch INSERT.

- **entity-extractor.ts:89-108** — `extractAndStore` performs N+M queries (one per entity + one per cross-match) sequentially with no transaction boundary. A failure mid-loop leaves partial link state. Should be transactional.

- **graph-analysis.ts:62-115** — Brandes betweenness centrality is O(V*E). With `MAX_RELATIONSHIPS = 50000`, this can produce graphs with tens of thousands of nodes. The algorithm will block the event loop for seconds or minutes. Run in a worker thread or limit graph size further.

- **graph-analysis.ts:247-253** — Storing analysis results does individual INSERT per node in a loop (potentially thousands of queries). Should batch insert or use `unnest()`.

- **graph-projector.ts:65-232** — `projectSubject` performs 20+ sequential queries per subject. `rebuildGraph` calls this for every non-merged subject. For thousands of subjects this creates tens of thousands of queries with no batching.

- **nl-query.ts:44** — `buildSql` for count queries interpolates table name from user regex match without validation: `const table = entityMap[matches[1].toLowerCase()] || "alert"`. The fallback to `"alert"` is safe, but the pattern allows any regex capture to be a lookup key. If entityMap were extended carelessly, it could inject table names.

- **dossier.ts:297-379** vs **dossier.ts:389-454** — `exportDossier` and `exportDossierPdfWithWatermark` share ~50 lines of identical content_sections parsing and ReportTemplate construction. Extract a shared helper to eliminate duplication.

- **drug-classifier.ts:121-123** — `reviewClassification` does not validate `reviewStatus` against an enum. Caller can set any string (e.g., `"DROPPED"`) bypassing expected states.

- **notification-engine.ts:58-72** — `matchesConditions` silently returns `true` for empty conditions objects, meaning a misconfigured rule with `{}` conditions fires on every event.

- **slang-normalizer.ts:59-89** — `normalizeSlang` (uncached version) hits the DB twice every call and does not use the cache introduced in `normalizeSlangCached`. Dead code duplication — the uncached version is exported but should be removed or unified.

- **deduplication.ts:204** — `DELETE FROM watchlist_subject WHERE subject_id = $1 AND subject_id != $2` is logically impossible when `$1 = mergedId` and `$2 = survivorId` (both conditions can never both be true for a row). The intended logic is likely `subject_id = $2` (mergedId). Bug: orphaned watchlist links remain.

- **cdr-analysis.ts:111** — `radiusMeters: Math.max(500, distKm * 1000)` uses `distKm` which is the distance to the *next* cluster's first point, not the cluster's actual radius. This inflates the stay radius incorrectly.

- **auto-escalation.ts:17-57** — `checkAndEscalate` catches all errors and returns 0, silently swallowing failures. For a scheduler task, this means SLA breaches could be silently missed. Should log at error level and propagate.

## MEDIUM

- **pii-crypto.ts:29-35** — `decryptPii` does not validate that the input buffer has minimum expected length (`IV_LENGTH + TAG_LENGTH`). Malformed input will produce cryptic errors from `createDecipheriv` rather than a clear message.

- **geofence.ts:96** — `fences.rows as unknown as FenceRow[]` — double cast through `unknown` is a type safety escape hatch. The actual row shape is not validated at runtime.

- **classifier.ts:81** — `entityResult.rows[0][textColumn]` accesses a dynamic property with no null check. If the column value is `null`, `classifyContent` receives `undefined` but the `||` fallback handles it. Still, the type assertion is loose.

- **translator.ts:56-66** — `dictionaryTranslate` creates a new `RegExp` per dictionary entry per call. For large dictionaries this is slow. Pre-compile patterns at module load.

- **search.ts:101-167** — `globalSearch` paginates per-table then merges results. The `total` field is the merged count before slicing, not the true total across all tables (which would need separate COUNT queries). Misleading pagination metadata.

- **nl-query.ts:114** — Dead code: `const hasState = entity.table !== "subject_profile" || true` always evaluates to `true`.

- **ecourts-poller.ts:76** — Stub returns random `legalStatus` using `Math.random()`. If accidentally used in production, case statuses will be overwritten with random values on each poll.

- **unocross.ts:126-149** — `generateFinancialAnalysis` loads the template from DB but never uses the `parameters` or `query_template` columns. The template lookup only validates existence.

- **monthly-report.ts:86-88** — `catch {}` with empty block silently swallows KPI query errors. The report includes the KPI with `null` value but no error indication. Add error tracking per KPI.

- **notification-engine.ts:191** — Escalation template uses the raw template string from the DB without interpolation. The `nextRule.template` may contain `{{field}}` placeholders that will not be resolved because entity data is not passed.

- **model-governance.ts:55-76** — `updateModelStatus` does a read-then-write without transaction. A race condition could activate two models simultaneously.

- **model-governance.ts:75** — `updateModelStatus` returns `result.rows[0]` without null check. If `modelId` doesn't exist, returns `undefined` (type says `DbRow`).

- **ocr-processor.ts:56** — Stub hardcodes `stubConfidence = 0`, meaning every OCR job immediately goes to FAILED status. The three-tier routing logic is dead code in current implementation.

- **legal-rule-evaluator.ts:50-51** — `evaluateCondition` casts `ctx` to `Record<string, unknown>` to do dynamic field access, bypassing the typed `EntityContext` interface.

- **legal-mapper.ts:109** — `getPendingMappings` uses `as any` cast: `({ total_count, ...r }: any) => r`. Only explicit `any` in the codebase; destructure with `Record<string, unknown>` instead.

- **access-justification.ts:30** — SQL builds interval from user-controlled constant via string concatenation: `($4 || ' minutes')::interval`. Although `$4` is a constant (`30`), the pattern is error-prone. Use `$4 * INTERVAL '1 minute'` instead.

- **watermark.ts:12** — `purpose` parameter is accepted but never included in the watermark string itself, only logged to DB. The watermark is the same regardless of purpose.

- **trend-analyzer.ts:8-9** — `new Date(); bucket.setMinutes(0, 0, 0)` truncates to hour but uses local timezone. In a server that may change TZ or run in UTC, this could produce inconsistent buckets. Use UTC-based truncation.

- **trend-sharing.ts:55-70** — `getSharedTrends` parameter order is fragile: `LIMIT` is always `$1`, but `excludeUnitId` is conditionally `$2`. If the WHERE clause is not added, the params array still has the right count, but it's a maintenance trap.

- **email-relay.ts:22-29** — Swallowed `.catch(() => {})` on table-not-exist means any DB error (not just missing table) is silently ignored.

- **email-relay.ts:41-48** — `dispatchPendingEmails` catches the entire SELECT and returns `{ rows: [] }`. Any query error (bad join, missing column) produces silent no-ops.

- **narcotics-scorer.ts:262-301** — LLM enhancement only fires for scores 20-60. An LLM failure is silently caught. The score boundaries are magic numbers with no configuration.

- **slang-normalizer.ts:76** — `regex.test(normalizedText)` with a global regex followed by `normalizedText.replace(regex, ...)` has the same `lastIndex` bug as pii-minimizer.ts. The `test()` advances `lastIndex`, so `replace()` may start matching from the wrong position.

- **deduplication.ts:115** — Dynamic import `await (await import("../db")).getClient()` is used instead of the static import at line 1. Inconsistent and adds unnecessary overhead.

- **assertion-engine.ts:93-97** — After early-committing in the "same value" path, the function queries using the module-level `query` function, not the client. This is correct but subtly different from the rest of the function which uses `client.query`. Could confuse maintainers.

## LOW

- **geofence.ts:3-12** — `FenceRow` interface has a union type for `coordinates` but runtime code uses `as` casts for each branch. A discriminated union with runtime checks would be safer.

- **entity-extractor.ts:34** — Aadhaar regex `\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b` also matches 12-digit numbers that are not Aadhaar (e.g., phone numbers, account numbers). High false positive rate.

- **entity-extractor.ts:119-141** — `getEntityGraph` uses recursive async traversal with sequential queries. For deep/wide graphs this produces O(nodes) sequential queries. Rewrite with a recursive CTE.

- **classifier.ts:117** — `overrideClassification` returns `result.rows[0]` which is `undefined` if classificationId is invalid. No error thrown for not-found case.

- **drug-classifier.ts:31** — `rule.keywords` assumes column is a JSON array. If stored as text, `filter()` call will fail at runtime.

- **search.ts:154-157** — Silently swallows table-not-found errors. Acceptable for migration gaps, but should log at debug level, not `console.warn`.

- **nl-query.ts:45-46** — NL query patterns use table names directly in SQL without schema prefix. If search_path changes, queries break silently.

- **cdr-analysis.ts:79-83** — Parses `latitude`/`longitude` from rows without validating they are valid numbers. `parseFloat` on null/undefined produces `NaN`, which propagates into haversine calculation silently.

- **dossier.ts:500** — `createDossier` generates a dossier ref using a sequence. If the sequence doesn't exist, it catches nothing and propagates a raw Postgres error.

- **ocr-processor.ts:35-37** — Fire-and-forget `processOcrJob(...).catch(console.error)` means unhandled job failures are only visible in console logs, not tracked in any monitoring.

- **graph-analysis.ts:236** — `const edges: GraphEdge[] = edgeResult.rows` — direct assignment from DB rows to typed array without mapping. Works only if column names exactly match interface properties.

- **legal-rule-evaluator.ts:66-68** — Numeric comparison `Number(fieldValue) >= Number(condition.value)` silently coerces non-numeric strings to `NaN`, causing comparison to return `false`. No error feedback for misconfigured rules.

- **language-detector.ts:56-62** — Language detection allocates a new regex match array for every script range. For very long texts, this creates many temporary arrays. Minor GC pressure.

- **markdown-to-template.ts:29** — Separator line detection `lines[1].replace(/[\s|:-]/g, "").length === 0` is fragile; a separator like `|---|` passes but `| text |` could also pass if text is all colons/dashes.

- **template-interpolator.ts:7** — `interpolate` only matches `\w+` in placeholders, so keys with dots or dashes (e.g., `{{case.number}}`) are silently ignored.

- **text-normalizer.ts:88** — `SEPARATOR_RE` regex is defined but never used (the actual separator collapse uses an inline regex at line 155). Dead code.

- **entity-normalizer.ts:14-19** — Phone normalization does not validate the result is exactly 10 digits. A malformed input like `"+91abc"` produces `"abc"` which passes through silently.

- **graph-projector.ts:21-23** — `clientOrQuery` parameter type is complex and fragile. The `typeof clientOrQuery === "function"` check distinguishes between the two, but the type signature is hard to follow.

- **graph-projector.ts:174** — Comment says "8. Project subject-subject links" but the previous section (social accounts) is also numbered 8. Numbering is inconsistent (sections 8, 8, 10, 11).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 7     |
| HIGH     | 14    |
| MEDIUM   | 23    |
| LOW      | 19    |
| **Total**| **63**|

### Top Priorities

1. **Fix PII crypto**: random per-ciphertext salt, cache derived key to avoid blocking event loop
2. **Sandbox KPI queries**: read-only transaction or restricted DB role for `monthly-report.ts`
3. **Fix regex lastIndex bugs**: `pii-minimizer.ts` and `slang-normalizer.ts` global regex test+replace
4. **Move Gemini API key** out of URL query string into headers
5. **Wrap bulk inserts in transactions**: `geofence.ts`, `entity-extractor.ts`, `graph-analysis.ts`
6. **Escape SQL wildcards** in `search.ts` ILIKE clause
7. **Fix deduplication.ts:204** watchlist DELETE logic bug
8. **Extract duplicate code** in `dossier.ts` (exportDossier vs exportDossierPdfWithWatermark)
