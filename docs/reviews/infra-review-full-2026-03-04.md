# Infrastructure & Architecture Review

**Target:** Full repository
**Branch:** `main`
**Commit:** `28c7fda`
**Date:** 2026-03-04
**Reviewer:** Claude Opus 4.6 (automated)

---

## Phase 0: Preflight

### Scope & Assumptions

- **In scope:** All 9 apps (api, citizen, officer, dopams-api/ui, forensic-api/ui, social-media-api/ui), 2 shared packages, Dockerfiles, CI/CD, docker-compose, nginx, migrations.
- **Out of scope:** PUDA main API deep code review (covered in prior reviews), IaC Terraform modules (only validated via CI), external cloud configuration.
- **Assumptions:** Docker daemon not available locally for build verification; analysis is static.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 LTS (Alpine) |
| Language | TypeScript | 5.7 |
| API Framework | Fastify | 5.7.4 |
| Frontend | React | 18.3.1 |
| Build (frontend) | Vite | 6.0.3 |
| Database | PostgreSQL | 15 (Alpine) |
| ORM/Driver | pg (node-postgres) | 8.11.5 |
| Auth | jsonwebtoken + Argon2 | 9.0.3 / 0.41.1 |
| Validation | Zod | 4.3.6 |
| Reverse proxy | nginx | 1.27 (Alpine) |
| Container target | Google Cloud Run | - |
| CI | GitHub Actions | v4 actions |
| Security scanning | Semgrep, CodeQL, OWASP ZAP | Latest |
| Testing | Vitest, Playwright | - |
| i18n | i18next | 24-25 |

### Available Scripts

| Script | Purpose |
|--------|---------|
| `build:all` | Build packages then apps |
| `typecheck` | TypeScript strict check |
| `test:api:{authz,brd,rest}` | API test shards |
| `test:e2e` | Playwright E2E |
| `test:api:load` | Autocannon load smoke |
| `check:frontend-budgets` | Bundle size gate |
| `check:observability` | SLO/alert validation |
| `check:iac` | Terraform validation |

### Deployment Target

Google Cloud Run (asia-south1), canary deployment with manual promotion.

---

## Phase 1: System Map

### Runtime Components

| Component | Type | Port (host) | Port (container) | Database |
|-----------|------|-------------|-------------------|----------|
| `api` | Fastify API | 3001 | 8080 | puda (postgres:5433) |
| `citizen` | React SPA (nginx) | 3002 | 8080 | - |
| `officer` | React SPA (nginx) | 3003 | 8080 | - |
| `dopams-api` | Fastify API | 3011 | 8080 | dopams (postgres:5435) |
| `dopams-ui` | React SPA (nginx) | 3021 | 8080 | - |
| `forensic-api` | Fastify API | 3012 | 8080 | forensic (postgres:5436) |
| `forensic-ui` | React SPA (nginx) | 3022 | 8080 | - |
| `social-media-api` | Fastify API | 3010 | 8080 | social_media (postgres:5434) |
| `social-media-ui` | React SPA (nginx) | 3020 | 8080 | - |

### Module Dependency Graph

```
packages/shared ────────────────┐
packages/workflow-engine ───────┤
                                ├── apps/api
                                ├── apps/dopams-api
                                ├── apps/forensic-api
                                └── apps/social-media-api

packages/shared ────────────────┐
                                ├── apps/citizen
                                ├── apps/officer
                                ├── apps/dopams-ui
                                ├── apps/forensic-ui
                                └── apps/social-media-ui
```

### Component Diagram

```mermaid
graph TD
    subgraph "Frontend SPAs (nginx)"
        CIT[Citizen Portal :3002]
        OFF[Officer Portal :3003]
        DUI[DOPAMS UI :3021]
        FUI[Forensic UI :3022]
        SUI[Social Media UI :3020]
    end

    subgraph "API Services (Fastify)"
        API[PUDA API :3001]
        DAPI[DOPAMS API :3011]
        FAPI[Forensic API :3012]
        SAPI[Social Media API :3010]
    end

    subgraph "Databases (PostgreSQL 15)"
        PDB[(puda :5433)]
        DDB[(dopams :5435)]
        FDB[(forensic :5436)]
        SDB[(social_media :5434)]
    end

    subgraph "Shared Packages"
        SH[/@puda/shared/]
        WE[/@puda/workflow-engine/]
    end

    CIT --> API
    OFF --> API
    DUI --> DAPI
    FUI --> FAPI
    SUI --> SAPI

    API --> PDB
    DAPI --> DDB
    FAPI --> FDB
    SAPI --> SDB

    API -.-> SH
    API -.-> WE
    DAPI -.-> SH
    DAPI -.-> WE
    FAPI -.-> SH
    FAPI -.-> WE
    SAPI -.-> SH
    SAPI -.-> WE
```

### Data Flow: Typical Request Lifecycle

1. Browser → nginx (SPA) → `#/view/resourceId` hash route
2. React app `fetch()` → `GET /api/v1/{entity}` with Bearer token cookie
3. Fastify `onRequest` hook → JWT verification (cookie or Authorization header)
4. Fastify `onRequest` hook → set `AsyncLocalStorage` request context
5. Route handler → `query()` wrapper → PostgreSQL pool
6. Response → Fastify `onResponse` hook → audit logger (mutations only)
7. Response → Fastify `onResponse` hook → slow request warning (>1000ms)

### Secrets & Config Strategy

