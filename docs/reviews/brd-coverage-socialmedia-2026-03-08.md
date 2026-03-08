# BRD Coverage Audit: Social Media Monitoring Tool
**Date:** 2026-03-08
**BRD:** TEF_AI_Social_Media_Refined_BRD_v2.md (BRD-TEF-SMMT-2.0)
**App:** `apps/social-media-api/`
**Test Cases:** SocialMedia_Functional_Test_Cases.md (TC-TEF-SMMT-1.0)
**Auditor:** Automated (Claude Opus 4.6)

---

## Phase 0: Preflight Check

| Check | Status |
|-------|--------|
| BRD file exists and readable | PASS |
| App directory exists with source files | PASS (30+ route files, 18+ service files, 42 migrations) |
| Test case file exists | PASS (108 functional TCs across 18 FRs) |
| Unit tests exist | PASS (49 test files, 5490 LOC, all passing) |
| Workflow definitions present | PASS (sm_alert.json, sm_case.json, sm_evidence.json, sm_report.json) |
| Migrations present | PASS (042 migrations) |

---

## Phase 1: FR/AC/BR Inventory

| FR | Title | ACs | BRs |
|----|-------|-----|-----|
| FR-01 | Platform deployment and environment management | 5 | 2 |
| FR-02 | Identity, RBAC, and organization hierarchy | 5 | 2 |
| FR-03 | Source onboarding and lawful ingestion | 5 | 2 |
| FR-04 | Unified monitoring dashboard and search workspace | 5 | 2 |
| FR-05 | Keyword, slang, entity, OCR, and transcript analysis | 5 | 2 |
| FR-06 | AI categorization and model operations | 5 | 2 |
| FR-07 | Risk scoring and prioritization | 5 | 2 |
| FR-08 | Legal and policy mapping | 5 | 2 |
| FR-09 | Translation and language intelligence | 5 | 2 |
| FR-10 | Alerts, escalation, collaboration, and SLA management | 5 | 2 |
| FR-11 | Evidence preservation and chain of custody | 5 | 2 |
| FR-12 | Case, task, and workflow management | 5 | 2 |
| FR-13 | Reporting, template management, and MIS analytics | 5 | 2 |
| FR-14 | Administration, taxonomy, legal rules, and config governance | 5 | 2 |
| FR-15 | Notifications, sharing, and external integrations | 5 | 2 |
| FR-16 | Audit logging, observability, and data retention | 5 | 2 |
| FR-17 | Security, privacy, and responsible AI controls | 5 | 2 |
| FR-18 | Implementation delivery, training, support, warranty | 5 | 2 |
| **TOTAL** | | **90 ACs** | **36 BRs** |

---

## Phase 2: Code Traceability (per FR)

### FR-01 -- Platform deployment and environment management

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-01-01 (Separate UAT/Prod) | PARTIAL | `.env.example` externalizes config; no env-promotion logic in code |
| AC-FR-01-02 (HTTPS enforced) | PARTIAL | Fastify app bootstrapped via `@puda/api-core` createApp; TLS depends on deployment |
| AC-FR-01-03 (Config promotion audit) | PARTIAL | `config.routes.ts` uses `createConfigRoutes` from `@puda/api-core`; config governance routes available |
| AC-FR-01-04 (Daily backup) | NOT_FOUND | No backup/restore automation in app code (operational concern) |
| AC-FR-01-05 (Hosting BOM/runbook) | NOT_FOUND | No deployment runbook artifacts in repo |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-01-01 (No prod-to-UAT copy) | NOT_FOUND | Operational policy, not enforced in code |
| BR-FR-01-02 (Externalized config) | IMPLEMENTED | `.env.example` with env vars; `config.routes.ts` |

**Code Verdict: PARTIAL** (2/5 ACs partially, 1/2 BRs implemented)

### FR-02 -- Identity, RBAC, and organization hierarchy

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-02-01 (Role + unit scope) | IMPLEMENTED | `001_init.sql`: user_account.unit_id, user_role table, role table; `002_rbac.sql`; `036_permission_levels.sql` adds permission_level to role |
| AC-FR-02-02 (Read-only role restrictions) | IMPLEMENTED | `permission-levels.test.ts` (122 LOC); `036_permission_levels.sql`; role guards in route files |
| AC-FR-02-03 (Approver roles required) | IMPLEMENTED | `createRoleGuard` used in case, report, evidence routes; supervisor-close requires SUPERVISOR role |
| AC-FR-02-04 (Session idle expiry) | PARTIAL | `026_session_activity.sql` tracks sessions; `020_account_lockout.sql` for lockout; session timeout logic via `@puda/api-core` |
| AC-FR-02-05 (SSO/OIDC/LDAP) | IMPLEMENTED | `auth.routes.ts` uses `createAuthRoutes` from `@puda/api-core` which includes `createOidcAuth`/`createOidcRoutes` |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-02-01 (Cross-district denied by default) | IMPLEMENTED | Queries filter by `unit_id` in alerts, cases, evidence, reports |
| BR-FR-02-02 (Disabled user task reassignment) | PARTIAL | Account lockout migration exists but no auto-reassignment logic found |

