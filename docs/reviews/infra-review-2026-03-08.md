# Infrastructure & Architecture Review -- 2026-03-08

Scope: system boundaries, performance, reliability, observability, and deployment readiness across all 4 API services (PUDA, DOPAMS, Forensic, Social Media) plus shared infrastructure packages.

---

## 1. System Boundaries

### [HIGH] PUDA API Missing Helmet Security Headers
- **Location**: `apps/api/src/app.ts` (entire file -- no import or registration of `@fastify/helmet`)
- **Issue**: The PUDA API does not register `@fastify/helmet` at all. All three policing APIs (DOPAMS, Forensic, Social Media) have helmet registered with a full CSP directive set, but the primary PUDA API -- the most mature service -- has no HTTP security headers (no `X-Content-Type-Options`, no `X-Frame-Options`, no `Strict-Transport-Security`, no CSP). This means browsers will not receive critical security headers.
- **Fix**: Add `@fastify/helmet` registration to `apps/api/src/app.ts` with a CSP directive set equivalent to the policing APIs. The PUDA API already uses Swagger UI (`/docs`) so the CSP `scriptSrc` may need `'unsafe-inline'` for the Swagger UI route, or use a route-level override.

### [MEDIUM] Dev JWT Secrets Compiled into All Policing API Binaries
- **Location**: `apps/dopams-api/src/app.ts:262`, `apps/forensic-api/src/app.ts:239`, `apps/social-media-api/src/app.ts:250` (and their auth middleware/route files)
- **Issue**: Each policing API passes a `defaultDevSecret` string literal (e.g. `"dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"`) to `createAuthMiddleware`. While the middleware does throw a fatal error when `JWT_SECRET` is missing in production, the dev secret string is baked into the production Docker image. If the `NODE_ENV` check is somehow bypassed or misconfigured, the app will silently use these predictable secrets.
- **Fix**: In production builds, replace the fallback with a hard crash: `defaultDevSecret: ""` combined with the existing `getJwtSecret()` guard that throws when `JWT_SECRET` is missing in production. Alternatively, set `defaultDevSecret` from an env var rather than a string literal.

### [LOW] Swagger UI Exposed in Non-Production Environments by Default
- **Location**: `apps/dopams-api/src/app.ts:108`, `apps/forensic-api/src/app.ts:108`, `apps/social-media-api/src/app.ts:111`
- **Issue**: Swagger UI is enabled when `NODE_ENV !== "production"`. In staging/QA environments (where `NODE_ENV` is often `staging`), the full API documentation is publicly accessible. While this is a minor exposure, it reveals the complete API surface.
- **Fix**: Gate Swagger UI behind an explicit opt-in env var (`ENABLE_API_DOCS=true`) as the PUDA API already does (`process.env.ENABLE_API_DOCS === "true" || process.env.NODE_ENV !== "production"`).

---

## 2. Performance

### [CRITICAL] N+1 Query Pattern in Actor Risk Recalculation
- **Location**: `apps/social-media-api/src/routes/actor.routes.ts:164-185`
- **Issue**: The `POST /api/v1/actors/:id/recalculate-risk` endpoint fetches ALL content items for an actor **without a LIMIT** (`SELECT content_id, content_text, threat_score FROM content_item WHERE actor_id = $1`), then runs two sequential queries per item in a `for...of` loop: one to `classifyContentWithTaxonomy()` (which may itself query the DB), and one `INSERT...ON CONFLICT` to upsert the classification result. For a prolific actor with 10,000+ posts, this produces 20,000+ sequential queries in a single HTTP request. This will cause request timeouts and connection pool exhaustion.
- **Fix**: 1) Add a LIMIT (e.g. 500) and pagination. 2) Batch the classification upserts into a single multi-row INSERT. 3) Consider moving this to an async background job with progress tracking rather than a synchronous endpoint.

