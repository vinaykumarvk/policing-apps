# Refined BRD - DOPAMS Implementation Specification

**Prepared From:**
- Source A: Tender Notice TGTSL-ADCS/CS/Eagle Force/2026-DOPMAS dated 28 Feb 2026 (Tender - DOPAMS.pdf)
- Source B: BRD - DOPAMS (BRD - DOPAMS.pdf)

**Document Purpose:** Transform the supplied BRD into an implementation-ready specification that is traceable to the tender/RFP, measurable, testable, and usable by backend, frontend, API, database, workflow-engine, and AI-assisted development teams.

**Traceability Convention:** The tender text is narrative and partially tabular. Stable RFP clause IDs have therefore been assigned in this document (for example, `RFP-P1-03`, `RFP-TECH-02`) so that every clause can be traced to implementation artefacts, tests, and governance controls.

---

## 1. Executive Summary

### 1.1 Business Objective
DOPAMS shall be an on-prem AI intelligence platform for EAGLE Force Telangana that consolidates criminal, telecom, financial, legal, grievance, and monitored digital-content data into a single operational system for narcotics intelligence, investigation support, document generation, alerts, and auditability. The platform shall replace fragmented manual workflows with a controlled, evidence-backed, and human-review-driven operating model.

### 1.2 System Goals
- Build a canonical subject intelligence record using the Department-approved 54-column business schema plus normalized supporting entities.
- Ingest structured and unstructured data from all approved Phase 1 sources and preserve originals with chain-of-custody controls.
- Generate governed outputs such as interrogation reports, technical analysis reports, memos, requisitions, and MIS reports with full source lineage.
- Provide search, dossier, network analysis, geofence alerts, lead management, and risk-based prioritization.
- Ensure every AI-assisted output is explainable, reviewable, and produced only on Department-controlled infrastructure.

### 1.3 Expected ROI / Target Operating Outcomes
- Reduce manual subject-history collation effort by 60% to 80%, subject to baseline validation during inception.
- Reduce initial interrogation report draft preparation from hours to minutes for data-rich cases.
- Reduce Monthly Report consolidation from multi-day manual compilation to same-day automated aggregation with exception-based review.
- Improve legal-status freshness through scheduled court monitoring and traceable update workflows.
- Achieve 100% digital audit trail coverage for evidence access, approval actions, exports, and lead routing.

### 1.4 Strategic Alignment
- Supports statewide narcotics intelligence modernization and cross-district visibility.
- Preserves data sovereignty through on-prem deployment and open-source model use only.
- Standardizes legally sensitive outputs through fixed templates, named approvals, and evidence citation.
- Creates a platform foundation for future optional connectors and AI-assisted analysis under Department control.

## 2. Scope Definition

### 2.1 In Scope
| Scope ID | In-Scope Item |
| --- | --- |
| SCP-IS-001 | Provide an on-prem responsive web platform for DOPAMS on Department-controlled infrastructure. |
| SCP-IS-002 | Implement role-based and jurisdiction-aware access control with named-user approvals and immutable audit logging. |
| SCP-IS-003 | Implement source connectors and ingestion pipelines for all Phase 1 sources listed in the RFP. |
| SCP-IS-004 | Implement OCR, NLP extraction, bilingual review workflow, and provenance storage for Telugu and English documents. |
| SCP-IS-005 | Implement the canonical 54-column subject profile and related case/evidence entities. |
| SCP-IS-006 | Implement Monthly Report ingestion, 20-KPI extraction, central aggregation, dashboards, and exports. |
| SCP-IS-007 | Implement E-Courts monitoring and legal status update workflow. |
| SCP-IS-008 | Implement financial intelligence cross-check rules and Unocross draft generation with approval controls. |
| SCP-IS-009 | Implement fixed-template interrogation report generation with manual completion workflow. |
| SCP-IS-010 | Implement search, transliteration-aware matching, dossier generation, and subject deduplication/merge controls. |
| SCP-IS-011 | Implement deep link analysis, tower dump processing, technical analysis reports, and geofence/watchlist alerts. |
| SCP-IS-012 | Implement AI-driven content categorization, risk scoring, and legal section mapping with human review. |
| SCP-IS-013 | Implement grievance intake, memo routing, alerting, escalation, and workflow SLA management. |
| SCP-IS-014 | Implement reporting, MIS, scheduled exports, and admin-configurable templates/rules/master data. |
| SCP-IS-015 | Implement model governance, validation tracking, and approved on-prem LLM inference only. |
| SCP-IS-016 | Implement optional connector framework for Phase 3 systems, disabled by default until approved. |
| SCP-IS-017 | Deliver deployment artifacts, environment prerequisites, training materials, support runbooks, and handover pack. |

### 2.2 Out of Scope
| Scope ID | Out-of-Scope Item |
| --- | --- |
| SCP-OOS-001 | Public cloud hosting of application data, model inference, or evidence storage. |
| SCP-OOS-002 | Use of public LLM APIs, public inference endpoints, or third-party hosted foundation models. |
| SCP-OOS-003 | Citizen-facing public portal or public mobile application in initial release. |
| SCP-OOS-004 | Autonomous legal classification, legal section finalization, or enforcement action without named human approval. |
| SCP-OOS-005 | Automated external transmission to financial/legal authorities without approver sign-off. |
| SCP-OOS-006 | Modification or replacement of source systems of record such as CCTNS, C-DAT, or E-Courts. |
| SCP-OOS-007 | Procurement of hardware or network appliances unless separately approved. |
| SCP-OOS-008 | Phase 3 live connector activation before legal approval, credentials, and source availability are confirmed. |
| SCP-OOS-009 | Biometric face search unless TS-COP/CCTNS integration and legal approval are explicitly granted. |
| SCP-OOS-010 | Covert collection from non-approved private accounts, devices, or channels; only lawfully obtained data is in scope. |

### 2.3 Assumptions
| Assumption ID | Assumption |
| --- | --- |
| ASM-001 | Department will provide lawful access, credentials, network whitelisting, and sample data for each approved source system. |
| ASM-002 | Department will confirm the final 54-column dictionary and the 20 KPI dictionary before UAT sign-off. |
| ASM-003 | Department will approve final templates for interrogation reports, lead memos, and requisition drafts. |
| ASM-004 | Department will nominate business owners for legal review, data quality review, and model approval. |
| ASM-005 | Google Drive may be replaced by an approved equivalent storage bridge if required by Department policy. |
| ASM-006 | OCR quality depends on source scan quality; low-confidence outputs will be routed to manual review. |
| ASM-007 | Internet egress, if needed for E-Courts or approved cloud storage sync, will be explicitly allow-listed. |
| ASM-008 | Biometric search will remain feature-flagged until legal approval and connector readiness are confirmed. |
| ASM-009 | Cross-platform monitoring will only use public or lawfully obtained content and approved departmental sources. |
| ASM-010 | Initial model training data will include the Department-provided 50 ideal FIRs and approved benchmark datasets. |
| ASM-011 | Department will provide geofence coordinates, watchlist governance rules, and target classification criteria. |
| ASM-012 | Environment readiness (servers, OS, DB, object storage, search, network) is a prerequisite for installation. |

### 2.4 Constraints
| Constraint ID | Constraint |
| --- | --- |
| CNS-REG-001 | All data processing, storage, model inference, and model training must occur on Department-controlled infrastructure in India. |
| CNS-REG-002 | Sensitive fields such as Aadhaar, PAN, bank details, passport/visa details, and chat evidence must be masked for unauthorized roles. |
| CNS-REG-003 | Every external draft, memo, or legal section suggestion must undergo named human approval before final use. |
| CNS-INF-001 | Reference environments shall include Development, Test/UAT, and Production at minimum. |
| CNS-INF-002 | System shall support PostgreSQL, object storage, search index, workflow workers, and optional GPU inference nodes. |
| CNS-INF-003 | All integrations shall tolerate intermittent source downtime and recover without corrupting data. |
| CNS-SEC-001 | All APIs and browser sessions shall use TLS 1.2 or higher. |
| CNS-SEC-002 | At-rest encryption shall use AES-256 or Department-approved equivalent for DB, object storage, and backups. |
| CNS-SEC-003 | Application shall maintain immutable audit logs for create/update/approve/export/dispatch actions. |
| CNS-PER-001 | Core user flows shall meet the performance baselines defined in Section 8. |
| CNS-DEL-001 | The solution must satisfy the contractual delivery baseline of 6 weeks from purchase order plus 1 week installation, subject to a documented dependency plan. |
| CNS-DEL-002 | No public APIs or outbound AI service calls are permitted. |

## 3. Stakeholders & Roles

### 3.1 Permission Level Definitions
| Permission Level | Label | Definition |
| --- | --- | --- |
| PL-0 | Read only | May view permitted records and dashboards within jurisdiction; cannot create, edit, approve, export sensitive artifacts, or administer configuration. |
| PL-1 | Operator | May create/update intake records, upload documents, review extractions, and save drafts within jurisdiction. |
| PL-2 | Analyst | Includes PL-1 plus advanced search, dossier, graph, and report generation over permitted data. |
| PL-3 | Approver | Includes PL-2 plus approve/reject/finalize/dispatch actions for governed outputs. |
| PL-4 | Business Admin | Includes PL-3 plus manage templates, routing rules, master data, KPI dictionaries, and feature flags. |
| PL-5 | Platform Admin | Includes PL-4 plus user provisioning, security settings, infra health, connector credentials, backups, and system maintenance. |

### 3.2 Role Catalogue
| Role ID | Role Name | Description | System Permissions Level |
| --- | --- | --- | --- |
| ROL-001 | Department Sponsor / Program Owner | Owns budget, priorities, acceptance, and executive governance. | PL-3 |
| ROL-002 | HQ Administrator | Manages statewide configuration, report definitions, templates, routing, and jurisdiction rules. | PL-4 |
| ROL-003 | District Operator | Uploads documents, validates extracted data, completes missing fields, and raises leads. | PL-1 |
| ROL-004 | Investigating Officer | Uses subject profiles, interrogation reports, technical reports, and linked evidence for investigation. | PL-2 |
| ROL-005 | Supervisory Officer / SP / Zonal Officer | Approves memos, requisitions, dispatches, escalations, and district actions. | PL-3 |
| ROL-006 | Intelligence Analyst | Performs search, risk review, link analysis, role classification review, and trend analysis. | PL-2 |
| ROL-007 | Legal Reviewer | Validates legal section mapping, legal status updates, and final legal document consistency. | PL-3 |
| ROL-008 | Toll-Free / WhatsApp Operator | Captures grievance and lead intake through controlled data-entry screens. | PL-1 |
| ROL-009 | Read-Only Auditor | Reviews logs, reports, actions, and evidence access history without edit capability. | PL-0 |
| ROL-010 | Department IT / Security Team | Approves hosting, security controls, network boundaries, secrets handling, and log access. | PL-5 |
| ROL-011 | System Administrator / DevOps | Maintains on-prem infrastructure, application health, backups, and releases. | PL-5 |
| ROL-012 | Integration Service Account | Non-human identity used for connector jobs and service-to-service integration. | PL-5 |
| ROL-013 | Model Governance Reviewer | Approves model versions, validation metrics, and production promotion of AI artifacts. | PL-3 |
| ROL-014 | Bidder Support Engineer | Provides implementation, hypercare, maintenance, and issue resolution under controlled access. | PL-2 |

## 4. Functional Requirements

Each functional requirement below is written as a testable implementation contract. All governed outputs are human-review-driven unless explicitly stated otherwise.

### FR-01 - Identity, access control, approvals, and audit
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-TECH-07, RFP-BIZ-07, RFP-TECH-01

**Description:** The platform shall enforce named-user authentication, role-based and jurisdiction-aware authorization, approval controls for governed outputs, and immutable audit logging across UI, API, export, and dispatch actions.

**User Stories**
- As an authorized Department user, I want access limited to my role and jurisdiction so that sensitive records are visible only to the correct officers.
- As a supervisory officer, I want named-user approval before sensitive outputs are finalized so that accountability is preserved.

**Acceptance Criteria (Testable)**
- AC-01: System shall support at minimum the roles defined in Section 3 and enforce permissions server-side for UI actions, APIs, exports, downloads, and searches.
- AC-02: Every user shall have a jurisdiction scope of STATE, ZONE, DISTRICT, and optionally POLICE_STATION; record visibility shall be filtered accordingly unless an explicit override permission exists.
- AC-03: Approval-required artifacts (memo, requisition, final interrogation report, legal section mapping finalization, template activation, model promotion) shall require a named approver and digital audit entry before final status change.
- AC-04: Sessions shall support Department SSO/LDAP/AD where available, configurable inactivity timeout, configurable password policy for local fallback accounts, and optional MFA.
- AC-05: Audit logs shall capture actor, role, timestamp, source IP/device where available, action, target entity, before/after snapshot for mutable fields, and correlation ID.

**Business Rules**
- BR-01: Authorization failures shall be denied by default and logged as security events.
- BR-02: Shared operational accounts shall be prohibited for approval actions.
- BR-03: Sensitive field export requires both permission and a business justification code.

**Edge Cases**
- Suspended users attempting to continue with an active session must be forced to re-authenticate and be denied further access.
- Cross-jurisdiction search may show redacted stubs if the user has intelligence lookup permission but not full-record permission.

**Failure Handling**
- If the identity provider is unavailable, only break-glass local admin accounts approved by the Department may log in; all such access must be specially logged.
- If audit-log persistence is unavailable, the platform shall block approval/finalization actions until logging is restored.

### FR-02 - Source connectors and ingestion orchestration
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-03, RFP-P1-04, RFP-TECH-01

**Description:** The platform shall ingest data and documents from approved source systems through scheduled, manual, or event-driven connector pipelines, while preserving source provenance and processing history.

**User Stories**
- As the platform, I want to ingest records from multiple sources and formats so that downstream intelligence modules can operate without manual re-entry.

**Acceptance Criteria (Testable)**
- AC-01: System shall support approved ingestion from CCTNS, C-DAT, CDR, IPDR, FIR repositories, Confession cum Seizure Memos, IR repositories, C-Trace, eSakshya, and Google Drive or an approved equivalent storage bridge.
- AC-02: Supported inbound payloads shall include PDF, JPG/JPEG, PNG, TIFF, DOCX, XLSX, CSV, JSON, XML, and ZIP archives with checksum validation.
- AC-03: Each ingestion job shall persist job_id, source_system, source_record_key, checksum, received_at, processing_started_at, completed_at, retry_count, status, error_code, and correlation_id.
- AC-04: Connector retries shall default to 3 attempts with exponential backoff of 5 minutes, 15 minutes, and 60 minutes, after which the job shall move to a failure queue for administrator review.
- AC-05: Original documents and raw payloads shall be written to immutable evidence storage before transformation.

**Business Rules**
- BR-01: A duplicate raw payload identified by identical source_system plus checksum plus source_record_key shall not be processed twice unless a manual reprocess flag is set.
- BR-02: Connector-specific credentials shall be stored only in approved secrets storage and never in business tables.
- BR-03: Optional Phase 3 connectors shall remain disabled by default via feature flags.

**Edge Cases**
- Large files exceeding configured limits shall be quarantined with a user-visible validation error and admin alert.
- Partial source payloads missing mandatory metadata shall be stored but marked INCOMPLETE_SOURCE for review.

**Failure Handling**
- A failed connector shall not block unrelated connectors or manual uploads.
- When object storage write fails, the job shall terminate in FAILED state and no derived processing shall begin.

### FR-03 - OCR, extraction, and bilingual review workflow
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-13, RFP-P1-11, RFP-TECH-02

**Description:** The platform shall extract structured data from Telugu and English documents using OCR/NLP pipelines and route uncertain outputs to human review with field-level provenance.

**User Stories**
- As a district operator, I want the system to extract fields from FIRs, Panchanamas, memos, and supporting documents so that manual data entry is minimized.

**Acceptance Criteria (Testable)**
- AC-01: System shall perform Telugu and English OCR on scanned documents and preserve page-level text, image region references, and extraction confidence values.
- AC-02: Each extracted field shall store source document ID, page number, bounding box or text span when available, machine value, reviewer value, confidence score, and extraction version.
- AC-03: Default confidence handling shall be configurable and seeded as: >=0.90 auto-accept candidate, 0.60-0.89 review required, <0.60 reject/manual entry required.
- AC-04: Review UI shall display source document and extracted fields side-by-side and allow reviewer accept/correct/reject actions per field.
- AC-05: Manual reviewer edits shall create a new versioned assertion and shall not overwrite prior machine or human values without history.

**Business Rules**
- BR-01: Mandatory fields for governed templates may not be marked complete unless a reviewer accepts a value or explicitly records NOT_AVAILABLE with reason code.
- BR-02: OCR language detection shall default to bilingual mode when the language is uncertain.
- BR-03: Extraction pipelines shall use schema-bound outputs only; free-text hallucinated fields are prohibited.

**Edge Cases**
- Mixed Telugu-English documents shall support field extraction from both scripts in the same document.
- Low-resolution image pages shall still be stored as evidence even if OCR fails.

**Failure Handling**
- If OCR engine fails for a page, the job shall continue for other pages and flag PAGE_OCR_FAILED for review.
- If extraction schema validation fails, the output shall be rejected and the job routed to technical review.

### FR-04 - Canonical 54-column subject history builder
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-01, RFP-P1-02, RFP-P2-08

**Description:** The platform shall build and maintain a canonical subject profile by combining structured and unstructured evidence from approved sources into the Department-approved 54-column schema plus supporting relational entities.

**User Stories**
- As an investigating officer, I want a unified subject profile so that I can understand identity, crime history, legal status, technical links, and intelligence context in one place.

**Acceptance Criteria (Testable)**
- AC-01: System shall maintain one canonical subject profile per resolved person/entity cluster and persist the 54-column business schema defined in Section 5.1.
- AC-02: Every profile field value shall maintain provenance, confidence, source trust ranking, status (AUTO_PROPOSED, REVIEWED, APPROVED, CONFLICTING, NOT_AVAILABLE), and effective timestamp.
- AC-03: Duplicate subject resolution shall apply exact-identifier matching first, then fuzzy match scoring on name, alias, phone, address, and relationship signals; auto-link threshold shall be configurable.
- AC-04: Profiles shall display completeness score, unresolved conflicts count, latest update timestamp, and profile version history.
- AC-05: Subject photos from CCTNS or approved sources shall be stored as evidence references and linked to the profile when permitted.

**Business Rules**
- BR-01: A lower-confidence or lower-trust source value shall not automatically replace an approved higher-trust value.
- BR-02: Conflicting values shall be stored as separate assertions until reviewer resolution.
- BR-03: Merge operations shall preserve source lineage for all inherited assertions.

**Edge Cases**
- Different subjects sharing a phone number or address shall remain separately resolvable when other identifiers differ.
- Subjects without exact identifiers shall still be creatable as provisional profiles with a dedupe review flag.

**Failure Handling**
- If match scoring service is unavailable, new evidence shall be attached to a provisional subject and queued for merge review.
- If profile publication fails after approval, the approved version shall remain recoverable from the workflow transaction log.

### FR-05 - Monthly Report ingestion and KPI consolidation
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-05, RFP-P1-06, RFP-P1-07, RFP-TECH-06

**Description:** The platform shall detect district Monthly Reports, extract the approved KPI set, and consolidate final values into central reporting stores with traceable review history.

**User Stories**
- As HQ staff, I want district monthly reports parsed automatically so that statewide statistics do not require manual aggregation.

**Acceptance Criteria (Testable)**
- AC-01: System shall poll or receive events from a configured folder/source and detect new or modified MR files by checksum and metadata.
- AC-02: System shall extract the Department-approved 20 KPI parameters and persist both machine-parsed and reviewer-approved values.
- AC-03: A district plus reporting_month combination shall have at most one FINAL approved KPI record; re-uploads shall create a new version and supersede the prior final only after review.
- AC-04: Low-confidence, missing, or format-invalid KPI values shall route the report to REVIEW_REQUIRED state with field-level issue codes.
- AC-05: Final approved KPI values shall be available to dashboards, exports, and scheduled MIS reports within 5 minutes of approval.

**Business Rules**
- BR-01: KPI dictionary entries shall define metric_id, label, data type, allowed range/pattern, aggregation rule, and source note.
- BR-02: Reports without district and reporting month metadata shall not finalize.
- BR-03: Reviewer corrections shall require reason codes when they differ from machine values.

**Edge Cases**
- Multi-district combined reports must be rejected unless explicitly allowed by configuration.
- Scanned MR documents with embedded tables may require manual confirmation for table extraction.

**Failure Handling**
- If storage sync fails, the last successful watermark shall be preserved and retry scheduled.
- If KPI publication to reporting mart fails, the approved KPI record shall remain stored and an admin alert shall be raised.

### FR-06 - E-Courts legal status monitoring
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-08

**Description:** The platform shall periodically search approved court sources for judgments, bail orders, and legal status changes and update subject/case records through a controlled review workflow.

**User Stories**
- As a legal reviewer, I want case outcomes and bail orders to update subject records so that legal status stays current.

**Acceptance Criteria (Testable)**
- AC-01: System shall search E-Courts using configured keys such as case number, accused name, court name, year, and district context.
- AC-02: Open or monitored cases shall be re-checked on a configurable schedule, seeded at once every 24 hours.
- AC-03: Exact or high-confidence matches above configured threshold shall generate a proposed legal update with order metadata and evidence attachment.
- AC-04: Ambiguous matches shall route to manual legal review and shall never auto-apply legal status changes.
- AC-05: Prior legal statuses shall remain historically queryable and compare-able after new status application.

