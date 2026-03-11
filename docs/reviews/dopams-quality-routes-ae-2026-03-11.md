# DOPAMS API Route Quality Review (A-E)

**Date:** 2026-03-11
**Scope:** 20 route files from `admin.routes.ts` through `extract.routes.ts`
**Checks:** missing error handling, missing auth/role guards, SQL injection, missing input validation, incorrect HTTP status codes, `any`-casts

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 14 |
| MEDIUM | 19 |
| LOW | 10 |

---

## CRITICAL

- **SQL injection via template literal interpolation**
  `dashboard.routes.ts:408` — `FROM ${table}` and `WHERE state_id NOT IN ${closedStates}` use string interpolation to build SQL. Although inputs come from a constrained `enum` validated by Fastify schema, the `table` and `closedStates` variables are derived from user-supplied `entityType` query parameter via a ternary chain with no allowlist guard *after* parsing. A schema bypass or future refactor could expose raw SQL injection.

- **Path traversal bypass in evidence file serving**
  `evidence.routes.ts:499` — When `storage_path` starts with `/` (absolute), the code uses it directly (`const fullPath = fileUrl.startsWith("/") ? fileUrl : join(EVIDENCE_BASE_DIR, fileUrl)`), then passes it to `validateFilePath(fullPath, EVIDENCE_BASE_DIR)`. However `validateFilePath` uses `join(baseDir, filePath)` which for an absolute `filePath` ignores `baseDir` entirely, so `resolved` becomes the attacker-controlled absolute path. The `startsWith(baseDir)` check then fails, but this only prevents serving; the real issue is the `readFile` call at line 505 that uses `safePath` which is `null` when validation fails. This specific path is guarded correctly (returns error on null), but the logic for `court-export` at line 641 has the same pattern and is similarly guarded. The overall design is fragile and a future change could easily introduce a bypass.

- **ReDoS via user-supplied regex in content monitoring**
  `content-monitoring.routes.ts:93` — `new RegExp(rule.pattern, "i")` constructs a regex from database-stored `pattern` values that are inserted from user input at line 279 without sanitization. A malicious pattern (e.g. `(a+)+b`) tested against large `rawText` can cause catastrophic backtracking, freezing the event loop.

---

## HIGH

- **Missing try/catch — unhandled promise rejections**
  - `alert.routes.ts:27` — `GET /api/v1/alerts` handler has no try/catch. DB error crashes the request with a 500 stack trace leak.
  - `alert.routes.ts:50` — `GET /api/v1/alerts/facets` handler has no try/catch.
  - `alert.routes.ts:62` — `GET /api/v1/alerts/:id` handler has no try/catch.
  - `alert.routes.ts:78` — `POST /api/v1/alerts/:id/transition` handler has no try/catch.
  - `alert.routes.ts:99` — `GET /api/v1/alerts/:id/transitions` handler has no try/catch.
  - `alert.routes.ts:110` — `GET /api/v1/alert-suppression-rules` handler has no try/catch.
  - `alert.routes.ts:118` — `POST /api/v1/alert-suppression-rules` handler has no try/catch.
  - `alert.routes.ts:145` — `DELETE /api/v1/alert-suppression-rules/:ruleId` handler has no try/catch.
  - `alert.routes.ts:159` — `POST /api/v1/alerts/check-suppression` handler has no try/catch.
  - `case.routes.ts:21` — `GET /api/v1/cases` handler has no try/catch.
  - `case.routes.ts:43` — `GET /api/v1/cases/facets` handler has no try/catch.
  - `case.routes.ts:54` — `GET /api/v1/cases/:id` handler has no try/catch.
  - `case.routes.ts:69` — `POST /api/v1/cases` handler has no try/catch.
  - `case.routes.ts:86` — `GET /api/v1/cases/:id/transitions` handler has no try/catch.

  Note: Fastify's global error handler (app.ts:181) catches unhandled errors and returns a generic 500, so these do not leak stack traces. However, the inconsistency means these routes lack the structured error logging (`request.log.error`) that other routes have.

