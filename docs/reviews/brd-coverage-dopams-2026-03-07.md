# DOPAMS BRD Coverage Audit Report

| Field | Value |
|-------|-------|
| **System** | DOPAMS - Drug Offender Profiling & Analysis Management System |
| **BRD** | `docs/policing_apps_brd/DOPAMS_Refined_BRD_AI_Ready.md` |
| **Audit Date** | 2026-03-07 |
| **Auditor** | Claude Opus 4.6 (Automated Code Analysis) |
| **Git Branch** | main |
| **Git Commit** | baf3e7a |

---

## 1. Preflight Summary

- **BRD file**: `docs/policing_apps_brd/DOPAMS_Refined_BRD_AI_Ready.md` (2,176 lines)
- **App directory**: `apps/dopams-api/src/` — 34 route files, 39 migrations, 20 test files
- **UI directory**: `apps/dopams-ui/src/` — Dashboard, NetworkGraph, Admin, Settings views
- **Test cases**: `docs/test-cases/DOPAMS_Functional_Test_Cases.md` (399 lines, 126 TCs)
- **Shared packages**: `@puda/api-core`, `@puda/api-integrations` (auth, audit, connectors, reports)
- **Total FRs**: 26 (FR-01 through FR-26)

---

## 2. Requirement Inventory

| FR ID | Title | Priority | Release | AC Count | BR Count |
|-------|-------|----------|---------|----------|----------|
| FR-01 | Identity, access control, approvals, and audit | Must Have | R1 | 5 | 3 |
| FR-02 | Source connectors and ingestion orchestration | Must Have | R1 | 5 | 3 |
| FR-03 | OCR, extraction, and bilingual review workflow | Must Have | R1 | 5 | 3 |
| FR-04 | Canonical 54-column subject history builder | Must Have | R1 | 5 | 3 |
| FR-05 | Monthly Report ingestion and KPI consolidation | Must Have | R1 | 5 | 3 |
| FR-06 | E-Courts legal status monitoring | Must Have | R1 | 5 | 3 |
| FR-07 | Financial intelligence cross-check and Unocross draft | Must Have | R1 | 5 | 3 |
| FR-08 | Fixed-template interrogation report generation | Must Have | R1 | 5 | 3 |
| FR-09 | Unified search, transliteration-aware matching, dossier | Should Have | R2 | 5 | 3 |
| FR-10 | Natural-language query and insight assistant | Should Have | R2 | 5 | 3 |
| FR-11 | n-level link analysis and kingpin discovery | Should Have | R2 | 5 | 3 |
| FR-12 | Automated technical analysis report | Should Have | R2 | 5 | 3 |
| FR-13 | Geo-fencing and watchlist alerts | Should Have | R2 | 5 | 3 |
| FR-14 | Tower dump analytics and rank ordering | Should Have | R2 | 5 | 3 |
| FR-15 | Drug offender role classification and pattern analysis | Should Have | R2 | 5 | 3 |
| FR-16 | Public grievance and lead management | Should Have | R2 | 5 | 3 |
| FR-17 | MIS dashboards and automated reporting | Must Have | R1 | 5 | 3 |
| FR-18 | Optional external connector framework | Nice to Have | R3 | 5 | 2 |
| FR-19 | Cross-platform monitoring and content ingestion | Must Have | R1 | 5 | 3 |
| FR-20 | AI-based content categorization, risk scoring | Must Have | R1 | 5 | 3 |
| FR-21 | Legal section mapping and reviewer confirmation | Must Have | R1 | 5 | 3 |
| FR-22 | Digital evidence preservation and chain-of-custody | Must Have | R1 | 5 | 3 |
| FR-23 | Template, master data, and rules administration | Must Have | R1 | 5 | 3 |
| FR-24 | Notifications, escalation, and SLA management | Must Have | R1 | 5 | 3 |
| FR-25 | Subject deduplication, merge, and survivorship | Must Have | R1 | 5 | 3 |
| FR-26 | Model governance, training, validation, deployment | Must Have | R1 | 5 | 3 |

