# Deployment Report — Policing Platform Integration

| Field | Value |
|-------|-------|
| **Date** | 2026-07-02 |
| **Commits** | `7bcdb79` (integration), `1a7f7bf` (platform deploy artifacts), `fcb091b` (Dockerfile authz fix) |
| **Mode** | cloud-only (Docker daemon unavailable locally) |
| **Scope** | Full integration — 8 services across 2 GCP projects |

---

## 1. Preflight Summary

| Service | Type | Dockerfile | GCP Project | Deploy Kind |
|---------|------|------------|-------------|-------------|
| apps/platform-api | Control-plane API (fetch/node:http) | Dockerfile.platform-api (new) | policing-apps | **First deploy** |
| apps/platform-web | Platform shell SPA (React/Vite + nginx) | Dockerfile.platform-web (new) | policing-apps | **First deploy** |
| apps/dopams-api | API (Fastify) | Dockerfile.dopams-api | policing-apps | Redeploy |
| apps/forensic-api | API (Fastify) | Dockerfile.forensic-api | policing-apps | Redeploy |
| apps/social-media-api | API (Fastify) | Dockerfile.social-media-api | policing-apps | Redeploy |
| apps/dopams-ui | SPA (React/Vite) | Dockerfile.dopams-ui | policing-apps | Redeploy |
| apps/citizen | SPA (React/Vite + nginx proxy) | Dockerfile.citizen | puda-489215 | Redeploy |
| apps/officer | SPA (React/Vite + nginx proxy) | Dockerfile.officer | puda-489215 | Redeploy |

All services in region `asia-southeast1`.

## 2. New Deploy Artifacts (commit `1a7f7bf`)

- `apps/platform-api/src/server.ts` — production HTTP entry bridging node:http to the
  fetch-based platform app. Reads `PORT`, binds `0.0.0.0`. Verified locally before deploy
  (`/health` ok, unauthenticated `/api/v1/platform/apps` → 401).
- `Dockerfile.platform-api` — multi-stage; runtime image is node:22-alpine + compiled dist
  only (the platform packages have **zero npm runtime dependencies**). Non-root user 1001.
- `Dockerfile.platform-web` — Vite build + `nginxinc/nginx-unprivileged`.
- `nginx.platform.conf` — SPA routing + same-origin reverse proxy of `/api/v1/platform/`
  to platform-api via runtime env `PLATFORM_API_HOST`. **Deliberately does not replicate
  the local compose stack's synthetic pilot-claim injection** — cloud requests carry no
  claims and are denied by default (G-SEC-001 preserved on the public URL).

## 3. Issues Found and Fixed During Deploy

| # | Issue | Fix | Evidence |
|---|-------|-----|----------|
| 1 | dopams/forensic/social-media API images failed Cloud Build: `TS2307 Cannot find module '@policing-platform/authz'` — Dockerfiles predate the integration | Added packages/authz to deps install, build stage, and production dist copy in all three Dockerfiles (commit `fcb091b`) | Build IDs `beff0887`, `b3b524ac`, `b538ce83` (FAILURE) → `7f4d3a79`, `9a02b4e8`, `63ce7797` (SUCCESS) |
| 2 | puda-citizen/officer cloudbuild deploy step failed: Cloud Build SA lacks `run.services.get` (known T11, same as 2026-03-15) | Images built+pushed successfully (steps 0–1); deployed directly via `gcloud run deploy` | Build logs, revisions `puda-citizen-00016-dbm`, `puda-officer-00019-mqr` |

## 4. Deployments

