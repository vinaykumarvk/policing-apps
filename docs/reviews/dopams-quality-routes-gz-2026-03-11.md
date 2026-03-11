# DOPAMS API Route Quality Review: Files G-Z

**Date:** 2026-03-11
**Scope:** 27 route files from `geofence.routes.ts` through `watchlist.routes.ts`
**Reviewer:** Automated code quality audit

**Legend:** CRITICAL = exploitable / data-loss risk, HIGH = likely bug or security gap, MEDIUM = code smell / maintainability, LOW = minor style / best-practice

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 21 |
| MEDIUM | 25 |
| LOW | 12 |
| **Total** | **64** |

**Note:** Auth middleware is applied globally via `registerAuthMiddleware(app)` in `app.ts:191` before routes are registered. Per-route role guards are applied selectively using `createRoleGuard`.

---

## CRITICAL Findings

- **CRITICAL** `legal.routes.ts:78` — **SQL injection via dynamic table/column names.** `tableName`, `textColumn`, and `idColumn` are derived from user-supplied `entityType` via a switch/case, but the values are interpolated directly into the SQL template string (`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`). While the switch statement limits values to known strings, any future case addition with user input could introduce injection. The same pattern exists at `translate.routes.ts:153`.

- **CRITICAL** `translate.routes.ts:153` — Same SQL injection pattern as `legal.routes.ts:78`. Dynamic `tableName`, `textColumn`, `idColumn` interpolated into query string. Although constrained by a switch statement, this bypasses parameterized query protection.

- **CRITICAL** `report-generate.routes.ts:204-253` — **Missing input validation schema.** `POST /api/v1/reports/generate` has no JSON schema on the body. `caseId` and `reportType` are extracted from an unvalidated body. Malformed input bypasses Fastify's schema validation entirely.

- **CRITICAL** `report-generate.routes.ts:259-288` — **Missing input validation schema.** `POST /api/v1/reports/generate/pdf` has no JSON schema on the body. `markdown` content is accepted without schema validation or size limits.

- **CRITICAL** `report-generate.routes.ts:208-209` — **Incorrect `sendError` call signature.** `sendError(reply, 400, "caseId and reportType are required")` passes 3 args instead of 4 (missing error code). This likely produces a malformed error response or throws at runtime.

- **CRITICAL** `saved-search.routes.ts:279-282` — **Parameter index bug in keyword search.** The `$${idx}` reference inside the `.map()` callback increments `idx` but also uses `idx` for the same placeholder in two ILIKE clauses (`a.title ILIKE '%' || $${idx} || '%' OR a.description ILIKE '%' || $${idx++} || '%'`). The post-increment means `title` and `description` use different parameter indices, while `params.push(...keywords)` pushes each keyword once. This will produce wrong parameter binding or query errors for multi-keyword searches.

---

## HIGH Findings

- **HIGH** `geofence.routes.ts:39-41` — **`as any` casts** on `request.body` and `request.authUser`. Uses `(request as any).authUser?.userId` instead of the typed `request.authUser!.userId`. This bypasses TypeScript safety and hides missing auth.

- **HIGH** `geofence.routes.ts:50-58,113-122,156-163,221-230` — **Missing try/catch on several GET handlers.** `listGeofences`, `getGeofenceEvents`, `listTowerDumps`, `getTowerDumpRanked` — if the underlying service throws, the global error handler catches it, but these lack per-handler logging. Inconsistent with other handlers in the same file that do have try/catch.

- **HIGH** `graph.routes.ts:516-530` — **Missing try/catch** on `GET /api/v1/graph/nodes`. Handler directly awaits `query()` without try/catch. An error will be caught by global handler but without contextual logging.

- **HIGH** `graph.routes.ts:96-104` — **Missing role guard** on `GET /api/v1/graph/kingpins`. Other graph analysis endpoints require `requireGraphAnalysis` guard but kingpins is unprotected, exposing sensitive intelligence data to any authenticated user.

