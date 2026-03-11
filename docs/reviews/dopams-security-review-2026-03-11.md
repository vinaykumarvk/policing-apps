# DOPAMS Security & Compliance Review

**Date:** 2026-03-11
**Scope:** DOPAMS API (`apps/dopams-api/`), DOPAMS UI (`apps/dopams-ui/`), Shared Auth (`packages/api-core/`), Nginx (`nginx.conf`)
**Reviewer:** Automated Security Audit

---

## Executive Summary

The DOPAMS application demonstrates a **generally strong security posture** with proper JWT authentication, parameterized SQL queries, role-based access control, comprehensive audit logging, and well-configured HTTP security headers. However, several findings require attention before production deployment — particularly around dynamic SQL construction patterns, a missing unit-scoping gap in control-room and analytics dashboards, and the hardcoded dev secret that must be environment-gated.

**Overall Verdict: AT-RISK**

7 findings require remediation before production go-live. No CRITICAL findings, but 3 HIGH and 4 MEDIUM issues represent real risk in a law enforcement context where data sensitivity is extreme.

---

## 1. Authentication & Authorization

### 1.1 JWT Implementation

**Status: GOOD with caveats**

The auth middleware (`packages/api-core/src/middleware/auth-middleware.ts`) implements:

- HS256 JWT with configurable expiry (default 30 minutes) — **line 76**
- `httpOnly`, `secure`, `sameSite` cookie attributes — **lines 81-88**
- Token revocation via denylist table + per-user `tokens_revoked_before` — **lines 95-126**
- Session inactivity timeout (15 min default) — **lines 128-136**
- MFA challenge token restriction — **lines 194-201**
- OIDC RS256 fallback verification — **lines 166-169**

**Strengths:**
- Token includes `jti` (unique ID) for individual revocation
- `secure` flag is correctly gated on `NODE_ENV === "production"` — **line 84**
- Inactivity check uses database-backed timestamp with 1-minute update throttle — **line 144**

### 1.2 Password Storage

**Status: STRONG**

Passwords are hashed using Argon2id (`packages/api-core/src/auth/local-auth.ts:1-8`) with proper parameters:
- `memoryCost: 65536` (64 MB)
- `timeCost: 3`
- `parallelism: 1`

This is the current industry best practice per OWASP.

### 1.3 Role-Based Access Control

**Status: GOOD**

Role guards are implemented via `createRoleGuard()` (`packages/api-core/src/middleware/role-guard.ts`) and applied to sensitive routes:

| Route | Guard | File |
|-------|-------|------|
| Subject create/update | `INTELLIGENCE_ANALYST, SUPERVISORY_OFFICER, ADMINISTRATOR` | `subject.routes.ts:211` |
| Alert actions | `SUPERVISORY_OFFICER, ZONAL_OFFICER, INTELLIGENCE_ANALYST, ADMINISTRATOR` | `alert.routes.ts:9-11` |
| Evidence legal hold | `SUPERVISORY_OFFICER, ADMINISTRATOR` | `evidence.routes.ts:10` |
| Dashboard stats | `SUPERVISORY_OFFICER, ZONAL_OFFICER, INTELLIGENCE_ANALYST, ADMINISTRATOR` | `dashboard.routes.ts:8-10` |
| Graph analysis | `INTELLIGENCE_ANALYST, SUPERVISORY_OFFICER, ADMINISTRATOR` | `graph.routes.ts:9` |
| Graph rebuild | `ADMINISTRATOR` | `graph.routes.ts:127` |

### Findings

#### [HIGH] F-01: Dev secret used as JWT fallback in non-production

**File:** `apps/dopams-api/src/middleware/auth.ts:9`, `apps/dopams-api/src/app.ts:286,297`, `apps/dopams-api/src/routes/auth.routes.ts:8`
**Severity:** HIGH

The `defaultDevSecret: "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"` is passed to `createAuthMiddleware`. While `getJwtSecret()` in `auth-middleware.ts:31-35` throws in production if `JWT_SECRET` is unset, this same secret string is repeated in **four** locations. If any `NODE_ENV` misconfiguration occurs, all tokens would be signed with a known, predictable secret.

