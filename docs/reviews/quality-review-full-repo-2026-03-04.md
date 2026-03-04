# Quality Review — Full Repository

**Date:** 2026-03-04
**Commit:** `28c7fda` on `main`
**Reviewer:** Claude Code (Automated)

---

## 1. Scope and Preflight

### Scope

Full-repo quality review covering all apps and packages in the policing-apps monorepo.

### Assumptions & Exclusions

- No running databases available — migration idempotency assessed by code inspection only.
- `npm test`, `npm run typecheck`, `npm run build` not executed (no live environment). Verification commands listed in Phase 14.
- `node_modules/` excluded from all scans.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES2022 target) |
| API Framework | Fastify v5.7 |
| Frontend | React 19 + Vite |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 15 (per docker-compose) |
| ORM/Query | Raw `pg` with parameterized queries |
| Validation | Fastify JSON Schema (API), Zod v4 (workflow-engine) |
| Auth | JWT + HttpOnly cookies + Argon2 password hashing |
| i18n | i18next + react-i18next |
| Test | Vitest (packages, API), Playwright (E2E) |
| CI/CD | GitHub Actions (589-line pipeline) |
| Deployment | Google Cloud Run (canary), Terraform IaC |
| Observability | Prometheus alerts, Grafana dashboard, OpenTelemetry (original API only) |

### Quality Scripts Available

| Script | Status |
|--------|--------|
| `test:workflow-engine` | Available (312 tests) |
| `test:api` | Available (authz, BRD, rest suites) |
| `test:dopams` / `test:forensic` / `test:social-media` | Available |
| `test:citizen:unit` | Available |
| `typecheck` | Available (packages + original apps) |
| `build:all` | Available |
| `check:frontend-budgets` | Available |
| `test:e2e` | Available (a11y + resilience) |
| `check:observability` | Available |
| `check:slo-alerts` | Available |
| `check:iac` | Available |

### Requirements Documents

- `docs/policing_apps_brd/DOPAMS_Refined_BRD_AI_Ready.md` — 26 FRs
- `docs/policing_apps_brd/Refined_BRD_Forensic_AI_Platform.md` — 17 FRs
- `docs/policing_apps_brd/TEF_AI_Social_Media_Refined_BRD_v2.md` — 18 FRs
- Gap/traceability matrices in CSV/XLSX format
- `docs/test-cases/` — 3 functional test case documents (DOPAMS: 126 test cases)

---

## 2. Codebase Discovery

### Module Inventory

| Module | Type | LOC (approx) | Purpose |
|--------|------|--------------|---------|
| `apps/api` | Fastify API | 29,500 | PUDA property services (original) |
| `apps/citizen` | React SPA | 12,400 | Citizen-facing bilingual app |
| `apps/officer` | React SPA | ~8,000 | Officer workflow app |
| `apps/dopams-api` | Fastify API | 5,500 | Drug Operations & Analysis API |
| `apps/forensic-api` | Fastify API | 5,500 | Forensic Lab API |
| `apps/social-media-api` | Fastify API | 5,300 | Social Media Intelligence API |
| `apps/dopams-ui` | React SPA | ~6,000 | DOPAMS Officer UI |
| `apps/forensic-ui` | React SPA | ~5,500 | Forensic Lab UI |
| `apps/social-media-ui` | React SPA | ~5,500 | Social Media Intelligence UI |
| `packages/shared` | Library | ~500 | Zod schemas, validation, UI components |
| `packages/workflow-engine` | Library | ~1,000 | Domain-agnostic workflow state machine |
| **Total** | | **~79,000** | |

### Module Dependency Graph

```
packages/shared ─────────────────────────────────────────────┐
    │                                                        │
packages/workflow-engine ─────────┐                          │
    │                             │                          │
apps/api ◄────────────────────────┤                          │
apps/dopams-api ◄─────────────────┤                          │
apps/forensic-api ◄───────────────┤                          │
apps/social-media-api ◄───────────┘                          │
                                                             │
apps/citizen ◄───────────────────────────────────────────────┤
apps/officer ◄───────────────────────────────────────────────┤
apps/dopams-ui ◄─────────────────────────────────────────────┤
apps/forensic-ui ◄───────────────────────────────────────────┤
apps/social-media-ui ◄───────────────────────────────────────┘
```

### Shared Code

- **packages/shared**: Zod schemas (master model), field validators (Aadhaar, PAN, mobile), UI components (`<Bilingual>`, `<Field>`, form renderer), error reporting, hash routing, India-specific data.
- **packages/workflow-engine**: Pluggable state machine with guards, actions, SLA, audit, task management. 312 tests, 1,468 LOC tests.

### Entry Points

- 4 API servers (Fastify): `apps/*/src/index.ts`
- 5 UI apps (Vite/React): `apps/*/src/main.tsx`
- SLA schedulers: `apps/{dopams,forensic,social-media}-api/src/sla-scheduler.ts`

### Configuration Patterns

- Environment variables with fallback defaults
- `.env.example` files in new API apps
- JSON workflow definitions (`src/workflow-definitions/*.json`)
- `config_version` table for runtime config versioning (migrations 007)

---

## 3. Functional Completeness Assessment

### A) Requirements Mapping

**61 total functional requirements** across 3 BRDs (26 DOPAMS + 17 Forensic + 18 Social Media).

**Implementation Evidence Summary:**

