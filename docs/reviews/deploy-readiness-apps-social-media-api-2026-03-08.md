# Deploy Readiness Report: Social Media API

**App**: `apps/social-media-api`
**Date**: 2026-03-08
**Verdict**: PASS (Docker-only; GCloud auth expired)

---

## Phase 0: Preflight

| Item | Value |
|------|-------|
| Node.js | v20.19.2 |
| npm | 10.8.2 |
| Docker | 29.1.3 |
| Docker Compose | v2.40.3-desktop.1 |
| Docker daemon | Running (Docker Desktop) |
| GCloud project | `policing-apps` |
| GCloud account | `vk@adssoftek.com` |
| GCloud region | Not set |
| GCloud auth | EXPIRED (non-interactive session, cannot re-auth) |
| Platform | macOS Darwin 23.6.0 |

---

## Phase 1: Environment Variable Audit

### Required Variables

| Variable | Source | Default | Production Required | Status |
|----------|--------|---------|---------------------|--------|
| `SM_DATABASE_URL` | `createPool({ envPrefix: "SM" })` | None (falls back to `DATABASE_URL`) | Yes (fatal error if missing) | OK |
| `JWT_SECRET` | `createAuthMiddleware` | `sm-dev-secret-DO-NOT-USE-IN-PRODUCTION` | Yes (fatal error if missing) | OK |
| `NODE_ENV` | Standard | `undefined` | Recommended `production` | OK |
| `PORT` | `index.ts` | `3004` | Set by Cloud Run automatically | OK |
| `ALLOWED_ORIGINS` | `app.ts` | Empty array (fatal if missing in prod) | Yes | OK |

### Optional Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `SM_API_HOST` | Bind address | `0.0.0.0` |
| `SM_API_PORT` | Fallback port | `3004` |
| `DATABASE_SSL` | SSL config | Auto (reject unauthorized) |
| `DATABASE_SSL_CA_BASE64` | SSL CA cert (base64) | None |
| `DATABASE_SSL_CA_PATH` | SSL CA cert (file path) | None |
| `SHUTDOWN_TIMEOUT_MS` | Graceful shutdown timeout | `15000` |
| `RATE_LIMIT_MAX` | Global rate limit | `100` |
| `RATE_LIMIT_WINDOW` | Rate limit window | `1 minute` |
| `YOUTUBE_API_KEY` | YouTube connector | None (connector skipped) |
| `TWITTER_BEARER_TOKEN` | Twitter connector | None (connector skipped) |
| `META_ACCESS_TOKEN` | Meta connector | None (connector skipped) |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram connector | None (connector skipped) |
| `CONNECTOR_POLL_INTERVAL_MS` | Connector polling interval | `300000` (5 min) |
| `ALERT_THREAT_THRESHOLD` | Alert auto-creation threshold | `40` |
| `CLASSIFICATION_CONFIDENCE_THRESHOLD` | Auto-classify threshold | `60` |
| `EVIDENCE_STORAGE_DIR` | Evidence file storage | `/data/evidence` |
| `PII_ENCRYPTION_KEY` | PII encryption key | None (PII encryption disabled) |
| `MFA_REVALIDATION_HOURS` | MFA session revalidation | `8` |
| `SIEM_ENABLED` | SIEM forwarding | `false` |
| `SIEM_ENDPOINT` | SIEM webhook/syslog endpoint | None |
| `SIEM_TRANSPORT` | SIEM transport type | `webhook` |
| `SIEM_FORMAT` | SIEM format | `json` |
| `SIEM_BATCH_SIZE` | SIEM batch size | `50` |
| `SIEM_FLUSH_INTERVAL_MS` | SIEM flush interval | `30000` |
| `PG_POOL_MAX` | DB connection pool max | `20` |
| `LDAP_URL` | LDAP auth (optional) | None (LDAP disabled) |
| `LDAP_BASE_DN` | LDAP base DN | Empty |
| `LDAP_BIND_DN` | LDAP bind DN | None |
| `LDAP_BIND_PASSWORD` | LDAP bind password | None |
| `OIDC_ISSUER_URL` | OIDC auth (optional) | None (OIDC disabled) |
| `OIDC_CLIENT_ID` | OIDC client ID | `social-media` |
| `OIDC_CLIENT_SECRET` | OIDC client secret | None |
| `OIDC_REDIRECT_URI` | OIDC redirect URI | `http://localhost:3004/api/v1/auth/oidc/callback` |

### Security Notes

- `JWT_SECRET` defaults to a dev secret in non-production; **fatal error** in production if not set.
- `DATABASE_SSL=false` is **blocked in production** unless using Cloud SQL Unix sockets.
- `ALLOWED_ORIGINS` is **required in production** (fatal error if missing).

