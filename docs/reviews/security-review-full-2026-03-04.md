# Security & Compliance Review — Policing Applications Monorepo

**Date:** 2026-03-04
**Commit:** `28c7fdaefd0fd1d5865a1edde19af4e1c2b7edaa` (branch: `main`)
**Scope:** Full codebase — all APIs, UIs, packages, infrastructure
**Reviewer:** Claude Code (automated)

---

## 1. Scope and Preflight

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify (Node.js 20), TypeScript |
| Frontend | React + Vite (citizen, officer, dopams-ui, forensic-ui, social-media-ui) |
| Database | PostgreSQL (pg driver, raw SQL — no ORM) |
| Auth | JWT (jsonwebtoken), Argon2id password hashing |
| Container | Docker multi-stage builds, nginx:1.27-alpine for UIs |
| Orchestration | docker-compose (dev), Terraform + Cloud Run (prod — PUDA only) |
| CI/CD | GitHub Actions |
| Shared | npm workspaces monorepo, Zod v4, custom workflow engine |

### Applications

| App | Purpose | Maturity |
|-----|---------|----------|
| `apps/api` | PUDA property services | Production-grade (CSP, token revocation, MFA, audit hash chain) |
| `apps/dopams-api` | Drug Operations & Profiling | Early (scaffolded, many security gaps) |
| `apps/forensic-api` | Forensic Evidence Management | Early (scaffolded, many security gaps) |
| `apps/social-media-api` | Social Media Intelligence | Early (scaffolded, many security gaps) |
| `apps/citizen` | Citizen-facing UI | Production-grade |
| `apps/officer` | Officer-facing UI | Production-grade |
| `apps/dopams-ui` | DOPAMS frontend | Early |
| `apps/forensic-ui` | Forensic frontend | Early |
| `apps/social-media-ui` | Social Media frontend | Early |

### Assumptions & Exclusions

- The three policing APIs (DOPAMS, Forensic, Social Media) are pre-production but under active development.
- The PUDA API (`apps/api`) has significantly more mature security controls and serves as the reference implementation.
- Production deployment infrastructure (Terraform) exists only for the PUDA API.
- Compliance requirements are drawn from BRD documents in `docs/policing_apps_brd/`.

### Key Observation

The three policing APIs were scaffolded without carrying over critical security features from the mature PUDA API. This is the root cause of the majority of findings.

---

## 2. Attack Surface Map

### Entry Points

| Category | Count | Location |
|----------|-------|----------|
| HTTP API routes (PUDA) | 60+ | `apps/api/src/routes/` |
| HTTP API routes (DOPAMS) | 40+ | `apps/dopams-api/src/routes/` |
| HTTP API routes (Forensic) | 35+ | `apps/forensic-api/src/routes/` |
| HTTP API routes (Social Media) | 40+ | `apps/social-media-api/src/routes/` |
| Static UI apps | 5 | nginx-served SPAs |
| Database instances | 4 | PostgreSQL (all exposed to host in dev) |
| Health/readiness probes | 8 | `/health`, `/ready` per API |
| Swagger UI (non-prod) | 3 | `/docs` on policing APIs |

### Trust Boundary Diagram

```
                    +-----------+
                    |  Internet |
                    +-----+-----+
                          |
               +----------+-----------+
               |      nginx (TLS)     |
               +--+--+--+--+--+--+---+
                  |  |  |  |  |  |
        +---------+  |  |  |  |  +---------+
        |            |  |  |  |            |
   citizen-ui  officer-ui |  dopams-ui  forensic-ui  sm-ui
                     |
          +----------+----------+
          |                     |
     PUDA API            Policing APIs
   (mature auth)     (weak auth -- CRITICAL)
     |    |              |    |    |
     |    |          dopams forensic social-media
     |    |              |    |    |
     v    v              v    v    v
   PUDA DB          dopams-db forensic-db sm-db
   (hash-chain      (no audit  (no audit  (no audit
    audit trail)     protection) protection) protection)
```

### Public (Unauthenticated) Endpoints

| Path | Apps | Purpose |
|------|------|---------|
| `POST /api/v1/auth/login` | All | User login |
| `POST /api/v1/auth/logout` | All | Clear auth cookie |
| `GET /api/v1/auth/me` | Policing APIs (BUG) | Should be authenticated |
| `GET /health`, `GET /ready` | All | Container probes |
| `GET /docs/*` | Policing APIs (non-prod) | Swagger UI |

---

## 3. Authentication Findings

### F-01: Admin Routes Accessible to ALL Authenticated Users — No RBAC

**Severity: P0 | Confidence: High | Status: Confirmed**

Any authenticated user — regardless of role — can list all users, create new users, and assign/revoke roles. This is an immediate privilege escalation path.

**Evidence:**
- `apps/dopams-api/src/routes/admin.routes.ts:7-65` — `GET /users`, `POST /users`, `PUT /users/:id/role` — zero role checks
- `apps/forensic-api/src/routes/admin.routes.ts:7-35` — same
- `apps/social-media-api/src/routes/admin.routes.ts:7-76` — same, plus taxonomy management

**Impact:** A regular analyst can create admin accounts, grant themselves any role, or view the full user directory. Risk Score: 5x5 = 25.

**Fix:** Add `requireRole("ADMINISTRATOR")` guard to all admin routes.
**Verify:** `curl -H "Cookie: auth=<analyst-token>" /api/v1/users` should return 403.

---

### F-02: Privilege Escalation via Role Self-Assignment (DOPAMS)

**Severity: P0 | Confidence: High | Status: Confirmed**

`PUT /api/v1/users/:id/role` allows any authenticated user to assign any role to any user, including themselves.

**Evidence:** `apps/dopams-api/src/routes/admin.routes.ts:36-65`