**Code Verdict: IMPLEMENTED** (4/5 ACs implemented, 1 partial)

### FR-03 -- Source onboarding and lawful ingestion

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-03-01 (Connector record with config) | IMPLEMENTED | `connector.routes.ts`: CRUD for source_connector; `001_init.sql` schema; `029_connector_health.sql` |
| AC-FR-03-02 (Raw + normalized retention) | IMPLEMENTED | `ingestion-pipeline.ts` stores content_item with metadata_jsonb; content_media for media |
| AC-FR-03-03 (Exponential backoff + DLQ) | IMPLEMENTED | `connector-scheduler.ts` + `connector.routes.ts` dead-letter queue endpoints; `027_connector_dedup_index.sql` |
| AC-FR-03-04 (Dedup by source ID + hash) | IMPLEMENTED | `ingestion-pipeline.ts` line 26-30: dedup check on platform + platform_post_id |
| AC-FR-03-05 (Rate-limit/legal-basis viewable) | IMPLEMENTED | `037_retention_legal_basis.sql`; connector.routes.ts returns config_jsonb; `default_legal_basis` field |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-03-01 (Only approved sources) | IMPLEMENTED | Admin-only guard on connector CRUD |
| BR-FR-03-02 (Connector creds in secrets manager) | PARTIAL | Config stored in config_jsonb; no secrets manager integration visible |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-04 -- Unified monitoring dashboard and search workspace

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-04-01 (Dashboard with filters) | IMPLEMENTED | `dashboard.routes.ts`: /dashboard/stats with platform, district, priority, date filters using `buildFilterClauses` |
| AC-FR-04-02 (Control Room view) | IMPLEMENTED | `dashboard.routes.ts`: /dashboard/control-room with SLA countdown, priority ordering |
| AC-FR-04-03 (Actor timelines) | IMPLEMENTED | `actor.routes.ts`: /actors/:id/posts; cross-platform link; `actor-aggregator.ts` |
| AC-FR-04-04 (Saved searches) | IMPLEMENTED | `saved-search.routes.ts`: full CRUD + /run endpoint with stored queries |
| AC-FR-04-05 (Fixed navigation tabs) | PARTIAL | Backend provides all route groups; navigation is frontend responsibility |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-04-01 (Actor merge confidence) | IMPLEMENTED | `actor-aggregator.ts` crossPlatformLink with configurable confidence |
| BR-FR-04-02 (Config-driven widgets) | PARTIAL | Dashboard stats are code-driven; no widget configuration table |

**Code Verdict: IMPLEMENTED** (4/5 ACs implemented, 1 partial)