- **Missing role guard on mutation endpoints**
  - `case.routes.ts:95` — `POST /api/v1/cases/:id/transition` has no role guard. Any authenticated user can transition a case.
  - `case.routes.ts:69` — `POST /api/v1/cases` has no role guard. Any authenticated user can create a case.
  - `content-monitoring.routes.ts:270` — `POST /api/v1/content/rules` (create monitoring rule) has no role guard. Any authenticated user can create monitoring rules.
  - `content-monitoring.routes.ts:301` — `DELETE /api/v1/content/rules/:id` has no role guard.
  - `content-monitoring.routes.ts:186` — `POST /api/v1/content/:id/transition` has no role guard.
  - `cdr.routes.ts:98` — `POST /api/v1/cdr/upload` has no role guard. Any authenticated user can upload CDR records.
  - `cdr.routes.ts:195` — `POST /api/v1/cdr/towers` has no role guard. Any authenticated user can create tower records.
  - `cdr.routes.ts:260` — `POST /api/v1/analysis-jobs` has no role guard.
  - `dossier.routes.ts:92` — `POST /api/v1/dossiers` has no role guard.
  - `dossier.routes.ts:131` — `POST /api/v1/dossiers/:id/assemble` has no role guard.
  - `drug-classify.routes.ts:8` — `POST /api/v1/drug-classify/:entityType/:entityId` has no role guard.
  - `drug-classify.routes.ts:76` — `PATCH /api/v1/drug-classify/:classificationId/review` has no role guard.
  - `classify.routes.ts:86` — `PATCH /api/v1/classify/:classificationId/override` has no role guard. Any authenticated user can override classifications.
  - `extract.routes.ts:8` — `POST /api/v1/extract/:entityType/:entityId` has no role guard.

---

## MEDIUM

- **`any` type casts suppressing type safety**
  - `content-monitoring.routes.ts:58` — `const inserted: any[] = []`
  - `content-monitoring.routes.ts:160` — `.map(({ total_count, ...r }: any) => r)`
  - `dashboard.routes.ts:187` — `.map(({ total_count, ...r }: any) => r)`
  - `evidence.routes.ts:140` — `.map(({ total_count, ...r }: any) => r)`
  - `evidence.routes.ts:633` — `.map((r: any) => ...)`
  - `assertion-conflict.routes.ts:42` — `.map(({ total_count, ...r }: any) => r)`

- **Missing input validation on `entityType` param (no enum constraint)**
  - `classify.routes.ts:68` — `GET /api/v1/classify/:entityType/:entityId` — `entityType` has no `enum` constraint (unlike the POST which does).
  - `drug-classify.routes.ts:58` — `GET /api/v1/drug-classify/:entityType/:entityId` — `entityType` has no `enum`.
  - `extract.routes.ts:15` — `POST /api/v1/extract/:entityType/:entityId` — `entityType` has no `enum`. Code uses switch/default but sends 400 only after the switch; an attacker can probe entity types.
  - `extract.routes.ts:65` — `GET /api/v1/extract/:entityType/:entityId` — `entityType` has no `enum`.

- **Non-null assertion `!` on potentially undefined values**
  - `classify.routes.ts:111` — `userId!` — `userId` could be undefined if `authUser` is somehow incomplete.
  - `drug-classify.routes.ts:98` — `userId` checked with optional chain but used with `!` at line 104.

- **Missing pagination on list endpoints**
  - `cdr.routes.ts:187` — `GET /api/v1/cdr/towers` returns all towers with no pagination. Can cause memory issues with large datasets.
  - `early-warning.routes.ts:62` — `GET /api/v1/early-warning/spikes` has a limit but no offset parameter.
  - `early-warning.routes.ts:101` — `GET /api/v1/early-warning/nps` has no pagination at all.