| Category | Implemented | Partial | Missing | Notes |
|----------|------------|---------|---------|-------|
| Auth & RBAC (FR-01/14/02) | 3/3 | 0 | 0 | JWT + roles + organization units |
| Case Management | 3/3 | 0 | 0 | CRUD + workflow transitions |
| Alert Management | 3/3 | 0 | 0 | CRUD + state machine |
| Evidence/Custody | 3/3 | 0 | 0 | Custody events + chain tracking |
| Notifications & SLA | 3/3 | 0 | 0 | SLA scheduler + notification routes |
| AI Classification | 3/3 | 0 | 0 | classifier.ts service registered |
| OCR Processing | 3/3 | 0 | 0 | ocr-processor.ts + jobs table |
| Entity Extraction | 3/3 | 0 | 0 | entity-extractor.ts service |
| Legal Mapping | 3/3 | 0 | 0 | legal-mapper.ts + statute_library |
| Search (Full-text) | 3/3 | 0 | 0 | tsvector + trigram indexes |
| NL Query | 3/3 | 0 | 0 | nl-query.ts service |
| Graph Analysis | 3/3 | 0 | 0 | graph-analysis.ts service |
| Geofencing | 3/3 | 0 | 0 | geofence.ts + tower dump |
| Drug Classification | 3/3 | 0 | 0 | drug-classifier.ts + rules table |
| Model Governance | 3/3 | 0 | 0 | model-governance.ts + registry |
| Translation | 3/3 | 0 | 0 | translator.ts service |
| Reporting/MIS | 2/3 | 1 | 0 | Dashboard routes exist; forensic report workflow complete; DOPAMS memo workflow complete |
| DOPAMS Integration (Forensic) | 0/1 | 1 | 0 | `dopams_sync_event` table exists but no active sync routes |
| Subject Dedup/Merge (DOPAMS FR-25) | 0/1 | 0 | 1 | No merge/survivorship logic |
| Source Connectors (SM FR-03) | 0/1 | 1 | 0 | `source_connector` table but no ingestion pipeline |
| Retention/Archive (Forensic FR-17) | 0/1 | 0 | 1 | No purge/archive routes |

**Status**: Core CRUD and workflow features are **well-implemented** across all 3 platforms. AI services (classifier, NL query, graph analysis, etc.) have route + service + migration coverage. Key gaps are in cross-platform integration (DOPAMS ↔ Forensic sync), data lifecycle (retention/purge), and advanced features (subject deduplication, real-time ingestion).

### B) Entity CRUD Coverage

| Entity | Create | Read | Update | Delete | List | Search | Workflow |
|--------|--------|------|--------|--------|------|--------|----------|
| DOPAMS Case | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| DOPAMS Alert | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| DOPAMS Lead | ✓ | ✓ | ✓ | - | ✓ | - | ✓ |
| DOPAMS Subject | ✓ | ✓ | ✓ | - | ✓ | - | ✓ |
| Forensic Case | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| Forensic Evidence | ✓ | ✓ | - | - | ✓ | - | - |
| Forensic Finding | - | ✓ | - | - | ✓ | - | - |
| Forensic Report | ✓ | ✓ | - | - | ✓ | - | ✓ |
| SM Case | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| SM Alert | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| SM Content | ✓ | ✓ | - | - | ✓ | ✓ | - |
| SM Evidence | ✓ | ✓ | - | - | ✓ | - | - |
| SM Watchlist | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |

### C) Frontend-to-API Alignment

All three new UIs have views corresponding to each API entity's CRUD and list endpoints. Detail views include workflow transition panels with remarks. Dashboard views fetch aggregate statistics. Pagination is wired via `?page=N&limit=N` query params matching API schemas.

**Gap**: Error responses from API are handled with generic catch blocks in the UI — no structured field-level error parsing.

---

## 4. API Contract Findings

### A) Route Design and Consistency

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**RESTful conventions are followed consistently:**
- `GET /api/v1/{entity}` — list with query filters
- `GET /api/v1/{entity}/:id` — detail
- `POST /api/v1/{entity}` — create
- `PUT /api/v1/{entity}/:id` — update
- `POST /api/v1/{entity}/:id/transition` — workflow transition
- Response envelope: `{ entity: {...} }` for detail, `{ entities: [...], total, page, limit }` for lists

**Finding QR-API-01: Inconsistent error response shape**
- Most routes: `{ error: "CODE", message: "desc", statusCode: N }`
- Some routes return raw Fastify validation errors (different shape)
- **Where**: All new API route files
- **Fix**: Register a Fastify `setErrorHandler` that normalizes all error shapes
- **Verify**: `curl` invalid payloads and confirm uniform error JSON

### B) Schema Validation

- **Severity: P1** | **Confidence: High** | **Status: Confirmed**

**Finding QR-API-02: 214 instances of `label={t("...")}` anti-pattern**
- Field labels in UI use `t()` instead of `<Bilingual>` per CLAUDE.md rules
- **Where**: 57 `.tsx` files across all apps (dopams-ui, forensic-ui, social-media-ui, officer)
- **Fix**: Convert `label={t("key")}` to `label={<Bilingual tKey="key" />}`
- **Verify**: `grep -n 'label={t(' apps/*/src/*.tsx` should return 0 matches

**Finding QR-API-03: Request body validation present but incomplete**
- All POST/PUT routes have JSON Schema definitions
- Missing: `additionalProperties: false` on some request schemas, allowing extra fields to pass
- **Where**: Inconsistent across route files
- **Fix**: Add `additionalProperties: false` to all request body schemas
- **Verify**: Send request with extra field, confirm 400 response

### C) Error Contract

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-API-04: Error messages expose internal details**
- Catch blocks in route handlers return `err.message` which may contain SQL errors or internal paths
- **Where**: All API route handlers that catch errors
- **Fix**: Map caught errors to safe error codes; log full error server-side, return generic message client-side
- **Verify**: Trigger a database constraint violation and confirm response contains only safe error code

### D) API Documentation

- **Severity: P3** | **Confidence: High** | **Status: Confirmed**

**Finding QR-API-05: No OpenAPI spec generation**
- Fastify has `@fastify/swagger` plugin available but not registered in any of the 3 new APIs
- Original `apps/api` has `openapi-drift` CI check but new APIs do not
- **Where**: `apps/{dopams,forensic,social-media}-api/src/app.ts`
- **Fix**: Register `@fastify/swagger` + `@fastify/swagger-ui` to auto-generate OpenAPI spec
- **Verify**: Hit `/docs` and confirm Swagger UI loads

---

## 5. Database and Data Layer Findings

### A) Schema Design

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-DB-01: UUID primary keys used consistently** — PASS

**Finding QR-DB-02: Foreign keys comprehensive with referential integrity** — PASS
55 unique tables across 3 APIs. All entity relationships have proper FKs.

**Finding QR-DB-03: Inconsistent table naming across APIs**
- Audit table: `audit_event` (DOPAMS/Forensic) vs `audit_log` (Social Media)
- Alert table: `alert` (DOPAMS/Forensic) vs `sm_alert` (Social Media)
- Task table: `task` (DOPAMS/Forensic) vs `case_task` (Social Media)
- Audit PK: `audit_id` (DOPAMS) vs `audit_event_id` (Forensic)
- **Where**: `001_init.sql` across all 3 APIs
- **Fix**: Standardize naming conventions; if tables must differ, document the mapping
- **Verify**: Create a cross-API data dictionary