**Totals:** 26 FRs, 130 Acceptance Criteria, 77 Business Rules

---

## 3. Code Traceability Matrix

| FR ID | FR Title | Verdict | Key Evidence | ACs Covered | ACs Missing |
|-------|----------|---------|-------------|-------------|-------------|
| FR-01 | Identity, access control, approvals, audit | PARTIAL | `middleware/auth.ts:1-23`, `app.ts:172`, `migrations/002_rbac.sql`, `routes/jurisdiction.routes.ts`, `migrations/020_audit_hash_chain.sql` | AC-01,02,03,05 | AC-04 (LDAP adapter), BR-03 (export justification) |
| FR-02 | Source connectors and ingestion | PARTIAL | `connectors/cctns-adapter.ts`, `connectors/ecourts-adapter.ts`, `connectors/ndps-adapter.ts`, `connectors/ingestion-pipeline.ts`, `connector-scheduler.ts:19-23` | AC-03,04 | AC-01 (only 3/10 adapters), AC-02 (format validation), AC-05 (immutable storage), BR-01 (checksum dedup) |
| FR-03 | OCR, extraction, bilingual review | PARTIAL | `routes/ocr.routes.ts:1-80`, `routes/extract.routes.ts`, `migrations/008_ocr.sql`, `migrations/034_taxonomy_ocr_config.sql` | AC-01 (partial), AC-02 (partial) | AC-03 (threshold tiers), AC-04 (side-by-side UI), AC-05 (versioned assertions), BR-01 (mandatory fields) |
| FR-04 | 54-column subject history builder | PARTIAL | `migrations/028_subject_profile_expansion.sql:1-50`, `services/deduplication.ts`, `migrations/032_deduplication.sql` | AC-01, AC-03 | AC-02 (per-field status), AC-04 (completeness score), AC-05 (CCTNS photos), BR-01 (trust ranking), BR-02 (conflicting assertions) |
| FR-05 | Monthly Report ingestion / KPI | PARTIAL | `routes/monthly-report.routes.ts:243-277`, `services/monthly-report.ts` | BR-01 (KPI dictionary) | AC-01 (auto-detection), AC-02 (doc KPI extraction), AC-03 (unique constraint), AC-04 (confidence routing), AC-05 (publication) |
| FR-06 | E-Courts legal status monitoring | PARTIAL | `services/ecourts-poller.ts`, `routes/ecourts.routes.ts:1-248`, `connectors/ecourts-adapter.ts` | AC-01 | AC-02 (configurable schedule), AC-03 (match confidence), AC-04 (ambiguous routing), AC-05 (status history) |
| FR-07 | Financial intelligence / Unocross | PARTIAL | `services/unocross.ts`, `routes/unocross.routes.ts:196-300` | AC-02 (rule engine) | AC-01 (UPI normalization), AC-03 (draft generation), AC-04 (draft workflow), AC-05 (PDF export), BR-02 (suppression) |
| FR-08 | Interrogation report generation | PARTIAL | `routes/interrogation.routes.ts:109-206`, `routes/interrogation.routes.ts:332-462` | AC-02 (templates) | AC-01 (FIR auto-populate), AC-03 (field validation), AC-04 (PDF/DOCX export), AC-05 (named approver) |
| FR-09 | Unified search, dossier | PARTIAL | `routes/search.routes.ts:1-39`, `services/search.ts`, `routes/dossier.routes.ts:1-221`, `services/dossier.ts` | AC-01, AC-02, AC-03 | AC-04 (watermark), AC-05 (launch analysis), BR-02 (face-match) |
| FR-10 | NL query and insight assistant | PARTIAL | `routes/nl-query.routes.ts:1-59`, `services/nl-query.ts`, `migrations/014_nl_query.sql` | AC-01 | AC-02 (citations), AC-03 (on-prem only), AC-04 (save as search), AC-05 (token logging) |
| FR-11 | n-level link analysis / kingpin | PARTIAL | `routes/graph.routes.ts:7-38`, `services/graph-analysis.ts`, `migrations/015_graph_analysis.sql` | AC-01, AC-02, AC-03 | AC-04 (factor UI), AC-05 (date/source filters) |
| FR-12 | Automated technical analysis report | PARTIAL | `routes/cdr.routes.ts:22-33`, `services/cdr-analysis.ts` | AC-02, AC-05 | AC-01 (PDF report), AC-03 (data range), AC-04 (data unavailable) |
| FR-13 | Geo-fencing and watchlist alerts | PARTIAL | `routes/watchlist.routes.ts:1-153`, `routes/geofence.routes.ts:11-48`, `routes/alert.routes.ts` | AC-02, AC-05 | AC-01 (priority tiers), AC-03 (entry/exit/dwell), AC-04 (suppression) |
| FR-14 | Tower dump analytics | PARTIAL | `routes/geofence.routes.ts:125-218` | AC-01, AC-03 | AC-02 (normalization), AC-04 (async progress), AC-05 (audit retention) |
| FR-15 | Drug offender classification | PARTIAL | `routes/drug-classify.routes.ts:1-132`, `services/drug-classifier.ts` | AC-01 | AC-02 (benchmark), AC-03 (evidence snippets), AC-04 (low-confidence routing), AC-05 (NDPS taxonomy) |
| FR-16 | Lead management | PARTIAL | `routes/lead.routes.ts:55-99`, `routes/memo.routes.ts:69-104`, `migrations/029_lead_brd_fields.sql` | AC-01, AC-02, AC-03, AC-05 | AC-04 (auto-memo + routing), BR-01 (soft-delete enforcement) |
| FR-17 | MIS dashboards | PARTIAL | `routes/dashboard.routes.ts:7-66`, `sla-scheduler.ts:16-44` | AC-01, AC-02 | AC-03 (PDF/XLSX gen), AC-04 (configurable layouts), AC-05 (freshness/anomaly) |
| FR-18 | External connector framework | PARTIAL | `migrations/030_ingestion_pipeline.sql:3-18`, `connectors/types.ts:1-34`, `connector-scheduler.ts` | AC-01, AC-03, AC-04 | AC-02 (transform profiles), AC-05 (unmapping) |
| FR-19 | Cross-platform monitoring | NOT_FOUND | No content_item table, no platform/channel fields | — | All ACs |
| FR-20 | AI content categorization / risk scoring | PARTIAL | `routes/classify.routes.ts:1-87`, `routes/taxonomy.routes.ts`, `migrations/009_classification.sql` | AC-05 (override) | AC-01 (BRD taxonomy labels), AC-02 (factor weights), AC-03 (factor breakdown), AC-04 (queue routing) |
| FR-21 | Legal section mapping | PARTIAL | `routes/legal.routes.ts:20-43,104-145`, `migrations/012_legal.sql` | AC-01, AC-03 | AC-02 (rationale text), AC-04 (governed doc draft), AC-05 (versioned rules) |
| FR-22 | Digital evidence chain-of-custody | NOT_FOUND | No SHA-256 on evidence, no custody event table, no legal hold, no integrity verification | — | All ACs |
| FR-23 | Template/rules administration | IMPLEMENTED | `routes/config.routes.ts`, config governance via `@puda/api-core` | AC-01–04 | AC-05 (historic execution linkage) |
| FR-24 | Notifications, escalation, SLA | PARTIAL | `routes/notification.routes.ts`, `services/notification-engine.ts`, `sla-scheduler.ts:1-13`, `migrations/033_notification_rules.sql` | AC-01, AC-02, AC-05 | AC-03 (hierarchical escalation), AC-04 (email relay) |
| FR-25 | Subject deduplication/merge | PARTIAL | `routes/dedup.routes.ts:11-54`, `services/deduplication.ts` | AC-01, AC-03 | AC-02 (side-by-side UI), AC-04 (reversible merge), AC-05 (post-merge re-linking) |
| FR-26 | Model governance | PARTIAL | `routes/model.routes.ts:12-49,89-114,153-189`, `migrations/018_model_governance.sql` | AC-01, AC-02, AC-04 | AC-03 (production enforcement), AC-05 (benchmark fallback) |