### FR-05 -- Keyword, slang, entity, OCR, and transcript analysis

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-05-01 (Slang dictionary with fields) | IMPLEMENTED | `slang.routes.ts`: full CRUD; `032_slang_dictionary.sql` with term, language, category, risk_weight, submission_status |
| AC-FR-05-02 (Entity extraction) | IMPLEMENTED | `extract.routes.ts` + `entity-extractor.ts`: extracts handles, hashtags, phones, payment refs, locations, substances |
| AC-FR-05-03 (OCR/transcript searchable) | IMPLEMENTED | `ocr.routes.ts` + `ocr-processor.ts`; `008_ocr.sql` migration; OCR text stored and linked |
| AC-FR-05-04 (Match results with confidence) | IMPLEMENTED | `classify.routes.ts` returns category, risk_score, factors; `slang-normalizer.ts` |
| AC-FR-05-05 (Analyst candidate slang submission) | IMPLEMENTED | `slang.routes.ts`: POST /slang/submit creates PENDING entry; approve/reject endpoints |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-05-01 (Glossary overrides translation) | IMPLEMENTED | `translate.routes.ts` lines 153-162: glossary substitution before translation |
| BR-FR-05-02 (OCR advisory, original master) | IMPLEMENTED | OCR stored separately in ocr_job; original media preserved |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-06 -- AI categorization and model operations

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-06-01 (Fixed JSON schema output) | IMPLEMENTED | `classifier.ts` + `009_classification.sql`: classification_result with category, risk_score, risk_factors, review_status |
| AC-FR-06-02 (Parent-child taxonomy with versioning) | IMPLEMENTED | `taxonomy.routes.ts`: taxonomy_version + taxonomy_rule with version_no, activate/copy; `038_taxonomy_versioning.sql` |
| AC-FR-06-03 (Analyst accept/correct/reject) | IMPLEMENTED | `classify.routes.ts`: PATCH override with category, riskScore, reason; linked to model version |
| AC-FR-06-04 (Rule updates without LLM changes) | IMPLEMENTED | `taxonomy.routes.ts`: rules CRUD on non-active versions; activate separately |
| AC-FR-06-05 (Low confidence -> NEEDS_REVIEW) | IMPLEMENTED | `ingestion-pipeline.ts` lines 39-42: confidence threshold routing to NEEDS_REVIEW |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-06-01 (AI classification advisory) | IMPLEMENTED | All classification results have review_status; no auto-export |
| BR-FR-06-02 (Prod taxonomy requires approval) | IMPLEMENTED | Taxonomy versions require explicit activation |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-07 -- Risk scoring and prioritization

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-07-01 (0-100 scale, priority bands) | IMPLEMENTED | `alert.routes.ts` /recalculate: maps score to CRITICAL/HIGH/MEDIUM/LOW; `ingestion-pipeline.ts` lines 115-118 |
| AC-FR-07-02 (Scorecard with factor contributions) | IMPLEMENTED | `alert.routes.ts` /recalculate returns riskScore with factor breakdown (category, virality, alert type) |
| AC-FR-07-03 (Configurable queue routing) | IMPLEMENTED | `queue-routing.routes.ts`: full CRUD for routing rules mapping category + risk range to target queue |
| AC-FR-07-04 (Repeat-actor indicators) | IMPLEMENTED | `ingestion-pipeline.ts` lines 87-110: actor repeat-offender lookup and auto-CRITICAL escalation; `actor.routes.ts` /recalculate-risk with history bonus |
| AC-FR-07-05 (Scoring recalculation on change) | IMPLEMENTED | `alert.routes.ts` POST /recalculate; `actor.routes.ts` POST /recalculate-risk |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-07-01 (Missing data defaults to zero) | IMPLEMENTED | Null-safe: `(c.share_count || 0)`, `(catResult.rows[0].risk_weight || 1)` |
| BR-FR-07-02 (Priority override with audit) | IMPLEMENTED | Override stores original computed score; audit log written |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-08 -- Legal and policy mapping

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-08-01 (Legal mapping results with fields) | IMPLEMENTED | `legal.routes.ts` + `legal-mapper.ts`; `012_legal.sql`: legal_mapping_result with rule_id, confidence, rationale |
| AC-FR-08-02 (Alert card legal suggestions) | IMPLEMENTED | `legal.routes.ts` GET /legal/mappings/:entityType/:entityId |
| AC-FR-08-03 (Investigation report drafts) | IMPLEMENTED | `report.routes.ts` buildReportTemplate with chronology, evidence refs, legal refs |
| AC-FR-08-04 (Versioned rule changes) | IMPLEMENTED | `012_legal.sql` legal_mapping_rule with version; taxonomy versioning; effective dates in `038_taxonomy_versioning.sql` |
| AC-FR-08-05 (No export without legal approval) | IMPLEMENTED | `report.routes.ts` /export: checks approved_by; 403 if DRAFT or no approver |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-08-01 (Legal suggestions advisory) | IMPLEMENTED | Mapping confirm is manual action via PATCH /confirm |
| BR-FR-08-02 (No-match shows legal_status) | PARTIAL | Legal status field in `028_priority_legal_case_fields.sql`; auto-map may return empty but no explicit NO_MATCH_FOUND status set |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-09 -- Translation and language intelligence

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-09-01 (ISO language code + confidence) | IMPLEMENTED | `language-detector.ts`: detectLanguageWithConfidence returns language, confidence, script; `039_language_detection.sql` |
| AC-FR-09-02 (Translation from alert/content/evidence) | IMPLEMENTED | `translate.routes.ts` POST /translate supports sm_alert, sm_case, sm_evidence |
| AC-FR-09-03 (Original immutable, translation separate) | IMPLEMENTED | `013_translation.sql`: translation_record stores translated_text separately; original text unchanged |
| AC-FR-09-04 (Side-by-side original + translated) | IMPLEMENTED | GET /translations/:entityType/:entityId returns all translations; original accessible via entity endpoint |
| AC-FR-09-05 (Glossary overrides translation) | IMPLEMENTED | `translate.routes.ts` lines 153-162: glossary substitution with `ORDER BY LENGTH(source_term) DESC` |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-09-01 (Translation user-initiated) | IMPLEMENTED | POST /translate requires explicit request |
| BR-FR-09-02 (Unsupported language no block) | IMPLEMENTED | Language detector returns "und" for unknown; translation proceeds |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-10 -- Alerts, escalation, collaboration, and SLA management

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-10-01 (Alert stores all required fields) | IMPLEMENTED | `001_init.sql` sm_alert + `028_priority_legal_case_fields.sql`: alert_type, priority, content_id, category_id, state_id, assigned_to, due_at, alert_ref |
| AC-FR-10-02 (SLA targets by priority) | IMPLEMENTED | `sla-scheduler.ts` uses `createSlaScheduler`; `dashboard.routes.ts` /control-room shows SLA countdown |
| AC-FR-10-03 (External sharing watermarked + audit) | IMPLEMENTED | `alert.routes.ts` /export with generateAndLogWatermark; `watermark.ts` service; `alert.routes.ts` /actions SHARE with alert_share table |
| AC-FR-10-04 (Comment, tag, suppress, false-positive) | IMPLEMENTED | `alert.routes.ts` actions: ACKNOWLEDGE, ESCALATE, SHARE, DISMISS; /false-positive with mandatory reason; `notes.routes.ts` for comments |
| AC-FR-10-05 (Notifications on creation/breach/closure) | IMPLEMENTED | `notification.routes.ts` uses `createNotificationRoutes`; `005_notifications.sql` |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-10-01 (Critical auto-routed to Control Room) | IMPLEMENTED | `ingestion-pipeline.ts` auto-creates alerts with priority based on risk score; queue routing rules |
| BR-FR-10-02 (Closure requires disposition) | IMPLEMENTED | Workflow transitions enforce state machine; supervisor-close requires justification |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-11 -- Evidence preservation and chain of custody

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-11-01 (Capture with hash/timestamp/operator) | IMPLEMENTED | `evidence.routes.ts` /capture: SHA-256 hash computed, captured_by, created_at; content_id linked |
| AC-FR-11-02 (Unique evidence reference number) | IMPLEMENTED | `evidence.routes.ts` generates TEF-EVD-YYYY-NNNNNN via sequence; `003_ref_numbers.sql` |
| AC-FR-11-03 (Immutable master, separate copies) | IMPLEMENTED | Workflow states CAPTURE_REQUESTED -> CAPTURED -> VERIFIED; `006_custody.sql` custody_event table |
| AC-FR-11-04 (Chain-of-custody log) | IMPLEMENTED | `evidence.routes.ts` /custody-log + auto custody_event on VIEW, HASH_VERIFIED, PACKAGED |
| AC-FR-11-05 (Evidence packaging with manifest) | IMPLEMENTED | `evidence.routes.ts` /package: createEvidencePackager for ZIP + SHA-256 manifest; watermark applied |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-11-01 (No destructive changes) | IMPLEMENTED | Workflow state machine controls transitions; no DELETE endpoint for evidence |
| BR-FR-11-02 (Confirmation for operations) | IMPLEMENTED | Workflow transitions require explicit POST |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-12 -- Case, task, and workflow management

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-12-01 (Create case from alerts, link evidence) | IMPLEMENTED | `case.routes.ts` POST /cases with alertId; evidence_item has case_id FK |
| AC-FR-12-02 (Assignment, due dates, priority, status) | IMPLEMENTED | case_record has assigned_to, due_at, priority, state_id; case_ref via sequence |
| AC-FR-12-03 (Timeline records) | IMPLEMENTED | `case.routes.ts` /timeline: aggregates STATE_CHANGE, NOTE, EVIDENCE_ADDED, ALERT_LINKED, REPORT_CREATED |
| AC-FR-12-04 (Closure requires reason + approval) | IMPLEMENTED | /supervisor-close requires SUPERVISOR role + justification; auto-sets closed_at and closure_reason |
| AC-FR-12-05 (Reopen preserves closure metadata) | IMPLEMENTED | Workflow state machine supports CLOSED -> REOPENED transitions; original closure_reason preserved |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-12-01 (Alert links to one primary case) | IMPLEMENTED | case_record.source_alert_id FK |
| BR-FR-12-02 (Closed cases read-only except reopen) | IMPLEMENTED | Workflow state machine restricts CLOSED transitions to only REOPEN |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-13 -- Reporting, template management, and MIS analytics

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-13-01 (Template create/upload/version/approve) | IMPLEMENTED | `report-template.routes.ts`: full CRUD; `040_report_templates.sql`; content_schema for placeholder definitions |
| AC-FR-13-02 (Reports with chronology/evidence/legal) | IMPLEMENTED | `report.routes.ts` buildReportTemplate includes alerts table, summary, legal refs |
| AC-FR-13-03 (PDF and DOCX export) | IMPLEMENTED | `report.routes.ts` /export with format=pdf|docx; dedicated /pdf and /docx endpoints |
| AC-FR-13-04 (MIS catalog) | IMPLEMENTED | `report-template.routes.ts` 6 MIS endpoints: platform-summary, risk-distribution, response-time, category-trends, analyst-workload, escalation-funnel |
| AC-FR-13-05 (Reports filterable by date/platform/district) | IMPLEMENTED | All MIS endpoints support date range filters; dashboard uses buildFilterClauses |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-13-01 (Only APPROVED templates in prod) | PARTIAL | Templates have is_active flag but no explicit APPROVED status gate before use in report generation |
| BR-FR-13-02 (Evidence numbering at generation time) | IMPLEMENTED | Report export snapshots evidence refs at generation |

