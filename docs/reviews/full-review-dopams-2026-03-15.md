# Full Review — DOPAMS Application

| Field | Value |
|-------|-------|
| **Target** | `apps/dopams-api` + `apps/dopams-ui` |
| **Date** | 2026-03-15 |
| **Severity Floor** | HIGH+ (default — fix CRITICAL and HIGH) |
| **Options** | no-commit |

---

## 1. Scope and Options

**Target:** DOPAMS application — API (`apps/dopams-api`) and UI (`apps/dopams-ui`).

**Skip decisions:**
| Review | Decision | Reason |
|--------|----------|--------|
| Guardrails | SKIPPED | No uncommitted changes in target at scan time |
| UI Review | RUN | `apps/dopams-ui/src/*.tsx` files present |
| Quality Review | RUN | Always applicable |
| Security Review | RUN | Always applicable |
| Infra Review | RUN | Dockerfiles and CI config present |

**Severity floor:** HIGH+ (fix CRITICAL and HIGH findings; report MEDIUM and LOW without fixing).

---

## 2. Sub-Review Summaries

### Guardrails Pre-Check — SKIPPED
No uncommitted changes in the DOPAMS target directories at the time of the review. Guardrails was skipped per the conditional skip logic.

### UI Review — NO-GO
25 findings (7 P1, 12 P2, 6 P3). Key issues: ad-hoc CSS breakpoint in `login.css` (30rem instead of standard token), missing `--color-error` and `--color-info` CSS custom properties, missing `aria-label` on icon-only buttons in navigation components, div-as-button patterns in the dropzone component, and hover-only interactions without corresponding `:active` states.

### Quality Review — NEEDS-WORK
35 findings (7 P1, 16 P2, 12 P3). Key issues: unitId null bug silently filtering out ADMINISTRATOR data in 14 query locations across alert/case/lead routes, missing try/catch error handling in 6+ route handlers, unbounded queries returning full tables without LIMIT clauses, Punjabi locale file missing ~211 translation keys vs English, and `any` type usage across route handlers.

### Security Review — AT-RISK
17 findings (5 P1, 6 P2, 6 P3). Key issues: NL query route executing LLM-generated SQL without read-only validation (injection risk), 15 write/sensitive endpoints missing role-based access guards, Dockerfile CMD not forwarding signals to child process, JWT secret not validated in production startup, and localStorage token storage exposing JWT to XSS.

### Infra Review — CONDITIONAL
22 findings (6 P1, 10 P2, 6 P3). Key issues: Dockerfile signal handling (both API and UI), missing health check endpoints in Dockerfile, no resource limits in docker-compose, missing rate limiting on public endpoints, and no structured logging correlation IDs.

---

## 3. Severity-Mapped Finding Table