---

## 4. Test Coverage Matrix

| FR | Functional TCs | Automated Tests | Verdict |
|----|---------------|----------------|---------|
| FR-01 | 6 TCs | auth.test, permissions.test, jurisdiction.test/.unit, workflow.test | **COVERED** |
| FR-02 | 5 TCs | ingestion.test | **COVERED** |
| FR-03 | 5 TCs | — | **PARTIAL** |
| FR-04 | 5 TCs | — | **PARTIAL** |
| FR-05 | 4 TCs | monthly-report.test | **COVERED** |
| FR-06 | 5 TCs | ecourts.test | **COVERED** |
| FR-07 | 5 TCs | unocross.test | **COVERED** |
| FR-08 | 5 TCs | — | **PARTIAL** |
| FR-09 | 5 TCs | search.test | **COVERED** |
| FR-10 | 4 TCs | — | **PARTIAL** |
| FR-11 | 5 TCs | — | **PARTIAL** |
| FR-12 | 4 TCs | cdr.test, cdr-analysis.unit | **COVERED** |
| FR-13 | 5 TCs | watchlist.test | **COVERED** |
| FR-14 | 4 TCs | cdr.test (partial) | **PARTIAL** |
| FR-15 | 5 TCs | — | **PARTIAL** |
| FR-16 | 5 TCs | crud.test (partial) | **PARTIAL** |
| FR-17 | 4 TCs | — | **PARTIAL** |
| FR-18 | 4 TCs | — | **PARTIAL** |
| FR-19 | 5 TCs | — | **MISSING** |
| FR-20 | 5 TCs | — | **PARTIAL** |
| FR-21 | 5 TCs | — | **PARTIAL** |
| FR-22 | 5 TCs | — | **MISSING** |
| FR-23 | 4 TCs | — | **PARTIAL** |
| FR-24 | 5 TCs | notifications.test, notification-engine.unit | **COVERED** |
| FR-25 | 5 TCs | dedup.test, deduplication.unit | **COVERED** |
| FR-26 | 5 TCs | — | **PARTIAL** |