**Code Verdict: IMPLEMENTED** (5/5 ACs implemented)

### FR-14 -- Administration, taxonomy, legal rules, and configuration governance

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-14-01 (Config objects: taxonomy, slang, legal, etc.) | IMPLEMENTED | Separate CRUD routes for taxonomy, slang, legal rules, report templates, config, queue routing |
| AC-FR-14-02 (Version, approval, effective dates) | IMPLEMENTED | `taxonomy.routes.ts` version_no, activated_at; slang submission_status with review; legal rules with effective dates |
| AC-FR-14-03 (UAT/Prod promotion audit) | PARTIAL | `config.routes.ts` uses createConfigRoutes which supports governance; but no explicit UAT->Prod promotion workflow |
| AC-FR-14-04 (Conflict validation) | PARTIAL | Taxonomy: active version blocks rule additions; slang: unique constraint on (term, language); but no comprehensive conflict detection |
| AC-FR-14-05 (Rollback to previous version) | IMPLEMENTED | Taxonomy: create new version copies from active, then activate; effectively rollback-capable |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-14-01 (No prod bypass without override) | PARTIAL | Admin guards on all config endpoints; no emergency override workflow |
| BR-FR-14-02 (No overlapping effective dates) | PARTIAL | Taxonomy versioning prevents overlap by activating one at a time; legal rules lack explicit overlap check |