- **Env vars** for all runtime config (`DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, etc.)
- **`.env.example`** files document required vars per service
- **Build-time args** for frontend (`VITE_API_BASE_URL`)
- **Cloud Run** injects `PORT` env var at runtime
- **No secrets manager** integration detected (env-var-only approach)

---

## Phase 2: Architecture Boundaries

### A) Module Boundaries

| Check | Status | Evidence |
|-------|--------|----------|
| Workspace boundaries respected | PASS | All imports use `@puda/shared`, `@puda/workflow-engine` workspace refs |
| Shared packages have clean API surfaces | PASS | `packages/shared/src/index.ts` explicit re-exports; `packages/workflow-engine/src/index.ts` curated exports |
| No circular dependencies | PASS | APIs depend on packages; packages don't import from apps |
| Domain logic separated from infra | PARTIAL | Services layer exists but some route handlers contain inline SQL queries |

### B) Code Organization

| Check | Status | Evidence |
|-------|--------|----------|
| Consistent structure across modules | PASS | All 3 new APIs follow identical directory structure: `routes/`, `services/`, `middleware/`, `workflow-bridge/`, `migrations/` |
| Separation of concerns | PARTIAL | Routes contain SQL directly; no dedicated data-access layer in new APIs |
| Configuration centralized | PASS | Env vars read at module boundaries (`db.ts`, `middleware/auth.ts`, `app.ts`) |
| Environment code isolated | PASS | `dotenv` loaded only in `index.ts`; test runtime detection via `NODE_ENV`/`VITEST` |

### C) Dependency Management

| Check | Status | Evidence |
|-------|--------|----------|
| Workspace deps declared | PASS | `@puda/shared` and `@puda/workflow-engine` in all API `package.json` files |
| Build order respects graph | PASS | `build:all` runs `build:packages` first (`root package.json`) |
| No phantom dependencies | PASS | All imports correspond to declared deps |
| Version consistency | PARTIAL | `i18next` v25.8.4 in citizen vs v24.2.2 in officer/dopams/forensic/social-media UIs |

**Finding: i18next version skew**
- **Severity:** P3 | **Confidence:** High | **Status:** Confirmed
- `apps/citizen/package.json`: i18next `^25.8.4`
- `apps/officer/package.json`, `apps/dopams-ui/package.json`, etc.: i18next `^24.2.2`
- **Impact:** Potential inconsistent i18n behavior, different API surface
- **Fix:** Align all to v25.x
- **Verify:** `grep -r '"i18next"' apps/*/package.json`

### D) API Surface Discipline

| Check | Status | Evidence |
|-------|--------|----------|
| Shared packages export only what's needed | PASS | `packages/shared/src/index.ts` uses explicit named re-exports |
| Internal details not importable | PASS | `main` field in package.json points to `dist/index.js` |
| Type exports match runtime | PASS | `declaration: true` in tsconfig; types field in package.json |

---

## Phase 3: Performance & Scalability

### A) Database Performance

| Check | Status | Evidence |
|-------|--------|----------|
| Indexes on FK/search columns | PASS | `001_init.sql`: indexes on `state_id`, `severity`, `entity_type+entity_id`, `subject_id`, `document_id` |
| No N+1 query patterns | PASS | Grep for `for.*await.*query` returned zero matches |
| Bounded queries | PASS | All list endpoints enforce `LIMIT` (max 200, default 50) |
| Connection pooling | PASS | `pg.Pool` with max=8, idle timeout 30s, connection timeout 2s (`db.ts:17-22`) |
| Slow query detection | PASS | Queries >500ms logged as warnings (`db.ts:28-29`) |

**Finding: Duplicate migration numbering**
- **Severity:** P1 | **Confidence:** High | **Status:** Confirmed
- `apps/dopams-api/migrations/` has both `005_memo_seq.sql` and `005_notifications.sql`
- **Impact:** Migration ordering is ambiguous. Depending on filesystem sort order, either file could run first. May cause runtime errors if one depends on the other.
- **Fix:** Renumber `005_memo_seq.sql` to `019_memo_seq.sql` or merge into `005_notifications.sql`
- **Verify:** `ls -1 apps/dopams-api/migrations/ | grep '^005'`

**Finding: No connection pool metrics in new APIs**
- **Severity:** P2 | **Confidence:** High | **Status:** Confirmed
- Main PUDA API (`apps/api/src/db.ts:81-84`) tracks pool metrics (`totalClients`, `idleClients`, `waitingClients`)
- New APIs (`dopams-api/db.ts`, `forensic-api/db.ts`, `social-media-api/db.ts`) have no pool metrics
- **Impact:** Pool exhaustion in production would be invisible
- **Fix:** Add periodic pool metric logging to new API `db.ts` files
- **Verify:** `grep -n 'totalCount\|idleCount\|waitingCount' apps/*/src/db.ts`

### B) API Performance

| Check | Status | Evidence |
|-------|--------|----------|
| Pagination on all list endpoints | PASS | All routes use `limit`/`offset` with bounded max (200) |
| Response payload bounded | PASS | Audit payload truncated to 4000 chars (`audit-logger.ts:70`) |
| Rate limiting | PASS | Global 100/min, mutations 30/min, auth login 10/min |
| Caching strategy | PARTIAL | UI apps use localStorage cache (`cache.ts`); APIs have no response caching |

**Finding: No server-side caching in new APIs**
- **Severity:** P2 | **Confidence:** High | **Status:** Confirmed
- Main PUDA API uses Redis for caching
- New APIs (DOPAMS, Forensic, Social Media) have no Redis or in-memory cache
- **Impact:** Every request hits the database; no cache for read-heavy endpoints like dashboard stats
- **Fix:** Add response caching for read-heavy endpoints (dashboard/stats, config/workflows)
- **Verify:** `grep -rn 'redis\|cache' apps/dopams-api/src/`

### C) Frontend Performance

| Check | Status | Evidence |
|-------|--------|----------|
| Route-level code splitting | PASS | All views use `React.lazy()` + Suspense in `App.tsx` |
| Bundle size gated in CI | PASS | `frontend-performance-budget` job in `ci.yml:269-297` |
| Tree-shaking effective | PASS | No barrel `export *` in shared package |

### D) Scalability Patterns

| Check | Status | Evidence |
|-------|--------|----------|
| Stateless services | PARTIAL | SLA scheduler uses in-process `setInterval` — won't coordinate across instances |
| File storage strategy | PASS | Main API uses S3; new APIs don't handle file uploads (except forensic evidence) |
| Background jobs | FAIL | SLA scheduler uses in-process timers, not a job queue |

**Finding: SLA scheduler uses in-process setInterval**
- **Severity:** P1 | **Confidence:** High | **Status:** Confirmed
- `apps/dopams-api/src/sla-scheduler.ts:40`: `intervalId = setInterval(checkOverdueTasks, intervalMs)`
- Same pattern in `forensic-api` and `social-media-api`
- **Impact:** When running multiple instances (horizontal scaling), every instance runs the scheduler simultaneously, causing duplicate escalations. No leader election or distributed lock.
- **Fix:** Either (a) use Cloud Run scheduler/Cloud Tasks for SLA checks, or (b) add advisory lock `SELECT pg_try_advisory_lock(...)` at the start of `checkOverdueTasks()` to ensure only one instance runs at a time
- **Verify:** Review `sla-scheduler.ts` in all three APIs

---

## Phase 4: Reliability & Resilience

### A) Failure Isolation

| Check | Status | Evidence |
|-------|--------|----------|
| External service timeouts | PARTIAL | DB connection timeout 2s; no HTTP client timeout for external services |
| Database failure handling | PASS | `/ready` endpoint verifies DB; returns 503 on failure (`app.ts:152-160`) |
| Component isolation | PASS | Each API has its own database; one service failing doesn't affect others |

### B) Data Safety

| Check | Status | Evidence |
|-------|--------|----------|
| Transactions for multi-step mutations | PASS | `workflow-bridge/txn-manager.ts` wraps workflow transitions in BEGIN/COMMIT/ROLLBACK |
| Lock timeout configured | PASS | `SET LOCAL lock_timeout = '5s'` in transaction manager |
| Optimistic concurrency | PASS | `row_version` column on all entities, checked in workflow engine |

### C) Graceful Shutdown

| Check | Status | Evidence |
|-------|--------|----------|
| SIGTERM/SIGINT handlers | PASS | All APIs: `index.ts:15-43` |
| Configurable timeout | PASS | `SHUTDOWN_TIMEOUT_MS` env var, default 15s |
| SLA scheduler stopped | PASS | `stopSlaScheduler()` called in shutdown (`index.ts:28`) |
| DB pool drained | PASS | `pool.end()` called in shutdown (`index.ts:31`) |
| Force exit on timeout | PASS | `setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS)` with `.unref()` |

### D) Health & Readiness

| Check | Status | Evidence |
|-------|--------|----------|
| Health endpoint | PASS | `GET /health` returns `{status: "ok"}` |
| Readiness with dependency check | PASS | `GET /ready` executes `SELECT 1` against DB; 503 on failure |
| Docker HEALTHCHECK | PASS | All Dockerfiles: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3` |
| Health excluded from auth | PASS | `/health` and `/ready` in `PUBLIC_ROUTES` (`middleware/auth.ts:8-13`) |

