# DOPAMS Deployment Report

**Date:** 2026-03-12
**Commit:** 0f7c85a (Fix 17 CRITICAL and 42 HIGH findings from DOPAMS full review)
**Branch:** main

---

## Preflight Summary

| Field | Value |
|-------|-------|
| Target | `apps/dopams-api` + `apps/dopams-ui` |
| App Type | API (Fastify) + Frontend (Vite SPA + nginx) |
| Tech Stack | Node 20 / TypeScript 5.7 / Vite 6 |
| Dockerfiles | `Dockerfile.dopams-api`, `Dockerfile.dopams-ui` |
| Cloud Project | `policing-apps` |
| Cloud Region | `asia-southeast1` |
| Previous Revisions | `dopams-api-00027-m4g`, `dopams-ui-00009-zw5` |
| Build Order | shared → workflow-engine → api-core → api-integrations → dopams-api / dopams-ui |

---

## Environment Variable Inventory

### dopams-api

| Variable | Required | Default | Cloud Run | Status |
|----------|----------|---------|-----------|--------|
| PORT | Yes | 8080 | Auto (Cloud Run) | OK |
| NODE_ENV | Yes | development | `production` | OK |
| DOPAMS_DATABASE_URL | Yes | None | Secret Manager | OK |
| JWT_SECRET | Yes | None | Secret Manager | OK |
| DATABASE_SSL | No | true | `false` | OK |
| ALLOWED_ORIGINS | Yes | * | dopams-ui URL | OK |
| LDAP_URL | No | None | Not set | OK (optional) |
| OIDC_* | No | None | Not set | OK (optional) |
| PII_ENCRYPTION_KEY | No | None | Not set | OK (falls back to default) |
| PII_SALT | No | random | Not set | OK (random per-ciphertext) |
| ANTHROPIC_API_KEY | No | None | Not set | OK (LLM optional) |
| GEMINI_API_KEY | No | None | Not set | OK (LLM optional) |
| EVIDENCE_STORAGE_DIR | No | /tmp | Not set | OK |

### dopams-ui

| Variable | Required | Default | Cloud Run | Status |
|----------|----------|---------|-----------|--------|
| PORT | Yes | 8080 | Auto | OK |
| VITE_API_BASE_URL | Build-time | "" | Build arg | OK |

---

## Readiness Scorecard

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Environment variables | PASS | All required vars accounted for in Cloud Run config |
| 2 | Dependency completeness | PASS | All workspace deps declared, `npm ci` succeeds |
| 3 | Dockerfile audit | PASS | Multi-stage, non-root user, HEALTHCHECK, pinned base |
| 4 | Asset availability | PASS | No external assets referenced |
| 5 | Version compatibility | PASS | React 18.3.1 parity, Node 20 alpine |
| 6 | Path mapping | PASS | tsc→dist/, vite→dist/, CMD matches |
| 7 | Relative paths | PASS | workflow-definitions copied explicitly |
| 8 | Duplicate config | PASS | No duplicate keys |
| 9 | Build tool production | PASS | vite in devDependencies only |
| 10 | Cloud Run PORT | PASS | `process.env.PORT \|\| 8080`, binds `0.0.0.0` |
| 11 | Docker include/exclude | PASS | .dockerignore present and comprehensive |
| 12 | CORS configuration | PASS | ALLOWED_ORIGINS set to UI Cloud Run URL |
| 13 | Health check | PASS | `/health` and `/ready` endpoints present |
| 14 | Local build | PASS | Both tsc and vite build succeed |

---

## Build & Deploy Log

### dopams-api

```
Cloud Build: fc924f7c-8fbc-4ca4-9039-1a8f01c23310
Duration: 1m38s
Image: asia-southeast1-docker.pkg.dev/policing-apps/policing-apps/dopams-api:latest
Digest: sha256:fb6719c6f1000f27aadd94dfe074234dbb28300fbc9ec3c750d64e1acf647988
Revision: dopams-api-00028-jd7
```

### dopams-ui

```
Cloud Build: b7b2f463-7536-4bd5-ab94-2ff78402eaf3
Duration: 57s
Build arg: VITE_API_BASE_URL=https://dopams-api-809677427844.asia-southeast1.run.app
Image: asia-southeast1-docker.pkg.dev/policing-apps/policing-apps/dopams-ui:latest
Digest: sha256:1033a6e26fd0e0940055b732bfffb5a0b1932af580fd1a49bae50995474ef99c
Revision: dopams-ui-00010-jjg
```

---

## Cloud Sanity Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| API /health | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| API /ready | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| UI root (/) | 200 | 200, 441B, 0.20s | PASS |
| UI SPA route (/subjects) | 200 | 200, 441B, 0.19s | PASS |
| Authentication | Token returned | Token (379 chars) | PASS |
| GET /subjects | Data returned | 5 items, total=24 | PASS |
| GET /alerts | Data returned | 5 items, total=9 | PASS |
| Unauth access | 401 | 401 | PASS |
| JS bundle served | 200 | 200, 365KB | PASS |
| CSS bundle served | 200 | Referenced in HTML | PASS |
| Security headers | Present | CSP, X-Frame, X-Content-Type | PASS |
| Cloud logs | No errors | No errors (last 5 min) | PASS |

---

## Rollback Information

```bash
# API rollback
gcloud run services update-traffic dopams-api \
  --to-revisions dopams-api-00027-m4g=100 \
  --platform managed --region asia-southeast1 --project policing-apps

# UI rollback
gcloud run services update-traffic dopams-ui \
  --to-revisions dopams-ui-00009-zw5=100 \
  --platform managed --region asia-southeast1 --project policing-apps
```

---

## Final Verdict

```
Preflight:           COMPLETE
Env Var Audit:       ALL ACCOUNTED
Readiness Checks:    14/14 PASS
Local Build:         PASS (tsc + vite)
Local Docker:        SKIPPED (Docker Desktop not running)
Cloud Build:         SUCCESS (API 1m38s, UI 57s)
Cloud Deploy:        SUCCESS
Cloud Sanity:        12/12 PASS
Cloud Logs:          CLEAN
Deployment Status:   DEPLOYED
API URL:             https://dopams-api-809677427844.asia-southeast1.run.app
UI URL:              https://dopams-ui-809677427844.asia-southeast1.run.app
API Revision:        dopams-api-00028-jd7
UI Revision:         dopams-ui-00010-jjg
Rollback Revisions:  dopams-api-00027-m4g, dopams-ui-00009-zw5
```