**Business Rules**
- BR-01: Status changes shall store order type, order date, court details, source URL/reference, retrieval timestamp, and parser version.
- BR-02: If multiple later orders exist, the newest legally effective order shall be proposed as current while preserving older orders.
- BR-03: Monitoring must stop only when case closure rule configured by Department is satisfied.

**Edge Cases**
- Name-only matches with multiple accused candidates must not auto-link.
- Unavailable court pages due to captcha/network controls must be logged as SOURCE_UNAVAILABLE rather than interpreted as no update.

**Failure Handling**
- If retrieval fails repeatedly beyond threshold, monitored case shall generate a stale-status alert.
- If parser fails on a retrieved order, the raw document shall still be stored and assigned for review.

### FR-07 - Financial intelligence cross-check and Unocross draft generation
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-09, RFP-P1-10

**Description:** The platform shall correlate transaction-linked phone/account data with telecom identities, evaluate configurable trigger rules, and generate approval-controlled requisition drafts for additional bank data.

**User Stories**
- As an intelligence analyst, I want repetitive transaction patterns to trigger a requisition draft so that likely supplier and peddler relationships can be escalated quickly.

**Acceptance Criteria (Testable)**
- AC-01: System shall normalize transaction identifiers, account references, UPI IDs, and phone numbers before matching against subject, telecom, and device data.
- AC-02: Rule engine shall support configurable thresholds for recurrence count, time window, amount, subject/counterparty recurrence, and telecom match confidence.
- AC-03: When rule conditions are met, the system shall create a pre-filled Unocross draft containing case references, suspected parties, linked numbers, trigger explanation, and supporting evidence summary.
- AC-04: Drafts shall follow workflow states DRAFTED, REVIEW_PENDING, APPROVED, REJECTED, DISPATCHED, EXPIRED and require named approver sign-off before export or send.
- AC-05: Approved drafts shall be exportable as PDF and email-ready text and shall preserve the exact trigger snapshot used at approval time.

**Business Rules**
- BR-01: Partial evidence without sufficient telecom linkage may create an analyst review task but shall not auto-generate a formal draft.
- BR-02: Duplicate triggers for the same subject/counterparty pair inside suppression window shall update the existing draft record instead of creating a new one.
- BR-03: Trigger rules are configuration data and require admin approval before activation.

**Edge Cases**
- Transactions involving shared family accounts may create false positives and therefore require evidence explanation and reviewer confirmation.
- Bulk imported bank statements spanning multiple months may trigger several candidate pairs in one job.

**Failure Handling**
- If financial data ingestion succeeds but telecom matching fails, the system shall preserve unmatched evidence and mark MATCH_PENDING.
- If PDF generation fails for an approved draft, users shall still be able to retrieve email-ready text and see the failure log.

### FR-08 - Fixed-template interrogation report generation
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-11, RFP-P1-12, RFP-P1-13

**Description:** The platform shall generate interrogation reports using Department-approved templates, populated from primary and supplementary sources, with explicit manual completion and approval controls.

**User Stories**
- As a district operator, I want the system to populate a mandatory interrogation report template so that consistent legally usable reports can be produced quickly across districts.

**Acceptance Criteria (Testable)**
- AC-01: System shall ingest FIR as the primary source and supplement with Panchanama, CCTNS, CDR, IPDR, Confession/Seizure Memo, IR, C-Trace, and eSakshya data where available.
- AC-02: Template versions shall be centrally managed and only ACTIVE versions may be used for new report generation.
- AC-03: Missing mandatory template fields shall be presented in a structured form with validation and status codes before finalization.
- AC-04: Final reports shall be exportable as PDF and, where permitted by role, editable DOCX while preserving template version and source lineage metadata.
- AC-05: Finalization shall require review completion and named approver sign-off when configured by jurisdiction.

**Business Rules**
- BR-01: Generated narrative sections must be grounded in cited source evidence and must not invent facts.
- BR-02: Template schema changes shall not retroactively alter previously finalized reports.
- BR-03: Users without finalization permission may save drafts only.

**Edge Cases**
- Cases with missing FIR metadata must remain in DRAFT state until minimum case identifiers are supplied.
- Multiple supplementary documents with conflicting facts must be flagged for reviewer resolution.

**Failure Handling**
- If document merge/export fails, the report draft and all populated fields shall remain recoverable.
- If required template package is unavailable, report generation shall be blocked with CONFIGURATION_ERROR.

### FR-09 - Unified search, transliteration-aware matching, and one-click dossier
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-01, RFP-P2-08

**Description:** The platform shall provide a unified search experience across identities, cases, phones, vehicles, and approved biometrics and shall generate a consolidated dossier view for a selected subject.

**User Stories**
- As an analyst, I want to search by multiple identifiers and get an instant dossier so that I can assess a subject quickly.

**Acceptance Criteria (Testable)**
- AC-01: Search shall support full name, alias, surname, phone number, crime number, Aadhaar, PAN, vehicle identifier, document ID, and biometric face match where approved integration exists.
- AC-02: Search shall support fuzzy matching, transliteration-aware Telugu/English matching, and ranking reasons for each result candidate.
- AC-03: One-click dossier shall include identity summary, case history, role/status, legal status, documents, alerts, associates, and latest intelligence indicators where available.
- AC-04: Dossier export shall be role-restricted, watermarked, and auditable.
- AC-05: Users shall be able to launch link analysis, technical analysis, or report generation directly from the dossier when permitted.

**Business Rules**
- BR-01: Exact identifier matches rank above fuzzy matches.
- BR-02: Face-match search shall remain hidden when connector or approval flag is disabled.
- BR-03: Masked identifiers shall remain masked in search results unless role permits full view.

**Edge Cases**
- Very common names shall return paginated results with district filters and match explanations.
- Aliases with phonetic variations across Telugu and English shall be searchable using transliteration rules.

**Failure Handling**
- If search index is unavailable, system shall fall back to DB search for basic identifiers with a user-visible performance warning.
- If dossier assembly cannot reach one enrichment source, partial dossier shall still render with unavailable-section markers.

### FR-10 - Natural-language query and insight assistant
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-TECH-03, RFP-TECH-02

**Description:** The platform shall provide an on-prem natural-language assistant for grounded search, summarization, and analytic insight over approved datasets.

**User Stories**
- As an authorized officer, I want to ask the platform questions in plain language so that I can retrieve intelligence quickly without manually building filters.

**Acceptance Criteria (Testable)**
- AC-01: Assistant shall accept natural-language questions and translate them into approved retrieval or analytics operations over permitted data only.
- AC-02: Every answer shall include cited source references, applied filters or time window, and an explanation of whether the output is summary, count, trend, or recommendation.
- AC-03: Assistant shall run only on approved on-prem open-source models and shall not call public inference APIs.
- AC-04: Users shall be able to convert an answer into a saved search, report draft, or dashboard filter where applicable.
- AC-05: Prompt and response metadata, including model version and token counts, shall be logged for governance without exposing sensitive content to unauthorized roles.

**Business Rules**
- BR-01: The assistant must refuse actions outside user permissions and respond with a controlled access message.
- BR-02: Unsupported facts shall be returned as 'insufficient evidence' rather than hallucinated conclusions.
- BR-03: AI-generated recommendations are advisory only and require human interpretation.

**Edge Cases**
- Queries mixing English and Telugu terms shall still resolve using multilingual retrieval.
- Ambiguous date ranges such as 'recent' shall default to the last 30 days unless the user specifies otherwise or saved filters override.

**Failure Handling**
- If AI service is unavailable, the UI shall surface fallback structured search shortcuts.
- If cited sources cannot be produced, the assistant answer shall not be displayed as final.

### FR-11 - n-level link analysis and kingpin discovery
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-02

**Description:** The platform shall perform iterative multi-hop link analysis over communication, financial, co-case, and co-location evidence to identify bridge nodes and potential hidden suppliers.

**User Stories**
- As an intelligence analyst, I want multi-level contact analysis so that hidden supplier or kingpin nodes can be identified beyond direct contacts.

**Acceptance Criteria (Testable)**
- AC-01: System shall support configurable graph depth from 1 to 5, default 3, and reject requests above the configured cap.
- AC-02: Analysis shall rank common nodes, bridge nodes, and high-centrality nodes using configurable scoring factors such as call frequency, duration, cross-seed convergence, and recency.
- AC-03: Graph jobs shall run asynchronously and expose status, progress, completion time, and result retention metadata.
- AC-04: Graph UI shall explain why each key node is ranked using evidence counts and factor breakdown.
- AC-05: Users shall be able to filter by date range, source, duration threshold, jurisdiction, and subject/case context.

**Business Rules**
- BR-01: Result sets must record the exact data window and source set used for reproducibility.
- BR-02: Deleted or legally held evidence shall not be physically removed from historic graph result provenance; only access shall be restricted.
- BR-03: Graph exports shall include legend, scoring basis, and watermark.

**Edge Cases**
- A subject may appear through multiple node types (person, phone, device, account); UI shall present linkage clearly.
- Very large graphs may require auto-pruning of low-weight edges for visualization while retaining full exportable tables.

**Failure Handling**
- If graph store is unavailable, queued jobs shall remain pending and the user shall see a retriable technical error.
- If a source subset cannot be reached, results shall display partial-data disclaimer rather than silent omission.

### FR-12 - Automated technical analysis report
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-03

**Description:** The platform shall generate a technical analysis report for a selected number or subject using CDR/CDAT/LBS data and configured analytics rules.

**User Stories**
- As an investigating officer, I want a technical analysis report for a suspect number so that movement, contact, and device patterns can be reviewed quickly.

**Acceptance Criteria (Testable)**
- AC-01: System shall generate PDF reports containing route maps, stay locations, top 10 contacts, duration patterns, IMEI history, and silence or switch-off patterns when source data exists.
- AC-02: Home and office inference shall use configurable dwell-time and time-of-day rules and label results as inferred rather than confirmed facts.
- AC-03: Every chart, map, and section shall display the source data range, generation timestamp, and report version.
- AC-04: Missing data sections shall render 'Data unavailable' explicitly rather than blank content.
- AC-05: Users shall be able to regenerate the report for a different time window without altering historic versions.

**Business Rules**
- BR-01: Report sections derived from inference must carry a confidence label.
- BR-02: Top contact ranking criteria shall be configurable and stored with the report version.
- BR-03: LBS access must be role-restricted.

**Edge Cases**
- Subjects using multiple devices or SIM swaps shall show segmented history rather than one flattened timeline.
- Location data with poor accuracy shall be labeled low confidence.

**Failure Handling**
- If map tile service is unavailable on the intranet, the report shall still generate table-based location summaries.
- If one analytic sub-component fails, remaining sections shall render with section-level error notes.

### FR-13 - Geo-fencing and watchlist alerts
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-04, RFP-BIZ-07

**Description:** The platform shall monitor watchlisted subjects or numbers against configured geofences and create actionable alerts with acknowledgement and escalation controls.

**User Stories**
- As a supervisory officer, I want geofenced alerts for high-value targets so that field teams can be informed when watchlisted subjects enter sensitive zones.

**Acceptance Criteria (Testable)**
- AC-01: System shall maintain a watchlist with an initial operational target of 50 high-value subjects and support priority tiers.
- AC-02: System shall support predefined geofences for Goa, Bengaluru, Mumbai, and Orissa Agency plus Department-defined custom zones with geospatial polygons.
- AC-03: Entry, exit, and dwell events shall generate alerts with subject reference, event time, source, geofence, severity, and recommended action.
- AC-04: Duplicate alerts within a configurable suppression window, seeded at 30 minutes, shall be suppressed or merged.
- AC-05: Alerts shall support ACKNOWLEDGED, ASSIGNED, ESCALATED, RESOLVED, CLOSED, and FALSE_POSITIVE statuses.

**Business Rules**
- BR-01: Only approved high-value watchlist items may generate real-time alerting.
- BR-02: Severity shall be derived from watchlist priority, geofence sensitivity, and recency of prior alerts.
- BR-03: Escalation timers shall be configurable by severity.

**Edge Cases**
- Repeated oscillation across a zone boundary shall not spam duplicate alerts because suppression or merge logic must apply.
- Source location accuracy below configured threshold shall reduce severity or create a review alert instead of direct field escalation.

**Failure Handling**
- If real-time feed is delayed, the alert shall be marked LATE_EVENT and still stored for audit.
- If geofence computation service is unavailable, incoming events shall queue for retry.

### FR-14 - Tower dump analytics and rank ordering
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-05

**Description:** The platform shall process tower dump datasets, normalize telecom identifiers, and rank candidate numbers by criminal or crime-link strength.

**User Stories**
- As an analyst, I want tower dump numbers ranked by offender and crime link strength so that priority suspects can be identified faster.

**Acceptance Criteria (Testable)**
- AC-01: System shall accept approved bulk tower dump formats and validate file structure before processing.
- AC-02: Imported numbers shall be normalized to canonical format and matched against subject, case, device, and prior event stores.
- AC-03: Output shall rank results in descending order using configurable criminal-link and crime-link scoring factors and show factor breakdown.
- AC-04: Tower dump jobs shall run asynchronously with progress visibility and downloadable result tables.
- AC-05: Results shall be retained with source file hash, processing version, and query parameters for audit.

**Business Rules**
- BR-01: Numbers failing normalization shall be retained in an exception report and excluded from ranking.
- BR-02: Ranking formulas are configuration artifacts and require admin approval before changes.
- BR-03: Large jobs may chunk processing but final ranking must be deterministic.

**Edge Cases**
- The same number may appear across multiple source towers and time windows; ranking shall account for recurrence.
- International format numbers and missing country codes must normalize consistently.

**Failure Handling**
- If worker capacity is exceeded, jobs shall queue rather than fail immediately.
- If ranking stage fails after normalization, normalized data shall be preserved for reprocessing.

### FR-15 - Drug offender role classification and pattern analysis
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-06, RFP-P2-07, RFP-P2-08, RFP-BIZ-03

**Description:** The platform shall classify suspects into controlled offender roles using Department-provided training examples, extraction rules, and supporting evidence from multi-source data.

**User Stories**
- As an analyst, I want the system to classify suspect roles from case facts so that investigators can prioritize actions using consistent patterns.

**Acceptance Criteria (Testable)**
- AC-01: System shall support roles Cultivator, Manufacturer, Supplier, Peddler, Transporter, Consumer, Mediator, and Financier.
- AC-02: Model or rule pipeline shall be tuned using the Department-provided 50 ideal FIRs plus approved extraction rules and benchmarked before promotion.
- AC-03: Each classification shall return role label, confidence, supporting evidence snippets, source references, and model/rule version.
- AC-04: Low-confidence or conflicting classifications shall route to manual review rather than auto-finalize.
- AC-05: Classification shall support natural, synthetic, and semi-synthetic drug contexts under Department-approved NDPS taxonomy.

**Business Rules**
- BR-01: Classification may recommend multiple candidate roles but only approved final role(s) shall appear as active profile roles.
- BR-02: The system must preserve historical role decisions and reasons when updated.
- BR-03: Benchmark thresholds are governed by model governance in FR-26.

**Edge Cases**
- One subject may act as both transporter and peddler across cases; model output must allow multi-role history.
- Confession facts may conflict with FIR facts and require reviewer adjudication.

**Failure Handling**
- If the model version falls below approved benchmark, production must revert to manual-only or rule-only mode.
- If training dataset ingestion fails, no model promotion may proceed.

### FR-16 - Public grievance and lead management
**Priority:** Should Have  
**Target Release:** R2  
**RFP Traceability:** RFP-P2-09, RFP-P2-10, RFP-BIZ-07

**Description:** The platform shall capture public grievances and operational leads in a controlled interface, enrich them with known context, generate official memos, and route them through approval and action workflows.

**User Stories**
- As a toll-free or WhatsApp operator, I want to enter complaint details directly into the system so that leads are stored centrally and routed formally.

**Acceptance Criteria (Testable)**
- AC-01: Lead entry shall capture at minimum informant name, contact/channel, location, suspect details, nature of information, urgency, free-text notes, and optional attachments.
- AC-02: On submit, system shall create a permanent lead record with timestamps, source channel, submitting user, and jurisdiction derivation.
- AC-03: Duplicate detection shall warn the user when similar leads exist using location, suspect, contact, and recency signals; user may override with justification.
- AC-04: System shall generate an official memo using approved template and available DOPAMS context, then route it to the relevant Zonal Officer/SP based on routing rules.
- AC-05: Lead statuses shall support NEW, VALIDATED, MEMO_GENERATED, APPROVAL_PENDING, ROUTED, IN_ACTION, CLOSED, and REJECTED.

**Business Rules**
- BR-01: Submitted leads cannot be hard-deleted by standard users.
- BR-02: Routing rules must be configuration-driven and auditable.
- BR-03: Critical urgency leads shall trigger immediate alerting under FR-24.

**Edge Cases**
- Anonymous leads may omit informant name but must carry ANONYMOUS flag and channel metadata.
- Leads spanning multiple districts shall support primary and secondary jurisdiction routing.

**Failure Handling**
- If memo generation fails, the lead shall remain created and route to manual memo preparation queue.
- If routing target cannot be resolved, the item shall route to HQ fallback queue.

### FR-17 - MIS dashboards and automated reporting
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-07, RFP-TECH-06, RFP-TECH-08

**Description:** The platform shall provide dashboards, analytics, and scheduled reports over central data for operational, management, and audit use.

**User Stories**
- As HQ leadership, I want automated dashboards and reports so that Department performance and trends can be monitored without manual compilation.

**Acceptance Criteria (Testable)**
- AC-01: System shall provide charts, graphs, maps, tabular analytics, and statistical reports over approved subject, case, MR, lead, alert, and workflow datasets.
- AC-02: Reports shall support filtering by date range, district, police station, drug type, role, source, status, and watchlist where applicable.
- AC-03: Scheduled reports shall support PDF and XLSX exports and delivery to approved internal shared storage or email relay.
- AC-04: Simple report layout changes, column order changes, and filter parameter changes shall be configurable by admins without code changes.
- AC-05: Dashboards shall display data freshness timestamps and anomaly markers when anomaly rules are enabled.

**Business Rules**
- BR-01: Reports containing masked fields must preserve masking in exports unless the requesting role has explicit permission.
- BR-02: Department-defined MIS templates shall be versioned and approval-controlled.
- BR-03: Scheduled distribution lists must use named groups approved by HQ Admin.

**Edge Cases**
- Empty result sets shall still generate valid reports with 'No data for selected filters'.
- Very large XLSX exports shall stream in chunks and provide completion notification.

**Failure Handling**
- If export generation fails, the job shall be retriable and the user shall see status/error details.
- If reporting mart refresh is delayed, dashboards shall show stale-data warning.

### FR-18 - Optional external connector framework
**Priority:** Nice to Have  
**Target Release:** R3  
**RFP Traceability:** RFP-P1-04

**Description:** The platform shall provide a pluggable connector framework for optional future systems without redesigning the core data model.

**User Stories**
- As the Department, I want optional external integrations to be pluggable so that the platform can expand when data access is approved.

**Acceptance Criteria (Testable)**
- AC-01: System shall support connector registration metadata including auth type, mapping profile, sync mode, and feature flag state.
- AC-02: New connector payloads shall map to the canonical entity model through configurable transformation profiles.
- AC-03: Connector failures shall not block core application workflows or existing source jobs.
- AC-04: Each connector shall be independently enable-able, disable-able, and auditable by admin users.
- AC-05: Connector-specific data shall be traceable to its source for review and unmapping if required.

**Business Rules**
- BR-01: Optional connectors remain disabled until legal approval, credentials, and mappings are signed off.
- BR-02: Canonical entity contracts may not be broken by connector-specific custom fields; extensions must use extension tables/json fields with schema governance.

**Edge Cases**
- A connector may be approved for read-only batch mode but not API mode.
- Different state systems may provide overlapping identifiers with inconsistent formats.

**Failure Handling**
- If a connector schema changes unexpectedly, inbound jobs shall be quarantined rather than silently dropped.
- If credentials expire, connector status shall move to DISABLED_WITH_ERROR and notify admins.

### FR-19 - Cross-platform monitoring and monitored content ingestion
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-BIZ-02, RFP-BIZ-01

**Description:** The platform shall ingest approved monitored content from public or lawfully obtained online sources and normalize it as intelligence content items for analysis, categorization, and evidence preservation.

**User Stories**
- As an intelligence operator, I want monitored online/public content to enter DOPAMS in a structured way so that digital promotion and coordination signals can be reviewed centrally.

**Acceptance Criteria (Testable)**
- AC-01: System shall support monitored content intake from approved URLs, platform exports, screenshots, documents, or API feeds as permitted by the Department.
- AC-02: Each content item shall capture platform, channel or handle, capture time, collector/source, raw content reference, language, media presence, and dedupe key.
- AC-03: Content items shall be routed through categorization, risk scoring, and evidence preservation workflows.
- AC-04: Duplicate or near-duplicate content shall be clustered using configured text/hash similarity rules.
- AC-05: Content visibility shall be role-restricted and follow the same audit controls as other evidence items.

**Business Rules**
- BR-01: Only approved lawful collection methods may be used; content from prohibited/private sources is out of scope unless separately authorized.
- BR-02: Content capture metadata must include who or which connector collected the content and when.
- BR-03: Content deletes from source platforms do not remove preserved evidence copies once lawfully ingested.