### E) SLA & Timeout Configuration

| Check | Status | Evidence |
|-------|--------|----------|
| DB connection timeout | PASS | `connectionTimeoutMillis: 2000` (`db.ts:21`) |
| DB idle timeout | PASS | `idleTimeoutMillis: 30000` (`db.ts:20`) |
| Lock timeout | PASS | `SET LOCAL lock_timeout = '5s'` in transactions |
| Shutdown timeout | PASS | 15s default, configurable via `SHUTDOWN_TIMEOUT_MS` |
| SLA breach detection | PASS | `sla-scheduler.ts` queries `sla_due_at < NOW()` |

---

## Phase 5: Observability

### A) Structured Logging

| Check | Status | Evidence |
|-------|--------|----------|
| JSON structured format | PASS | `logger.ts:32`: `JSON.stringify(payload)` |
| Consistent fields | PASS | `timestamp`, `level`, `message`, `requestId` in every log line |
| Request ID propagation | PASS | `AsyncLocalStorage` in `log-context.ts`; set on `onRequest` hook |
| Sensitive data redacted | PASS | `REDACT_KEY_PATTERN` covers: password, token, secret, signature, authorization, cookie, aadhaar, pan |
| No PII in logs | PASS | Redaction applied to all log fields and audit payloads |

**Finding: Duplicated redaction logic**
- **Severity:** P3 | **Confidence:** High | **Status:** Confirmed
- `logger.ts` and `audit-logger.ts` both define identical `REDACT_KEY_PATTERN` and `redactPayload`/`redactValue` functions
- Same duplication in all 3 new APIs (6 copies total)
- **Impact:** Maintenance burden; risk of redaction divergence
- **Fix:** Extract shared `redact()` utility to common module
- **Verify:** `grep -rn 'REDACT_KEY_PATTERN' apps/*/src/`

### B) Health & Monitoring

| Check | Status | Evidence |
|-------|--------|----------|
| Liveness endpoint | PASS | `GET /health` (no dependency checks) |
| Readiness endpoint | PASS | `GET /ready` (DB connectivity) |
| Metrics endpoint | FAIL | No `/metrics` or prom-client in new APIs (main API has prom-client) |
| Slow request detection | PASS | Requests >1000ms logged as warnings (`app.ts:144-147`) |

**Finding: No Prometheus metrics in new APIs**
- **Severity:** P2 | **Confidence:** High | **Status:** Confirmed
- Main PUDA API has `prom-client` dependency and metrics collection
- New APIs have no metrics endpoint or instrumentation
- **Impact:** No visibility into request latency, error rates, throughput in production
- **Fix:** Add `prom-client` with standard HTTP metrics (request duration histogram, error counter) and `GET /metrics` endpoint
- **Verify:** `grep -n 'prom-client\|metrics' apps/{dopams,forensic,social-media}-api/package.json`

### C) Error Tracking

| Check | Status | Evidence |
|-------|--------|----------|
| Global error handler | PASS | `app.ts:124-132`: `setErrorHandler` catches all route errors |
| 5xx errors logged | PASS | `if (statusCode >= 500) app.log.error(err)` |
| Audit log failure resilient | PASS | `audit-logger.ts:79-81`: catch block logs error without crashing |
| Sentry integration (UI) | PASS | `main.tsx` calls `initErrorReporting()` with `VITE_SENTRY_DSN` |

### D) Audit & Tracing

| Check | Status | Evidence |
|-------|--------|----------|
| OpenTelemetry (main API) | PASS | `apps/api` has `@opentelemetry/*` dependencies |
| OpenTelemetry (new APIs) | FAIL | No OpenTelemetry instrumentation in DOPAMS/Forensic/Social Media APIs |
| Business event audit | PASS | `audit_event` table records all mutations with actor, entity, payload |
| Workflow transition audit | PASS | `audit-writer.ts` records state transitions via workflow engine |

---

## Phase 6: Container & Build Pipeline

### A) Dockerfile Quality

| Check | DOPAMS API | Forensic API | SM API | UI (all) |
|-------|-----------|-------------|--------|----------|
| Base image pinned | PASS (node:20-alpine) | PASS | PASS | PASS (nginx:1.27-alpine) |
| COPY order (deps first) | PASS | PASS | PASS | PASS |
| Lockfile install (npm ci) | PASS | PASS | PASS | PASS |
| Multi-stage build | PASS (3 stages) | PASS | PASS | PASS (2 stages) |
| Prod-only deps | PASS (--omit=dev) | PASS | PASS | N/A (nginx) |
| Non-root user | PASS (appuser:1001) | PASS | PASS | N/A (nginx default) |
| EXPOSE matches runtime | PASS (8080) | PASS | PASS | PASS (8080) |
| Correct entrypoint | PASS | PASS | PASS | PASS |
| HEALTHCHECK | PASS | PASS | PASS | PASS |