- **Dashboard query not scoped to unit**
  - `dashboard.routes.ts:141` — `GET /api/v1/dashboard/control-room` query does not filter by `unit_id`. Returns alerts across all units to any user with dashboard access.
  - `dashboard.routes.ts:198` — `GET /api/v1/dashboard/analytics` queries are not scoped to the user's unit.
  - `dashboard.routes.ts:328` — `GET /api/v1/dashboard/trends` not scoped to unit.
  - `dashboard.routes.ts:375` — `GET /api/v1/dashboard/pendency` not scoped to unit.
  - `dashboard.routes.ts:422` — `GET /api/v1/dashboard/geo` not scoped to unit.
  - `dashboard.routes.ts:464` — `GET /api/v1/dashboard/heatmap` not scoped to unit.

- **Scheduled reports endpoint missing try/catch**
  - `dashboard.routes.ts:70` — `GET /api/v1/reports/scheduled` has no try/catch.
  - `dashboard.routes.ts:78` — `POST /api/v1/reports/scheduled` has no try/catch.
  - `dashboard.routes.ts:108` — `PATCH /api/v1/reports/scheduled/:reportId` has no try/catch.

- **Missing `additionalProperties: false` on param schemas**
  - `assertion.routes.ts:22` — params schema missing `additionalProperties: false`.
  - `assertion.routes.ts:72` — params schema missing `additionalProperties: false`.
  - `assertion.routes.ts:103` — params schema missing `additionalProperties: false`.
  - `assertion.routes.ts:122` — params schema missing `additionalProperties: false`.
  - `assertion.routes.ts:204` — params schema missing `additionalProperties: false`.
  - `assertion-conflict.routes.ts:12` — params schema missing `additionalProperties: false`.
  - `assertion-conflict.routes.ts:52` — params schema missing `additionalProperties: false`.
  - `entity.routes.ts:124` — params schema missing `additionalProperties: false`.

---

## LOW

- **Redundant validation after schema validation**
  - `admin.routes.ts:35` — Re-validates `justification.trim().length < 10` after Fastify schema already enforces `minLength: 10`.
  - `drug-classify.routes.ts:100` — Re-validates `reviewStatus` against allowed values after schema `enum` already enforces it.

- **Hardcoded dev secret in source code**
  - `auth.routes.ts:8` — `defaultDevSecret: "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"` is hardcoded. While production requires `JWT_SECRET` env var, the fallback is visible in source.

- **Unused import**
  - `drug-classify.routes.ts:3` — `query` is imported from `../db` but never used directly (delegated to service functions).

- **CDR bulk upload is O(N) queries per record**
  - `cdr.routes.ts:151-174` — Each CDR record issues up to 3 queries (2 tower lookups + 1 insert) sequentially. With `maxItems: 10000`, this could issue 30,000 queries in a single request, blocking the connection pool.

- **No LIMIT on suppression rule check**
  - `alert.routes.ts:167` — `GET` all active suppression rules into memory for pattern matching. No LIMIT clause; could be expensive with many rules.

- **Missing `format: "uuid"` on `graph/:entityId`**
  - `extract.routes.ts:90` — `entityId` param has `format: "uuid"` but the `depth` query param is not validated (no schema for querystring).

- **`GET` endpoint for export should use `POST`**
  - `dossier.routes.ts:172` — `GET /api/v1/dossiers/:id/export` triggers an export operation that has side effects (generating a file). Should be POST per REST conventions.

- **Inconsistent 404 response format**
  - `classify.routes.ts:77` — Uses `reply.code(404).send({ error: "NOT_FOUND" })` instead of the project's `send404()` helper.
  - `classify.routes.ts:112` — Same pattern.
  - `drug-classify.routes.ts:41` — Same pattern.
  - `drug-classify.routes.ts:105` — Same pattern.

---

## Notes

- **Auth middleware is global.** All routes (except `/health`, `/ready`, `/api/v1/auth/login`, `/api/v1/auth/logout`) require a valid JWT. The auth findings above are about *role-based* authorization, not authentication.
- **Fastify schema validation** provides a baseline of input validation. Most route files use JSON Schema with `additionalProperties: false`, which mitigates many injection vectors.
- **SQL queries use parameterized placeholders** (`$1`, `$2`, etc.) consistently. The only SQL injection risk is the template literal in `dashboard.routes.ts:408`.