**Recommendation:** Extract the dev secret to a single constant. Add a startup health-check that verifies `JWT_SECRET` is at least 32 bytes of entropy in production. Consider removing the fallback entirely and requiring `JWT_SECRET` in all environments.

#### [MEDIUM] F-02: Token stored in localStorage on the frontend

**File:** `apps/dopams-ui/src/useAuth.ts:29-30`
**Severity:** MEDIUM

The JWT token is stored in `localStorage` alongside the user object. While the API also sets an `httpOnly` cookie, the frontend explicitly reads from `localStorage` for `Authorization` headers. This exposes the token to XSS attacks — if any XSS vulnerability exists, `localStorage` content is trivially exfiltrated.

**Recommendation:** Rely exclusively on the `httpOnly` cookie for authentication. Remove `localStorage` token storage and send requests with `credentials: "include"` instead of explicit `Authorization` headers. The cookie is already set by the auth middleware.

#### [MEDIUM] F-03: Missing unit-scoping on control-room and analytics dashboards

**File:** `apps/dopams-api/src/routes/dashboard.routes.ts:160-183` (control-room), `dashboard.routes.ts:212-325` (analytics), `dashboard.routes.ts:375-419` (pendency)
**Severity:** MEDIUM

The `/api/v1/dashboard/control-room`, `/api/v1/dashboard/analytics`, `/api/v1/dashboard/trends`, and `/api/v1/dashboard/pendency` endpoints apply the `requireDashboardAccess` role guard but **do not filter data by `unit_id`**. This means a supervisor in District 1 can see alerts, cases, and subjects from District 2 via these endpoints.

Compare with `/api/v1/dashboard/stats` (line 29) which correctly applies `unitId` filtering, and the primary `/api/v1/alerts` endpoint (line 41) which filters by `unit_id`.

**Recommendation:** Add `unit_id` filtering to all dashboard aggregate queries. Use the same pattern as the `/stats` endpoint: extract `request.authUser?.unitId` and apply it as a WHERE clause.

#### [LOW] F-04: `sameSite: "none"` in production cookie

**File:** `packages/api-core/src/middleware/auth-middleware.ts:85`
**Severity:** LOW

In production, the auth cookie uses `sameSite: "none"`. While `secure: true` is also set (mitigating CSRF for same-site requests), `sameSite: "none"` means the cookie is sent on all cross-site requests, which widens the CSRF attack surface.

**Recommendation:** Use `sameSite: "strict"` or `sameSite: "lax"` in production unless cross-origin cookie sending is specifically required (e.g., for OIDC flows from a different domain). If OIDC requires `"none"`, document the justification.

---

## 2. Injection Prevention

### 2.1 SQL Injection

**Status: GOOD — with exceptions requiring review**

The vast majority of queries use parameterized placeholders (`$1`, `$2`, etc.) via the `pg` driver. This is the correct approach.

**However, several patterns use string interpolation for table/column names:**

### Findings

#### [HIGH] F-05: Dynamic table/column interpolation in SQL queries (controlled but fragile)

**Files:**
- `apps/dopams-api/src/routes/translate.routes.ts:153` — `SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`
- `apps/dopams-api/src/routes/legal.routes.ts:78` — same pattern
- `apps/dopams-api/src/services/classifier.ts:78` — same pattern
- `apps/dopams-api/src/routes/drug-classify.routes.ts:40` — same pattern
- `apps/dopams-api/src/routes/dashboard.routes.ts:408` — `FROM ${table}`
- `apps/dopams-api/src/services/nl-query.ts:44,65,117` — `FROM ${table}`, `SELECT ${entity.idCol}`
- `apps/dopams-api/src/services/search.ts:120-135` — `FROM ${table.tableName}`

**Severity:** HIGH

While the interpolated values come from internal code-level switch statements (not user input), this pattern is fragile:

1. In `translate.routes.ts:128-148` and `legal.routes.ts:67-76`, the `entityType` comes from the request body. The switch statements map to safe table names, but the `default` case does not exist in translate (it returns an error) — however, a refactoring mistake could introduce a path where user input reaches the SQL string.