---

## Phase 2: Deployment Readiness

### Dockerfile Audit (`Dockerfile.social-media-api`)

| Check | Result |
|-------|--------|
| Multi-stage build | 3 stages: deps, build, production |
| Base image | `node:20-alpine` (matches local Node v20) |
| Non-root user | `appuser:1001` in `appgroup:1001` |
| Build order | shared -> workflow-engine -> api-core -> api-integrations -> social-media-api |
| Workspace package.json files | All 5 required packages copied |
| Production deps only | `npm ci --omit=dev` in production stage |
| NODE_ENV | Set to `production` |
| EXPOSE | 8080 (matches Cloud Run default) |
| HEALTHCHECK | `/ready` endpoint (verifies DB connectivity) |
| CMD | `node apps/social-media-api/dist/index.js` |
| Workflow definitions | Copied from `src/workflow-definitions/` to `dist/workflow-definitions/` |
| Migrations | Copied to `apps/social-media-api/migrations/` |
| `.dockerignore` | Comprehensive (excludes node_modules, dist, .env, tests, docs) |

### PORT Compliance

- `index.ts` reads `PORT` env var (line 9): `Number(process.env.PORT || process.env.SM_API_PORT || 3004)`
- Binds to `0.0.0.0` (line 10): `process.env.SM_API_HOST || "0.0.0.0"`
- Cloud Run sets `PORT=8080` automatically. Docker-compose sets `PORT=8080`.

### Health Check Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /health` | Liveness (no DB check) | Returns `{"status":"ok"}` |
| `GET /ready` | Readiness (DB connectivity check) | Returns `{"status":"ok"}` or `503` |

### docker-compose.yml Configuration

| Setting | Value | Assessment |
|---------|-------|------------|
| Port mapping | `3010:8080` | OK |
| `read_only: true` | Enabled | Security hardened |
| `tmpfs: /tmp` | Enabled | Required for read-only filesystem |
| `no-new-privileges` | Enabled | Security hardened |
| DB dependency | `service_healthy` on `social-media-db` | Correct |
| Command override | Runs migrate-runner before app start | Correct |
| Networks | `sm-backend` (internal) + `frontend` | Correct |

### Graceful Shutdown

- SIGTERM/SIGINT handlers implemented
- Stops connector scheduler, SLA scheduler
- Closes Fastify app, ends DB pool
- Forced exit after configurable timeout (default 15s)
- `unhandledRejection` and `uncaughtException` handlers

---

## Phase 3: Fixes Applied

### Fix 1: Audit Logger Table Name Mismatch

**File**: `apps/social-media-api/src/middleware/audit-logger.ts`
**Issue**: `createAuditLogger()` defaulted to table `audit_event`, but social-media-api uses `audit_log`.
**Fix**: Pass `tableName: "audit_log"` to `createAuditLogger()`.

```diff
- const auditLogger = createAuditLogger({ queryFn: query });
+ const auditLogger = createAuditLogger({ queryFn: query, tableName: "audit_log" });
```

### Fix 2: Audit Logger Nil UUID for Missing Entity ID

**File**: `packages/api-core/src/middleware/audit-logger.ts`
**Issue**: Fallback `entityId || "N/A"` was invalid for UUID column `entity_id NOT NULL`.
**Fix**: Use nil UUID `00000000-0000-0000-0000-000000000000` as fallback.

```diff
- [entityType || "unknown", entityId || "N/A", ...]
+ [entityType || "unknown", entityId || "00000000-0000-0000-0000-000000000000", ...]
```

### Fix 3: Audit Logger Nil UUID for Unauthenticated Actor ID

**File**: `packages/api-core/src/middleware/audit-logger.ts`
**Issue**: `actorId` was `null` for unauthenticated requests, but `actor_id` column is `UUID NOT NULL`.
**Fix**: Use nil UUID as fallback.

```diff
- const actorId = (request as any).authUser?.userId ?? null;
+ const actorId = (request as any).authUser?.userId ?? "00000000-0000-0000-0000-000000000000";
```

### Tests After Fixes

| Test Suite | Result |
|------------|--------|
| Social Media API (155 tests) | All pass |
| DOPAMS API (93 tests) | All pass |
| Forensic API (351 tests) | All pass |

---

## Phase 4: Docker Build

| Metric | Value |
|--------|-------|
| Build result | SUCCESS |
| Build time | ~22s (clean) / ~12s (cached deps) |
| Image size | 349 MB |
| TypeScript compilation | Zero errors |
| npm audit | 1 moderate vulnerability (production deps) |

---

## Phase 5: Docker Sanity Tests