**Impact:** A low-privilege user can call `PUT /api/v1/users/<own-id>/role` with `{ roleId: "<admin-role>", action: "assign" }` to instantly become admin. Risk Score: 5x5 = 25.

**Fix:** Require `ADMINISTRATOR` role. Prevent self-role-modification. Audit all role changes.
**Verify:** Attempt self-assignment with non-admin token → 403.

---

### F-03: No Token Revocation / Session Invalidation on Logout

**Severity: P0 | Confidence: High | Status: Confirmed**

Logout merely clears the auth cookie. The JWT (24h lifetime) remains valid until natural expiry. Stolen tokens cannot be invalidated.

**Evidence:**
- `apps/dopams-api/src/routes/auth.routes.ts:26-31` — `clearAuthCookie(reply)` only
- `apps/forensic-api/src/routes/auth.routes.ts:26-31` — same
- `apps/social-media-api/src/routes/auth.routes.ts:26-31` — same

**Contrast:** PUDA API has `revokeToken()` + `auth_token_denylist` table + middleware check.

**Fix:** Port PUDA's `token-security.ts` pattern: denylist table, logout adds JTI, middleware checks denylist.
**Verify:** After logout, use the same JWT → 401.

---

### F-04: Hardcoded JWT Secret Fallbacks Without Production Guard

**Severity: P0 | Confidence: High | Status: Confirmed**

All three policing APIs silently use publicly known JWT secrets if `JWT_SECRET` is unset. Anyone with source code access can forge JWTs for any user.

**Evidence:**
- `apps/dopams-api/src/middleware/auth.ts:5` — `"dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"`
- `apps/forensic-api/src/middleware/auth.ts:5` — `"forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION"`
- `apps/social-media-api/src/middleware/auth.ts:5` — `"sm-dev-secret-DO-NOT-USE-IN-PRODUCTION"`

**Contrast:** PUDA API throws fatal error if unset in non-test runtime.

**Fix:** Add `if (!secret && NODE_ENV !== 'test') throw new Error("FATAL: JWT_SECRET must be set")`.
**Verify:** Start app without JWT_SECRET in production mode → process exits with error.

---

### F-05: Auth Middleware Bypass via Route Prefix Matching

**Severity: P1 | Confidence: High | Status: Confirmed**

Auth middleware skips all routes matching `url.startsWith("/api/v1/auth/")`, making `/api/v1/auth/me` (intended to be protected) actually public. Any future route under `/api/v1/auth/` will also be unprotected.

**Evidence:**
- `apps/dopams-api/src/middleware/auth.ts:71` — `url.startsWith("/api/v1/auth/")`
- `apps/forensic-api/src/middleware/auth.ts:66` — same
- `apps/social-media-api/src/middleware/auth.ts:66` — same

**Fix:** Remove `startsWith` check; use exact-match against `PUBLIC_ROUTES` array only.
**Verify:** `GET /api/v1/auth/me` without token → 401 (not 200 with null user).

---

### F-06: IDOR on Single-Entity Reads — No Unit/Ownership Scoping

**Severity: P1 | Confidence: High | Status: Confirmed**

All `GET /:id` endpoints query by primary key only, without checking the user's `unit_id`. Any authenticated user can read any record across all organizational units.

**Evidence:**
- `apps/dopams-api/src/routes/case.routes.ts:42-56` — `WHERE case_id = $1` (no unit check)
- `apps/dopams-api/src/routes/alert.routes.ts:44-59` — same
- `apps/dopams-api/src/routes/lead.routes.ts:61-75` — same
- `apps/dopams-api/src/routes/subject.routes.ts:42-56` — same
- `apps/forensic-api/src/routes/case.routes.ts:60-74` — same
- `apps/forensic-api/src/routes/evidence.routes.ts:33-54` — same
- `apps/social-media-api/src/routes/case.routes.ts:58-72` — same
- `apps/social-media-api/src/routes/evidence.routes.ts:26-47` — same

**Fix:** Add `AND unit_id = $2` clause with `request.authUser.unitId`.
**Verify:** Access case from Unit B using Unit A token → 404.

---

### F-07: DOPAMS and Social Media Login Missing `unit_id` in JWT

**Severity: P1 | Confidence: High | Status: Confirmed**

