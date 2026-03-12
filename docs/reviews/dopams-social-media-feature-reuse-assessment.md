# DOPAMS ← Social Media App: Feature Reuse Assessment

**Date**: 2026-03-11
**Purpose**: Identify features built in `apps/social-media-*` that can be ported to `apps/dopams-*` to close BRD gaps and reduce coding effort.

---

## Executive Summary

The Social Media Intelligence app is significantly more mature than DOPAMS in several feature areas that DOPAMS also needs per its BRD. **14 features** in the Social Media app can be directly reused or adapted for DOPAMS, potentially saving **60-70% coding effort** on the 9 PARTIAL FRs and closing both P0 gaps.

### Effort Savings Estimate

| Reuse Category | Features | Estimated Savings |
|----------------|----------|-------------------|
| **Direct port** (copy + adapt entity names) | 6 | ~80% effort saved |
| **Adapt + extend** (port core, add DOPAMS-specific logic) | 5 | ~50-60% effort saved |
| **Pattern reuse** (use as reference architecture) | 3 | ~30% effort saved |
| **Total** | **14** | **~55-65% aggregate** |

---

## Feature-by-Feature Comparison

### 1. Evidence Preservation & Chain-of-Custody (DOPAMS FR-22 — PARTIAL)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| SHA-256 hashing on ingest | Yes | Yes | — |
| Custody chain events | VIEWED, HASH_VERIFIED, PACKAGED | VIEWED, FILE_ACCESSED, PACKAGED, COURT_EXPORTED, LEGAL_HOLD_APPLIED/RELEASED | Missing custody events |
| Legal hold API | Missing | **Full implementation**: create hold, release hold, list holds, purge prevention | **Direct port** |
| On-demand integrity verification | Basic (verify endpoint exists) | **Full**: recompute SHA-256, compare, persist MATCH/MISMATCH/NO_HASH/NO_FILE, ISO 27037 compliant | **Enhance from SM** |
| Evidence file serving with MIME | Missing | **Full**: serves actual file from disk with auto MIME detection | **Direct port** |
| Derivative evidence (copies) | Missing | **Full**: `POST /evidence/:id/copy` with `parent_evidence_id`, `is_original=FALSE` | **Direct port** |
| OSINT metadata | Missing | **Full**: capture_method, capture_tool_version, source_platform, hash_algorithm, etc. | **Direct port** |
| Court export package | Missing | **Full**: `CourtExportWizard` → ZIP with OSINT PDF + evidence + custody CSV + SHA-256 manifest + watermark | **Direct port** |
| Watermarking | Basic PDF watermark | **Full**: `watermark.ts` service with export logging and X-Watermark header | **Enhance from SM** |

**Reuse recommendation**: **DIRECT PORT** — Copy `evidence.routes.ts` legal-hold/verify/file-serve/copy/court-export endpoints + `CourtExportWizard.tsx` + `osint-report-generator.ts` + `watermark.ts` service.
**Effort saved**: ~80% (adapt entity table names, reuse logic wholesale)
**DOPAMS gaps closed**: P2-06 (legal hold, integrity verify, watermarking)

---

### 2. AI Content Classification & Risk Scoring (DOPAMS FR-20 — PARTIAL)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Keyword classification | Basic (9 categories) | **6-stage pipeline**: normalize → keywords → slang → emoji → transaction signals → narcotics score | SM far richer |
| LLM-enhanced classification | Missing | **Full**: `classifyContentWithLlm()` with rich output schema (sub_reason_scores, matched_entities, confidence_band, review_recommended) | **Direct port** |
| Factor contribution breakdown | Missing | **Full**: pipeline_metadata stores every stage output, factor weights, sub-scores | **Key P1 gap closed** |
| Queue routing by threshold | Missing | **Full**: auto-creates alert when riskScore >= threshold, priority queue routing | **Direct port** |
| Slang/emoji dictionary | Missing | **Full**: CRUD + bulk import + PENDING→APPROVED workflow + in-memory cache | **Direct port** |
| Review workflow for classifications | Basic override | **Full**: review_status, review_recommended flag, analyst override with reason | **Enhance from SM** |
| Pipeline visualization UI | Missing | **Full**: `ContentDetail.tsx` 6-stage pipeline progress with step-by-step detail | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port the classification pipeline architecture (narcotics-scorer, slang-normalizer, emoji-drug-decoder), LLM provider integration, and pipeline visualization. Adapt categories to DOPAMS taxonomy.
**Effort saved**: ~60%
**DOPAMS gaps closed**: P1-06 (factor breakdown, queue routing)

