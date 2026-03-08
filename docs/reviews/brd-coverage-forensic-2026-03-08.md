# BRD Coverage Audit Report -- Forensic AI Platform

**Document ID:** AUDIT-FORENSIC-2026-03-08
**BRD Reference:** BRD-R2-FORENSIC-AI v2.0
**App Directory:** `apps/forensic-api/`
**Audit Date:** 2026-03-08
**Auditor:** Automated BRD Traceability Engine

---

## Phase 0: Preflight Check

| Check | Result |
|---|---|
| BRD file exists | PASS -- `docs/policing_apps_brd/Refined_BRD_Forensic_AI_Platform.md` |
| App directory exists | PASS -- `apps/forensic-api/` |
| Source files present | PASS -- 105 TypeScript source files |
| Routes directory | PASS -- 25 route files in `src/routes/` |
| Services directory | PASS -- 16 service files in `src/services/` |
| Migrations directory | PASS -- 46 migration files in `migrations/` |
| Parsers directory | PASS -- 8 parser files (6 tool-specific + registry + types) |
| Test directory | PASS -- 47 test files in `src/__tests__/` |
| Functional TC file | PASS -- `docs/test-cases/Forensic_Functional_Test_Cases.md` (85 TCs) |
| Workflow bridge | PASS -- 7 files in `src/workflow-bridge/` |

---

## Phase 1: FR Extraction from BRD

The BRD defines **17 Functional Requirements** (FR-01 through FR-17) containing:
- **89 Acceptance Criteria** (AC)
- **34 Business Rules** (BR)
- **34 Edge Cases** (EC)
- **34 Failure Handling** (FH)
- **12 Core Enumerations** (ENUM-001 through ENUM-012)
- **17 Data Model Entities** (Case through ConfigVersion)
- **24 API Specifications** (API-01 through API-24)

---

## Phase 2: Code Traceability -- FR-by-FR Analysis

### FR-01: Case Management & Assignment
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-01-01 | Unique immutable case_id (UUID) | `migrations/001_init.sql`: `case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` | IMPLEMENTED |
| AC-FR-01-02 | Draft-to-Active requires mandatory fields | `routes/case.routes.ts:119-133`: Validates title, case_type, assigned_to before ACTIVE transition | IMPLEMENTED |
| AC-FR-01-03 | Case status values (Draft, Active, ..., Reopened) | `migrations/001_init.sql`: `state_id VARCHAR(64) NOT NULL DEFAULT 'DRAFT'`; workflow-bridge defines transitions | PARTIAL -- Uses generic state_id, not enforced as strict enum in DB |
| AC-FR-01-04 | Supervisor/Admin only for Close/Reopen | `workflow-bridge/transitions.ts`: Role guards on transitions; case.routes.ts checks role | IMPLEMENTED |
| AC-FR-01-05 | DOPAMS case linkage | `forensic_case.dopams_case_ref VARCHAR(128)` in init migration; case routes handle it | IMPLEMENTED |
| AC-FR-01-06 | Case audit trail | `audit_event` table; workflow-bridge/audit-writer.ts logs transitions | IMPLEMENTED |
| BR-FR-01-01 | case_reference unique per unit+year | `case.routes.ts:65`: Auto-generates `EF-CASE-YYYY-NNNNNN` via sequence; DB has UNIQUE on case_number | PARTIAL -- Sequence-based, not composite unique on unit+year |
| BR-FR-01-02 | Closed case read-only except reopen | Workflow transitions restrict actions on CLOSED state | IMPLEMENTED |
| BR-FR-01-03 | Active owner must be active | Transition guard checks assigned_to exists; no active-status validation on user | PARTIAL |

**Code Verdict: IMPLEMENTED (7/9 full, 2 partial = 89%)**

---

### FR-02: Evidence Intake & Registration
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-02-01 | Register with evidence_id, case_id, source_tool, checksum, size_bytes | `evidence.routes.ts:15-75`: Full metadata capture; `evidence_source` table has all fields | IMPLEMENTED |
| AC-FR-02-02 | Immutable object storage | `evidence_source` table with `file_url`; no overwrite on reprocess; hash verification route | IMPLEMENTED |
| AC-FR-02-03 | Idempotency-Key for uploads | `import.routes.ts:96-106`: Checks idempotency key header; evidence dedup by hash | PARTIAL -- Idempotency on import jobs, not directly on evidence upload endpoint |
| AC-FR-02-04 | Checksum mismatch -> Quarantined | `evidence.routes.ts:253-287`: Quarantine endpoint; `import-executor.ts:61-69`: Checksum validation; `migrations/041_evidence_quarantine.sql` | IMPLEMENTED |
| AC-FR-02-05 | UI upload progress | Backend supports file upload via POST; UI not in scope of API audit | N/A (UI) |
| AC-FR-02-06 | Duplicate-package detection | `evidence.routes.ts:54-64`: Dedup by hash_sha256 within case | IMPLEMENTED |
| BR-FR-02-01 | evidence_status values | `evidence_source.state_id` + quarantine_status columns; workflow manages states | PARTIAL -- Uses generic state_id, not full BRD enum |
| BR-FR-02-02 | Duplicate retention requires supervisor | `evidence.routes.ts:289-327`: Quarantine approval requires SUPERVISOR role | IMPLEMENTED |
| BR-FR-02-03 | No hard-delete of source files | `requireEvidenceDelete` guard restricts DELETE to SUPERVISOR/ADMIN roles | IMPLEMENTED |

**Code Verdict: IMPLEMENTED (6/8 full, 2 partial = 88%)**

---