**Code Verdict: PARTIAL** (3/5 ACs implemented, 2 partial)

### FR-15 -- Notifications, sharing, and external integrations

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-15-01 (Documented adapters with retry) | IMPLEMENTED | 5 connectors (twitter, instagram, facebook, youtube, reddit) in `src/connectors/`; retry in connector-scheduler |
| AC-FR-15-02 (Outbound share with watermark) | IMPLEMENTED | `alert.routes.ts` /export with watermark; alert_share with share_type; watermark_log table |
| AC-FR-15-03 (Idempotency keys) | PARTIAL | Dead-letter queue with retry; but no explicit X-Idempotency-Key header handling in routes |
| AC-FR-15-04 (Failed integration -> DLQ) | IMPLEMENTED | `connector.routes.ts` dead-letter endpoints; retry individual entries |
| AC-FR-15-05 (SIEM/SOC forwarding) | IMPLEMENTED | `siem-forwarder.ts`; `sla-scheduler.ts` startHighSeverityAlertForwarder; `042_siem_forwarded_at.sql` |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-15-01 (No unsanctioned channels) | IMPLEMENTED | Share types constrained to enum: INTERNAL, EXTERNAL_AGENCY, PLATFORM_REPORT |
| BR-FR-15-02 (System-to-system auth) | IMPLEMENTED | Connector config stored in config_jsonb; auth middleware on all routes |

**Code Verdict: IMPLEMENTED** (4/5 ACs implemented, 1 partial)