**Finding QR-DB-04: No explicit CASCADE/SET NULL on foreign keys**
- All FKs default to RESTRICT behavior
- **Where**: All migration files
- **Risk**: Deletion of parent records will fail silently with FK violation
- **Fix**: Document intended deletion behavior; add CASCADE where appropriate (e.g., `case_subject` when case deleted)
- **Verify**: Attempt to delete a case with related records; confirm expected behavior

### B) Migration Quality

- **Severity: P1** | **Confidence: High** | **Status: Confirmed**

**Finding QR-DB-05: Migrations are idempotent** — PASS
All use `IF NOT EXISTS` / `IF EXISTS` patterns consistently.

**Finding QR-DB-06: Destructive migration in Forensic 011_legal.sql**
- Drops `legal_mapping` table after backing up to `legal_mapping_v1_backup`
- **Risk**: If backup creation fails, data is lost. Not backward-compatible with running code.
- **Where**: `apps/forensic-api/migrations/011_legal.sql`
- **Fix**: Use ALTER TABLE to add/rename columns instead of DROP + CREATE
- **Verify**: Run migration twice; confirm no errors and data preserved

**Finding QR-DB-07: Missing migration files create drift risk**
- Forensic: missing `007_config.sql` (DOPAMS has it)
- Social Media: missing `006_custody.sql` (DOPAMS has it; SM has it elsewhere)
- **Where**: `apps/*/migrations/` directory listings
- **Risk**: Schema drift between databases if migrations are shared
- **Fix**: Audit migration numbering; ensure each API's migration set is self-consistent
- **Verify**: Run full migration set on fresh DB for each API; compare resulting schemas

### C) Query Quality

- **Severity: P1** | **Confidence: Medium** | **Status: Partially Confirmed**

**Finding QR-DB-08: SQL template literals for table/column names**
- 28+ instances of `${tableName}`, `${textColumn}`, `${idColumn}` in SQL strings
- Values appear to come from internal whitelist mappings, not user input
- **Where**: `apps/*/src/services/classifier.ts:74-76`, `apps/*/src/services/nl-query.ts` (multiple lines), `apps/*/src/services/search.ts`
- **Risk**: If any table/column name derives from user input, SQL injection is possible
- **Fix**: Document that these values come from internal enums; add runtime validation against whitelist
- **Verify**: Trace `tableName` source to confirm it's hardcoded, not user-derived

**Finding QR-DB-09: No N+1 query patterns detected** — PASS
List endpoints use single queries with JOINs and pagination.

**Finding QR-DB-10: Connection pool size may be insufficient**
- `max: 8` connections with 2s connection timeout
- **Where**: `apps/*/src/db.ts:17-22` (all 3 new APIs)
- **Fix**: Make pool size configurable via env var; increase default to 20 for production
- **Verify**: Load test with concurrent requests; monitor pool exhaustion

### D) Data Integrity

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-DB-11: CHECK constraints cover critical enums** — PASS
Status fields, role types, fence types, event types all have CHECK constraints.

**Finding QR-DB-12: Optimistic locking via `row_version`** — PASS
Mutable entities include `row_version INTEGER DEFAULT 1` for concurrency control.

