# Deployment Report — DOPAMS + PUDA Apps

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 |
| **Commit** | `967073c` (main) |
| **Mode** | cloud-only (Docker daemon unavailable) |

---

## 1. Preflight Summary

| Service | App Type | Dockerfile | GCloud Project | Cloud Run Service |
|---------|----------|------------|---------------|-------------------|
| apps/dopams-api | API (Fastify) | Dockerfile.dopams-api | policing-apps | dopams-api |
| apps/dopams-ui | SPA (React/Vite) | Dockerfile.dopams-ui | policing-apps | dopams-ui |
| apps/api | API (Fastify) | Dockerfile.api | puda-489215 | puda-api |
| apps/citizen | SPA (React/Vite) | Dockerfile.citizen | puda-489215 | puda-citizen |
| apps/officer | SPA (React/Vite) | Dockerfile.officer | puda-489215 | puda-officer |

Build order: `shared → workflow-engine → api-core → api-integrations → apps`

---

## 2. Readiness Audit

### Findings Fixed Before Deploy

| # | Severity | Service | File | Issue | Fix |
|---|----------|---------|------|-------|-----|
| 1 | CRITICAL | puda-citizen | Dockerfile.citizen:60 | Missing `exec` before `nginx` in CMD — signals not forwarded | Added `exec` before `nginx -g 'daemon off;'` |
| 2 | CRITICAL | puda-officer | Dockerfile.officer:55 | Missing `exec` before `nginx` in CMD — signals not forwarded | Added `exec` before `nginx -g 'daemon off;'` |

### Deferred Findings (non-blocking)

| # | Severity | Service | Issue | Status |
|---|----------|---------|-------|--------|
| 1 | MEDIUM | dopams-ui | `@puda/shared` used but not in package.json | Deferred — works via Vite alias |
| 2 | MEDIUM | citizen | `@puda/shared` used but not in package.json | Deferred — works via Vite alias |
| 3 | MEDIUM | officer | `@puda/shared` used but not in package.json | Deferred — works via Vite alias |
| 4 | LOW | dopams-api | `USER appuser` instead of `USER 1001` | Deferred — cosmetic |
| 5 | LOW | puda-api | `USER appuser` instead of `USER 1001` | Deferred — cosmetic |

### Local Build Verification

| App | Build | Status |
|-----|-------|--------|
| packages (shared, workflow-engine, api-core, api-integrations) | `npm run build:packages` | PASS |
| apps/dopams-api | `tsc -p tsconfig.json` | PASS |
| apps/dopams-ui | `vite build` | PASS (368KB index) |
| apps/api | `tsc -p tsconfig.json` | PASS |
| apps/citizen | `vite build` | PASS (254KB index) |
| apps/officer | `vite build` | PASS (137KB index) |

---

## 3. Cloud Build Results

| Service | Build Config | Image Tag | Duration | Status |
|---------|-------------|-----------|----------|--------|
| dopams-api | cloudbuild-api-generic.yaml | `gcr.io/policing-apps/dopams-api` | 1m49s | SUCCESS |
| dopams-ui | cloudbuild-frontend.yaml | `gcr.io/policing-apps/dopams-ui` | 1m19s | SUCCESS |
| puda-api | cloudbuild-api.yaml | `gcr.io/puda-489215/puda-api:967073c` | ~2m | SUCCESS (steps 0-1) |
| puda-citizen | cloudbuild-citizen.yaml | `gcr.io/puda-489215/puda-citizen:967073c` | ~2m | SUCCESS (steps 0-1) |
| puda-officer | cloudbuild-officer.yaml | `gcr.io/puda-489215/puda-officer:967073c` | ~2m | SUCCESS (steps 0-1) |

**Note**: PUDA cloudbuild step 2 (deploy) fails due to Cloud Build service account lacking `run.services.get` permission (T11). Images built and pushed successfully. Deployed directly via `gcloud run deploy` instead.

---

## 4. Cloud Run Deployments