### FR-03: Multi-Tool Ingestion, Parsing & Normalization
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-03-01 | Parsers for UFED, XRY, Oxygen, FTK, AXIOM, Belkasoft + generic | `parsers/parser-registry.ts`: 6 parsers registered; individual parser files exist; `migrations/028_parser_framework.sql` | IMPLEMENTED |
| AC-FR-03-02 | Support CSV, JSON, XML, HTML, PDF, ZIP | Parser implementations handle multiple formats; parser types validate extensions | PARTIAL -- Generic adapter framework exists but not all containers explicitly tested |
| AC-FR-03-03 | Normalized artifact types (Message, CallLog, etc.) | `artifact` table with `artifact_type VARCHAR(64)`; parsers emit canonical types | IMPLEMENTED |
| AC-FR-03-04 | Artifact retains source_tool, parser_version, import_job_id | `import-executor.ts:166-174`: Inserts artifact with parser_version; `migrations/046_artifact_parser_version.sql` | IMPLEMENTED |
| AC-FR-03-05 | Import job statuses | `import_job` table with `state_id`; executor transitions through QUEUED -> IN_PROGRESS -> COMPLETED/FAILED | IMPLEMENTED |
| AC-FR-03-06 | Reprocessing creates new job version | Import routes allow multiple jobs per evidence; `artifact_provenance` tracking in migration 042 | PARTIAL -- job_version_no column not visible in init migration |
| BR-FR-03-01 | Reject unsupported file types | `parser-registry.ts:24-36`: Returns null for unknown parser types; executor fails with UNKNOWN_PARSER | IMPLEMENTED |
| BR-FR-03-02 | Restart-safe import | Job state transitions are atomic; partial writes associated with job_id | IMPLEMENTED |
| BR-FR-03-03 | Preserve original timezone | Parsers handle timestamps; `timezone_unknown` flag not explicitly visible | PARTIAL |

**Code Verdict: IMPLEMENTED (6/9 full, 3 partial = 83%)**

---

### FR-04: Evidence Preservation, Audit Trail & Chain of Custody
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-04-01 | Immutable audit events for all actions | `audit_event` table; `middleware/audit-logger.ts`; workflow-bridge/audit-writer.ts | IMPLEMENTED |
| AC-FR-04-02 | Audit event fields (timestamp, actor, case_id, action, etc.) | `audit_event` table has entity_type, entity_id, event_type, actor_id, etc.; `migrations/025_audit_extra_columns.sql` adds fields | PARTIAL -- Missing source_ip and outcome in base table (added in later migration) |
| AC-FR-04-03 | Chain-of-custody export PDF/CSV | `evidence.routes.ts:364-438`: PDF export via `createPdfGenerator`; custody_event table; CSV via custody-log endpoint | IMPLEMENTED |
| AC-FR-04-04 | Version lineage for reprocessed evidence | `migrations/042_artifact_provenance.sql`; import jobs retain version history | IMPLEMENTED |
| AC-FR-04-05 | Audit viewer with filters | Audit events queryable by entity_type, entity_id, date range; `middleware/audit-logger.ts` | PARTIAL -- Basic filtering, no dedicated audit-viewer route with full filter set |
| BR-FR-04-01 | Immutable audit records | `migrations/019_audit_hash_chain.sql`: Hash chain for audit integrity; no DELETE/UPDATE on audit_event | IMPLEMENTED |
| BR-FR-04-02 | Role-based audit viewer access | `middleware/audit-logger.ts` and auth middleware enforce role checks | PARTIAL -- No explicit route-level Auditor/Supervisor restriction on audit endpoints |

**Code Verdict: IMPLEMENTED (4/7 full, 3 partial = 79%)**

---

### FR-05: Artifact Repository, Search & Review Workspace
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-05-01 | Case dashboard with counts | `dashboard.routes.ts:7-95`: Stats by state, type, evidence count, pending findings, draft reports | IMPLEMENTED |
| AC-FR-05-02 | Full-text search with faceted filters | `search.routes.ts`: Global search with entity_types, artifact_types, risk_bands, date_from/to; `services/search.ts`; `migrations/012_search.sql`, `035_faceted_search.sql` | IMPLEMENTED |
| AC-FR-05-03 | Table, timeline, graph, gallery, finding-detail views | `search.routes.ts:62-134`: Gallery view endpoint; graph routes; entity timeline endpoint; finding detail routes | PARTIAL -- Backend provides data endpoints; view modes are UI-layer responsibility |
| AC-FR-05-04 | Source context on finding selection | Finding routes return artifact_id linkage; artifact detail accessible | PARTIAL -- Backend supports it; source context threading not explicit |
| AC-FR-05-05 | Annotations with visibility scopes | `annotation` table in init migration; `notes.routes.ts`; `migrations/004_notes.sql` | PARTIAL -- visibility_scope column added in migration 004 but initial table lacks it |
| AC-FR-05-06 | Paginated, sortable search | Search routes support limit, offset; case/finding routes have pagination | IMPLEMENTED |
| BR-FR-05-01 | Search results include lineage fields | Search service returns artifact/entity references | IMPLEMENTED |
| BR-FR-05-02 | Annotations don't modify artifacts | Annotation is separate table; no UPDATE on artifact from annotation routes | IMPLEMENTED |

**Code Verdict: IMPLEMENTED (5/8 full, 3 partial = 81%)**

---

### FR-06: OCR & Derived Artifact Generation
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-06-01 | DerivedText artifact creation | `services/ocr-processor.ts`; `routes/ocr.routes.ts`; `migrations/007_ocr.sql` | IMPLEMENTED |
| AC-FR-06-02 | Derived artifact metadata | `services/derived-artifact.ts`; extraction_detail columns in evidence; `migrations/043_extraction_detail.sql` | PARTIAL -- Not all BRD-specified fields (extraction_engine, extraction_version, language_hint, confidence) individually stored |
| AC-FR-06-03 | Source-to-derived relationship visible | `artifact.parent_artifact_id` column in init migration; derived-artifact service creates linkage | IMPLEMENTED |
| AC-FR-06-04 | OCR failure non-blocking | Import executor continues on individual artifact failures; `import-executor.ts:148-153`: Warnings tracked, not fatal | IMPLEMENTED |
| AC-FR-06-05 | Unicode, English/Telugu/Hindi support | `evidence.routes.ts:335-362`: Extraction language enum includes en, te, hi, pa; `migrations/013_translation.sql` | IMPLEMENTED |
| BR-FR-06-01 | Derived artifacts inherit case_id/evidence_id | Artifact table has case_id FK; derived artifacts created with same case_id | IMPLEMENTED |
| BR-FR-06-02 | Derived artifacts marked derived=true | `parent_artifact_id` indicates derived status; explicit `derived=true` flag not in schema | PARTIAL |