**Edge Cases**
- Content may include mixed media and multilingual text requiring separate extraction passes.
- The same message may appear in both screenshot and text export form and must cluster as one evidentiary item.

**Failure Handling**
- If source content cannot be re-fetched later, the preserved captured version shall still remain reviewable.
- If media extraction fails, textual metadata shall still be stored and the item marked PARTIAL_MEDIA.

### FR-20 - AI-based content categorization, risk scoring, and prioritization
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-BIZ-03, RFP-BIZ-04, RFP-TECH-03

**Description:** The platform shall classify monitored content, leads, and selected subject events into controlled categories and compute configurable risk scores used for prioritization queues and alerts.

**User Stories**
- As an analyst, I want content and events prioritized by explainable risk score so that the highest-value items are reviewed first.

**Acceptance Criteria (Testable)**
- AC-01: System shall assign each monitored content item and eligible lead/event a category from an approved taxonomy including at minimum DRUG_SALE_SIGNAL, COORDINATION_SIGNAL, LOGISTICS_SIGNAL, FINANCIAL_SIGNAL, RECRUITMENT_SIGNAL, BENIGN, and UNKNOWN.
- AC-02: System shall calculate a risk score from 0 to 100 using configurable weighted factors such as source credibility, recency, repeated entities, keyword patterns, linked offenders, geofence relevance, and prior alert history.
- AC-03: Score responses shall include factor contribution breakdown, model/rule version, confidence, and reviewer override fields.
- AC-04: Items above configured thresholds shall enter PRIORITY_REVIEW or CRITICAL_ALERT queues according to workflow rules.
- AC-05: Users with review permission shall be able to override category and score with mandatory reason code.

**Business Rules**
- BR-01: Scoring formulas and weights are governed configuration artifacts and require admin approval before production use.
- BR-02: No score may directly trigger an external legal action without human approval.
- BR-03: Historical scores shall remain versioned even when configuration changes.

**Edge Cases**
- A benign content item linked to a high-risk watchlisted subject may still receive elevated priority due to relationship factors.
- Items with low model confidence shall still receive category UNKNOWN and route for manual review.

**Failure Handling**
- If scoring service is unavailable, affected items shall enter UNSCORED_REVIEW queue rather than be silently deprioritized.
- If factor data is partially missing, scoring shall proceed only if minimum factor coverage is met; otherwise mark INSUFFICIENT_DATA.

### FR-21 - Legal section mapping and reviewer confirmation
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-BIZ-05, RFP-P1-01, RFP-P1-11

**Description:** The platform shall propose candidate legal sections from extracted facts and entity context, while requiring legal or supervisory review before final application.

**User Stories**
- As a legal reviewer, I want candidate legal sections suggested from case facts so that drafting is faster but still controlled.

**Acceptance Criteria (Testable)**
- AC-01: System shall generate candidate legal sections based on extracted facts, offense patterns, controlled vocabularies, and Department-approved legal mapping rules.
- AC-02: Each suggestion shall include rationale text, supporting evidence snippets, source references, and confidence or rule strength.
- AC-03: Users shall be able to accept, reject, or modify candidate sections and record justification.
- AC-04: Final accepted sections shall update case/profile records and governed document drafts with full audit trail.
- AC-05: Legal mapping rules shall be versioned, effective-dated, and rollback-capable.

**Business Rules**
- BR-01: The system may suggest but shall never silently auto-finalize legal sections in official outputs.
- BR-02: Section suggestions must cite source evidence; uncited suggestions are invalid.
- BR-03: Multiple sections may be active for one case when justified.

**Edge Cases**
- Facts may support multiple section combinations across NDPS and allied laws.
- Conflicting facts from different documents may generate conflicting section suggestions that require review.

**Failure Handling**
- If legal mapping engine is unavailable, manual legal section entry shall remain possible and auditable.
- If the current active legal mapping ruleset is missing, finalization shall be blocked with CONFIGURATION_ERROR.

### FR-22 - Digital evidence preservation and chain-of-custody
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-BIZ-06, RFP-P1-03

**Description:** The platform shall preserve original and derived evidence with integrity controls, legal hold, retention, and complete chain-of-custody history.

**User Stories**
- As a reviewer or auditor, I want every evidence artifact to retain integrity and access history so that evidentiary trust is maintained.

**Acceptance Criteria (Testable)**
- AC-01: Every stored original file and every exported governed artifact shall have a SHA-256 hash recorded at creation time.
- AC-02: System shall maintain chain-of-custody events for ingest, access, download, export, approval, dispatch, legal hold, restore, and archive actions.
- AC-03: Evidence shall support legal hold flagging that prevents purge or archival deletion until released by authorized role.
- AC-04: Retrieval API shall support integrity verification by recalculating and comparing stored hash values on demand.
- AC-05: Evidence access and export shall be watermarkable, role-restricted, and fully auditable.

**Business Rules**
- BR-01: Standard users may not permanently delete evidence artifacts.
- BR-02: Derived artifacts must reference their parent evidence set and generation parameters.
- BR-03: Retention policies shall be configurable by evidence type and legal hold status.

**Edge Cases**
- The same file ingested through two channels shall preserve both provenance records while sharing binary storage only if hashes match and policy allows dedup.
- Evidence attached to multiple cases must retain all case links.

**Failure Handling**
- If hash verification fails, the artifact shall be quarantined and a critical security alert shall be raised.
- If legal hold service is unavailable, purge jobs shall suspend execution.

### FR-23 - Template, master data, and rules administration
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-12, RFP-TECH-08, RFP-TECH-06

**Description:** The platform shall allow authorized administrators to manage templates, KPI dictionaries, routing rules, geofences, legal mapping rules, and scoring weights without code changes for simple configuration updates.

**User Stories**
- As an HQ administrator, I want to update templates and rules centrally so that districts use the latest approved configuration without software redeployment.

**Acceptance Criteria (Testable)**
- AC-01: Admin UI shall manage templates, KPI definitions, routing rules, alert thresholds, geofences, risk scoring weights, and master data enumerations.
- AC-02: Config changes shall support draft, review, approve, activate, deactivate, and rollback states with effective dates.
- AC-03: Each active configuration item shall expose version number, activation timestamp, approver, and change reason.
- AC-04: Config updates for simple metadata/rules shall take effect without application redeployment.
- AC-05: Historic reports and decisions shall remain linked to the version active at their execution time.

**Business Rules**
- BR-01: Only PL-4 or higher users may create or activate governed configuration changes.
- BR-02: Activation of legal, scoring, or workflow rules requires two-step approval if Department policy enables maker-checker mode.
- BR-03: Deleted master data values must remain visible for historic records but unavailable for new records.

**Edge Cases**
- A template may be active statewide but temporarily overridden for one district only if allowed by policy.
- Geofence boundaries may overlap; rule priority must be explicit.

**Failure Handling**
- If configuration cache refresh fails, the prior active version shall remain in effect.
- If activation results in validation errors, the new version shall not go live.

### FR-24 - Notifications, escalation, and SLA management
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-BIZ-07, RFP-P2-10

**Description:** The platform shall support workflow notifications, reminder timers, escalation rules, and SLA tracking for alerts, reviews, approvals, and lead routing.

**User Stories**
- As an operations supervisor, I want overdue items escalated automatically so that critical intelligence actions are not missed.

**Acceptance Criteria (Testable)**
- AC-01: System shall support event-triggered notifications for new alerts, review-required documents, approval tasks, failed connectors, and critical leads.
- AC-02: SLA timers shall be configurable by workflow type and severity and shall track due_at, acknowledged_at, escalated_at, and closed_at timestamps.
- AC-03: Escalation rules shall support hierarchical escalation to supervisory officers or HQ fallback queues after configurable timeout.
- AC-04: Notification channels shall include in-app notifications and Department-approved email relay; additional channels may be enabled by configuration.
- AC-05: Users shall be able to acknowledge, assign, snooze within policy, or close tasks with reason codes.

**Business Rules**
- BR-01: Critical alerts may not be snoozed by operator-level users.
- BR-02: Escalation must preserve the original assignee and escalation trail.
- BR-03: Closed tasks require closure code and acting user.

**Edge Cases**
- An item may change severity after enrichment, requiring timer recalculation.
- One event may notify multiple roles but only one primary owner should be accountable.

**Failure Handling**
- If email relay is unavailable, in-app notifications shall still be created and the failure logged.
- If scheduler service is delayed, overdue calculations shall catch up on recovery.

### FR-25 - Subject deduplication, merge, and survivorship management
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P1-02, RFP-P2-08

**Description:** The platform shall manage duplicate subject candidates and provide controlled merge operations with field survivorship, lineage preservation, and conflict auditability.

**User Stories**
- As a reviewer, I want to merge duplicate subject profiles safely so that intelligence is not fragmented across multiple records.

**Acceptance Criteria (Testable)**
- AC-01: System shall generate duplicate candidate queues using configurable match rules and thresholds.
- AC-02: Merge review UI shall compare candidate profiles side-by-side with field-level provenance and recommended survivorship.
- AC-03: Final merge shall produce a single surviving subject_id plus alias mappings and redirect links from merged IDs.
- AC-04: Merge operations shall be fully auditable and reversible only by authorized admin through a controlled restoration workflow.
- AC-05: Post-merge, all linked cases, documents, alerts, and graph nodes shall resolve to the surviving subject while retaining historic source IDs.

**Business Rules**
- BR-01: Exact government identifier conflicts require manual review and cannot auto-merge.
- BR-02: Survivorship defaults shall favor highest trust, latest reviewed, and most complete values, in that order unless admin overrides apply.
- BR-03: Unmerge is an exceptional administrative action and must preserve full history.

**Edge Cases**
- One subject may legitimately share address, bank account, or family phone with others; these alone cannot force merge.
- Previously merged records may later require split due to misidentification.

**Failure Handling**
- If downstream re-linking fails during merge, transaction shall roll back or complete through resumable compensating job with audit trail.
- If search index update fails post-merge, canonical DB state shall remain source of truth and index rebuild queued.

### FR-26 - Model governance, training, validation, and deployment management
**Priority:** Must Have  
**Target Release:** R1  
**RFP Traceability:** RFP-P2-07, RFP-TECH-02, RFP-TECH-03

**Description:** The platform shall manage AI model versions, training datasets, prompts, validation results, production approvals, and rollback decisions for all ML and LLM-assisted features.

**User Stories**
- As a model governance reviewer, I want model versions and validation evidence tracked so that only approved models run in production.

**Acceptance Criteria (Testable)**
- AC-01: System shall register every model, prompt template, extraction schema, and ruleset version used in production or testing.
- AC-02: Training and benchmark metadata shall record dataset identifiers, sample counts, evaluation metrics, run date, reviewer, and approval status.
- AC-03: Only APPROVED model or prompt versions may be used by production workflows.
- AC-04: The platform shall support rollback to a prior approved version without redeploying the entire application.
- AC-05: If benchmark thresholds are not met, the associated feature shall switch to manual-review or rule-only mode according to configuration.

**Business Rules**
- BR-01: Production promotion requires named approver and stored evaluation artifact.
- BR-02: Prompts for governed outputs must use schema-constrained responses and evidence citation instructions.
- BR-03: Model artifacts and datasets shall remain on Department-controlled infrastructure only.

**Edge Cases**
- One feature may use multiple sub-models such as OCR, classifier, reranker, and summarizer; each must be versioned independently.
- Prompt-only changes without model changes are still governance-controlled versions.

**Failure Handling**
- If a newly promoted model produces operational failures above threshold, automatic rollback or manual rollback procedure shall be available.
- If validation artifact storage fails, approval cannot be completed.


## 5. Data Model Requirements

### 5.1 Canonical 54-Column Subject Profile Schema

**Implementation note:** The 54-column view is the mandated business output. The physical database should normalize repeated structures such as gang associates, documents, phones, bank accounts, and social media references into child tables or JSON sub-schemas, then expose the 54-column view through an API projection or database view for reporting and interoperability.

| Entity | Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ENT-SUBJ | district | Operational or case jurisdiction district | varchar(100) | Y | Must map to active district master value | CCTNS/FIR/MR/Lead | RFP-P1-01 |
| ENT-SUBJ | police_station | Police station linked to case or subject context | varchar(150) | N | Must map to police station master when present | CCTNS/FIR | RFP-P1-01 |
| ENT-SUBJ | crime_number | Crime number / case reference | varchar(50) | N | Pattern configurable by district/year; unique within police_station+year when case-linked | CCTNS/FIR | RFP-P1-01 |
| ENT-SUBJ | section_of_law | Applicable legal sections | text[] | N | Each value must exist in active legal section master | FIR/Legal review | RFP-BIZ-05 |
| ENT-SUBJ | name | Subject full name | varchar(200) | N | Unicode; trim extra whitespace | FIR/CCTNS/IR/Lead | RFP-P1-01 |
| ENT-SUBJ | aliases | Known aliases and alternate spellings | text[] | N | Max 50 aliases; duplicate values not allowed | CCTNS/FIR/IR/OSINT | RFP-P2-01 |
| ENT-SUBJ | father_name | Father or guardian name | varchar(200) | N | Unicode | FIR/CCTNS/IR | RFP-P1-01 |
| ENT-SUBJ | dob | Date of birth | date | N | Cannot be in future | CCTNS/ID docs | RFP-P1-01 |
| ENT-SUBJ | age | Age when DOB unavailable | integer | N | 0-120 | FIR/CCTNS/IR | RFP-P1-01 |
| ENT-SUBJ | nationality | Nationality | varchar(100) | N | Must map to nationality master where configured | Passport/CCTNS/FIR | RFP-P1-01 |
| ENT-SUBJ | occupation | Occupation or profession | varchar(150) | N | Free text limited to 150 chars or occupation master | FIR/IR | RFP-P1-01 |
| ENT-SUBJ | residential_address | Current residential address | text | N | Store raw plus normalized form | FIR/CCTNS/Lead | RFP-P1-01 |
| ENT-SUBJ | native_or_permanent_address | Native or permanent address | text | N | Store raw plus normalized form | FIR/IR | RFP-P1-01 |
| ENT-SUBJ | native_state | Native state | varchar(100) | N | State master when present | FIR/IR | RFP-P1-01 |
| ENT-SUBJ | mobile_numbers | Linked mobile numbers | text[] | N | Normalize to E.164 or national canonical format; duplicates removed | CDR/CDAT/FIR/Lead | RFP-P1-01 |
| ENT-SUBJ | aadhaar_number | Aadhaar number | varchar(12) | N | 12 digits; encrypted at rest and masked in UI | ID docs/CCTNS | RFP-P1-01 |
| ENT-SUBJ | pan_number | PAN number | varchar(10) | N | Regex [A-Z]{5}[0-9]{4}[A-Z]; encrypted and masked | ID docs/Financial docs | RFP-P1-01 |
| ENT-SUBJ | ration_card_number | Ration card reference | varchar(50) | N | Alphanumeric pattern configurable | ID docs | RFP-P1-01 |
| ENT-SUBJ | vehicle_rc_details | Vehicle RC details | jsonb | N | Validated against vehicle sub-schema | Transport docs/FIR | RFP-P1-01 |
| ENT-SUBJ | driving_license_details | Driving license details | jsonb | N | Validated against DL sub-schema | ID docs/Transport | RFP-P1-01 |
| ENT-SUBJ | identification_marks | Physical identification marks | text | N | Free text up to 2000 chars | CCTNS/IR | RFP-P1-01 |
| ENT-SUBJ | photo_references | Linked photo evidence references | text[] | N | Must reference existing evidence IDs or URIs | CCTNS/evidence | RFP-P1-01 |
| ENT-SUBJ | bank_account_details | Linked bank accounts | jsonb | N | Validated against account sub-schema; encrypted fields | Financial docs/Unocross | RFP-P1-01 |
| ENT-SUBJ | transaction_mode | Observed transaction mode | enum(transaction_mode) | N | Allowed values CASH, UPI, BANK_TRANSFER, MIXED, OTHER | Financial docs | RFP-P1-09 |
| ENT-SUBJ | bank_statement_available | Bank statement availability flag | boolean | N | Default false | Financial docs/analyst review | RFP-P1-10 |
| ENT-SUBJ | cdr_status | CDR request/processing status | enum(cdr_status) | Y | Allowed values NOT_REQUESTED, REQUESTED, RECEIVED, PROCESSED, UNAVAILABLE | CDR pipeline | RFP-P1-03 |
| ENT-SUBJ | cdat_links | Links or references to CDAT data | text[] | N | Must reference CDAT artifacts or URLs | CDAT | RFP-P1-03 |
| ENT-SUBJ | dopams_links | Internal related DOPAMS links | text[] | N | Must reference existing internal record IDs | DOPAMS internal | RFP-P1-01 |
| ENT-SUBJ | offender_status | Current offender status | enum(offender_status) | Y | Allowed values ARRESTED, ABSCONDING, DETAINED, UNDER_INQUIRY, UNKNOWN | CCTNS/FIR/legal review | RFP-P1-01 |
| ENT-SUBJ | offender_role | Active and historic offender role(s) | enum(offender_role)[] | N | Allowed values from role master | Classifier/manual review | RFP-P2-06 |
| ENT-SUBJ | drug_procurement_method | Drug procurement method narrative | text | N | Source-cited narrative; max 4000 chars | FIR/Confession/NLP | RFP-P1-01 |
| ENT-SUBJ | drug_delivery_method | Drug delivery method narrative | text | N | Source-cited narrative; max 4000 chars | FIR/Confession/NLP | RFP-P1-01 |
| ENT-SUBJ | pd_act_details | PD Act details | text | N | Free text or structured child table reference | Legal docs | RFP-P1-01 |
| ENT-SUBJ | history_sheet_details | History sheet details | text | N | Free text or structured child table reference | Police records | RFP-P1-01 |
| ENT-SUBJ | fit_for_68f | Eligibility flag for Section 68F-related action | boolean | N | Default false; reviewer controlled | Legal review | RFP-P1-01 |
| ENT-SUBJ | fit_for_pitndps_act | Eligibility flag for PITNDPS-related action | boolean | N | Default false; reviewer controlled | Legal review | RFP-P1-01 |
| ENT-SUBJ | social_media_links | Approved social media URLs/handles | text[] | N | Valid URL/handle format; platform tagged in child table for physical schema | OSINT/monitored content | RFP-BIZ-02 |
| ENT-SUBJ | passport_details | Passport metadata | jsonb | N | Validated against passport sub-schema; encrypted fields | Passport/IVFRT | RFP-P1-04 |
| ENT-SUBJ | visa_details | Visa metadata | jsonb | N | Validated against visa sub-schema; encrypted fields | Passport/IVFRT | RFP-P1-04 |
| ENT-SUBJ | gang_associate_1 | Gang associate reference slot 1 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_2 | Gang associate reference slot 2 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_3 | Gang associate reference slot 3 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_4 | Gang associate reference slot 4 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_5 | Gang associate reference slot 5 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_6 | Gang associate reference slot 6 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_7 | Gang associate reference slot 7 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_8 | Gang associate reference slot 8 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_9 | Gang associate reference slot 9 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_10 | Gang associate reference slot 10 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | gang_associate_11 | Gang associate reference slot 11 | varchar(200) | N | Canonical view only; physical schema normalized to associate child table | Investigation data | RFP-P1-01 |
| ENT-SUBJ | whatsapp_chat_references | WhatsApp chat evidence references | text[] | N | Must reference preserved evidence items | Evidence/approved exports | RFP-P1-01 |
| ENT-SUBJ | social_media_chat_references | Social media chat evidence references | text[] | N | Must reference preserved evidence items | Evidence/approved exports | RFP-P1-01 |
| ENT-SUBJ | source_document_references | Source document/evidence IDs supporting profile | text[] | Y | At least one evidence reference required for approved profile publication | All approved sources | RFP-BIZ-06 |
| ENT-SUBJ | extraction_confidence_score | Aggregate population confidence score | numeric(5,4) | Y | 0.0000-1.0000 | System derived | RFP-P1-02 |

### 5.2 Supporting Entity Schemas
#### ENT-CASE
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| case_id | Canonical case UUID | uuid | Y | Primary key | System | RFP-P1-01 |
| crime_number | Crime number reference | varchar(50) | Y | Unique within police_station+year | CCTNS/FIR | RFP-P1-01 |
| district | District | varchar(100) | Y | District master value | CCTNS/FIR | RFP-P1-01 |
| police_station | Police station | varchar(150) | Y | Police station master value | CCTNS/FIR | RFP-P1-01 |
| sections_of_law | Current sections applied | text[] | N | Legal section master values only | FIR/Legal review | RFP-BIZ-05 |
| case_status | Case lifecycle status | enum(case_status) | Y | OPEN, UNDER_INVESTIGATION, CHARGESHEETED, CLOSED, ARCHIVED | Case workflow | RFP-P1-08 |
| primary_subject_id | Primary linked subject | uuid | N | Foreign key to subject | System | RFP-P2-08 |
| opened_at | Case opened timestamp | timestamptz | N | Cannot be future | CCTNS/FIR | RFP-P1-01 |