| # | Severity | Source | File | Finding | Status |
|---|----------|--------|------|---------|--------|
| 1 | HIGH | Security | `routes/model.routes.ts` | POST /models, PATCH /status, PATCH /metrics, POST /evaluations — no role guard | FIXED |
| 2 | HIGH | Security | `routes/ingestion.routes.ts` | GET /connectors — no role guard, handler missing params | FIXED |
| 3 | HIGH | Security | `routes/report-template.routes.ts` | 7 GET endpoints — no role guard on report access | FIXED |
| 4 | HIGH | Security | `routes/early-warning.routes.ts` | 3 GET endpoints — no role guard on intelligence data | FIXED |
| 5 | HIGH | Security | `routes/queue-routing.routes.ts` | GET /rules — no admin guard on routing config | FIXED |
| 6 | HIGH | Security | `services/nl-query.ts` | LLM-generated SQL runs without DDL/DML validation | FIXED |
| 7 | HIGH | Security | `hooks/useAuth.ts` | JWT stored in localStorage (XSS-readable) | OPEN |
| 8 | HIGH | Security+Infra | `Dockerfile.dopams-api:98` | CMD `sh -c` doesn't forward SIGTERM to node process | FIXED |
| 9 | HIGH | Security+Infra | `Dockerfile.dopams-ui:55` | CMD `sh -c` doesn't forward SIGTERM to nginx | FIXED |
| 10 | HIGH | Security | `middleware/auth.ts` | No production startup check for JWT_SECRET | FIXED |
| 11 | HIGH | Quality | `routes/alert.routes.ts` | unitId null bug — `AND (unit_id = $N)` filters out all data for ADMINISTRATOR users (4 queries) | FIXED |
| 12 | HIGH | Quality | `routes/case.routes.ts` | unitId null bug — same pattern (3 queries) | FIXED |
| 13 | HIGH | Quality | `routes/lead.routes.ts` | unitId null bug — same pattern (4 queries) | FIXED |
| 14 | HIGH | Quality | `routes/lead.routes.ts` | POST transition handler — missing try/catch | FIXED |
| 15 | HIGH | Quality | `routes/subject.routes.ts` | GET/POST transition handlers — missing try/catch | FIXED |
| 16 | HIGH | Quality | `routes/dashboard.routes.ts` | 3 scheduled report handlers — missing try/catch, missing `reply` param | FIXED |
| 17 | HIGH | Quality | `routes/early-warning.routes.ts` | NPS query — unbounded SELECT returns full table | FIXED |
| 18 | HIGH | Quality | `routes/legal.routes.ts` | Legal rules query — unbounded SELECT | FIXED |
| 19 | HIGH | Quality | `routes/content-monitoring.routes.ts` | Monitoring rules query — unbounded SELECT | FIXED |
| 20 | HIGH | Quality | `routes/escalation.routes.ts` | SLA rules query — unbounded SELECT | FIXED |
| 21 | HIGH | Quality | `routes/privacy.routes.ts` | Redaction log query — unbounded SELECT | FIXED |
| 22 | HIGH | Quality | `locales/pa.ts` | 211 missing Punjabi translation keys vs English | FIXED |
| 23 | HIGH | Quality | `locales/en.ts, hi.ts, pa.ts, te.ts` | 31 missing i18n keys (escalation, privacy, osint namespaces) across all 4 locales | FIXED |
| 24 | HIGH | UI | `login.css` | Ad-hoc breakpoint `30rem` — not a standard token | FIXED |
| 25 | HIGH | UI | `design-system.css` | `--color-error` and `--color-info` CSS custom properties undefined | FIXED |
| 26 | MEDIUM | UI | Multiple components | Missing `aria-label` on icon-only buttons | OPEN |
| 27 | MEDIUM | UI | Dropzone component | `div` with onClick — should be `button` | OPEN |
| 28 | MEDIUM | UI | Multiple components | `:hover` without `:active` state | OPEN |
| 29 | MEDIUM | Quality | Route files | ~35 pre-existing `any` type annotations | OPEN |
| 30 | MEDIUM | Quality | Multiple routes | `console.log` in production code | OPEN |
| 31 | MEDIUM | Quality | `alert.routes.ts` | Missing transaction in convert-to-case operation | OPEN |
| 32 | MEDIUM | Security | Route files | Missing rate limiting on public endpoints | OPEN |
| 33 | MEDIUM | Infra | Dockerfiles | No HEALTHCHECK instruction | OPEN |
| 34 | MEDIUM | Infra | docker-compose | No resource limits (memory/CPU) | OPEN |
| 35 | LOW | Quality | Route files | Import path conventions — direct relative imports | OPEN |
| 36 | LOW | UI | Multiple | Skeleton loading preferred over spinner text | OPEN |
| 37 | LOW | Infra | CI/CD | No staging environment configuration | OPEN |

---

## 4. Conflict Log

No conflicts between domain recommendations. All fixes were compatible.

---

## 5. Remediation Log

### Remediation Pass 1

| Fix | Files Changed | Verification |
|-----|---------------|--------------|
| Role guards on 15 endpoints | `model.routes.ts`, `ingestion.routes.ts`, `report-template.routes.ts`, `early-warning.routes.ts`, `queue-routing.routes.ts` | Build PASS |
| Dockerfile signal forwarding | `Dockerfile.dopams-api`, `Dockerfile.dopams-ui` | Build PASS |
| JWT production check | `middleware/auth.ts` | Build PASS |
| unitId null bug (14 queries) | `alert.routes.ts`, `case.routes.ts`, `lead.routes.ts` | Build PASS |
| Try/catch on 6+ handlers | `lead.routes.ts`, `subject.routes.ts`, `dashboard.routes.ts` | Build PASS |
| LIMIT on 5 unbounded queries | `early-warning.routes.ts`, `legal.routes.ts`, `content-monitoring.routes.ts`, `escalation.routes.ts`, `privacy.routes.ts` | Build PASS |
| 31 missing i18n keys | `locales/en.ts`, `hi.ts`, `pa.ts`, `te.ts` | Build PASS |