- **HIGH** `ingestion.routes.ts:22-39,41-53,107-119,204-219,222-229` — **Missing try/catch** on 5 handlers. Errors propagate to global handler without contextual request logging.

- **HIGH** `jurisdiction.routes.ts:19-33,84-90,93-96` — **Missing try/catch** on `GET /api/v1/units`, `GET /units/:id/hierarchy`, and `POST /units/refresh-cache`. Errors lack contextual logging.

- **HIGH** `lead.routes.ts:30-51,53-61,134-149,194-199` — **Missing try/catch** on 4 handlers (`GET /leads`, `GET /leads/facets`, `GET /leads/:id`, `GET /leads/:id/transitions`). Database errors will not have handler-level logging.

- **HIGH** `model.routes.ts:33-35,171-173,213` — **`as any` casts** on `request.body` and `(request as any).authUser`. Lines 33, 35, 171, 172, 213 all use `as any` for the body or authUser. Hides type errors.

- **HIGH** `monthly-report.routes.ts:296-350` — **KPI `calculationQuery` stored as raw SQL.** `POST /api/v1/kpis` accepts a `calculationQuery` string that is stored in the database. If this query is later executed (as the name implies), it constitutes a stored SQL injection vector. No sanitization or allowlisting is applied.

- **HIGH** `notes.routes.ts:7-35` — **Unbounded `entityType` param.** `GET /api/v1/:entityType/:entityId/notes` — the `entityType` path param is used directly in SQL WHERE clause. While parameterized ($1), the wildcard path pattern means ANY path segment matches, potentially colliding with other routes.

- **HIGH** `report-generate.routes.ts:204,259` — **Missing role guard.** Both report generation endpoints (`POST /generate` and `POST /generate/pdf`) have no role guard. Any authenticated user can generate reports and PDFs for any case.

- **HIGH** `slang.routes.ts:58` — **SQL injection via interpolated sort column.** `ORDER BY ${sortCol} ${sortDir}` interpolates the sort column and direction directly into SQL. While `sortCol` is validated against `SORT_COLUMNS` allowlist and `sortDir` is constrained to "ASC"/"DESC", this is a fragile pattern. A future change to `SORT_COLUMNS` with a non-column value would be exploitable.

- **HIGH** `slang.routes.ts:138-157` — **Missing try/catch** on `PATCH /api/v1/slang/:id`. Database errors propagate without handler logging.

- **HIGH** `slang.routes.ts:196-208,216-228` — **Missing try/catch** on approve/reject handlers. Errors lack contextual logging.

- **HIGH** `subject.routes.ts:709` — **`params` typed as `any[]`** in the update handler. Loses type safety for all query parameters.

- **HIGH** `taxonomy.routes.ts:18-39,87-96` — **Missing try/catch** on `GET /api/v1/taxonomy` and `GET /classification-thresholds`. DB errors go to global handler without context.

- **HIGH** `unocross.routes.ts:146-193,321-344` — **Missing try/catch** on analyze and evaluate handlers. The analyze handler has a catch but the subject check query at line 151 is outside it. If that query fails, it throws before the try block.

- **HIGH** `watchlist.routes.ts:19-40,45-63,106-138,182-190` — **Missing try/catch** on 4 handlers. `GET /watchlists`, `GET /watchlists/:id`, `POST /check-alert`, and `DELETE /subjects/:subjectId` lack try/catch. DB errors propagate without per-handler logging.

- **HIGH** `report-template.routes.ts:41,112` — **`as any` cast** on `.map(({ total_count, ...r }: any) => r)`. Loses type information.

- **HIGH** `privacy.routes.ts:167` — **`as any` cast** on `.map(({ total_count, ...r }: any) => r)` in access log handler.

---

## MEDIUM Findings

- **MEDIUM** `geofence.routes.ts:100-103` — **Redundant validation.** `latitude == null || longitude == null` check is redundant because the JSON schema already marks them as `required`.

- **MEDIUM** `geofence.routes.ts:117,224` — **Unvalidated `limit` query param.** `parseInt(limit || "50", 10)` on `limit` query parameter without schema validation. Could be NaN if non-numeric string is passed.

