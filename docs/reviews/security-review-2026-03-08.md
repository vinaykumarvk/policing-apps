# Security & Compliance Review -- 2026-03-08

**Scope:** `apps/dopams-api`, `apps/forensic-api`, `apps/social-media-api`, `packages/api-core`
**Focus:** BRD gap closure changes, LDAP auth, new routes/services, OWASP Top 10

---

## 1. Authentication

### [CRITICAL] LDAP Stub Accepts Any Password
- **Location**: `packages/api-core/src/auth/ldap-auth.ts:66`
- **Issue**: The LDAP authentication stub accepts **any password** for users with `auth_source = 'ldap'`. Line 66 comments: "In stub mode we accept any password -- real impl would bind to LDAP server." If the LDAP adapter is enabled via `LDAP_URL` and `LDAP_BASE_DN` env vars, any attacker who knows (or guesses) an LDAP username can authenticate without knowing the password. There is no runtime flag to distinguish stub mode from production, so if these env vars are set in any environment, the bypass is active.
- **Fix**: (1) Add an explicit `LDAP_STUB_MODE=true` env flag and **refuse to start** in production (`NODE_ENV=production`) when stub mode is active. (2) When `LDAP_STUB_MODE` is not set, throw an error if `ldapjs` is not installed rather than silently falling back. (3) Short-term: do not wire `ldapAuth` into the auth routes until a real LDAP bind implementation exists.

### [HIGH] OIDC Callback Returns JWT in Response Body
- **Location**: `packages/api-core/src/routes/oidc-routes.ts:126`
- **Issue**: The OIDC callback handler returns `{ user: payload, token: localToken }` in the JSON response body. This exposes the JWT to any JavaScript running on the page, making it vulnerable to XSS token theft. The cookie is already set via `setAuthCookie` (httpOnly), so the response body token is redundant and increases attack surface.
- **Fix**: Remove `token: localToken` from the OIDC callback response. The httpOnly cookie is the sole intended transport for the JWT.

### [MEDIUM] Dev JWT Secrets Hardcoded in Application Code
- **Location**: `apps/dopams-api/src/routes/auth.routes.ts:8`, `apps/forensic-api/src/routes/auth.routes.ts:7`, `apps/social-media-api/src/routes/auth.routes.ts:6`, `apps/dopams-api/src/app.ts:262`, `apps/forensic-api/src/app.ts:239`, `apps/social-media-api/src/app.ts:250`
- **Issue**: Each API app has a hardcoded `defaultDevSecret` string (e.g. `"dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION"`, `"forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION"`, `"sm-dev-secret-DO-NOT-USE-IN-PRODUCTION"`). The auth middleware in `packages/api-core/src/middleware/auth-middleware.ts:30-33` enforces that `JWT_SECRET` must be set in production, but the dev secrets are still present in source code and are used in all non-production environments (including staging, QA). If any non-production environment is internet-accessible, tokens can be forged.
- **Fix**: Generate random dev secrets at startup (e.g. `crypto.randomUUID()`) rather than hardcoding predictable strings. This prevents token portability between developers and test environments.

### [MEDIUM] JWT Expiration Default of 30 Minutes May Be Overridden to 24h
- **Location**: `packages/api-core/src/middleware/auth-middleware.ts:75`, `.env:16`
- **Issue**: The auth middleware defaults to `30m` JWT expiry, but the `.env` file sets `JWT_EXPIRES_IN=24h`. A 24-hour JWT lifetime is excessive for a policing application handling sensitive data -- if a token is stolen, the attacker has a full day window. The inactivity timeout of 15 minutes mitigates this partially, but only if the `auth_session_activity` table is properly maintained.
- **Fix**: Enforce a maximum JWT lifetime in code (e.g. cap at 1 hour regardless of env var). Set the `.env` default to `30m` or `1h`.