2. In `dashboard.routes.ts:389`, `table` is derived from a query parameter: `const table = entityType === "cases" ? "dopams_case" : entityType === "leads" ? "lead" : "alert"`. While currently safe (only 3 hardcoded values), the ternary chain lacks an explicit allowlist check.

3. In `nl-query.ts:44`, `table` is derived from regex-matched user input mapped through `entityMap`. The map keys come from user natural language input.

**Recommendation:** Create a shared `resolveEntityTable()` function that validates against an explicit allowlist and throws if the entity type is unknown. Use this function in all locations that interpolate table names. Example:

```typescript
const ENTITY_TABLE_MAP = new Map([
  ["dopams_alert", { table: "alert", idCol: "alert_id", textCol: "description" }],
  // ...
]);
function resolveEntityTable(entityType: string) {
  const mapping = ENTITY_TABLE_MAP.get(entityType);
  if (!mapping) throw new Error(`Unknown entity type: ${entityType}`);
  return mapping;
}
```

### 2.2 XSS Prevention

**Status: GOOD**

#### [LOW] F-06: `dangerouslySetInnerHTML` with proper escaping

**File:** `apps/dopams-ui/src/views/ReportGenerateHub.tsx:923`
**Severity:** LOW

The `dangerouslySetInnerHTML` usage renders LLM-generated markdown. The `renderMarkdown()` function (`apps/dopams-ui/src/utils/render-markdown.ts:1-9`) correctly HTML-escapes all content **before** applying markdown transformations. The escape function covers `&`, `<`, `>`, `"`, and `'`.

**Status:** Acceptable. The escaping is applied in the correct order (escape first, then format). No remediation needed, but add a code comment documenting that the escape-first ordering is security-critical.

### 2.3 Command Injection

**Status: CLEAN**

No `exec()`, `spawn()`, `eval()`, or shell command execution patterns found in the DOPAMS API or UI code.

### 2.4 Path Traversal

**Status: GOOD**

The evidence file serving endpoint (`evidence.routes.ts:14-17,499-501`) implements a proper path traversal check:

```typescript
function validateFilePath(filePath: string, baseDir: string): string | null {
  const resolved = join(baseDir, filePath);
  if (!resolved.startsWith(baseDir)) return null;
  return resolved;
}
```

This is used at lines 500 and 642 before any file read operation.

---

## 3. Data Privacy

### Findings

#### [MEDIUM] F-07: PII masking only applied to GET-one, not to LIST endpoints

**File:** `apps/dopams-api/src/routes/subject.routes.ts:18-25,262,314`
**Severity:** MEDIUM

The `maskSubjectPII()` function redacts sensitive fields (identifiers, addresses, bank details, passport, fingerprints, DNA) for non-privileged roles. It is applied to:
- GET `/api/v1/subjects/:id` — **line 314** (applied)
- POST `/api/v1/subjects` response — **line 662** (applied)

But it is **not** applied to:
- GET `/api/v1/subjects` (list) — **line 262** (returns `result.rows` directly)
- GET `/api/v1/subjects/:id` with `?include=entities` — entity sub-resources (phones, bank accounts, addresses) at **lines 469-487** are returned without any PII masking

This means non-privileged users can see full bank account numbers, phone details, and identity documents through the entities sub-query, even though the subject's top-level PII fields would be masked on the detail view.

**Recommendation:**
1. Apply `maskSubjectPII()` to each row in the list endpoint response.
2. For entity sub-resources, implement equivalent masking for bank account numbers, phone numbers, and identity document values for non-privileged roles.

### 3.1 Access Justification & Audit

**Status: GOOD**

The privacy module (`apps/dopams-api/src/routes/privacy.routes.ts`) implements:
- Access justification submission with mandatory reason text — **lines 11-46**
- Active justification checking (8-hour window) — **lines 49-79**
- Supervisor audit statistics — **lines 82-123**
- Detailed access log with filtering — **lines 126-172**
- PII redaction log — **lines 175-197**

### 3.2 Audit Trail

**Status: STRONG**