### Endpoint Tests

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| `GET /health` | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| `GET /ready` | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| `POST /api/v1/auth/login` (bad creds) | 401 | 401 `INVALID_CREDENTIALS` | PASS |
| `GET /api/v1/alerts` (no auth) | 401 | 401 `AUTHENTICATION_REQUIRED` | PASS |
| `GET /api/v1/alerts` (invalid token) | 401 | 401 `INVALID_TOKEN` | PASS |
| CORS preflight (OPTIONS) | 204 with CORS headers | 204 with proper headers | PASS |

### Security Headers (Helmet)

| Header | Present |
|--------|---------|
| Content-Security-Policy | Yes |
| Strict-Transport-Security | Yes (max-age=15552000) |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | SAMEORIGIN |
| X-XSS-Protection | 0 (disabled per modern best practice) |
| Referrer-Policy | no-referrer |
| Cross-Origin-Opener-Policy | same-origin |
| Cross-Origin-Resource-Policy | same-origin |

### Rate Limiting

| Check | Result |
|-------|--------|
| `x-ratelimit-limit` header | Present (100) |
| `x-ratelimit-remaining` header | Present |
| `x-ratelimit-reset` header | Present (60s window) |

### Container Metrics

| Metric | Value |
|--------|-------|
| CPU usage | ~1% |
| Memory usage | ~47 MB |
| PIDs | 11 |
| Health status | healthy |

### Audit Logging

| Check | Result |
|-------|--------|
| `AUDIT_LOG_FAILURE` in logs | ZERO (all fixes working) |
| Audit writes for unauthenticated requests | Working (nil UUID fallback) |

---

## Phase 6: GCloud Deployment

**Status**: SKIPPED (Docker-only mode)

**Reason**: GCloud auth tokens expired. Non-interactive session cannot run `gcloud auth login`.

```
ERROR: (gcloud.auth.print-access-token) There was a problem refreshing your current auth tokens
```

**To deploy manually:**

```bash
# 1. Re-authenticate
gcloud auth login

# 2. Set region (not currently configured)
gcloud config set run/region asia-south1  # or your preferred region

# 3. Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/policing-apps/social-media-api .

# 4. Deploy to Cloud Run
gcloud run deploy social-media-api \
  --image gcr.io/policing-apps/social-media-api \
  --platform managed \
  --port 8080 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "ALLOWED_ORIGINS=https://your-domain.com" \
  --set-secrets "SM_DATABASE_URL=sm-database-url:latest" \
  --set-secrets "JWT_SECRET=sm-jwt-secret:latest" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --no-allow-unauthenticated
```

**Cloud Run prerequisites:**
- Set compute/run region in gcloud config
- Create Cloud SQL instance with database `social_media`
- Store secrets in Secret Manager: `SM_DATABASE_URL`, `JWT_SECRET`
- Configure VPC connector for Cloud SQL access (or use Cloud SQL Auth Proxy)

---

## Phase 7: Cloud Sanity Check

**Status**: SKIPPED (GCloud auth expired)

---

## Known Issues (Non-Blocking)

### 1. Fastify "Reply already sent" Warning on Auth Login

The `/api/v1/auth/login` route produces a Fastify warning:
```
Reply was already sent, did you forget to "return reply" in "/api/v1/auth/login" (POST)?
```
This is a cosmetic issue in `packages/api-core/src/routes/auth-routes.ts` where `sendError()` sends the reply and the Fastify error handler also attempts to send. The response is still correct (401). Low priority fix.

### 2. Connector API Quota Warnings

External connector APIs (YouTube, Twitter, Reddit) log 403/402 warnings when API keys are missing or quota is exceeded. These are expected in development environments where API keys are not configured.

### 3. npm Deprecation Warnings

- `jpeg-exif@1.1.4` deprecated
- `glob@10.5.0` deprecated (used transitively)

Neither affects runtime behavior.

---

## Summary

| Phase | Status |
|-------|--------|
| Phase 0: Preflight | PASS |
| Phase 1: Env Var Audit | PASS |
| Phase 2: Deployment Readiness | PASS |
| Phase 3: Fixes | 3 fixes applied, all tests pass |
| Phase 4: Docker Build | PASS (349 MB, 22s build) |
| Phase 5: Docker Sanity | PASS (all endpoints, security headers, rate limiting) |
| Phase 6: GCloud Deploy | SKIPPED (auth expired) |
| Phase 7: Cloud Sanity | SKIPPED (auth expired) |

**Overall**: The Social Media API is fully deployment-ready. Docker image builds cleanly, passes all health/auth/security checks, and all 155 tests pass. The three audit logging fixes ensure clean production operation. GCloud deployment requires re-authentication and region configuration.