### FR-16 -- Audit logging, observability, and data retention

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-16-01 (Audit captures actor, role, action, etc.) | IMPLEMENTED | `001_init.sql` audit_log; `025_audit_extra_columns.sql`; `middleware/audit-logger.ts` uses createAuditLogger |
| AC-FR-16-02 (Append-only, tamper-evident) | IMPLEMENTED | `019_audit_hash_chain.sql` hash_chain_value; `audit-chain.test.ts` (172 LOC) |
| AC-FR-16-03 (Operational dashboards) | IMPLEMENTED | `connector.routes.ts` /health endpoint; dashboard stats; SLA monitoring in control-room view |
| AC-FR-16-04 (Retention policies + purge approval) | IMPLEMENTED | `022_data_retention.sql`; `connector.routes.ts` /retention-flagged + /flag-expired; `content-retention.test.ts` |
| AC-FR-16-05 (Quarterly backup verification) | NOT_FOUND | Operational procedure not in application code |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-16-01 (Audit logs not editable from UI) | IMPLEMENTED | No UPDATE/DELETE endpoints for audit_log; INSERT-only |
| BR-FR-16-02 (Legal hold excludes purge) | PARTIAL | Evidence has legal_hold flag; retention flagging exists but no explicit legal_hold check in purge |

**Code Verdict: IMPLEMENTED** (4/5 ACs implemented, 1 not found)

### FR-17 -- Security, privacy, and responsible AI controls

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-17-01 (Encryption at rest/transit) | PARTIAL | TLS via deployment config; `021_pii_encryption.sql` + `pii-crypto.ts` for field-level PII encryption |
| AC-FR-17-02 (MFA + secrets management) | IMPLEMENTED | `023_mfa.sql` + `mfa-pii.test.ts` (204 LOC); `024_token_revocation.sql` |
| AC-FR-17-03 (AI text labeled DRAFT until approved) | IMPLEMENTED | Report states start as DRAFT; export blocked until approved_by set; four-eyes check |
| AC-FR-17-04 (Model/prompt/rule versions stored) | IMPLEMENTED | `model.routes.ts` + `018_model_governance.sql`: model registry with version, status, metrics; prediction logging |
| AC-FR-17-05 (Watermark and redaction) | IMPLEMENTED | `watermark.ts` + `033_mfa_watermark.sql` watermark_log; exports include X-Watermark header |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-17-01 (AI no autonomous actions) | IMPLEMENTED | All AI outputs are advisory; human approval gates throughout |
| BR-FR-17-02 (Role/tenant scoped prompts) | PARTIAL | Unit-scoped queries; no explicit prompt-level tenant scoping |

**Code Verdict: IMPLEMENTED** (4/5 ACs implemented, 1 partial)

### FR-18 -- Implementation delivery, training, support, warranty

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-FR-18-01 (Delivery plan) | NOT_FOUND | Process/contractual artifact, not in application code |
| AC-FR-18-02 (Hosting infrastructure spec) | PARTIAL | `.env.example` documents required env vars; no full hosting BOM |
| AC-FR-18-03 (Role-based training) | NOT_FOUND | Training artifacts not in codebase |
| AC-FR-18-04 (Hypercare support) | NOT_FOUND | Process artifact, not in application code |
| AC-FR-18-05 (Warranty + ownership) | NOT_FOUND | Contractual artifact, not in application code |

| BR | Verdict | Evidence |
|----|---------|----------|
| BR-FR-18-01 (Site-not-ready documentation) | NOT_FOUND | Process artifact |
| BR-FR-18-02 (Milestone acceptance) | NOT_FOUND | Process artifact |

**Code Verdict: NOT_FOUND** (0/5 ACs implemented -- FR-18 is non-functional/contractual)

---

## Phase 3: Test Coverage

### 3.1 Functional Test Cases (TC file)

| FR | TC Count | Coverage |
|----|----------|----------|
| FR-01 | 5 TCs | COVERED |
| FR-02 | 7 TCs | COVERED |
| FR-03 | 8 TCs | COVERED |
| FR-04 | 6 TCs | COVERED |
| FR-05 | 6 TCs | COVERED |
| FR-06 | 6 TCs | COVERED |
| FR-07 | 7 TCs | COVERED |
| FR-08 | 6 TCs | COVERED |
| FR-09 | 6 TCs | COVERED |
| FR-10 | 7 TCs | COVERED |
| FR-11 | 6 TCs | COVERED |
| FR-12 | 6 TCs | COVERED |
| FR-13 | 6 TCs | COVERED |
| FR-14 | 7 TCs | COVERED |
| FR-15 | 5 TCs | COVERED |
| FR-16 | 6 TCs | COVERED |
| FR-17 | 5 TCs | COVERED |
| FR-18 | 3 TCs | PARTIAL |
| **Total** | **108 TCs** | |

### 3.2 Unit/Integration Tests (Vitest)