- **MEDIUM** `graph.routes.ts:48` — **Non-null assertion on authUser.** `request.authUser!` — if the role guard somehow doesn't stop the request, this will throw with an unhelpful error.

- **MEDIUM** `ingestion.routes.ts:181` — **`params` typed as `any[]`** in dynamic update builder. Loses type safety.

- **MEDIUM** `interrogation.routes.ts:306-309` — **Ineffective "no changes" check.** `setClauses.length === 2` checks against the initial 2 clauses (`updated_at`, `row_version`), but these are added unconditionally. If no user-visible fields change, the query still increments `row_version` and updates `updated_at`, which is misleading.

- **MEDIUM** `legal.routes.ts:167` — **Dynamic SQL concatenation.** `sql += AND approval_status = $N` builds SQL with string concatenation. While parameterized, the pattern is fragile and harder to audit than a single query string.

- **MEDIUM** `model.routes.ts:36-37` — **Redundant validation.** Body schema already requires `modelName`, `modelType`, `version` — the explicit check at line 36 is dead code.

- **MEDIUM** `model.routes.ts:104` — **Redundant enum check.** `status` is already validated by the schema `enum` constraint. The `includes()` check at line 104 is dead code.

- **MEDIUM** `monthly-report.routes.ts:348` — **User input echoed in error message.** `A KPI with code '${kpiCode}' already exists` — echoing user-supplied input in error messages can facilitate XSS if the response is rendered in a browser.

- **MEDIUM** `notes.routes.ts:12-13` — **Missing `additionalProperties: false`** on params schema. Allows extra properties in path params, which is unusual.

- **MEDIUM** `notes.routes.ts:80-83` — **Missing `additionalProperties: false`** on activity params schema.

- **MEDIUM** `notes.routes.ts:91-96` — **`SELECT *` usage.** `SELECT * FROM audit_event` leaks all columns including potentially sensitive ones. Should specify columns explicitly.

- **MEDIUM** `report-generate.routes.ts:87-88,100-101,109-110,119-120,127-128` — **`.catch(() => ({ rows: [] }))`** silently swallows query errors in `gatherCaseData`. Errors during data gathering are hidden, which could produce incomplete reports without any indication.

- **MEDIUM** `report-template.routes.ts:112` — **`params` typed as `any[]`** in dynamic update builder.

- **MEDIUM** `saved-search.routes.ts:247-297` — **Stored query execution has unbounded scope.** The `/run` endpoint dynamically builds WHERE clauses from user-stored JSON. While parameterized, there is no validation that stored query fields are from an allowlist — a modified `query_jsonb` could contain unexpected fields that are silently ignored.

- **MEDIUM** `search.routes.ts:6-38` — **No query schema validation.** `GET /api/v1/search` has no schema on the querystring. All parameters are accessed via `as Record<string, string | undefined>` without Fastify validation.

- **MEDIUM** `slang.routes.ts:44` — **LIKE injection risk.** `searchTerm = \`%${qs.search}%\`` directly interpolates user input into a LIKE pattern. While used via parameterized query, SQL LIKE wildcards (`%`, `_`) in user input are not escaped, enabling unintended pattern matching.

- **MEDIUM** `slang.routes.ts:307-315` — **N+1 query in bulk import.** Each entry in the `entries` array triggers a separate `INSERT` query in a loop. For 500 entries (maxItems), this is 500 round trips. Should use a batch insert or `unnest()`.

- **MEDIUM** `subject.routes.ts:18-25` — **PII masking mutates in place.** `maskSubjectPII` mutates the original row object's fields to `"[REDACTED]"`. If the same object reference is used elsewhere (e.g., logging), PII could be lost before logging or the masked value could leak into logs.

- **MEDIUM** `translate.routes.ts:128-150` — Same SQL interpolation pattern as `legal.routes.ts` — dynamic table/column from switch. See CRITICAL entry for `translate.routes.ts:153`.