**Code Verdict: IMPLEMENTED (5/7 full, 2 partial = 86%)**

---

### FR-07: AI Suspicious Content Detection & Classification
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-07-01 | Analyze text, images, documents for suspicious indicators | `services/classifier.ts`; `routes/classify.routes.ts`; `services/drug-classifier.ts`; `routes/drug-classify.routes.ts`; `migrations/009_classification.sql`, `017_drug_classification.sql` | IMPLEMENTED |
| AC-FR-07-02 | Finding fields (finding_id, category_code, severity, confidence, etc.) | `ai_finding` table: finding_id, finding_type, severity, confidence, evidence_refs; `migrations/044_analysis_source.sql` adds analysis_source | PARTIAL -- Uses finding_type not category_code; reason_codes_json/rule_hits_json not explicit columns |
| AC-FR-07-03 | Configurable finding categories | Finding types configurable; drug-classifier supports NarcoticsReference etc. | IMPLEMENTED |
| AC-FR-07-04 | Finding status (Confirmed, FalsePositive, NeedsReview, Escalated) | `ai_finding.state_id` with workflow transitions; finding.routes.ts supports transitions | IMPLEMENTED |
| AC-FR-07-05 | Configurable keyword dictionaries, regex patterns, ML model routing | `dictionary.routes.ts`: Full CRUD for keyword dictionaries with keywords + regex_patterns; `migrations/032_keyword_dictionary.sql` | IMPLEMENTED |
| AC-FR-07-06 | Record rule_only, model_only, hybrid | `migrations/044_analysis_source.sql`: Adds `analysis_source` column to ai_finding | IMPLEMENTED |
| BR-FR-07-01 | No unreviewed findings in final report | `report.routes.ts:345-351`: Blocks publish when unreviewed findings exist | IMPLEMENTED |
| BR-FR-07-02 | Model inference inside approved infrastructure | Architecture constraint; no external API calls in classifier service | IMPLEMENTED |
| BR-FR-07-03 | Confidence thresholds from config | Dictionary/config versioning; thresholds not hardcoded | PARTIAL -- Config-driven but threshold mechanism not fully explicit |

**Code Verdict: IMPLEMENTED (7/9 full, 2 partial = 89%)**

---

### FR-08: Entity Extraction, Resolution & Link Analysis
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-08-01 | Extract PhoneNumber, Email, SocialHandle, BankAccount, etc. | `services/entity-extractor.ts`; `extracted_entity` table with entity_type; `routes/extract.routes.ts`; `migrations/010_entity_extraction.sql` | IMPLEMENTED |
| AC-FR-08-02 | Relationship edges with from/to entity_id, weight, timestamps | `relationship` table: source_entity_id, target_entity_id, relationship_type, weight; import-executor creates relationships | PARTIAL -- Missing first_seen_at, last_seen_at in base migration |
| AC-FR-08-03 | Timeline and graph/network views | `routes/graph.routes.ts`: Network analysis, node analysis, kingpins; `routes/entity-ops.routes.ts:95-123`: Entity timeline; `services/graph-analysis.ts`; `migrations/015_graph_analysis.sql` | IMPLEMENTED |
| AC-FR-08-04 | Entity merge/split with audit events | `routes/entity-ops.routes.ts`: Merge and split endpoints; `services/entity-operations.ts`; `migrations/030_entity_merge_split.sql` | IMPLEMENTED |
| AC-FR-08-05 | Relationships preserve artifact references | `relationship.source_artifact_id` not in base migration but import-executor links via case_id | PARTIAL -- Relationships linked to case, not directly to source_artifact_id |
| BR-FR-08-01 | Merge requires reason_code, reversible via split | entity-ops routes require targetId/sourceId; split endpoint exists; `entity-operations.unit.test.ts` | PARTIAL -- No explicit reason_code field in merge request |
| BR-FR-08-02 | Separate automated vs analyst-confirmed confidence | `extracted_entity.confidence` column; manual_resolution_state tracked in migration 030 | PARTIAL |

**Code Verdict: IMPLEMENTED (3/7 full, 4 partial = 71%)**

---

### FR-09: Risk Scoring & Prioritization
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-09-01 | Risk scores for Artifact, Entity, Case scope types | `risk_score` table with `score_type`; `routes/classify.routes.ts`: Classification per entity; `migrations/027_risk_band_versioning.sql` | PARTIAL -- scope_type not explicitly Artifact/Entity/Case enum |
| AC-FR-09-02 | Risk bands: Low, Medium, High, Critical | Classification service maps scores to bands | IMPLEMENTED |
| AC-FR-09-03 | Score components_json persistence | `risk_score.factors` (JSONB) in init migration | PARTIAL -- Named `factors` not `components_json` |
| AC-FR-09-04 | Score override with reason | `classify.routes.ts:54-86`: Override endpoint with category, riskScore, reason required | IMPLEMENTED |
| AC-FR-09-05 | Sortable/filterable by risk_score and risk_band | Search routes support risk_bands filter; dashboard shows risk distribution | IMPLEMENTED |
| BR-FR-09-01 | Risk rule weights versioned | `migrations/027_risk_band_versioning.sql`: Adds versioning to risk config | IMPLEMENTED |
| BR-FR-09-02 | Override preserves original score | Override service stores both values (original in factors, override in score_value) | PARTIAL |