### [LOW] No MFA on LDAP Login Path
- **Location**: `packages/api-core/src/routes/auth-routes.ts:26-47`
- **Issue**: The LDAP login endpoint issues a full JWT token without checking `mfa_enabled` on the user account. The local auth path correctly checks MFA (line 61-63), but LDAP login bypasses this entirely.
- **Fix**: After successful LDAP auth, check the user's `mfa_enabled` flag in the DB. If enabled, return `mfaRequired: true` and a challenge token instead of a full JWT, matching the local auth flow.

---

## 2. Authorization

### [HIGH] NL Query Endpoints Lack Role-Based Access Control
- **Location**: `apps/dopams-api/src/routes/nl-query.routes.ts`, `apps/forensic-api/src/services/nl-query.ts`, `apps/social-media-api/src/services/nl-query.ts`
- **Issue**: The NL query feature allows any authenticated user to run natural-language queries that execute SQL against core tables (`alert`, `dopams_case`, `lead`, `subject_profile`, `forensic_case`, `ai_finding`, `sm_alert`, `case_record`). There is no role guard -- a user with a low-privilege role can query all entities across all units. The DOPAMS NL query does not even scope results by `unit_id`. The Social Media API does scope some patterns by `unitId`, but not all (e.g., the fallback pattern at line 141 has optional unit scoping, meaning if `unitId` is null, all alerts are searched).
- **Fix**: (1) Add a role guard requiring at least `ANALYST` or `SUPERVISOR` roles. (2) Enforce mandatory `unit_id` scoping on all query patterns (not just some). (3) Audit-log every NL query execution (already done -- good).

### [MEDIUM] CDR/Evidence/Dossier Routes Lack Role Guards
- **Location**: `apps/dopams-api/src/routes/cdr.routes.ts`, `apps/dopams-api/src/routes/evidence.routes.ts`, `apps/dopams-api/src/routes/dossier.routes.ts`, `apps/dopams-api/src/routes/interrogation.routes.ts`
- **Issue**: These routes handle highly sensitive data (CDR records with IMSI/IMEI, evidence chain-of-custody, subject dossiers, interrogation reports) but rely only on authentication (the global `onRequest` hook). Any authenticated user -- including a newly provisioned user with no specific role -- can access, create, and export all CDR data, evidence, dossiers, and interrogation reports. There are no role-based guards on individual routes.
- **Fix**: Add role guards to all sensitive routes. For example, CDR analysis should require `ANALYST` or `SUPERVISOR`; evidence and dossier creation should require `OFFICER` or higher; interrogation reports should require `INVESTIGATING_OFFICER`.

### [MEDIUM] Config Governance Submit/Read Endpoints Lack Role Guards
- **Location**: `packages/api-core/src/routes/config-governance-routes.ts:134-149`
- **Issue**: The `PATCH .../submit` endpoint (line 134) to transition a config version from DRAFT to PENDING_REVIEW has no role check. Any authenticated user can submit config changes for review. The `POST .../versions` endpoint (line 25) to create drafts also lacks a role check. While approve/publish/rollback correctly require ADMINISTRATOR, the ability for any user to create drafts and submit them for review is a privilege escalation risk.
- **Fix**: Require at least `ADMINISTRATOR` or `CONFIG_MANAGER` role to create and submit config versions.

### [LOW] Connector Management Uses PLATFORM_ADMINISTRATOR Only
- **Location**: `apps/social-media-api/src/routes/connector.routes.ts:8-10`
- **Issue**: The connector routes check for `PLATFORM_ADMINISTRATOR` only, excluding `ADMINISTRATOR`. This is inconsistent with other admin routes in `api-core` which accept both `ADMINISTRATOR` and `PLATFORM_ADMINISTRATOR`. This could lock out legitimate administrators.
- **Fix**: Include `ADMINISTRATOR` in the `requireAdmin` check, consistent with the pattern in `packages/api-core/src/routes/admin-routes.ts:20-26`.

---

## 3. Injection Prevention