#### ENT-DOC
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| document_id | Evidence/document UUID | uuid | Y | Primary key | System | RFP-BIZ-06 |
| source_system | Originating source | enum(source_system) | Y | Must be active source master value | Connector/manual upload | RFP-P1-03 |
| document_type | Document type | enum(document_type) | Y | Must be active document master value | Connector/manual upload | RFP-P1-03 |
| storage_uri | Immutable object storage URI | text | Y | Must resolve to evidence storage path | System | RFP-BIZ-06 |
| checksum_sha256 | SHA-256 hash of stored artifact | char(64) | Y | 64 lowercase hex chars | System | RFP-BIZ-06 |
| language | Detected or declared language | enum(language_code) | N | EN, TE, MIXED, UNKNOWN | System/manual | RFP-P1-13 |
| ingest_job_id | Originating ingest job | uuid | Y | Foreign key to ingest job | System | RFP-P1-03 |
| legal_hold_flag | Legal hold status | boolean | Y | Default false | Legal reviewer | RFP-BIZ-06 |

#### ENT-EXT
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| extraction_id | Extraction row UUID | uuid | Y | Primary key | System | RFP-P1-13 |
| document_id | Parent document | uuid | Y | Foreign key to document | System | RFP-P1-13 |
| field_name | Extracted field name | varchar(100) | Y | Must exist in extraction schema | System | RFP-P1-13 |
| machine_value | Machine extracted value | text | N | Schema-validated | System | RFP-P1-13 |
| reviewer_value | Reviewer-confirmed value | text | N | Schema-validated | Reviewer | RFP-P1-13 |
| confidence_score | Model confidence | numeric(5,4) | N | 0.0000-1.0000 | System | RFP-P1-13 |
| review_status | Review disposition | enum(review_status) | Y | AUTO_ACCEPTED, REVIEW_REQUIRED, ACCEPTED, CORRECTED, REJECTED | Workflow | RFP-P1-13 |
| source_ref | Page/span/bbox reference | jsonb | N | Validated against source_ref schema | System | RFP-P1-13 |

#### ENT-LEGAL
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| order_id | Legal order UUID | uuid | Y | Primary key | System | RFP-P1-08 |
| case_id | Linked case | uuid | Y | Foreign key to case | System | RFP-P1-08 |
| court_name | Court name | varchar(255) | Y | Non-empty | E-Courts | RFP-P1-08 |
| order_type | Order type | enum(order_type) | Y | JUDGMENT, BAIL_ORDER, INTERIM_ORDER, OTHER | E-Courts | RFP-P1-08 |
| order_date | Order date | date | Y | Cannot be future | E-Courts | RFP-P1-08 |
| status_effect | Resulting legal status effect | varchar(100) | N | Mapped via legal status master | System/reviewer | RFP-P1-08 |
| retrieved_at | Retrieved timestamp | timestamptz | Y | System timestamp | System | RFP-P1-08 |
| match_confidence | Match confidence | numeric(5,4) | N | 0.0000-1.0000 | System | RFP-P1-08 |

#### ENT-COMM
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| event_id | Communication event UUID | uuid | Y | Primary key | System | RFP-P1-03 |
| source_system | Telecom source | enum(source_system) | Y | CDR, CDAT, IPDR or approved source | Connector | RFP-P1-03 |
| from_number | Calling/source number | varchar(20) | Y | Normalized telecom format | CDR/CDAT/IPDR | RFP-P2-02 |
| to_number | Receiving/target number | varchar(20) | Y | Normalized telecom format | CDR/CDAT/IPDR | RFP-P2-02 |
| start_time | Event start | timestamptz | Y | Valid timestamp | CDR/CDAT/IPDR | RFP-P2-02 |
| duration_seconds | Duration in seconds | integer | N | 0 or greater | CDR/CDAT | RFP-P2-03 |
| cell_tower_ref | Tower/location reference | varchar(100) | N | Normalized tower master reference | CDAT/LBS | RFP-P2-03 |
| linked_subject_ids | Resolved subject links | uuid[] | N | FK array or relationship table | System | RFP-P2-08 |

#### ENT-TXN
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| txn_id | Transaction UUID | uuid | Y | Primary key | System | RFP-P1-09 |
| account_ref | Source account reference | varchar(100) | N | Encrypted/tokenized if sensitive | Financial source | RFP-P1-09 |
| counterparty_ref | Counterparty account/UPI reference | varchar(150) | N | Encrypted/tokenized if sensitive | Financial source | RFP-P1-09 |
| linked_phone | Linked phone number | varchar(20) | N | Normalized telecom format | Financial source/system | RFP-P1-09 |
| txn_time | Transaction timestamp | timestamptz | Y | Valid timestamp | Financial source | RFP-P1-09 |
| amount | Transaction amount | numeric(14,2) | N | >=0 | Financial source | RFP-P1-09 |
| txn_mode | Transaction mode | enum(transaction_mode) | Y | CASH, UPI, BANK_TRANSFER, MIXED, OTHER | Financial source | RFP-P1-09 |
| match_status | Telecom/subject match status | enum(match_status) | Y | UNMATCHED, PARTIAL, MATCHED, REVIEW_REQUIRED | System | RFP-P1-09 |

#### ENT-DEV
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| device_event_id | Device history UUID | uuid | Y | Primary key | System | RFP-P2-03 |
| number | Mobile number | varchar(20) | Y | Normalized telecom format | CDR/CDAT | RFP-P2-03 |
| imei | IMEI | varchar(20) | N | 14-16 digits/pattern | CDR/CDAT | RFP-P2-03 |
| first_seen_at | First seen timestamp | timestamptz | N | Valid timestamp | CDR/CDAT | RFP-P2-03 |
| last_seen_at | Last seen timestamp | timestamptz | N | >= first_seen_at | CDR/CDAT | RFP-P2-03 |
| subject_id | Linked subject | uuid | N | Foreign key | System | RFP-P2-08 |

#### ENT-LOC
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| location_event_id | Location event UUID | uuid | Y | Primary key | System | RFP-P2-03 |
| subject_id | Linked subject | uuid | N | Foreign key | System | RFP-P2-03 |
| number | Linked mobile number | varchar(20) | N | Normalized telecom format | LBS/CDAT | RFP-P2-03 |
| latitude | Latitude | numeric(9,6) | N | -90 to 90 | LBS/GIS | RFP-P2-03 |
| longitude | Longitude | numeric(9,6) | N | -180 to 180 | LBS/GIS | RFP-P2-03 |
| event_time | Event timestamp | timestamptz | Y | Valid timestamp | LBS/GIS | RFP-P2-03 |
| accuracy_meters | Location accuracy | numeric(8,2) | N | >=0 | LBS/GIS | RFP-P2-03 |
| geofence_hits | Matched geofences | uuid[] | N | FK array or relationship table | System | RFP-P2-04 |

#### ENT-NODE
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| node_id | Network node UUID | uuid | Y | Primary key | System | RFP-P2-02 |
| node_type | Node type | enum(node_type) | Y | SUBJECT, PHONE, ACCOUNT, DEVICE, VEHICLE, LOCATION, CASE | System | RFP-P2-02 |
| display_value | Display label | varchar(255) | Y | Non-empty | System/source | RFP-P2-02 |
| canonical_ref | Reference to canonical entity | varchar(100) | N | Foreign key or external ref | System | RFP-P2-02 |
| risk_score | Current node risk score | numeric(5,2) | N | 0-100 | System | RFP-BIZ-04 |

#### ENT-EDGE
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| edge_id | Network edge UUID | uuid | Y | Primary key | System | RFP-P2-02 |
| node_a_id | Source node | uuid | Y | FK to network node | System | RFP-P2-02 |
| node_b_id | Target node | uuid | Y | FK to network node | System | RFP-P2-02 |
| edge_type | Relationship type | enum(edge_type) | Y | CALL, MESSAGE, TRANSACTION, CO_CASE, CO_LOCATION, DOCUMENT, OTHER | System | RFP-P2-02 |
| weight | Computed relationship weight | numeric(10,4) | N | >=0 | System | RFP-P2-02 |
| evidence_count | Evidence count supporting edge | integer | N | >=0 | System | RFP-P2-02 |
| time_window | Aggregated time range | tstzrange | N | Valid range | System | RFP-P2-02 |

#### ENT-LEAD
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| lead_id | Lead UUID | uuid | Y | Primary key | System | RFP-P2-09 |
| channel | Lead source channel | enum(lead_channel) | Y | TOLL_FREE, WHATSAPP, WALK_IN, FIELD, OTHER | Operator | RFP-P2-09 |
| informant_name | Informant name | varchar(200) | N | May be null for anonymous leads | Operator | RFP-P2-09 |
| informant_contact | Informant contact | varchar(50) | N | Normalized phone/email if present | Operator | RFP-P2-09 |
| location_text | Reported location | text | Y | Non-empty | Operator | RFP-P2-09 |
| suspect_info | Reported suspect details | text | N | Up to 4000 chars | Operator | RFP-P2-09 |
| urgency | Urgency level | enum(urgency_level) | Y | LOW, MEDIUM, HIGH, CRITICAL | Operator | RFP-P2-09 |
| status | Lead status | enum(lead_status) | Y | NEW, VALIDATED, MEMO_GENERATED, APPROVAL_PENDING, ROUTED, IN_ACTION, CLOSED, REJECTED | Workflow | RFP-P2-10 |

#### ENT-MEMO
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| memo_id | Memo UUID | uuid | Y | Primary key | System | RFP-P2-10 |
| lead_id | Linked lead | uuid | N | FK to lead | System | RFP-P2-10 |
| template_version_id | Applied template version | uuid | Y | FK to template version | System | RFP-P2-10 |
| generated_at | Generated timestamp | timestamptz | Y | System timestamp | System | RFP-P2-10 |
| approver_user_id | Approving user | uuid | N | FK to user | Workflow | RFP-P2-10 |
| dispatch_status | Dispatch state | enum(dispatch_status) | Y | DRAFT, APPROVED, DISPATCHED, FAILED, CANCELLED | Workflow | RFP-P2-10 |
| dispatch_channel | Dispatch channel | enum(dispatch_channel) | N | EMAIL, PRINT, DOWNLOAD, INTERNAL_QUEUE | Workflow | RFP-P2-10 |
| output_document_id | Generated output document | uuid | N | FK to document | System | RFP-P2-10 |

#### ENT-ALERT
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| alert_id | Alert UUID | uuid | Y | Primary key | System | RFP-BIZ-07 |
| alert_type | Alert type | enum(alert_type) | Y | GEOFENCE, RISK_SCORE, OVERDUE_REVIEW, CONNECTOR_FAILURE, CRITICAL_LEAD, OTHER | System | RFP-BIZ-07 |
| severity | Severity | enum(severity_level) | Y | LOW, MEDIUM, HIGH, CRITICAL | System | RFP-BIZ-07 |
| entity_ref | Linked entity reference | varchar(100) | Y | FK or typed reference | System | RFP-BIZ-07 |
| triggered_at | Trigger timestamp | timestamptz | Y | Valid timestamp | System | RFP-BIZ-07 |
| status | Alert status | enum(alert_status) | Y | OPEN, ACKNOWLEDGED, ASSIGNED, ESCALATED, RESOLVED, CLOSED, FALSE_POSITIVE | Workflow | RFP-BIZ-07 |
| assigned_to | Current assignee | uuid | N | FK to user | Workflow | RFP-BIZ-07 |
| sla_due_at | SLA due timestamp | timestamptz | N | Valid timestamp | Workflow | RFP-BIZ-07 |

#### ENT-WFTASK
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| task_id | Workflow task UUID | uuid | Y | Primary key | System | RFP-BIZ-07 |
| task_type | Workflow task type | enum(task_type) | Y | REVIEW, APPROVAL, ESCALATION, REPROCESS, CONFIG_APPROVAL, MODEL_APPROVAL | Workflow | RFP-BIZ-07 |
| linked_entity_type | Linked entity type | varchar(50) | Y | Controlled entity list | System | RFP-BIZ-07 |
| linked_entity_id | Linked entity ID | uuid | Y | Foreign key by entity type | System | RFP-BIZ-07 |
| status | Task status | enum(task_status) | Y | OPEN, IN_PROGRESS, WAITING, COMPLETED, CANCELLED, EXPIRED | Workflow | RFP-BIZ-07 |
| owner_user_id | Task owner | uuid | N | FK to user | Workflow | RFP-BIZ-07 |
| due_at | Due timestamp | timestamptz | N | Valid timestamp | Workflow | RFP-BIZ-07 |

#### ENT-USER
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | User UUID | uuid | Y | Primary key | System | RFP-TECH-07 |
| username | Login identifier | varchar(150) | Y | Unique | IdP/System | RFP-TECH-07 |
| role_id | Assigned role | varchar(20) | Y | Must exist in role master | Admin | RFP-TECH-07 |
| jurisdiction_scope | Jurisdiction scope JSON | jsonb | Y | Validated against scope schema | Admin | RFP-TECH-07 |
| auth_provider | Identity provider | enum(auth_provider) | Y | SSO, LDAP, AD, LOCAL_BREAK_GLASS | System | RFP-TECH-07 |
| active_status | User active flag | boolean | Y | Default true | Admin | RFP-TECH-07 |

#### ENT-AUDIT
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| audit_id | Audit row UUID | uuid | Y | Primary key | System | RFP-BIZ-06 |
| actor_user_id | Acting user | uuid | N | FK to user or null for service account event | System | RFP-TECH-07 |
| action_type | Action type | varchar(100) | Y | Controlled action catalog | System | RFP-BIZ-06 |
| target_type | Target entity type | varchar(50) | Y | Controlled entity list | System | RFP-BIZ-06 |
| target_id | Target entity ID | varchar(100) | Y | FK or external reference | System | RFP-BIZ-06 |
| event_time | Event timestamp | timestamptz | Y | System timestamp | System | RFP-BIZ-06 |
| before_after_snapshot | Changed fields snapshot | jsonb | N | JSON diff schema | System | RFP-BIZ-06 |
| correlation_id | Correlation ID | varchar(100) | N | Traceable request/job correlation | System | RFP-BIZ-06 |

#### ENT-MODEL
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| model_version_id | Model version UUID | uuid | Y | Primary key | System | RFP-P2-07 |
| model_name | Model or prompt name | varchar(150) | Y | Non-empty | System | RFP-TECH-03 |
| task_type | Feature/task type | enum(ai_task_type) | Y | OCR, EXTRACTION, CLASSIFICATION, SUMMARY, RISK_SCORING, LEGAL_MAPPING, QA | System | RFP-TECH-03 |
| version_label | Semantic version | varchar(50) | Y | Unique per model_name | System | RFP-P2-07 |
| validation_score | Primary validation metric | numeric(6,4) | N | 0.0000-1.0000 | Evaluation pipeline | RFP-P2-07 |
| approval_status | Promotion status | enum(approval_status) | Y | DRAFT, TESTED, APPROVED, REJECTED, RETIRED | Workflow | RFP-P2-07 |
| artifact_uri | Stored artifact location | text | Y | Department-controlled storage only | System | RFP-TECH-02 |
| approved_at | Approval timestamp | timestamptz | N | System timestamp | Workflow | RFP-P2-07 |

#### ENT-CONN
| Attribute | Description | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- |
| connector_id | Connector UUID | uuid | Y | Primary key | System | RFP-P1-04 |
| connector_name | Connector name | varchar(150) | Y | Unique | Admin | RFP-P1-04 |
| source_system | Mapped source system | enum(source_system) | Y | Must exist in source master | Admin | RFP-P1-04 |
| interface_type | Interface type | enum(interface_type) | Y | API, SFTP, DB_LINK, FILE_WATCH, WEBHOOK, SCRAPE | Admin | RFP-P1-04 |
| auth_type | Authentication type | enum(auth_type) | Y | OAUTH, BASIC, API_KEY, MTLS, DB_CREDENTIAL, NONE | Admin | RFP-P1-04 |
| feature_flag_enabled | Connector active flag | boolean | Y | Default false for optional connectors | Admin | RFP-P1-04 |
| sync_schedule | Cron or interval | varchar(100) | N | Valid schedule format | Admin | RFP-P1-04 |
| last_health_status | Connector health | enum(health_status) | N | HEALTHY, DEGRADED, FAILED, DISABLED | System | RFP-P1-04 |

### 5.3 Master Data and Enumerations
| Enumeration ID | Enumeration | Allowed Values | Used By |
| --- | --- | --- | --- |
| ENUM-001 | transaction_mode | CASH \| UPI \| BANK_TRANSFER \| MIXED \| OTHER | SubjectProfile, FinancialTransaction |
| ENUM-002 | cdr_status | NOT_REQUESTED \| REQUESTED \| RECEIVED \| PROCESSED \| UNAVAILABLE | SubjectProfile |
| ENUM-003 | offender_status | ARRESTED \| ABSCONDING \| DETAINED \| UNDER_INQUIRY \| UNKNOWN | SubjectProfile |
| ENUM-004 | offender_role | CULTIVATOR \| MANUFACTURER \| SUPPLIER \| PEDDLER \| TRANSPORTER \| CONSUMER \| MEDIATOR \| FINANCIER | SubjectProfile, classifier |
| ENUM-005 | case_status | OPEN \| UNDER_INVESTIGATION \| CHARGESHEETED \| CLOSED \| ARCHIVED | Case |
| ENUM-006 | review_status | AUTO_ACCEPTED \| REVIEW_REQUIRED \| ACCEPTED \| CORRECTED \| REJECTED | ExtractionField |
| ENUM-007 | lead_status | NEW \| VALIDATED \| MEMO_GENERATED \| APPROVAL_PENDING \| ROUTED \| IN_ACTION \| CLOSED \| REJECTED | Lead |
| ENUM-008 | alert_status | OPEN \| ACKNOWLEDGED \| ASSIGNED \| ESCALATED \| RESOLVED \| CLOSED \| FALSE_POSITIVE | Alert |
| ENUM-009 | severity_level | LOW \| MEDIUM \| HIGH \| CRITICAL | Alert, task |
| ENUM-010 | task_status | OPEN \| IN_PROGRESS \| WAITING \| COMPLETED \| CANCELLED \| EXPIRED | WorkflowTask |
| ENUM-011 | task_type | REVIEW \| APPROVAL \| ESCALATION \| REPROCESS \| CONFIG_APPROVAL \| MODEL_APPROVAL | WorkflowTask |
| ENUM-012 | dispatch_status | DRAFT \| APPROVED \| DISPATCHED \| FAILED \| CANCELLED | Memo/Requisition |
| ENUM-013 | source_system | CCTNS \| CDAT \| CDR \| IPDR \| FIR_REPOSITORY \| CONFESSION_MEMO \| IR_REPOSITORY \| E_SAKSHYA \| C_TRACE \| GOOGLE_DRIVE \| E_COURTS \| TS_COP \| ICJS \| TRANSPORT \| E_PRISONS \| IVFRT \| NHAI \| LAND_STAMP \| MANUAL_UPLOAD \| OTHER | Multiple |
| ENUM-014 | document_type | FIR \| PANCHANAMA \| CONFESSION_MEMO \| INTERROGATION_REPORT \| MONTHLY_REPORT \| COURT_ORDER \| SCREENSHOT \| CHAT_EXPORT \| BANK_STATEMENT \| CDR_FILE \| IPDR_FILE \| TECHNICAL_REPORT \| DOSSIER \| MEMO \| OTHER | SourceDocument |
| ENUM-015 | lead_channel | TOLL_FREE \| WHATSAPP \| WALK_IN \| FIELD \| EMAIL \| OTHER | Lead |
| ENUM-016 | approval_status | DRAFT \| TESTED \| APPROVED \| REJECTED \| RETIRED | ModelVersion/configs |
| ENUM-017 | auth_provider | SSO \| LDAP \| AD \| LOCAL_BREAK_GLASS | User |
| ENUM-018 | interface_type | API \| SFTP \| DB_LINK \| FILE_WATCH \| WEBHOOK \| SCRAPE | ConnectorConfig |
| ENUM-019 | health_status | HEALTHY \| DEGRADED \| FAILED \| DISABLED | ConnectorConfig |
| ENUM-020 | urgency_level | LOW \| MEDIUM \| HIGH \| CRITICAL | Lead |

### 5.4 Physical Modeling Notes
- Use UUID primary keys for all canonical entities.
- Store all timestamps in `timestamp with time zone` and display in `Asia/Kolkata` by default.
- Use PostgreSQL `jsonb` only for bounded sub-schemas that are validated in application logic; do not use free-form JSON as a substitute for core relational design.
- Preserve raw and derived evidence as separate artefacts with parent-child lineage.
- Use append-only assertion/version tables for extracted or reviewer-corrected values rather than destructive overwrites.

## 6. API Specifications

All APIs shall be versioned under `/api/v1`, enforce server-side authorization, emit correlation IDs, and return standard error payloads in the form `{code, message, correlation_id, details[]}`.

### API-01 - Create manual ingestion job
- **Method:** `POST`
- **Endpoint:** `/api/v1/ingestion-jobs`
- **Authentication:** Bearer token via Department SSO; roles PL-1 and above.
- **Rate Limits:** 60 requests/minute/user; 500 requests/minute/system.
- **Idempotency Handling:** Required. Idempotency-Key header prevents duplicate job creation for the same upload.
- **Validation Rules:** source_system, document_type, and object_key are mandatory. object_key must point to an existing staged upload. case_ref fields must match configured patterns when provided.
- **Error Codes:** 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN, 409 DUPLICATE_PAYLOAD, 422 UNSUPPORTED_DOCUMENT_TYPE, 500 INTERNAL_ERROR