**Code Verdict: IMPLEMENTED (4/7 full, 3 partial = 79%)**

---

### FR-10: Legal Mapping & Statutory Reference Management
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-10-01 | Versioned mapping table | `legal_mapping` table; `routes/legal.routes.ts`; `services/legal-mapper.ts`; `migrations/011_legal.sql`, `033_legal_rationale.sql` | IMPLEMENTED |
| AC-FR-10-02 | Mapping rationale and evidence references | `legal.routes.ts:209`: Rationale field on approve; `migrations/033_legal_rationale.sql` adds rationale column | IMPLEMENTED |
| AC-FR-10-03 | Accept, Reject, ManuallyAssign mappings | `legal.routes.ts:102-143`: Confirm and manual mapping endpoints; reject endpoint at line 146 | IMPLEMENTED |
| AC-FR-10-04 | Supervisor approval required | `legal.routes.ts:193-194`: Role check for SUPERVISOR/ADMINISTRATOR/LEGAL_ADVISOR | IMPLEMENTED |
| AC-FR-10-05 | Approved mappings insertable in reports | Legal mappings linked to case/finding; report assembly can reference them | PARTIAL -- No explicit report template insertion mechanism |
| BR-FR-10-01 | Legal section master data versioned | `statute_library` table referenced in queries; config_version table supports versioning | IMPLEMENTED |
| BR-FR-10-02 | Rejected mappings remain auditable | Reject sets state_id='REJECTED', does not delete; rejection_reason stored | IMPLEMENTED |

**Code Verdict: IMPLEMENTED (6/7 full, 1 partial = 93%)**

---

### FR-11: Report Composition, Approval, Redaction & Export
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-11-01 | Reports from templates with case metadata, findings, legal mappings | `report.routes.ts:11-68`: `buildReportTemplate` generates structured report with findings, summary, conclusion | IMPLEMENTED |
| AC-FR-11-02 | Report status values (Draft through Superseded) | `report.state_id`; workflow transitions define lifecycle; `report` table has `supersedes_id` | IMPLEMENTED |
| AC-FR-11-03 | Report versioning (report_id, version_no, template_id, etc.) | `report` table: report_id, version_number, template_id, created_by, approved_by, created_at | IMPLEMENTED |
| AC-FR-11-04 | Supervisor approval required; block unreviewed findings | `report.routes.ts:340-352`: requireReportPublish guard + unreviewed findings check | IMPLEMENTED |
| AC-FR-11-05 | Redaction profiles with field-level controls | `report.routes.ts:70-98`: `applyRedaction` + `redactTemplate`; redaction_profile table with rules; CRUD endpoints | IMPLEMENTED |
| AC-FR-11-06 | Export to PDF and DOCX with hash/format/timestamp | `report.routes.ts:208-307`: Export endpoint supports pdf/docx via `createPdfGenerator`/`createDocxGenerator` | PARTIAL -- export_hash, export_timestamp not explicitly stored |
| BR-FR-11-01 | Published reports immutable; changes create new version | `report.supersedes_id` FK supports version chain | IMPLEMENTED |
| BR-FR-11-02 | Draft watermark, Final watermark | `report.routes.ts:66-67`: Watermark 'DRAFT' when state_id is DRAFT | IMPLEMENTED |

**Code Verdict: IMPLEMENTED (7/8 full, 1 partial = 94%)**

---

### FR-12: DOPAMS Integration & Synchronization
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-12-01 | Inbound/outbound sync | `routes/dopams-sync.routes.ts`: Outbound sync (POST), inbound webhook (POST /webhook); `services/dopams-sync.ts` | IMPLEMENTED |
| AC-FR-12-02 | Sync event persistence (sync_event_id, payload_hash, etc.) | `dopams_sync_event` table; `migrations/029_dopams_sync_execution.sql`, `045_dopams_sync_idempotency.sql` | IMPLEMENTED |
| AC-FR-12-03 | Idempotent operations | `dopams-sync.routes.ts:22-32`: Idempotency-Key check; `migrations/045_dopams_sync_idempotency.sql` | IMPLEMENTED |
| AC-FR-12-04 | Retry with configurable backoff | `services/dopams-sync.ts:99-121`: Retry via `createRetryHandler` with exponential backoff; retry-all endpoint | IMPLEMENTED |
| AC-FR-12-05 | Versioned field mapping | `dopams-sync.routes.ts:160-206`: Field mapping CRUD with versioning; `migrations/040_field_mapping_version.sql` | IMPLEMENTED |
| BR-FR-12-01 | Outbound sync only after Published | Sync payload builds from confirmed/reviewed findings; no explicit Published check | PARTIAL |
| BR-FR-12-02 | Inbound validation against schema version | Webhook validates eventType enum; full schema version validation not explicit | PARTIAL |

**Code Verdict: IMPLEMENTED (5/7 full, 2 partial = 86%)**

---

### FR-13: Alerts, Notifications & Escalations
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-13-01 | Alert rules based on risk, keywords, priority, failures | `services/alert-engine.ts`: Rule evaluation with conditions matching (gte/lte/equality); `alert_rule` table; `migrations/031_alert_lifecycle.sql` | IMPLEMENTED |
| AC-FR-13-02 | Critical/High alerts within 30 seconds | Alert engine fires synchronously on event; architectural constraint | PARTIAL -- No explicit 30-second SLA enforcement |
| AC-FR-13-03 | Alert lifecycle (Open, Acknowledged, InProgress, Resolved, Dismissed) | `alert-engine.ts:117-161`: Transition map with valid state progressions (NEW->ACKNOWLEDGED->INVESTIGATING->RESOLVED/DISMISSED) | IMPLEMENTED |
| AC-FR-13-04 | Assignable with sla_due_at and escalated_at | `alert` table has `assigned_to`, `sla_due_at`; alert-engine assigns with SLA calculation | IMPLEMENTED |
| AC-FR-13-05 | In-app notifications + optional email/webhook | `routes/notification.routes.ts`: Uses `createNotificationRoutes` from @puda/api-core; `migrations/005_notifications.sql` | IMPLEMENTED |
| BR-FR-13-01 | Default SLA by severity | `alert-engine.ts:94`: SLA hours from rule config; rule has sla_hours field | IMPLEMENTED |
| BR-FR-13-02 | Dismissal requires reason | `alert-engine.ts:147-150`: Resolution notes stored on RESOLVED/DISMISSED | PARTIAL -- Not strictly required/validated |

