# DOPAMS Infrastructure & Architecture Review

**Date:** 2026-03-11
**Scope:** DOPAMS API (`apps/dopams-api/`), DOPAMS UI (`apps/dopams-ui/`), shared packages (`packages/api-core/`, `packages/api-integrations/`), Nginx config, Docker, Docker Compose, monorepo build
**Verdict:** **AT-RISK**

---

## Summary

The DOPAMS app has a solid foundation -- multi-stage Docker builds, non-root containers, structured logging, graceful shutdown, advisory-lock-based SLA scheduling, and a well-layered shared-package architecture. However, there are critical secrets-management issues, medium-severity gaps in database connection resilience, missing caching layers for expensive dashboard queries, and some Nginx configuration oversights. The system is deployable but carries risk in production without addressing the CRITICAL and HIGH findings below.

---

## 1. System Architecture

### 1.1 Service Boundaries and Dependency Graph

**Severity: LOW** -- Well-structured

The monorepo uses npm workspaces with a clear layering:

```
packages/shared -> packages/workflow-engine -> packages/api-core -> packages/api-integrations -> apps/dopams-api
packages/shared -> apps/dopams-ui
```

Build ordering is enforced via `build:packages` in `package.json:16`:
```
npm run build:shared && npm run build:workflow-engine && npm run build:api-core && npm run build:api-integrations
```

**Finding 1.1.1 (LOW):** The `dopams-api` app has 48+ route registrations in `app.ts:224-270`. While functional, this monolithic route registration makes it hard to reason about the API surface. Consider grouping related routes under prefixed plugins (e.g., `app.register(dashboardPlugin, { prefix: '/api/v1/dashboard' })`).

- **File:** `apps/dopams-api/src/app.ts:224-270`

### 1.2 API Gateway Patterns

**Finding 1.2.1 (LOW):** The DOPAMS UI makes direct API calls from the browser to `apiBaseUrl` (defaults to `http://localhost:3011`). In production, this means the API and UI are on different origins, relying on CORS. The Nginx config (`nginx.conf`) does not proxy API requests -- it only serves the static SPA. This is a valid architecture for Cloud Run (separate services), but means no API gateway sits in front of the backend for request aggregation or caching.

- **File:** `apps/dopams-ui/src/types.ts:537-538`
- **File:** `nginx.conf:1-42`

### 1.3 Database Connection Management