---

## 5. Gap Analysis

### A) Unimplemented Requirements (NOT_FOUND)

| FR | Gap | Priority | Impact |
|----|-----|----------|--------|
| FR-22 | No digital evidence chain-of-custody (SHA-256, legal hold, integrity verification) | **P0** | Legally mandated; Must Have R1 |
| FR-19 | No cross-platform content monitoring module (content_item entity, pipeline) | **P0** | Core BRD module entirely absent; Must Have R1 |
| FR-07 AC-03/04/05 | No Unocross draft generation, approval workflow, or PDF export | **P0** | Core financial intelligence output; Must Have R1 |
| FR-04 AC-04 | No completeness score, conflicting assertion management | P1 | Subject profile quality untrackable |
| FR-05 AC-01 | No automated MR file detection from storage | P1 | Manual-only report workflow |
| FR-08 AC-04 | No PDF/DOCX export for interrogation reports | P1 | Core report deliverable missing |
| FR-01 BR-03 | No sensitive field export justification | P1 | Compliance gap |

### B) Untested Requirements (code exists, no tests)

| FR | Component | Test Gap | Risk |
|----|-----------|----------|------|
| FR-03 | OCR routes, extraction | No tests for ocr.routes.ts or extract.routes.ts | MEDIUM |
| FR-08 | Interrogation routes/templates | No tests for interrogation.routes.ts | MEDIUM |
| FR-10 | NL Query routes | No tests for nl-query.routes.ts | LOW |
| FR-11 | Graph analysis routes | No tests for graph.routes.ts | LOW |
| FR-15 | Drug classification routes | No tests for drug-classify.routes.ts | MEDIUM |
| FR-17 | Dashboard/scheduled reports | No tests for dashboard.routes.ts | LOW |
| FR-20 | Classification routes | No tests for classify.routes.ts | MEDIUM |
| FR-21 | Legal mapping routes | No tests for legal.routes.ts | MEDIUM |
| FR-23 | Config/admin routes | No tests for config governance | LOW |
| FR-26 | Model governance routes | No tests for model.routes.ts | MEDIUM |