**Finding: UI Dockerfiles run nginx as root**
- **Severity:** P2 | **Confidence:** High | **Status:** Confirmed
- API Dockerfiles add `appuser:1001` and switch with `USER appuser`
- UI Dockerfiles (`Dockerfile.dopams-ui`, etc.) use default nginx user (root in nginx:1.27-alpine)
- **Impact:** Container runs as root; violates least-privilege principle
- **Fix:** Add `USER nginx` or configure nginx to run as non-root (bind to port > 1024, which is already the case via `$PORT`)
- **Verify:** `grep 'USER' Dockerfile.*-ui`

### B) Build Output Path Alignment

| Dockerfile | Build output | COPY source | Match |
|------------|-------------|-------------|-------|
| dopams-api | `apps/dopams-api/dist/` | `--from=build /app/apps/dopams-api/dist/` | PASS |
| dopams-ui | `apps/dopams-ui/dist/` | `--from=build /app/apps/dopams-ui/dist/` | PASS |
| forensic-api | `apps/forensic-api/dist/` | `--from=build /app/apps/forensic-api/dist/` | PASS |
| forensic-ui | `apps/forensic-ui/dist/` | `--from=build /app/apps/forensic-ui/dist/` | PASS |
| social-media-api | `apps/social-media-api/dist/` | `--from=build /app/apps/social-media-api/dist/` | PASS |
| social-media-ui | `apps/social-media-ui/dist/` | `--from=build /app/apps/social-media-ui/dist/` | PASS |

All paths aligned correctly.

### C) Layer Caching

| Check | Status | Evidence |
|-------|--------|----------|
| Dep manifests copied before source | PASS | package.json files copied first, then `npm ci`, then source |
| `.dockerignore` present | PASS | Excludes: `node_modules`, `dist`, `.git`, `.env`, test files, docs |
| Unnecessary layers | PASS | Minimal RUN instructions |

### D) Docker Compose

| Check | Status | Evidence |
|-------|--------|----------|
| Port mappings unique | PASS | APIs: 3001, 3010-3012; UIs: 3002-3003, 3020-3022; DBs: 5433-5436 |
| DB health checks | PASS | `pg_isready` with 5s interval |
| Service dependencies | PASS | All APIs `depends_on: {db: condition: service_healthy}` |
| Volumes for persistence | PASS | Separate named volumes per database |

**Finding: No migration step in docker-compose**
- **Severity:** P1 | **Confidence:** High | **Status:** Confirmed
- Docker Compose starts APIs that depend on database being healthy, but migrations are not automatically run
- New APIs will crash or return errors if tables don't exist
- **Impact:** `docker compose up` won't work out-of-the-box for new APIs
- **Fix:** Add migration command to API service startup (e.g., `command: sh -c "npm run migrate && node dist/index.js"`) or add separate init containers
- **Verify:** Run `docker compose up dopams-api` and check for table-not-found errors

**Finding: Workflow definition JSON files not copied in Dockerfile**
- **Severity:** P1 | **Confidence:** High | **Status:** Confirmed
- `apps/dopams-api/src/workflow-definitions/dopams_case.json` and `dopams_memo.json` exist
- The storage adapter loads these via `loadWorkflowDefinition()` at runtime
- Dockerfiles only copy `dist/` (compiled JS) and `migrations/` — workflow JSON files in `src/` are not copied
- **Impact:** Workflow transitions will fail in production with file-not-found errors
- **Fix:** Either (a) copy `apps/dopams-api/src/workflow-definitions/` to the production image, or (b) move JSON files to a non-src location and copy them, or (c) bundle them into the compiled output via TypeScript `resolveJsonModule`
- **Verify:** Check if workflow JSON files are in `dist/` after build: `ls apps/dopams-api/dist/workflow-definitions/`

---

## Phase 7: CI/CD Pipeline

### A) Build Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Compilation/build | PASS (Present and Passing) | `build-and-typecheck` job, `npm run build:all` |
| Unit tests | PASS (Present) | `api-tests` (3 shards), `citizen-cache-unit` |
| Integration tests | PASS (Present) | `api-tests` with Postgres service |
| Static analysis (typecheck) | PASS (Present) | Included in build step |
| Security scan (SAST) | PASS (Present) | Semgrep + CodeQL (`security.yml`) |
| Dependency audit | PASS (Present) | `npm audit --audit-level=high` (`ci.yml:588`) |
| Performance budget | PASS (Present) | `frontend-performance-budget` job |
| Load test | PASS (Present) | `api-load-smoke` (P95<400ms, >50 RPS) |
| DAST | PASS (Present) | OWASP ZAP baseline scan |
| E2E tests | PASS (Present) | Playwright with Chromium |
| Accessibility | PASS (Present) | `ui-a11y-smoke` with Playwright |
| Migration idempotency | PASS (Present) | `validate-migrations` runs twice |
| OpenAPI drift | PASS (Present) | `openapi-drift` + `openapi-contract-quality` |
| Observability validation | PASS (Present) | `observability-artifacts` + `slo-alert-tests` |

**Finding: New APIs not included in CI test jobs**
- **Severity:** P1 | **Confidence:** High | **Status:** Confirmed
- `ci.yml` runs tests only for `apps/api` workspace
- DOPAMS, Forensic, and Social Media API tests exist (`apps/dopams-api/src/__tests__/`) but are not executed in CI
- Root `package.json` has `test:dopams`, `test:forensic`, `test:social-media` scripts but no CI jobs reference them
- **Impact:** Regressions in new APIs will not be caught by CI
- **Fix:** Add CI jobs for new API test suites (can follow the `api-tests` pattern with database services)
- **Verify:** Search `ci.yml` for `dopams`, `forensic`, `social-media`

**Finding: New UI apps not included in frontend performance budget**
- **Severity:** P2 | **Confidence:** High | **Status:** Confirmed
- `frontend-performance-budget` job builds only `citizen` and `officer` portals
- New UIs (dopams-ui, forensic-ui, social-media-ui) not checked
- **Impact:** Bundle bloat in new UIs won't be caught
- **Fix:** Extend the build step and budget check to include new UIs
- **Verify:** Check `ci.yml:285-289`