| Service | Rollback Target | New Revision | URL |
|---------|-----------------|--------------|-----|
| platform-api | — (first deploy) | platform-api-00001-vzp | https://platform-api-809677427844.asia-southeast1.run.app |
| platform-web | — (first deploy) | platform-web-00001-czs | https://platform-web-809677427844.asia-southeast1.run.app |
| dopams-api | dopams-api-00037-jrn | dopams-api-00038-cvv | https://dopams-api-809677427844.asia-southeast1.run.app |
| forensic-api | forensic-api-00016-2zk | forensic-api-00017-wjw | https://forensic-api-809677427844.asia-southeast1.run.app |
| social-media-api | social-media-api-00021-hh6 | social-media-api-00022-49f | https://social-media-api-809677427844.asia-southeast1.run.app |
| dopams-ui | dopams-ui-00012-7vq | dopams-ui-00013-pgq | https://dopams-ui-809677427844.asia-southeast1.run.app |
| puda-citizen | puda-citizen-00015-qtk | puda-citizen-00016-dbm | https://puda-citizen-40220923312.asia-southeast1.run.app |
| puda-officer | puda-officer-00018-btg | puda-officer-00019-mqr | https://puda-officer-40220923312.asia-southeast1.run.app |

Existing env vars, secrets, and Cloud SQL wiring preserved on all redeploys (image-only updates).
platform-web deployed with `PLATFORM_API_HOST=platform-api-809677427844.asia-southeast1.run.app`.

## 5. Cloud Sanity Results

| Check | Result |
|-------|--------|
| platform-api `/health` | `{"status":"ok"}` — PLATFORM_API_READY + APP_REGISTRY_SAFE |
| platform-api `/api/v1/platform/apps` without claims | HTTP 401 (deny-by-default) |
| platform-web root + SPA fallback | HTTP 200 |
| platform-web → platform-api proxy (`/api/v1/platform/health`) | ok end-to-end; unauthed apps call → 401 through proxy |
| dopams-api, forensic-api, social-media-api `/health` | `{"status":"ok"}` × 3 |
| **Platform-auth enforcement (G-SEC-001)** — `x-platform-launch: true` without claims | HTTP 403 `PLATFORM_AUTH_DENIED / PLATFORM_CLAIMS_REQUIRED` with correlation ID on all three APIs |
| puda-citizen, puda-officer, dopams-ui root | HTTP 200 × 3 |
| citizen nginx `/health` proxy | `{"status":"ok"}` |
| Cloud error logs (all 8 services since deploy) | 0 errors |

## 6. Verdict

**DEPLOYED** — 8/8 services live, all sanity checks pass, error logs clean.

### Remaining risks / notes

1. **Pilot cutover approval remains `pending_human_approval`** (`docs/spec/pilot-cutover-approval.json`) —
   these deployments are pilot infrastructure, not the governed production cutover. The nine
   approver roles must still sign off per `docs/spec/cutover-governance-runbook.md`.
2. **No platform IdP in cloud yet** — platform-api and the domain adapters deny everything
   without `x-platform-claims`. Cloud pilot flows need a claims issuer (the local stack's
   nginx-injected synthetic claims are intentionally absent in cloud).
3. Cloud Build SA in `puda-489215` still lacks `run.services.get` (T11) — in-config deploy
   steps will keep failing until granted; direct `gcloud run deploy` works.
4. domains/knowledge/api and domains/iqw-api are not deployed as cloud services (pilot scope:
   the platform registry lists them; their cloud exposure is gated on the knowledge/IQW launch plans).

---

## Addendum: platform-pilot service (same day)

The public platform-web shell correctly showed "Registry unavailable / PLATFORM_API_401" —
no claims issuer exists in the cloud, so the deny-by-default posture blanks the launcher.
Per user decision, a **private pilot mode** was added:

- `apps/platform-api/src/pilot-server.ts` — single process serving the SPA and the platform
  API in-process, always overwriting `X-Platform-Claims` / `X-Platform-Claims-Verified`
  with the synthetic pilot personas from `fixtures/platform/pilot-claims.json` (extracted
  from the local stack's nginx conf; persona selected via `X-Platform-Smoke-Persona`).
- `Dockerfile.platform-pilot` — builds API + SPA into one stdlib-only image.
- Deployed as `platform-pilot` with `--no-allow-unauthenticated` and
  `PLATFORM_FIXED_NOW=2026-07-01T18:45:00Z` (keeps the synthetic claims inside their
  validity window; decision-evidence timestamps are frozen accordingly).

Verification: anonymous request → HTTP 403 at Google's front door; identity-token request →
registry JSON, SPA 200, persona switching works (`/me` reflects forensic persona).

Access: `gcloud run services proxy platform-pilot --region asia-southeast1 --project policing-apps --port 8080`
then open http://localhost:8080. The public platform-web/platform-api services remain
deployed, locked, as the target-state topology awaiting a real claims issuer.

---

## Addendum 2: claims issuer + user management; platform-pilot retired

- **Real login shipped** (commit `6bdac84`): Postgres user store on `policing-db-v2`
  (database `policing_platform`), scrypt passwords, mandatory TOTP MFA, HMAC session
  cookie, claims minted per request. Public shell now shows a sign-in screen.
- **User management shipped**: admin routes guarded by `platform/user:manage`
  (create from role template, list, enable/disable, reset password/TOTP; TOTP secrets
  returned exactly once; structured audit log lines per action). Five role templates:
  platform_administrator (platform-ops), pilot_operator, forensic_analyst,
  intelligence_analyst, investigating_officer. Users panel in the shell for admins.
- **platform-pilot deleted** (service + repo artifacts) — superseded by real login.
- Cloud verification: bootstrap admin idempotently granted user:manage; created
  forensic_analyst user; that user sees exactly one ALLOW (forensic) and MODULE_DENIED
  elsewhere; admin routes 403 for non-admins; disabled users cannot log in. Test user
  `asha.verma` left disabled in the user table. 0 errors in logs.
- Follow-ups: route admin-action audit lines into the authorization-decision-evidence
  ledger (G-SEC-002 parity); amend docs/spec/auth-entitlements-contract.md to describe
  the platform-idp claims source formally.

---

## Addendum 3: spec follow-ups closed

- **G-SEC-002 ledger wired**: `createPgEvidenceStore` persists every platform
  allow/deny decision (app routes via `evidenceSink`, admin actions and admin-route
  authorization denials via the gateway) to `platform.authorization_decision_evidence`
  with SHA-256 integrity hashes. Ledger write failure never blocks requests but emits a
  `decision-evidence-write-failed` alert line. Admins read recent entries at
  `GET /api/v1/platform/admin/decision-evidence`. Verified live: DENY (AUTH_REQUIRED),
  ALLOW (user:list), ALLOW (entitlements.check) rows read back from Cloud SQL.
- **Contract amended to v1.1**: docs/spec/auth-entitlements-contract.md now documents
  the platform-idp claims source (session login, per-request minting, TOTP MFA,
  source_version compatibility rule, ingress header stripping, user:manage admin
  surface) and the implemented decision-evidence boundary, with an amendment history.
- Deployed as platform-api-00004-b9j. 59 platform-api tests green.

---

## Addendum 4: demo mode (password-only login)

Per user request for easy testing/demo:

- `PLATFORM_DEMO_ALLOW_PASSWORD_ONLY=true` on platform-api permits login without a
  TOTP code; such sessions are honestly recorded with `mfa.methods: ["password"]` in
  every minted claim and ledger record. Startup logs a DEMO MODE warning. Contract
  amended to v1.2.
- `PLATFORM_DEMO_ADMIN_PASSWORD` bootstraps a well-known `admin` account
  (pilot-operator profile + user:manage). Login screen hides the authenticator field
  when `GET /auth/config` reports password-only mode.
- Deployed: platform-api-00005-cx8, platform-web-00004-ggt. Verified: admin/password123
  logs in without authenticator; dopams/iqw/knowledge ALLOW; Users panel available.
- **RISK (accepted for demo)**: trivially guessable credentials on a public URL.
  Rollback before real data:
  `gcloud run services update platform-api --remove-env-vars PLATFORM_DEMO_ALLOW_PASSWORD_ONLY,PLATFORM_DEMO_ADMIN_PASSWORD --region asia-southeast1 --project policing-apps`
  and disable the `admin` user from the Users panel.