The audit logger (`packages/api-core/src/middleware/audit-logger.ts`) provides:
- Automatic logging of all HTTP methods (READ, CREATE, UPDATE, DELETE) — **lines 15-20**
- Request payload redaction (via `redactValue`) — **line 96**
- IP address and request ID capture — **line 107**
- Actor role recording — **line 107**
- Circuit breaker: mutations are blocked when audit logging fails 5+ consecutive times — **lines 63-73**
- Truncation warning for large payloads (>4000 chars) — **lines 97-99**

Additionally, domain-specific audit logging exists for:
- Alert state transitions — `alert.routes.ts:450-454`
- Alert false positive marking — `alert.routes.ts:542-546`
- Evidence custody chain — multiple locations in `evidence.routes.ts`

---

## 4. Secrets Management

### 4.1 Server-Side

**Status: GOOD**

- JWT secret enforced via env var in production (`packages/api-core/src/middleware/auth-middleware.ts:31-33`)
- OIDC client secret from env var (`apps/dopams-api/src/app.ts:303`)
- LDAP bind password from env var (`apps/dopams-api/src/app.ts:282`)
- Database credentials from env var via `createPool` (`apps/dopams-api/src/db.ts:8-11`)
- LLM API keys kept server-side via page-agent proxy (`packages/api-core/src/routes/page-agent-routes.ts:1-6`)

### 4.2 Client-Side

**Status: GOOD**

- No API keys, secrets, or credentials in client bundle
- `apiBaseUrl` configured via `import.meta.env.VITE_API_BASE_URL` (`apps/dopams-ui/src/types.ts:537-538`)
- Swagger UI disabled in production (`apps/dopams-api/src/app.ts:132,177-179`)

### 4.3 Seed Data

#### [LOW] F-08: Seed script uses weak passwords

**File:** `apps/dopams-api/scripts/seed.ts:45-47`
**Severity:** LOW

Seed users have password `"password"`. The locale files also reference `"password123"` as test credentials (`apps/dopams-ui/src/locales/en.ts:248`).

**Recommendation:** Ensure seed scripts are never run in production. Add a guard: `if (process.env.NODE_ENV === "production") throw new Error("NEVER run seed in production")`. Remove test credential hints from locale files before production build.

---

## 5. Input Validation

### Status: GOOD

All route files use Fastify JSON Schema validation with `additionalProperties: false` consistently:

| File | Schema Coverage | Notes |
|------|----------------|-------|
| `auth.routes.ts` | Body validated | `username`, `password` with minLength/maxLength |
| `subject.routes.ts` | Body + params + querystring | UUID format on params, enum constraints on status fields, maxLength on strings |
| `alert.routes.ts` | Body + params + querystring | UUID format, enum for action types, maxLength on strings |
| `evidence.routes.ts` | Body + params + querystring | UUID format, MIME type allowlist, maxLength on strings |
| `dashboard.routes.ts` | Querystring | Date format validation, enum for granularity |
| `graph.routes.ts` | Body + params + querystring | Integer min/max on depth, UUID format |
| `interrogation.routes.ts` | Body + params | UUID format, enum for state transitions |
| `legal.routes.ts` | Body + params + querystring | UUID format |
| `privacy.routes.ts` | Body + params + querystring | Enum for entity types, UUID format, minLength/maxLength |
| `saved-search.routes.ts` | Body + params + querystring | UUID format, minLength/maxLength |
| `ingestion.routes.ts` | Body + params + querystring | UUID format, enum for connector types, minimum on poll interval |

**Body size limit:** 10 MB (`apps/dopams-api/src/app.ts:75`)

**File upload validation:**
- Evidence upload validates MIME type against an explicit allowlist of 8 types — `evidence.routes.ts:22-31,58-60`
- SHA-256 hash computed and checked for duplicates — `evidence.routes.ts:63-81`

**Pagination:**
- All list endpoints cap `limit` at 200 and enforce minimum of 1
- Offset clamped to minimum 0

---