### [HIGH] Dynamic Table/Column Names in SQL Queries from Controlled Input
- **Location**: `apps/dopams-api/src/services/classifier.ts:78`, `apps/dopams-api/src/routes/legal.routes.ts:77`, `apps/dopams-api/src/routes/translate.routes.ts:55`, `apps/forensic-api/src/services/classifier.ts:77`, `apps/forensic-api/src/routes/legal.routes.ts:75`, `apps/social-media-api/src/routes/legal.routes.ts:75`, `apps/social-media-api/src/routes/drug-classify.routes.ts:36`, `apps/social-media-api/src/routes/translate.routes.ts:140`
- **Issue**: Multiple routes build SQL queries using template literals with variables for table names, column names, and ID column names:
  ```typescript
  const entityResult = await query(`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`, [entityId]);
  ```
  While these variables come from a `switch` statement with a fixed set of cases (not directly from user input), the pattern is fragile. If a new `case` is added without proper sanitization, or if the switch-default falls through, it could lead to SQL injection. The values are derived from user-supplied `entityType` which is validated by the switch, but the pattern violates defense-in-depth.
- **Fix**: (1) Create a validated lookup map and assert that the resolved table/column values are from an allowlist before interpolation. (2) Consider using a helper function like `assertAllowedTable(tableName, ALLOWED_TABLES)` that throws if the value is not in a pre-defined set. The current `switch` + `default: throw/return 400` pattern is acceptable but should be documented as a security-critical code path.

### [MEDIUM] NL Query Logs Store Raw SQL in Database
- **Location**: `apps/dopams-api/src/services/nl-query.ts:172`, `apps/forensic-api/src/services/nl-query.ts:184`, `apps/social-media-api/src/services/nl-query.ts:182`
- **Issue**: The generated SQL is stored verbatim in the `nl_query_log` table. While the SQL is constructed from controlled patterns (not user text), the raw SQL in audit logs could be useful for an attacker with DB read access to understand the schema and query patterns.
- **Fix**: Redact or hash the SQL before storing, or mark the `generated_sql` column as restricted access.

### [LOW] NL Query Table Names in Template Literals Without Parameterization
- **Location**: `apps/dopams-api/src/services/nl-query.ts:44,65,117`, `apps/forensic-api/src/services/nl-query.ts:43,67,116`, `apps/social-media-api/src/services/nl-query.ts:45,71,120`
- **Issue**: Table and column names are interpolated into SQL via template literals. In the NL query services, these come from hardcoded maps (e.g., `entityMap["alert"] = "alert"`), so the user input (the NL query text) only selects which fixed SQL template to use -- the user text itself is parameterized in the fallback patterns via `$1`. This is safe given the current implementation but is a maintenance risk: any future pattern that interpolates regex-captured groups into SQL would be a SQL injection vulnerability.
- **Fix**: Add a code comment marking these as security-critical paths. Consider extracting the SQL template selection into a separate validated function with explicit tests.

---

## 4. Data Privacy

### [HIGH] PII Encryption Uses Hardcoded Salt
- **Location**: `apps/dopams-api/src/services/pii-crypto.ts:13`, `apps/forensic-api/src/services/pii-crypto.ts:13`, `apps/social-media-api/src/services/pii-crypto.ts:13`
- **Issue**: All three PII encryption modules use the same hardcoded salt `"puda-pii-salt"` for key derivation: `scryptSync(key, "puda-pii-salt", 32)`. A hardcoded salt defeats the purpose of salting -- if two systems share the same `PII_ENCRYPTION_KEY` env var, they produce identical derived keys. Additionally, the `SALT_LENGTH = 16` constant is declared but never used; the code does not generate or prepend a random salt. This means the key derivation is deterministic: same password always produces the same encryption key.
- **Fix**: (1) Generate a random salt per encryption operation and prepend it to the ciphertext. (2) On decryption, extract the salt from the ciphertext and use it for key derivation. (3) Remove the hardcoded salt string. This is a standard pattern for scrypt-based encryption.