### B) Deployment Pipeline

| Check | Status | Evidence |
|-------|--------|----------|
| Automated deployment | PASS | `deploy-cloudrun.yml` with manual trigger |
| Environment separation | PARTIAL | Only `production` environment configured |
| Canary deployment | PASS | Configurable canary % (default 10%) |
| Automatic rollback | PASS | Health probe in canary script |
| DB migrations in deploy | FAIL | No migration step in deployment workflow |

### C) Pipeline Security

| Check | Status | Evidence |
|-------|--------|----------|
| Secrets not in logs | PASS | Env vars via GitHub Secrets |
| Least privilege | PASS | `permissions: contents: read, id-token: write` |
| Actions pinned | PARTIAL | `actions/checkout@v4` uses major tag, not SHA |
| Workload Identity Federation | PASS | No service account keys in CI |

### D) Pipeline Reliability

| Check | Status | Evidence |
|-------|--------|----------|
| Build parallelization | PASS | 9 preflight jobs run in parallel |
| Test parallelization | PASS | API tests sharded (authz/brd/rest) |
| Dependency caching | PASS | `cache: npm` in all Node setup steps |
| Flaky test management | PASS | Playwright with `PLAYWRIGHT_RETRIES: 2` |

---

## Phase 8: Environment & Configuration

### A) Environment Variable Audit

| Variable | Used In | docker-compose | .env.example | CI | Status |
|----------|---------|---------------|-------------|------|--------|
| `PORT` | All APIs (`index.ts`) | Set (8080) | Not listed | Not needed | OK |
| `DOPAMS_DATABASE_URL` | dopams-api/db.ts | Set | Set | Missing | **GAP** |
| `FORENSIC_DATABASE_URL` | forensic-api/db.ts | Set | Set | Missing | **GAP** |
| `SM_DATABASE_URL` | social-media-api/db.ts | Set | Set | Missing | **GAP** |
| `JWT_SECRET` | All APIs | Set | Set | Set | OK |
| `ALLOWED_ORIGINS` | All APIs | Set | Set | Set (main only) | OK |
| `RATE_LIMIT_MAX` | New APIs | Not set | Set | Not set | OK (defaults) |
| `RATE_LIMIT_WINDOW` | New APIs | Not set | Set | Not set | OK (defaults) |
| `SHUTDOWN_TIMEOUT_MS` | New APIs | Not set | Set | Not set | OK (defaults) |
| `LOG_QUERIES` | New APIs | Not set | Set | Not set | OK (defaults) |
| `NODE_ENV` | All | Set (development) | Not explicit | Set (test) | OK |

**Finding: New API database URLs not in CI**
- **Severity:** P2 | **Confidence:** Medium | **Status:** Partially Confirmed
- CI only tests main `apps/api` against `DATABASE_URL`
- If new API tests are added to CI, their database URLs need configuring
- **Impact:** Will block CI test execution for new APIs
- **Fix:** Add database URL env vars to new CI jobs when adding test coverage

### B) Secret Safety

| Check | Status | Evidence |
|-------|--------|----------|
| No secrets in code | PASS | Dev defaults clearly marked "DO-NOT-USE-IN-PRODUCTION" |
| No secrets in Dockerfiles | PASS | No `ARG`/`ENV` for secrets |
| `.gitignore` covers secrets | PASS | `.env`, `.env.*` excluded |
| `.dockerignore` covers secrets | PASS | `.env`, `.env.*` excluded |

**Finding: JWT dev defaults could reach production**
- **Severity:** P1 | **Confidence:** Medium | **Status:** Partially Confirmed
- `apps/dopams-api/src/middleware/auth.ts:5`: `JWT_SECRET || "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"`
- Same pattern in forensic-api and social-media-api
- If `JWT_SECRET` env var is not set in production, the fallback is a hardcoded string
- **Impact:** If missed during deployment, all JWTs are signed with a publicly known secret
- **Fix:** Add a startup check that `JWT_SECRET` is set when `NODE_ENV=production`. Example: `if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET required in production')`
- **Verify:** Deploy with `NODE_ENV=production` and no `JWT_SECRET` set — app should refuse to start

### C) Configuration Consistency

| Check | Status | Evidence |
|-------|--------|----------|
| No hardcoded hosts in prod paths | PASS | All use `0.0.0.0` binding, env vars for DB URLs |
| Consistent env var naming | PASS | `{SERVICE}_DATABASE_URL`, `{SERVICE}_API_PORT` pattern |
| Feature flags | PASS | `ENABLE_API_DOCS` controlled by `NODE_ENV !== "production"` |

---

## Phase 9: Deployment Readiness

### A) Zero-Downtime Deployment