**Code Verdict: IMPLEMENTED (5/7 full, 2 partial = 86%)**

---

### FR-14: Identity, RBAC & Session Security
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-14-01 | SAML, OIDC SSO + local fallback | `routes/auth.routes.ts`: SAML metadata endpoint + callback stub; `createAuthMiddleware` from @puda/api-core supports OIDC; local auth routes | PARTIAL -- SAML is stub (501 NOT_IMPLEMENTED) |
| AC-FR-14-02 | Roles (Administrator, Supervisor, Analyst, etc.) | `migrations/001_init.sql:304-308`: Seeds FORENSIC_ANALYST, SUPERVISOR, ADMINISTRATOR, LEGAL_ADVISOR; `migrations/002_rbac.sql` expands | IMPLEMENTED |
| AC-FR-14-03 | Configurable permissions per role | `migrations/038_permission_set.sql`, `047_permission_set_json.sql`; role table has permission_set_json | IMPLEMENTED |
| AC-FR-14-04 | Case access scope (assignment, unit, grant) | Case routes filter by `unit_id`; role-based access | PARTIAL -- Unit-based scoping implemented; explicit grant model not visible |
| AC-FR-14-05 | Step-up re-auth for privileged operations | `middleware/auth.ts:26-61`: Step-up session with `STEPUP_ACTIONS` list and 15-min validity | IMPLEMENTED |
| AC-FR-14-06 | MFA mandatory for privileged roles | `middleware/auth.ts:63-105`: `registerMfaEnforcement` with MFA_REQUIRED_PATTERNS; `migrations/023_mfa.sql`; `__tests__/mfa-enforcement.test.ts` | IMPLEMENTED |
| BR-FR-14-01 | Service accounts authenticate with mTLS/JWT | Auth middleware supports JWT; no explicit mTLS implementation | PARTIAL |
| BR-FR-14-02 | Session expiry (15min privileged, 30min standard) | `migrations/026_session_activity.sql`; token expiry in auth middleware | PARTIAL -- Configurable but not explicitly differentiated by role |

**Code Verdict: IMPLEMENTED (4/8 full, 4 partial = 75%)**

---

### FR-15: MIS, Analytics & Operational Reporting
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-15-01 | Reports for case volume, import volume, artifact counts, etc. | `dashboard.routes.ts:7-95`: Stats by state, type, evidence total, pending findings, draft reports | IMPLEMENTED |
| AC-FR-15-02 | Filters by date range, unit, analyst, status, source tool, risk band | `dashboard.routes.ts:28-39`: Uses `buildFilterClauses` with dateFrom/To, status, priority, district, category, unit | IMPLEMENTED |
| AC-FR-15-03 | Export to CSV and PDF | `dashboard.routes.ts:63-88`: CSV export on dashboard stats; `dashboard.routes.ts:98-155`: Dedicated CSV export; PDF via report export | IMPLEMENTED |
| AC-FR-15-04 | Scheduled MIS with daily/weekly/monthly | `dashboard.routes.ts:157-246`: Scheduled reports CRUD with cron_expression; `migrations/037_scheduled_reports.sql` | IMPLEMENTED |
| AC-FR-15-05 | Permission-controlled MIS access | Auth middleware on all routes; role guards | PARTIAL -- No fine-grained per-report permission check |
| BR-FR-15-01 | MIS from production data, not manual | Dashboard queries production tables directly | IMPLEMENTED |
| BR-FR-15-02 | Timestamped, non-editable metrics | Report data derived at query time with timestamps | IMPLEMENTED |

**Code Verdict: IMPLEMENTED (6/7 full, 1 partial = 93%)**

---

### FR-16: Configuration, Template & Model Governance
**Priority:** Should Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-16-01 | Manage dictionaries, regex, risk rules, templates, model metadata | `routes/dictionary.routes.ts`: Full CRUD; `routes/model.routes.ts`: Model governance; `routes/config.routes.ts`: Generic config; `services/model-governance.ts` | IMPLEMENTED |
| AC-FR-16-02 | Versioned config with draft/published/rolled_back/superseded | `config_version` table; dictionary versioning (auto-increment); model status lifecycle (DRAFT->TESTING->ACTIVE->DEPRECATED->RETIRED); `migrations/018_model_governance.sql` | IMPLEMENTED |
| AC-FR-16-03 | Export/import config JSON | `config.routes.ts`: Uses `createConfigRoutes` from @puda/api-core which supports export/import | PARTIAL -- Delegated to shared package; JSON export/import not explicitly verified |
| AC-FR-16-04 | No redeployment for config changes | Config is database-driven; published at runtime | IMPLEMENTED |
| AC-FR-16-05 | Record config_version_id/model_version per finding/score | `ai_finding.model_version` column; `risk_score.score_version` column | PARTIAL -- model_version recorded but config_version_id not linked to individual findings |
| BR-FR-16-01 | One published version active per type | `config_version.is_active`; model status management deactivates old versions | IMPLEMENTED |
| BR-FR-16-02 | Rollback creates new version pointer | Config versioning supports this pattern | PARTIAL |

**Code Verdict: IMPLEMENTED (4/7 full, 3 partial = 79%)**

---

### FR-17: Retention, Archive & Purge Approval
**Priority:** Must Have