### [MEDIUM] Dossier Assembly Exposes Full PII in Content Sections
- **Location**: `apps/dopams-api/src/services/dossier.ts:60-106`
- **Issue**: The `assembleDossier` function fetches `SELECT * FROM subject_profile` (line 62) and includes PII fields (full name, national ID, passport number, phone numbers, email addresses, date of birth, address) in plain text in the `content_sections` JSONB column. This persisted data is then available to any user who can access the dossier detail endpoint, which has no role guard (see finding #2.2). Encrypted PII fields are fetched and stored in cleartext in the dossier.
- **Fix**: (1) Add role guards on dossier endpoints. (2) Consider storing sensitive fields in the dossier as encrypted or redacted, decrypting only at export time. (3) At minimum, do not include national_id and passport_number in the assembled content unless the requesting user has a privileged role.

### [MEDIUM] CDR Upload Accepts Raw IMSI/IMEI Without Encryption
- **Location**: `apps/dopams-api/src/routes/cdr.routes.ts:164-174`
- **Issue**: The CDR upload endpoint stores IMEI and IMSI values in plaintext in the `cdr_record` table. IMSI (International Mobile Subscriber Identity) and IMEI (International Mobile Equipment Identity) are sensitive subscriber identifiers that should be encrypted at rest. The `pii-crypto` module exists but is not used for CDR records.
- **Fix**: Encrypt IMSI and IMEI using the `encryptPii` function before storing in the database. Decrypt on read only for authorized users.

### [LOW] Audit Logger Stores Request Bodies (Including Potential PII)
- **Location**: `packages/api-core/src/middleware/audit-logger.ts:95-100`
- **Issue**: The audit logger captures the full request body (up to 4000 chars) and stores it in the `payload_jsonb` column. While the `redactValue` function is applied (line 96), the redaction patterns only cover known sensitive key names and value patterns (Aadhaar, PAN, card numbers). Application-specific PII (names, addresses, phone numbers in request bodies) is not redacted and is stored in the audit log.
- **Fix**: Extend the redaction patterns to cover domain-specific PII fields (e.g., `phone_number`, `address`, `full_name`, `national_id`, `passport_number`, `imsi`, `imei`). Alternatively, store only the field names that changed rather than full values.

---

## 5. Secrets Management

### [CRITICAL] Database Credentials in .env File
- **Location**: `.env:7-8,11`
- **Issue**: The `.env` file contains plaintext database credentials including passwords:
  ```
  DATABASE_URL=postgres://puda:PudaDb2026%40@localhost:5434/puda
  SM_DATABASE_URL=postgres://puda:puda@localhost:5434/social_media
  ```
  While `.env` is in `.gitignore` (confirmed -- not tracked by git), the file exists on disk. The `.env` file is the sole location for all secrets. There is no secrets manager integration, no encrypted secrets store, and no vault.
- **Fix**: (1) For production: integrate with a secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault). (2) For development: document that `.env` must never contain production credentials. (3) Add a pre-commit hook to prevent `.env` from being accidentally committed. (4) The `.env` credentials shown are for a local Cloud SQL proxy, which is acceptable for development.

### [HIGH] JWT_SECRET in .env File
- **Location**: `.env:15`
- **Issue**: `JWT_SECRET=puda-dev-secret-change-in-production` is a weak, predictable development secret. If this value leaks or is accidentally used in a deployed environment, any attacker can forge valid JWT tokens for any user, including administrators. The `getJwtSecret` function in auth-middleware.ts correctly requires `JWT_SECRET` in production, but the dev value is still a risk for staging/QA environments.
- **Fix**: (1) Generate a cryptographically random JWT secret for every environment, including development. (2) Use `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"` to generate secrets. (3) Add a startup check that the secret is at least 32 bytes of entropy.