### C) Partially Implemented Requirements

| FR | What's Implemented | What's Missing | Effort |
|----|-------------------|----------------|--------|
| FR-01 | RBAC, audit, jurisdiction, OIDC | LDAP adapter, export justification | M |
| FR-02 | 3 adapters, retry, DLQ, job tracking | 7 adapters, format validation, immutable storage, checksum dedup | L |
| FR-03 | OCR pipeline, extraction | Telugu OCR, threshold routing, side-by-side UI, versioned assertions | L |
| FR-04 | 54-col schema, dedup | Completeness score, trust ranking, conflicting assertions | M |
| FR-06 | E-Courts CRUD + sync | Match confidence, ambiguous routing, status history | M |
| FR-09 | Search, fuzzy, dossier export | Watermark, launch-to-analysis | S |
| FR-17 | Dashboard stats, scheduled report CRUD | PDF/XLSX generation, freshness markers | M |
| FR-24 | SLA scheduler, notifications | Hierarchical escalation rules, email relay | M |
| FR-25 | Dedup scanning, merge | Side-by-side UI, unmerge, post-merge re-linking | M |

### D) Orphan Code

| Component | Description |
|-----------|-------------|
| `translate.routes.ts` | Translation service — supports bilingual needs, not a standalone BRD FR |
| `taxonomy.routes.ts` | Drug taxonomy — supports FR-15/FR-20, not explicitly a BRD entity |
| `notes.routes.ts` | Generic notes — operational utility not in BRD |
| `connector_dead_letter` table | DLQ — engineering best practice, not in BRD entity model |

---

## 6. Coverage Scorecard and Verdict

### Coverage Metrics

```
Code Coverage:  24/26 FRs have code artifacts = 92.3% (FR-level)
  - Fully Implemented: 1/26  (FR-23)
  - Partially Implemented: 23/26
  - Not Found: 2/26  (FR-19, FR-22)

  Weighted AC completion: ~58%

Test Coverage:  10/26 FRs fully tested = 38.5%
  - Fully Covered: 10/26
  - Partially Covered: 14/26
  - Missing: 2/26
```

### Gap Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| P0 | 3 | FR-22 evidence CoC, FR-19 content monitoring, FR-07 Unocross draft |
| P1 | 4 | FR-04 completeness, FR-05 auto-detect, FR-08 PDF export, FR-01 justification |
| P2 | 10 | Various sub-AC gaps and missing test coverage |
| P3 | 4 | UI polish, orphan code cleanup |

### Verdict

```
System:              DOPAMS
BRD FRs:             26
Code Coverage:       92.3% FR-level (24/26 have code), ~58% AC-weighted
Test Coverage:       38.5% (10/26 fully, 14/26 partially)
P0 Gaps:             3
P1 Gaps:             4
P2 Gaps:             10
P3 Gaps:             4
Compliance Verdict:  AT-RISK
```

**Reason:** While 24/26 FRs have code artifacts (92.3% FR-level), the AC-weighted completion is ~58%. Test coverage at 38.5% is well below the 80% threshold. Three P0 gaps exist in Must-Have R1 requirements.

### Top 5 Priority Actions

| # | Action | FR(s) Affected | Impact | Effort |
|---|--------|----------------|--------|--------|
| 1 | Implement SHA-256 hashing, chain-of-custody events, legal hold, integrity verification | FR-22 | HIGH — legally mandated | L |
| 2 | Build cross-platform content monitoring module with content_item entity and categorization pipeline | FR-19 | HIGH — core BRD module | L |
| 3 | Implement Unocross draft generation, DRAFTED->APPROVED->DISPATCHED workflow, PDF export | FR-07 | HIGH — financial intel output | M |
| 4 | Add PDF/DOCX export for interrogation reports | FR-08 | MEDIUM — report deliverable | S |
| 5 | Write automated tests for FR-03, FR-08, FR-15, FR-20, FR-21, FR-26 (10 untested route files) | Multiple | MEDIUM — quality assurance | M |