### [HIGH] Table Name Mismatch -- actor_account vs sm_actor
- **Location**: `apps/social-media-api/src/routes/actor.routes.ts:39,75,117,158,198` vs `apps/social-media-api/migrations/030_actor_saved_search.sql:3`
- **Issue**: The migration creates a table named `actor_account`, but all route queries reference `sm_actor`. No migration renames `actor_account` to `sm_actor`, and no view by that name exists. This means all actor queries will fail at runtime with a "relation sm_actor does not exist" error. The entire actor management feature (list, detail, posts, risk recalculation, cross-platform linking) is broken.
- **Fix**: Either rename the table in a new migration (`ALTER TABLE actor_account RENAME TO sm_actor`) and add the missing columns (`display_name`, `is_active`), or update all route queries to use `actor_account`. The migration table also lacks the `display_name` and `is_active` columns that the routes query.

### [HIGH] Unbounded Content Query in Actor Risk Recalculation
- **Location**: `apps/social-media-api/src/routes/actor.routes.ts:164-166`
- **Issue**: `SELECT content_id, content_text, threat_score FROM content_item WHERE actor_id = $1` fetches every content item for the actor with no LIMIT clause. The `content_text` column is `TEXT` type with no size constraint. For an actor with thousands of long-form posts, this single query can return megabytes of data, causing memory pressure on both the database and Node.js process.
- **Fix**: Add `LIMIT 500` and process in batches. For the classification use case, consider only fetching `content_id` and `content_text` (dropping `threat_score` from the SELECT since it is not used).

### [MEDIUM] DB Pool Metrics Logged as WARN Level Every 30 Seconds
- **Location**: `packages/api-core/src/db.ts:50-54`
- **Issue**: The shared `createPool` logs DB pool metrics (`totalClients`, `idleClients`, `waitingClients`) via `logWarnFn` every 30 seconds. This uses the WARN log level for routine operational metrics, which is semantically incorrect and will trigger alert fatigue in any log-based monitoring pipeline that watches for WARN-level events. All 3 policing APIs use this code path.
- **Fix**: Change from `logWarnFn` to a `logInfoFn` parameter, or add a separate `logMetricsFn` callback, or gate the log behind a condition (e.g. only log when `waitingClients > 0`).

### [LOW] SIEM Forwarder Event Buffer is Unbounded
- **Location**: `apps/social-media-api/src/services/siem-forwarder.ts:23,63`
- **Issue**: The `eventBuffer` array has no maximum size. If the SIEM endpoint is unreachable and events keep arriving, the buffer will grow without bound, eventually causing an OOM crash. The `flushEvents()` function does re-queue failed batches (`eventBuffer.unshift(...batch)` on line 55), so a persistent failure compounds the problem.
- **Fix**: Cap the buffer at a configurable maximum (e.g. 10,000 events). When the cap is reached, either drop the oldest events (log the drop count) or stop accepting new events until the buffer drains. Also consider persisting the buffer to disk or a database table for crash resilience.

---

## 3. Reliability

### [CRITICAL] Scheduled Report and MR Scanner Jobs Are Never Started
- **Location**: `apps/dopams-api/src/sla-scheduler.ts:42-52,95-105`, `apps/forensic-api/src/sla-scheduler.ts:42-52`, `apps/social-media-api/src/sla-scheduler.ts:105-115`
- **Issue**: All three policing APIs define `startReportScheduler()` (and DOPAMS also defines `startMrScanner()`) as exported functions, but these functions are never called from `index.ts` or from `startSlaScheduler()`. The scheduled report runner and MR file scanner will never execute. Reports configured in `scheduled_report` will never have their `next_run_at` advanced, and MR files will remain in `PENDING` status permanently.
- **Fix**: Call `startReportScheduler()` (and `startMrScanner()` for DOPAMS) from `startSlaScheduler()`, or call them directly from `index.ts` after the server starts listening. Also add corresponding `stopReportScheduler()`/`stopMrScanner()` calls to the shutdown path.