---

### 3. Legal Section Mapping with Rule Governance (DOPAMS FR-21 — PARTIAL)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Statute library + keyword suggest | Yes | Yes | — |
| Auto-mapping (rule engine) | Basic | **Full**: `legal-rule-evaluator.ts` with AND/OR conditions on category/threat_score/platform/language/keywords/sentiment | SM far richer |
| Per-suggestion rationale/evidence | Missing | **Full**: each suggestion has rule_code, confidence, matched conditions | **Direct port** |
| Rule governance lifecycle | Missing | **Full**: DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED with supersession, rollback, four-eyes, test harness | **Direct port** |
| Rule admin UI | Missing | **Full**: `LegalRuleAdmin.tsx` with expression builder, test harness | **Direct port** |
| Mapping review workflow | Basic confirm | **Full**: APPROVE/REJECT decision with reason, pending queue | **Enhance from SM** |

**Reuse recommendation**: **DIRECT PORT** — Copy `legal-rule-evaluator.ts`, the rule lifecycle routes from `legal.routes.ts`, and `LegalRuleAdmin.tsx`.
**Effort saved**: ~80%
**DOPAMS gaps closed**: P2-05 (rationale, rule versioning)

---

### 4. Dashboard & Analytics (DOPAMS FR-17 — PARTIAL)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Basic stats dashboard | Yes (1 view) | **7 dashboard views** in DashboardHub | SM far richer |
| Control room / priority queue | Missing | **Full**: `ControlRoomDashboard.tsx` with SLA countdown, priority sort | **Direct port** |
| Leadership dashboard | Missing | **Full**: `LeadershipDashboard.tsx` with district comparison, top actors, conversion rates | **Direct port** |
| Supervisor dashboard | Missing | **Full**: `SupervisorDashboard.tsx` with stage distributions, pendency | **Direct port** |
| Geographic dashboard | Missing | **Full**: `GeoDashboard.tsx` with district-level maps, heatmap grid | **Direct port** |
| Pendency aging analysis | Missing | **Full**: `PendencyDashboard.tsx` with time bucket breakdown (0-4h, 4-12h, etc.) | **Direct port** |
| Trend time-series | Missing | **Full**: hourly/daily/weekly/monthly granularity | **Direct port** |
| Analytics endpoint | Basic | **Full**: 10 parallel queries — trends, distributions, SLA compliance, conversion rates, avg resolution | **Enhance from SM** |
| Heatmap (entity × district) | Missing | **Full**: `dashboard/heatmap` with pivoted matrix | **Direct port** |
| Data freshness timestamps | Missing | Partial | Still a gap |
| Admin-configurable layouts | Missing | Missing | Both lack this |
| Chart components | Missing | **Full**: TrendLineChart, DonutChart, StackedBarChart, MiniBarChart, Sparkline, GaugeChart, FunnelChart, HeatMapGrid | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port the `DashboardHub` pattern, all 7 dashboard views, and the analytics endpoint. Adapt SQL queries to DOPAMS entity tables (alert→alert, lead→lead, case→dopams_case, subject→subject_profile).
**Effort saved**: ~60%
**DOPAMS gaps closed**: FR-17 partial gaps (configurability, freshness indicators still need work)

---

### 5. Early Warning System (DOPAMS FR-13/FR-20 — related)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Trend recording during ingestion | Missing | **Full**: `trend-analyzer.ts` records detections with time-series | **Direct port** |
| Spike detection | Missing | **Full**: baseline vs current comparison with alert creation | **Direct port** |
| NPS (New Substance) candidate queue | Missing | **Full**: PENDING→CONFIRMED_NPS→auto-create slang entry | **Direct port** |
| Cross-jurisdiction trend sharing | Missing | **Full**: `trend-sharing.ts` service | **Direct port** |
| Early warning dashboard | Missing | **Full**: `EarlyWarningDashboard.tsx` | **Direct port** |