## 6. OWASP Top 10 Assessment

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | **AT-RISK** | Unit-scoping gap on dashboard routes (F-03). PII masking gap (F-07). |
| A02 | Cryptographic Failures | **PASS** | Argon2id for passwords, SHA-256 for evidence, HS256/RS256 JWT. |
| A03 | Injection | **AT-RISK** | Dynamic SQL table interpolation patterns (F-05), though values are from internal maps. |
| A04 | Insecure Design | **PASS** | Four-eyes principle on legal rule approval (`legal.routes.ts:339`). Workflow state machine with guard checks. |
| A05 | Security Misconfiguration | **PASS** | Helmet enabled, Swagger disabled in prod, server tokens off. |
| A06 | Vulnerable Components | **UNDETERMINED** | Requires dependency audit (`npm audit`). Not in scope of code review. |
| A07 | Identification Failures | **PASS** | Strong password hashing, token revocation, session inactivity timeout, MFA support. |
| A08 | Software/Data Integrity | **PASS** | Evidence SHA-256 chain of custody, row versioning for optimistic concurrency. |
| A09 | Security Logging Failures | **PASS** | Comprehensive audit logging with circuit breaker, custody event logging for evidence. |
| A10 | SSRF | **LOW RISK** | `page-agent/complete` proxies to configured LLM provider. Connector configs store `endpointUrl` but no evidence of server-side fetch to arbitrary URLs. |

---

## 7. HTTP Security

### 7.1 CORS Configuration

**Status: GOOD**

- `ALLOWED_ORIGINS` required in production — `app.ts:68-69`
- Production startup throws if unset — explicit fail-safe
- `credentials: true` enabled for cookie auth — `app.ts:96`
- Allowed headers restricted to `Content-Type`, `Authorization`, `X-Idempotency-Key` — `app.ts:97`

### 7.2 Security Headers (Nginx)

**Status: GOOD**

`nginx.conf` sets:

| Header | Value | Status |
|--------|-------|--------|
| `X-Frame-Options` | `SAMEORIGIN` | GOOD |
| `X-Content-Type-Options` | `nosniff` | GOOD |
| `X-XSS-Protection` | `0` | GOOD (deprecated, correct to disable) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | GOOD |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | GOOD (2 years) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | GOOD |
| `Content-Security-Policy` | See below | GOOD with caveat |

**CSP Analysis:**
- `default-src 'self'` — GOOD
- `script-src 'self'` — GOOD (no `unsafe-inline` or `unsafe-eval`)
- `style-src 'self' 'unsafe-inline'` — ACCEPTABLE (needed for JSX inline styles)
- `img-src 'self' data: blob:` — ACCEPTABLE (needed for evidence thumbnails)
- `connect-src 'self' http://localhost:* https://*.puda.gov.in https://*.run.app` — **Note:** `http://localhost:*` should be removed in production CSP
- `frame-ancestors 'self'` — GOOD (prevents clickjacking)
- `object-src` not set in nginx but set to `'none'` in API Helmet config — GOOD

### 7.3 Rate Limiting

**Status: GOOD**

- Global rate limit: configurable via `RATE_LIMIT_MAX` env var, default 100/min — `app.ts:101-105`
- Mutation endpoints: 30/min automatic limit — `app.ts:107-130`
- Auth login: has its own stricter limit (referenced in comment at line 108)

### 7.4 HTTPS

**Status: GOOD**

- HSTS header with 2-year max-age and preload directive
- Cookie `secure` flag gated on production
- No hardcoded `http://` URLs in production paths (only localhost fallback in dev)

---

## 8. Audit Trail

### Status: STRONG

The audit system has three layers:

**Layer 1 — Global HTTP audit** (`packages/api-core/src/middleware/audit-logger.ts`):
- Every request logged with entity type, entity ID, event type, actor, IP, request ID
- Payload redacted before storage (sensitive field scrubbing)
- Circuit breaker blocks mutations when audit DB is unreachable
- Response status code captured

**Layer 2 — Domain audit** (explicit `audit_log` inserts):
- Alert state transitions — `alert.routes.ts:450-454`
- Alert false positive — `alert.routes.ts:542-546`
- Export operations — `admin.routes.ts:40-44`

**Layer 3 — Evidence custody chain** (`custody_event` table):
- Every evidence interaction logged: CREATED, VIEWED, HASH_VERIFIED, PACKAGED, FILE_ACCESSED, COPIED, COURT_EXPORTED, LEGAL_HOLD_APPLIED, LEGAL_HOLD_RELEASED
- Actor ID and hash values preserved at each step
- Non-blocking writes (`.catch()`) to avoid blocking main operations while still logging