### [HIGH] PUDA API Missing unhandledRejection and uncaughtException Handlers
- **Location**: `apps/api/src/index.ts` (entire file)
- **Issue**: The PUDA API's `index.ts` does not register handlers for `unhandledRejection` or `uncaughtException`. All three policing APIs (DOPAMS, Forensic, Social Media) have both handlers that log the error and exit cleanly. Without these handlers, the PUDA API will crash with an unhelpful default Node.js error message, and importantly, in-flight requests will not be drained via `app.close()`.
- **Fix**: Add both handlers, matching the pattern used by the policing APIs:
  ```ts
  process.on("unhandledRejection", (reason) => { ... });
  process.on("uncaughtException", (err) => { ... });
  ```

### [HIGH] setInterval Timers Not Unrefed in Background Schedulers
- **Location**: `apps/dopams-api/src/sla-scheduler.ts:43,96`, `apps/forensic-api/src/sla-scheduler.ts:43`, `apps/social-media-api/src/sla-scheduler.ts:67,106`, `apps/social-media-api/src/connector-scheduler.ts:206`
- **Issue**: The `setInterval` calls in the SLA schedulers, report schedulers, SIEM alert forwarder, and connector scheduler do not call `.unref()` on the returned timer. This means these timers will prevent Node.js from exiting during graceful shutdown if `clearInterval` is not called before the event loop would otherwise drain. The PUDA API's `app.ts` correctly calls `.unref()` on all its timers (lines 877, 893, 908, 938). The SLA scheduler in `packages/api-core/src/scheduler/sla-scheduler.ts:87` also does NOT call `.unref()`.
- **Fix**: Call `.unref()` on every `setInterval` return value. This is a safety net -- the shutdown handlers do call `clearInterval`, but if shutdown logic throws before reaching the clear, unref ensures the process still exits.

### [HIGH] Email Relay Silently Swallows Errors on Missing Table
- **Location**: `apps/dopams-api/src/services/email-relay.ts:27`
- **Issue**: The email relay stub catches and silently discards database errors with `.catch(() => { /* table may not exist yet */ })`. If the `notification_email_log` table genuinely does not exist, every email relay call will silently fail. No migration creates this table -- there is no `notification_email_log` migration anywhere in the repository.
- **Fix**: Either: (a) Create a migration for `notification_email_log` table, or (b) Remove the INSERT and use structured logging instead. The catch-all `.catch(() => {})` pattern hides real errors (connection issues, constraint violations) alongside the expected "table not found" case.

### [MEDIUM] SIEM Forwarder Uses console.error Instead of Structured Logger
- **Location**: `apps/social-media-api/src/services/siem-forwarder.ts:44,56`, `apps/social-media-api/src/sla-scheduler.ts:63,97`, `apps/dopams-api/src/sla-scheduler.ts:34,38,83,87`, `apps/forensic-api/src/sla-scheduler.ts:34,38`
- **Issue**: Background tasks in the policing APIs use `console.error` and `console.log` instead of the structured logger (`logError`, `logWarn` from `./logger`). These console statements produce unstructured output that is not captured by structured log aggregation pipelines (Cloud Logging, Datadog, etc.). The PUDA API consistently uses structured logging.
- **Fix**: Replace all `console.error` / `console.log` / `console.warn` calls in server-side code with the appropriate structured logger function. The app-level loggers are already imported in most files.

### [MEDIUM] Connector Scheduler Does Not Await runPollCycle Promise
- **Location**: `apps/social-media-api/src/connector-scheduler.ts:206-208`
- **Issue**: The `setInterval` callback calls `runPollCycle(connectors)` without `await` or `.catch()`. If `runPollCycle` throws, the rejection is unhandled. While Node.js 20 does not crash on unhandled rejections by default, the error will be logged to stderr without context. Additionally, the initial `setTimeout` call on line 211 also does not `.catch()` the promise.
- **Fix**: Wrap in a void-catch pattern: `void runPollCycle(connectors).catch((err) => logError(...))` for both the interval callback and the initial setTimeout.