### [MEDIUM] PII_ENCRYPTION_KEY Not Validated for Entropy
- **Location**: `apps/dopams-api/src/services/pii-crypto.ts:9-11`
- **Issue**: The PII encryption key is read from `process.env.PII_ENCRYPTION_KEY` and used directly. There is no validation of key length, entropy, or format. A short or weak key (e.g., `"password"`) would result in weak encryption that could be brute-forced.
- **Fix**: Validate that `PII_ENCRYPTION_KEY` is at least 32 characters (or better, at least 256 bits of base64-encoded randomness). Refuse to start if the key does not meet minimum entropy requirements.

---

## 6. Audit Trails

### [MEDIUM] SIEM Forwarder Is a Stub (No Actual Forwarding)
- **Location**: `apps/social-media-api/src/services/siem-forwarder.ts:44`
- **Issue**: The SIEM forwarder is implemented as a stub. Line 44: `console.log(\`[siem-forwarder] Forwarding ${batch.length} events to ${config.endpoint}\`)`. Events are buffered and logged to console but never actually sent to a SIEM endpoint. The `fetch()` call is commented out. If SIEM forwarding is enabled via `SIEM_ENABLED=true`, the system creates a false sense of security -- audit events appear to be forwarded but are silently discarded.
- **Fix**: (1) Implement the actual `fetch()` call to POST events to the SIEM endpoint. (2) Until implemented, add a startup warning log: "SIEM forwarder is in stub mode -- events will NOT be forwarded." (3) Add a health check that verifies SIEM connectivity.

### [MEDIUM] Audit Circuit Breaker Disables Mutation Blocking in Tests
- **Location**: `packages/api-core/src/middleware/audit-logger.ts:62`
- **Issue**: The audit logger's circuit breaker (which blocks mutations when audit logging fails 5 consecutive times) is disabled in test mode (`NODE_ENV=test`). While this is necessary for test stability, it means the circuit breaker behavior is never tested in integration tests. If the circuit breaker logic has a bug, it will only manifest in production.
- **Fix**: Add dedicated test cases that simulate audit failures and verify the circuit breaker engages correctly. Use a separate test flag (e.g., `AUDIT_CIRCUIT_BREAKER_TEST=true`) rather than blanket `NODE_ENV=test` bypass.