DOPAMS and Social Media APIs omit `unit_id` from the JWT payload during login, causing all list queries with `AND ($3::text IS NULL OR unit_id = $3)` to always pass (returning all units' data).

**Evidence:**
- `apps/dopams-api/src/routes/auth.routes.ts:21` — `generateToken({ user_id, user_type, roles })` — no `unit_id`
- `apps/social-media-api/src/routes/auth.routes.ts:21` — same
- Contrast: `apps/forensic-api/src/routes/auth.routes.ts:21` includes `unit_id`

**Fix:** Add `unit_id: user.unit_id` to `generateToken()` calls.
**Verify:** Check decoded JWT contains `unitId` field.

---

### F-08: No JWT Algorithm Enforcement

**Severity: P1 | Confidence: Medium | Status: Confirmed**

`jwt.verify()` is called without specifying `algorithms`, leaving the door open for algorithm confusion attacks.

**Evidence:**
- `apps/dopams-api/src/middleware/auth.ts:32` — `jwt.verify(token, JWT_SECRET)` — no `algorithms` option
- Same pattern in all four APIs

**Fix:** `jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] })`
**Verify:** Forge a token with `alg: "none"` → rejected.

---

### F-09: No Account Lockout After Failed Login Attempts

**Severity: P1 | Confidence: High | Status: Confirmed**

Rate limiting is IP-based (10 req/min), but there is no per-account lockout. Distributed brute-force attacks bypass IP rate limits entirely.

**Evidence:** All four APIs lack account lockout tracking. Failed login attempts are not even logged.

**Fix:** Track `failed_login_attempts` per user. Lock after 5 failures for configurable duration.
**Verify:** 5 wrong passwords → account locked for 15 minutes.

---

### F-10: No Session Inactivity Timeout

**Severity: P1 | Confidence: High | Status: Confirmed**

JWTs have a fixed 24-hour expiry with no inactivity timeout. A user who walks away has a valid session for 24 hours.

**Evidence:** `apps/dopams-api/src/middleware/auth.ts:50` — `expiresIn: "24h"` with no sliding window.

**BRD violation:** Social Media BRD `FR-02 AC-04`: "Idle sessions expire after 15 minutes for privileged roles."

**Fix:** Implement short-lived JWTs (15-30 min) with refresh tokens, or track last-activity server-side.

---

### F-11: No MFA / Step-Up Authentication for Policing APIs

**Severity: P2 | Confidence: High | Status: Confirmed**

The PUDA API has MFA (`POST /api/v1/auth/mfa/challenge`). The three policing APIs have zero MFA capability for sensitive operations like case transitions, evidence management, or role assignments.

**Fix:** Implement MFA at minimum for admin operations and critical state transitions.

---

## 4. Authorization Findings

### F-12: Dashboard / Analytics Routes Expose Cross-Unit Data

**Severity: P2 | Confidence: High | Status: Confirmed**

`GET /api/v1/dashboard/stats` aggregates data across ALL units without filtering.

**Evidence:** `apps/dopams-api/src/routes/dashboard.routes.ts:5-22` — queries `FROM alert`, `FROM lead`, `FROM dopams_case` with no `WHERE unit_id` filter.

**Fix:** Add unit-id filtering to all dashboard queries.

---

### F-13: Task Action Does Not Verify Role Assignment

**Severity: P2 | Confidence: Medium | Status: Confirmed**

`POST /api/v1/tasks/:id/action` fetches the task without checking if the user's roles match the task's `role_id`, leaking task existence and entity linkage.

**Evidence:** `apps/dopams-api/src/routes/task.routes.ts:47-73` — query lacks `AND role_id = ANY($2)`.

**Fix:** Add role filter to task lookup query.

---

## 5. Input Validation Findings

### F-14: Path Traversal in Workflow Config Routes

**Severity: P0 | Confidence: High | Status: Confirmed**

User-supplied `entityType` parameter is concatenated directly into a filesystem path with no sanitization. Attacker can read arbitrary files via `../../etc/passwd`.

**Evidence:**
- `apps/dopams-api/src/routes/config.routes.ts:28` — `path.resolve(__dirname, "..", "workflow-definitions", \`\${entityType}.json\`)`
- `apps/forensic-api/src/routes/config.routes.ts:28` — same
- `apps/social-media-api/src/routes/config.routes.ts:28` — same

Schema at line 25 validates `entityType` only as `{ type: "string" }` — no pattern constraint.

**Fix:** Validate against allowlist: `entityType: { type: "string", pattern: "^[a-z_]+$" }`. After resolving, verify path stays within expected directory.
**Verify:** `GET /api/v1/config/workflows/../../etc/passwd` → 400.

---

### F-15: Missing Schema Validation on Multiple Routes

**Severity: P2 | Confidence: High | Status: Confirmed**

Several routes accept `request.body as any` without Fastify JSON Schema validation:

- Geofence routes (all 3 apps): `apps/dopams-api/src/routes/geofence.routes.ts:12,39,56,76`
- Model governance routes (all 3 apps): `apps/dopams-api/src/routes/model.routes.ts:12`
- Tower dump record uploads accept unbounded arrays (DoS vector)

**Fix:** Add comprehensive Fastify JSON schemas with `additionalProperties: false` and `maxItems` limits.

---

### F-16: Generated SQL Returned to Clients (Info Disclosure)

**Severity: P1 | Confidence: High | Status: Confirmed**

NL query endpoints return `generatedSql` field, exposing internal database schema.

**Evidence:**
- `apps/dopams-api/src/services/nl-query.ts:180` — `return { summary, data, citations, generatedSql: sql }`
- Same in forensic-api and social-media-api

**Fix:** Remove `generatedSql` from responses, or gate behind admin role + non-production check.

---

### F-17: No Password Complexity Validation

**Severity: P1 | Confidence: High | Status: Confirmed**

User creation endpoints accept any password with no length or complexity requirements.

**Evidence:** `apps/dopams-api/src/routes/admin.routes.ts:21` — `password: { type: "string" }` — no `minLength`.

**Fix:** Add `minLength: 12` and complexity requirements.

---

### Positive: SQL Injection Properly Mitigated

All four APIs consistently use parameterized queries (`pool.query(text, params)`). No string concatenation for user-supplied values in SQL. Dynamic table/column names use switch-case allowlists.

### Positive: No XSS Vectors

Zero instances of `dangerouslySetInnerHTML` or `v-html` found. No command injection (`eval`, `exec` with user input).

---

## 6. Data Protection Findings

### F-18: PII Stored in Plaintext Without Field-Level Encryption

**Severity: P1 | Confidence: High | Status: Confirmed**

Drug suspect profiles, financial transactions, and communication metadata are stored as plaintext JSONB. No `pgcrypto` or application-level encryption.

**Evidence:**
- `apps/dopams-api/migrations/001_init.sql:38-53` — `subject_profile`: `full_name`, `identifiers`, `addresses`, `photo_url`
- `apps/dopams-api/migrations/001_init.sql:118` — `communication_event`: `counterparty`, `content_summary`
- `apps/dopams-api/migrations/001_init.sql:135` — `financial_transaction`: `counterparty`, `bank_ref`

**Fix:** Implement envelope encryption for `identifiers`, `addresses`, `bank_ref`, `content_summary`.

---

### F-19: Subject PII Returned Without Role-Based Field Filtering

**Severity: P1 | Confidence: High | Status: Confirmed**

`GET /api/v1/subjects/:id` returns all PII fields including `identifiers` and `addresses` to any authenticated user.

**Evidence:** `apps/dopams-api/src/routes/subject.routes.ts:46-56` — `SELECT ... identifiers, addresses ... FROM subject_profile`

**BRD violation:** DOPAMS BRD `CNS-REG-002`: "Sensitive fields must be masked for unauthorized roles."

**Fix:** Implement role-based field filtering. Only `INTELLIGENCE_ANALYST` and `INVESTIGATING_OFFICER` should see full identifiers.

---

### F-20: Inconsistent Log Redaction Across APIs

**Severity: P2 | Confidence: High | Status: Confirmed**

Policing APIs redact fewer fields than the PUDA API.

- PUDA: `/(password|token|secret|signature|authorization|cookie|aadhar|aadhaar|pan|email|phone|mobile)/i`
- Policing: `/(password|token|secret|signature|authorization|cookie|aadhaar|pan)/i` — **missing `email`, `phone`, `mobile`**

**Evidence:** `apps/dopams-api/src/logger.ts:6` vs `apps/api/src/logger.ts:8`

**Fix:** Align all patterns. Add `address`, `dob`, `identifiers` for policing apps.

---

### F-21: No PII Retention Framework for Policing APIs

**Severity: P2 | Confidence: High | Status: Confirmed**

PUDA has `migrations/035_pii_retention.sql`. None of the policing APIs have data retention, anonymization, or legal hold mechanisms.

**BRD violation:** Social Media BRD `ASM-10`: "Retention baseline is seven years for audit/evidence records."

---

## 7. Secrets Management Findings

### F-22: Shared JWT Secret Across All Docker Compose Services

**Severity: P1 | Confidence: High | Status: Confirmed**

All services use `JWT_SECRET: "${JWT_SECRET:-puda-local-dev-secret}"` — a token from one service works on all others.

**Evidence:** `docker-compose.yml:35,103,154,205`

**Fix:** Use distinct per-service JWT secrets.

---

### F-23: Real Cloud SQL Password in Local .env File

**Severity: P1 | Confidence: Medium | Status: Confirmed**

`.env:7` contains `DATABASE_URL=postgres://puda:PudaDb2026%40@localhost:5434/puda` — a real Cloud SQL password.

**Mitigating:** `.env` is in `.gitignore` and not committed.

**Fix:** Rotate this Cloud SQL password. Use IAM authentication.

---

### Positive: No Hardcoded API Keys/Tokens

No `AKIA` AWS keys, no hardcoded bearer tokens, no private keys in repo. `.env.example` files contain only placeholders. Dockerfiles are clean of secrets. Production secrets managed via GCP Secret Manager.

---

## 8. Audit Trail Findings

### F-24: No Tamper-Evident Hash Chain on Audit Tables

**Severity: P0 | Confidence: High | Status: Confirmed**

PUDA has SHA-256 chained hashes with `pgcrypto` on `audit_event`. None of the policing APIs have this.

**Evidence:**
- `apps/dopams-api/migrations/001_init.sql:232-249` — plain table, no hash columns or triggers
- `apps/forensic-api/migrations/001_init.sql:272-286` — same
- `apps/social-media-api/migrations/001_init.sql:288-306` — same

**BRD violation:**
- DOPAMS `CNS-SEC-003`: "immutable audit logs"
- Social Media `CNS-05`: "tamper-evident form"

**Fix:** Port `apps/api/migrations/017_audit_hash_chain.sql` pattern. Add `REVOKE DELETE, UPDATE ON audit_event`.

---

### F-25: Audit Logs Not Protected Against Deletion/Modification

**Severity: P0 | Confidence: High | Status: Confirmed**

No database-level rules prevent DELETE or UPDATE on audit tables. The application DB user has full CRUD.

**Fix:** `REVOKE DELETE, UPDATE ON audit_event FROM app_user; CREATE RULE no_delete_audit...`

---

### F-26: GET/Read Operations Not Audit-Logged

**Severity: P1 | Confidence: High | Status: Confirmed**

Audit middleware only logs POST/PUT/PATCH/DELETE. All data reads are invisible in the audit trail.

**Evidence:** `apps/dopams-api/src/middleware/audit-logger.ts:6-11` — `METHOD_TO_EVENT` lacks GET.

**BRD violation:** DOPAMS `FR-01 AC-05`: audit logs must capture all actions including data access.

---

### F-27: Auth Events Excluded from Audit Log

**Severity: P1 | Confidence: High | Status: Confirmed**

`SKIP_PATHS` explicitly skips `/api/v1/auth/`. Login failures, successful logins, and logouts are not audit-logged.

**Evidence:** `apps/dopams-api/src/middleware/audit-logger.ts:4` — `SKIP_PATHS = ["/health", "/ready", "/api/v1/auth/"]`

**Fix:** Remove `/api/v1/auth/` from SKIP_PATHS. Add explicit audit entries for LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT.

---

### F-28: Audit Log Missing Critical Fields

**Severity: P1 | Confidence: High | Status: Confirmed**

Missing: IP address, before/after snapshot, correlation ID, response status code, actor role.

**Evidence:** `apps/dopams-api/src/middleware/audit-logger.ts:73-78` — INSERT only has `entity_type, entity_id, event_type, actor_type, actor_id, payload_jsonb`.

**BRD violation:** DOPAMS `FR-01 AC-05`: "actor, role, timestamp, source IP, before/after snapshot, correlation ID"

---

### F-29: Audit Logger Silently Swallows Failures

**Severity: P1 | Confidence: High | Status: Confirmed**

Audit write failures are caught and only logged to console. The request completes successfully even when audit fails.

**Evidence:** `apps/dopams-api/src/middleware/audit-logger.ts:79-81`

**BRD violation:** DOPAMS `FR-01`: "If audit-log persistence is unavailable, block approval/finalization actions."

---

### F-30: Custody Event Table Lacks Immutability Protections

**Severity: P1 | Confidence: High | Status: Confirmed**

`custody_event` tables across all three apps have no hash chain, no DELETE/UPDATE prevention, no digital signatures.

**BRD violation:** Forensic `CON-REG-002`: "Source evidence must remain immutable after ingestion."

---

### F-31: Evidence Hash Verification is Superficial

**Severity: P1 | Confidence: High | Status: Confirmed**

The verify endpoint checks if a hash *exists* — it does NOT recompute the hash from the file and compare.

**Evidence:** `apps/forensic-api/src/routes/evidence.routes.ts:71-79` — `verified: ev.hash_sha256 ? true : false`

**Fix:** Recompute SHA-256 from stored file and compare against stored hash.

---

## 9. Dependency Security Findings

### F-32: minimatch ReDoS Vulnerability (High)

**Severity: P2 | Confidence: High | Status: Confirmed**

`minimatch` 10.0.0-10.2.2 has two high-severity ReDoS vulnerabilities (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74).

**Fix:** `npm audit fix`

---

### F-33: fast-xml-parser Stack Overflow via AWS SDK

**Severity: P3 | Confidence: Medium | Status: Confirmed**

20 low-severity vulnerabilities through `@aws-sdk/client-s3` dependency chain (GHSA-fj3w-jwp8-x2g3).

**Fix:** `npm audit fix --force` to upgrade `@aws-sdk/client-s3`.

---

## 10. Network and Transport Findings

### F-34: CORS Allows All Origins When ALLOWED_ORIGINS Unset

**Severity: P2 | Confidence: High | Status: Confirmed**

Fallback is `true` (reflect any origin) with `credentials: true`, enabling cross-origin credential theft.

**Evidence:**
- `apps/dopams-api/src/app.ts:41-43` — `allowedOrigins = ... : true`
- Same in forensic-api and social-media-api

**Contrast:** PUDA API throws fatal error if `ALLOWED_ORIGINS` unset.

**Fix:** Default to `[]` (deny all). Throw error in production if unset.

---

### F-35: No Security Headers on API Responses (No Helmet)

**Severity: P1 | Confidence: High | Status: Confirmed**

None of the three policing APIs use `@fastify/helmet`. API responses lack X-Content-Type-Options, X-Frame-Options, HSTS, CSP.

**Fix:** `npm i @fastify/helmet` and register in each `app.ts`.

---

### F-36: No Database SSL/TLS Enforcement in Policing APIs

**Severity: P1 | Confidence: High | Status: Confirmed**

Pool created without SSL options. In production, DB traffic would be unencrypted.

**Evidence:** `apps/dopams-api/src/db.ts:17-22` — no SSL config

**Contrast:** PUDA API has `resolveSslConfig()` that throws fatal error if SSL disabled in production.

**Fix:** Port `resolveSslConfig()` from `apps/api/src/db.ts`.

---

### F-37: Token Returned in Login Response Body

**Severity: P2 | Confidence: High | Status: Confirmed**

All login endpoints return the JWT in JSON body alongside the HttpOnly cookie, partially negating HttpOnly protection.

**Evidence:** `apps/dopams-api/src/routes/auth.routes.ts:23` — `return { user, token }`

**Fix:** Remove `token` from response body; rely on HttpOnly cookie only.

---

## 11. Container and Runtime Findings

### F-38: UI Dockerfiles Run nginx as Root

**Severity: P1 | Confidence: High | Status: Confirmed**

All three UI Dockerfiles use `nginx:1.27-alpine` with no `USER` directive.

**Evidence:** `Dockerfile.dopams-ui`, `Dockerfile.forensic-ui`, `Dockerfile.social-media-ui` — no USER directive.

**Contrast:** API Dockerfiles correctly create `appuser:1001`.

**Fix:** Switch to `nginxinc/nginx-unprivileged:1.27-alpine` or add `USER nginx`.

---

### F-39: New UI Dockerfiles Missing CSP/COOP/COEP Headers

**Severity: P1 | Confidence: High | Status: Confirmed**

Generic `nginx.conf` used by policing UIs lacks Content-Security-Policy, Permissions-Policy, COOP, and COEP headers that the citizen/officer configs include.

**Fix:** Create dedicated nginx configs for each policing UI, modeled on `nginx.citizen.conf`.

---

### F-40: No Docker Compose Network Isolation Between Services

**Severity: P2 | Confidence: High | Status: Confirmed**

All 12 services share the default bridge network. DOPAMS API can reach Forensic DB, etc.

**Fix:** Define per-system networks: `dopams-net`, `forensic-net`, `sm-net`.

---

### F-41: No `server_tokens off` in Nginx Configs

**Severity: P2 | Confidence: High | Status: Confirmed**

Nginx version disclosed in `Server` response header across all configs.

**Fix:** Add `server_tokens off;` to all nginx server blocks.

---

### F-42: Swagger UI Exposed in Non-Production

**Severity: P2 | Confidence: Medium | Status: Confirmed**

Swagger enabled when `NODE_ENV !== "production"`, exposing full API schema in staging.

**Fix:** Gate behind `ENABLE_SWAGGER_DOCS=true` opt-in flag.

---

### Positive: Multi-Stage Builds, Non-Root (APIs), .dockerignore, Healthchecks

API Dockerfiles properly use multi-stage builds, create non-root `appuser:1001`, have `.dockerignore`, and include HEALTHCHECK directives. No `--privileged` or `cap_add` in docker-compose.

---

## 12. Compliance Assessment

### OWASP Top 10 (2021)

| # | Risk | Status | Key Evidence |
|---|------|--------|-------------|
| A01 | Broken Access Control | **FAIL** | F-01 (admin no RBAC), F-02 (self-escalation), F-06 (IDOR), F-07 (missing unit_id) |
| A02 | Cryptographic Failures | **FAIL** | F-04 (hardcoded JWT secrets), F-18 (PII plaintext), F-36 (no DB SSL) |
| A03 | Injection | **PASS** | Parameterized queries throughout; F-14 (path traversal) is input validation |
| A04 | Insecure Design | **FAIL** | F-03 (no token revocation), F-10 (no session timeout), F-31 (superficial hash verify) |
| A05 | Security Misconfiguration | **FAIL** | F-34 (CORS wildcard), F-35 (no Helmet), F-42 (Swagger exposed) |
| A06 | Vulnerable Components | **PARTIAL** | F-32 (minimatch ReDoS), F-33 (fast-xml-parser) |
| A07 | Auth Failures | **FAIL** | F-09 (no account lockout), F-17 (no password policy), F-10 (no session timeout) |
| A08 | Software/Data Integrity | **FAIL** | F-24 (no audit hash chain), F-25 (audit deletable), F-30 (custody not immutable) |
| A09 | Logging/Monitoring Failures | **FAIL** | F-26 (reads not logged), F-27 (auth not logged), F-28 (missing fields), F-29 (silent failures) |
| A10 | SSRF | **PASS** | No SSRF vectors identified |

### BRD Compliance Gaps (Policing APIs)

| Requirement ID | Requirement | Status | Gap |
|----------------|------------|--------|-----|
| DOPAMS CNS-SEC-003 | Immutable audit logs | **FAIL** | No hash chain, no DELETE prevention (F-24, F-25) |
| DOPAMS FR-01 AC-01 | Server-side permission enforcement | **FAIL** | Admin routes unprotected (F-01) |
| DOPAMS FR-01 AC-05 | Audit: actor, role, IP, before/after, correlation ID | **FAIL** | Missing fields (F-28) |
| DOPAMS FR-01 BR-01 | Auth failures logged as security events | **FAIL** | Auth excluded from audit (F-27) |
| DOPAMS CNS-REG-002 | PII field masking for unauthorized roles | **FAIL** | No field filtering (F-19) |
| SM FR-02 AC-04 | Idle session expiry (15/30 min) | **FAIL** | 24h fixed expiry (F-10) |
| SM FR-02 BR-01 | Cross-district access denied by default | **FAIL** | Missing unit_id in JWT (F-07) |
| SM CNS-05 | Tamper-evident audit + failed login logging | **FAIL** | No hash chain, no login audit (F-24, F-27) |
| SM ASM-10 | 7-year retention with legal hold | **FAIL** | No retention framework (F-21) |
| Forensic CON-REG-002 | Evidence immutable after ingestion | **FAIL** | No immutability protection (F-30) |
| Forensic OBJ-004 | Court-ready outputs with provenance | **FAIL** | Superficial hash verify (F-31) |

---

## 13. QA Gates and Verdict

### Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Authentication integrity | **FAIL** | F-03 (no revocation), F-04 (hardcoded secrets), F-05 (prefix bypass) |
| 2 | Authorization enforcement | **FAIL** | F-01 (admin no RBAC), F-02 (self-escalation), F-06 (IDOR) |
| 3 | Injection prevention | **PARTIAL** | SQL safe (parameterized); F-14 (path traversal); F-15 (missing validation) |
| 4 | Secret safety | **FAIL** | F-04 (hardcoded JWT), F-22 (shared secret), F-23 (real password in .env) |
| 5 | Data protection | **FAIL** | F-18 (PII plaintext), F-19 (PII returned unfiltered) |
| 6 | Audit trail | **FAIL** | F-24-F-29 (no hash chain, no immutability, missing events/fields) |
| 7 | Dependency safety | **PASS** | No critical CVEs; 2 high + 20 low |
| 8 | Transport security | **FAIL** | F-35 (no Helmet), F-36 (no DB SSL) |

### Non-Blocking Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Container hardening | **PARTIAL** | F-38 (nginx root), F-39 (missing headers); APIs good |
| 2 | Rate limiting | **PASS** | Global + mutation + auth rate limits configured |
| 3 | Monitoring/alerting | **FAIL** | No alerting, auth events not logged |
| 4 | Compliance coverage | **FAIL** | Multiple BRD requirements unmet |

### Verdict

```
AuthN Status:         FAIL
AuthZ Status:         FAIL
Injection Status:     PARTIAL
Secret Safety:        FAIL
Data Protection:      FAIL
Audit Trail:          FAIL
Dependency Safety:    PASS
Transport Security:   FAIL

Blocking Gates:       1/8 PASS, 1/8 PARTIAL, 6/8 FAIL
Non-Blocking Gates:   1/4 PASS, 1/4 PARTIAL, 2/4 FAIL

Security Verdict:     CRITICAL
```

**Blocking issues:** F-01, F-02, F-03, F-04, F-14, F-24, F-25 must be resolved before any production deployment of the policing APIs.

---

## 14. Bugs and Foot-Guns

### High-Impact Findings

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Admin routes accessible to all authenticated users | P0 | `dopams-api/src/routes/admin.routes.ts:7-65` |
| 2 | Privilege escalation via self-role-assignment | P0 | `dopams-api/src/routes/admin.routes.ts:36-65` |
| 3 | No token revocation — stolen tokens valid 24h | P0 | `dopams-api/src/routes/auth.routes.ts:26-31` |
| 4 | Hardcoded JWT secrets without production guard | P0 | `dopams-api/src/middleware/auth.ts:5` |
| 5 | Path traversal via entityType in config routes | P0 | `dopams-api/src/routes/config.routes.ts:28` |
| 6 | No tamper-evident hash chain on audit tables | P0 | `dopams-api/migrations/001_init.sql:232-249` |
| 7 | Audit logs can be deleted/modified by app DB user | P0 | All policing API migrations |
| 8 | Auth middleware bypass — prefix matching too broad | P1 | `dopams-api/src/middleware/auth.ts:71` |
| 9 | IDOR — detail endpoints lack unit_id scoping | P1 | `dopams-api/src/routes/case.routes.ts:42-56` |
| 10 | DOPAMS/SM login omits unit_id from JWT | P1 | `dopams-api/src/routes/auth.routes.ts:21` |
| 11 | No DB SSL in policing APIs | P1 | `dopams-api/src/db.ts:17-22` |
| 12 | PII stored in plaintext JSONB | P1 | `dopams-api/migrations/001_init.sql:38-53` |
| 13 | Subject PII returned without role filtering | P1 | `dopams-api/src/routes/subject.routes.ts:46-56` |

### Medium-Impact Findings

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 14 | No security headers (Helmet) on API responses | P1 | `dopams-api/src/app.ts` |
| 15 | nginx UI containers run as root | P1 | `Dockerfile.dopams-ui` |
| 16 | Generated SQL returned to clients | P1 | `dopams-api/src/services/nl-query.ts:180` |
| 17 | No password complexity validation | P1 | `dopams-api/src/routes/admin.routes.ts:21` |
| 18 | No account lockout mechanism | P1 | `dopams-api/src/routes/auth.routes.ts:7-24` |
| 19 | Auth events excluded from audit log | P1 | `dopams-api/src/middleware/audit-logger.ts:4` |
| 20 | Audit log missing IP, correlation ID, before/after | P1 | `dopams-api/src/middleware/audit-logger.ts:73-78` |
| 21 | Audit logger swallows write failures silently | P1 | `dopams-api/src/middleware/audit-logger.ts:79-81` |
| 22 | Evidence hash verify checks existence not integrity | P1 | `forensic-api/src/routes/evidence.routes.ts:71-79` |
| 23 | CORS defaults to allow-all when env unset | P2 | `dopams-api/src/app.ts:41-43` |
| 24 | No session inactivity timeout | P1 | `dopams-api/src/middleware/auth.ts:50` |
| 25 | Custody event table lacks immutability | P1 | `dopams-api/migrations/006_custody.sql` |

---

## 15. Remediation Backlog

| ID | Title | Priority | Risk Score | Effort | Category | Fix |
|----|-------|----------|------------|--------|----------|-----|
| R01 | Add RBAC guards to admin routes | P0 | 25 | S | AuthZ | Add `requireRole("ADMINISTRATOR")` hook to admin routes in all 3 apps |
| R02 | Block privilege self-escalation | P0 | 25 | S | AuthZ | Prevent users from modifying their own roles; require admin auth |
| R03 | Implement token revocation | P0 | 20 | M | AuthN | Port `token-security.ts` from PUDA; add denylist table + middleware check |
| R04 | Add production guard for JWT_SECRET | P0 | 25 | S | Secrets | Fatal error if unset in non-test environments (copy PUDA pattern) |
| R05 | Fix path traversal in config routes | P0 | 20 | S | Input | Add regex pattern `^[a-z_]+$` + post-resolve path validation |
| R06 | Add tamper-evident hash chain to audit tables | P0 | 15 | M | Audit | Port `migrations/017_audit_hash_chain.sql` from PUDA |
| R07 | Protect audit tables from DELETE/UPDATE | P0 | 15 | S | Audit | Add DB rules/triggers + REVOKE DELETE,UPDATE |
| R08 | Fix auth middleware prefix bypass | P1 | 15 | S | AuthN | Remove `startsWith("/api/v1/auth/")`, use exact PUBLIC_ROUTES matching |
| R09 | Add unit_id scoping to detail endpoints | P1 | 15 | M | AuthZ | Add `AND unit_id = $2` to all GET /:id queries |
| R10 | Include unit_id in JWT for DOPAMS + SM | P1 | 12 | S | AuthN | Add `unit_id: user.unit_id` to `generateToken()` calls |
| R11 | Add JWT algorithm enforcement | P1 | 10 | S | AuthN | `jwt.verify(token, secret, { algorithms: ["HS256"] })` |
| R12 | Add account lockout mechanism | P1 | 12 | M | AuthN | Track failed attempts per user, lock after 5 failures |
| R13 | Enforce DB SSL in policing APIs | P1 | 12 | S | Transport | Port `resolveSslConfig()` from PUDA `db.ts` |
| R14 | Register @fastify/helmet on all APIs | P1 | 10 | S | Transport | `npm i @fastify/helmet` + register in `app.ts` |
| R15 | Add CSP/COOP/COEP to policing UI nginx configs | P1 | 10 | S | Container | Create dedicated configs modeled on `nginx.citizen.conf` |
| R16 | Fix nginx containers to run as non-root | P1 | 8 | S | Container | Switch to `nginxinc/nginx-unprivileged` |
| R17 | Add password complexity validation | P1 | 10 | S | AuthN | `minLength: 12` + complexity rules in schema |
| R18 | Implement PII field-level encryption | P1 | 12 | L | Data | Envelope encryption for identifiers, addresses, bank_ref |
| R19 | Add role-based PII field filtering | P1 | 12 | M | Data | Return sensitive fields only to authorized roles |
| R20 | Remove generatedSql from API responses | P1 | 8 | S | Input | Remove field or gate behind admin role |
| R21 | Log auth events (login/logout/failure) | P1 | 10 | S | Audit | Remove /auth/ from SKIP_PATHS; add explicit audit entries |
| R22 | Add missing audit fields (IP, corr ID, role) | P1 | 10 | M | Audit | Add columns to audit tables + populate in middleware |
| R23 | Handle audit write failures properly | P1 | 8 | M | Audit | Block approval actions when audit persistence unavailable |
| R24 | Log GET/read operations for sensitive endpoints | P1 | 8 | M | Audit | Extend METHOD_TO_EVENT to include GET |
| R25 | Add session inactivity timeout | P1 | 10 | M | AuthN | Short-lived JWTs (15min) + refresh tokens |
| R26 | Add custody table immutability | P1 | 10 | S | Audit | DB rules preventing UPDATE/DELETE on custody_event |
| R27 | Fix evidence hash verification | P1 | 10 | S | Data | Recompute SHA-256 from file and compare |
| R28 | Harden CORS fallback | P2 | 8 | S | Transport | Default to `[]` instead of `true`; fatal error in prod |
| R29 | Remove token from login response body | P2 | 6 | S | AuthN | Return only `{ user }`, rely on HttpOnly cookie |
| R30 | Add schema validation to geofence routes | P2 | 6 | S | Input | Add Fastify JSON schemas with additionalProperties: false |
| R31 | Implement Docker network isolation | P2 | 8 | S | Container | Define per-system networks in docker-compose |
| R32 | Add server_tokens off to nginx | P2 | 4 | S | Container | Add `server_tokens off;` to all configs |
| R33 | Gate Swagger behind opt-in flag | P2 | 4 | S | Config | Use `ENABLE_SWAGGER_DOCS=true` instead of `NODE_ENV` check |
| R34 | Add dashboard unit_id filtering | P2 | 6 | S | AuthZ | Filter dashboard queries by user's unit |
| R35 | Align log redaction patterns | P2 | 6 | S | Data | Add email, phone, mobile, address to policing API redaction |
| R36 | Add MFA for policing APIs | P2 | 8 | L | AuthN | Port MFA from PUDA, require for admin + critical ops |
| R37 | Fix minimatch ReDoS vulnerability | P2 | 6 | S | Deps | `npm audit fix` |
| R38 | Implement data retention framework | P2 | 6 | L | Data | Add anonymization + retention policies + legal hold |
| R39 | Use per-service JWT secrets in docker-compose | P1 | 10 | S | Secrets | Distinct secrets per service |
| R40 | Rotate Cloud SQL password in .env | P1 | 8 | S | Secrets | Generate new password, update Cloud SQL + .env |

---

## 16. Quick Wins and Stabilization

### Quick Wins (< 2 hours each)

| # | Task | Files | Verify |
|---|------|-------|--------|
| 1 | Add production guard for JWT_SECRET | `*/middleware/auth.ts` (3 files) | Start without JWT_SECRET → fatal error |
| 2 | Fix path traversal — add regex pattern validation | `*/routes/config.routes.ts` (3 files) | `GET .../../../etc/passwd` → 400 |
| 3 | Add `requireRole("ADMINISTRATOR")` to admin routes | `*/routes/admin.routes.ts` (3 files) | Non-admin → 403 on `/api/v1/users` |
| 4 | Fix auth middleware prefix bypass | `*/middleware/auth.ts` (3 files) | Remove `startsWith`, exact match only |
| 5 | Add unit_id to JWT generation | `dopams-api/src/routes/auth.routes.ts`, `social-media-api/src/routes/auth.routes.ts` | Decoded JWT contains unitId |
| 6 | Add JWT algorithm enforcement | `*/middleware/auth.ts` (4 files) | Token with `alg:none` → rejected |
| 7 | Install and register @fastify/helmet | 3 policing API `app.ts` files | Response has X-Content-Type-Options header |
| 8 | Remove generatedSql from NL query responses | `*/services/nl-query.ts` (3 files) | Response body has no `generatedSql` field |
| 9 | Harden CORS fallback to empty array | `*/app.ts` (3 files) | Unset ALLOWED_ORIGINS → no CORS allowed |
| 10 | Add password minLength validation | `*/routes/admin.routes.ts` (3 files) | Create user with 3-char password → 400 |

### 2-Day Stabilization Sprint

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Implement token revocation (port from PUDA) | M | Eliminates 24h stolen-token window |
| 2 | Add unit_id scoping to all detail endpoints | M | Fixes cross-unit data access |
| 3 | Port DB SSL config from PUDA | S | Encrypted DB connections |
| 4 | Add tamper-evident hash chain to audit tables | M | Immutable audit trail (BRD compliance) |
| 5 | Protect audit + custody tables from DELETE/UPDATE | S | Data integrity |
| 6 | Log auth events (login/logout/failure) | S | Security monitoring visibility |
| 7 | Add audit log fields (IP, correlation ID, role) | M | Complete audit record |
| 8 | Implement account lockout mechanism | M | Brute-force protection |
| 9 | Create dedicated nginx configs for policing UIs | S | CSP/COOP/COEP headers |
| 10 | Switch UI Dockerfiles to non-root nginx | S | Container hardening |
| 11 | Add Fastify schemas to geofence/model routes | S | Input validation coverage |
| 12 | Docker network isolation per system | S | Service boundary enforcement |
| 13 | Add role-based PII field filtering on subject routes | M | Data protection compliance |
| 14 | Fix evidence hash verification to recompute | S | Evidence integrity for court |
| 15 | Remove token from login response body | S | HttpOnly cookie security |

---

## 17. Top 5 Priorities

1. **Lock down admin routes** (F-01, F-02) — Any authenticated user can become admin. Fix in 30 minutes. This is the single most exploitable vulnerability.

2. **Add production guard for JWT_SECRET** (F-04) — Public source code contains the fallback secret. Without the guard, production deployment with missing env var = total auth bypass. Fix in 15 minutes.

3. **Fix path traversal** (F-14) — Arbitrary file read via config endpoint. Fix in 15 minutes with regex validation.

4. **Implement token revocation** (F-03) — Stolen tokens valid for 24 hours with no ability to invalidate. Port from PUDA in ~4 hours.

5. **Add tamper-evident audit trail** (F-24, F-25) — Law enforcement data without immutable audit logs fails court admissibility. Port from PUDA in ~4 hours.

---

*Report generated by Claude Code security review. 42 findings total: 7 P0 (Critical), 18 P1 (High), 13 P2 (Medium), 4 P3 (Low).*