| FR | Test Files | Lines | Status |
|----|-----------|-------|--------|
| FR-01 | config.test.ts | 66 | PASS |
| FR-02 | auth.test.ts, permissions.test.ts, permission-levels.test.ts, mfa-pii.test.ts | 517 | PASS |
| FR-03 | connectors.test.ts, connectors.unit.test.ts, content-retention.test.ts | 1002 | PASS |
| FR-04 | dashboard.test.ts, saved-search.test.ts, actor.test.ts | 201 | PASS |
| FR-05 | slang.test.ts, slang-normalizer.unit.test.ts, slang-version.test.ts, extract.test.ts, ocr.test.ts | 354 | PASS |
| FR-06 | classify.test.ts, classifier.unit.test.ts, drug-classify.test.ts, taxonomy.test.ts, model.test.ts | 608 | PASS |
| FR-07 | alert-queue.test.ts, queue-routing.test.ts, actor-risk-recalc.test.ts | 289 | PASS |
| FR-08 | legal-mapping.test.ts, four-eyes.test.ts, export-approval.test.ts | 299 | PASS |
| FR-09 | translate.test.ts, language-detection.test.ts | 195 | PASS |
| FR-10 | crud.test.ts, alert-export-watermark.test.ts, notes.test.ts, notifications.test.ts | 365 | PASS |
| FR-11 | evidence-package.test.ts, graph.test.ts | 103 | PASS |
| FR-12 | case-timeline.test.ts, workflow.test.ts, task.test.ts | 329 | PASS |
| FR-13 | report-template.test.ts, report-export.test.ts | 260 | PASS |
| FR-14 | taxonomy.test.ts, admin.test.ts, config.test.ts | 303 | PASS |
| FR-15 | siem-forwarder.unit.test.ts, connectors.test.ts | 217 | PASS |
| FR-16 | audit-chain.test.ts, content-retention.test.ts | 295 | PASS |
| FR-17 | mfa-pii.test.ts, alert-export-watermark.test.ts, four-eyes.test.ts | 294 | PASS |
| FR-18 | (none) | 0 | N/A |

**All 49 test files pass. Total: 5490 LOC of tests.**

### 3.3 Test Coverage by FR

| FR | Functional TCs | Unit Tests | Test Verdict |
|----|---------------|------------|--------------|
| FR-01 | COVERED | PARTIAL | PARTIAL |
| FR-02 | COVERED | COVERED | COVERED |
| FR-03 | COVERED | COVERED | COVERED |
| FR-04 | COVERED | COVERED | COVERED |
| FR-05 | COVERED | COVERED | COVERED |
| FR-06 | COVERED | COVERED | COVERED |
| FR-07 | COVERED | COVERED | COVERED |
| FR-08 | COVERED | COVERED | COVERED |
| FR-09 | COVERED | COVERED | COVERED |
| FR-10 | COVERED | COVERED | COVERED |
| FR-11 | COVERED | COVERED | COVERED |
| FR-12 | COVERED | COVERED | COVERED |
| FR-13 | COVERED | COVERED | COVERED |
| FR-14 | COVERED | COVERED | COVERED |
| FR-15 | COVERED | COVERED | COVERED |
| FR-16 | COVERED | COVERED | COVERED |
| FR-17 | COVERED | COVERED | COVERED |
| FR-18 | PARTIAL | MISSING | MISSING |

---

## Phase 4: Gap Analysis

### P0 Gaps (Critical -- blocks compliance)

| ID | FR | Gap | Impact |
|----|----|-----|--------|
| P0-1 | FR-15 | No X-Idempotency-Key header handling in API routes | BRD API-01 explicitly requires idempotency via header; missing prevents safe retry |

### P1 Gaps (High -- significant functional gap)

| ID | FR | Gap | Impact |
|----|----|-----|--------|
| P1-1 | FR-01 | No automated backup/restore mechanism | AC-FR-01-04 requires daily backup with restore demonstration |
| P1-2 | FR-01 | No deployment runbook or hosting BOM | AC-FR-01-05 requires delivery artifacts |
| P1-3 | FR-14 | No UAT-to-Production promotion workflow | AC-FR-14-03 requires distinct promotion audit events |
| P1-4 | FR-16 | No quarterly backup verification | AC-FR-16-05 requires periodic verification evidence |
| P1-5 | FR-13 | Template approval status not gated before report generation | BR-FR-13-01: only APPROVED templates should be used |

### P2 Gaps (Medium -- partial implementation)