**Layer 4 — Access justification** (`access_justification` table):
- Users must provide reason for accessing sensitive records
- Supervisor can audit all access patterns
- 8-hour window for active justifications

**Layer 5 — Page agent audit** (`page_agent_audit_log` table):
- LLM-assisted actions logged with instruction, target, and blocking status

---

## Findings Summary

| ID | Severity | Category | Description | File(s) |
|----|----------|----------|-------------|---------|
| F-01 | **HIGH** | Auth | Dev JWT secret repeated in 4 locations, fallback could be hit on misconfiguration | `auth.ts:9`, `app.ts:286,297`, `auth.routes.ts:8` |
| F-02 | **MEDIUM** | Auth | JWT token stored in localStorage, vulnerable to XSS exfiltration | `useAuth.ts:29-30` |
| F-03 | **MEDIUM** | AuthZ | Dashboard control-room, analytics, trends, and pendency endpoints missing unit_id scoping | `dashboard.routes.ts:160,212,341,386` |
| F-04 | **LOW** | Auth | `sameSite: "none"` in production widens CSRF surface | `auth-middleware.ts:85` |
| F-05 | **HIGH** | Injection | Dynamic SQL table/column interpolation from internal maps (fragile pattern) | `translate.routes.ts:153`, `legal.routes.ts:78`, `nl-query.ts:44,65,117`, `search.ts:120,131`, `dashboard.routes.ts:408`, `classifier.ts:78` |
| F-06 | **LOW** | XSS | `dangerouslySetInnerHTML` used (but properly escaped) | `ReportGenerateHub.tsx:923` |
| F-07 | **MEDIUM** | Privacy | PII masking not applied to subject list endpoint or entity sub-resources | `subject.routes.ts:262,469-487` |
| F-08 | **LOW** | Secrets | Seed script uses weak passwords; test credentials visible in locale files | `seed.ts:45-47`, `en.ts:248` |

---

## Remediation Priority

### Must-fix before production (HIGH):
1. **F-01:** Consolidate dev secret, add entropy validation for `JWT_SECRET`
2. **F-05:** Create a shared allowlist-based `resolveEntityTable()` function for all dynamic SQL table references

### Should-fix before production (MEDIUM):
3. **F-03:** Add `unit_id` filtering to all dashboard aggregate endpoints
4. **F-07:** Apply PII masking to subject list responses and entity sub-resources
5. **F-02:** Migrate from localStorage token to cookie-only auth on the frontend

### Nice-to-have (LOW):
6. **F-04:** Evaluate `sameSite` policy for production cookies
7. **F-06:** Add code comment documenting escape-first ordering is security-critical
8. **F-08:** Guard seed script against production execution

---

## Positive Security Highlights

These practices are commendable and should be maintained:

1. **Argon2id password hashing** with proper parameters
2. **Token revocation** via denylist + per-user global revocation
3. **Session inactivity timeout** with database-backed tracking
4. **Audit circuit breaker** that blocks mutations when audit logging is unavailable
5. **Evidence SHA-256 chain of custody** with tamper detection
6. **Four-eyes principle** on legal rule approval (creator cannot approve)
7. **Path traversal protection** on evidence file serving
8. **MIME type allowlist** for evidence uploads
9. **Comprehensive rate limiting** (global + mutation-specific)
10. **Swagger disabled in production**
11. **HSTS with preload** directive
12. **PII redaction in audit payloads** via `redactValue()`
13. **Idempotency middleware** for write endpoints
14. **Access justification** system for sensitive data access
15. **Role guards** consistently applied to sensitive routes

---

**Verdict: AT-RISK**

The application has a solid security foundation. The 3 HIGH findings (F-01, F-05) and 3 MEDIUM findings (F-02, F-03, F-07) must be addressed before production deployment. The dynamic SQL interpolation pattern (F-05) and unit-scoping gap (F-03) are the most actionable — both can be fixed with targeted refactoring. The JWT localStorage issue (F-02) requires a frontend architecture change that should be planned for the next sprint if not addressable immediately.