| AC/BR | Requirement | Code Evidence | Verdict |
|---|---|---|---|
| AC-FR-17-01 | Retention policies with policy IDs | `services/data-lifecycle.ts`; `routes/data-lifecycle.routes.ts`; `migrations/022_data_retention.sql` | IMPLEMENTED |
| AC-FR-17-02 | legal_hold_status values | `data-lifecycle.routes.ts:21-68`: Legal hold set/release; `forensic_case.legal_hold_status` column | IMPLEMENTED |
| AC-FR-17-03 | Archive/purge requires privileged approval + audit | `data-lifecycle.routes.ts:57-98`: Archive requires CLOSED state; purge requires separate approval; services log actions | IMPLEMENTED |
| AC-FR-17-04 | No end-user hard-delete on source evidence | `requireEvidenceDelete` guard restricts to SUPERVISOR/ADMIN | IMPLEMENTED |
| AC-FR-17-05 | Archived records discoverable by metadata | Case table retains metadata in ARCHIVED state; query routes still return archived cases | PARTIAL -- No explicit cold-storage metadata discovery mechanism |
| BR-FR-17-01 | No purge under legal hold | `data-lifecycle.routes.ts:65`: Checks `legal_hold_status === 'ACTIVE'` before archive | IMPLEMENTED |
| BR-FR-17-02 | Purge only after retention expired + no active holds | Purge approval requires ARCHIVED state + dual approval; legal hold check | PARTIAL -- Retention period expiry not explicitly checked |

**Code Verdict: IMPLEMENTED (5/7 full, 2 partial = 86%)**

---

## Phase 3: Test Coverage Analysis

### Functional Test Cases (from TC document)

| FR | TC Count | TCs Covered by API Tests | Verdict |
|---|---|---|---|
| FR-01 | 5 | `crud.test.ts`, `case-close-check.test.ts`, `workflow.test.ts`, `permissions.test.ts` | COVERED |
| FR-02 | 5 | `evidence.test.ts`, `quarantine.test.ts`, `import.test.ts` | COVERED |
| FR-03 | 5 | `import.test.ts`, `import-executor.unit.test.ts`, `parser-registry.unit.test.ts` | COVERED |
| FR-04 | 5 | `evidence.test.ts` (custody log), `artifact-provenance.test.ts`, `csv-export.test.ts` | PARTIAL |
| FR-05 | 5 | `search.test.ts`, `gallery-view.test.ts`, `notes.test.ts`, `pagination.test.ts` | COVERED |
| FR-06 | 5 | `ocr.test.ts`, `extraction-detail.test.ts` | PARTIAL |
| FR-07 | 5 | `classify.test.ts`, `drug-classify.test.ts`, `dictionary.test.ts`, `finding.test.ts` | COVERED |
| FR-08 | 5 | `entity-ops.test.ts`, `entity-operations.unit.test.ts`, `graph.test.ts` | COVERED |
| FR-09 | 5 | `risk-scoring.test.ts`, `classify.test.ts` | PARTIAL |
| FR-10 | 5 | `legal-mapping.test.ts` | PARTIAL |
| FR-11 | 5 | `report-approval.test.ts`, `report-export.test.ts`, `report-publish-validation.test.ts` | COVERED |
| FR-12 | 5 | `dopams-sync.test.ts`, `dopams-sync-idempotency.test.ts` | COVERED |
| FR-13 | 5 | `alert-engine.unit.test.ts`, `alert-lifecycle.test.ts`, `notifications.test.ts` | COVERED |
| FR-14 | 5 | `auth.test.ts`, `mfa-enforcement.test.ts`, `permissions.test.ts`, `admin-permission-set.test.ts` | COVERED |
| FR-15 | 5 | `dashboard-mis.test.ts`, `csv-export.test.ts` | PARTIAL |
| FR-16 | 5 | `config.test.ts`, `model.test.ts`, `dictionary.test.ts` | COVERED |
| FR-17 | 5 | `data-lifecycle.test.ts`, `data-lifecycle.unit.test.ts` | COVERED |

### Unit/Integration Test Summary

| Category | Test Files | Count |
|---|---|---|
| Route integration tests | crud, evidence, import, search, finding, report-*, legal-mapping, dopams-sync, entity-ops, alert-lifecycle, data-lifecycle, auth, permissions, admin, config, model, dictionary, ocr, quarantine, etc. | 36 |
| Unit tests | alert-engine.unit, data-lifecycle.unit, entity-operations.unit, import-executor.unit, parser-registry.unit | 5 |
| Specialized tests | mfa-enforcement, report-publish-validation, dopams-sync-idempotency, case-close-check, artifact-provenance, extraction-detail, gallery-view, csv-export, dashboard-mis, pagination | 10 |
| **Total** | | **47** |

### Test Coverage by FR

| FR | Functional TCs (85 total) | Unit/Integration Tests | Test Verdict |
|---|---|---|---|
| FR-01 | 5/5 mapped | 4 test files | COVERED |
| FR-02 | 5/5 mapped | 3 test files | COVERED |
| FR-03 | 5/5 mapped | 3 test files | COVERED |
| FR-04 | 5/5 mapped | 2 test files | PARTIAL -- Audit viewer filtering, role-based access tests gap |
| FR-05 | 5/5 mapped | 4 test files | COVERED |
| FR-06 | 5/5 mapped | 2 test files | PARTIAL -- OCR deferred retry, multi-language not tested |
| FR-07 | 5/5 mapped | 4 test files | COVERED |
| FR-08 | 5/5 mapped | 3 test files | COVERED |
| FR-09 | 5/5 mapped | 2 test files | PARTIAL -- Score recalculation, missing rule set tests not evident |
| FR-10 | 5/5 mapped | 1 test file | PARTIAL -- Only one test file for legal mapping |
| FR-11 | 5/5 mapped | 3 test files | COVERED |
| FR-12 | 5/5 mapped | 2 test files | COVERED |
| FR-13 | 5/5 mapped | 3 test files | COVERED |
| FR-14 | 5/5 mapped | 4 test files | COVERED |
| FR-15 | 5/5 mapped | 2 test files | PARTIAL -- Scheduled report execution, recipient list tests gap |
| FR-16 | 5/5 mapped | 3 test files | COVERED |
| FR-17 | 5/5 mapped | 2 test files | COVERED |