| ID | FR | Gap | Impact |
|----|----|-----|--------|
| P2-1 | FR-02 | No auto-reassignment of tasks when user disabled | BR-FR-02-02 requires supervisor reassignment |
| P2-2 | FR-03 | Connector credentials not integrated with external secrets manager | BR-FR-03-02 requires secrets manager |
| P2-3 | FR-04 | Dashboard widgets not configuration-driven | BR-FR-04-02 requires no-code reordering |
| P2-4 | FR-08 | No explicit NO_MATCH_FOUND legal_status set | BR-FR-08-02 requires explicit status |
| P2-5 | FR-14 | No effective-date overlap detection for legal rules | BR-FR-14-02 requires overlap prevention |
| P2-6 | FR-17 | Role/tenant scoping for AI prompts not explicitly implemented | BR-FR-17-02 |

### P3 Gaps (Low -- non-functional/contractual)

| ID | FR | Gap | Impact |
|----|----|-----|--------|
| P3-1 | FR-18 | All 5 ACs are contractual/process artifacts not tracked in code | Expected -- these are delivery obligations |

---

## Phase 5: Scorecard

### Coverage Summary

| Metric | Value |
|--------|-------|
| Total FRs | 18 |
| Total ACs | 90 |
| ACs IMPLEMENTED | 71 (78.9%) |
| ACs PARTIAL | 12 (13.3%) |
| ACs NOT_FOUND | 7 (7.8%) |
| **Code Coverage (IMPLEMENTED + PARTIAL)** | **83/90 = 92.2%** |
| **Code Coverage (IMPLEMENTED only)** | **71/90 = 78.9%** |

| Metric | Value |
|--------|-------|
| Total BRs | 36 |
| BRs IMPLEMENTED | 26 (72.2%) |
| BRs PARTIAL | 7 (19.4%) |
| BRs NOT_FOUND | 3 (8.3%) |

| Metric | Value |
|--------|-------|
| Functional TCs defined | 108 |
| FRs with COVERED test verdict | 16/18 (88.9%) |
| FRs with PARTIAL test verdict | 1/18 (5.6%) |
| FRs with MISSING test verdict | 1/18 (5.6%) |
| Unit test files | 49 (all passing) |
| Unit test LOC | 5,490 |

### Adjusted Coverage (Excluding FR-18)

FR-18 is contractual/non-functional and has zero application code expectations. Excluding it:

| Metric | Value |
|--------|-------|
| ACs IMPLEMENTED | 71/85 = **83.5%** |
| ACs IMPLEMENTED + PARTIAL | 78/85 = **91.8%** |
| Test COVERED | 16/17 = **94.1%** |

### P0 Count: 1

### Compliance Verdict

**Using criteria:**
- COMPLIANT: code >= 90% AND test >= 80% AND zero P0
- GAPS-FOUND: code >= 70% AND test >= 50% AND <= 2 P0
- AT-RISK: code < 70% OR test < 50% OR > 2 P0

| Criterion | Value | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Code coverage (IMPL+PARTIAL) | 92.2% | >= 70% | YES |
| Test coverage (COVERED FRs) | 88.9% | >= 50% | YES |
| P0 gaps | 1 | <= 2 | YES |

## VERDICT: GAPS-FOUND

The system meets the GAPS-FOUND threshold with strong code coverage (92.2%) and test coverage (88.9%). The single P0 gap (idempotency header handling) prevents COMPLIANT status. The system has improved significantly from the previous audit (2026-03-07) which rated AT-RISK.

### Key Strengths
1. **Comprehensive route coverage**: 30+ route files covering all 18 FRs with full CRUD + workflow transitions
2. **Strong test suite**: 49 test files, 5,490 LOC, all passing; covers auth, RBAC, connectors, classification, evidence chain-of-custody, legal mapping, translation, reporting, audit, MFA
3. **Workflow engine integration**: 4 workflow definitions (alert, case, evidence, report) with proper state machines
4. **Evidence integrity**: SHA-256 hashing, chain-of-custody events, evidence packaging with manifest
5. **AI governance**: Model registry, taxonomy versioning, classification with confidence routing, analyst override
6. **Security hardening**: Audit hash chain, PII encryption, MFA, watermarking, token revocation, account lockout
7. **MIS analytics**: 6 dedicated MIS report endpoints (platform summary, risk distribution, response time, category trends, analyst workload, escalation funnel)
8. **Scheduled reports**: CRUD + scheduler for automated recurring reports

### Priority Remediation Path
1. **P0-1** (Idempotency): Add X-Idempotency-Key middleware to ingestion and mutation endpoints
2. **P1-5** (Template approval gate): Add APPROVED status check in report generation route
3. **P1-3** (Config promotion): Implement UAT->Prod promotion workflow in config governance
4. **P2-1** (User disable reassignment): Add task reassignment hook to user deactivation
5. **P2-4** (Legal NO_MATCH_FOUND): Set explicit legal_status when auto-map returns empty results