**Finding 1.3.1 (MEDIUM):** The `createPool` function in `packages/api-core/src/db.ts:39-46` creates a pool with sensible defaults (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`, `statement_timeout: 30000`). However, there is no `idle_in_transaction_session_timeout` set. A long-running transaction that stalls (e.g., a held-open client from `getClient()` without proper `finally { client.release() }`) can hold a connection indefinitely, silently exhausting the pool.

- **File:** `packages/api-core/src/db.ts:39-46`
- **Recommendation:** Add `idle_in_transaction_session_timeout: 60000` to the pool config.

**Finding 1.3.2 (LOW):** The pool emits metrics every 30 seconds via `setInterval` (line 50-56), which is good. However, it uses `logWarnFn` for routine metrics, which inflates warn-level logs. Routine pool metrics should use `logInfo`.

- **File:** `packages/api-core/src/db.ts:50-56`

---

## 2. Performance

### 2.1 Database Query Optimization

**Finding 2.1.1 (HIGH):** The subject detail endpoint (`GET /api/v1/subjects/:id?include=entities`) fires **17 parallel queries** to load all entity sub-tables when `?include=entities` is requested. While `Promise.all` avoids sequential latency, each query acquires a separate pool connection. On a pool of max 20, a burst of 2 concurrent requests to this endpoint consumes all available connections.

- **File:** `apps/dopams-api/src/routes/subject.routes.ts:322-468`
- **Recommendation:** Batch the 17 queries into 3-4 groups using `UNION ALL` or a single CTE-based query. Alternatively, increase `PG_POOL_MAX` to at least 40 and add a concurrency limiter.

**Finding 2.1.2 (HIGH):** The dashboard analytics endpoint (`GET /api/v1/dashboard/analytics`) fires **10 parallel queries** on every request. These queries scan `alert`, `lead`, `dopams_case`, `subject_profile`, and `organization_unit` tables with no caching. For a system with thousands of records, each request generates significant database load.

- **File:** `apps/dopams-api/src/routes/dashboard.routes.ts:221-307`
- **Recommendation:** Add a TTL-based in-memory cache (60-120 seconds) for dashboard aggregate results. The data does not change between successive requests within that window.

**Finding 2.1.3 (MEDIUM):** The facets endpoint (`GET /api/v1/subjects/facets`) fires **6 parallel GROUP BY queries** on the `subject_profile` table. These full-table scans could be expensive as the table grows. No indexes exist for `offender_status`, `cdr_status`, or `threat_level` on `subject_profile`.

- **File:** `apps/dopams-api/src/routes/subject.routes.ts:266-288`
- **Recommendation:** Add partial indexes on frequently filtered columns: `CREATE INDEX CONCURRENTLY idx_sp_offender_status ON subject_profile(offender_status)`, `idx_sp_cdr_status ON subject_profile(cdr_status)`, `idx_sp_threat_level ON subject_profile(threat_level)`.

**Finding 2.1.4 (MEDIUM):** The `COUNT(*) OVER()` window function used in list endpoints (e.g., `subject.routes.ts:244`, `alert.routes.ts:36`) requires the database to compute the full result set before applying LIMIT/OFFSET. For large tables, this means every paginated list query scans the entire filtered result. This is acceptable for moderate dataset sizes but will degrade at scale.

- **File:** `apps/dopams-api/src/routes/subject.routes.ts:244`
- **Recommendation:** Consider a separate `SELECT COUNT(*)` query only when the client needs the total, or cache the total for a short TTL.

### 2.2 Missing Caching

**Finding 2.2.1 (MEDIUM):** No application-level caching is present for read-heavy endpoints like `/api/v1/alerts/facets`, `/api/v1/subjects/facets`, `/api/v1/dashboard/stats`, `/api/v1/graph/kingpins`. Each request hits the database directly. The LLM provider config has a 60-second cache (`llm-provider.ts:294`), which is a good pattern that should be extended to other hot data.

- **Recommendation:** Implement a simple Map-based TTL cache (or use `lru-cache`) for facets, dashboard aggregates, and graph summaries. A 30-60 second TTL would significantly reduce DB load.

### 2.3 Pagination

**Finding 2.3.1 (LOW):** Pagination is consistently implemented across all list endpoints with `LIMIT/OFFSET`, max limits (typically 200), and input validation. This is well done.

---

## 3. Reliability

### 3.1 Graceful Shutdown

**Finding 3.1.1 (LOW):** Graceful shutdown is well-implemented in `apps/dopams-api/src/index.ts:12-40`. It handles SIGTERM/SIGINT, stops the SLA scheduler, closes the Fastify server, ends the pool, and has a force-exit timeout. The idempotency guard (`isShuttingDown`) prevents double-shutdown. This is production-ready.

- **File:** `apps/dopams-api/src/index.ts:12-40`

### 3.2 Health Checks

**Finding 3.2.1 (LOW):** Two health endpoints are correctly implemented:
- `/health` -- lightweight liveness check (line 211)
- `/ready` -- readiness check with DB connectivity verification (lines 213-222)

The Docker HEALTHCHECK uses `/ready`, which is correct. Both are excluded from rate limiting and authentication.

- **File:** `apps/dopams-api/src/app.ts:211-222`
- **File:** `Dockerfile.dopams-api:94-95`

### 3.3 Error Recovery

**Finding 3.3.1 (MEDIUM):** The error handler in `app.ts:181-189` catches and logs 5xx errors, returning a generic message. This is correct. However, `unhandledRejection` and `uncaughtException` handlers in `index.ts:44-51` call `process.exit(1)` immediately without draining in-flight requests. In the `unhandledRejection` case, the process exits without calling the graceful shutdown sequence.

- **File:** `apps/dopams-api/src/index.ts:44-47`
- **Recommendation:** Change the `unhandledRejection` handler to call `shutdown("unhandledRejection")` instead of `process.exit(1)` directly.

### 3.4 Circuit Breakers and Retry Logic

**Finding 3.4.1 (LOW):** The LLM provider has a well-implemented per-host circuit breaker with 5-failure threshold and 60-second cooldown (`llm-provider.ts:261-288`). It also has exponential backoff retry with `resilientFetch` (lines 426-466). This is solid.

**Finding 3.4.2 (LOW):** The audit logger has its own circuit breaker (`audit-logger.ts:57-72`): after 5 consecutive audit write failures, it blocks all mutation endpoints with 503. This is an appropriate fail-closed design for an audit-critical system.

### 3.5 SLA Scheduler Resilience

**Finding 3.5.1 (MEDIUM):** The SLA scheduler processes overdue tasks in a loop (`sla-scheduler.ts:52-65`), but if `executeTransition` throws an unexpected error (not just a missing transition), it catches and silently continues. This means a corrupted task row could cause the scheduler to attempt the same broken transition every 60 seconds indefinitely.

- **File:** `packages/api-core/src/scheduler/sla-scheduler.ts:52-65`
- **Recommendation:** Track failed task IDs and skip them after N consecutive failures.

### 3.6 Migration Runner Resilience

**Finding 3.6.1 (MEDIUM):** The migration runner (`migrate-runner.ts:49-61`) runs individual migration SQL files via `query(sql)`, which means each migration runs as a single implicit transaction. If a migration file contains multiple DDL statements and one fails partway through, the migration is partially applied (PostgreSQL does auto-commit between DDL statements in some configurations). The `ROLLBACK` on line 55 only resets the aborted transaction state, not the partial DDL.

- **File:** `apps/dopams-api/src/migrate-runner.ts:49-61`
- **Recommendation:** Wrap each migration in an explicit `BEGIN; ... COMMIT;` block within the migration SQL files, or use `client.query()` with explicit transaction management.

---

## 4. Observability

### 4.1 Logging Strategy

**Finding 4.1.1 (LOW):** Structured JSON logging is implemented via `packages/api-core/src/logging/logger.ts`. Each log line includes `timestamp`, `level`, `message`, `requestId`, and arbitrary fields. PII is redacted via `redact.ts` before logging. This is production-ready.

- **File:** `packages/api-core/src/logging/logger.ts:1-24`
- **File:** `packages/api-core/src/logging/redact.ts:1-50`

### 4.2 Request Tracing

**Finding 4.2.1 (MEDIUM):** Request ID is set in `onRequest` hook (`app.ts:198-199`) using Fastify's built-in `request.id`. However, there is no distributed trace propagation -- no `X-Request-Id` or `traceparent` header is forwarded to downstream services (e.g., LLM providers, external integrations). For a system that calls external APIs (CCTNS, e-Courts, UNOCROSS, LLM providers), this makes cross-service debugging difficult.

- **File:** `apps/dopams-api/src/app.ts:198-199`
- **Recommendation:** Add `request.id` as `X-Request-Id` header in outgoing HTTP calls (LLM provider, external connectors).

### 4.3 Slow Request Detection

**Finding 4.3.1 (LOW):** Slow requests (>1000ms) are detected and logged in the `onResponse` hook (`app.ts:202-209`). Slow queries (>500ms) are detected and logged in the DB wrapper (`api-core/src/db.ts:63-64`). Both use structured log fields (`durationMs`, `method`, `url`). This is well done.

### 4.4 Metrics

**Finding 4.4.1 (MEDIUM):** There are no Prometheus-compatible metrics endpoints. Pool metrics are logged to stdout every 30 seconds, but there is no `/metrics` endpoint for scraping. Cloud Run provides built-in request metrics, but application-level metrics (query latency histograms, LLM call counts, cache hit rates) are only available through log parsing.

- **Recommendation:** Add a lightweight `/metrics` endpoint using `fastify-metrics` or a custom handler that exposes key counters/histograms.

### 4.5 Error Reporting (Frontend)

**Finding 4.5.1 (LOW):** The DOPAMS UI integrates Sentry via `@puda/shared/error-reporting` in `main.tsx:10-14`. The DSN is injected via `VITE_SENTRY_DSN` at build time. This is correct for production error tracking.

- **File:** `apps/dopams-ui/src/main.tsx:10-14`

---

## 5. Build & Deploy

### 5.1 Dockerfile Quality

**Finding 5.1.1 (LOW):** The API Dockerfile (`Dockerfile.dopams-api`) uses a proper 3-stage multi-stage build:
1. `deps` -- installs dependencies (cached separately from source)
2. `build` -- compiles TypeScript
3. `production` -- production-only deps + compiled output

Non-root user (`appuser:1001`) is configured. `NODE_ENV=production` is set. HEALTHCHECK is configured to hit `/ready`. Migration runner runs before the app starts (`CMD`). This is production-grade.

- **File:** `Dockerfile.dopams-api:1-99`

**Finding 5.1.2 (LOW):** The UI Dockerfile (`Dockerfile.dopams-ui`) uses a 2-stage build with `nginxinc/nginx-unprivileged:1.27-alpine`, which is a secure choice (runs as non-root by default). Build-time args (`VITE_API_BASE_URL`) are properly injected. HEALTHCHECK uses `wget`. This is well done.

- **File:** `Dockerfile.dopams-ui:1-55`

### 5.2 .dockerignore

**Finding 5.2.1 (LOW):** The `.dockerignore` correctly excludes `.git`, `node_modules`, `dist`, `.env`, test files, docs, IDE config, and AI tooling. This keeps image sizes minimal.

- **File:** `.dockerignore:1-47`

### 5.3 Build Script Correctness

**Finding 5.3.1 (LOW):** The `build:dopams` script correctly builds all packages before the app:
```
npm run build:packages && npm --workspace apps/dopams-api run build
```

- **File:** `package.json:26`

### 5.4 Node.js Version

**Finding 5.4.1 (LOW):** Both Dockerfiles use `node:20-alpine`, which is Node.js 20 LTS. This is the correct choice for production stability.

---

## 6. Configuration

### 6.1 Environment Variable Management

**Finding 6.1.1 (CRITICAL):** The root `.env` file contains **live API keys and secrets in plaintext**:
- `YOUTUBE_API_KEY=AIzaSyAOZCQh1...` (line 36)
- `TWITTER_BEARER_TOKEN=AAAAA...` (line 37)
- `APIFY_API_KEY=apify_api_tMAAH...` (line 38)
- `OPEN_AI_API_KEY=sk-proj-7Zh5...` (line 40)

While `.env` is in `.gitignore` and not tracked by git, these keys are present on the developer machine in plaintext. If the working directory is ever shared, backed up, or accessed by another tool, these secrets are exposed.

- **File:** `.env:36-40`
- **Recommendation:** Rotate all exposed keys immediately. Use a secrets manager (e.g., Google Secret Manager for Cloud Run) or at minimum, reference secrets via environment variable names only in `.env.example` and inject them at runtime.

### 6.2 Config Validation

**Finding 6.2.1 (LOW):** Production guards are in place:
- `ALLOWED_ORIGINS` is required in production (`app.ts:68-69`)
- `JWT_SECRET` is required in production (`auth-middleware.ts:31-34`)
- `DATABASE_SSL=false` is blocked in production except for Cloud SQL Unix sockets (`db.ts:26-28`)
- `DATABASE_URL` is required in non-test environments (`db.ts:17-18`)

These are correct fail-fast checks.

### 6.3 Default Dev Secrets

**Finding 6.3.1 (HIGH):** The auth middleware uses a hardcoded dev secret as fallback when `JWT_SECRET` is not set:
```typescript
defaultDevSecret: "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"
```
While the production guard in `getJwtSecret()` throws if `JWT_SECRET` is missing in production (`auth-middleware.ts:31-33`), the default secret string appears in two places in `app.ts` (lines 287 and 298). If `NODE_ENV` is ever misconfigured or omitted, the app would silently use this predictable secret.

- **File:** `apps/dopams-api/src/app.ts:287,298`
- **File:** `apps/dopams-api/src/middleware/auth.ts:9`
- **Recommendation:** Log a prominent warning at startup when the dev secret is being used, even in non-production environments.

### 6.4 JWT Expiration

**Finding 6.4.1 (MEDIUM):** The `.env.example` shows `JWT_EXPIRES_IN=24h` and the root `.env` also sets `JWT_EXPIRES_IN=24h`. This is excessively long for a law enforcement system handling sensitive intelligence data. The auth middleware default is `30m` (`auth-middleware.ts:76`), which is reasonable, but environment configuration overrides it to 24 hours.

- **File:** `apps/dopams-api/.env.example:12`
- **File:** `.env:22`
- **Recommendation:** Use the 30-minute default. If longer sessions are needed, use refresh tokens or sliding-window session extension via the existing `updateSessionActivity` mechanism.

### 6.5 Feature Flags

**Finding 6.5.1 (LOW):** Feature flags are implemented via environment variables (e.g., `VITE_ENABLE_ASSISTANT`, `LDAP_URL`, `OIDC_ISSUER_URL`). LDAP and OIDC routes are conditionally registered based on env presence (`app.ts:277,294`). This is a reasonable approach for infrastructure-level toggles.

---

## 7. Database

### 7.1 Migration Strategy

**Finding 7.1.1 (MEDIUM):** There are **63 migration files** (001 through 063), all using sequential numbering and `IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency. The migration runner (`migrate-runner.ts`) handles "existing DB" gracefully by catching and skipping errors from already-applied DDL. However:

- Migrations are not wrapped in transactions (see Finding 3.6.1)
- No down-migration support exists
- No migration locking is present (two pods starting simultaneously could run migrations concurrently)

- **File:** `apps/dopams-api/src/migrate-runner.ts`
- **Recommendation:** Add `pg_advisory_lock` in the migration runner to prevent concurrent migration execution.

### 7.2 Schema Design

**Finding 7.2.1 (LOW):** The schema uses UUID primary keys (`uuid_generate_v4()`), TIMESTAMPTZ for all timestamps, JSONB for flexible data, and proper foreign key constraints. Row-level versioning (`row_version INTEGER`) is used for optimistic concurrency. This is well-designed.

**Finding 7.2.2 (MEDIUM):** The `subject_profile` table has grown to 90+ columns across migrations 001, 028, 038, 061, and 062. While PostgreSQL handles wide tables efficiently due to TOAST compression for large columns, this makes INSERT statements extremely unwieldy (97 parameters in `subject.routes.ts:552-575`). This increases the risk of parameter misalignment bugs.

- **File:** `apps/dopams-api/src/routes/subject.routes.ts:527-629`
- **Recommendation:** Consider refactoring the INSERT/UPDATE into a builder pattern or ORM layer that maps field names to columns dynamically, reducing the risk of positional parameter errors.

### 7.3 Indexing

**Finding 7.3.1 (MEDIUM):** Primary entities (`subject_profile`, `alert`, `lead`, `dopams_case`) have indexes on `state_id`, `unit_id`, and `created_at`. Full-text search indexes (GIN with `tsvector` and `pg_trgm`) are present for `alert`, `lead`, and `subject_profile`. Financial transaction tables have indexes on sender/receiver FK columns and `is_suspicious`.

However, several columns used in WHERE clauses lack indexes:
- `subject_profile.offender_status` (used in list filter and facets)
- `subject_profile.cdr_status` (used in list filter and facets)
- `subject_profile.threat_level` (used in list filter and facets)
- `subject_profile.district` (used in list filter and facets)
- `subject_profile.is_active` (used in analytics top-risk query, line 304)
- `alert.due_at` (used in SLA calculations, control-room dashboard)
- `task.sla_due_at` (used in SLA scheduler, line 48)

- **Recommendation:** Add these indexes in a new migration:
```sql
CREATE INDEX CONCURRENTLY idx_sp_offender_status ON subject_profile(offender_status);
CREATE INDEX CONCURRENTLY idx_sp_cdr_status ON subject_profile(cdr_status);
CREATE INDEX CONCURRENTLY idx_sp_threat_level ON subject_profile(threat_level);
CREATE INDEX CONCURRENTLY idx_sp_district ON subject_profile(district);
CREATE INDEX CONCURRENTLY idx_alert_due_at ON alert(due_at) WHERE state_id NOT IN ('CLOSED','RESOLVED');
CREATE INDEX CONCURRENTLY idx_task_sla_due ON task(sla_due_at) WHERE status IN ('PENDING','IN_PROGRESS') AND sla_due_at IS NOT NULL;
```

### 7.4 Connection Pool Settings

**Finding 7.4.1 (LOW):** Pool max is configurable via `PG_POOL_MAX` env var (default 20). The `.env` file sets it to 8. The idle timeout (30s), connection timeout (5s), and statement timeout (30s) are sensible defaults.

- **File:** `packages/api-core/src/db.ts:41-44`
- **File:** `.env:33`

---

## 8. Nginx / Proxy

### 8.1 Reverse Proxy Configuration

**Finding 8.1.1 (MEDIUM):** The Nginx config serves as a static file server only -- it does not proxy API requests. This means in production, the UI service and API service are completely separate. The Nginx config is shared across all UI apps (`dopams-ui`, `forensic-ui`, `social-media-ui`) via the same `nginx.conf` template. This is correct for Cloud Run where each service gets its own URL, but means:

- No API request buffering or connection pooling at the proxy level
- No request-level rate limiting at the edge (only Fastify-level rate limiting)
- No unified access logs for both static and API traffic

- **File:** `nginx.conf:1-42`

### 8.2 Security Headers

**Finding 8.2.1 (LOW):** Comprehensive security headers are configured:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 0` (correct -- modern recommendation is to disable it)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` with restrictive directives
- `Permissions-Policy` denying camera, microphone, geolocation, payment
- `server_tokens off` to hide Nginx version

This is a strong security header configuration.

**Finding 8.2.2 (MEDIUM):** The CSP `connect-src` directive includes `http://localhost:*` (line 17 and 35), which should be removed in production builds. This allows the SPA to make requests to any localhost port, which could be exploited if an attacker is running a local service on the same machine.

- **File:** `nginx.conf:17,35`
- **Recommendation:** Use a build-time template to strip `http://localhost:*` from CSP in production. Only include the actual API domain.

### 8.3 Compression

**Finding 8.3.1 (LOW):** Gzip is enabled with a reasonable `min_length` of 256 bytes and covers all relevant content types (JSON, JS, CSS, XML). This is correct.

- **File:** `nginx.conf:39-41`

### 8.4 Caching

**Finding 8.4.1 (LOW):** Static assets under `/assets/` get `Cache-Control: public, immutable` with a 1-year expiry (`nginx.conf:22-24`). Vite generates content-hashed filenames, making this safe. `index.html` is explicitly set to `no-cache, no-store, must-revalidate` so deploys take effect immediately. This is a textbook SPA caching strategy.

- **File:** `nginx.conf:13-18,21-24`

---

## 9. Docker Compose

### 9.1 Container Security

**Finding 9.1.1 (LOW):** The API containers use `read_only: true`, `tmpfs: [/tmp]`, and `security_opt: [no-new-privileges:true]`. This is a defense-in-depth approach that limits the blast radius of a container compromise.

- **File:** `docker-compose.yml:192-196`

### 9.2 Database Health Checks

**Finding 9.2.1 (LOW):** All PostgreSQL containers have health checks with `pg_isready`, and API containers use `depends_on: condition: service_healthy`. This ensures APIs don't start before the database is ready.

- **File:** `docker-compose.yml:178-185,209-210`

### 9.3 Network Isolation

**Finding 9.3.1 (LOW):** Backend networks (`dopams-backend`, `sm-backend`, `forensic-backend`) are marked `internal: true`, meaning the database containers are not directly accessible from the host network. Only the API containers bridge between internal and frontend networks. This is a good security practice.

- **File:** `docker-compose.yml:293-302`

### 9.4 Volume Persistence

**Finding 9.4.1 (LOW):** Database volumes are named (`dopams_pg_data`), ensuring data persists across container restarts.

- **File:** `docker-compose.yml:304-310`

---

## 10. Security (Infrastructure-Specific)

### 10.1 Secrets in Source Tree

**Finding 10.1.1 (CRITICAL):** The `.env` file at the repo root contains live API keys for YouTube, Twitter, Apify, and OpenAI. While `.env` is in `.gitignore` and is not tracked by git, the keys are present in plaintext on the developer filesystem. This is a policy violation for a law enforcement system.

- **File:** `.env:36-40`
- **Impact:** If any developer workstation is compromised, backups are made, or the directory is shared, these keys leak.
- **Recommendation:** Immediately rotate all affected keys. Move to a secrets manager. Never store production API keys in `.env` files, even untracked ones.

### 10.2 Auth Token in localStorage

**Finding 10.2.1 (HIGH):** The DOPAMS UI stores the JWT token in `localStorage` (`useAuth.ts:29-30`). This makes the token accessible to any JavaScript running on the page (including XSS payloads). The API also supports `httpOnly` cookies (`auth-middleware.ts:80-88`), but the UI does not use cookie-based auth.

- **File:** `apps/dopams-ui/src/useAuth.ts:29-30`
- **Recommendation:** Switch to cookie-based auth (the server-side cookie support already exists). Remove `localStorage` token storage.

### 10.3 Rate Limiting

**Finding 10.3.1 (LOW):** Rate limiting is configured at 100 req/min for GET and 30 req/min for mutations (`app.ts:101-130`). Health and ready endpoints are excluded. Auth login has its own stricter limit (mentioned in code comment, line 108). This is well-configured.

---

## Findings Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 10.1.1 | **CRITICAL** | Configuration | Live API keys (YouTube, Twitter, Apify, OpenAI) in plaintext `.env` file |
| 2.1.1 | **HIGH** | Performance | 17 parallel DB queries for subject detail exhaust connection pool |
| 2.1.2 | **HIGH** | Performance | 10 parallel uncached dashboard analytics queries on every request |
| 6.3.1 | **HIGH** | Configuration | Hardcoded dev JWT secret with no startup warning |
| 10.2.1 | **HIGH** | Security | JWT stored in localStorage instead of httpOnly cookie |
| 1.3.1 | **MEDIUM** | Architecture | No `idle_in_transaction_session_timeout` on DB pool |
| 2.1.3 | **MEDIUM** | Performance | Missing indexes on subject facet columns |
| 2.1.4 | **MEDIUM** | Performance | `COUNT(*) OVER()` forces full result computation on paginated queries |
| 2.2.1 | **MEDIUM** | Performance | No application-level caching for read-heavy endpoints |
| 3.3.1 | **MEDIUM** | Reliability | `unhandledRejection` exits without graceful shutdown |
| 3.5.1 | **MEDIUM** | Reliability | SLA scheduler retries failed tasks indefinitely |
| 3.6.1 | **MEDIUM** | Reliability | Migrations not wrapped in explicit transactions |
| 4.2.1 | **MEDIUM** | Observability | No distributed trace propagation to external services |
| 4.4.1 | **MEDIUM** | Observability | No Prometheus metrics endpoint |
| 6.4.1 | **MEDIUM** | Configuration | JWT expiry set to 24h (excessive for law enforcement system) |
| 7.1.1 | **MEDIUM** | Database | No advisory lock in migration runner to prevent concurrent execution |
| 7.2.2 | **MEDIUM** | Database | 97-parameter INSERT for 90+ column subject_profile table |
| 7.3.1 | **MEDIUM** | Database | Missing indexes on frequently filtered columns |
| 8.2.2 | **MEDIUM** | Nginx | CSP allows `http://localhost:*` in connect-src |
| 8.1.1 | **MEDIUM** | Nginx | No API proxy -- UI and API are completely separate services |
| 1.1.1 | **LOW** | Architecture | 48+ monolithic route registrations in app.ts |
| 1.2.1 | **LOW** | Architecture | No API gateway between UI and backend |
| 1.3.2 | **LOW** | Architecture | Pool metrics logged at WARN level |
| 2.3.1 | **LOW** | Performance | Pagination well-implemented (positive) |
| 3.1.1 | **LOW** | Reliability | Graceful shutdown well-implemented (positive) |
| 3.2.1 | **LOW** | Reliability | Health checks well-implemented (positive) |
| 3.4.1 | **LOW** | Reliability | LLM circuit breaker well-implemented (positive) |
| 3.4.2 | **LOW** | Reliability | Audit circuit breaker well-implemented (positive) |
| 4.1.1 | **LOW** | Observability | Structured JSON logging well-implemented (positive) |
| 4.3.1 | **LOW** | Observability | Slow request/query detection well-implemented (positive) |
| 4.5.1 | **LOW** | Observability | Sentry integration present (positive) |
| 5.1.1 | **LOW** | Build | Multi-stage Dockerfile well-implemented (positive) |
| 5.1.2 | **LOW** | Build | UI Dockerfile well-implemented (positive) |
| 5.2.1 | **LOW** | Build | .dockerignore well-configured (positive) |
| 5.4.1 | **LOW** | Build | Node 20 LTS used (positive) |
| 6.2.1 | **LOW** | Configuration | Production guards well-implemented (positive) |
| 6.5.1 | **LOW** | Configuration | Feature flags via env vars (positive) |
| 7.2.1 | **LOW** | Database | Schema design well-structured (positive) |
| 7.4.1 | **LOW** | Database | Pool settings sensible (positive) |
| 8.2.1 | **LOW** | Nginx | Security headers comprehensive (positive) |
| 8.3.1 | **LOW** | Nginx | Gzip configured correctly (positive) |
| 8.4.1 | **LOW** | Nginx | SPA caching strategy correct (positive) |
| 9.1.1 | **LOW** | Docker Compose | Read-only containers (positive) |
| 9.2.1 | **LOW** | Docker Compose | DB health checks (positive) |
| 9.3.1 | **LOW** | Docker Compose | Network isolation (positive) |
| 9.4.1 | **LOW** | Docker Compose | Named volumes (positive) |

---

## Verdict: AT-RISK

**Rationale:** The DOPAMS infrastructure has strong fundamentals -- multi-stage Docker builds, non-root containers, structured logging, graceful shutdown, health checks, and proper network isolation. However, the CRITICAL finding (plaintext API keys in `.env`) and HIGH findings (connection pool exhaustion risk, no dashboard caching, JWT in localStorage, dev secret without warning) represent real production risks. The MEDIUM findings (missing indexes, no distributed tracing, migration concurrency, CSP localhost wildcard) are gaps that will cause operational pain as the system scales.

**To move to PASS:**
1. Rotate all exposed API keys and move to a secrets manager
2. Add connection pool protection (reduce parallel queries or increase pool size)
3. Add in-memory caching for dashboard/facets endpoints
4. Switch UI to httpOnly cookie auth
5. Add missing database indexes
6. Add advisory lock to migration runner
7. Remove `http://localhost:*` from production CSP