- **MEDIUM** `translate.routes.ts:174` — **Regex constructed from database data.** `new RegExp(g.source_term.replace(...))` creates a regex from glossary terms stored in the database. While special chars are escaped, pathological regex patterns from malicious glossary entries could cause ReDoS.

- **MEDIUM** `unocross.routes.ts:388-395` — **`subjectData` typed as `any[]`.** Loses all type safety for the draft content generation.

- **MEDIUM** `unocross.routes.ts:584` — **`SELECT *` usage.** `SELECT * FROM unocross_draft` leaks all columns.

- **MEDIUM** `watchlist.routes.ts:184-190` — **Hard DELETE instead of soft delete.** `DELETE FROM watchlist_subject` performs a physical delete. All other delete operations in the codebase use soft deletes. Inconsistent and loses audit trail.

- **MEDIUM** `queue-routing.routes.ts:22-32` — **`isActive` query param ignored.** The schema accepts `isActive` in querystring but the query does not filter by it — it returns all rules regardless.

---

## LOW Findings

- **LOW** `geofence.routes.ts:39,100,146,207` — Body typed as `any`. Could use proper interfaces instead.

- **LOW** `graph.routes.ts:462` — **Edge deduplication via linear scan.** `edgesList.some((e) => e.id === ownerEdgeId)` is O(n) for each edge. With 100 transaction rows this means up to 200 linear scans. Use a `Set` instead.

- **LOW** `model.routes.ts:67` — **Inconsistent error response format.** `{ error: "NOT_FOUND" }` lacks a `message` field, unlike other 404 responses in the codebase that use `send404(reply, code, message)`.

- **LOW** `model.routes.ts:105` — Same inconsistency: `{ error: "INVALID_STATUS" }` with no message.

- **LOW** `model.routes.ts:108,133` — Same inconsistency: `{ error: "NOT_FOUND" }` with no message.

- **LOW** `monthly-report.routes.ts:259` — `active_only` query param is typed as `boolean` but schema defaults it to `true`. When not supplied, it will be `undefined`, not `true`. The `!== false` check at line 260 handles this correctly but is confusing.

- **LOW** `nl-query.routes.ts:25-29` — **Manual auth check redundant.** The `if (!userId)` check and 401 response is redundant since global auth middleware already enforces authentication.

- **LOW** `saved-search.routes.ts:38,310` — `as any` in `.map()` destructuring. Should use proper type instead.

- **LOW** `slang.routes.ts:78-81` — `as any` in `.map()` calls for facet queries.

- **LOW** `subject.routes.ts:636-639,654-658` — Empty catch blocks (`catch { }`) silently discard errors during entity normalization. Should at minimum log a warning.

- **LOW** `translate.routes.ts:94-100` — **Missing try/catch** on `DELETE /glossary/:termId`. Minor since the global handler catches, but inconsistent with the rest of the file.

- **LOW** `unocross.routes.ts:589` — `as any` cast on subject data mapping.

---

## Files With No Findings

- `task.routes.ts` — Thin wrapper over `@puda/api-core` `createTaskRoutes`. No custom code to review.

---

## Recommendations (Priority Order)

1. **Fix CRITICAL SQL interpolation** in `legal.routes.ts` and `translate.routes.ts`. Use a column map object and validate against it, never interpolate table/column names directly.
2. **Add JSON schema** to `report-generate.routes.ts` POST endpoints.
3. **Fix `sendError` call signature** in `report-generate.routes.ts:208-209`.
4. **Fix parameter index bug** in `saved-search.routes.ts:279-282` keyword search.
5. **Add role guards** to report generation endpoints and `GET /graph/kingpins`.
6. **Add try/catch** to all handlers missing it (21 handlers across 10 files).
7. **Audit stored `calculationQuery`** in KPI definitions — ensure it is never executed as raw SQL.
8. **Replace `as any` casts** with proper TypeScript types across `geofence.routes.ts`, `model.routes.ts`, `report-template.routes.ts`, and `subject.routes.ts`.
9. **Batch the slang bulk import** to avoid N+1 query performance issue.
10. **Change watchlist subject removal** to soft delete for audit consistency.