### [LOW] Custody Events Use fire-and-forget Pattern
- **Location**: `apps/dopams-api/src/routes/evidence.routes.ts:78-81,149-151,201-205,271-275,327-330`
- **Issue**: Evidence custody events are logged with `.catch()` handlers that silently swallow errors: `await query(...).catch((err) => { app.log.warn(err, "Custody event write failed"); })`. If the custody event fails to write (e.g., table doesn't exist, DB connection issue), the main operation succeeds but the chain-of-custody record has a gap. For evidence handling in a law enforcement context, custody chain integrity is critical.
- **Fix**: Make custody event writes part of a transaction with the main operation. If the custody event fails, the main operation should also roll back. At minimum, escalate from `warn` to `error` severity on custody write failures.

---

## 7. OWASP Top 10

### [HIGH] A01:2021 -- Broken Access Control: No Unit-Level Data Isolation (DOPAMS)
- **Location**: `apps/dopams-api/src/routes/cdr.routes.ts`, `apps/dopams-api/src/routes/evidence.routes.ts`, `apps/dopams-api/src/routes/dossier.routes.ts`
- **Issue**: Unlike the Social Media API (which scopes alerts by `unit_id`), the DOPAMS API endpoints for CDR data, evidence, dossiers, and interrogation reports do not filter by the requesting user's `unit_id`. An officer in Unit A can view CDR analysis, evidence, and dossiers belonging to Unit B. This violates the principle of least privilege and multi-tenancy boundaries.
- **Fix**: Add `unit_id` scoping to all data queries, joining through the entity's owning case/unit. The `request.authUser.unitId` is available from the JWT payload.

### [MEDIUM] A04:2021 -- Insecure Design: Path Traversal Protection on Config Routes
- **Location**: `packages/api-core/src/routes/config-routes.ts:37-46`
- **Issue**: The config workflow route validates path traversal (line 43: `if (!filePath.startsWith(baseDir + path.sep))`), which is good. However, the `entityType` parameter is validated with the regex `^[a-z][a-z0-9_]*$` at the schema level, which already prevents path traversal characters. The double protection is a positive defense-in-depth measure. **No action needed** -- this is a positive finding.

### [MEDIUM] A05:2021 -- Security Misconfiguration: Swagger UI Enabled in Non-Production
- **Location**: `packages/api-core/src/app-builder.ts:106-128`
- **Issue**: Swagger UI is enabled for all non-production environments (line 106: `const docsEnabled = process.env.NODE_ENV !== "production"`). This exposes the full API schema, including all endpoints, request/response formats, and authentication mechanisms to anyone who can access the server. Staging/QA environments that are internet-accessible would leak the entire API surface.
- **Fix**: Gate Swagger UI behind an explicit `ENABLE_SWAGGER=true` env var rather than the negative check. Default to disabled.

### [MEDIUM] A07:2021 -- Identification and Authentication Failures: No Password History Check
- **Location**: `packages/api-core/src/auth/local-auth.ts:85-105`
- **Issue**: The `createUser` function (and by extension, any password reset flow) does not check against previously used passwords. Users can cycle between the same two passwords. For a law enforcement application, password reuse is a compliance concern (NIST SP 800-63B recommends checking against a breach database and prior passwords).
- **Fix**: Store hashed previous passwords (last N) and check new passwords against them. Also consider checking against common password lists.

### [MEDIUM] A08:2021 -- Software and Data Integrity: No HMAC on Audit Records
- **Location**: `packages/api-core/src/middleware/audit-logger.ts:103-108`
- **Issue**: Audit records are inserted as plain rows in the `audit_event` table. There is no HMAC, digital signature, or chaining hash to detect tampering. A database administrator (or an attacker with DB access) could modify or delete audit records without detection. For a law enforcement application, tamper-evident audit trails are a regulatory requirement.
- **Fix**: (1) Add an HMAC column computed over the audit record content (using a separate audit signing key). (2) Implement chaining: include the hash of the previous audit record in each new record. (3) Consider write-once storage or append-only tables.

### [LOW] A09:2021 -- Security Logging: Generated SQL Logged in NL Query Logs
- **Location**: `apps/dopams-api/src/services/nl-query.ts:172-175`
- **Issue**: The generated SQL query is stored in the `nl_query_log` table. While useful for debugging, this creates an information disclosure risk if the log table is compromised -- it reveals table names, column names, and query patterns.
- **Fix**: Consider hashing or omitting the SQL in production. The query pattern ID is sufficient for debugging.

### [LOW] A10:2021 -- Server-Side Request Forgery: SIEM Endpoint Not Validated
- **Location**: `apps/social-media-api/src/services/siem-forwarder.ts:37`
- **Issue**: The SIEM endpoint URL comes from `process.env.SIEM_ENDPOINT` and would be used in a `fetch()` call (currently stubbed). There is no URL validation or allowlist. If an attacker can control this env var (e.g., via a config injection), they could redirect audit events to an external server.
- **Fix**: Validate the SIEM endpoint URL against an allowlist of approved SIEM hostnames/IP ranges.

---

## 8. Additional Findings

### [MEDIUM] Rate Limiting Not Applied to LDAP Login Route Path Check
- **Location**: `packages/api-core/src/middleware/auth-middleware.ts:21,155`
- **Issue**: The `DEFAULT_PUBLIC_ROUTES` list includes `/api/v1/auth/login` and `/api/v1/auth/logout` but does NOT include `/api/v1/auth/ldap/login`. This means the LDAP login endpoint passes through the auth middleware, but because the route itself has `config: { rateLimit: { max: 10, timeWindow: "1 minute" } }`, it does have per-route rate limiting. However, the LDAP endpoint requires authentication to pass through the middleware first (since it's not in the public routes list), which would block unauthenticated LDAP login attempts.
- **Fix**: Add `/api/v1/auth/ldap/login` to the `DEFAULT_PUBLIC_ROUTES` array in auth-middleware.ts so that unauthenticated users can actually reach the LDAP login endpoint. Without this fix, the LDAP login endpoint is effectively unreachable.

### [MEDIUM] Test Helpers Use Weak Passwords
- **Location**: `apps/forensic-api/src/test-helpers.ts:16-17,27`, `apps/social-media-api/src/test-helpers.ts:16-17,27`
- **Issue**: Test helpers use `password: "password"` for test accounts. While these are test-only files, if test seed data accidentally ships to a non-test database, these accounts would be trivially compromisable. The admin routes enforce 12-character minimum complexity, but test helpers bypass this by directly inserting records.
- **Fix**: Use complex passwords in test helpers that match production complexity requirements (e.g., `"T3stP@ssw0rd!Secure"`). Alternatively, add a startup check that test seed accounts do not exist in non-test databases.

### [LOW] Database SSL Can Be Disabled in Development
- **Location**: `packages/api-core/src/db.ts:23-29`
- **Issue**: `DATABASE_SSL=false` is allowed in non-production environments. The code correctly blocks this in production (line 26-28), but staging/QA environments could run without SSL, transmitting credentials and data in cleartext.
- **Fix**: Only allow `DATABASE_SSL=false` when `NODE_ENV=test` or when connecting via Unix socket. Block it for any environment that might be network-accessible.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 5     |
| MEDIUM   | 14    |
| LOW      | 7     |
| **Total** | **28** |

### Critical Findings
1. LDAP stub accepts any password (auth bypass)
2. Database credentials in .env file (managed but not vaulted)

### High Findings
1. OIDC callback exposes JWT in response body
2. NL query endpoints lack role-based access control
3. Dynamic SQL table/column interpolation pattern
4. PII encryption uses hardcoded salt (identical across all apps)
5. JWT_SECRET in .env is weak/predictable
6. No unit-level data isolation in DOPAMS

---

## Security Verdict: **FAIL**

The codebase demonstrates strong security fundamentals in several areas:
- Argon2id password hashing with proper parameters
- JWT with HS256, httpOnly cookies, token revocation, session inactivity timeout
- Rate limiting on login and mutation endpoints
- Parameterized SQL queries (all user-supplied values use `$N` placeholders)
- Input validation via JSON Schema on routes
- Path traversal protection on file-serving routes
- Self-role-change prevention in admin routes
- Four-eyes principle in config governance (approver != creator)
- PII redaction in audit logs (key-based and value-pattern-based)
- CORS enforcement in production
- CSP headers via Helmet
- MFA challenge flow on local auth
- Idempotency middleware for mutation safety
- Account lockout after 5 failed login attempts

However, the **two CRITICAL findings** (LDAP auth bypass, unvaulted secrets) and the **five HIGH findings** (especially the lack of role guards on sensitive endpoints and PII encryption weakness) prevent a passing verdict. The LDAP stub accepting any password is a **showstopper** -- if enabled in any non-development environment, it is equivalent to having no authentication at all for LDAP-provisioned users.

### Recommended Priority Order
1. **Immediately**: Disable LDAP auth registration until real implementation exists
2. **This sprint**: Add role guards to CDR, evidence, dossier, and NL query routes
3. **This sprint**: Fix PII encryption salt to use random per-operation salts
4. **This sprint**: Remove JWT from OIDC callback response body
5. **Next sprint**: Add unit-level data isolation to DOPAMS endpoints
6. **Next sprint**: Implement tamper-evident audit records (HMAC chaining)
7. **Backlog**: Integrate secrets manager for production deployments