**Request Schema (Example)**
```json
{
  "source_system": "MANUAL_UPLOAD",
  "document_type": "FIR",
  "object_key": "evidence/raw/2026/03/02/fir-001.pdf",
  "district": "Hyderabad",
  "police_station": "Banjara Hills",
  "case_ref": {
    "crime_number": "123/2026"
  },
  "language_hint": "TE",
  "tags": ["phase1", "fir"]
}
```

**Response Schema (Example)**
```json
{
  "job_id": "7c6b3d66-3f49-4d10-9fa3-2df9fd01b90a",
  "status": "RECEIVED",
  "queued_at": "2026-03-02T10:20:00+05:30",
  "correlation_id": "ing-20260302-000123"
}
```

### API-02 - Get ingestion job status
- **Method:** `GET`
- **Endpoint:** `/api/v1/ingestion-jobs/{job_id}`
- **Authentication:** Bearer token; roles PL-1 and above.
- **Rate Limits:** 300 requests/minute/user.
- **Idempotency Handling:** Not applicable.
- **Validation Rules:** job_id must be a valid UUID visible within the requestor's jurisdiction.
- **Error Codes:** 401, 403, 404 JOB_NOT_FOUND, 500

**Request Schema (Example)**
```json
{"path_params":{"job_id":"uuid"}}
```

**Response Schema (Example)**
```json
{
  "job_id": "7c6b3d66-3f49-4d10-9fa3-2df9fd01b90a",
  "status": "REVIEW_REQUIRED",
  "source_system": "MANUAL_UPLOAD",
  "document_id": "2df2f4f1-76ff-4326-9e7d-11582c76f2b9",
  "issues": ["LOW_OCR_CONFIDENCE"],
  "retry_count": 1
}
```

### API-03 - Submit extraction review decision
- **Method:** `POST`
- **Endpoint:** `/api/v1/extractions/{extraction_id}/review`
- **Authentication:** Bearer token; PL-1 and above within jurisdiction.
- **Rate Limits:** 120 requests/minute/user.
- **Idempotency Handling:** Optional; duplicate submissions with same payload within 30 seconds return same result.
- **Validation Rules:** decision must be ACCEPTED, CORRECTED, or REJECTED. reviewer_value is mandatory for CORRECTED. reason_code mandatory when decision differs from machine value.
- **Error Codes:** 400, 401, 403, 404, 409 INVALID_STATE, 422 SCHEMA_VALIDATION_FAILED

**Request Schema (Example)**
```json
{
  "decision": "CORRECTED",
  "reviewer_value": "Section 8(c) NDPS Act",
  "reason_code": "OCR_MISREAD",
  "comment": "Verified against page 2"
}
```

**Response Schema (Example)**
```json
{
  "extraction_id": "0c77e337-0fa1-4ab7-b7ca-1b8c6e7d4b0d",
  "review_status": "CORRECTED",
  "reviewed_at": "2026-03-02T10:42:11+05:30",
  "next_state": "PROFILE_UPDATE_PENDING"
}
```

### API-04 - Search subjects and entities
- **Method:** `POST`
- **Endpoint:** `/api/v1/subjects/search`
- **Authentication:** Bearer token; PL-2 and above for advanced search; restricted identifier searches require role-specific permission.
- **Rate Limits:** 90 requests/minute/user.
- **Idempotency Handling:** Not applicable.
- **Validation Rules:** query is mandatory. query_type must be in approved search modes. page_size max 100. Sensitive query types require elevated roles.
- **Error Codes:** 400, 401, 403, 422 INVALID_QUERY_TYPE, 429 RATE_LIMITED, 500

**Request Schema (Example)**
```json
{
  "query": "Raju",
  "query_type": "NAME",
  "filters": {
    "district": ["Hyderabad"],
    "date_from": "2025-01-01",
    "date_to": "2026-03-02"
  },
  "include_masked_hits": false,
  "page": 1,
  "page_size": 25
}
```

**Response Schema (Example)**
```json
{
  "results": [
    {
      "subject_id": "9f8d11d3-2e2f-4c6e-b9fa-4ba7a9e1d021",
      "display_name": "Raju @ Rajesh",
      "match_score": 0.97,
      "match_reasons": ["exact_alias", "same_mobile"],
      "district": "Hyderabad",
      "masked_identifiers": {
        "aadhaar": "XXXX-XXXX-1234"
      }
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

### API-05 - Get subject dossier
- **Method:** `GET`
- **Endpoint:** `/api/v1/subjects/{subject_id}`
- **Authentication:** Bearer token; PL-2 and above.
- **Rate Limits:** 120 requests/minute/user.
- **Idempotency Handling:** Not applicable.
- **Validation Rules:** subject_id must exist and be visible to the requestor. include_sections limited to approved values.
- **Error Codes:** 401, 403, 404 SUBJECT_NOT_FOUND, 500

**Request Schema (Example)**
```json
{"path_params":{"subject_id":"uuid"},"query":{"include_sections":"cases,alerts,documents,network"}}
```

**Response Schema (Example)**
```json
{
  "subject_id": "9f8d11d3-2e2f-4c6e-b9fa-4ba7a9e1d021",
  "profile_version": 14,
  "name": "Raju @ Rajesh",
  "offender_status": "ABSCONDING",
  "roles": ["PEDDLER"],
  "completeness_score": 0.82,
  "cases": [{"case_id":"...","crime_number":"123/2026"}],
  "recent_alerts": [{"alert_id":"...","severity":"HIGH"}]
}
```

### API-06 - Generate interrogation report draft
- **Method:** `POST`
- **Endpoint:** `/api/v1/interrogation-reports/generate`
- **Authentication:** Bearer token; PL-1 create, PL-3 finalize.
- **Rate Limits:** 30 requests/minute/user.
- **Idempotency Handling:** Recommended. Same case_id + template_version_id + source set within 5 minutes reuses existing draft unless force_regenerate=true.
- **Validation Rules:** case_id and active template_version_id are mandatory. source_document_ids must belong to the case or authorized related entities.
- **Error Codes:** 400, 401, 403, 404 TEMPLATE_NOT_FOUND, 409 INVALID_TEMPLATE_STATE, 422 MANDATORY_SOURCE_MISSING, 500

**Request Schema (Example)**
```json
{
  "case_id": "4dc2f8f1-c74b-4ce8-a980-fda61910f1e3",
  "template_version_id": "d18d3bb3-2150-4ba8-8c52-7e9f9cbec63f",
  "source_document_ids": ["2df2f4f1-76ff-4326-9e7d-11582c76f2b9"],
  "mode": "DRAFT"
}
```

**Response Schema (Example)**
```json
{
  "report_id": "f8046cc6-21cb-4f79-9d8b-5d6806c51a53",
  "status": "REVIEW_REQUIRED",
  "missing_fields": ["accused_address", "seizure_location"],
  "document_preview_id": "91b8f463-6df5-44de-8f0e-c89e862f4d9c"
}
```

### API-07 - Create network analysis job
- **Method:** `POST`
- **Endpoint:** `/api/v1/network-analysis/jobs`
- **Authentication:** Bearer token; PL-2 and above.
- **Rate Limits:** 10 job creations/minute/user.
- **Idempotency Handling:** Required for job creation to avoid duplicate heavy runs.
- **Validation Rules:** At least one seed subject or seed number is required. depth max 5 or configured cap. date_from <= date_to.
- **Error Codes:** 400, 401, 403, 409 TOO_MANY_SEEDS, 422 DEPTH_LIMIT_EXCEEDED, 500

**Request Schema (Example)**
```json
{
  "seed_subject_ids": ["9f8d11d3-2e2f-4c6e-b9fa-4ba7a9e1d021"],
  "depth": 3,
  "date_from": "2025-09-01",
  "date_to": "2026-03-02",
  "filters": {
    "min_duration_seconds": 30,
    "sources": ["CDR", "CDAT"]
  }
}
```

**Response Schema (Example)**
```json
{
  "job_id": "ee2d20fa-0df8-4c2d-91cf-4d6d0baaf91f",
  "status": "QUEUED",
  "estimated_result_retention_days": 30
}
```

### API-08 - Create lead
- **Method:** `POST`
- **Endpoint:** `/api/v1/leads`
- **Authentication:** Bearer token; PL-1 and above.
- **Rate Limits:** 120 requests/minute/user.
- **Idempotency Handling:** Recommended for operator UI submissions.
- **Validation Rules:** channel, location_text, and urgency are mandatory. informant_contact normalized when provided.
- **Error Codes:** 400, 401, 403, 422 INVALID_URGENCY, 500

**Request Schema (Example)**
```json
{
  "channel": "WHATSAPP",
  "informant_name": "Confidential",
  "informant_contact": "+919999999999",
  "location_text": "Miyapur bus stop",
  "suspect_info": "Male, black bike, selling contraband near metro pillar",
  "urgency": "HIGH",
  "notes": "Received at 10:55 AM"
}
```

**Response Schema (Example)**
```json
{
  "lead_id": "09df8b5c-45ea-4926-b4c1-c3fbbf9d53cd",
  "status": "NEW",
  "duplicate_candidates": [],
  "next_state": "VALIDATION_PENDING"
}
```

### API-09 - Approve memo or requisition
- **Method:** `POST`
- **Endpoint:** `/api/v1/memos/{memo_id}/approve`
- **Authentication:** Bearer token; PL-3 and above.
- **Rate Limits:** 60 requests/minute/user.
- **Idempotency Handling:** Required. Duplicate approval attempts return the current approved state.
- **Validation Rules:** decision must be APPROVE or REJECT. dispatch_channel required for approval when auto-dispatch configured. Only current approver may act.
- **Error Codes:** 400, 401, 403, 404 MEMO_NOT_FOUND, 409 INVALID_STATE, 500

**Request Schema (Example)**
```json
{
  "decision": "APPROVE",
  "dispatch_channel": "EMAIL",
  "comment": "Send to zonal officer immediately"
}
```

**Response Schema (Example)**
```json
{
  "memo_id": "49dfb4f4-66ea-4b0a-8b1d-f4446c480100",
  "dispatch_status": "APPROVED",
  "approved_by": "user-123",
  "approved_at": "2026-03-02T11:05:00+05:30"
}
```

### API-10 - Acknowledge or assign alert
- **Method:** `POST`
- **Endpoint:** `/api/v1/alerts/{alert_id}/acknowledge`
- **Authentication:** Bearer token; PL-2 and above for acknowledge; PL-3 and above for escalate/close.
- **Rate Limits:** 120 requests/minute/user.
- **Idempotency Handling:** Optional; repeated same action on same state returns current status.
- **Validation Rules:** action must be ACKNOWLEDGE, ASSIGN, ESCALATE, RESOLVE, CLOSE, or FALSE_POSITIVE. assignee_user_id mandatory for ASSIGN.
- **Error Codes:** 400, 401, 403, 404 ALERT_NOT_FOUND, 409 INVALID_STATE, 500

**Request Schema (Example)**
```json
{
  "action": "ASSIGN",
  "assignee_user_id": "7d43ef53-8e11-46ec-aa2d-c9859220f112",
  "comment": "Field verification required"
}
```

**Response Schema (Example)**
```json
{
  "alert_id": "17a3bc0d-1e8e-49dc-a1e7-38f45f54f58d",
  "status": "ASSIGNED",
  "assigned_to": "7d43ef53-8e11-46ec-aa2d-c9859220f112",
  "sla_due_at": "2026-03-02T11:20:00+05:30"
}
```

### API-11 - Create or update governed rule/config version
- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/config/rules`
- **Authentication:** Bearer token; PL-4 and above.
- **Rate Limits:** 30 requests/minute/user.
- **Idempotency Handling:** Recommended for admin UI save actions.
- **Validation Rules:** config_type, name, version_label, and payload are mandatory. payload validated against schema for config_type.
- **Error Codes:** 400, 401, 403, 409 VERSION_ALREADY_EXISTS, 422 SCHEMA_VALIDATION_FAILED, 500

**Request Schema (Example)**
```json
{
  "config_type": "RISK_SCORING_RULESET",
  "name": "default-risk-v1",
  "version_label": "1.0.0",
  "effective_from": "2026-03-05T00:00:00+05:30",
  "payload": {
    "weights": {
      "source_credibility": 20,
      "linked_offender": 25,
      "keyword_pattern": 15,
      "repeat_occurrence": 20,
      "geofence_relevance": 20
    }
  }
}
```

**Response Schema (Example)**
```json
{
  "config_version_id": "ab73a68e-6286-41c4-b989-bd8898e2e740",
  "status": "DRAFT",
  "approval_required": true
}
```

### API-12 - Create report export job
- **Method:** `POST`
- **Endpoint:** `/api/v1/reports/export`
- **Authentication:** Bearer token; report-specific permission required.
- **Rate Limits:** 20 jobs/minute/user.
- **Idempotency Handling:** Required for same report and identical filter payload within 2 minutes.
- **Validation Rules:** report_id and format are mandatory. Only approved formats allowed for the selected report.
- **Error Codes:** 400, 401, 403, 404 REPORT_NOT_FOUND, 422 FORMAT_NOT_ALLOWED, 500

**Request Schema (Example)**
```json
{
  "report_id": "REP-005",
  "format": "PDF",
  "filters": {
    "district": ["Hyderabad"],
    "date_from": "2026-02-01",
    "date_to": "2026-02-29"
  }
}
```

**Response Schema (Example)**
```json
{
  "export_job_id": "56c81166-9f37-4251-90d2-2dc5e95d752f",
  "status": "QUEUED",
  "watermark": "Generated by user-123 on 2026-03-02 11:10 IST"
}
```

### API-13 - Natural-language query
- **Method:** `POST`
- **Endpoint:** `/api/v1/ai/query`
- **Authentication:** Bearer token; PL-2 and above; data returned limited by RBAC.
- **Rate Limits:** 20 requests/minute/user.
- **Idempotency Handling:** Not applicable.
- **Validation Rules:** question mandatory; max length 2000 chars. response_mode optional but constrained to approved modes.
- **Error Codes:** 400, 401, 403, 422 UNSUPPORTED_QUERY, 429 RATE_LIMITED, 503 AI_SERVICE_UNAVAILABLE

**Request Schema (Example)**
```json
{
  "question": "Show repeat offenders in Hyderabad with new bail orders in the last 30 days",
  "response_mode": "SUMMARY_WITH_TABLE"
}
```

**Response Schema (Example)**
```json
{
  "answer_text": "Found 12 repeat offenders in Hyderabad with new bail orders in the last 30 days.",
  "structured_result": {
    "count": 12,
    "rows": [{"subject_id":"...","name":"...","order_date":"2026-02-20"}]
  },
  "citations": [
    {"entity_type":"LegalOrder","entity_id":"..."},
    {"entity_type":"Case","entity_id":"..."}
  ],
  "model_version_id": "0f1d..."
}
```

### API-14 - Verify evidence integrity
- **Method:** `POST`
- **Endpoint:** `/api/v1/evidence/{document_id}/hash-verify`
- **Authentication:** Bearer token; PL-3 and above, or auditor role.
- **Rate Limits:** 30 requests/minute/user.
- **Idempotency Handling:** Not applicable.
- **Validation Rules:** document_id must exist. Only evidence accessible to the role may be verified.
- **Error Codes:** 401, 403, 404 DOCUMENT_NOT_FOUND, 409 DOCUMENT_UNAVAILABLE, 500

**Request Schema (Example)**
```json
{
  "verify_mode": "RECALCULATE"
}
```

**Response Schema (Example)**
```json
{
  "document_id": "2df2f4f1-76ff-4326-9e7d-11582c76f2b9",
  "stored_hash": "3df7...",
  "calculated_hash": "3df7...",
  "match": true,
  "verified_at": "2026-03-02T11:15:00+05:30"
}
```

## 7. Workflow / State Machine

The workflow engine shall store every state transition with actor, timestamp, correlation ID, previous state, next state, and reason code. Time-based escalations shall be processed by a scheduler and shall be re-evaluated after priority changes.

| Workflow ID | Workflow Name | Current State | Trigger | Condition | Next State | Actor | SLA Timer | Escalation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-ING-01 | Ingestion and extraction | RECEIVED | Payload stored | Checksum valid | QUEUED | System | Immediate | None | Job created after upload/connector receipt. |
| WF-ING-01 | Ingestion and extraction | QUEUED | Worker starts | Resources available | PROCESSING | System | 5 min | Alert after 15 min waiting | Start of OCR/parse pipeline. |
| WF-ING-01 | Ingestion and extraction | PROCESSING | OCR and schema extraction complete | All mandatory validations pass and confidence >= thresholds | EXTRACTED | System | 15 min | Escalate to admin if > 30 min | Successful machine extraction. |
| WF-ING-01 | Ingestion and extraction | PROCESSING | Validation complete | Any field below threshold or issue present | REVIEW_REQUIRED | System | 15 min | Notify district queue immediately | Human review required. |
| WF-ING-01 | Ingestion and extraction | REVIEW_REQUIRED | Reviewer accepts/corrects all required fields | No blocking issues remain | APPROVED | District Operator / Reviewer | 1 business day | Escalate to supervisory queue after SLA breach | Approved extraction may publish profile/report updates. |
| WF-ING-01 | Ingestion and extraction | ANY_ACTIVE | Processing error | Retry count < limit | RETRY_PENDING | System | Backoff 5/15/60 min | Admin alert on third failure | Transient failure handling. |
| WF-ING-01 | Ingestion and extraction | RETRY_PENDING | Retry exhausted | Retry count >= limit | FAILED | System | After final retry | Admin queue + connector health alert | Manual intervention required. |
| WF-PROF-01 | Subject profile publication | DRAFT | New evidence linked | Candidate subject resolved | PENDING_REVIEW | System | Immediate | None | Profile proposal created. |
| WF-PROF-01 | Subject profile publication | PENDING_REVIEW | Reviewer approves | No unresolved conflicts | PUBLISHED | Reviewer | 1 business day | Escalate to district supervisor | Published profile visible in search/reporting. |
| WF-PROF-01 | Subject profile publication | PENDING_REVIEW | Reviewer identifies conflict | Conflict unresolved | CONFLICTING | Reviewer | 1 business day | Escalate after 2 business days | Profile remains partial until resolved. |
| WF-PROF-01 | Subject profile publication | CONFLICTING | Conflict resolved | Reviewer decision saved | PUBLISHED | Reviewer | 1 business day | Escalate to HQ legal/intelligence if overdue | Conflict history retained. |
| WF-IR-01 | Interrogation report | DRAFT | Generate report | Template active and sources valid | REVIEW_REQUIRED | System | Immediate | None | Generated draft awaiting completion. |
| WF-IR-01 | Interrogation report | REVIEW_REQUIRED | User completes missing fields | All mandatory fields present | APPROVAL_PENDING | District Operator | 4 business hours | Escalate to supervisor after SLA breach | Ready for final approval. |
| WF-IR-01 | Interrogation report | APPROVAL_PENDING | Approver approves | Role and jurisdiction valid | FINALIZED | Supervisory Officer / Legal Reviewer | 1 business day | Escalate to HQ after SLA breach | Final PDF/DOCX available. |
| WF-IR-01 | Interrogation report | APPROVAL_PENDING | Approver rejects | Reason code mandatory | DRAFT | Supervisory Officer / Legal Reviewer | Immediate | Notify creator | Returned for correction. |
| WF-LEGAL-01 | E-Courts legal update | MONITORING | Court order found | Match confidence >= auto-propose threshold | REVIEW_PENDING | System | Immediate | Notify legal reviewer | Proposed legal update created. |
| WF-LEGAL-01 | E-Courts legal update | REVIEW_PENDING | Reviewer approves | Order valid | APPLIED | Legal Reviewer | 1 business day | Escalate to HQ legal queue | Case and profile updated. |
| WF-LEGAL-01 | E-Courts legal update | REVIEW_PENDING | Reviewer rejects | Ambiguous or incorrect match | DISCARDED | Legal Reviewer | 1 business day | None | Evidence retained but not applied. |
| WF-REQ-01 | Unocross requisition | DRAFTED | Rule engine triggers | Evidence threshold met | REVIEW_PENDING | System | Immediate | Notify analyst queue | Draft package created. |
| WF-REQ-01 | Unocross requisition | REVIEW_PENDING | Approver approves | Draft content complete | APPROVED | Supervisory Officer | 4 business hours | Escalate after SLA breach | Eligible for export/send. |
| WF-REQ-01 | Unocross requisition | APPROVED | Dispatch action invoked | Approved channel available | DISPATCHED | Approver/System | 30 min | Notify if dispatch fails | Dispatch audit recorded. |
| WF-REQ-01 | Unocross requisition | REVIEW_PENDING | Approver rejects | Reason required | REJECTED | Supervisory Officer | 4 business hours | None | Draft retained for audit. |
| WF-LEAD-01 | Lead to memo routing | NEW | Lead submitted | Required fields valid | VALIDATED | Operator/System | 15 min for critical, 1 hour for others | HQ fallback after SLA breach | Lead stored and duplicate check completed. |
| WF-LEAD-01 | Lead to memo routing | VALIDATED | Memo generated | Template available | MEMO_GENERATED | System | 15 min | Notify approver | Memo created. |
| WF-LEAD-01 | Lead to memo routing | MEMO_GENERATED | Submit for approval | Routing target resolved | APPROVAL_PENDING | Operator/System | Immediate | None | Waiting approver action. |
| WF-LEAD-01 | Lead to memo routing | APPROVAL_PENDING | Approver approves | Jurisdiction valid | ROUTED | SP / Zonal Officer | 30 min critical, 4 hours high, 1 business day others | Escalate to HQ if not acted | Memo routed to target officer. |
| WF-LEAD-01 | Lead to memo routing | ROUTED | Target acknowledges | Owner assigned | IN_ACTION | Receiving Officer | 4 business hours | Escalate to supervising officer | Execution underway. |
| WF-LEAD-01 | Lead to memo routing | IN_ACTION | Closure submitted | Closure code and notes present | CLOSED | Receiving Officer / Supervisor | As per case | Escalate overdue open leads weekly | Full digital trail retained. |
| WF-ALERT-01 | Alert handling | OPEN | User acknowledges | Authorized role | ACKNOWLEDGED | Analyst / Officer | 5 min critical, 30 min high, 4 hours medium, 1 business day low | Escalate to next level after breach | Acknowledgement starts response tracking. |
| WF-ALERT-01 | Alert handling | ACKNOWLEDGED | Assign owner | Assignee valid | ASSIGNED | Analyst / Supervisor | Immediate | None | Ownership established. |
| WF-ALERT-01 | Alert handling | ASSIGNED | No action before SLA due | SLA breached | ESCALATED | System | As configured by severity | Escalate to supervisory queue | Escalation history recorded. |
| WF-ALERT-01 | Alert handling | ASSIGNED | Resolution submitted | Evidence attached if required | RESOLVED | Assignee | Variable by alert type | Supervisor review if configured | Resolution recorded. |
| WF-ALERT-01 | Alert handling | RESOLVED | Supervisor closes | Closure valid | CLOSED | Supervisor | 1 business day | Escalate unresolved closure review | Closed record immutable except admin note. |