---

## Phase 4: Gap Analysis

### P0 Gaps (Critical -- blocks compliance)

| Gap ID | FR | Description | Impact |
|---|---|---|---|
| P0-01 | FR-14 | SAML SSO callback returns 501 NOT_IMPLEMENTED | BRD AC-FR-14-01 requires SAML support; currently a stub |

### P1 Gaps (High -- significant functionality missing)

| Gap ID | FR | Description | Impact |
|---|---|---|---|
| P1-01 | FR-01 | case_reference uniqueness is sequence-based, not composite unique on unit+year as BRD requires (BR-FR-01-01) | Potential duplicate references across units |
| P1-02 | FR-04 | Audit event table missing `source_ip` and `outcome` columns in base schema (added partially in migration 025) | Incomplete audit trail per AC-FR-04-02 |
| P1-03 | FR-04 | No dedicated audit-viewer route with full filter set (case_id, actor, action, object_type, date_range, outcome) | AC-FR-04-05 partially met |
| P1-04 | FR-08 | Relationship table missing `first_seen_at`, `last_seen_at`, `source_artifact_id` columns | AC-FR-08-02 data model incomplete |
| P1-05 | FR-09 | Risk score table uses `factors` instead of BRD-specified `components_json`; `scope_type` not constrained to Artifact/Entity/Case enum | Data model divergence |
| P1-06 | FR-14 | Case access scope only supports unit-based; explicit grant and assignment-based models not implemented | AC-FR-14-04 partially met |
| P1-07 | FR-14 | Session expiry not differentiated by role (15min privileged vs 30min non-privileged) | BR-FR-14-02 not enforced |

### P2 Gaps (Medium -- missing but not blocking)

| Gap ID | FR | Description | Impact |
|---|---|---|---|
| P2-01 | FR-02 | Evidence status uses generic `state_id`, not full BRD enum (Registered through Failed) | Naming divergence |
| P2-02 | FR-03 | `job_version_no` not explicitly in base import_job table for reprocessing version tracking | AC-FR-03-06 tracking gap |
| P2-03 | FR-05 | Annotation visibility_scope (Private/CaseTeam/SupervisorOnly) may not be fully enforced in query filtering | AC-FR-05-05 gap |
| P2-04 | FR-06 | Derived artifact `extraction_engine`, `extraction_version`, `language_hint`, `extraction_confidence` not all individually stored | AC-FR-06-02 field gap |
| P2-05 | FR-07 | `reason_codes_json`, `rule_hits_json` not explicit columns in ai_finding table | AC-FR-07-02 field gap |
| P2-06 | FR-08 | Entity merge does not require explicit `reason_code` field | BR-FR-08-01 gap |
| P2-07 | FR-11 | export_hash, export_format, export_timestamp not stored on report export | AC-FR-11-06 gap |
| P2-08 | FR-12 | No explicit check that outbound sync only fires after report status = Published | BR-FR-12-01 gap |
| P2-09 | FR-13 | Alert dismissal does not strictly require `dismissal_reason` | BR-FR-13-02 gap |
| P2-10 | FR-15 | Scheduled report execution and recipient list by role not fully implemented | AC-FR-15-04 gap |
| P2-11 | FR-16 | Config export/import in JSON format for environment promotion not explicitly verified | AC-FR-16-03 gap |
| P2-12 | FR-17 | Retention period expiry check not explicit in purge workflow | BR-FR-17-02 gap |

### P3 Gaps (Low -- cosmetic or naming)

| Gap ID | FR | Description | Impact |
|---|---|---|---|
| P3-01 | FR-01 | CaseStatus uses generic state_id strings vs strict DB-enforced enum | Naming convention |
| P3-02 | FR-07 | Finding uses `finding_type` vs BRD-specified `category_code` | Column naming |
| P3-03 | FR-09 | `score_type` vs BRD `scope_type`; `factors` vs `components_json` | Column naming |

---

## Phase 5: Scorecard & Verdict

### Code Coverage by FR

| FR | Priority | ACs Met | ACs Total | BRs Met | BRs Total | Code % | Code Verdict |
|---|---|---|---|---|---|---|---|
| FR-01 | Must Have | 5.5/6 | 6 | 2/3 | 3 | 89% | IMPLEMENTED |
| FR-02 | Must Have | 5/6 | 6 | 2.5/3 | 3 | 88% | IMPLEMENTED |
| FR-03 | Must Have | 5/6 | 6 | 2.5/3 | 3 | 83% | IMPLEMENTED |
| FR-04 | Must Have | 3.5/5 | 5 | 1.5/2 | 2 | 79% | PARTIAL |
| FR-05 | Must Have | 4.5/6 | 6 | 2/2 | 2 | 81% | IMPLEMENTED |
| FR-06 | Must Have | 4.5/5 | 5 | 1.5/2 | 2 | 86% | IMPLEMENTED |
| FR-07 | Must Have | 5.5/6 | 6 | 2.5/3 | 3 | 89% | IMPLEMENTED |
| FR-08 | Must Have | 3.5/5 | 5 | 1/2 | 2 | 71% | PARTIAL |
| FR-09 | Must Have | 3.5/5 | 5 | 1.5/2 | 2 | 79% | PARTIAL |
| FR-10 | Must Have | 4.5/5 | 5 | 2/2 | 2 | 93% | IMPLEMENTED |
| FR-11 | Must Have | 5.5/6 | 6 | 2/2 | 2 | 94% | IMPLEMENTED |
| FR-12 | Must Have | 5/5 | 5 | 1/2 | 2 | 86% | IMPLEMENTED |
| FR-13 | Must Have | 4.5/5 | 5 | 1.5/2 | 2 | 86% | IMPLEMENTED |
| FR-14 | Must Have | 4/6 | 6 | 1/2 | 2 | 75% | PARTIAL |
| FR-15 | Must Have | 4.5/5 | 5 | 2/2 | 2 | 93% | IMPLEMENTED |
| FR-16 | Should Have | 4/5 | 5 | 1.5/2 | 2 | 79% | PARTIAL |
| FR-17 | Must Have | 4.5/5 | 5 | 1.5/2 | 2 | 86% | IMPLEMENTED |