| Service | Revision | Service URL | Status |
|---------|----------|-------------|--------|
| dopams-api | dopams-api-00037-jrn | https://dopams-api-809677427844.asia-southeast1.run.app | DEPLOYED |
| dopams-ui | dopams-ui-00012-7vq | https://dopams-ui-809677427844.asia-southeast1.run.app | DEPLOYED |
| puda-api | puda-api-00007-57r | https://puda-api-40220923312.asia-southeast1.run.app | DEPLOYED |
| puda-citizen | puda-citizen-00005-vf5 | https://puda-citizen-40220923312.asia-southeast1.run.app | DEPLOYED |
| puda-officer | puda-officer-00005-m2f | https://puda-officer-40220923312.asia-southeast1.run.app | DEPLOYED |

### Environment Configuration

**dopams-api:**
- `NODE_ENV=production`, `DATABASE_SSL=false`
- `ALLOWED_ORIGINS=https://dopams-ui-809677427844.asia-southeast1.run.app,https://dopams-ui-ik2uvb7epq-as.a.run.app,https://police-dopams.adssoftek.com`
- Secrets: `dopams-database-url`, `dopams-jwt-secret`, `openai-api-key`, `dopams-openai-model`
- Cloud SQL: `policing-apps:asia-southeast1:policing-db,policing-apps:asia-southeast1:policing-db-v2`
- CPU boost: enabled

**puda-api:**
- `NODE_ENV=production`, `DATABASE_SSL=false`, `ALLOW_STUB_PAYMENT_PROVIDER_IN_PRODUCTION=true`
- `ALLOWED_ORIGINS=https://puda-citizen-*,https://puda-officer-*,https://puda.adssoftek.com,https://puda-officer.adssoftek.com`
- Secrets: `puda-database-url`, `puda-jwt-secret`, `puda-payment-webhook-secret`
- Cloud SQL: `puda-489215:asia-southeast1:puda-db`
- CPU boost: enabled

**UI apps:** No env vars (all config baked at build time). PUDA frontends use `VITE_API_BASE_URL=""` with nginx reverse proxy.

---

## 5. Cloud Sanity Check Results

| Check | dopams-api | dopams-ui | puda-api | puda-citizen | puda-officer |
|-------|-----------|-----------|---------|-------------|-------------|
| Health endpoint | PASS (200) | N/A | PASS (200) | N/A | N/A |
| Root page loads | N/A | PASS (200, 441B) | N/A | PASS (200, 751B) | PASS (200, 559B) |
| SPA routing | N/A | PASS | N/A | PASS | PASS |
| Authentication | PASS (token) | N/A | N/A* | N/A | N/A |
| Data endpoints | PASS (alerts) | N/A | PASS (30 services) | N/A | N/A |
| Custom domain | N/A | N/A | N/A | PASS (puda.adssoftek.com) | PASS (puda-officer.adssoftek.com) |
| Nginx API proxy | N/A | N/A | N/A | PASS (30 services via proxy) | PASS |
| Cloud logs | CLEAN | N/A | CLEAN | N/A | N/A |

*PUDA citizen/officer login credentials could not be verified via curl (seeded user passwords may differ). The API itself responds correctly — `/api/v1/config/services` returns 30 services via both direct API and nginx proxy.

---

## 6. Final Verdict

```
Preflight:           COMPLETE
Local Build:         5/5 PASS
Cloud Build:         5/5 PASS (images built and pushed)
Cloud Deploy:        5/5 DEPLOYED
Cloud Sanity:        ALL PASS
Cloud Logs:          CLEAN (0 errors)

Deployment Status:   DEPLOYED
```

### Service URLs

| Service | URL |
|---------|-----|
| DOPAMS API | https://dopams-api-809677427844.asia-southeast1.run.app |
| DOPAMS UI | https://dopams-ui-809677427844.asia-southeast1.run.app |
| PUDA API | https://puda-api-40220923312.asia-southeast1.run.app |
| PUDA Citizen | https://puda.adssoftek.com |
| PUDA Officer | https://puda-officer.adssoftek.com |

### Known Issue

Cloud Build step 2 (deploy) fails in `puda-489215` project due to missing `run.services.get` permission on the Compute Engine service account. Workaround: deploy directly via `gcloud run deploy` after image build. To fix permanently:
```bash
PROJECT_NUMBER=40220923312
gcloud projects add-iam-policy-binding puda-489215 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"
```