### [MEDIUM] Email Relay dispatchPendingEmails Uses Catch-All on DB Query
- **Location**: `apps/dopams-api/src/services/email-relay.ts:47-48`
- **Issue**: The `dispatchPendingEmails` method wraps the entire SELECT query in `.catch(() => ({ rows: [] }))`. This silently swallows all database errors (connection failures, syntax errors, etc.) and returns an empty result set. The caller has no way to know whether zero pending emails genuinely exist or the database is unreachable.
- **Fix**: At minimum, log the error before returning the empty fallback. Better: let the error propagate so the calling scheduler can track failure counts and surface degraded health.

---

## 4. Observability

### [MEDIUM] Health Check Does Not Verify Background Task Health
- **Location**: `apps/dopams-api/src/app.ts:197-208`, `apps/forensic-api/src/app.ts:183-194`, `apps/social-media-api/src/app.ts:191-202`
- **Issue**: The `/ready` endpoint only checks database connectivity (`SELECT 1`). It does not verify whether the SLA scheduler, connector scheduler, or SIEM forwarder are running. If a background task crashes (e.g. the SLA scheduler's `checkOverdueTasks` loop throws and the interval is cleared), the readiness probe still returns 200. For Cloud Run, this means the instance is considered healthy while core background functionality is dead.
- **Fix**: Track scheduler health status (e.g. `lastSuccessAt` timestamp) and include it in the readiness response. If the last successful run was more than 2x the expected interval ago, return `{ status: "degraded", reason: "sla_scheduler_stale" }`.

### [LOW] No Metrics Endpoint on Policing APIs
- **Location**: `apps/dopams-api/src/app.ts`, `apps/forensic-api/src/app.ts`, `apps/social-media-api/src/app.ts`
- **Issue**: The PUDA API has a dedicated `/metrics` endpoint (Prometheus-compatible format) that exposes HTTP request duration histograms, DB pool stats, and workflow backlog gauges. None of the three policing APIs have a metrics endpoint. There is no observability into request latencies, error rates, or pool saturation for these services.
- **Fix**: Add a `/metrics` endpoint to each policing API. The `@puda/api-core` package could provide a `createMetricsRoute` factory to avoid code duplication.

### [LOW] PUDA API Readiness Probe Dynamic Import on Every Call
- **Location**: `apps/api/src/app.ts:541-542`, `apps/dopams-api/src/app.ts:201`, `apps/forensic-api/src/app.ts:187`, `apps/social-media-api/src/app.ts:195`
- **Issue**: All four APIs use `await import("./db")` inside the `/ready` handler, which triggers a dynamic import on every readiness probe call (typically every 10-30 seconds from the container orchestrator). While Node.js caches modules after the first import, the dynamic import syntax still has overhead compared to a direct reference. The `/health` endpoint correctly avoids this.
- **Fix**: Import `query` or `pool` at module scope (or from the already-imported `./db` module) and reference it directly in the handler.

---

## 5. Docker / CI-CD

### [MEDIUM] Docker Compose Uses Hardcoded Database Passwords
- **Location**: `docker-compose.yml:9-10,93-94,165-166,231-232`
- **Issue**: All four PostgreSQL services use `POSTGRES_PASSWORD: puda` as a hardcoded plaintext password. While the docker-compose file appears intended for local development, the same file is often copy-pasted to staging environments. The API services also reference these passwords in their `DATABASE_URL` connection strings (e.g. `postgres://puda:puda@postgres:5432/puda`).
- **Fix**: Use env var interpolation with defaults: `POSTGRES_PASSWORD: "${PUDA_DB_PASSWORD:-puda}"` so staging/production deployments can override. Add a comment warning that the defaults are for local dev only.

### [MEDIUM] No .dockerignore for docs/ Directory (Credentials Files)
- **Location**: `.dockerignore` (lines 26-32)
- **Issue**: The `.dockerignore` excludes `**/*.md` but does not exclude the `docs/` directory itself. The `docs/` directory contains `deployed-apps-credentials.xlsx` and `deployed-services.xlsx` (visible in the git status). These Excel files with credentials will be included in the Docker build context and potentially COPY'd into the image if a future Dockerfile change uses a broad COPY pattern.
- **Fix**: Add `docs/` to `.dockerignore`. Also add exclusions for `*.xlsx`, `*.docx`, and any credentials files.

### [LOW] No Docker Build Cache Optimization for Package Builds
- **Location**: `Dockerfile.dopams-api:43`, `Dockerfile.forensic-api:43`, `Dockerfile.social-media-api:43`
- **Issue**: The build stage runs a chained `npm run build:shared && npm run build:workflow-engine && npm run build:api-core && npm run build:api-integrations && npm --workspace ... run build` as a single RUN layer. If only the app source changes (not shared packages), all four package builds are re-executed because the layer is invalidated.
- **Fix**: Split each build into a separate RUN command so Docker can cache the shared/workflow-engine/api-core layers independently when only the app code changes.

---

## 6. Environment Config

### [HIGH] Policing APIs Do Not Enforce ALLOWED_ORIGINS in Non-Test Non-Production
- **Location**: `apps/dopams-api/src/app.ts:57-63`, `apps/forensic-api/src/app.ts:47-53`, `apps/social-media-api/src/app.ts:50-56`
- **Issue**: The three policing APIs only throw a fatal error for missing `ALLOWED_ORIGINS` when `NODE_ENV === "production"`. In staging/QA environments (where `NODE_ENV` is typically `staging` or `development`), the `allowedOrigins` falls through to an empty array `[]`, which effectively blocks all cross-origin requests. This is the opposite problem from the PUDA API, which throws for any non-test runtime. A staging deployment will silently fail CORS with no error message.
- **Fix**: Match the PUDA API pattern: throw for any non-test runtime when `ALLOWED_ORIGINS` is missing, not just production.

### [MEDIUM] SLA Scheduler Interval Not Configurable via Environment
- **Location**: `packages/api-core/src/scheduler/sla-scheduler.ts:84`
- **Issue**: The `createSlaScheduler` always uses a hardcoded 60-second default interval (`start(intervalMs = 60000)`). While `start()` accepts an argument, the policing API callers all invoke it with no arguments (`scheduler.start()`). The PUDA API's SLA checker reads `SLA_CHECK_INTERVAL_MS` from the environment, but the policing APIs do not. This means the interval cannot be tuned per environment without code changes.
- **Fix**: Read `process.env.SLA_CHECK_INTERVAL_MS` in each policing API's `startSlaScheduler()` wrapper and pass it to `scheduler.start(parsedInterval)`.

### [LOW] Inconsistent Connection Pool Max Settings
- **Location**: `apps/api/src/db.ts:62,67` vs `packages/api-core/src/db.ts:41`
- **Issue**: The PUDA API uses `DB_POOL_MAX` env var with a default of `8` connections. The policing APIs (via `@puda/api-core`'s `createPool`) use `PG_POOL_MAX` env var with a default of `20`. Different env var names and different defaults for the same concept across the same system creates confusion. A developer setting `DB_POOL_MAX=15` for DOPAMS would have no effect because it reads `PG_POOL_MAX`.
- **Fix**: Standardize on a single env var name (e.g. `DB_POOL_MAX`) across all services, or document the per-service env var clearly. Consider prefixed variants (`DOPAMS_DB_POOL_MAX`, `SM_DB_POOL_MAX`) for per-service overrides.

---

## 7. Additional Findings

### [HIGH] SIEM Alert Forwarder Updates Each Row Individually Without Transaction
- **Location**: `apps/social-media-api/src/sla-scheduler.ts:42-59`
- **Issue**: The `forwardHighSeverityAlerts` function queries up to 50 alerts, then processes each one in a `for...of` loop with an individual `forwardToSiem()` call followed by an individual `UPDATE sm_alert SET siem_forwarded_at = NOW()`. If the process crashes midway, some alerts will have been forwarded to the SIEM but not marked as `siem_forwarded_at`, while others will not. On the next tick, the unmarked ones will be re-forwarded (duplicates), but the marked ones are fine. More critically, the `forwardToSiem` call on line 44 is fire-and-forget (it just pushes to an in-memory buffer) -- the `UPDATE` on line 56 marks the alert as forwarded before the SIEM actually receives it.
- **Fix**: Only mark alerts as `siem_forwarded_at` after a successful SIEM flush, not after buffering. Consider batch-updating all forwarded alert IDs in a single query after the flush succeeds.

### [MEDIUM] Missing actor_account Columns Referenced by Routes
- **Location**: `apps/social-media-api/migrations/030_actor_saved_search.sql` vs `apps/social-media-api/src/routes/actor.routes.ts:36-37`
- **Issue**: The route's SELECT includes `display_name` and `is_active` columns, but the `actor_account` migration table has `canonical_name` (not `display_name`) and no `is_active` column. The route also references `handles` which exists but as JSONB, not as a simple text column. Even after fixing the table name mismatch, these column mismatches will cause runtime SQL errors.
- **Fix**: Add a migration to add the missing columns, or update the route queries to use the correct column names (`canonical_name` instead of `display_name`).

### [MEDIUM] Missing Migration for notification_email_log Table (DOPAMS)
- **Location**: `apps/dopams-api/src/services/email-relay.ts:22-27`
- **Issue**: The email relay INSERTs into `notification_email_log` but no migration creates this table anywhere in the repository. The code silently catches the error with `.catch(() => {})`, so this failure is invisible.
- **Fix**: Create a migration: `CREATE TABLE IF NOT EXISTS notification_email_log (...)` with appropriate columns matching the INSERT statement (`recipient`, `subject`, `body`, `status`, `sent_at`).

### [LOW] Connector Scheduler Initial Poll Uses setTimeout Without Unref
- **Location**: `apps/social-media-api/src/connector-scheduler.ts:211`
- **Issue**: The initial poll is triggered with `setTimeout(() => runPollCycle(connectors), 5000)` without calling `.unref()`. While this timer fires quickly (5 seconds), it technically prevents graceful shutdown during startup if a SIGTERM arrives in that window.
- **Fix**: Add `.unref()` to the setTimeout call, or cancel it in `stopConnectorScheduler()`.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 7     |
| MEDIUM   | 10    |
| LOW      | 6     |
| **Total**| **25**|

### Critical Issues
1. N+1 query pattern in actor risk recalculation (unbounded loop with 2 queries per item)
2. Scheduled report and MR scanner jobs defined but never started (dead code)

### High Issues
1. Table name mismatch (actor_account vs sm_actor) breaks entire actor feature
2. PUDA API missing Helmet security headers
3. PUDA API missing unhandledRejection/uncaughtException handlers
4. setInterval timers not unrefed in background schedulers
5. Email relay silently swallows errors on missing table
6. Policing APIs do not enforce ALLOWED_ORIGINS in staging
7. SIEM alert forwarder marks alerts as forwarded before actual delivery

---

## Infrastructure Verdict: **FAIL**

The two CRITICAL findings (unbounded N+1 query loop and dead scheduled jobs) combined with the HIGH-severity table name mismatch (which renders an entire feature non-functional at runtime) constitute deployment blockers. The missing Helmet headers on the PUDA API and the absent crash handlers are also significant for a production-grade law enforcement system.

**Recommended remediation order:**
1. Fix table name mismatch (`sm_actor` vs `actor_account`) -- actor feature is completely broken
2. Add LIMIT + batching to actor risk recalculation endpoint
3. Wire up `startReportScheduler()` and `startMrScanner()` calls
4. Add Helmet to PUDA API
5. Add unhandledRejection/uncaughtException to PUDA API index.ts
6. Add `.unref()` to all scheduler setInterval calls
7. Fix SIEM forwarding to mark-after-delivery rather than mark-after-buffer
8. Remaining MEDIUM/LOW items