**Reuse recommendation**: **DIRECT PORT** — This entire subsystem is directly relevant to DOPAMS's drug monitoring mission (FR-13, FR-20). Copy `trend-analyzer.ts`, `trend-sharing.ts`, early-warning routes, and `EarlyWarningDashboard.tsx`.
**Effort saved**: ~80%

---

### 6. Platform Connector Framework (DOPAMS FR-18 — IMPLEMENTED but basic)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Connector CRUD | Basic (5 types) | **Full**: CRUD + health monitoring + health reset + retention management | SM richer |
| Health monitoring | Missing | **Full**: health_status, error_count, last_error, backoff_until | **Direct port** |
| Dead letter queue | Yes (basic) | **Full**: DLQ with retry, connector-scheduler with advisory lock | SM richer |
| Retention management | Missing | **Full**: flag expired, bulk flag, retention dashboard | **Direct port** |
| Connector admin UI | Missing | **Full**: `PlatformConnectors.tsx` with health display, DLQ tab | **Direct port** |
| Scheduler with advisory lock | Missing | **Full**: `connector-scheduler.ts` with distributed lock | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port health monitoring, retention management, and `PlatformConnectors.tsx`. Adapt connector types from social media platforms to DOPAMS sources (CCTNS, eCourts, NDPS).
**Effort saved**: ~50%

---

### 7. Report Generation with Four-Eyes Governance (DOPAMS FR-08 — IMPLEMENTED, FR-17)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Report workflow | Interrogation reports with states | **Full**: DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED with four-eyes enforcement | SM more governed |
| Auto-populate from case data | Missing | **Full**: `POST /reports/:id/populate` — assembles evidence, alerts, legal provisions, timeline | **Direct port** |
| Template interpolation | Basic | **Full**: `template-interpolator.ts` with {{placeholder}} system | **Enhance from SM** |
| PDF + DOCX export | Yes (basic) | **Full**: approval gate, watermark, four-eyes check (creator ≠ approver) | **Enhance from SM** |
| Report editor UI | Missing | **Full**: `ReportEditor.tsx` with inline editing + auto-populate button | **Direct port** |
| Template admin UI | Missing | **Full**: `TemplateAdmin.tsx` with section builder | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port `ReportEditor.tsx`, `TemplateAdmin.tsx`, auto-populate logic, four-eyes enforcement, and template interpolation.
**Effort saved**: ~50%

---

### 8. Privacy & Access Justification (DOPAMS FR-01 — IMPLEMENTED but missing BR-03)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| PII masking | Yes (Aadhaar/PAN redaction) | Yes | — |
| Export justification code | Missing (P1-02 gap) | **Full**: `access-justification.ts` — justification_type + reason_text, supervisor audit stats, access log | **Direct port** |
| Access justification modal | Missing | **Full**: `AccessJustificationModal.tsx` — lazy-loaded gate before sensitive data access | **Direct port** |
| PII auto-redaction on ingest | Missing | **Full**: `pii-minimizer.ts` — redacts non-target PII (phone, email, ID) during ingestion | **Direct port** |
| Supervisor audit view | Missing | **Full**: `SupervisorAudit.tsx` — access logs, justification audit, unusual access | **Direct port** |

**Reuse recommendation**: **DIRECT PORT** — Copy `access-justification.ts`, `AccessJustificationModal.tsx`, `pii-minimizer.ts`, `SupervisorAudit.tsx`, and privacy routes.
**Effort saved**: ~80%
**DOPAMS gaps closed**: P1-02 (export justification code)

---

### 9. NL Query with LLM (DOPAMS FR-10 — PARTIAL)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| NL query engine | Pattern-based regex (5 patterns) | **Full**: LLM-powered NL-to-SQL with safety guards | SM far more capable |
| Citations in answers | Basic citation objects | LLM output with SQL result grounding | SM better |
| Query history | Yes | Yes | — |
| Convert to saved search | Missing | **Full**: `saved-search.routes.ts` — save/load named queries | **Direct port** |
| Permission-aware refusal | Missing | Partial (uses role-based data access) | Needs extension |

**Reuse recommendation**: **ADAPT + EXTEND** — Port the LLM-powered NL-to-SQL service from SM (it uses the shared `@puda/api-core` LLM provider). Add DOPAMS-specific schema context. Port saved-search routes.
**Effort saved**: ~50%
**DOPAMS gaps closed**: P1-04 (citations, convert-to-search)