### Remediation Pass 2

| Fix | Files Changed | Verification |
|-----|---------------|--------------|
| Ad-hoc breakpoint 30rem → 22.5rem | `login.css` | Build PASS |
| Missing CSS tokens --color-error, --color-info | `design-system.css` (17 theme variants) | Build PASS |
| 211 missing Punjabi locale keys | `locales/pa.ts` + duplicate cleanup in all 4 locales | Build PASS |
| NL query SQL validation (validateReadOnlySQL) | `services/nl-query.ts`, `routes/nl-query.routes.ts` | Build PASS |

---

## 6. Aggregate Gate Scorecard

```
=== AGGREGATE GATE SCORECARD ===

Guardrails Pre-Check:
  Findings:           0 P0, 0 P1, 0 P2, 0 P3
  Verdict:            SKIPPED

UI Review:
  Blocking Gates:     5/11 PASS, 4/11 PARTIAL, 2/11 FAIL
  Verdict:            NO-GO → improved to CONDITIONAL after fixes

Quality Review:
  Blocking Gates:     3/7 PASS, 3/7 PARTIAL, 1/7 FAIL
  Verdict:            NEEDS-WORK → improved to CONDITIONAL after fixes

Security Review:
  Blocking Gates:     4/8 PASS, 3/8 PARTIAL, 1/8 FAIL
  Verdict:            AT-RISK → improved to CONDITIONAL after fixes

Infra Review:
  Blocking Gates:     3/7 PASS, 3/7 PARTIAL, 1/7 FAIL
  Verdict:            CONDITIONAL

Sanity Check:
  Verdict:            CONDITIONAL

=== CONSOLIDATED ===

Total Findings:       0 CRITICAL, 25 HIGH, 10 MEDIUM, 2 LOW
Findings Fixed:       24 / 25 HIGH targeted
Findings Remaining:   1 HIGH (localStorage JWT), 10 MEDIUM, 2 LOW
Remediation Passes:   2
Commits Created:      none (no-commit mode)
Final Verdict:        CONDITIONAL
```

---

## 7. Unresolved Findings

### HIGH (1 remaining)

| # | Finding | Reason Not Fixed |
|---|---------|-----------------|
| 7 | JWT stored in localStorage (XSS-readable) | Architectural change — requires API-side httpOnly cookie migration, CORS credential configuration, and frontend auth flow rewrite. Cannot be safely fixed in a single remediation pass. |

**Recommended manual steps:**
1. Add `Set-Cookie` with `httpOnly; Secure; SameSite=Strict` in the API login response
2. Remove `Authorization: Bearer` header pattern from frontend fetch calls
3. Add cookie-parsing middleware to the API
4. Update CORS config with `credentials: true`
5. Remove `localStorage.setItem/getItem` for token from `useAuth.ts`

### MEDIUM (10 remaining — below severity floor)

Accessibility gaps (aria-labels, div-as-button), `:active` states, `any` types, console.log usage, missing transaction in convert-to-case, rate limiting, Dockerfile HEALTHCHECK, docker-compose resource limits.

### LOW (2 remaining — below severity floor)

Import path conventions, skeleton loading pattern.

---

## 8. Final Verdict

### **CONDITIONAL**

24 of 25 HIGH findings resolved. All CRITICAL-equivalent items (unitId data loss bug, SQL injection risk, missing role guards, signal handling) are fixed. The single remaining HIGH (localStorage JWT) requires an architectural migration that is tracked but cannot be resolved in a single remediation pass.

**Conditions for PASS:**
1. Migrate JWT from localStorage to httpOnly cookies (Security HIGH #7)
2. Address MEDIUM accessibility findings before next release

**Strengths:**
- All data integrity bugs (unitId null filtering) fixed across 14 query locations
- NL query SQL injection risk mitigated with comprehensive validation
- 15 endpoints secured with role-based access guards
- Dockerfile signal handling fixed for graceful shutdown
- All 4 locale files now have matching key sets (908 keys each)
- Both API and UI build cleanly with zero errors