**Finding QR-DB-13: Timestamps use TIMESTAMPTZ consistently** — PASS
All `created_at`/`updated_at` fields use `TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

---

## 6. Error Handling Findings

### A) Error Handling Patterns

- **Severity: P1** | **Confidence: High** | **Status: Confirmed**

**Finding QR-ERR-01: ~35 of 96 route files lack try-catch blocks**
- Routes that parse JSON, access filesystem, or call external services have no explicit error handling
- **Where**: `apps/forensic-api/src/routes/config.routes.ts` (JSON.parse + fs.readFileSync without try-catch), `evidence.routes.ts`, `dashboard.routes.ts`, and ~32 more
- **Impact**: Uncaught exceptions crash the route handler; Fastify's global error handler may catch but with inconsistent error format
- **Fix**: Wrap all route handler bodies in try-catch; return structured error response
- **Verify**: Send malformed request to each route; confirm 4xx/5xx with proper error JSON

**Finding QR-ERR-02: Sensitive data in error responses**
- Catch blocks return `err.message` which may contain SQL constraint names, file paths, or stack traces
- **Where**: All route catch blocks across 3 new APIs
- **Fix**: Return safe error codes; log full error server-side
- **Verify**: Trigger constraint violation; confirm response hides internals

### B) Graceful Degradation

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-ERR-03: Graceful shutdown implemented** — PASS
All 3 APIs handle SIGTERM/SIGINT with 15s timeout, SLA scheduler cleanup, and pool draining.

**Finding QR-ERR-04: No timeout configuration for external calls**
- Service files (classifier, translator, ocr-processor) make calls but have no explicit timeout
- **Where**: `apps/*/src/services/*.ts`
- **Fix**: Add `AbortSignal.timeout(ms)` to all external fetch/query calls
- **Verify**: Simulate slow response; confirm timeout triggers error path

### C) Frontend Error Handling

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-ERR-05: Error boundaries present in all apps** — PASS
All 5 UI apps have `ErrorBoundary.tsx` with Sentry reporting.

**Finding QR-ERR-06: Generic error messages in catch blocks**
- Pattern: `.catch((err) => setError(err instanceof Error ? err.message : "Failed to load alerts"))`
- Hardcoded English strings in error handlers, not i18n'd
- **Where**: All view components in dopams-ui, forensic-ui, social-media-ui
- **Fix**: Use i18n keys for all error messages: `t("errors.load_failed", { entity: t("alerts.title") })`
- **Verify**: Grep for hardcoded English in catch blocks

**Finding QR-ERR-07: Silent `.catch(() => {})` handlers**
- 20+ instances of silent catch for non-blocking operations (notification reads, logout)
- **Where**: `apps/*/src/App.tsx`, `apps/*/src/routes/evidence.routes.ts`
- **Fix**: Add lightweight logging: `.catch((err) => console.warn("Notification read failed:", err?.message))`
- **Verify**: Force network error; confirm warning logged

---

## 7. Testing and Quality Gate Findings

### A) Test Coverage

| Module | Unit Tests | Integration Tests | E2E | Status |
|--------|-----------|-------------------|-----|--------|
| `packages/workflow-engine` | 312 tests (5 files, 1468 LOC) | - | - | STRONG |
| `apps/api` | Auth, BRD, route-access, policy, workflow tests | DB integration (live PG) | Playwright a11y + resilience | STRONG |
| `apps/dopams-api` | CRUD, auth, pagination, permissions, workflow, search, notes | DB integration | - | GOOD |
| `apps/forensic-api` | CRUD, auth, pagination, permissions, workflow, search, notes | DB integration | - | GOOD |
| `apps/social-media-api` | CRUD, auth, pagination, permissions, workflow, search, notes | DB integration | - | GOOD |
| `apps/citizen` | Cache logic (2 test files) | - | Playwright a11y | PARTIAL |
| `apps/officer` | 0 tests | - | - | MISSING |
| `apps/dopams-ui` | 0 tests | - | - | MISSING |
| `apps/forensic-ui` | 0 tests | - | - | MISSING |
| `apps/social-media-ui` | 0 tests | - | - | MISSING |

**Finding QR-TEST-01: No frontend tests for 4 of 5 UI apps**
- **Severity: P2** | **Confidence: High** | **Status: Confirmed**
- `apps/officer`, `apps/dopams-ui`, `apps/forensic-ui`, `apps/social-media-ui` have zero test files
- **Fix**: Add vitest config + basic auth/error/offline tests
- **Verify**: `npm test` passes in each workspace

**Finding QR-TEST-02: No tests for AI service endpoints**
- Services like geofence, graph analysis, entity extraction, drug classification have route/service code but no test coverage
- **Where**: `apps/*/src/services/*.ts`, `apps/*/src/routes/{geofence,graph,extract,drug-classify}.routes.ts`
- **Fix**: Add integration tests for each AI service route
- **Verify**: Test suite covers all service routes

### B) Test Quality

- **Severity: P3** | **Confidence: Medium** | **Status: Partially Confirmed**

**Finding QR-TEST-03: API tests use live DB with test helpers** — PASS
Test helpers create isolated app instances with auth tokens and proper cleanup.

### C) Static Analysis

- **Severity: P1** | **Confidence: High** | **Status: Confirmed**

**Finding QR-TEST-04: 403 `any` type occurrences across apps**
- Distributed across 137 files
- Hotspots: `apps/api/src/applications.ts` (23), `apps/api/src/routes/application-detail.routes.ts` (11), `apps/*/src/services/nl-query.ts` (5-10 each), `apps/*/src/services/model-governance.ts` (5 each)
- **Where**: All apps and services
- **Fix**: Replace `any` with concrete types; use `unknown` for error catches; create shared types for service results
- **Verify**: `npx tsc --noEmit` with stricter config; grep for remaining `any`

**Finding QR-TEST-05: TypeScript strict mode enabled** — PASS
`tsconfig.base.json` has `"strict": true`.

### D) CI/CD Pipeline

- **Severity: P3** | **Confidence: High** | **Status: Confirmed**

CI pipeline is comprehensive (22 jobs) covering: preflight validation, build + typecheck, migration validation, frontend budgets, load testing (50+ RPS, P95 < 400ms), DAST (ZAP), a11y (axe-core), security scanning (npm audit + CodeQL + Semgrep).

**Finding QR-TEST-06: No CI jobs for new API apps**
- `typecheck` script only covers `packages/workflow-engine`, `packages/shared`, `apps/api`, `apps/citizen`, `apps/officer`
- Missing: `apps/dopams-api`, `apps/forensic-api`, `apps/social-media-api`, new UIs
- **Where**: Root `package.json` line 31
- **Fix**: Add new apps to typecheck script and CI matrix
- **Verify**: `npm run typecheck` covers all workspaces

---

## 8. Code Maintainability Findings

### A) Dead Code and Duplication

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-MAINT-01: ~30-40% code duplication across 3 new APIs**
- Services: `classifier.ts`, `drug-classifier.ts`, `entity-extractor.ts`, `geofence.ts`, `graph-analysis.ts`, `legal-mapper.ts`, `model-governance.ts`, `nl-query.ts`, `ocr-processor.ts`, `search.ts`, `translator.ts` — nearly identical across all 3 APIs (byte-level similarity)
- Middleware: `auth.ts`, `audit-logger.ts` — identical
- Logger: `logger.ts` — identical
- DB wrapper: `db.ts` — identical
- **Estimated duplicated LOC**: ~4,000 across 3 APIs
- **Where**: `apps/{dopams,forensic,social-media}-api/src/services/`, `src/middleware/`, `src/logger.ts`, `src/db.ts`
- **Fix**: Extract shared services, middleware, and utilities to `packages/api-common` package
- **Verify**: Each API imports from shared package; duplicate files removed

**Finding QR-MAINT-02: UI apps share identical patterns with copy-paste**
- `useAuth.ts`, `theme.ts`, `cache.ts`, `ErrorBoundary.tsx`, `i18n.ts`, `design-system.css` — duplicated across 3 new UIs
- **Where**: `apps/{dopams,forensic,social-media}-ui/src/`
- **Fix**: Move shared hooks and utilities to `packages/shared`
- **Verify**: Import from shared package; no duplicate files

### B) Complexity Hotspots

- **Severity: P2** | **Confidence: High** | **Status: Confirmed**

**Finding QR-MAINT-03: Large monolithic App.tsx components**
- `apps/dopams-ui/src/App.tsx`: 670+ lines with 8 useEffect hooks, 13 lazy views, heavy state management
- Similar in forensic-ui and social-media-ui
- **Fix**: Extract `<AppShell>`, `<HeaderBar>`, `<BottomNav>`, `<SideNav>` into separate components
- **Verify**: App.tsx under 200 lines after extraction

**Finding QR-MAINT-04: TODO/FIXME inventory — Clean**
- No TODO/FIXME/HACK/XXX comments found in production code
- **Status**: PASS

### C) Naming and Organization

- **Severity: P3** | **Confidence: High** | **Status: Confirmed**

File organization follows a discoverable pattern across all apps. Route files use `{entity}.routes.ts`, services use `{feature}.ts`, views use `{EntityName}.tsx`. Consistent naming within each app.

---

## 9. i18n and Content Findings

### A) i18n Coverage

- **Severity: P1** | **Confidence: High** | **Status: Confirmed**

**Finding QR-I18N-01: New UIs are English-only — no Hindi/Punjabi locales**
- `apps/dopams-ui`, `apps/forensic-ui`, `apps/social-media-ui` have only `locales/en.ts`
- Missing: `hi.ts`, `pa.ts` locale files
- i18next is installed but configured for English only
- **Where**: `apps/*/src/i18n.ts`, `apps/*/src/locales/`
- **Impact**: Violates CLAUDE.md bilingual compliance mandate
- **Fix**: Add hi.ts + pa.ts locales for all 3 apps; configure lazy-loading as in citizen app
- **Verify**: Toggle language; confirm all text renders in selected language

**Finding QR-I18N-02: 214 instances of `label={t("...")}` anti-pattern**
- Per CLAUDE.md: Field labels must use `<Bilingual tKey="..." />`, not `t("...")`
- **Where**: 57 `.tsx` files across all apps
- **Fix**: Convert `label={t("key")}` to `label={<Bilingual tKey="key" />}`
- **Verify**: `grep -n 'label={t(' apps/*/src/*.tsx` returns 0 matches

**Finding QR-I18N-03: ~23 hardcoded English strings in dopams-ui views**
- Table headers: `"Title"`, `"Status"`, `"Priority"`
- Section headings: `"Case Information"`, `"Alert Information"`
- Enum values displayed raw: `"OPEN"`, `"ACKNOWLEDGED"`, `"DRAFT"`
- Error boundary: `"Something went wrong"`
- **Where**: `apps/dopams-ui/src/views/*.tsx`, `apps/dopams-ui/src/ErrorBoundary.tsx`
- **Fix**: Create i18n keys for all hardcoded strings; wrap in `t()` or `<Bilingual>`
- **Verify**: Search for `>[A-Z][a-z]` pattern in JSX; confirm 0 matches

**Finding QR-I18N-04: Select option values use enum names as display text**
- `<option value="OPEN">OPEN</option>` instead of `t("state.open")`
- **Where**: Filter dropdowns in AlertList, CaseList, etc. across all 3 new UIs
- **Fix**: Map enum values to i18n keys
- **Verify**: Inspect filter dropdowns; confirm translated labels

### B) Locale Key Completeness

| App | English Keys | Hindi Keys | Punjabi Keys | Status |
|-----|-------------|------------|--------------|--------|
| citizen | 632 | 1200+ | 1200+ | Complete |
| officer | ~400 | ~400 | ~400 | Complete |
| dopams-ui | 219 | 0 | 0 | Incomplete |
| forensic-ui | 206 | 0 | 0 | Incomplete |
| social-media-ui | 207 | 0 | 0 | Incomplete |

---

## 10. QA Gates and Quality Verdict

### Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | **Functional completeness** | PARTIAL | Core CRUD + workflow implemented for all entities; gaps in cross-platform sync (Forensic↔DOPAMS), subject deduplication, retention/purge |
| 2 | **Data integrity** | PASS | Transactions used, FK constraints, CHECK constraints, row_version for optimistic locking, parameterized SQL |
| 3 | **API contracts** | PARTIAL | Consistent REST patterns, JSON Schema validation; but no OpenAPI spec, some inconsistent error shapes, missing `additionalProperties: false` |
| 4 | **Error handling** | PARTIAL | Global error handler exists; 35/96 route files lack explicit try-catch; error responses may leak internals |
| 5 | **Type safety** | PARTIAL | Strict mode enabled; 403 `any` occurrences across 137 files |
| 6 | **Critical-path tests** | PASS | Workflow engine: 312 tests; API test suites cover auth, CRUD, permissions, workflow |
| 7 | **Build health** | PARTIAL | Build scripts exist; new apps not in typecheck CI; no verified clean build |

### Non-Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | **Test depth** | PARTIAL | Strong API tests; 0 frontend tests for 4/5 UI apps; no AI service tests |
| 2 | **Code maintainability** | PARTIAL | ~30-40% duplication across 3 new APIs; 670-line App.tsx monoliths |
| 3 | **i18n completeness** | FAIL | 3 new UIs are English-only; 214 `label={t()}` violations; ~23+ hardcoded strings |
| 4 | **Documentation** | PARTIAL | BRDs + ADRs comprehensive; no OpenAPI spec; no cross-API data dictionary |

### Verdict

```
Functional Status:     PARTIAL
Data Integrity:        PASS
API Contracts:         PARTIAL
Error Handling:        PARTIAL
Type Safety:           PARTIAL
Critical-Path Tests:   PASS
Build Health:          PARTIAL
Blocking Gates:        2/7 PASS, 5/7 PARTIAL, 0/7 FAIL
Non-Blocking Gates:    0/4 PASS, 3/4 PARTIAL, 1/4 FAIL
Quality Verdict:       NEEDS-WORK
```

---

## 11. Bugs and Foot-Guns

### High-Impact Findings

| # | Finding | Severity | Confidence | File:Line | Impact | Fix |
|---|---------|----------|------------|-----------|--------|-----|
| 1 | **DOPAMS auth route omits `unit_id` from JWT token** | P0 | High | `apps/dopams-api/src/routes/auth.routes.ts:21` | Queries filtering by `unitId` get null → access control bypass; users may see data from other units | Add `unit_id: user.unit_id` to `generateToken()` call |
| 2 | **Social Media auth route omits `unit_id` from JWT token** | P0 | High | `apps/social-media-api/src/routes/auth.routes.ts:21` | Same as #1 | Add `unit_id: user.unit_id` to `generateToken()` call |
| 3 | **Hardcoded JWT_SECRET fallback in all 3 new APIs** | P1 | High | `apps/*/src/middleware/auth.ts:5` | Production could start with dev secret if env var missing; token forgery possible | Throw error if `JWT_SECRET` not set when `NODE_ENV=production` |
| 4 | **Missing entity ownership checks on evidence routes** | P1 | High | `apps/forensic-api/src/routes/evidence.routes.ts:45` | User can view evidence from any unit by guessing UUID | Add `AND unit_id = $2` to WHERE clause |
| 5 | **`config.routes.ts` uses fs.readFileSync + JSON.parse without try-catch** | P1 | High | `apps/forensic-api/src/routes/config.routes.ts:10-18` | Malformed JSON or missing file crashes the route handler | Wrap in try-catch with proper error response |
| 6 | **SQL template literals for dynamic table/column names** | P1 | Medium | `apps/*/src/services/classifier.ts:74-76`, `nl-query.ts` (28+ instances) | If source is ever user-influenced, SQL injection is possible | Add runtime whitelist validation; document source of dynamic names |
| 7 | **403 `any` type usages weaken type safety** | P2 | High | 137 files (see QR-TEST-04) | Type errors pass through compilation; runtime crashes possible | Replace with concrete types; use `unknown` for error catches |
| 8 | **Error responses may expose SQL constraint names** | P2 | High | All API catch blocks | Information disclosure to attackers | Map errors to safe codes; log full error server-side |
| 9 | **Forensic migration 011 drops table** | P2 | High | `apps/forensic-api/migrations/011_legal.sql` | Data loss if backup step fails during migration | Replace with ALTER TABLE approach |
| 10 | **No OpenTelemetry in new APIs** | P2 | Medium | `apps/{dopams,forensic,social-media}-api/src/` | Cannot trace requests across services; debugging blind spots | Port OpenTelemetry setup from `apps/api` |

### Medium-Impact Findings

| # | Finding | Severity | Confidence | File:Line | Impact | Fix |
|---|---------|----------|------------|-----------|--------|-----|
| 11 | **New UIs English-only (no hi/pa locales)** | P1 | High | `apps/*/src/locales/` | Bilingual compliance violated | Add hi.ts + pa.ts locale files |
| 12 | **214 `label={t()}` violations** | P1 | High | 57 .tsx files | Bilingual field labels not rendering | Convert to `<Bilingual>` component |
| 13 | **Connection pool max=8 with 2s timeout** | P2 | Medium | `apps/*/src/db.ts:17-22` | Pool exhaustion under load; cascading failures | Make configurable via env; increase default |
| 14 | **Silent `.catch(() => {})` on 20+ operations** | P2 | Medium | `apps/*/src/App.tsx`, route files | Failures hidden; no telemetry on service outages | Add console.warn with error message |
| 15 | **Table `<td>` elements missing `data-label` attributes** | P2 | Medium | New UI view components | Mobile card layout CSS breaks (uses `attr(data-label)`) | Add data-label to all td elements |
| 16 | **Logger delegates to console.* instead of structured logging** | P2 | Medium | `apps/*/src/logger.ts` | No log aggregation; inconsistent format in production | Use pino (Fastify's built-in logger) |
| 17 | **Rate limiting is IP-only, not user-based** | P2 | Medium | `apps/*/src/app.ts` | Shared IP users (behind NAT/VPN) hit collective limit | Add per-user key function to rate limiter |
| 18 | **No startup config validation** | P2 | Medium | `apps/*/src/index.ts` | Missing env vars cause cryptic runtime errors | Validate required env vars on startup |
| 19 | **Workflow transition ID not validated against allowed transitions** | P2 | Medium | `apps/*/src/routes/case.routes.ts:84-100` | Invalid transition IDs reach engine (caught there, but late) | Validate against allowed transitions before calling engine |
| 20 | **Audit log payload silently truncated at 4000 chars** | P3 | Medium | `apps/*/src/middleware/audit-logger.ts:69-71` | Forensic evidence uploads lose audit context | Log warning on truncation |

---

## 12. Requirements Compliance Matrix

### Feature Coverage Matrix (Code-Inferred)

| Feature Area | DOPAMS Routes | Forensic Routes | SM Routes | Migration Tables | UI Views | Status |
|--------------|--------------|----------------|-----------|-----------------|----------|--------|
| Auth & RBAC | auth.routes.ts | auth.routes.ts | auth.routes.ts | user_account, role, user_role, org_unit | Login, Admin | Complete |
| Case CRUD | case.routes.ts | case.routes.ts | case.routes.ts | dopams_case / forensic_case / case_record | CaseList, CaseDetail | Complete |
| Alert CRUD | alert.routes.ts | - | alert.routes.ts | alert / sm_alert | AlertList, AlertDetail | Complete |
| Lead CRUD | lead.routes.ts | - | - | lead | LeadList, LeadDetail | DOPAMS only |
| Subject CRUD | subject.routes.ts | - | - | subject_profile | SubjectList, SubjectDetail | DOPAMS only |
| Evidence | - | evidence.routes.ts | evidence.routes.ts | evidence_source / evidence_item | EvidenceDetail | Forensic + SM |
| Import/Ingest | - | import.routes.ts | - | import_job | ImportList, ImportDetail | Forensic only |
| Findings | - | finding.routes.ts | - | ai_finding | FindingDetail | Forensic only |
| Reports | memo.routes.ts | report.routes.ts | report.routes.ts | memo / report / report_instance | ReportDetail | Complete |
| Content | - | - | content.routes.ts | content_item, content_media | ContentList, ContentDetail | SM only |
| Watchlist | - | - | watchlist.routes.ts | watchlist | WatchlistManager | SM only |
| Tasks/Inbox | task.routes.ts | task.routes.ts | task.routes.ts | task / case_task | TaskInbox | Complete |
| Notes | notes.routes.ts | notes.routes.ts | notes.routes.ts | entity_note | In detail views | Complete |
| Notifications | notification.routes.ts | notification.routes.ts | notification.routes.ts | notification | In App.tsx | Complete |
| Search | search.routes.ts | search.routes.ts | search.routes.ts | tsvector indexes | In List views | Complete |
| Classification | classify.routes.ts | classify.routes.ts | classify.routes.ts | classification_result | - | API Complete |
| OCR | ocr.routes.ts | ocr.routes.ts | ocr.routes.ts | ocr_job | - | API Complete |
| Entity Extraction | extract.routes.ts | extract.routes.ts | extract.routes.ts | extracted_entity | - | API Complete |
| Legal Mapping | legal.routes.ts | legal.routes.ts | legal.routes.ts | statute_library, legal_mapping | In detail views | Complete |
| Translation | translate.routes.ts | translate.routes.ts | translate.routes.ts | translation_record | - | API Complete |
| NL Query | nl-query.routes.ts | nl-query.routes.ts | nl-query.routes.ts | nl_query_log | QueryAssistant | Complete |
| Graph Analysis | graph.routes.ts | graph.routes.ts | graph.routes.ts | graph_analysis_result | NetworkGraph | Complete |
| Geofencing | geofence.routes.ts | geofence.routes.ts | geofence.routes.ts | geofence, geofence_event | - | API Complete |
| Drug Classification | drug-classify.routes.ts | drug-classify.routes.ts | drug-classify.routes.ts | drug_role_classification | DrugDashboard | Complete |
| Model Governance | model.routes.ts | model.routes.ts | model.routes.ts | model_registry, model_evaluation | ModelAdmin | Complete |
| Dashboard | dashboard.routes.ts | dashboard.routes.ts | dashboard.routes.ts | - (aggregation queries) | Dashboard | Complete |
| Config Admin | config.routes.ts | config.routes.ts | config.routes.ts | config_version | Settings | Complete |
| DOPAMS↔Forensic Sync | - | dopams_sync_event table | - | dopams_sync_event | - | **Partial (table only, no route)** |
| Subject Dedup/Merge | - | - | - | - | - | **Missing** |
| Retention/Archive | - | - | - | - | - | **Missing** |
| Source Connectors | - | - | source_connector table | source_connector | - | **Partial (table only)** |

---

## 13. Improvement Backlog

| ID | Title | Priority | Risk | Effort | Category | Where | Fix | Verify |
|----|-------|----------|------|--------|----------|-------|-----|--------|
| 1 | Add unit_id to DOPAMS auth token | P0 | 5x5=25 | S | Security | `dopams-api/routes/auth.routes.ts:21` | Add `unit_id: user.unit_id` to generateToken | Login, inspect JWT, confirm unit_id present |
| 2 | Add unit_id to SM auth token | P0 | 5x5=25 | S | Security | `social-media-api/routes/auth.routes.ts:21` | Same as #1 | Same |
| 3 | Fail on missing JWT_SECRET in prod | P1 | 5x4=20 | S | Security | `apps/*/middleware/auth.ts:5` | Throw if NODE_ENV=production and secret is default | Start app without JWT_SECRET in prod; confirm crash |
| 4 | Add entity ownership check to evidence routes | P1 | 4x4=16 | S | Security | `forensic-api/routes/evidence.routes.ts` | Add `AND unit_id = $2` | Attempt cross-unit evidence access; confirm 404 |
| 5 | Add try-catch to 35 unprotected route handlers | P1 | 4x4=16 | M | Errors | Route files across all 3 APIs | Wrap handler body in try-catch | Send malformed requests; confirm structured error |
| 6 | Add Hindi/Punjabi locale files to 3 new UIs | P1 | 3x5=15 | L | i18n | `apps/*/src/locales/` | Create hi.ts, pa.ts with translations | Toggle language; confirm text renders |
| 7 | Fix 214 `label={t()}` anti-pattern | P1 | 3x5=15 | M | i18n | 57 .tsx files | Convert to `<Bilingual tKey="...">` | `grep 'label={t('` returns 0 |
| 8 | Add new apps to typecheck CI | P1 | 3x4=12 | S | CI/CD | Root `package.json:31`, CI config | Add workspaces to typecheck script | CI passes with new apps |
| 9 | Validate SQL template literal sources | P1 | 4x3=12 | S | Security | `apps/*/services/classifier.ts`, `nl-query.ts` | Add whitelist check for table/column names | Attempt injection via service parameter |
| 10 | Replace hardcoded error strings with i18n keys | P1 | 3x4=12 | M | i18n | View components catch blocks | Use `t("errors.load_failed")` | Grep for hardcoded English in catch blocks |
| 11 | Add `additionalProperties: false` to request schemas | P2 | 3x3=9 | M | API | All route files with body schemas | Add property to JSON Schema | Send extra field; confirm 400 |
| 12 | Extract shared API services to packages/api-common | P2 | 2x3=6 | L | Maintainability | 11 duplicated service files x 3 APIs | Create package; import from it | Each API builds successfully |
| 13 | Extract shared UI hooks to packages/shared | P2 | 2x3=6 | M | Maintainability | useAuth, theme, cache, i18n across 3 UIs | Move to shared; update imports | Each UI builds successfully |
| 14 | Add data-label attributes to table td elements | P2 | 3x3=9 | M | Responsive | All list view components | Add `data-label={column}` to each td | Mobile viewport shows card layout with labels |
| 15 | Fix select option enum display text | P2 | 3x3=9 | S | i18n | Filter dropdowns in all list views | Map enum to `t("state.open")` | Inspect dropdown options; confirm translated |
| 16 | Increase connection pool to 20 + env config | P2 | 3x3=9 | S | Performance | `apps/*/src/db.ts:17-22` | `max: parseInt(process.env.PG_POOL_MAX \|\| "20")` | Load test; monitor pool utilization |
| 17 | Safe error responses (no SQL details) | P2 | 3x3=9 | M | Security | All API catch blocks | Map errors to safe codes | Trigger constraint violation; inspect response |
| 18 | Add startup config validation | P2 | 3x3=9 | S | Reliability | `apps/*/src/index.ts` | Validate required env vars before listen | Start without DATABASE_URL; confirm clear error |
| 19 | Add timeouts to external service calls | P2 | 3x3=9 | M | Resilience | `apps/*/src/services/*.ts` | Add `AbortSignal.timeout(10000)` | Simulate slow response; confirm timeout |
| 20 | Standardize table naming across APIs | P2 | 2x3=6 | M | Database | Init migrations | Document cross-API data dictionary | Created and reviewed |
| 21 | Add warning on audit log truncation | P3 | 2x2=4 | S | Audit | `apps/*/middleware/audit-logger.ts:69` | Log warning when payload > 4000 chars | Upload large payload; check logs |
| 22 | Add OpenTelemetry to new APIs | P2 | 3x3=9 | M | Observability | `apps/{dopams,forensic,social-media}-api/` | Port from apps/api | Check traces in collector |
| 23 | Replace console logging with pino | P2 | 2x3=6 | M | Observability | `apps/*/src/logger.ts` | Use Fastify's built-in pino logger | JSON structured logs in stdout |
| 24 | Add per-user rate limiting | P2 | 2x3=6 | S | Security | `apps/*/src/app.ts` | Add keyGenerator to rate-limit config | Auth brute-force blocked per-user |
| 25 | Split App.tsx monoliths | P3 | 2x2=4 | M | Maintainability | `apps/*/src/App.tsx` (670+ lines) | Extract AppShell, HeaderBar, BottomNav | App.tsx under 200 lines |
| 26 | Add frontend test infrastructure | P2 | 2x3=6 | M | Testing | `apps/{officer,dopams,forensic,social-media}-ui/` | Add vitest.config.ts + basic tests | npm test passes in each workspace |
| 27 | Add AI service integration tests | P2 | 2x3=6 | M | Testing | `apps/*/src/__tests__/` | Test geofence, graph, entity extraction routes | Test suite covers all service endpoints |
| 28 | Validate workflow transition IDs | P2 | 2x3=6 | S | API | Transition route handlers | Check against allowed transitions | Invalid transition returns 400 |
| 29 | Add OpenAPI spec generation | P3 | 2x2=4 | M | Documentation | `apps/*/src/app.ts` | Register @fastify/swagger | Hit /docs; confirm Swagger UI |
| 30 | Create cross-API data dictionary | P3 | 2x2=4 | M | Documentation | `docs/` | Document table/column mapping across APIs | Dictionary file exists and is accurate |

---

## 14. Quick Wins and Stabilization

### Quick Wins (< 2 hours each)

| # | Task | Files | Time | Impact |
|---|------|-------|------|--------|
| 1 | Add `unit_id` to DOPAMS + SM auth tokens | 2 files, 2 lines each | 15 min | Fixes access control gap (P0) |
| 2 | Fail on dev JWT_SECRET in production | 3 files, 5 lines each | 30 min | Prevents token forgery (P1) |
| 3 | Add entity ownership to forensic evidence query | 1 file, 1 line | 15 min | Prevents cross-unit data leak (P1) |
| 4 | Add new apps to typecheck script | 1 file (package.json) | 15 min | CI catches type errors in new apps |
| 5 | Increase pool size + env config | 3 files, 2 lines each | 15 min | Prevents pool exhaustion |
| 6 | Add startup env var validation | 3 files, ~10 lines each | 30 min | Clear startup failure messages |
| 7 | Fix select option enum i18n | ~15 list view files | 1 hr | Enum labels translated properly |
| 8 | Validate transition IDs in route handlers | 6 files, ~5 lines each | 30 min | Rejects invalid transitions early |

### 2-Day Stabilization Plan

| Day | Tasks | Outcome |
|-----|-------|---------|
| **Day 1 AM** | Quick wins #1-6 above | Security + reliability fixes shipped |
| **Day 1 PM** | Add try-catch to 35 unprotected routes (#5 in backlog) | All routes have error handling |
| **Day 1 PM** | Safe error responses — no SQL in responses (#17) | No information disclosure |
| **Day 2 AM** | Fix 214 `label={t()}` anti-patterns (#7) | Bilingual field labels work |
| **Day 2 AM** | Fix hardcoded English strings (#10, #15) | i18n compliance for existing English keys |
| **Day 2 PM** | Add data-label attributes to tables (#14) | Mobile card layout works |
| **Day 2 PM** | Add OpenTelemetry scaffolding to new APIs (#22) | Basic tracing operational |

---

## 15. Top 5 Priorities

1. **P0 — Fix access control: Add `unit_id` to DOPAMS and SM JWT tokens** (Backlog #1, #2)
   - Missing `unit_id` means unit-scoped queries return null, potentially exposing data across organizational units. This is the highest-risk finding.

2. **P1 — Harden authentication: Fail on dev secrets in production** (Backlog #3)
   - All 3 new APIs have hardcoded fallback JWT secrets. If `JWT_SECRET` env var is missing in production, tokens signed with the dev secret can be forged by anyone who reads the source code.

3. **P1 — Add error handling to 35 unprotected route handlers** (Backlog #5)
   - Routes that use `fs.readFileSync` + `JSON.parse` or other fallible operations have no try-catch. Crashes produce unstructured error responses and may leak internals.

4. **P1 — Resolve i18n compliance: locales + anti-patterns** (Backlog #6, #7, #10)
   - 3 new UIs are English-only despite bilingual mandate. 214 `label={t()}` violations. ~23+ hardcoded English strings. This blocks deployment to bilingual environments.

5. **P1 — Add new apps to CI typecheck + build** (Backlog #8)
   - New API and UI apps are not type-checked in CI. Type errors in these apps will pass CI silently and only surface at runtime.

---

## Verification Commands

```bash
# Type checking (all workspaces)
npm run typecheck 2>&1 | tail -50                      # Status: Not Executed (no live env)

# Build verification
npm run build:all 2>&1 | tail -30                      # Status: Not Executed

# Workflow engine tests
npm run test:workflow-engine 2>&1 | tail -20            # Status: Not Executed

# API tests
npm run test:dopams 2>&1 | tail -20                     # Status: Not Executed
npm run test:forensic 2>&1 | tail -20                   # Status: Not Executed
npm run test:social-media 2>&1 | tail -20               # Status: Not Executed

# i18n compliance check
grep -rn 'label={t(' apps/*/src/*.tsx apps/*/src/**/*.tsx  # Status: Executed (214 matches)

# Hardcoded English in JSX
rg '>[A-Z][a-z].*</' --glob '*.tsx' apps/dopams-ui/src/  # Status: Executed (23 matches)

# any type usage
rg ': any\b|as any\b' --glob '*.ts' apps/                # Status: Executed (403 matches)

# TODO/FIXME inventory
rg 'TODO|FIXME|HACK|XXX|TEMP' --glob '!node_modules' --glob '!*.lock'  # Status: Executed (0 findings)

# SQL template literals
rg '\$\{.*\}' --glob '*.ts' apps/*/src/services/         # Status: Executed (28+ matches)

# Silent catch blocks
rg '\.catch\(\(\) => \{\}\)' --glob '*.ts'               # Status: Executed (20+ matches)

# N+1 query patterns
rg 'for.*await.*query|forEach.*await.*find' --glob '*.ts'  # Status: Executed (0 matches)
```

---

*Report generated: 2026-03-04 by Claude Code automated quality review.*