## 8. Non-Functional Requirements

| NFR ID | Category | Requirement | Verification Method | RFP Ref |
| --- | --- | --- | --- | --- |
| NFR-PER-001 | Performance | P95 search response for standard indexed queries shall be <= 3 seconds on benchmark production hardware. | Load test with 250 concurrent sessions | RFP-TECH-08 |
| NFR-PER-002 | Performance | P95 dossier open time shall be <= 5 seconds when required source enrichments are locally available. | Load test / APM traces | RFP-P2-01 |
| NFR-PER-003 | Performance | Interrogation report generation from already-ingested data shall complete within <= 60 seconds for normal cases. | Timed job benchmark | RFP-P1-11 |
| NFR-PER-004 | Performance | OCR plus extraction of a 50-page PDF shall complete within <= 120 seconds on provisioned processing nodes. | Worker benchmark | RFP-P1-13 |
| NFR-PER-005 | Performance | Priority alert creation from ingested real-time location or scoring event shall occur within <= 5 minutes of event receipt. | Synthetic event test | RFP-BIZ-07 |
| NFR-PER-006 | Performance | Tower dump jobs up to 5 million records shall complete within <= 20 minutes on reference batch hardware or surface queued progress if capacity constrained. | Batch benchmark | RFP-P2-05 |
| NFR-SCL-001 | Scalability | System shall support 1,000 named users and 250 concurrent interactive sessions. | Capacity test | RFP-TECH-08 |
| NFR-SCL-002 | Scalability | System shall support at least 1 million subject profiles, 10 million cases/documents, and 100 million communication events without redesign. | Data volume benchmark | RFP-TECH-08 |
| NFR-SEC-001 | Security | All browser and API traffic shall use TLS 1.2 or higher. | Security configuration review | RFP-TECH-01 |
| NFR-SEC-002 | Security | Sensitive fields at rest shall be encrypted using AES-256 or Department-approved equivalent; encryption keys shall be managed in approved secrets infrastructure. | Security review / penetration test | RFP-TECH-01 |
| NFR-SEC-003 | Security | Field-level masking shall apply to Aadhaar, PAN, bank, passport/visa, and chat evidence unless role-specific permission grants full view. | RBAC test | RFP-TECH-07 |
| NFR-SEC-004 | Security | All approvals, exports, dispatches, and evidence access shall be auditable and tamper-evident. | Audit log verification | RFP-BIZ-06 |
| NFR-SEC-005 | Security | Outbound network access shall be allow-listed; no public AI inference endpoints may be contacted. | Network security review | RFP-TECH-02 |
| NFR-REL-001 | Reliability | Target application uptime shall be 99.5% excluding approved maintenance windows. | Monthly SLA report | RFP-TECH-12 |
| NFR-REL-002 | Reliability | A connector failure shall not block other ingestion pipelines or primary UI availability. | Chaos/failure test | RFP-P1-03 |
| NFR-REL-003 | Reliability | Backups and disaster recovery shall support RPO <= 15 minutes and RTO <= 4 hours where infrastructure permits. | DR drill | RFP-TECH-11 |
| NFR-OBS-001 | Observability | System shall expose health checks, worker queue depth, error rates, connector health, and audit analytics to admins. | Operational monitoring review | RFP-TECH-05 |
| NFR-OBS-002 | Observability | All jobs and API requests shall carry correlation IDs across logs, metrics, and audit events. | Trace inspection | RFP-TECH-05 |
| NFR-LOC-001 | Localization | UI, OCR, and reports shall support English and Telugu with Unicode storage and transliteration-aware search. | Functional test | RFP-P1-13 |
| NFR-AIQ-001 | AI Quality | High-priority extraction fields shall target precision >= 0.90 on the Department-approved validation set before production sign-off. | Model evaluation report | RFP-P1-13 |
| NFR-AIQ-002 | AI Quality | Role classification shall target macro-F1 >= 0.80 on the curated benchmark; otherwise the feature shall operate in manual-review or rule-only mode. | Model evaluation report | RFP-P2-07 |
| NFR-AIQ-003 | AI Quality | Every AI-generated summary, legal mapping, or score explanation shall cite source evidence and model version. | Governance test | RFP-TECH-03 |
| NFR-ACC-001 | Accessibility | Internal web UI shall conform to WCAG 2.1 AA to the extent practical for an intranet application. | Accessibility review | RFP-TECH-08 |
| NFR-MNT-001 | Maintainability | Templates, KPI dictionaries, risk rules, routing rules, and geofences shall be editable by authorized admins without code changes. | Admin configuration test | RFP-TECH-08 |
| NFR-MNT-002 | Maintainability | All deployment artifacts, configuration files, API contracts, and runbooks shall be version-controlled and deliverable to the Department. | Handover checklist | RFP-TECH-09 |
| NFR-RET-001 | Retention | Retention and archive policies shall be configurable by entity type and respect legal hold. | Retention policy test | RFP-BIZ-06 |

## 9. Integration Requirements

| Integration ID | External System | Purpose | Interface Type | Direction | Data Format | Authentication Method | Frequency | Retry Mechanism | Failure Fallback | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-001 | CCTNS | Subject photo, case/crime, identity, legal context | API / DB replica / secure connector | Inbound | JSON / relational rows / files | Service account, mTLS, or DB credentials | Scheduled + on-demand lookups | 3 retries with exponential backoff; queue failures | Manual upload or cached prior snapshot | RFP-P1-03 |
| INT-002 | C-DAT / CDAT | Telecom analysis inputs, link analysis, LBS enrichment | API / DB / file ingestion | Inbound | CSV / JSON / DB rows | Service account / DB credentials | Scheduled + job-based | 3 retries; isolate failures by batch | Manual import of CDAT extracts | RFP-P1-03 |
| INT-003 | CDR | Call detail records | File / API / DB ingestion | Inbound | CSV / TSV / JSON | SFTP, API key, or DB credentials | Batch and on-demand | 3 retries per batch file | Manual file import | RFP-P1-03 |
| INT-004 | IPDR | Internet protocol detail records | File / API / DB ingestion | Inbound | CSV / JSON | SFTP, API key, or DB credentials | Batch | 3 retries per batch | Manual file import | RFP-P1-03 |
| INT-005 | FIR Repository | Primary case document source | File/API/document store | Inbound | PDF / DOCX / JSON | Service account / API token | Scheduled + manual | 3 retries | Manual upload | RFP-P1-03 |
| INT-006 | Confession cum Seizure Memos | Case fact extraction source | Watched folder / upload / API | Inbound | PDF / JPG / PNG / DOCX | Folder credential / upload auth | Manual + scheduled | 3 retries if connector-based | Manual upload | RFP-P1-03 |
| INT-007 | IR Repository | Historical IR lookup and enrichment | File / API | Inbound | PDF / DOCX / JSON | Service account / API token | Scheduled + on-demand | 3 retries | Manual upload | RFP-P1-03 |
| INT-008 | eSakshya | Evidence/document source | API / file sync | Inbound | JSON / PDF / media refs | Service account / API token | Scheduled + on-demand | 3 retries | Manual evidence upload | RFP-P1-03 |
| INT-009 | C-Trace | OSINT enrichment source | Approved connector / import feed | Inbound | JSON / CSV / URL refs | API token / file bridge | Scheduled + analyst-triggered | 3 retries | Manual import | RFP-P1-03 |
| INT-010 | Google Drive / approved equivalent | Monthly Report storage source | OAuth / service account / file bridge | Inbound | PDF / XLSX | OAuth service account or approved local bridge | Scheduled sync | Retry sync 3 times | Manual MR upload | RFP-P1-05 |
| INT-011 | E-Courts | Judgment and bail order monitoring | Browser automation / scraping / approved API | Inbound | HTML / PDF / metadata | Approved connector credentials if any | Periodic monitoring | Retry page fetch; mark unavailable after threshold | Manual upload of court orders | RFP-P1-08 |
| INT-012 | Internal SMTP / email relay | Dispatch of approved memos and requisitions | SMTP / secure mail relay | Outbound | Email text + attachments | Named sender identity or service account | Event-driven | Retry 3 times; then failed-dispatch queue | Manual download/print/email outside system | RFP-P2-10 |
| INT-013 | TS-COP / biometric service | Face-match search where approved | API | Inbound/on-demand | Image / JSON | Service account + legal approval | On-demand only | 2 retries; disable after failure threshold | Hide feature if unavailable | RFP-P2-01 |
| INT-014 | ICJS | Cross-domain enrichment | API / DB link / file | Inbound | JSON / relational rows | Approved credentials | Feature-flagged batch/on-demand | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-015 | Transport databases | Vehicle and DL enrichment | API / DB link / file | Inbound | JSON / relational rows | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-016 | e-Prisons | Prison linkage enrichment | API / DB link / file | Inbound | JSON / relational rows | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-017 | IVFRT | Immigration / passport enrichment | API / DB link / file | Inbound | JSON / relational rows | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-018 | NHAI | Toll/vehicle movement enrichment | API / file | Inbound | JSON / CSV | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-019 | Land/Stamp records | Property and document enrichment | API / file | Inbound | JSON / CSV / PDF refs | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |
| INT-020 | Neighbouring-state APIs | Cross-state intelligence enrichment | API / file | Inbound | JSON / CSV | Approved credentials | Feature-flagged | 3 retries | Disabled until approved | RFP-P1-04 |

## 10. Compliance & Regulatory Mapping

This section captures system controls and audit artefacts derived from the tender. It is not legal advice; it is an implementation control map.

| Compliance ID | Compliance Requirement | Mapped Functional Requirement(s) | System Control | Audit Artifact | RFP Ref |
| --- | --- | --- | --- | --- | --- |
| CMP-001 | On-prem data residency and model sovereignty | FR-01, FR-02, FR-26; NFR-SEC-005; INT-001..020 | No public AI APIs; all data/model artifacts stored on Department infrastructure; egress allow-list only | Deployment diagrams, firewall rules, model registry export | RFP-TECH-01, RFP-TECH-02 |
| CMP-002 | Role-based access and least privilege | FR-01; UI section 11; Audit section 13 | Role-action matrix, jurisdiction scoping, server-side authorization, masked-field policy | User-role matrix, authorization test evidence, access logs | RFP-TECH-07 |
| CMP-003 | Human approval before external legal or financial communication | FR-07, FR-16, FR-21, FR-24 | Approval workflows with named approver, maker-checker option, immutable audit trail | Approval logs, dispatch logs, memo/requisition versions | RFP-P1-10, RFP-P2-10, RFP-BIZ-05 |
| CMP-004 | Digital evidence integrity and chain-of-custody | FR-22; Data section 5; Audit section 13 | SHA-256 hashing, immutable object storage, legal hold, integrity verification API | Hash verification reports, evidence access/export logs, legal hold records | RFP-BIZ-06 |
| CMP-005 | Traceable legal status updates | FR-06, FR-21 | Store court order metadata, review decisions, prior status history, legal mapping version | Legal review queue records, order metadata, audit history | RFP-P1-08, RFP-BIZ-05 |
| CMP-006 | Privacy of sensitive identifiers and financial/chat evidence | FR-01, FR-22; NFR-SEC-002, NFR-SEC-003 | Field-level masking, encryption at rest, restricted export, redacted reporting | Field access logs, penetration test results, masked export samples | RFP-P1-01 |
| CMP-007 | Multilingual processing and standardization | FR-03, FR-08; NFR-LOC-001 | Telugu and English OCR, transliteration-aware search, bilingual templates where required | OCR benchmark results, bilingual UAT cases | RFP-P1-13 |
| CMP-008 | Explainable AI and reviewable decision support | FR-20, FR-21, FR-26; NFR-AIQ-003 | Evidence-cited outputs, factor breakdown, model version tracking, manual override | Model evaluation report, review decisions, prompt/version registry | RFP-BIZ-03, RFP-BIZ-04, RFP-TECH-03 |
| CMP-009 | Operational SLA and escalation governance | FR-24; Workflow section 7; Audit section 13 | SLA timers, escalation rules, acknowledgement tracking, overdue reporting | Alert aging report, workflow task logs, escalation metrics | RFP-BIZ-07 |
| CMP-010 | Department ownership and customizability | Section 16 Delivery/Handover; FR-23; Implementation guidance | Source code, configs, prompts, model artifacts, admin access, documentation handover | Handover checklist, repository export, admin credential transfer record | RFP-TECH-10 |
| CMP-011 | Warranty, support, and training obligations | Section 16 Delivery/Handover | Support staffing, training sessions, hypercare plan, warranty SLA matrix | Attendance sheets, support roster, issue logs, acceptance sign-offs | RFP-TECH-05, RFP-TECH-12, RFP-TECH-13 |
| CMP-012 | Contractual governance and auditability | Section 16 Delivery/Handover; Appendices A/B | Capture payment-linked acceptance, penalties, PBG references, and procurement constraints for governance traceability | Acceptance milestones, risk register, contractual appendix | RFP-CON-01..07 |

## 11. UI / UX Requirements

| Screen ID | Screen Name | Role Visibility | Input Fields / Main Controls | Validation Behaviour | Error Display Rules | Conditional Rendering Logic |
| --- | --- | --- | --- | --- | --- | --- |
| SCR-01 | Login / SSO | All users | Username/SSO button, optional MFA, language selector | SSO required if configured; local login only for approved break-glass accounts | Inline field errors; auth failures shown without revealing account existence | Hide local login when SSO-only mode enabled |
| SCR-02 | Home Dashboard | Role-specific | Global filters, KPI cards, recent alerts, task queue, stale-data indicators | Date range default to last 30 days; filters limited by jurisdiction | Errors shown as widget-level banners; dashboard still renders partial content | Widgets hidden if role lacks permission or source data disabled |
| SCR-03 | Ingestion Queue | District Operator, HQ Admin, System Admin | Source, document type, file name, status, retry count, issues | Manual upload requires document type and source selection | Per-row failure reason and retry action | Retry action visible only to permitted roles and failed states |
| SCR-04 | Document Review | District Operator, Legal Reviewer, Analyst | Document viewer, extracted fields, confidence, source spans, review actions | Reviewer value required for corrected fields; mandatory fields cannot be left empty when finalizing | Field-level validation messages and page-level issue summary | Source pane collapses on smaller screens; legal fields visible only to authorized roles |
| SCR-05 | Subject Profile | IO, Analyst, Legal Reviewer, HQ Admin | 54-column sections, completeness score, evidence links, conflicts, history | Masked fields only revealed to permitted roles; conflict resolution requires reason | Section-level error if related source unavailable | Edit actions hidden when profile status is published and user lacks unlock permission |
| SCR-06 | Search and Dossier | Analyst, IO, Supervisory Officer | Search bar, query type, filters, result grid, match reasons, export | Sensitive query types require permission; page size max 100 | No-result state with suggestions; backend errors shown as search banner | Biometric tile hidden when connector disabled |
| SCR-07 | Network Analysis Graph | Analyst, IO | Seed selector, depth, date range, filters, graph canvas, ranked nodes | Depth max from config; at least one seed required | Async job failure shown with retry option | Export visible only after job completion |
| SCR-08 | Technical Analysis Report | IO, Analyst | Subject/number selector, time window, report preview, export buttons | Time window required; LBS-only sections hidden if data absent | Section-level unavailable labels, not blank spaces | Route maps hidden when map service unavailable but tables still shown |
| SCR-09 | Monthly Report Dashboard | HQ Admin, Analyst, Auditor | Reporting month, district filter, KPI grid, trend charts, review queue link | District-month uniqueness enforced on approval | KPI parsing issues linked to review queue | Approval controls hidden for read-only roles |
| SCR-10 | Alerts Center | Analyst, Supervisor, HQ Admin | Alert list, severity, type, assignee, SLA timer, acknowledge/escalate actions | Critical alerts require immediate action; close requires closure code | Toast + row error on failed action | Escalate/close buttons visible only for PL-3 or configured roles |
| SCR-11 | Lead Entry | Toll-Free Operator, District Operator | Informant fields, channel, location, suspect details, urgency, attachments | Channel, location, urgency mandatory; duplicate warning shown before submit | Field-level validation and duplicate candidate modal | Anonymous lead fields rendered when operator selects anonymous flag |
| SCR-12 | Memo / Requisition Approval Queue | Supervisor, Legal Reviewer, HQ Admin | Pending items, template preview, evidence summary, approve/reject/dispatch | Approve requires decision and, where configured, dispatch channel | Action failure displayed inline and logged | Dispatch controls visible only after approval or when auto-dispatch disabled |
| SCR-13 | Legal Review Queue | Legal Reviewer, HQ Admin | Court orders, candidate sections, match confidence, approve/reject actions | Decision requires reason when rejecting or modifying | Ambiguous matches highlighted with warning badge | Auto-apply controls hidden because human approval mandatory |
| SCR-14 | MIS Report Builder | HQ Admin, Analyst, Auditor | Report catalog, filters, schedule, format, preview, export | Only authorized reports/formats visible | Export job errors displayed in job drawer | Scheduling controls hidden for read-only auditor |
| SCR-15 | Admin Configuration | HQ Admin, System Admin | Templates, KPI dictionary, routing rules, geofences, feature flags, risk weights | Schema validation before save; activation requires approval if configured | Validation errors shown with exact field path | Feature sections hidden based on admin role domain |
| SCR-16 | Audit Trail Viewer | Auditor, HQ Admin, IT/Security | Date range, actor, entity, action, export, integrity view | Date range mandatory; export limited by policy | Query failure shown without exposing internal stack traces | Sensitive snapshot fields masked unless security role permits |

## 12. Reporting & Analytics

| Report ID | Report Name | Data Source | Filters | Aggregations / Output | Export Formats |
| --- | --- | --- | --- | --- | --- |
| REP-001 | Statewide Monthly KPI Dashboard | MR KPI tables | Reporting month, district, zone | Trend lines, totals, district ranking | PDF, XLSX |
| REP-002 | District Operational Performance Report | Cases, leads, alerts, MR KPIs | District, date range, drug type | Counts, averages, closure rates | PDF, XLSX |
| REP-003 | Subject Dossier Export | Subject profile, cases, alerts, evidence | Subject ID, date range | Narrative summary + linked tables | PDF |
| REP-004 | Interrogation Report | FIR, extracted fields, supplements | Case ID, template version | Template-based document | PDF, DOCX |
| REP-005 | Technical Analysis Report | CDR/CDAT/LBS, device history | Subject/number, date range | Top contacts, routes, stay analysis | PDF |
| REP-006 | Network Analysis Report | Graph nodes/edges, cases, communications | Seed set, depth, date range | Ranked nodes, bridge counts, graph stats | PDF, PNG, XLSX |
| REP-007 | Lead Aging and Routing Report | Lead, memo, workflow task | District, urgency, status, age bucket | Open counts, SLA breaches, closure trends | PDF, XLSX |
| REP-008 | Alert Operations Report | Alert, workflow task | Severity, type, district, date range | Alert volume, acknowledgement time, escalation rates | PDF, XLSX |
| REP-009 | Legal Status Change Report | Legal orders, cases, subjects | Date range, district, court, order type | New bail orders, judgments, status changes | PDF, XLSX |
| REP-010 | Audit and Export Activity Report | Audit log | Date range, actor, action, target type | Counts, exception events, export history | PDF, XLSX |
| REP-011 | Model Quality and Governance Report | ModelVersion, evaluations, overrides | Model, feature, date range | Benchmark metrics, override rates, drift indicators | PDF, XLSX |
| REP-012 | Connector Health and Data Freshness Report | ConnectorConfig, ingestion jobs | Source, date range, status | Success rate, last sync, stale sources | PDF, XLSX |

## 13. Audit & Logging