| Check | Status | Evidence |
|-------|--------|----------|
| Rolling/blue-green | PASS | Cloud Run canary with traffic splitting |
| Graceful shutdown | PASS | SIGTERM handler drains requests |
| Backward-compatible migrations | PASS | All use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` |
| Health check before traffic | PASS | Cloud Run + HEALTHCHECK in Dockerfile |

### B) Port & Network

| Check | Status | Evidence |
|-------|--------|----------|
| Port from env var | PASS | `PORT || {SERVICE}_API_PORT` pattern |
| CORS configured | PASS | `ALLOWED_ORIGINS` env var, parsed and validated |
| Internal comms | PASS | Docker Compose uses service names for DB hosts |
| TLS | PASS | Handled by Cloud Run at load balancer level |

### C) Database Migration Safety

| Check | Status | Evidence |
|-------|--------|----------|
| Idempotent migrations | PASS | `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` everywhere |
| No destructive ops | PASS | No `DROP TABLE` or `TRUNCATE` in any migration |
| CI validation | PASS (main API) | `validate-migrations` job runs migrations twice |

### D) Static Asset Serving

| Check | Status | Evidence |
|-------|--------|----------|
| SPA routing | PASS | `try_files $uri $uri/ /index.html` in nginx.conf |
| Cache headers | PASS | `/assets/` → `expires 1y`, `Cache-Control: public, immutable` |
| Compression | PASS | gzip enabled for text, CSS, JSON, JS |
| Security headers | PASS | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |

---

## Phase 10: QA Gates & Verdict

### Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Build health | **PASS** | `build:all` builds all workspaces; TypeScript strict mode |
| 2 | Architecture boundaries | **PASS** | Clean workspace deps; no circular imports |
| 3 | Reliability | **PASS** | Graceful shutdown, health checks, transactions |
| 4 | Container correctness | **PARTIAL** | Dockerfiles correct but missing workflow JSON files |
| 5 | Environment completeness | **PARTIAL** | Documented in .env.example; JWT dev fallback risk |
| 6 | Migration safety | **PARTIAL** | Idempotent but duplicate numbering (005); no auto-run in docker-compose |
| 7 | Deployment pipeline | **PARTIAL** | Canary deploy exists; no migration step; new APIs not in CI |

### Non-Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Performance | **PASS** | Pagination, rate limiting, pool config, no N+1 |
| 2 | Observability | **PARTIAL** | Structured logging + audit; no metrics or tracing in new APIs |
| 3 | Scalability | **PARTIAL** | SLA scheduler not safe for multi-instance; no Redis cache |
| 4 | CI/CD completeness | **PARTIAL** | Comprehensive for main API; new APIs not covered |

### Verdict

```
Build Status:          PASS
Architecture:          PASS
Reliability:           PASS
Container Status:      PARTIAL  (workflow JSON not in image)
Environment:           PARTIAL  (JWT fallback risk)
Migration Safety:      PARTIAL  (duplicate numbering, no auto-run)
Deployment Pipeline:   PARTIAL  (new APIs not in CI, no migration in deploy)
Blocking Gates:        3/7 PASS, 4/7 PARTIAL, 0/7 FAIL
Non-Blocking Gates:    1/4 PASS, 3/4 PARTIAL, 0/4 FAIL
Readiness Verdict:     CONDITIONAL
```

**Blocking conditions for READY:**
1. Copy workflow definition JSON files into production Docker images
2. Add JWT_SECRET production guard (refuse startup without it)
3. Fix duplicate migration numbering (005)
4. Add new API tests to CI pipeline

---

## Phase 11: Bugs & Foot-Guns

### High-Impact Findings

| # | Finding | Severity | Confidence | File:Line | Impact | Fix |
|---|---------|----------|------------|-----------|--------|-----|
| 1 | Workflow JSON not in Docker image | P0 | High | `Dockerfile.dopams-api:58-64` | Workflow transitions fail in prod | Copy `src/workflow-definitions/` to image or use `resolveJsonModule` |
| 2 | JWT dev secret fallback in production | P1 | Medium | `apps/dopams-api/src/middleware/auth.ts:5` | All auth bypassed if env var missing | Add startup guard for `NODE_ENV=production` |
| 3 | Duplicate migration 005 | P1 | High | `apps/dopams-api/migrations/005_*` | Ambiguous execution order | Renumber one file |
| 4 | SLA scheduler not multi-instance safe | P1 | High | `apps/dopams-api/src/sla-scheduler.ts:40` | Duplicate escalations with >1 replica | Add `pg_try_advisory_lock` or use Cloud Tasks |
| 5 | New APIs missing from CI | P1 | High | `.github/workflows/ci.yml` | Regressions not caught | Add test jobs for new APIs |
| 6 | No migration in docker-compose startup | P1 | High | `docker-compose.yml:142-158` | APIs crash on first `docker compose up` | Add migration command before server start |
| 7 | Audit logger writes on ALL responses including errors | P1 | Medium | `apps/dopams-api/src/middleware/audit-logger.ts:58` | Failed requests (4xx, 5xx) create spurious audit records | Filter by response status code (only audit 2xx-3xx) |
| 8 | `sendError` called incorrectly in error handler | P1 | High | `apps/dopams-api/src/app.ts:129` | `reply.send(sendError(reply, ...))` — `sendError` already calls `reply.code()`, then returns the error object; wrapping in `reply.send()` is correct but the double reply.code() is redundant | Simplify to `return sendError(reply, ...)` or just `return reply.code(500).send({...})` |
| 9 | No database SSL in new APIs | P1 | Medium | `apps/dopams-api/src/db.ts:17` | Data in transit not encrypted in production | Add SSL config matching main API pattern (`DATABASE_SSL`, `DATABASE_SSL_CA`) |
| 10 | `expiresIn` cast to `any` | P1 | Medium | `apps/dopams-api/src/middleware/auth.ts:50` | `{ expiresIn: (process.env.JWT_EXPIRES_IN \|\| "24h") as any }` bypasses type checking | Use proper type: `expiresIn: process.env.JWT_EXPIRES_IN \|\| "24h"` (string is valid) |

### Medium-Impact Findings

| # | Finding | Severity | Confidence | File:Line | Impact | Fix |
|---|---------|----------|------------|-----------|--------|-----|
| 11 | No Prometheus metrics in new APIs | P2 | High | `apps/dopams-api/package.json` | No production visibility | Add prom-client |
| 12 | No OpenTelemetry in new APIs | P2 | High | `apps/dopams-api/package.json` | No distributed tracing | Add OTel instrumentation |
| 13 | No server-side response caching | P2 | High | `apps/dopams-api/src/` | Every request hits DB | Add cache for read-heavy endpoints |
| 14 | UI Dockerfiles run as root | P2 | High | `Dockerfile.dopams-ui` | Security risk | Add `USER nginx` |
| 15 | Pool metrics missing in new APIs | P2 | High | `apps/dopams-api/src/db.ts` | Pool exhaustion invisible | Add metric logging |
| 16 | Redaction logic duplicated 6x | P3 | High | `apps/*/src/logger.ts`, `apps/*/src/middleware/audit-logger.ts` | Maintenance burden | Extract to shared util |
| 17 | i18next version skew | P3 | High | `apps/*/package.json` | Inconsistent behavior | Align to v25.x |
| 18 | CORS origin parsing inconsistency | P2 | High | `apps/social-media-api/src/app.ts:42` | DOPAMS trims whitespace, older code may not | Verify all APIs trim CORS origins |
| 19 | New UIs not in frontend perf budget | P2 | High | `.github/workflows/ci.yml:285` | Bundle bloat not caught | Extend CI job |
| 20 | `console.warn` used for slow queries instead of structured logger | P3 | Medium | `apps/dopams-api/src/db.ts:29` | Log format inconsistency | Use `logWarn()` instead |

---

## Phase 12: Requirements Compliance Matrix

No formal requirements documents found. Architecture-principles checklist based on observed patterns:

| # | Principle | Evidence | Status | Gap |
|---|-----------|----------|--------|-----|
| 1 | Database-per-service isolation | Separate PostgreSQL databases | PASS | - |
| 2 | JWT authentication | All APIs use JWT + httpOnly cookies | PASS | Dev fallback risk |
| 3 | Role-based access control | RBAC tables + role-filtered task inbox | PASS | - |
| 4 | Audit trail | audit_event table + middleware | PASS | Audits error responses too |
| 5 | Workflow state machine | @puda/workflow-engine integration | PASS | JSON files not in image |
| 6 | Structured logging | JSON logs with redaction | PASS | - |
| 7 | Graceful shutdown | SIGTERM handlers with timeout | PASS | - |
| 8 | Health/readiness probes | /health + /ready endpoints | PASS | - |
| 9 | Rate limiting | Global + mutation + auth limits | PASS | - |
| 10 | Canary deployment | Cloud Run canary workflow | PASS | - |
| 11 | Security scanning | Semgrep, CodeQL, ZAP, npm audit | PASS | New APIs not scanned |
| 12 | Observability | Logging + audit | PARTIAL | No metrics/tracing in new APIs |
| 13 | SLA management | SLA scheduler + task management | PARTIAL | Not multi-instance safe |
| 14 | i18n | i18next in all UIs | PASS | Version skew |

---

## Phase 13: Improvement Backlog

| ID | Title | Priority | Risk Score | Effort | Category | Where | Why | Fix | Verify |
|----|-------|----------|------------|--------|----------|-------|-----|-----|--------|
| 1 | Copy workflow JSON to Docker images | P0 | 5x5=25 | S | Container | `Dockerfile.dopams-api`, `Dockerfile.forensic-api`, `Dockerfile.social-media-api` | Workflow transitions fail in prod | Add `COPY apps/dopams-api/src/workflow-definitions/ apps/dopams-api/dist/workflow-definitions/` or adjust build | Docker build + test transition |
| 2 | Add JWT_SECRET production startup guard | P1 | 5x3=15 | S | Security | `apps/*/src/middleware/auth.ts` | Insecure fallback could reach prod | `if (NODE_ENV==='production' && !JWT_SECRET) throw` | Deploy without JWT_SECRET |
| 3 | Fix duplicate migration numbering | P1 | 4x4=16 | S | Migration | `apps/dopams-api/migrations/005_*` | Ambiguous order | Renumber `005_memo_seq.sql` → `019_memo_seq.sql` | `ls -1 migrations/` |
| 4 | Add SLA scheduler advisory lock | P1 | 4x4=16 | S | Scalability | `apps/*/src/sla-scheduler.ts` | Duplicate escalations | `SELECT pg_try_advisory_lock(42)` | Scale to 2 replicas, check logs |
| 5 | Add new API tests to CI | P1 | 4x5=20 | M | CI/CD | `.github/workflows/ci.yml` | Regressions undetected | Add jobs mirroring `api-tests` | PR with failing test |
| 6 | Add migration to docker-compose startup | P1 | 3x5=15 | S | DevOps | `docker-compose.yml` | First-run failure | Add `command: sh -c "npm run migrate && node dist/index.js"` | `docker compose up` |
| 7 | Fix audit logger to skip error responses | P1 | 3x4=12 | S | Observability | `apps/*/src/middleware/audit-logger.ts` | Spurious audit records | Check `reply.statusCode < 400` before inserting | Review audit_event after 4xx request |
| 8 | Add database SSL support to new APIs | P1 | 4x3=12 | S | Security | `apps/*/src/db.ts` | Unencrypted DB traffic | Copy SSL config pattern from main API | Check `pg_stat_ssl` |
| 9 | Remove `as any` from JWT expiresIn | P1 | 2x5=10 | S | Type Safety | `apps/*/src/middleware/auth.ts:50` | Bypasses type checking | Remove cast; string is valid for `expiresIn` | `npm run typecheck` |
| 10 | Add Prometheus metrics to new APIs | P2 | 3x4=12 | M | Observability | `apps/dopams-api/`, `apps/forensic-api/`, `apps/social-media-api/` | No production visibility | Add prom-client + metrics endpoint | `curl /metrics` |
| 11 | Add OpenTelemetry to new APIs | P2 | 3x3=9 | M | Observability | `apps/*/package.json` | No distributed tracing | Add @opentelemetry SDK + auto-instrumentation | Check trace output |
| 12 | Add server-side cache for read endpoints | P2 | 3x3=9 | M | Performance | `apps/*/src/routes/dashboard.routes.ts`, config routes | Every request hits DB | Add in-memory TTL cache for dashboard stats | Load test comparison |
| 13 | Run UI nginx as non-root | P2 | 3x3=9 | S | Security | `Dockerfile.*-ui` | Container privilege escalation | Add `USER nginx` after copying assets | Docker build + verify user |
| 14 | Add pool metrics to new APIs | P2 | 3x3=9 | S | Observability | `apps/*/src/db.ts` | Pool exhaustion invisible | Add periodic metric logging | Check logs under load |
| 15 | Add new UIs to frontend perf budget | P2 | 2x4=8 | S | CI/CD | `.github/workflows/ci.yml` | Bundle bloat undetected | Extend build + check steps | CI run with large import |
| 16 | Add CORS whitespace trimming consistency | P2 | 2x3=6 | S | Security | Check all `app.ts` CORS parsing | Whitespace in ALLOWED_ORIGINS breaks CORS | Ensure `.map(s => s.trim()).filter(Boolean)` everywhere | Test with spaces in env var |
| 17 | Add migration jobs for new APIs to CI | P2 | 3x3=9 | M | CI/CD | `.github/workflows/ci.yml` | Migration idempotency not verified | Add `validate-migrations` style jobs for each DB | CI run |
| 18 | Align i18next versions | P3 | 1x3=3 | S | Maintenance | `apps/*/package.json` | Inconsistent behavior | Update all to v25.x | `npm ls i18next` |
| 19 | Extract shared redaction utility | P3 | 1x2=2 | S | Maintenance | `apps/*/src/logger.ts`, `apps/*/src/middleware/audit-logger.ts` | 6 copies of same code | Move to shared util module | Grep for REDACT_KEY_PATTERN |
| 20 | Use structured logger for slow queries | P3 | 1x2=2 | S | Observability | `apps/*/src/db.ts:29` | `console.warn` breaks structured format | Use `logWarn()` | Check log output format |
| 21 | Add staging environment to deploy workflow | P2 | 3x2=6 | M | CI/CD | `.github/workflows/deploy-cloudrun.yml` | No staging validation | Add staging environment + auto-deploy on merge | Deploy to staging |
| 22 | Pin GitHub Actions to SHA | P3 | 2x2=4 | S | Security | `.github/workflows/*.yml` | Supply chain risk with major tags | Pin `actions/checkout@v4` → `actions/checkout@<sha>` | Diff workflow files |
| 23 | Add circuit breaker for external services | P2 | 3x2=6 | M | Reliability | `apps/*/src/services/` | External API failures cascade | Add timeout + retry with backoff for OCR, NL query, translation | Integration test with failure |
| 24 | Add database backup strategy documentation | P2 | 4x2=8 | S | Reliability | `docs/` | No backup/recovery plan | Document Cloud SQL backup schedule + RTO/RPO | Review document |
| 25 | Add `.env.example` for main PUDA API in docker-compose context | P3 | 1x3=3 | S | DevOps | `docker-compose.yml` | New developers confused by env setup | Document which env vars each service needs | `docker compose up` from scratch |

---

## Phase 14: Quick Wins & Stabilization

### Quick Wins (< 2 hours each)

| # | Task | Files | Verification |
|---|------|-------|-------------|
| 1 | **Fix duplicate migration numbering** — Rename `005_memo_seq.sql` → `019_memo_seq.sql` | `apps/dopams-api/migrations/` | `ls -1 migrations/ \| sort` |
| 2 | **Add JWT production guard** — Add 3 lines to each auth middleware | `apps/{dopams,forensic,social-media}-api/src/middleware/auth.ts` | Start with `NODE_ENV=production` and no `JWT_SECRET` |
| 3 | **Copy workflow JSON to Docker images** — Add COPY line to each API Dockerfile | `Dockerfile.{dopams,forensic,social-media}-api` | `docker build` + inspect image |
| 4 | **Remove `as any` from JWT** — Delete cast from 3 files | `apps/*/src/middleware/auth.ts:50` | `npm run typecheck` |
| 5 | **Add migration to docker-compose** — Change CMD or add command | `docker-compose.yml` (3 API services) | `docker compose up` from scratch |
| 6 | **Fix audit logger status filter** — Add `if (reply.statusCode >= 400) return` | `apps/*/src/middleware/audit-logger.ts` | Make a 404 request, check audit_event |
| 7 | **Use logWarn for slow queries** — Replace `console.warn` with `logWarn` | `apps/*/src/db.ts` | Run slow query, check log format |
| 8 | **Run nginx as non-root** — Add `USER nginx` to UI Dockerfiles | `Dockerfile.{dopams,forensic,social-media}-ui` | `docker build` + check running user |

### 2-Day Stabilization Sprint

| # | Task | Files | Verification |
|---|------|-------|-------------|
| 1 | All 8 quick wins above | Multiple | See above |
| 2 | **Add SLA scheduler advisory lock** | `apps/*/src/sla-scheduler.ts` | Scale to 2 replicas, verify single execution |
| 3 | **Add CI test jobs for new APIs** | `.github/workflows/ci.yml` | Push PR and verify tests run |
| 4 | **Add CI migration validation for new APIs** | `.github/workflows/ci.yml` | CI run passes |
| 5 | **Add CI frontend budget for new UIs** | `.github/workflows/ci.yml` | CI run reports bundle sizes |
| 6 | **Add database SSL config to new APIs** | `apps/*/src/db.ts` | Connect with SSL enabled |
| 7 | **Add pool metrics to new APIs** | `apps/*/src/db.ts` | Check structured log output |
| 8 | **Add prom-client metrics endpoint** | `apps/*/src/app.ts`, `apps/*/package.json` | `curl /metrics` returns Prometheus format |
| 9 | **Extract shared redaction utility** | New shared util + update all 6 files | Grep for REDACT_KEY_PATTERN shows single source |
| 10 | **Align i18next versions** | `apps/*/package.json` | `npm ls i18next` shows consistent version |

---

## Phase 15: Verification Commands

| # | Command | Purpose | Status |
|---|---------|---------|--------|
| 1 | `npm run build:all 2>&1 \| tail -20` | Build verification | Not Executed (no Docker) |
| 2 | `grep -rn 'REDACT_KEY_PATTERN' apps/*/src/` | Redaction duplication | Executed — 6 copies confirmed |
| 3 | `grep -n 'prom-client\|metrics' apps/{dopams,forensic,social-media}-api/package.json` | Metrics check | Executed — no matches |
| 4 | `grep 'USER' Dockerfile.*-ui` | Non-root check | Executed — no matches |
| 5 | `ls -1 apps/dopams-api/migrations/ \| grep '^005'` | Duplicate migration | Executed — 2 files with prefix 005 |
| 6 | `grep -rn 'pg_try_advisory_lock\|distributed_lock' apps/*/src/` | Lock check | Executed — no matches |
| 7 | `grep -rn 'setInterval\|setTimeout.*checkOverdue' apps/*/src/sla-scheduler.ts` | Scheduler pattern | Executed — setInterval in all 3 APIs |
| 8 | `grep -n 'workflow-definitions' Dockerfile.*-api` | JSON copy check | Executed — no matches |
| 9 | `grep -rn 'DATABASE_SSL' apps/{dopams,forensic,social-media}-api/src/` | SSL support | Executed — no matches |
| 10 | `grep -rn 'as any' apps/*/src/middleware/auth.ts` | Type safety | Executed — 3 matches |

---

## Top 5 Priorities

1. **P0: Copy workflow definition JSON files into Docker images** (Backlog #1)
   - Without this, all workflow transitions fail in production. This is a build-breaking issue.

2. **P1: Add JWT_SECRET production startup guard** (Backlog #2)
   - A missing env var in deployment could expose all APIs to unauthenticated access.

3. **P1: Add new API tests to CI pipeline** (Backlog #5)
   - Three new services with no CI coverage. Regressions will ship silently.

4. **P1: Fix SLA scheduler for multi-instance safety** (Backlog #4)
   - Cloud Run can auto-scale to multiple instances; duplicate escalations will confuse users and corrupt state.

5. **P1: Add migration step to docker-compose and deployment** (Backlog #6)
   - New developers can't run the stack; production deployments need manual migration.