---

### 10. Actor Intelligence / Subject Profile Enhancement (DOPAMS FR-04 — P0 gaps)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Subject profiles | 29 fields (missing ~20 from BRD 54-column spec) | **Full**: actor profiles with cross-platform handles, metadata_jsonb, risk history | SM has pattern |
| Cross-platform merge | Yes (dedup service) | **Full**: `actor-aggregator.ts` — survivor by earliest first_seen_at, JSONB array merge | SM has cleaner pattern |
| Risk score with history | Basic risk_score field | **Full**: recalculation in batches, history bonus (+30 for repeat offenders), cap at 100 | **Port risk model** |
| Per-field provenance | Partial (assertion_conflict exists) | N/A (actors don't have provenance) | Different domain |

**Reuse recommendation**: **PATTERN REUSE** — The risk score recalculation model (batch processing, history bonus, capping) can be adapted for DOPAMS subject risk scoring. The cross-platform merge pattern informs the subject deduplication merge. However, the 54-column schema gap (P0-01) and per-field provenance (P0-02) are DOPAMS-specific — no SM equivalent exists.
**Effort saved**: ~30%
**Note**: P0 gaps require DOPAMS-specific work (migration + provenance system)

---

### 11. Escalation & SLA Management (DOPAMS FR-24 — IMPLEMENTED, can be enhanced)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| SLA timers | Yes (workflow-based) | **Full**: SLA countdown with AT_RISK/BREACHED/ON_TRACK badges, control room view | SM has richer UI |
| Escalation workflow | Basic | **Full**: `auto-escalation.ts` — escalation request/approve/reject with named approver | **Direct port** |
| Escalation queue UI | Missing | **Full**: `EscalationQueue.tsx` — supervisor view with approve/reject | **Direct port** |
| SLA dashboard | Missing | **Full**: `SlaDashboard.tsx` — rules management, compliance counts | **Direct port** |

**Reuse recommendation**: **DIRECT PORT** — Copy `auto-escalation.ts`, `EscalationQueue.tsx`, `SlaDashboard.tsx`.
**Effort saved**: ~80%

---

### 12. Translation & Glossary (DOPAMS FR-03 — related to bilingual)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Translation API | Basic (`translate.routes.ts`) | **Full**: glossary-aware translation, language detection with confidence, auto-translate on ingest | SM richer |
| Glossary management | Missing | **Full**: domain-specific glossary CRUD with upsert | **Direct port** |
| Language detection | Missing | **Full**: `language-detector.ts` with confidence score | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port glossary management, language detection, and auto-translate-on-ingest pattern.
**Effort saved**: ~60%

---

### 13. Monitoring Configuration (DOPAMS FR-19 — IMPLEMENTED, can be enhanced)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Source monitoring config | Connector config only | **Full**: profile/group/page monitoring + CSV bulk import + priority tiers + jurisdiction locations | SM far richer |
| Monitoring admin UI | Missing | **Full**: `MonitoringConfig.tsx` with filters, CSV import | **Direct port** |
| Jurisdiction locations | Units with hierarchy | **Full**: jurisdiction locations with city/area/alt-spellings for content filtering | **Enhance from SM** |

**Reuse recommendation**: **PATTERN REUSE** — Port `MonitoringConfig.tsx` as a template for DOPAMS source monitoring configuration.
**Effort saved**: ~30%

---

### 14. Alert Actions & Lifecycle (DOPAMS alert routes — can be enhanced)

| Capability | DOPAMS | Social Media | Gap |
|------------|--------|-------------|-----|
| Alert actions | Basic transitions | **Full**: ACKNOWLEDGE, ESCALATE, SHARE, DISMISS, CONVERT_TO_CASE, SCREENSHOT, EXPORT, FALSE_POSITIVE | SM far richer |
| Alert sharing | Missing | **Full**: INTERNAL/EXTERNAL_AGENCY/PLATFORM_REPORT with alert_share records | **Direct port** |
| Convert alert to case | Missing | **Full**: creates case, transitions alert, links evidence/content, audit log | **Direct port** |
| Priority queue view | Missing | **Full**: queue-based view sorted by risk score, excludes terminal states | **Direct port** |
| Risk recalculation | Missing | **Full**: re-score using category weight, virality metrics, alert_type weights | **Direct port** |
| False positive tracking | Missing | **Full**: mandatory reason, audit log | **Direct port** |

**Reuse recommendation**: **ADAPT + EXTEND** — Port alert action endpoints, sharing, convert-to-case logic.
**Effort saved**: ~50%

---

## Priority Implementation Order

Based on BRD gap severity and reuse effort savings:

### Tier 1 — P0/P1 Gap Closures (Week 1-2)

| # | Port From SM | DOPAMS Gap Closed | Effort |
|---|-------------|-------------------|--------|
| 1 | Evidence legal-hold + integrity verify + court export | P2-06 → closes fully | 2-3 days |
| 2 | Classification pipeline + factor breakdown + queue routing | P1-06 → closes fully | 3-4 days |
| 3 | Legal rule governance lifecycle + admin UI | P2-05 → closes fully | 2-3 days |
| 4 | Access justification + export justification | P1-02 → closes fully | 1-2 days |
| 5 | NL query LLM upgrade + saved searches | P1-04 → closes partially | 2-3 days |

### Tier 2 — Feature Enhancement (Week 3-4)

| # | Port From SM | DOPAMS Benefit | Effort |
|---|-------------|----------------|--------|
| 6 | Dashboard hub (7 views + chart components) | FR-17 major enhancement | 3-4 days |
| 7 | Early warning system (trends, spikes, NPS) | New capability for drug monitoring | 2-3 days |
| 8 | Report editor + template admin + four-eyes | FR-08 enhancement | 2-3 days |
| 9 | Escalation queue + SLA dashboard | FR-24 enhancement | 1-2 days |

### Tier 3 — Operational Polish (Week 5)

| # | Port From SM | DOPAMS Benefit | Effort |
|---|-------------|----------------|--------|
| 10 | Connector health monitoring + admin UI | FR-18 enhancement | 1-2 days |
| 11 | Translation glossary + language detection | FR-03 enhancement | 1 day |
| 12 | Alert actions (share, convert, false-positive) | Alert workflow enrichment | 2 days |
| 13 | Privacy/supervisor audit views | Compliance enhancement | 1 day |
| 14 | Monitoring config UI | Source management improvement | 1 day |

---

## What Cannot Be Reused (DOPAMS-Specific Work Required)

| DOPAMS Requirement | Why SM Can't Help |
|-------------------|-------------------|
| **P0-01**: 54-column subject schema | DOPAMS-specific data model — SM has actors, not the 54-column policing schema |
| **P0-02**: Per-field provenance system | DOPAMS-specific (source trust ranking, assertion conflicts) — SM doesn't track field-level provenance |
| **P1-01**: LDAP/AD authentication | Both apps lack this — needs fresh implementation |
| **P1-03**: Monthly Report KPI pipeline | DOPAMS-specific (20 KPI parameters, district+month constraints) |
| **P1-05**: Technical analysis report ("Data unavailable" handling, versioning) | CDR/route map analysis is DOPAMS-specific |
| **FR-07**: Unocross financial intelligence | DOPAMS-specific (financial rule engine already exists, just needs real API) |
| **FR-14**: Tower dump matching against subject/case stores | DOPAMS-specific correlation logic |

---

## Shared Package Reuse (Already Done)

Both apps already share these via `packages/`:

| Package | Usage |
|---------|-------|
| `@puda/api-core` | Auth, audit, errors, admin routes, notification routes, config routes, SLA scheduler |
| `@puda/api-integrations` | PDF/DOCX generators, evidence packager, connector framework, dashboard filters |
| `@puda/workflow-engine` | State machine, guards, actions, audit |
| `@puda/shared` | Zod schemas, UI components |

This shared infrastructure is why porting features between the two apps is efficient — they already use the same auth, audit, and workflow foundations.

---

## Summary

| Metric | Value |
|--------|-------|
| Total reusable features identified | 14 |
| DOPAMS P-gaps closeable via SM port | 5 of 15 (P1-02, P1-04, P1-06, P2-05, P2-06) |
| Estimated total porting effort | 20-28 days |
| Estimated effort vs building from scratch | **55-65% savings** |
| DOPAMS FRs that benefit | FR-01, FR-03, FR-08, FR-10, FR-13, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-24 (12 of 26) |