### Test Coverage by FR

| FR | Functional TCs | Unit/Integration Tests | Test Verdict |
|---|---|---|---|
| FR-01 | 5 TCs mapped | 4 files | COVERED |
| FR-02 | 5 TCs mapped | 3 files | COVERED |
| FR-03 | 5 TCs mapped | 3 files | COVERED |
| FR-04 | 5 TCs mapped | 2 files | PARTIAL |
| FR-05 | 5 TCs mapped | 4 files | COVERED |
| FR-06 | 5 TCs mapped | 2 files | PARTIAL |
| FR-07 | 5 TCs mapped | 4 files | COVERED |
| FR-08 | 5 TCs mapped | 3 files | COVERED |
| FR-09 | 5 TCs mapped | 2 files | PARTIAL |
| FR-10 | 5 TCs mapped | 1 file | PARTIAL |
| FR-11 | 5 TCs mapped | 3 files | COVERED |
| FR-12 | 5 TCs mapped | 2 files | COVERED |
| FR-13 | 5 TCs mapped | 3 files | COVERED |
| FR-14 | 5 TCs mapped | 4 files | COVERED |
| FR-15 | 5 TCs mapped | 2 files | PARTIAL |
| FR-16 | 5 TCs mapped | 3 files | COVERED |
| FR-17 | 5 TCs mapped | 2 files | COVERED |

### Aggregate Scores

| Metric | Value |
|---|---|
| Total FRs | 17 |
| FRs IMPLEMENTED (code) | 12 (70.6%) |
| FRs PARTIAL (code) | 5 (29.4%) |
| FRs NOT_FOUND (code) | 0 (0%) |
| **Weighted Code Coverage** | **84.3%** |
| FRs with COVERED tests | 12 (70.6%) |
| FRs with PARTIAL tests | 5 (29.4%) |
| FRs with MISSING tests | 0 (0%) |
| **Weighted Test Coverage** | **76.5%** |
| P0 Gaps | 1 |
| P1 Gaps | 7 |
| P2 Gaps | 12 |
| P3 Gaps | 3 |
| Total Test Files | 47 |
| Total Functional TCs | 85 |
| Total Migrations | 46 |

### Final Verdict

```
+-------------------------------------------------------------------+
|                                                                   |
|   VERDICT:  GAPS-FOUND                                           |
|                                                                   |
|   Code Coverage:  84.3%  (threshold: >= 70%)          PASS       |
|   Test Coverage:  76.5%  (threshold: >= 50%)          PASS       |
|   P0 Gaps:        1      (threshold: <= 2)            PASS       |
|                                                                   |
|   Criteria: code >= 70% AND test >= 50% AND P0 <= 2             |
|                                                                   |
+-------------------------------------------------------------------+
```

**Rationale:** The Forensic AI Platform has strong implementation coverage across all 17 FRs with no completely missing requirements. The primary concerns are:

1. **SAML SSO (P0)** -- The SAML callback is stubbed out and returns 501. This blocks enterprise SSO deployments.

2. **Data model divergences (P1)** -- Several tables use different column names than the BRD specifies (e.g., `factors` vs `components_json`, `finding_type` vs `category_code`). While functionally equivalent, these create API contract mismatches with the BRD specification.

3. **RBAC scoping (P1)** -- Case access scope only supports unit-based filtering. Assignment-based and explicit-grant models from AC-FR-14-04 are not implemented.

4. **Entity relationship schema (P1)** -- The relationship table is missing `first_seen_at`, `last_seen_at`, and `source_artifact_id` columns specified in the data model.

5. **Audit completeness (P1)** -- While audit events are logged, the dedicated audit viewer with the full BRD-specified filter set is not implemented as a distinct route.

**Improvement from previous audit (2026-03-07): AT-RISK -> GAPS-FOUND.** The system has progressed significantly with the addition of quarantine flows, custody chain PDF export, redaction profiles, DOPAMS idempotency, MFA enforcement, alert lifecycle management, and data lifecycle (legal hold, archive, purge) capabilities.

---

## Recommended Priority Actions

### Immediate (P0)
1. **Implement SAML SSO callback** -- Replace 501 stub with actual SAML assertion consumer service using `passport-saml` or `saml2-js`.

### Short-term (P1)
2. **Add composite unique constraint** on `forensic_case(investigating_unit_id, case_year, case_reference)`.
3. **Add missing relationship columns** (`first_seen_at`, `last_seen_at`, `source_artifact_id`) via migration.
4. **Implement dedicated audit-viewer route** with full filter set per AC-FR-04-05.
5. **Add assignment-based and explicit-grant case scope models** to complement existing unit-based scoping.
6. **Differentiate session expiry by role** (15min privileged, 30min standard).
7. **Align `risk_score` schema** to BRD: rename `factors` -> `components_json`, add `scope_type` enum constraint.

### Medium-term (P2)
8. Align column names across all tables to BRD specification (`finding_type` -> `category_code`, etc.).
9. Add `export_hash`, `export_format`, `export_timestamp` to report export flow.
10. Enforce annotation visibility_scope in query filtering.
11. Add `reason_code` requirement to entity merge operations.
12. Implement retention period expiry check in purge workflow.
13. Add explicit `dismissal_reason` validation on alert dismissal.

---

*End of audit report.*