| Log ID | What Is Logged | Who Can View | Retention Period | Notes |
| --- | --- | --- | --- | --- |
| LOG-001 | Authentication events | Login success/failure, MFA challenge, logout, session expiry | IT/Security, System Admin, Auditor | 365 days | Mask secrets; include source IP and auth provider when available |
| LOG-002 | Authorization failures | Forbidden actions, restricted field access attempts | IT/Security, Auditor | 365 days | High-value for security monitoring |
| LOG-003 | Record create/update/delete-intent events | Entity changes, review decisions, merge operations | HQ Admin, Auditor, authorized supervisors | 7 years or legal hold | Hard deletes prohibited for evidence-bearing entities |
| LOG-004 | Approval and dispatch events | Memo approval, requisition approval, dispatch, rejection | Auditor, HQ Admin, Legal Reviewer | 7 years | Named approver mandatory |
| LOG-005 | Evidence access and export events | View, download, print, watermark export, hash verify | Auditor, IT/Security, HQ Admin | 7 years or legal hold | Include justification code when required |
| LOG-006 | AI interaction metadata | Prompt template ID, model version, token counts, response status, citation count | Model Governance Reviewer, IT/Security, Auditor | 3 years | Sensitive prompt/response content visible only to authorized reviewers |
| LOG-007 | Connector and ingestion job events | Sync start/end, retries, failures, schema changes | System Admin, HQ Admin | 180 days | Used for operational support and freshness monitoring |
| LOG-008 | Alert and SLA events | Creation, acknowledgement, escalation, closure, breach | Supervisor, HQ Admin, Auditor | 5 years | Supports operational accountability |
| LOG-009 | Configuration and feature flag changes | Template activation, rule changes, geofence changes, user-role changes | HQ Admin, IT/Security, Auditor | 7 years | Maker-checker approval trail required for governed configs |
| LOG-010 | System health and security events | Service restart, backup, restore, integrity failure, suspicious activity | IT/Security, System Admin | 1 year | Critical security events should trigger alerts |

## 14. Test Case Derivation Section

| Test Case ID | FR ID | Test Scenario | Expected Result |
| --- | --- | --- | --- |
| TC-FR-01-01 | FR-01 | Attempt to export a masked dossier using a role without export permission. | System denies the action, keeps masked fields hidden, and writes an authorization-failure audit event. |
| TC-FR-02-01 | FR-02 | Submit a valid FIR PDF upload and create an ingestion job. | System stores the original file, creates a unique job, and moves the job through queued processing states. |
| TC-FR-03-01 | FR-03 | Upload a bilingual Telugu/English Panchanama with one low-confidence field. | System extracts fields, flags the low-confidence item for review, and preserves field-level provenance. |
| TC-FR-04-01 | FR-04 | Ingest new evidence for an existing subject where one new value conflicts with an approved high-trust value. | System keeps both assertions, marks the field CONFLICTING, and does not overwrite the approved value automatically. |
| TC-FR-05-01 | FR-05 | Sync a district Monthly Report PDF containing all 20 KPIs. | System parses KPIs, routes no-review-needed metrics to approval, and publishes final values to reporting after approval. |
| TC-FR-06-01 | FR-06 | Find a new bail order in E-Courts for a monitored case. | System creates a proposed legal update with court metadata and routes it to legal review before applying. |
| TC-FR-07-01 | FR-07 | Import transaction data showing repeated transfers to the same counterparty with a matched telecom identity. | System generates one approval-pending Unocross draft with evidence summary and suppression-safe idempotent behavior. |
| TC-FR-08-01 | FR-08 | Generate an interrogation report draft where two mandatory fields are unavailable from source data. | System creates the draft, flags the missing fields in manual-entry form, and blocks finalization until resolved. |
| TC-FR-09-01 | FR-09 | Search for a subject by alias transliterated from Telugu to English. | System returns ranked matches with match reasons and allows dossier opening for permitted users. |
| TC-FR-10-01 | FR-10 | Ask the assistant for repeat offenders with new bail orders in the last 30 days. | System returns a grounded summary with cited records, applied filters, and model version metadata. |
| TC-FR-11-01 | FR-11 | Launch a depth-3 network job from a seed subject. | System runs the job asynchronously, ranks common nodes, and exposes graph/table results with factor explanation. |
| TC-FR-12-01 | FR-12 | Generate a technical analysis report for a number with missing route data but available contact data. | System renders available sections, marks route section as Data unavailable, and still produces a valid report. |
| TC-FR-13-01 | FR-13 | Feed a watchlisted target location event entering the Goa geofence. | System creates a geofence alert with correct severity, starts SLA timer, and suppresses duplicates within the configured window. |
| TC-FR-14-01 | FR-14 | Upload a large tower dump file with mixed-format phone numbers. | System normalizes valid numbers, reports invalid entries separately, ranks matched results, and preserves job audit history. |
| TC-FR-15-01 | FR-15 | Run role classification on a case aligned to a known peddler pattern from the benchmark set. | System returns PEDDLER as candidate role with confidence, evidence snippets, and review status. |
| TC-FR-16-01 | FR-16 | Create a high-urgency WhatsApp lead that matches an existing open lead. | System warns of duplicate candidate, allows justified override, creates the lead, and routes memo generation workflow. |
| TC-FR-17-01 | FR-17 | Schedule a district operational report to PDF and XLSX. | System creates export jobs, applies selected filters, watermarks outputs, and records export audit entries. |
| TC-FR-18-01 | FR-18 | Enable a new optional Transport connector in test mode. | System validates the connector config, keeps it feature-flagged until approval, and isolates any failures from core pipelines. |
| TC-FR-19-01 | FR-19 | Ingest a public social-media screenshot and matching text export from an approved source. | System stores both as evidence, clusters them as one content item, and preserves separate provenance records. |
| TC-FR-20-01 | FR-20 | Score a monitored content item linked to a watchlisted subject and containing high-risk keywords. | System assigns a controlled category, calculates a 0-100 risk score with factor breakdown, and routes the item to the priority queue. |
| TC-FR-21-01 | FR-21 | Generate legal section suggestions from FIR and confession facts. | System proposes candidate sections with source-backed rationale and blocks final application until reviewer approval. |
| TC-FR-22-01 | FR-22 | Run integrity verification on an evidence file after retrieval. | System recalculates the SHA-256 hash, confirms match, and logs the verification event; mismatch would quarantine the artifact. |
| TC-FR-23-01 | FR-23 | Activate a new memo template version with maker-checker enabled. | System saves draft version, requires approval, activates only after approver sign-off, and keeps prior version available for history. |
| TC-FR-24-01 | FR-24 | Leave a critical alert unacknowledged past its SLA threshold. | System escalates the alert to the configured supervisory role and logs the escalation timestamp and owner history. |
| TC-FR-25-01 | FR-25 | Merge two duplicate subject candidates with overlapping cases and documents. | System creates one surviving subject, preserves lineage, updates linked records, and writes a merge audit trail. |
| TC-FR-26-01 | FR-26 | Attempt to promote a model version whose benchmark score is below threshold. | System rejects production promotion and places the dependent feature into manual-review or rule-only mode. |

## 15. Implementation Guidance for AI Development

### 15.1 Recommended Service Boundaries

**Delivery strategy recommendation:** because the tender contains a 6-week delivery expectation, Release 1 should be implemented as a **modular monolith with isolated worker processes** rather than a fully distributed microservice estate. Service boundaries below should be treated as module boundaries first and extraction-to-microservice candidates later.

| Service ID | Suggested Service / Module | Responsibilities | Primary Data Store / Schema | Primary API Surface |
| --- | --- | --- | --- | --- |
| SRV-01 | Identity and Access | User auth broker integration, roles, permissions, jurisdiction scope, session policy, audit hooks | identity_access schema, cache | /auth, /users, /roles |
| SRV-02 | Ingestion and Evidence | File intake, connector orchestration, immutable storage, checksums, legal hold, evidence retrieval | evidence_ingestion schema, object storage | /ingestion-jobs, /documents, /evidence |
| SRV-03 | Extraction and NLP | OCR, extraction, bilingual parsing, field review queues | extraction schema, model registry | /extractions, /ocr, /reviews |
| SRV-04 | Subject and Case Intelligence | Subject resolution, profile publication, case linkage, legal section suggestions | case_intelligence schema, search index | /subjects, /cases, /legal-mapping |
| SRV-05 | Analytics and Graph | Search, dossier assembly, link analysis, tower dump ranking, technical report data prep | analytics schema, graph store/search index | /search, /network-analysis, /technical-analysis |
| SRV-06 | Workflow and Approvals | Tasks, approvals, routing, SLA timers, notifications, escalations | workflow schema | /tasks, /approvals, /alerts, /notifications |
| SRV-07 | Lead and Memo Management | Lead intake, memo generation, routing to officers | lead_mgmt schema, template store | /leads, /memos |
| SRV-08 | Reporting and Exports | MIS definitions, dashboards, exports, scheduled jobs | reporting schema, export store | /reports, /exports, /dashboards |
| SRV-09 | AI Runtime and Governance | Model serving, prompt registry, validation, approvals, scoring, categorization | ai_governance schema, model storage | /ai/query, /models, /benchmarks |
| SRV-10 | Admin Configuration | Templates, KPI dictionary, feature flags, geofences, routing rules | admin_config schema | /admin/config, /templates |

### 15.2 Suggested DB Schema Groupings
| Group ID | Schema / Domain | Suggested Tables |
| --- | --- | --- |
| DB-GRP-01 | identity_access | users, roles, permissions, sessions, jurisdiction scopes |
| DB-GRP-02 | evidence_ingestion | ingestion_jobs, source_documents, source_payloads, chain_of_custody, storage_refs |
| DB-GRP-03 | extraction | extraction_fields, extraction_versions, review_decisions, ocr_pages |
| DB-GRP-04 | case_intelligence | subject_profiles, subject_aliases, subject_assertions, cases, legal_orders, subject_case_links |
| DB-GRP-05 | telecom_finance | communication_events, device_history, financial_transactions, location_events |
| DB-GRP-06 | network_analytics | network_nodes, network_edges, graph_jobs, tower_dump_jobs, ranking_results |
| DB-GRP-07 | workflow_ops | workflow_tasks, alerts, notifications, approvals, escalations, SLA policies |
| DB-GRP-08 | lead_mgmt | leads, memos, routing_rules, channel_sources |
| DB-GRP-09 | reporting | report_definitions, schedules, report_runs, KPI_fact tables, dashboard caches |
| DB-GRP-10 | ai_governance | model_versions, prompt_templates, benchmark_runs, override_logs |
| DB-GRP-11 | admin_config | master_data, geofences, template_versions, feature_flags, connector_configs |

### 15.3 Suggested Frontend Module Breakdown
| Frontend Module ID | Module Name | Scope |
| --- | --- | --- |
| FE-01 | Shell and Access | App shell, SSO, session management, language switch, role-aware navigation |
| FE-02 | Ingestion Workspace | Upload flows, queue views, retry controls, evidence metadata |
| FE-03 | Document Review | Viewer, OCR overlays, extraction grid, comparison and review actions |
| FE-04 | Profile and Case Workspace | Subject profile, case view, conflict resolution, legal suggestions |
| FE-05 | Search and Dossier | Universal search, result grids, dossier tabs, export |
| FE-06 | Analytics Workspace | Graph view, technical analysis, tower dump, maps |
| FE-07 | Operations Workspace | Alerts center, leads, memo approvals, legal review queue |
| FE-08 | Reporting Workspace | Dashboards, report builder, export jobs, schedules |
| FE-09 | Administration Workspace | Templates, rules, geofences, users, connectors, model governance |

### 15.4 Suggested Folder Structure
```text
repo/
  apps/
    web/
    admin-console/
  services/
    api/
    worker/
    ai-runtime/
  packages/
    contracts/
      openapi/
      json-schemas/
    ui/
    config/
    prompts/
  db/
    migrations/
    seeds/
    views/
  infra/
    docker/
    kubernetes/
    ansible/
    monitoring/
  tests/
    contract/
    integration/
    e2e/
    benchmark/
  docs/
    architecture/
    runbooks/
    training/

```

### 15.5 Suggested API Grouping
| API Group ID | Grouping | Endpoints |
| --- | --- | --- |
| API-GRP-01 | Identity and user context | /auth, /users, /roles, /permissions |
| API-GRP-02 | Evidence and ingestion | /ingestion-jobs, /documents, /evidence |
| API-GRP-03 | Extraction and review | /ocr, /extractions, /reviews |
| API-GRP-04 | Subject and case | /subjects, /cases, /legal-mapping |
| API-GRP-05 | Search and analytics | /search, /dossiers, /network-analysis, /technical-analysis, /tower-dumps |
| API-GRP-06 | Lead, memo, and alert workflow | /leads, /memos, /alerts, /tasks, /notifications |
| API-GRP-07 | Reporting and exports | /reports, /exports, /dashboards |
| API-GRP-08 | AI runtime and governance | /ai/query, /models, /benchmarks, /prompts |
| API-GRP-09 | Admin configuration | /admin/config, /templates, /master-data, /connectors |

### 15.6 Prompt Engineering Notes
- **PMPT-01:** Use strict JSON-schema output for OCR extraction, legal mapping, scoring explanation, and report population tasks. Reject any response that does not validate.
- **PMPT-02:** Prompts must require evidence citation using internal document IDs/page spans and must explicitly instruct the model to answer 'INSUFFICIENT_EVIDENCE' when unsupported.
- **PMPT-03:** Separate retrieval, reasoning, and rendering prompts. Do not allow direct free-form generation for final governed documents without schema validation and human review.
- **PMPT-04:** Version prompts independently from model binaries; a prompt change requires governance approval and regression tests.
- **PMPT-05:** Use small task-specific prompts for classification and field extraction; reserve larger summarization prompts for dossier and analytic narrative generation.
- **PMPT-06:** Persist all prompt templates, benchmark cases, and expected outputs in version control so AI development tools can regenerate and test reliably.

### 15.7 AI-Assist Development Handoff Guidance
- Generate API contracts first (`OpenAPI` + JSON Schemas), then derive backend controllers, typed clients, and form validators from the same source of truth.
- Represent every workflow state machine as configuration or typed enums before building screens.
- Build evidence preservation, audit, and authorization as first-class cross-cutting concerns before advanced analytics.
- Use deterministic seed data for district, police station, roles, document types, and workflow states to stabilize AI-generated code.
- Encode acceptance criteria into automated contract tests and end-to-end tests before UI assembly for governed features.

## 16. Delivery, Support, Warranty & Acceptance

### 16.1 Proposed Delivery Milestones

**Important:** the tender timeline and the BRD phase durations are inconsistent. The milestone plan below is the proposed reconciliation model and requires sponsor confirmation.

| Milestone ID | Milestone | Target | Entry / Exit Criteria | Acceptance Artifact |
| --- | --- | --- | --- | --- |
| MIL-001 | Kickoff and dependency confirmation | Within 5 business days of PO | Confirm scope, source owners, infra readiness, sample data, acceptance plan | Signed inception report |
| MIL-002 | Environment readiness | By Day 10 from PO | Servers, OS, DB, object storage, search, secrets, network, SMTP, connector access | Environment readiness checklist |
| MIL-003 | Base platform deployment | By end of Week 4 | Deploy auth, ingestion skeleton, evidence storage, admin config, core UI shell | Deployment verification report |
| MIL-004 | Contractual installation complete | By end of Week 7 including installation week | Production deployment installed on Department infrastructure and smoke tested | Installation sign-off |
| MIL-005 | Phase 1 functional completion | Target Month 4 subject to source access and approved templates | Core data, legal intelligence, reporting, governance features live | Phase 1 UAT sign-off |
| MIL-006 | Phase 2 functional completion | Target Month 8 subject to advanced source availability | Dossier, graph, technical analysis, lead workflow, advanced intelligence live | Phase 2 UAT sign-off |
| MIL-007 | Hypercare | 2 weeks post go-live | 3-4 support staff on site, daily issue review, knowledge transfer | Hypercare closure report |

### 16.2 Hosting Infrastructure Bill of Requirements
| Infrastructure ID | Component | Baseline Requirement |
| --- | --- | --- |
| INF-001 | Application nodes | 2+ CPU application nodes, 8 vCPU / 32 GB RAM each minimum for HA baseline |
| INF-002 | Worker/OCR nodes | 2+ worker nodes sized for OCR/extraction throughput; add GPU if model benchmarks require it |
| INF-003 | Database | PostgreSQL HA-capable deployment with SSD-backed storage and encrypted backups |
| INF-004 | Search index | OpenSearch/Elasticsearch cluster sized for full-text search and aggregations |
| INF-005 | Object storage | MinIO or approved equivalent with versioning, immutability/retention support, and encryption |
| INF-006 | Optional graph store | Neo4j or approved graph capability if graph workload exceeds relational/search approach |
| INF-007 | Secrets and certificates | Approved secrets storage plus TLS certificate management |
| INF-008 | Network | Restricted internal network; allow-list egress only for approved sources such as E-Courts and storage bridge |
| INF-009 | Observability | Prometheus/Grafana/ELK or approved equivalent for logs, metrics, traces, and alerts |
| INF-010 | Backup/DR | Snapshot and backup tooling to meet RPO/RTO targets; off-host copy required |

### 16.3 Warranty, Support, Training, and ATS
| Support ID | Service | Duration / Trigger | Scope | Acceptance / SLA |
| --- | --- | --- | --- | --- |
| SUP-001 | Warranty | 1 year from production acceptance | Bug fixes, security patches, maintenance releases, approved upgrades, performance tuning | Response SLA: Critical 4h, High 1 business day, Medium 2 business days, Low 5 business days |
| SUP-002 | On-site engineering support | 6-8 months as per tender | Implementation support, connector tuning, model tuning, environment assistance, issue triage | Department to confirm exact staffing and working hours |
| SUP-003 | Hypercare staffing | 2 weeks post deployment | 3-4 technical manpower on site, daily stand-up, rapid incident handling | Daily ticket/status report |
| SUP-004 | Training | Before go-live and during hypercare | Admin training, operator training, analyst training, reviewer training, security/audit training | Attendance sheets, training materials, recorded demos where allowed |
| SUP-005 | ATS transition | Post warranty, if invoked | Support handover, renewal scope, unresolved issues list, config/model baseline snapshot | ATS proposal and handover pack |

### 16.4 Department Ownership and Handover Artefacts
- **HO-001:** Source code repositories and branch structure
- **HO-002:** Deployment manifests, infrastructure prerequisites, and environment variables template
- **HO-003:** Database schema, migration scripts, seed master data, and API contracts
- **HO-004:** Prompt templates, model registry export, benchmark datasets references, and evaluation reports
- **HO-005:** Admin manuals, operator manuals, runbooks, backup/restore SOPs, and security hardening guide
- **HO-006:** Template package, KPI dictionary, routing rules, geofences, feature flag inventory, and active config export
- **HO-007:** Test evidence, UAT sign-offs, known issues register, and support contact matrix

### 16.5 ATS Transition Baseline
- Export final configuration baseline, active templates, role mappings, prompt registry, model registry, connector inventory, issue backlog, and known workarounds.
- Provide support runbook, escalation contacts, backup/restore SOP, and open-risk register.
- Freeze and sign off production schema and API versions before ATS handover.

### 16.6 Non-System Contractual Clauses Preserved for Governance Traceability
| Appendix Item | Clause Topic | Tender Requirement |
| --- | --- | --- |
| CON-APP-001 | Payment milestones | 80% on delivery and successful installation; 20% after satisfactory performance report 60 days post installation. |
| CON-APP-002 | Penalty/LD | 1% for first week delay, 1.5% for second week, 2% for third week, continuing up to 10%; order cancellation rights after >30 days delay. |
| CON-APP-003 | Performance Bank Guarantee | 5% of project value, valid beyond 30 days post warranty period. |
| CON-APP-004 | Warranty baseline | Minimum 1 year comprehensive onsite warranty on entire solution. |
| CON-APP-005 | Consortium/subcontracting | Not permitted under the tender. |
| CON-APP-006 | Governing law and jurisdiction | Indian law; Hyderabad, Telangana jurisdiction; force majeure and notice clauses apply. |

---

## Appendix A - Gap Analysis Matrix
| RFP Clause | Clause Summary | Present in Current BRD? (Y/N) | Gap Description | Required Enhancement |
| --- | --- | --- | --- | --- |
| RFP-BIZ-01 | Business objective: AI-powered intelligence platform for narcotics trafficking and digital drug promotion networks | Y | BRD states AI-assisted intelligence platform purpose but does not explicitly call out digital drug promotion monitoring as a distinct operational objective. | Add explicit objective, operating context, and measurable outcomes for narcotics and digital promotion network monitoring. |
| RFP-BIZ-02 | Cross-platform monitoring | N | Current BRD has OSINT/C-Trace inputs but no dedicated requirement for cross-platform monitoring across approved online/public channels. | Add a functional requirement for cross-platform content ingestion, normalization, deduplication, lawful source controls, and monitoring queues. |
| RFP-BIZ-03 | AI-based content categorization | N | No implementable requirement defines category taxonomy, model outputs, review flow, or auditability for AI content categorization. | Add a content categorization service with controlled labels, confidence score, explanation, and manual override. |
| RFP-BIZ-04 | Risk scoring and prioritization | N | No scoring model, scoring factors, thresholds, or prioritization workflow is defined. | Add a configurable risk scoring model with 0-100 scale, weighted factors, threshold-based queues, and review/explanation rules. |
| RFP-BIZ-05 | Legal section mapping | N | BRD stores section_of_law but does not define how facts map to candidate legal sections or how reviewers validate them. | Add legal section mapping requirement with rule/model outputs, rationale, review, and versioned legal mapping rules. |
| RFP-BIZ-06 | Digital evidence preservation | Y | BRD includes provenance and retention but does not fully define chain-of-custody events, integrity verification, legal hold actions, or export controls. | Add digital evidence preservation and chain-of-custody controls including SHA-256 hashing, access ledger, legal hold, and verification APIs. |
| RFP-BIZ-07 | Real-time alerts and escalation | Y | BRD covers geofence alerts only; it does not define a generic alerting and escalation engine, SLA timers, notification channels, or escalation levels. | Add alert/escalation framework with statuses, SLA timers, acknowledgement, reassignment, and escalation rules. |
| RFP-P1-01 | 54-column full crime history of a person | Y | Present, but mandatory flags, data dictionary precision, validation rules, and survivorship logic are incomplete. | Expand 54-column schema with attribute-level types, validation rules, provenance, and duplicate/merge rules. |
| RFP-P1-02 | Automatic or semi-automatic population of 54-column schema | Y | Present, but auto-accept thresholds, reviewer gates, and source precedence are not fully specified. | Add confidence thresholds, source trust ranking, approval gates, and field-level conflict handling. |
| RFP-P1-03 | Phase 1 ingestion from CCTNS, C-DAT, CDR, IPDR, FIR, Confession cum Seizure Memo, IR, C-Trace, eSakshya, Google Drive | Y | Present at high level, but per-source interface methods, auth, schedules, retries, and fallback behavior are missing. | Add an integration matrix with method, auth, data formats, sync cadence, retry, and fallback by source. |
| RFP-P1-04 | Phase 3 optional ingestion from ICJS, Transport, e-Prisons, IVFRT, NHAI, Land/Stamp | Y | Present as optional scope, but feature flags, dependency gating, and canonical mapping are not fully specified. | Add pluggable connector framework, approval gates, and mapping rules for optional sources. |
| RFP-P1-05 | Monthly Report ingestion from Google Drive or similar storage | Y | Present, but folder conventions, versioning, and duplicate-finalization controls are not precise enough. | Add naming rules, checksum-based versioning, district-month uniqueness, and review queue criteria. |
| RFP-P1-06 | Extract 20 key MR parameters and update central database | Y | Present, but final KPI dictionary and validation constraints are not defined. | Add KPI master table with metric IDs, formulas, allowed value ranges, and source references. |
| RFP-P1-07 | Automated pictorial and statistical master reports | Y | Present, but report catalog, filters, scheduling rules, and export governance are not specified. | Add reporting catalog with report IDs, filter rules, schedules, and export formats. |
| RFP-P1-08 | Iterative E-Courts scraping for judgments and bail orders | Y | Present, but search keys, rescan cadence, ambiguity handling thresholds, and legal provenance details need precision. | Define E-Courts search strategy, match-confidence thresholds, review workflow, and retention of retrieved orders. |
| RFP-P1-09 | Transaction-CDR cross-check | Y | Present, but data matching keys, confidence rules, and false-link handling are not explicit. | Specify normalization, matching logic, confidence scoring, and partial-match handling. |
| RFP-P1-10 | Automatic draft email/request to Unocross for bank statements | Y | Present, but dispatch controls, template schema, approver roles, and suppression rules need detail. | Add requisition draft template, approval workflow, export/send rules, and suppression/idempotency logic. |
| RFP-P1-11 | Automated interrogation report generation | Y | Present, but versioning, structured field map, and finalization rules need more implementation detail. | Add report template metadata, mandatory field list, role-based editing rules, and export controls. |
| RFP-P1-12 | Mandatory fixed templates for interrogation report | Y | Present, but template governance and effective-dating are not specified. | Add centrally managed template versioning with activation, rollback, and approval workflow. |
| RFP-P1-13 | Panchanama ingestion in text/image/OCR Telugu and English with missing-field manual entry | Y | Present, but OCR confidence thresholds, bilingual validation rules, and unresolved field status handling are not explicit. | Add OCR threshold rules, bilingual extraction support, manual completion workflow, and unresolved field states. |
| RFP-P2-01 | One-click dossier by name/alias/surname/phone/biometric against CCTNS/TS-COP | Y | BRD includes search and optional face match, but TS-COP is not explicitly identified and biometric governance is under-specified. | Add TS-COP as optional approved connector plus biometric search authorization, consent/legal basis, and audit controls. |
| RFP-P2-02 | n-level deep link analysis and kingpin discovery | Y | Present, but computation mode, scoring formula, and performance limits need definition. | Specify async graph jobs, depth limits, ranking logic, and result explanation fields. |
| RFP-P2-03 | Technical analysis report through CDAT including route maps, home/office inference, top contacts, IMEI history, switch-off/silence | Y | Present, but inference rules and unavailable-data behavior need precision. | Add configurable dwell-time rules, ranking logic, silence thresholds, and explicit unavailable-data handling. |
| RFP-P2-04 | LBS tracking/geofencing for Top 50 high-value targets with alerts for Goa/Bengaluru/Mumbai/Orissa Agency | Y | Present, but event latency, geofence source, and escalation behavior are incomplete. | Add watchlist management, geofence master data, alert suppression, event SLA, and escalation rules. |
| RFP-P2-05 | Tower dump analytics with descending criminal/crime link ranking | Y | Present, but ingestion scale, normalization rules, and ranking formula are missing. | Add batch processing rules, number normalization, ranking factors, and async progress tracking. |
| RFP-P2-06 | Drug offender role classification across all NDPS-relevant drug types | Y | Present, but label set, evidence requirements, and fallback rules need definition. | Add controlled role taxonomy, evidence snippets, confidence thresholds, and manual review rules. |
| RFP-P2-07 | Train/tune AI model using Department-provided 50 perfect FIRs | Y | Present, but training governance, benchmark process, and model release controls are missing. | Add model governance, benchmark evaluation, approval workflow, and rollback/manual-only fallback. |
| RFP-P2-08 | Cross-domain data correlation for individuals, vehicles, locations, and events | Y | Present conceptually, but canonical entity model and relationship persistence need more detail. | Add canonical entity/relationship schema and survivorship logic across domains. |
| RFP-P2-09 | Public grievance direct-entry interface | Y | Present, but duplicate detection, SLA, and channel-specific fields need precision. | Add required data fields, duplicate warning rules, SLA priorities, and closure codes. |
| RFP-P2-10 | Automated memo generation and routing to relevant officer with audit trail | Y | Present, but routing rules, approval thresholds, and dispatch audit records need detail. | Add routing matrix, memo statuses, named approver, dispatch channels, and audit artifacts. |
| RFP-TECH-01 | On-prem deployment on private server/local infrastructure | Y | Present, but infrastructure topology and environment sizing are not fully specified. | Add deployment topology, environments, network zones, and baseline hardware sizing. |
| RFP-TECH-02 | Fine-tuned open source LLMs only; no public APIs | Y | Present, but approved model registry, inference boundary, and outbound network controls are not defined. | Add model registry, inference service boundary, egress restrictions, and compliance controls. |
| RFP-TECH-03 | Optimize LLM for intelligent search, summarization, insights, anomaly detection, and natural-language querying | Y | Present via NL query and AI references, but no explicit function boundaries or benchmark criteria exist. | Add AI capability map, model-task mapping, and measurable validation targets. |
| RFP-TECH-04 | DOPAMS software suite shall cover all Phase 1 and Phase 2 modules | Y | BRD phases cover modules, but contractual baseline release acceptance is unclear. | Add release plan, acceptance gates, and dependency-based rollout mapping. |
| RFP-TECH-05 | 6-8 months on-site engineering support | Y | Present, but staffing levels, coverage, and support obligations are not measurable. | Add support model, staffing assumptions, ticket categories, response times, and deliverables. |
| RFP-TECH-06 | MIS reports as per Department requirement | Y | Present, but report governance and change request handling are not explicit. | Add report catalog, configurable layout rules, and change management. |
| RFP-TECH-07 | Role-based access system | Y | Present, but permission matrix by action/entity is not fully enumerated. | Add role-action matrix and jurisdiction-aware authorization rules. |
| RFP-TECH-08 | Scalable and customizable as per Department needs | Y | Present, but target scale and admin-configurable elements need precision. | Add scalability targets, configuration domains, and extension rules. |
| RFP-TECH-09 | Bidder technical document to specify stack, AI, features, validations, and security | N | Current BRD references preferred stack but does not define required technical delivery artifacts. | Add implementation guidance section and handover artifact checklist covering stack, security, AI, validation, and infra. |
| RFP-TECH-10 | Solution ownership and customization by EAGLE Force Telangana | Y | Present in assumptions only; IP ownership and artifact handover are not explicit. | Add ownership clause, source-code/model/config handover requirements, and admin rights. |
| RFP-TECH-11 | Bidder shall inform required hosting infrastructure (hardware/software/OS) | N | No formal infrastructure requirement specification is included. | Add infrastructure bill of requirements with compute, GPU, storage, OS, network, and backup prerequisites. |
| RFP-TECH-12 | 1-year warranty including maintenance and upgrades | Y | Present, but service levels and scope boundaries are not defined. | Add warranty coverage matrix, response/resolution SLA, and excluded events. |
| RFP-TECH-13 | Training to Department officials and 3-4 technical manpower for 2 weeks post deployment | Y | Present, but training outputs, audience, and acceptance criteria are not defined. | Add training plan, materials, attendance, evaluation, and hypercare staffing plan. |
| RFP-TECH-14 | ATS after one year if required | Y | Present, but transition inputs and support handover are not defined. | Add ATS transition checklist and data/config handover requirements. |
| RFP-CON-01 | Deliver solution within 6 weeks of purchase order | N | BRD proposes 3-4 month phases, creating a direct timeline conflict with the tender. | Add contractual delivery baseline, phased deployment interpretation, and clarification dependency. |
| RFP-CON-02 | 1 week allowed for installation | N | Installation window is not explicitly captured in the BRD. | Add installation milestone, environment readiness checklist, and acceptance entry criteria. |
| RFP-CON-03 | Payment terms: 80% after delivery/installation, 20% after satisfactory performance after 60 days | N | Commercial milestone dependencies are absent from the BRD. | Add a non-system contractual appendix with payment-linked acceptance events. |
| RFP-CON-04 | Late delivery/installation penalties up to 10%, order cancellation after 30 days | N | BRD does not capture contractual penalty triggers or milestone governance. | Add contractual appendix with delivery milestone control points and risk tracking. |
| RFP-CON-05 | PBG 5% and warranty conditions | N | Warranty is mentioned, but performance guarantee and acceptance dependencies are not. | Add contractual appendix summarizing PBG and warranty obligations for program governance. |
| RFP-CON-06 | No consortium; no subcontracting | N | Procurement constraint is absent from the BRD. | Add procurement applicability note in contractual appendix; mark as non-system design constraint. |
| RFP-CON-07 | Applicable law, jurisdiction, force majeure, notices | N | Contract administration clauses are not represented in the BRD. | Add a contractual governance appendix to preserve non-system RFP obligations. |

## Appendix B - RFP Traceability Matrix
| RFP Clause | Clause Summary | Refined BRD Coverage | Coverage Status |
| --- | --- | --- | --- |
| RFP-BIZ-01 | Business objective: AI-powered intelligence platform for narcotics trafficking and digital drug promotion networks | 1.1, 2.1, FR-19, FR-20 | Full |
| RFP-BIZ-02 | Cross-platform monitoring | FR-19, INT-009, INT-013 | Full with clarification required |
| RFP-BIZ-03 | AI-based content categorization | FR-20, NFR-AIQ-003, FR-26 | Full with clarification required |
| RFP-BIZ-04 | Risk scoring and prioritization | FR-20, WF-ALERT-01, REP-008 | Full with clarification required |
| RFP-BIZ-05 | Legal section mapping | FR-21, ENT-CASE.sections_of_law, NFR-AIQ-003 | Full with clarification required |
| RFP-BIZ-06 | Digital evidence preservation | FR-22, 5.1, 13, API-14 | Full |
| RFP-BIZ-07 | Real-time alerts and escalation | FR-13, FR-24, WF-ALERT-01, ENT-ALERT | Full |
| RFP-P1-01 | 54-column full crime history of a person | FR-04, 5.1, SCR-05 | Full |
| RFP-P1-02 | Automatic or semi-automatic population of 54-column schema | FR-03, FR-04, FR-25 | Full |
| RFP-P1-03 | Phase 1 ingestion from CCTNS, C-DAT, CDR, IPDR, FIR, Confession cum Seizure Memo, IR, C-Trace, eSakshya, Google Drive | FR-02, INT-001..012, ENT-DOC | Full |
| RFP-P1-04 | Phase 3 optional ingestion from ICJS, Transport, e-Prisons, IVFRT, NHAI, Land/Stamp | FR-18, INT-014..020, ENT-CONN | Full |
| RFP-P1-05 | Monthly Report ingestion from Google Drive or similar storage | FR-05, INT-010, REP-001 | Full |
| RFP-P1-06 | Extract 20 key MR parameters and update central database | FR-05, 5.3 KPI dictionary, REP-001 | Full with clarification required |
| RFP-P1-07 | Automated pictorial and statistical master reports | FR-17, REP-001, REP-002, REP-012 | Full |
| RFP-P1-08 | Iterative E-Courts scraping for judgments and bail orders | FR-06, WF-LEGAL-01, ENT-LEGAL | Full |
| RFP-P1-09 | Transaction-CDR cross-check | FR-07, ENT-TXN, API-07 | Full |
| RFP-P1-10 | Automatic draft email/request to Unocross for bank statements | FR-07, WF-REQ-01, SCR-12 | Full |
| RFP-P1-11 | Automated interrogation report generation | FR-08, API-06, REP-004 | Full |
| RFP-P1-12 | Mandatory fixed templates for interrogation report | FR-08, FR-23, SCR-15 | Full |
| RFP-P1-13 | Panchanama ingestion in text/image/OCR Telugu and English with missing-field manual entry | FR-03, FR-08, SCR-04, NFR-LOC-001 | Full |
| RFP-P2-01 | One-click dossier by name/alias/surname/phone/biometric against CCTNS/TS-COP | FR-09, INT-013, SCR-06 | Full with clarification required |
| RFP-P2-02 | n-level deep link analysis and kingpin discovery | FR-11, WF-NET-implicit, REP-006 | Full |
| RFP-P2-03 | Technical analysis report through CDAT including route maps, home/office inference, top contacts, IMEI history, switch-off/silence | FR-12, ENT-COMM, ENT-LOC, REP-005 | Full |
| RFP-P2-04 | LBS tracking/geofencing for Top 50 high-value targets with alerts for Goa/Bengaluru/Mumbai/Orissa Agency | FR-13, ENT-ALERT, SCR-10 | Full |
| RFP-P2-05 | Tower dump analytics with descending criminal/crime link ranking | FR-14, REP-006, API-07 | Full |
| RFP-P2-06 | Drug offender role classification across all NDPS-relevant drug types | FR-15, ENT-SUBJ.offender_role | Full |
| RFP-P2-07 | Train/tune AI model using Department-provided 50 perfect FIRs | FR-15, FR-26, NFR-AIQ-002 | Full |
| RFP-P2-08 | Cross-domain data correlation for individuals, vehicles, locations, and events | FR-04, FR-09, FR-25, ENT-NODE/EDGE | Full |
| RFP-P2-09 | Public grievance direct-entry interface | FR-16, SCR-11, ENT-LEAD | Full |
| RFP-P2-10 | Automated memo generation and routing to relevant officer with audit trail | FR-16, FR-24, WF-LEAD-01, ENT-MEMO | Full |
| RFP-TECH-01 | On-prem deployment on private server/local infrastructure | 2.4, 8, 9, 16.1 | Full |
| RFP-TECH-02 | Fine-tuned open source LLMs only; no public APIs | 2.4, FR-10, FR-26, NFR-SEC-005 | Full |
| RFP-TECH-03 | Optimize LLM for intelligent search, summarization, insights, anomaly detection, and natural-language querying | FR-10, FR-20, FR-21, FR-26, 15.6 | Full |
| RFP-TECH-04 | DOPAMS software suite shall cover all Phase 1 and Phase 2 modules | 2.1, 10, 16.1 | Full |
| RFP-TECH-05 | 6-8 months on-site engineering support | 16.3, NFR-OBS-001, CQ-17 | Full with clarification required |
| RFP-TECH-06 | MIS reports as per Department requirement | FR-17, Section 12 | Full |
| RFP-TECH-07 | Role-based access system | FR-01, Section 3, NFR-SEC-003 | Full |
| RFP-TECH-08 | Scalable and customizable as per Department needs | 2.4, 8, FR-23, 15.1 | Full |
| RFP-TECH-09 | Bidder technical document to specify stack, AI, features, validations, and security | 15.1-15.6, 16.4 | Full |
| RFP-TECH-10 | Solution ownership and customization by EAGLE Force Telangana | 2.4, 16.4, CMP-010 | Full |
| RFP-TECH-11 | Bidder shall inform required hosting infrastructure (hardware/software/OS) | 16.2, 15.2, CQ-14 | Full with clarification required |
| RFP-TECH-12 | 1-year warranty including maintenance and upgrades | 16.3, NFR-REL-001 | Full |
| RFP-TECH-13 | Training to Department officials and 3-4 technical manpower for 2 weeks post deployment | 16.3, 16.5, CQ-17 | Full |
| RFP-TECH-14 | ATS after one year if required | 16.3, 16.5 | Full |
| RFP-CON-01 | Deliver solution within 6 weeks of purchase order | 16.1, Appendix B, CQ-01 | Full with clarification required |
| RFP-CON-02 | 1 week allowed for installation | 16.1, 16.2 | Full with clarification required |
| RFP-CON-03 | Payment terms: 80% after delivery/installation, 20% after satisfactory performance after 60 days | 16.6, Appendix B | Referenced - contractual/non-system |
| RFP-CON-04 | Late delivery/installation penalties up to 10%, order cancellation after 30 days | 16.6, Appendix B | Referenced - contractual/non-system |
| RFP-CON-05 | PBG 5% and warranty conditions | 16.3, 16.6 | Referenced - contractual/non-system |
| RFP-CON-06 | No consortium; no subcontracting | 16.6, Appendix B | Referenced - contractual/non-system |
| RFP-CON-07 | Applicable law, jurisdiction, force majeure, notices | 16.6, Appendix B | Referenced - contractual/non-system |

## Appendix C - Clarification Questions
| Question ID | Clarification Question |
| --- | --- |
| CQ-01 | The tender requires delivery within 6 weeks plus 1 week installation, but the BRD assumes multi-month Phase 1 and Phase 2 delivery. Which interpretation governs contractual acceptance: core MVP in 6 weeks, or full Phase 1+2 rollout? |
| CQ-02 | Please confirm the final Department-approved 54-column dictionary, including whether gang associates should remain fixed 11 columns in outputs or be physically normalized in the database. |
| CQ-03 | Please provide the final list of 20 Monthly Report KPIs, including definitions, formulas, allowed ranges, and reporting month conventions. |
| CQ-04 | Please confirm which Phase 1 sources are available on day 1, their integration method (API/DB/file), and whether sample data plus credentials can be provided for each. |
| CQ-05 | Is TS-COP integration formally approved for face-match search? If yes, what are the legal, process, and audit constraints for biometric use? |
| CQ-06 | For cross-platform monitoring, which channels/platforms are explicitly approved, and does scope include only public OSINT plus lawfully obtained exports, or additional sources? |
| CQ-07 | Please confirm the approved taxonomy and factor weights for AI content categorization and risk scoring, or whether the proposed defaults should be treated as the baseline for UAT. |
| CQ-08 | Please confirm the legal section mapping scope: NDPS only, or NDPS plus IPC/CrPC/IT Act or other allied sections. |
| CQ-09 | Please confirm retention periods for evidence, audit logs, alerts, leads, reports, and model-governance artifacts, especially where legal hold may apply. |
| CQ-10 | Should approved Unocross outputs be exported only, or should the system also send them through Department SMTP automatically after approval? |
| CQ-11 | Please provide geofence coordinates/polygons and the exact meaning of 'Orissa Agency areas' for operational alerting. |
| CQ-12 | Please confirm SLA expectations for critical, high, medium, and low alerts, lead routing, legal review, and approval tasks. |
| CQ-13 | Will Google Drive remain approved for MR sync in production, or must it be replaced with an on-prem file share or other Department-approved bridge? |
| CQ-14 | Please confirm baseline infrastructure: CPU, GPU, RAM, storage, OS, DB/search/object-storage standards, and whether Kubernetes is permitted. |
| CQ-15 | What are the acceptance criteria for the 50 ideal FIR benchmark set, and who is the named approver for extraction, classification, and legal mapping model readiness? |
| CQ-16 | Please confirm whether DOCX export is allowed for final interrogation reports or only for drafts, with final records restricted to PDF. |
| CQ-17 | Please confirm the exact support model for the 6-8 month on-site engineering support period, including working hours, staff count, and ticket SLAs. |
| CQ-18 | Please confirm whether procurement-only clauses such as payment milestones, PBG, and no-subcontracting should be tracked inside the BRD appendix or separately in the project charter/contract register. |
