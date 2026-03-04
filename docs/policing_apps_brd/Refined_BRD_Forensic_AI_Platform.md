# Refined BRD - AI-Powered Centralized Digital Forensic Analysis & Reporting System

**Document ID:** BRD-R2-FORENSIC-AI  
**Version:** 2.0 (Implementation-Ready, RFP-Aligned)  
**Status:** Draft for architecture, engineering, QA, and AI-assisted development  
**Primary source documents:** `BRD - Forensic.pdf` and `Tender - Forensic.pdf`  
**Prepared for:** EAGLE FORCE Telangana / TGTSL implementation planning  
**Intended use:** Backend, frontend, API, database, workflow engine, QA automation, and AI code-generation platforms

## 0. Gap Analysis Summary

- Total RFP requirement clauses traced: **73**
- Clauses present in original BRD (fully or partially): **54**
- Clauses absent from original BRD: **19**
- Primary gap themes: measurable acceptance criteria, API/database detail, workflow/state machine detail, support/hypercare obligations, UAT acceptance, infrastructure disclosure, and non-product procurement/commercial traceability.

## 1. Executive Summary

### 1.1 Business Objectives
| Objective ID | Objective | RFP Traceability |
| --- | --- | --- |
| OBJ-001 | Unify fragmented forensic outputs into a single case-centric platform. | RFP-OBJ-01, RFP-SOW-01, RFP-SOW-03 |
| OBJ-002 | Reduce manual triage effort and shorten case turnaround through automated ingestion, AI triage, and reusable report assembly. | RFP-OBJ-02, RFP-OBJ-03, RFP-SOW-04, RFP-SOW-10 |
| OBJ-003 | Improve detection of narcotics-related and other illicit patterns across communications, media, documents, and financial indicators. | RFP-OBJ-05, RFP-SOW-04, RFP-SOW-05 |
| OBJ-004 | Produce consistent court-ready outputs with full provenance, chain of custody, and supervisory approval. | RFP-OBJ-04, RFP-ARCH-03, RFP-ARCH-04, RFP-SOW-10 |
| OBJ-005 | Synchronize case progress and report references with DOPAMS for centralized case visibility. | RFP-OBJ-06, RFP-SOW-13, RFP-SOW-14 |

### 1.2 System Goals
| Goal ID | Goal |
| --- | --- |
| GOAL-001 | 100% of imported evidence packages shall be traceable to case_id, evidence_id, source_tool, source_file, parser_version, and import timestamp. |
| GOAL-002 | 100% of generated reports shall reference only reviewed findings and preserve report version history. |
| GOAL-003 | Critical and high-risk findings shall be visible in the analyst queue within 30 seconds of scoring completion. |
| GOAL-004 | The platform shall support at least 25 concurrent active users and 10 simultaneous import jobs in the baseline deployment. |
| GOAL-005 | No case data shall be transmitted to public external AI services unless explicitly approved by the department. |

### 1.3 Expected ROI
| ROI ID | Measure |
| --- | --- |
| ROI-001 | Reduce manual evidence triage effort per case by at least 40% against the department's pre-implementation baseline measured during pilot. |
| ROI-002 | Reduce report compilation time per case by at least 60% against the pre-implementation baseline. |
| ROI-003 | Achieve 100% use of standardized report templates for final published reports. |
| ROI-004 | Reduce duplicate analyst review of already-correlated identifiers by at least 30% through entity resolution and saved review context. |

### 1.4 Strategic Alignment
| Alignment ID | Alignment |
| --- | --- |
| ALN-001 | Supports EAGLE FORCE narcotics and organized-crime investigations through faster intelligence extraction. |
| ALN-002 | Supports TGTSL procurement objective for a deployable, department-owned, scalable platform. |
| ALN-003 | Supports centralized case governance through DOPAMS linkage and auditable approvals. |

## 2. Scope Definition

### 2.1 In Scope
| Scope ID | Item |
| --- | --- |
| SCP-IN-001 | Case creation, assignment, status tracking, and optional DOPAMS case linkage. |
| SCP-IN-002 | Evidence registration and immutable storage of uploaded forensic export packages. |
| SCP-IN-003 | Parser/adaptor support for UFED, XRY, Oxygen, FTK, Magnet AXIOM, Belkasoft, and similar export packages using a plugin pattern. |
| SCP-IN-004 | Normalization of supported source data into a canonical internal schema. |
| SCP-IN-005 | AI/rule-based analysis of messages, call logs, multimedia, documents, browsing history, app usage, social-media artifacts, identity documents, and financial indicators. |
| SCP-IN-006 | OCR/document-text extraction inside approved infrastructure when enabled. |
| SCP-IN-007 | Entity extraction, relationship graphing, timeline analysis, and risk scoring. |
| SCP-IN-008 | Analyst dashboard, search, filtering, evidence preview, annotations, and review queues. |
| SCP-IN-009 | Legal section mapping suggestions using configurable rule tables. |
| SCP-IN-010 | Configurable report generation, approval, redaction, and PDF/DOCX export. |
| SCP-IN-011 | DOPAMS inbound/outbound integration for case reference, status, summary metadata, and report references. |
| SCP-IN-012 | RBAC, SSO/local authentication, audit logging, chain-of-custody export, MIS reports, and configuration governance. |
| SCP-IN-013 | Deployment guidance for on-premise, hybrid, or cloud in a customer-controlled environment. |
| SCP-IN-014 | Training, documentation, warranty, maintenance, hypercare, and support handover deliverables. |

### 2.2 Out of Scope
| Scope ID | Item |
| --- | --- |
| SCP-OUT-001 | Physical device acquisition, forensic imaging, or extraction from source devices. |
| SCP-OUT-002 | Replacement of UFED, XRY, Oxygen, FTK, Magnet AXIOM, Belkasoft, or any other source acquisition tools. |
| SCP-OUT-003 | Live lawful interception, telecom interception, or network surveillance. |
| SCP-OUT-004 | Autonomous legal decision-making or automated case closure without human approval. |
| SCP-OUT-005 | Open-web or social-media crawling unrelated to extracted forensic data unless approved as a future phase. |
| SCP-OUT-006 | Cross-case pattern analytics for all historical cases in the MVP unless expressly enabled in a later phase. |
| SCP-OUT-007 | Department hardware procurement, except definition of hosting requirements. |

### 2.3 Assumptions
| Assumption ID | Assumption |
| --- | --- |
| ASM-001 | DOPAMS integration interfaces, credentials, and field definitions will be provided before integration build completion. |
| ASM-002 | Representative export packages from each named forensic tool will be supplied for parser development and validation. |
| ASM-003 | Customer-approved infrastructure, network access, and storage quotas will be available before installation. |
| ASM-004 | Department legal-section taxonomy and mapping rules will be supplied or ratified during design. |
| ASM-005 | All AI inference, OCR, and text extraction will execute only inside approved infrastructure. |
| ASM-006 | The MVP user interface language is English; evidence content may be multilingual. |
| ASM-007 | Pilot baseline metrics for ROI measurement will be captured during discovery or early UAT. |

### 2.4 Constraints
| Constraint ID | Constraint |
| --- | --- |
| CON-REG-001 | The system shall comply with applicable Indian law, departmental SOPs, and deployment-environment cybersecurity and data-protection obligations. |
| CON-REG-002 | Source evidence must remain immutable after ingestion except for creation of linked derived artifacts and processing versions. |
| CON-INF-001 | The baseline delivery window is 6 weeks from purchase order plus 1 week for installation. |
| CON-INF-002 | The solution must be deployable on customer-specified on-premise, hybrid, or cloud infrastructure. |
| CON-SEC-001 | No case data shall be sent to public external AI services without written department approval. |
| CON-SEC-002 | All privileged user operations shall require MFA when local authentication is used. |
| CON-PERF-001 | 95th percentile standard UI response time shall be 3 seconds or less under baseline load. |
| CON-PERF-002 | The architecture shall support at least 100 named users, 25 concurrent users, and 10 simultaneous import jobs in the baseline deployment. |

## 3. Stakeholders & Roles

| Role ID | Role Name | Description | System Permissions Level |
| --- | --- | --- | --- |
| ROL-001 | Administrator | Manages users, roles, configuration, environments, integrations, and operational monitoring. | PL-5 Admin |
| ROL-002 | Supervisor / Approver | Reviews escalations, approves legal mappings and final reports, reopens/closes cases, and manages SLA breaches. | PL-4 Supervisory |
| ROL-003 | Forensic Analyst | Registers evidence, reviews artifacts and findings, annotates evidence, prepares reports, and executes case work. | PL-3 Analyst |
| ROL-004 | Investigator / Case Officer | Views case progress, consumes approved findings and reports, and monitors DOPAMS linkage. | PL-2 Controlled Read / Request |
| ROL-005 | Auditor / Legal Reviewer | Views evidence lineage, audit logs, chain-of-custody records, approvals, and finalized reports. | PL-2 Audit Read |
| ROL-006 | Integration Service | Machine identity used for DOPAMS, webhook, and scheduled integration operations. | PL-SVC Service Account |
| ROL-007 | Configuration Manager | Publishes dictionaries, legal mappings, report templates, and model metadata in environments where admin duties are segregated. | PL-4 Config Admin |
| ROL-008 | Support / Hypercare Operator | Monitors jobs, logs, and incidents during deployment and warranty period without direct evidence export rights. | PL-2 Ops Support |

## 4. Functional Requirements

All functional requirements are written as testable implementation statements. Each feature includes user stories, acceptance criteria, business rules, edge cases, and failure handling.

### FR-01 - Case Management & Assignment

**Priority:** Must Have  
**Description:** Manage the master investigation record, ownership, status progression, and DOPAMS case linkage.  
**RFP Traceability Reference:** RFP-OBJ-01, RFP-OBJ-06, RFP-SOW-13, RFP-DEL-10

**User Stories**
- **US-FR-01-01** - As a forensic analyst, I want to create or open a case so that all evidence and findings are tracked under a single investigation record.
- **US-FR-01-02** - As a supervisor, I want to assign owners and control case status transitions so that accountability and approvals are enforced.

**Acceptance Criteria**
- **AC-FR-01-01** - The system shall create a unique immutable case_id for every case using a non-sequential UUID.
- **AC-FR-01-02** - A case shall not transition from Draft to Active until case_title, case_reference, investigating_unit, case_priority, assigned_owner_user_id, and case_source are populated.
- **AC-FR-01-03** - Case status values shall be limited to Draft, Active, IngestionInProgress, UnderReview, ReportReady, Submitted, Closed, and Reopened.
- **AC-FR-01-04** - Only users with Supervisor or Administrator permission shall transition a case to Closed or Reopened.
- **AC-FR-01-05** - The platform shall support linking one internal case to zero or one primary DOPAMS case reference and zero or more external reference IDs.
- **AC-FR-01-06** - The case audit trail shall record create, update, assign, status_change, close, and reopen actions.

**Business Rules**
- **BR-FR-01-01** - case_reference must be unique within the combination of investigating_unit and case_year.
- **BR-FR-01-02** - A case with status Closed is read-only except for supervisor-authorized reopen operations.
- **BR-FR-01-03** - At least one owner_user_id must be active for any case in Active or later status.

**Edge Cases**
- **EC-FR-01-01** - Case linked to a DOPAMS reference that is later merged or superseded in DOPAMS.
- **EC-FR-01-02** - Case requires reassignment because the original owner becomes inactive.

**Failure Handling**
- **FH-FR-01-01** - If DOPAMS case reference validation fails, the case shall still save in Draft and surface validation_status=PendingExternalValidation.
- **FH-FR-01-02** - If status transition rules fail, the API shall return HTTP 422 with the list of missing or invalid fields.

### FR-02 - Evidence Intake & Registration

**Priority:** Must Have  
**Description:** Register uploaded forensic export packages and preserve original evidence packages as immutable source records.  
**RFP Traceability Reference:** RFP-SOW-01, RFP-SOW-02, RFP-OBJ-11, RFP-ARCH-03, RFP-ARCH-04

**User Stories**
- **US-FR-02-01** - As an analyst, I want to upload evidence packages and capture source metadata so that import jobs can be executed reproducibly.
- **US-FR-02-02** - As an auditor, I want every evidence package to be retained as an immutable source record so that forensic soundness is preserved.

**Acceptance Criteria**
- **AC-FR-02-01** - The system shall register each uploaded package with evidence_id, case_id, source_tool, source_file_name, source_device_ref, received_at, received_by, checksum_type, checksum_value, and size_bytes.
- **AC-FR-02-02** - The original uploaded file or archive shall be stored in immutable object storage and shall not be overwritten by reprocessing operations.
- **AC-FR-02-03** - The upload API shall require an Idempotency-Key and shall not create duplicate evidence records for identical retries within 24 hours.
- **AC-FR-02-04** - If a package checksum does not match a caller-supplied checksum, the evidence record shall enter Quarantined status and downstream processing shall be blocked.
- **AC-FR-02-05** - The UI shall support one or more evidence packages per case and display upload progress, validation warnings, and the created import_job_id.
- **AC-FR-02-06** - Duplicate-package detection shall flag previously uploaded packages for the same case when checksum_value and size_bytes both match.

**Business Rules**
- **BR-FR-02-01** - evidence_status values shall be Registered, UploadAccepted, Quarantined, Parsing, Normalized, Completed, CompletedWithWarnings, and Failed.
- **BR-FR-02-02** - A duplicate package may be retained only when the analyst enters a reason_code approved by a supervisor.
- **BR-FR-02-03** - Immutable source files shall never be hard-deleted by end users.

**Edge Cases**
- **EC-FR-02-01** - Upload interrupted after metadata save but before object-storage commit.
- **EC-FR-02-02** - Upload retry with same Idempotency-Key but different checksum or file size.
- **EC-FR-02-03** - Source package is a ZIP containing nested exports from multiple tools.

**Failure Handling**
- **FH-FR-02-01** - If object storage commit fails, the evidence record shall remain in Registered status with validation_error_code=OBJECT_STORE_WRITE_FAILED.
- **FH-FR-02-02** - If duplicate detection fires, the UI shall require explicit analyst confirmation and record the decision.

### FR-03 - Multi-Tool Ingestion, Parsing & Normalization

**Priority:** Must Have  
**Description:** Parse supported exports from named forensic tools and map their content into a canonical artifact schema.  
**RFP Traceability Reference:** RFP-SOW-01, RFP-SOW-02, RFP-SOW-03, RFP-ARCH-02, RFP-DEL-09

**User Stories**
- **US-FR-03-01** - As an analyst, I want exports from different tools converted into a common schema so that I can search and compare evidence consistently.
- **US-FR-03-02** - As an administrator, I want parser versions and warnings preserved so that normalization can be governed and improved without losing provenance.

**Acceptance Criteria**
- **AC-FR-03-01** - The platform shall support parser adapters for UFED, XRY, Oxygen, FTK, Magnet AXIOM, Belkasoft, and a configurable generic adapter framework.
- **AC-FR-03-02** - Supported input containers shall include CSV, JSON, XML, HTML, PDF, ZIP, and tool-generated export folders where parser adapters are available.
- **AC-FR-03-03** - Normalized artifact types shall include Message, CallLog, Contact, MediaImage, MediaVideo, Audio, Document, BrowsingHistory, AppUsage, SocialArtifact, FinancialIndicator, IdentityDocument, DerivedText, and Unknown.
- **AC-FR-03-04** - Every normalized artifact shall retain source_tool, source_file_path, source_record_id, parser_version, import_job_id, artifact_type, and normalization_timestamp.
- **AC-FR-03-05** - Import job status values shall be Queued, Parsing, Normalized, Completed, CompletedWithWarnings, Failed, and Cancelled.
- **AC-FR-03-06** - Reprocessing shall create a new import_job version and shall not overwrite the source evidence record or prior normalized artifacts.

**Business Rules**
- **BR-FR-03-01** - Unsupported file types shall be rejected before parsing; mixed packages may still process supported items.
- **BR-FR-03-02** - Import jobs shall be restart-safe; partial writes shall be associated with the current job version only.
- **BR-FR-03-03** - Artifact timestamps shall preserve original timezone when available and default to UTC with timezone_unknown=true when not available.

**Edge Cases**
- **EC-FR-03-01** - Source package contains corrupt HTML/PDF but valid CSV/JSON components.
- **EC-FR-03-02** - Source artifacts do not include timestamps or sender identifiers.
- **EC-FR-03-03** - Parser version changes between initial import and reprocessing.

**Failure Handling**
- **FH-FR-03-01** - On parser failure for a subset of files, the job shall continue for other files and complete as CompletedWithWarnings.
- **FH-FR-03-02** - If all files fail parsing, the job shall end in Failed and return a machine-readable error summary.

### FR-04 - Evidence Preservation, Audit Trail & Chain of Custody

**Priority:** Must Have  
**Description:** Enforce immutability, lineage, access logging, and exportable chain-of-custody records for every case and evidence object.  
**RFP Traceability Reference:** RFP-OBJ-11, RFP-ARCH-03, RFP-ARCH-04, RFP-SOW-10

**User Stories**
- **US-FR-04-01** - As a legal reviewer, I want all evidence actions to be traceable so that the system remains defensible in legal proceedings.

**Acceptance Criteria**
- **AC-FR-04-01** - The system shall create immutable audit events for import, view, search, annotation, export, report_generation, report_approval, sync, configuration_change, login, logout, and role_change.
- **AC-FR-04-02** - Each audit event shall include audit_event_id, timestamp_utc, actor_user_id, actor_role_id, case_id, object_type, object_id, action, source_ip, and outcome.
- **AC-FR-04-03** - The platform shall export a chain-of-custody log for a case, evidence source, artifact, or report in PDF and CSV formats.
- **AC-FR-04-04** - The system shall preserve prior processing versions and expose version lineage for reprocessed evidence.
- **AC-FR-04-05** - The audit viewer shall permit filters by case_id, actor, action, object_type, date_range, and outcome.

**Business Rules**
- **BR-FR-04-01** - Audit records and source evidence are immutable; correction requires append-only compensating records.
- **BR-FR-04-02** - Only Auditor, Supervisor, and Administrator roles may access the audit viewer; only Supervisor and Administrator may export audit logs.

**Edge Cases**
- **EC-FR-04-01** - Privileged user views restricted evidence but export is denied.
- **EC-FR-04-02** - Clock skew between application nodes affects event timestamp ordering.

**Failure Handling**
- **FH-FR-04-01** - If audit write fails, the triggering transactional action shall fail unless the event type is read-only search telemetry.
- **FH-FR-04-02** - If chain-of-custody export generation fails, the system shall retain the export request and expose a retry action to authorized users.

### FR-05 - Artifact Repository, Search & Review Workspace

**Priority:** Must Have  
**Description:** Provide case dashboards, full-text search, faceted filtering, evidence previews, and analyst annotations across all normalized artifacts.  
**RFP Traceability Reference:** RFP-SOW-07, RFP-SOW-08, RFP-DEL-02, RFP-ANN-01

**User Stories**
- **US-FR-05-01** - As an analyst, I want a centralized workspace with search, filters, and previews so that I can review large evidence sets efficiently.
- **US-FR-05-02** - As an investigator, I want to view approved findings and related artifacts without modifying evidence.

**Acceptance Criteria**
- **AC-FR-05-01** - The case dashboard shall display counts by artifact_type, findings by severity, pending reviews, import status, latest activity, and integration status.
- **AC-FR-05-02** - The search service shall support full-text search and faceted filters for artifact_type, date_range, identifier, source_tool, risk_band, review_status, language_code, and case_id.
- **AC-FR-05-03** - The UI shall provide at minimum table, timeline, graph, gallery/document preview, and finding-detail views.
- **AC-FR-05-04** - Selecting a finding or artifact shall open source context including surrounding message thread, nearby call records, or linked document preview where available.
- **AC-FR-05-05** - Users with write access shall be able to add case notes and artifact annotations with visibility_scope values Private, CaseTeam, and SupervisorOnly.
- **AC-FR-05-06** - Search results shall be paginated and sortable by timestamp, risk_score, source_tool, artifact_type, and updated_at.

**Business Rules**
- **BR-FR-05-01** - Search results must always include lineage fields sufficient to retrieve the original artifact or source evidence.
- **BR-FR-05-02** - Annotations do not modify the underlying artifact content.

**Edge Cases**
- **EC-FR-05-01** - Artifact lacks previewable content but includes metadata only.
- **EC-FR-05-02** - Very large result sets exceed default page size.
- **EC-FR-05-03** - Relationship graph contains more nodes than the default render threshold.

**Failure Handling**
- **FH-FR-05-01** - If preview rendering fails, the UI shall display metadata-only fallback and expose download-original where permissions allow.
- **FH-FR-05-02** - If search index is stale or unavailable, the UI shall show index_status and allow retry without data loss.

### FR-06 - OCR & Derived Artifact Generation

**Priority:** Must Have  
**Description:** Extract text from images and documents within approved infrastructure and persist the result as derived artifacts linked to source objects.  
**RFP Traceability Reference:** RFP-SOW-04, RFP-ANN-01, RFP-ARCH-03, RFP-ARCH-06

**User Stories**
- **US-FR-06-01** - As an analyst, I want text extracted from screenshots, identity documents, and PDFs so that AI and search can operate on otherwise image-only evidence.

**Acceptance Criteria**
- **AC-FR-06-01** - When OCR is enabled, the system shall create a DerivedText artifact for each successfully processed image or document page.
- **AC-FR-06-02** - Each derived artifact shall store derived_artifact_id, source_artifact_id, extraction_engine, extraction_version, language_hint, extraction_confidence, and extracted_text.
- **AC-FR-06-03** - The source-to-derived relationship shall be visible in both the artifact detail view and report assembly view.
- **AC-FR-06-04** - OCR failures on one artifact shall not block import completion for other artifacts in the same job.
- **AC-FR-06-05** - The platform shall support Unicode evidence text and at minimum English, Telugu, and Hindi language hints.

**Business Rules**
- **BR-FR-06-01** - Derived artifacts inherit the case_id and evidence_id of the source artifact.
- **BR-FR-06-02** - Derived artifacts are not treated as original evidence and must be clearly marked derived=true in UI and exports.

**Edge Cases**
- **EC-FR-06-01** - Low-quality image produces low-confidence OCR output.
- **EC-FR-06-02** - Same PDF page is reprocessed with an upgraded OCR engine.

**Failure Handling**
- **FH-FR-06-01** - If OCR service is unavailable, the system shall mark extraction_status=Deferred and queue a retry.
- **FH-FR-06-02** - If OCR returns empty output, the system shall store extraction_status=NoTextDetected rather than fail the whole import.

### FR-07 - AI Suspicious Content Detection & Classification

**Priority:** Must Have  
**Description:** Apply rules and AI/ML models to identify suspicious content and classify findings relevant to narcotics and other illicit activity.  
**RFP Traceability Reference:** RFP-OBJ-02, RFP-OBJ-05, RFP-SOW-04, RFP-SOW-05, RFP-OBJ-08

**User Stories**
- **US-FR-07-01** - As an analyst, I want the system to flag suspicious content automatically so that I can review the highest-value evidence first.
- **US-FR-07-02** - As a supervisor, I want AI outputs to be explainable and reviewable so that false positives can be controlled.

**Acceptance Criteria**
- **AC-FR-07-01** - The system shall analyze text, image-derived text, document-derived text, metadata, and supported media classifications for suspicious indicators.
- **AC-FR-07-02** - Each finding shall store finding_id, artifact_id, category_code, severity, confidence_score, reason_codes, rule_hits, model_version, and finding_status.
- **AC-FR-07-03** - Finding categories shall be configurable and shall support at minimum NarcoticsReference, FinancialRouting, IdentityDocument, TravelLogistics, CoordinationPattern, DarkWebIndicator, and SuspiciousImage.
- **AC-FR-07-04** - Analysts shall be able to set finding_status to Confirmed, FalsePositive, NeedsReview, or Escalated.
- **AC-FR-07-05** - The platform shall support configurable keyword dictionaries, phrase rules, regex patterns, and ML model routing by artifact_type.
- **AC-FR-07-06** - The system shall record whether a finding was rule_only, model_only, or hybrid.

**Business Rules**
- **BR-FR-07-01** - No final report may include findings in Unreviewed status unless explicitly allowed by supervisor with reason.
- **BR-FR-07-02** - Model inference must execute only inside approved infrastructure.
- **BR-FR-07-03** - Confidence thresholds for escalation are configuration data, not hardcoded constants.

**Edge Cases**
- **EC-FR-07-01** - Artifact matches multiple suspicious categories.
- **EC-FR-07-02** - Same artifact is re-evaluated after model version upgrade.
- **EC-FR-07-03** - Multilingual slang or transliterated words produce ambiguous classification.

**Failure Handling**
- **FH-FR-07-01** - If model inference fails, the system shall still execute rule-based analysis and record analysis_status=PartialSuccess.
- **FH-FR-07-02** - If no configured model exists for artifact_type, the system shall skip model inference and log fallback_reason=NO_MODEL_MAPPING.

### FR-08 - Entity Extraction, Resolution & Link Analysis

**Priority:** Must Have  
**Description:** Extract identifiers, resolve duplicates, build relationship edges, and visualize communication networks and timelines.  
**RFP Traceability Reference:** RFP-SOW-05, RFP-SOW-08, RFP-OBJ-07, RFP-ANN-01

**User Stories**
- **US-FR-08-01** - As an analyst, I want contacts, phone numbers, emails, account numbers, UPI IDs, document numbers, device identifiers, and aliases correlated across artifacts.

**Acceptance Criteria**
- **AC-FR-08-01** - The platform shall extract entity types including PhoneNumber, Email, SocialHandle, BankAccount, UPI, DocumentNumber, DeviceIdentifier, PersonName, Alias, Address, and URL.
- **AC-FR-08-02** - The platform shall create relationship edges with relationship_id, from_entity_id, to_entity_id, relationship_type, source_artifact_id, weight, first_seen_at, and last_seen_at.
- **AC-FR-08-03** - The UI shall provide timeline and graph/network views for linked entities and artifacts.
- **AC-FR-08-04** - Authorized analysts shall be able to merge entities and split wrongly merged entities; every merge or split shall create an audit event.
- **AC-FR-08-05** - All relationships shown in UI or reports shall preserve their originating artifact reference(s).

**Business Rules**
- **BR-FR-08-01** - Entity merge operations require analyst reason_code and are reversible only through a split action.
- **BR-FR-08-02** - Automated entity resolution confidence must be stored separately from analyst-confirmed identity confidence.

**Edge Cases**
- **EC-FR-08-01** - Two different people share the same alias or number formatting variant.
- **EC-FR-08-02** - Graph contains cyclic or dense relationships causing clutter.

**Failure Handling**
- **FH-FR-08-01** - If entity resolution rules conflict, the system shall set review_status=NeedsManualResolution and avoid auto-merge.
- **FH-FR-08-02** - If graph rendering exceeds client threshold, the UI shall prompt for additional filters and render a summarized cluster view.

### FR-09 - Risk Scoring & Prioritization

**Priority:** Must Have  
**Description:** Calculate transparent risk scores for artifacts, entities, and cases and drive prioritized review queues and alerts.  
**RFP Traceability Reference:** RFP-OBJ-09, RFP-SOW-06, RFP-OBJ-12

**User Stories**
- **US-FR-09-01** - As a supervisor, I want cases and artifacts ranked by risk so that analysts focus on the most urgent evidence first.

**Acceptance Criteria**
- **AC-FR-09-01** - The system shall compute risk scores for scope_type values Artifact, Entity, and Case.
- **AC-FR-09-02** - Risk bands shall be Low, Medium, High, and Critical.
- **AC-FR-09-03** - Score components shall persist keyword_hits, entity_density, repetition_count, document_flags, analyst_confirmations, and rule_weight values in components_json.
- **AC-FR-09-04** - Authorized users shall be able to override a computed score only by entering override_reason and override_comment.
- **AC-FR-09-05** - Search results, dashboards, and alert queues shall be sortable and filterable by risk_score and risk_band.

**Business Rules**
- **BR-FR-09-01** - Risk rule weights are configuration data and versioned by effective_from and effective_to.
- **BR-FR-09-02** - An overridden score does not overwrite the original computed score; both values must be retained.

**Edge Cases**
- **EC-FR-09-01** - Multiple components produce the same final risk score, requiring deterministic ordering.
- **EC-FR-09-02** - Score recalculation occurs after analyst marks a finding FalsePositive.

**Failure Handling**
- **FH-FR-09-01** - If score calculation fails, the artifact shall be marked risk_status=Unavailable and remain searchable.
- **FH-FR-09-02** - If a rule set is missing or unpublished, the system shall reject score recalculation with an admin-facing configuration error.

### FR-10 - Legal Mapping & Statutory Reference Management

**Priority:** Must Have  
**Description:** Map findings and evidence bundles to department-defined legal sections using configurable rules and approval workflow.  
**RFP Traceability Reference:** RFP-OBJ-10, RFP-SOW-10, RFP-DEL-09

**User Stories**
- **US-FR-10-01** - As a supervisor, I want AI findings mapped to legal sections so that reports align to applicable provisions and SOPs.

**Acceptance Criteria**
- **AC-FR-10-01** - The system shall maintain a versioned mapping table between finding category_code, reason_code, and legal_section_id.
- **AC-FR-10-02** - For each suggested mapping, the system shall store mapping_rationale, source_finding_ids, and evidence_reference_count.
- **AC-FR-10-03** - Analysts and supervisors shall be able to Accept, Reject, or ManuallyAssign legal mappings.
- **AC-FR-10-04** - Only Supervisor or Administrator roles may mark a legal mapping Approved for final report inclusion.
- **AC-FR-10-05** - Approved legal mappings shall be insertable into report templates as structured sections.

**Business Rules**
- **BR-FR-10-01** - Legal section master data is configuration-managed and versioned.
- **BR-FR-10-02** - Rejected mappings remain auditable and cannot be deleted.

**Edge Cases**
- **EC-FR-10-01** - One finding maps to multiple legal sections.
- **EC-FR-10-02** - Legal-section master is updated after a report draft already exists.

**Failure Handling**
- **FH-FR-10-01** - If no rule-based mapping exists, the system shall mark mapping_status=ManualSelectionRequired.
- **FH-FR-10-02** - If a previously approved legal section is retired, the report draft shall be flagged for review before publication.

### FR-11 - Report Composition, Approval, Redaction & Export

**Priority:** Must Have  
**Description:** Generate standardized court-ready reports and annexures from reviewed evidence, approved mappings, and configurable templates.  
**RFP Traceability Reference:** RFP-OBJ-04, RFP-SOW-10, RFP-SOW-11, RFP-SOW-12, RFP-DEL-03, RFP-ANN-01

**User Stories**
- **US-FR-11-01** - As an analyst, I want to generate a standardized report from reviewed findings so that outputs are consistent and court-ready.
- **US-FR-11-02** - As a supervisor, I want to approve or reject report versions so that only reviewed content is published.

**Acceptance Criteria**
- **AC-FR-11-01** - The platform shall generate reports from approved templates containing case metadata, evidence summary, findings, relationship summary, legal mappings, analyst notes, and chain-of-custody summary.
- **AC-FR-11-02** - Report status values shall be Draft, PendingApproval, Approved, Rejected, Published, and Superseded.
- **AC-FR-11-03** - Every report version shall store report_id, version_no, template_id, generated_by, generated_at, approved_by, approved_at, and file_ref.
- **AC-FR-11-04** - Final publication shall require Supervisor approval and shall reject any report containing findings in Unreviewed or Rejected status.
- **AC-FR-11-05** - The system shall support redaction profiles with field-level and annexure-level controls for role-based sharing.
- **AC-FR-11-06** - The platform shall export reports to PDF and DOCX and persist export_hash, export_format, and export_timestamp.

**Business Rules**
- **BR-FR-11-01** - Published reports are immutable; subsequent changes create a new draft version.
- **BR-FR-11-02** - Draft reports shall be watermarked DRAFT and published reports shall be watermarked FINAL unless disabled by approved template.

**Edge Cases**
- **EC-FR-11-01** - Source artifacts referenced in a report are reprocessed before approval.
- **EC-FR-11-02** - Redaction profile hides an annexure required by the selected template.

**Failure Handling**
- **FH-FR-11-01** - If report generation fails due to template validation, the system shall not create a publishable file and shall return template_error details.
- **FH-FR-11-02** - If export file write fails, the report status shall remain in prior non-published state.

### FR-12 - DOPAMS Integration & Synchronization

**Priority:** Must Have  
**Description:** Exchange case metadata, status, summary information, and report references with DOPAMS using secure, idempotent integration patterns.  
**RFP Traceability Reference:** RFP-OBJ-06, RFP-SOW-13, RFP-SOW-14, RFP-DEL-04

**User Stories**
- **US-FR-12-01** - As an investigator, I want the forensic platform linked to DOPAMS so that case tracking is centralized.

**Acceptance Criteria**
- **AC-FR-12-01** - The system shall support inbound case linkage and outbound status/report synchronization via API or approved secure file/data exchange.
- **AC-FR-12-02** - Each sync transaction shall persist sync_event_id, direction, payload_hash, endpoint_ref, idempotency_key, status, attempt_count, last_attempt_at, and error_message.
- **AC-FR-12-03** - Integration operations shall be idempotent and shall not create duplicate case links or duplicate outbound report references on retry.
- **AC-FR-12-04** - Failed sync attempts shall retry according to a configurable backoff schedule and surface to supervisors and administrators after the retry threshold is exceeded.
- **AC-FR-12-05** - The platform shall maintain versioned field mapping between internal fields and DOPAMS fields.

**Business Rules**
- **BR-FR-12-01** - Outbound sync of Published report reference may occur only after report status = Published.
- **BR-FR-12-02** - Every inbound update from DOPAMS shall be validated against schema version before write.

**Edge Cases**
- **EC-FR-12-01** - DOPAMS accepts the case link but rejects report metadata.
- **EC-FR-12-02** - Same DOPAMS case is linked by two local cases in error.

**Failure Handling**
- **FH-FR-12-01** - If DOPAMS is unavailable, sync events shall enter Queued or Failed status and move to DeadLetter after configurable maximum retries.
- **FH-FR-12-02** - If payload validation fails, the sync attempt shall not retry until the mapping or payload is corrected.

### FR-13 - Alerts, Notifications & Escalations

**Priority:** Must Have  
**Description:** Generate actionable alerts for critical findings, operational failures, and unresolved conditions, with assignment and escalation controls.  
**RFP Traceability Reference:** RFP-OBJ-12, RFP-SOW-06, RFP-SUP-03

**User Stories**
- **US-FR-13-01** - As a supervisor, I want urgent findings and integration failures to trigger alerts so that critical action is not delayed.

**Acceptance Criteria**
- **AC-FR-13-01** - The system shall support alert rules based on risk threshold, keyword combinations, case priority, new critical evidence, repeated integration failures, and processing failures.
- **AC-FR-13-02** - Critical and High alerts shall be created within 30 seconds of the triggering event being recorded.
- **AC-FR-13-03** - Alert lifecycle states shall be Open, Acknowledged, InProgress, Resolved, and Dismissed.
- **AC-FR-13-04** - Alerts shall be assignable to a user or role and expose sla_due_at and escalated_at fields.
- **AC-FR-13-05** - The platform shall provide in-app notifications and optional email or webhook notifications when approved for the deployment environment.

**Business Rules**
- **BR-FR-13-01** - Default acknowledgement SLA shall be 15 minutes for Critical, 4 hours for High, 1 business day for Medium, and no automatic SLA for Low.
- **BR-FR-13-02** - Dismissal requires dismissal_reason and actor identity.

**Edge Cases**
- **EC-FR-13-01** - Same underlying event matches multiple alert rules.
- **EC-FR-13-02** - Assigned user becomes inactive before acknowledgement.

**Failure Handling**
- **FH-FR-13-01** - If external notification delivery fails, the alert shall remain open and retry according to the notification policy.
- **FH-FR-13-02** - If duplicate alert suppression is triggered, the system shall link the new event to the existing alert record instead of creating a duplicate.

### FR-14 - Identity, RBAC & Session Security

**Priority:** Must Have  
**Description:** Enforce authentication, authorization, case scoping, MFA, and privileged-session controls.  
**RFP Traceability Reference:** RFP-SOW-09, RFP-ARCH-05, RFP-DEL-08, RFP-ARCH-06

**User Stories**
- **US-FR-14-01** - As an administrator, I want access controlled by role and case so that sensitive evidence is available only to authorized personnel.

**Acceptance Criteria**
- **AC-FR-14-01** - The system shall support SAML and OpenID Connect SSO and a local username/password fallback mode.
- **AC-FR-14-02** - Roles shall include Administrator, Supervisor, Analyst, InvestigatorReadOnly, Auditor, IntegrationService, ConfigurationManager, and SupportOperator.
- **AC-FR-14-03** - Permissions shall be configurable per role for case_view, case_edit, evidence_upload, evidence_export, report_generate, report_approve, config_manage, user_manage, audit_view, and integration_manage.
- **AC-FR-14-04** - Case access scope shall support assignment-based, unit-based, and explicit grant models.
- **AC-FR-14-05** - Privileged operations including evidence export, report publication, configuration publish, and role change shall require step-up re-authentication.
- **AC-FR-14-06** - MFA shall be mandatory for privileged roles when local authentication is enabled.

**Business Rules**
- **BR-FR-14-01** - Service accounts are non-interactive and may authenticate only with mTLS or signed JWT.
- **BR-FR-14-02** - Sessions shall expire after 15 minutes of inactivity for privileged roles and 30 minutes for non-privileged roles unless policy is overridden by admin.

**Edge Cases**
- **EC-FR-14-01** - User belongs to multiple units and receives overlapping grants.
- **EC-FR-14-02** - SSO is unavailable and local fallback must be enabled temporarily.

**Failure Handling**
- **FH-FR-14-01** - If SSO login fails and fallback is disabled, the system shall deny access and log auth_failure_reason.
- **FH-FR-14-02** - If a permission check fails, the API shall return HTTP 403 with correlation_id and no sensitive object data.

### FR-15 - MIS, Analytics & Operational Reporting

**Priority:** Must Have  
**Description:** Provide management information reports, operational dashboards, and exportable analytics for workload, turnaround, and system usage.  
**RFP Traceability Reference:** RFP-DEL-07, RFP-SUP-02, RFP-COM-06

**User Stories**
- **US-FR-15-01** - As a supervisor, I want operational reports so that I can monitor workload, turnaround time, and system usage.
- **US-FR-15-02** - As an administrator, I want visibility into import, integration, and queue health so that operational issues can be addressed quickly.

**Acceptance Criteria**
- **AC-FR-15-01** - The system shall provide report IDs for case volume, import volume, artifact counts, finding severity distribution, report turnaround time, user activity, integration status, and queue backlog.
- **AC-FR-15-02** - MIS reports shall support filtering by date range, unit, analyst, case status, source tool, and risk band where applicable.
- **AC-FR-15-03** - MIS outputs shall be exportable to CSV and PDF.
- **AC-FR-15-04** - Scheduled MIS generation shall support daily, weekly, and monthly schedules with recipient lists by role or user.
- **AC-FR-15-05** - Access to each MIS report shall be permission-controlled.

**Business Rules**
- **BR-FR-15-01** - MIS data shall be derived from production records and not maintained as manually entered summary tables.
- **BR-FR-15-02** - Operational metrics used for SLA or payment evidence shall be timestamped and non-editable.

**Edge Cases**
- **EC-FR-15-01** - Large report export spans multiple months and millions of artifacts.
- **EC-FR-15-02** - Scheduled report recipient is disabled or removed.

**Failure Handling**
- **FH-FR-15-01** - If scheduled report generation fails, the system shall create an operational alert and retain the schedule.
- **FH-FR-15-02** - If export size exceeds threshold, the system shall provide asynchronous generation and downloadable link.

### FR-16 - Configuration, Template & Model Governance

**Priority:** Should Have  
**Description:** Manage dictionaries, rules, mappings, templates, model metadata, and deployment-safe configuration publishing without code changes.  
**RFP Traceability Reference:** RFP-SOW-11, RFP-DEL-09, RFP-SUP-04, RFP-ARCH-02

**User Stories**
- **US-FR-16-01** - As a configuration manager, I want to change dictionaries, templates, mappings, and model settings without code deployment.

**Acceptance Criteria**
- **AC-FR-16-01** - The platform shall allow authorized users to manage keyword dictionaries, regex libraries, risk rules, legal mapping tables, report templates, notification rules, and model metadata.
- **AC-FR-16-02** - Every configuration object shall be versioned with draft, published, rolled_back, and superseded states.
- **AC-FR-16-03** - Configuration packages shall support export/import in JSON format for environment promotion.
- **AC-FR-16-04** - Publishing a configuration version shall not require application redeployment.
- **AC-FR-16-05** - The system shall record which config_version_id and model_version were used to produce each finding, score, and report.

**Business Rules**
- **BR-FR-16-01** - Only one published version of a given configuration type may be active per environment at a time.
- **BR-FR-16-02** - Rollback creates a new active version pointer but does not delete intermediate versions.

**Edge Cases**
- **EC-FR-16-01** - Template references a field removed from the current schema version.
- **EC-FR-16-02** - New risk rule conflicts with an older active rule.

**Failure Handling**
- **FH-FR-16-01** - If configuration validation fails, publish shall be blocked and validation_errors returned.
- **FH-FR-16-02** - If config import has unknown keys, the system shall reject the package or map them according to import policy.

### FR-17 - Retention, Archive & Purge Approval

**Priority:** Must Have  
**Description:** Control retention, legal hold, archive, and purge workflows for evidence, logs, and reports.  
**RFP Traceability Reference:** RFP-ARCH-03, RFP-ARCH-06, RFP-OBJ-11

**User Stories**
- **US-FR-17-01** - As an administrator, I want controlled retention and archive workflows so that data is preserved or purged only with authorization.

**Acceptance Criteria**
- **AC-FR-17-01** - The system shall support retention policies for source evidence, normalized artifacts, reports, and audit logs using policy IDs and effective dates.
- **AC-FR-17-02** - The system shall support legal_hold_status values None, InvestigationHold, LegalHold, and PurgeApproved.
- **AC-FR-17-03** - Any archival or purge workflow shall require privileged approval, recorded reason, and audit event.
- **AC-FR-17-04** - End users shall not have hard-delete permission on source evidence.
- **AC-FR-17-05** - Archived records shall remain discoverable by metadata to authorized users even when moved to cold storage.

**Business Rules**
- **BR-FR-17-01** - No object under legal hold may be purged.
- **BR-FR-17-02** - Purge actions shall operate only on records whose retention period has expired and are not referenced by active legal holds.

**Edge Cases**
- **EC-FR-17-01** - Case closure occurs while a report remains under external legal review.
- **EC-FR-17-02** - Cold-storage restore is requested for an archived case.

**Failure Handling**
- **FH-FR-17-01** - If archive move fails, the record shall remain active and raise an operational alert.
- **FH-FR-17-02** - If purge execution partially fails, the system shall create a compensating audit log and halt further deletion.

## 5. Data Model Requirements

### 5.1 Common Audit Fields
| Field ID | Field Name | Data Type | Mandatory | Validation Rule |
| --- | --- | --- | --- | --- |
| CF-001 | created_at | timestamp with timezone | Y | System-generated UTC timestamp. |
| CF-002 | created_by | uuid | Y | Must reference an active user or service account. |
| CF-003 | updated_at | timestamp with timezone | N | System-generated UTC timestamp on mutable entities. |
| CF-004 | updated_by | uuid | N | Must reference the actor making the latest update. |
| CF-005 | row_version | bigint | Y | Optimistic-lock counter incremented on every update to mutable entities. |

### 5.2 Core Enumerations
| Enumeration ID | Enumeration Name | Allowed Values |
| --- | --- | --- |
| ENUM-001 | CaseStatus | Draft \| Active \| IngestionInProgress \| UnderReview \| ReportReady \| Submitted \| Closed \| Reopened |
| ENUM-002 | EvidenceStatus | Registered \| UploadAccepted \| Quarantined \| Parsing \| Normalized \| Completed \| CompletedWithWarnings \| Failed |
| ENUM-003 | ImportJobStatus | Queued \| Parsing \| Normalized \| Completed \| CompletedWithWarnings \| Failed \| Cancelled |
| ENUM-004 | ArtifactType | Message \| CallLog \| Contact \| MediaImage \| MediaVideo \| Audio \| Document \| BrowsingHistory \| AppUsage \| SocialArtifact \| FinancialIndicator \| IdentityDocument \| DerivedText \| Unknown |
| ENUM-005 | FindingStatus | Unreviewed \| Confirmed \| FalsePositive \| NeedsReview \| Escalated |
| ENUM-006 | RiskBand | Low \| Medium \| High \| Critical |
| ENUM-007 | MappingStatus | Suggested \| Accepted \| Rejected \| ManuallyAssigned \| Approved |
| ENUM-008 | ReportStatus | Draft \| PendingApproval \| Approved \| Rejected \| Published \| Superseded |
| ENUM-009 | AlertStatus | Open \| Acknowledged \| InProgress \| Resolved \| Dismissed |
| ENUM-010 | SyncStatus | Queued \| InProgress \| Succeeded \| Failed \| DeadLetter |
| ENUM-011 | CaseScopeMode | Assignment \| Unit \| ExplicitGrant \| Global |
| ENUM-012 | LegalHoldStatus | None \| InvestigationHold \| LegalHold \| PurgeApproved |

### 5.3 Entity - Case

**Description:** Master investigation record and root container for evidence, findings, reports, and integrations.  
**RFP Ref:** RFP-OBJ-01; RFP-OBJ-06

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | case_id | uuid | Y | System-generated; immutable. | System | RFP-OBJ-01 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | case_reference | varchar(100) | Y | Unique per investigating_unit + case_year. | User/DOPAMS | RFP-SOW-13 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | dopams_case_ref | varchar(100) | N | Required when linked to DOPAMS. | DOPAMS/User | RFP-OBJ-06 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | title | varchar(255) | Y | 1-255 chars. | User | RFP-OBJ-01 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | status | enum CaseStatus | Y | Must be one of defined case states. | System/User | RFP-OBJ-01 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | priority | enum CasePriority | Y | Low/Medium/High/Critical. | User | RFP-OBJ-03 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | investigating_unit_id | uuid | Y | Must reference master Unit. | User/Master | RFP-DEL-09 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | assigned_owner_user_id | uuid | Y | Must reference active user. | User/System | RFP-OBJ-01 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | case_source | enum CaseSource | Y | Manual/DOPAMS/Imported. | User/System | RFP-SOW-13 |
| Case | Master investigation record and root container for evidence, findings, reports, and integrations. | closed_reason | varchar(500) | N | Required when status=Closed. | User | RFP-OBJ-04 |

### 5.4 Entity - EvidenceSource

**Description:** Immutable uploaded forensic export package registered against a case.  
**RFP Ref:** RFP-SOW-01; RFP-OBJ-11

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | evidence_id | uuid | Y | System-generated; immutable. | System | RFP-SOW-01 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-01 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | source_tool_code | enum SourceTool | Y | UFED/XRY/Oxygen/FTK/AXIOM/Belkasoft/Generic. | User | RFP-SOW-01 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | source_device_ref | varchar(255) | N | Free text or parser-derived device identifier. | User/Parser | RFP-SOW-02 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | source_file_name | varchar(255) | Y | Original uploaded file or archive name. | System | RFP-SOW-01 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | object_storage_uri | varchar(1000) | Y | Immutable blob location. | System | RFP-ARCH-03 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | checksum_type | enum ChecksumType | Y | SHA256 preferred; may store NONE if unavailable. | System/User | RFP-ARCH-03 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | checksum_value | varchar(128) | N | Hex string if computed or supplied. | System/User | RFP-ARCH-03 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | size_bytes | bigint | Y | Must be > 0. | System | RFP-SOW-01 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | evidence_status | enum EvidenceStatus | Y | Lifecycle status. | System | RFP-OBJ-11 |
| EvidenceSource | Immutable uploaded forensic export package registered against a case. | duplicate_of_evidence_id | uuid | N | Populated when duplicate detected. | System | RFP-SOW-01 |

### 5.5 Entity - ImportJob

**Description:** Technical processing job that validates, parses, normalizes, and enriches an evidence source.  
**RFP Ref:** RFP-SOW-03; RFP-ARCH-02

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | import_job_id | uuid | Y | System-generated. | System | RFP-SOW-03 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | evidence_id | uuid | Y | Must reference EvidenceSource. | System | RFP-SOW-03 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | job_version_no | integer | Y | Starts at 1 and increments on reprocessing. | System | RFP-ARCH-03 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | status | enum ImportJobStatus | Y | Queued/Parsing/Normalized/Completed/CompletedWithWarnings/Failed/Cancelled. | System | RFP-SOW-03 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | parser_version | varchar(50) | Y | Semantic version or build hash. | System | RFP-SOW-01 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | started_at | timestamp with timezone | N | Set when worker starts. | System | RFP-ARCH-02 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | completed_at | timestamp with timezone | N | Set when worker ends. | System | RFP-ARCH-02 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | warning_count | integer | Y | >= 0. | System | RFP-SOW-02 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | error_count | integer | Y | >= 0. | System | RFP-SOW-02 |
| ImportJob | Technical processing job that validates, parses, normalizes, and enriches an evidence source. | job_summary_json | jsonb | N | Machine-readable per-file results. | System | RFP-SOW-03 |

### 5.6 Entity - Artifact

**Description:** Canonical normalized evidence record derived from an evidence source.  
**RFP Ref:** RFP-SOW-03; RFP-SOW-08; RFP-ANN-01

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Artifact | Canonical normalized evidence record derived from an evidence source. | artifact_id | uuid | Y | System-generated. | System | RFP-SOW-03 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | evidence_id | uuid | Y | Must reference EvidenceSource. | System | RFP-SOW-03 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | artifact_type | enum ArtifactType | Y | Must be defined canonical type. | Parser/System | RFP-SOW-03 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | source_record_id | varchar(255) | N | Original tool record reference. | Parser | RFP-SOW-01 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | parent_artifact_id | uuid | N | Used for derived artifacts and thread hierarchy. | System | RFP-SOW-04 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | event_timestamp | timestamp with timezone | N | Original artifact timestamp if available. | Parser | RFP-SOW-02 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | canonical_text | text | N | Normalized text content or OCR output. | Parser/OCR | RFP-SOW-04 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | metadata_json | jsonb | Y | Structured metadata payload. | Parser | RFP-SOW-03 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | language_code | varchar(10) | N | BCP-47 code when detected. | System | RFP-SOW-04 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | review_status | enum ReviewStatus | Y | Unreviewed/InReview/Confirmed/FalsePositive/NeedsSupervisorReview/IncludedInReport/ExcludedFromReport. | System/User | RFP-SOW-08 |
| Artifact | Canonical normalized evidence record derived from an evidence source. | search_vector | tsvector / search index | N | Searchable text projection. | System | RFP-SOW-08 |

### 5.7 Entity - ExtractedEntity

**Description:** Resolved identifier or real-world entity extracted from one or more artifacts.  
**RFP Ref:** RFP-SOW-05; RFP-OBJ-07

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | entity_id | uuid | Y | System-generated. | System | RFP-SOW-05 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-05 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | entity_type | enum EntityType | Y | PhoneNumber/Email/SocialHandle/etc. | System | RFP-SOW-05 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | normalized_value | varchar(500) | Y | Canonical normalized value. | System | RFP-SOW-05 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | display_value | varchar(500) | Y | Human-readable representation. | System | RFP-SOW-05 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | alias_list_json | jsonb | N | Known aliases / variants. | System/User | RFP-OBJ-07 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | resolution_confidence | numeric(5,4) | N | 0.0000-1.0000. | System | RFP-OBJ-07 |
| ExtractedEntity | Resolved identifier or real-world entity extracted from one or more artifacts. | manual_resolution_state | enum ResolutionState | Y | AutoResolved/NeedsReview/Merged/Split. | System/User | RFP-SOW-05 |

### 5.8 Entity - Relationship

**Description:** Link between entities and/or artifacts with provenance.  
**RFP Ref:** RFP-SOW-05; RFP-SOW-08

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Relationship | Link between entities and/or artifacts with provenance. | relationship_id | uuid | Y | System-generated. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | from_entity_id | uuid | Y | Must reference ExtractedEntity. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | to_entity_id | uuid | Y | Must reference ExtractedEntity. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | relationship_type | enum RelationshipType | Y | CommunicatedWith/TransferredTo/SharedWith/etc. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | source_artifact_id | uuid | Y | Must reference Artifact. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | weight | numeric(10,4) | Y | Must be >= 0. | System | RFP-SOW-06 |
| Relationship | Link between entities and/or artifacts with provenance. | first_seen_at | timestamp with timezone | N | Earliest known event time. | System | RFP-SOW-05 |
| Relationship | Link between entities and/or artifacts with provenance. | last_seen_at | timestamp with timezone | N | Latest known event time. | System | RFP-SOW-05 |

### 5.9 Entity - AIFinding

**Description:** Suspicious observation produced by rule-based and/or model-based analysis.  
**RFP Ref:** RFP-OBJ-02; RFP-SOW-04; RFP-SOW-05

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | finding_id | uuid | Y | System-generated. | System | RFP-SOW-04 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | artifact_id | uuid | Y | Must reference Artifact. | System | RFP-SOW-04 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | category_code | varchar(100) | Y | Must exist in finding-category master. | System | RFP-OBJ-08 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | severity | enum Severity | Y | Low/Medium/High/Critical. | System | RFP-OBJ-12 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | confidence_score | numeric(5,4) | Y | 0.0000-1.0000. | System | RFP-SOW-04 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | reason_codes_json | jsonb | Y | Array of reason codes and explanations. | System | RFP-SOW-05 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | rule_hits_json | jsonb | N | Matched rules/keywords/regex hits. | System | RFP-SOW-05 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | model_version | varchar(50) | N | Inference model or ruleset version. | System | RFP-SUP-04 |
| AIFinding | Suspicious observation produced by rule-based and/or model-based analysis. | finding_status | enum FindingStatus | Y | Unreviewed/Confirmed/FalsePositive/NeedsReview/Escalated. | System/User | RFP-OBJ-02 |

### 5.10 Entity - RiskScore

**Description:** Computed prioritization score for an artifact, entity, or case.  
**RFP Ref:** RFP-OBJ-09; RFP-SOW-06

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | risk_score_id | uuid | Y | System-generated. | System | RFP-SOW-06 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | scope_type | enum RiskScopeType | Y | Artifact/Entity/Case. | System | RFP-SOW-06 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | scope_id | uuid | Y | Must reference the record identified by scope_type. | System | RFP-SOW-06 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | score_value | numeric(9,4) | Y | 0-100 range by default. | System | RFP-OBJ-09 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | risk_band | enum RiskBand | Y | Low/Medium/High/Critical. | System | RFP-OBJ-09 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | components_json | jsonb | Y | Persisted score inputs and weights. | System | RFP-OBJ-09 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | score_version | varchar(50) | Y | Ruleset or model version used. | System | RFP-SUP-04 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | override_by | uuid | N | Populated only for manual override. | User | RFP-OBJ-09 |
| RiskScore | Computed prioritization score for an artifact, entity, or case. | override_reason | varchar(500) | N | Mandatory when override_by is populated. | User | RFP-OBJ-09 |

### 5.11 Entity - LegalMapping

**Description:** Suggested or approved link between findings and department-defined legal sections.  
**RFP Ref:** RFP-OBJ-10

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | legal_mapping_id | uuid | Y | System-generated. | System | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | finding_id | uuid | Y | Must reference AIFinding. | System | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | legal_section_id | uuid | Y | Must reference legal-section master. | System/User | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | law_name | varchar(255) | Y | Resolved from legal-section master. | System | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | section_code | varchar(100) | Y | Resolved from legal-section master. | System | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | mapping_rationale | text | Y | Evidence-based rationale for the suggestion or approval. | System/User | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | mapping_status | enum MappingStatus | Y | Suggested/Accepted/Rejected/ManuallyAssigned/Approved. | System/User | RFP-OBJ-10 |
| LegalMapping | Suggested or approved link between findings and department-defined legal sections. | approved_by | uuid | N | Required when mapping_status=Approved. | User | RFP-OBJ-10 |

### 5.12 Entity - Report

**Description:** Generated forensic report or annexure version.  
**RFP Ref:** RFP-SOW-10; RFP-SOW-11; RFP-SOW-12

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Report | Generated forensic report or annexure version. | report_id | uuid | Y | System-generated. | System | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | template_id | uuid | Y | Must reference published template. | System | RFP-SOW-11 |
| Report | Generated forensic report or annexure version. | version_no | integer | Y | Starts at 1 and increments per case. | System | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | status | enum ReportStatus | Y | Draft/PendingApproval/Approved/Rejected/Published/Superseded. | System/User | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | redaction_profile_id | uuid | N | Must reference redaction profile master. | User/System | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | file_ref | varchar(1000) | N | Generated file location. | System | RFP-SOW-12 |
| Report | Generated forensic report or annexure version. | export_hash | varchar(128) | N | Checksum of generated file. | System | RFP-SOW-12 |
| Report | Generated forensic report or annexure version. | generated_by | uuid | Y | Must reference active user. | System | RFP-SOW-10 |
| Report | Generated forensic report or annexure version. | approved_by | uuid | N | Required when status=Approved or Published. | User | RFP-SOW-10 |

### 5.13 Entity - Alert

**Description:** Operational or analytical alert requiring acknowledgement or escalation.  
**RFP Ref:** RFP-OBJ-12

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | alert_id | uuid | Y | System-generated. | System | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | case_id | uuid | N | Nullable for platform-level operational alerts. | System | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | alert_type | enum AlertType | Y | Risk/Integration/Import/OCR/Config/etc. | System | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | severity | enum Severity | Y | Low/Medium/High/Critical. | System | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | status | enum AlertStatus | Y | Open/Acknowledged/InProgress/Resolved/Dismissed. | System/User | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | assigned_to_user_id | uuid | N | Optional user assignment. | System/User | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | assigned_to_role_id | uuid | N | Optional role assignment. | System/User | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | sla_due_at | timestamp with timezone | N | Calculated per severity. | System | RFP-OBJ-12 |
| Alert | Operational or analytical alert requiring acknowledgement or escalation. | resolution_note | text | N | Required when status=Resolved or Dismissed. | User | RFP-OBJ-12 |

### 5.14 Entity - DOPAMSSyncEvent

**Description:** Inbound or outbound integration transaction record for DOPAMS.  
**RFP Ref:** RFP-SOW-13; RFP-SOW-14

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | sync_event_id | uuid | Y | System-generated. | System | RFP-SOW-13 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-13 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | direction | enum SyncDirection | Y | Inbound/Outbound. | System | RFP-SOW-13 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | event_type | enum SyncEventType | Y | CaseLink/StatusUpdate/ReportReference/etc. | System | RFP-SOW-13 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | payload_hash | varchar(128) | Y | Hash of payload or exchanged file. | System | RFP-SOW-14 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | status | enum SyncStatus | Y | Queued/InProgress/Succeeded/Failed/DeadLetter. | System | RFP-SOW-14 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | attempt_count | integer | Y | >= 0. | System | RFP-SOW-14 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | last_attempt_at | timestamp with timezone | N | Latest execution time. | System | RFP-SOW-14 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | error_message | text | N | Latest error summary. | System | RFP-SOW-14 |
| DOPAMSSyncEvent | Inbound or outbound integration transaction record for DOPAMS. | idempotency_key | varchar(255) | Y | Required for deduplication. | System | RFP-SOW-14 |

### 5.15 Entity - Annotation

**Description:** Analyst or supervisor note attached to a case, artifact, or finding.  
**RFP Ref:** RFP-SOW-08

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | annotation_id | uuid | Y | System-generated. | System | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | case_id | uuid | Y | Must reference Case. | System | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | artifact_id | uuid | N | Optional when note is case-level. | User | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | finding_id | uuid | N | Optional when note is finding-level. | User | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | author_user_id | uuid | Y | Must reference active user. | System | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | visibility_scope | enum AnnotationVisibility | Y | Private/CaseTeam/SupervisorOnly. | User | RFP-SOW-08 |
| Annotation | Analyst or supervisor note attached to a case, artifact, or finding. | note_text | text | Y | 1-5000 chars. | User | RFP-SOW-08 |

### 5.16 Entity - AuditEvent

**Description:** Immutable security, evidence, and workflow event log.  
**RFP Ref:** RFP-ARCH-04; RFP-ARCH-06

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AuditEvent | Immutable security, evidence, and workflow event log. | audit_event_id | uuid | Y | System-generated. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | timestamp_utc | timestamp with timezone | Y | System-generated UTC timestamp. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | actor_user_id | uuid | N | Nullable for system events. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | actor_role_id | uuid | N | Nullable for system events. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | case_id | uuid | N | Optional for platform-level events. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | object_type | varchar(100) | Y | Case/Evidence/Artifact/Report/etc. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | object_id | uuid/varchar | Y | Identifier of the acted-upon object. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | action | varchar(100) | Y | Normalized action code. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | outcome | enum Outcome | Y | Success/Failure/Denied. | System | RFP-ARCH-04 |
| AuditEvent | Immutable security, evidence, and workflow event log. | source_ip | inet | N | Originating IP if available. | System | RFP-ARCH-06 |

### 5.17 Entity - User

**Description:** System user or service-account principal.  
**RFP Ref:** RFP-ARCH-05; RFP-DEL-08

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User | System user or service-account principal. | user_id | uuid | Y | System-generated. | System | RFP-ARCH-05 |
| User | System user or service-account principal. | username | varchar(150) | Y | Unique per auth provider. | User/System | RFP-ARCH-05 |
| User | System user or service-account principal. | display_name | varchar(255) | Y | 1-255 chars. | User/System | RFP-DEL-08 |
| User | System user or service-account principal. | role_id | uuid | Y | Must reference Role. | System | RFP-DEL-08 |
| User | System user or service-account principal. | unit_id | uuid | N | Optional unit association. | System | RFP-DEL-08 |
| User | System user or service-account principal. | auth_provider | enum AuthProvider | Y | OIDC/SAML/LOCAL/SERVICE. | System | RFP-ARCH-05 |
| User | System user or service-account principal. | mfa_enabled | boolean | Y | Mandatory for privileged local users. | System | RFP-ARCH-05 |
| User | System user or service-account principal. | status | enum UserStatus | Y | Active/Inactive/Locked. | System | RFP-ARCH-05 |
| User | System user or service-account principal. | last_login_at | timestamp with timezone | N | Latest successful login. | System | RFP-ARCH-05 |

### 5.18 Entity - Role

**Description:** Permission bundle defining allowed actions and data scope.  
**RFP Ref:** RFP-SOW-09; RFP-DEL-08

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Role | Permission bundle defining allowed actions and data scope. | role_id | uuid | Y | System-generated. | System | RFP-SOW-09 |
| Role | Permission bundle defining allowed actions and data scope. | role_code | varchar(100) | Y | Unique symbolic code. | System | RFP-SOW-09 |
| Role | Permission bundle defining allowed actions and data scope. | role_name | varchar(100) | Y | Human-readable name. | System | RFP-SOW-09 |
| Role | Permission bundle defining allowed actions and data scope. | permission_set_json | jsonb | Y | Named permission flags and scope rules. | System | RFP-SOW-09 |
| Role | Permission bundle defining allowed actions and data scope. | case_scope_mode | enum CaseScopeMode | Y | Assignment/Unit/ExplicitGrant/Global. | System | RFP-SOW-09 |

### 5.19 Entity - ConfigVersion

**Description:** Versioned configuration package for templates, rules, dictionaries, mappings, and models.  
**RFP Ref:** RFP-SUP-04; RFP-DEL-09

| Entity Name | Description | Attribute | Data Type | Mandatory (Y/N) | Validation Rule | Source | RFP Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | config_version_id | uuid | Y | System-generated. | System | RFP-SUP-04 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | config_type | enum ConfigType | Y | Dictionary/RiskRule/LegalMap/Template/ModelMeta/NotificationRule. | System | RFP-DEL-09 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | version_label | varchar(50) | Y | Semantic version or release tag. | User/System | RFP-SUP-04 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | status | enum ConfigStatus | Y | Draft/Published/RolledBack/Superseded. | System | RFP-SUP-04 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | content_json | jsonb | Y | Structured configuration payload. | User/System | RFP-DEL-09 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | published_at | timestamp with timezone | N | Set when published. | System | RFP-SUP-04 |
| ConfigVersion | Versioned configuration package for templates, rules, dictionaries, mappings, and models. | published_by | uuid | N | User who published the version. | System | RFP-SUP-04 |

## 6. API Specifications

### 6.1 API Standards
- **Base path:** `/api/v1`
- **Authentication:** OIDC bearer token for interactive users; mTLS or signed JWT for service accounts.
- **Idempotency:** Header `Idempotency-Key` required for POST requests that create cases, evidence uploads, reports, merges, approvals, or DOPAMS sync operations.
- **Default rate limits:** interactive `600 requests per minute per user`, search `120 requests per minute per user`, file upload init `30 requests per minute per user`, service account `1200 requests per minute per client`.
- **Standard error schema:**
```json
{
  "error_code": "string",
  "message": "string",
  "details": "object|array",
  "correlation_id": "string"
}
```

### API-01 - `POST /auth/token`

**Purpose:** Obtain local-auth access token when SSO is not used.  
**Authentication Mechanism:** Local auth only; TLS required.  
**Rate Limits:** 10 requests/minute/user + IP throttling  
**Idempotency Handling:** Not applicable.  
**Validation Rules:** username and password required; otp_code required for MFA-enabled privileged accounts.  
**Error Codes:** AUTH_INVALID_CREDENTIALS, AUTH_MFA_REQUIRED, AUTH_ACCOUNT_LOCKED

**Request Schema (JSON)**
```json
{
  "username": "string",
  "password": "string",
  "otp_code": "string|null"
}
```

**Response Schema (JSON)**
```json
{
  "access_token": "jwt",
  "refresh_token": "jwt",
  "expires_in": 3600,
  "token_type": "Bearer",
  "mfa_required": false
}
```

### API-02 - `POST /cases`

**Purpose:** Create a new case.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 60 requests/minute/user  
**Idempotency Handling:** Required; duplicate key returns original successful response.  
**Validation Rules:** case_reference unique by unit+year; title length 1-255; owner must be active.  
**Error Codes:** CASE_DUPLICATE_REFERENCE, CASE_INVALID_OWNER, CASE_INVALID_DOPAMS_REF

**Request Schema (JSON)**
```json
{
  "case_reference": "string",
  "title": "string",
  "investigating_unit_id": "uuid",
  "priority": "Low|Medium|High|Critical",
  "assigned_owner_user_id": "uuid",
  "case_source": "Manual|DOPAMS|Imported",
  "dopams_case_ref": "string|null"
}
```

**Response Schema (JSON)**
```json
{
  "case_id": "uuid",
  "status": "Draft",
  "created_at": "timestamp"
}
```

### API-03 - `POST /cases/{caseId}/evidence/uploads`

**Purpose:** Register evidence upload and receive upload session details.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 30 requests/minute/user  
**Idempotency Handling:** Required; duplicate key returns same evidence_id if metadata matches.  
**Validation Rules:** case must not be Closed; size_bytes > 0; supported source_tool_code required.  
**Error Codes:** CASE_NOT_EDITABLE, UPLOAD_INVALID_FILE_META, UPLOAD_DUPLICATE_DETECTED

**Request Schema (JSON)**
```json
{
  "source_tool_code": "UFED|XRY|Oxygen|FTK|AXIOM|Belkasoft|Generic",
  "source_device_ref": "string|null",
  "file_name": "string",
  "size_bytes": "integer",
  "checksum_type": "SHA256|NONE",
  "checksum_value": "string|null"
}
```

**Response Schema (JSON)**
```json
{
  "evidence_id": "uuid",
  "upload_session_id": "uuid",
  "upload_url": "string",
  "expires_at": "timestamp"
}
```

### API-04 - `POST /cases/{caseId}/evidence/{evidenceId}/ingest`

**Purpose:** Start or re-run parsing and normalization for an evidence source.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 20 requests/minute/user  
**Idempotency Handling:** Required; retries with same key return same queued job if parameters identical.  
**Validation Rules:** evidence must exist and not be Quarantined unless supervisor override flag exists.  
**Error Codes:** EVIDENCE_NOT_FOUND, EVIDENCE_QUARANTINED, IMPORT_ALREADY_RUNNING

**Request Schema (JSON)**
```json
{
  "reprocess": "boolean",
  "parser_profile": "string|null",
  "ocr_enabled": "boolean"
}
```

**Response Schema (JSON)**
```json
{
  "import_job_id": "uuid",
  "status": "Queued",
  "job_version_no": 1
}
```

### API-05 - `GET /import-jobs/{importJobId}`

**Purpose:** Retrieve status and summary for an import job.  
**Authentication Mechanism:** Bearer token.  
**Rate Limits:** 120 requests/minute/user  
**Idempotency Handling:** Not applicable.  
**Validation Rules:** Caller must have access to the owning case.  
**Error Codes:** IMPORT_JOB_NOT_FOUND, ACCESS_DENIED

**Request Schema (JSON)**
```json
{}
```

**Response Schema (JSON)**
```json
{
  "import_job_id": "uuid",
  "status": "CompletedWithWarnings",
  "warning_count": 2,
  "error_count": 0,
  "summary": {
    "artifacts_created": 10234,
    "findings_created": 234
  }
}
```

### API-06 - `POST /cases/{caseId}/artifacts/search`

**Purpose:** Search normalized artifacts within a case.  
**Authentication Mechanism:** Bearer token.  
**Rate Limits:** 120 requests/minute/user  
**Idempotency Handling:** Not applicable.  
**Validation Rules:** page_size max 200; date_from <= date_to; sort fields restricted to whitelist.  
**Error Codes:** SEARCH_INVALID_FILTER, SEARCH_PAGE_TOO_LARGE

**Request Schema (JSON)**
```json
{
  "query_text": "string|null",
  "filters": {
    "artifact_types": [
      "Message",
      "Document"
    ],
    "risk_bands": [
      "High",
      "Critical"
    ],
    "review_statuses": [
      "Unreviewed"
    ],
    "source_tools": [
      "UFED"
    ],
    "date_from": "timestamp|null",
    "date_to": "timestamp|null"
  },
  "sort": [
    {
      "field": "risk_score",
      "direction": "desc"
    }
  ],
  "page": 1,
  "page_size": 50
}
```

**Response Schema (JSON)**
```json
{
  "items": [
    {
      "artifact_id": "uuid",
      "artifact_type": "Message",
      "snippet": "string",
      "risk_band": "High"
    }
  ],
  "page": 1,
  "page_size": 50,
  "total_count": 1532
}
```

### API-07 - `PATCH /findings/{findingId}/review`

**Purpose:** Review or disposition an AI finding.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 120 requests/minute/user  
**Idempotency Handling:** Optional; last-write-wins protected by If-Match row version.  
**Validation Rules:** Only allowed statuses may be set; comment required when FalsePositive or Escalated.  
**Error Codes:** FINDING_NOT_FOUND, INVALID_STATUS_TRANSITION, ACCESS_DENIED

**Request Schema (JSON)**
```json
{
  "finding_status": "Confirmed|FalsePositive|NeedsReview|Escalated",
  "comment": "string|null",
  "legal_mapping_action": "Accept|Reject|ManualSelection|null"
}
```

**Response Schema (JSON)**
```json
{
  "finding_id": "uuid",
  "finding_status": "Confirmed",
  "reviewed_by": "uuid",
  "reviewed_at": "timestamp"
}
```

### API-08 - `POST /entities/merge`

**Purpose:** Merge two or more extracted entities judged to be the same real-world subject.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 30 requests/minute/user  
**Idempotency Handling:** Required; duplicate key returns original merge result.  
**Validation Rules:** At least 2 entity_ids required; all entities must belong to same case.  
**Error Codes:** ENTITY_NOT_FOUND, ENTITY_CASE_MISMATCH, MERGE_NOT_ALLOWED

**Request Schema (JSON)**
```json
{
  "case_id": "uuid",
  "entity_ids": [
    "uuid",
    "uuid"
  ],
  "reason_code": "string",
  "reason_comment": "string"
}
```

**Response Schema (JSON)**
```json
{
  "surviving_entity_id": "uuid",
  "merged_entity_ids": [
    "uuid",
    "uuid"
  ],
  "resolution_state": "Merged"
}
```

### API-09 - `POST /cases/{caseId}/reports`

**Purpose:** Generate a report draft from reviewed findings.  
**Authentication Mechanism:** Bearer token; role Analyst+.  
**Rate Limits:** 20 requests/minute/user  
**Idempotency Handling:** Required; duplicate key returns original draft if input set identical.  
**Validation Rules:** finding_ids must belong to case; template must be published; rejected findings not allowed.  
**Error Codes:** REPORT_TEMPLATE_NOT_PUBLISHED, REPORT_INVALID_FINDING_SET, CASE_NOT_FOUND

**Request Schema (JSON)**
```json
{
  "template_id": "uuid",
  "finding_ids": [
    "uuid",
    "uuid"
  ],
  "redaction_profile_id": "uuid|null",
  "include_annexures": true
}
```

**Response Schema (JSON)**
```json
{
  "report_id": "uuid",
  "version_no": 1,
  "status": "Draft"
}
```

### API-10 - `POST /reports/{reportId}/approve`

**Purpose:** Approve a report for publication.  
**Authentication Mechanism:** Bearer token + step-up re-auth.  
**Rate Limits:** 10 requests/minute/user  
**Idempotency Handling:** Required; duplicate approval call returns original approval outcome.  
**Validation Rules:** Caller must have Supervisor or Administrator role; report must be PendingApproval.  
**Error Codes:** REPORT_INVALID_STATE, ACCESS_DENIED, REPORT_CONTAINS_UNREVIEWED_FINDINGS

**Request Schema (JSON)**
```json
{
  "approval_comment": "string|null"
}
```

**Response Schema (JSON)**
```json
{
  "report_id": "uuid",
  "status": "Approved",
  "approved_by": "uuid",
  "approved_at": "timestamp"
}
```

### API-11 - `POST /integrations/dopams/sync`

**Purpose:** Queue outbound DOPAMS synchronization for a case event.  
**Authentication Mechanism:** Bearer token role Supervisor+/Service account.  
**Rate Limits:** 60 requests/minute/client  
**Idempotency Handling:** Required; event deduped on idempotency_key + payload_hash.  
**Validation Rules:** case_id required; event_type must be configured; Published report required for ReportReference.  
**Error Codes:** SYNC_MAPPING_MISSING, DOPAMS_NOT_CONFIGURED, REPORT_NOT_PUBLISHED

**Request Schema (JSON)**
```json
{
  "case_id": "uuid",
  "event_type": "CaseLink|StatusUpdate|ReportReference",
  "payload_override": "object|null"
}
```

**Response Schema (JSON)**
```json
{
  "sync_event_id": "uuid",
  "status": "Queued",
  "idempotency_key": "string"
}
```

### API-12 - `GET /audit-events`

**Purpose:** Query immutable audit events.  
**Authentication Mechanism:** Bearer token; roles Auditor/Supervisor/Admin.  
**Rate Limits:** 60 requests/minute/user  
**Idempotency Handling:** Not applicable.  
**Validation Rules:** Filtering limited to permitted cases and object types; page_size max 200.  
**Error Codes:** ACCESS_DENIED, AUDIT_QUERY_INVALID

**Request Schema (JSON)**
```json
{}
```

**Response Schema (JSON)**
```json
{
  "items": [
    {
      "audit_event_id": "uuid",
      "timestamp_utc": "timestamp",
      "action": "report_approval",
      "outcome": "Success"
    }
  ],
  "page": 1,
  "page_size": 100,
  "total_count": 2312
}
```

### API-13 - `POST /config/versions/{configVersionId}/publish`

**Purpose:** Publish validated configuration to the current environment.  
**Authentication Mechanism:** Bearer token + step-up re-auth.  
**Rate Limits:** 10 requests/minute/user  
**Idempotency Handling:** Required; duplicate key returns original publish result.  
**Validation Rules:** Config must be Draft and pass validation suite; caller must be Config Manager or Admin.  
**Error Codes:** CONFIG_VALIDATION_FAILED, CONFIG_INVALID_STATE, ACCESS_DENIED

**Request Schema (JSON)**
```json
{
  "publish_comment": "string",
  "effective_from": "timestamp"
}
```

**Response Schema (JSON)**
```json
{
  "config_version_id": "uuid",
  "status": "Published",
  "published_at": "timestamp"
}
```

### API-14 - `GET /mis/reports/case-volume`

**Purpose:** Retrieve aggregated case volume metrics.  
**Authentication Mechanism:** Bearer token.  
**Rate Limits:** 30 requests/minute/user  
**Idempotency Handling:** Not applicable.  
**Validation Rules:** date range required via query params; max range 365 days for synchronous response.  
**Error Codes:** MIS_INVALID_RANGE, ACCESS_DENIED

**Request Schema (JSON)**
```json
{}
```

**Response Schema (JSON)**
```json
{
  "dimensions": [
    "date",
    "unit",
    "status"
  ],
  "rows": [
    {
      "date": "2026-03-01",
      "unit": "ABC",
      "status": "Active",
      "case_count": 42
    }
  ]
}
```

## 7. Workflow / State Machine

### 7.1 Case Lifecycle

**States:** Draft, Active, IngestionInProgress, UnderReview, ReportReady, Submitted, Closed, Reopened

| Transition ID | Trigger | From State | To State |
| --- | --- | --- | --- |
| WF-CASE-TR-01 | create_case | None | Draft |
| WF-CASE-TR-02 | activate_case | Draft | Active |
| WF-CASE-TR-03 | start_import | Active | IngestionInProgress |
| WF-CASE-TR-04 | import_completed | IngestionInProgress | UnderReview |
| WF-CASE-TR-05 | report_draft_ready | UnderReview | ReportReady |
| WF-CASE-TR-06 | submit_to_external_system | ReportReady | Submitted |
| WF-CASE-TR-07 | close_case | Submitted\|UnderReview\|ReportReady | Closed |
| WF-CASE-TR-08 | reopen_case | Closed | Reopened |
| WF-CASE-TR-09 | resume_work | Reopened | UnderReview |

**Approval Layers:** Supervisor approval required for close_case and reopen_case.

**Escalations:** If case remains IngestionInProgress > 24 hours or ReportReady > 72 hours without action, create supervisor alert.

**SLA Timers**
| SLA ID | Rule |
| --- | --- |
| SLA-CASE-01 | Import kickoff visible in UI within 30 seconds of upload acceptance. |
| SLA-CASE-02 | Case in ReportReady with no approval action for 72 hours generates reminder alert. |

### 7.2 Import Job Lifecycle

**States:** Queued, Parsing, Normalized, Completed, CompletedWithWarnings, Failed, Cancelled

| Transition ID | Trigger | From State | To State |
| --- | --- | --- | --- |
| WF-IMP-TR-01 | queue_job | None | Queued |
| WF-IMP-TR-02 | worker_started | Queued | Parsing |
| WF-IMP-TR-03 | normalization_completed | Parsing | Normalized |
| WF-IMP-TR-04 | job_completed_clean | Normalized | Completed |
| WF-IMP-TR-05 | job_completed_with_warnings | Normalized | CompletedWithWarnings |
| WF-IMP-TR-06 | job_failed | Queued\|Parsing\|Normalized | Failed |
| WF-IMP-TR-07 | job_cancelled | Queued\|Parsing | Cancelled |

**Approval Layers:** No manual approval for standard import; supervisor override required to process quarantined evidence.

**Escalations:** If Failed occurs 3 times for same evidence source, create operational alert.

**SLA Timers**
| SLA ID | Rule |
| --- | --- |
| SLA-IMP-01 | Import-job status shall become visible within 30 seconds of upload acceptance. |
| SLA-IMP-02 | Critical failed import alert raised within 30 seconds when all files fail. |

### 7.3 Finding Review Lifecycle

**States:** Unreviewed, NeedsReview, Confirmed, FalsePositive, Escalated

| Transition ID | Trigger | From State | To State |
| --- | --- | --- | --- |
| WF-FND-TR-01 | analysis_generated | None | Unreviewed |
| WF-FND-TR-02 | analyst_marks_needs_review | Unreviewed | NeedsReview |
| WF-FND-TR-03 | analyst_confirms | Unreviewed\|NeedsReview | Confirmed |
| WF-FND-TR-04 | analyst_rejects | Unreviewed\|NeedsReview | FalsePositive |
| WF-FND-TR-05 | analyst_escalates | Unreviewed\|NeedsReview\|Confirmed | Escalated |

**Approval Layers:** Supervisor review required for Critical findings escalated to report publication or legal mapping approval.

**Escalations:** Critical unreviewed findings older than 15 minutes create or update an alert.

**SLA Timers**
| SLA ID | Rule |
| --- | --- |
| SLA-FND-01 | Critical findings acknowledged within 15 minutes. |
| SLA-FND-02 | High findings acknowledged within 4 hours. |

### 7.4 Report Lifecycle

**States:** Draft, PendingApproval, Approved, Rejected, Published, Superseded

| Transition ID | Trigger | From State | To State |
| --- | --- | --- | --- |
| WF-RPT-TR-01 | generate_draft | None | Draft |
| WF-RPT-TR-02 | submit_for_approval | Draft | PendingApproval |
| WF-RPT-TR-03 | approve_report | PendingApproval | Approved |
| WF-RPT-TR-04 | reject_report | PendingApproval | Rejected |
| WF-RPT-TR-05 | publish_report | Approved | Published |
| WF-RPT-TR-06 | create_new_version | Published\|Rejected\|Draft | Draft |
| WF-RPT-TR-07 | supersede_prior_version | Published | Superseded |

**Approval Layers:** Supervisor approval mandatory before publish; step-up re-authentication required for approve_report and publish_report.

**Escalations:** PendingApproval older than 72 hours triggers reminder alert to assigned supervisor.

**SLA Timers**
| SLA ID | Rule |
| --- | --- |
| SLA-RPT-01 | Standard report generation up to 1,000 findings completes within 120 seconds. |
| SLA-RPT-02 | Pending approval reminder at 24 hours and escalation at 72 hours. |

### 7.5 DOPAMS Sync Lifecycle

**States:** Queued, InProgress, Succeeded, Failed, DeadLetter

| Transition ID | Trigger | From State | To State |
| --- | --- | --- | --- |
| WF-SYNC-TR-01 | queue_sync | None | Queued |
| WF-SYNC-TR-02 | worker_started | Queued | InProgress |
| WF-SYNC-TR-03 | api_success | InProgress | Succeeded |
| WF-SYNC-TR-04 | api_failure_retriable | InProgress | Failed |
| WF-SYNC-TR-05 | retry_scheduled | Failed | Queued |
| WF-SYNC-TR-06 | max_retries_exceeded | Failed | DeadLetter |

**Approval Layers:** No manual approval for standard status sync; supervisor approval required before first ReportReference sync if configured by department.

**Escalations:** After 5 failed retries or 60 minutes unresolved DeadLetter state, notify Administrator and Supervisor.

**SLA Timers**
| SLA ID | Rule |
| --- | --- |
| SLA-SYNC-01 | Retry schedule default: 1 min, 5 min, 15 min, 60 min, 240 min. |
| SLA-SYNC-02 | Dead-letter notification within 5 minutes of state change. |

## 8. Non-Functional Requirements

### 8.1 Performance
| NFR ID | Requirement |
| --- | --- |
| NFR-PERF-001 | 95% of standard UI page responses shall complete in <= 3 seconds under baseline load, excluding file upload, large import processing, and report generation. |
| NFR-PERF-002 | Search queries within a single case containing up to 1,000,000 normalized artifacts shall return the first page in <= 5 seconds for the 95th percentile. |
| NFR-PERF-003 | Import-job status shall become visible in the UI within 30 seconds of upload acceptance. |
| NFR-PERF-004 | Standard report generation containing up to 1,000 reviewed findings shall complete in <= 120 seconds. |

### 8.2 Capacity & Scalability
| NFR ID | Requirement |
| --- | --- |
| NFR-SCL-001 | Baseline deployment shall support at least 100 named users, 25 concurrent active users, and 10 simultaneous import jobs. |
| NFR-SCL-002 | Search/indexing workers, async processors, and AI inference workers shall scale independently. |
| NFR-SCL-003 | The system shall support horizontal scaling for search, job processing, and inference without application code changes. |

### 8.3 Security
| NFR ID | Requirement |
| --- | --- |
| NFR-SEC-001 | All user-facing and service-to-service traffic shall use TLS 1.2 or higher. |
| NFR-SEC-002 | Sensitive data at rest shall be encrypted using department-approved standards. |
| NFR-SEC-003 | Least-privilege RBAC shall be enforced for all APIs and UI actions. |
| NFR-SEC-004 | Privileged local-auth accounts shall require MFA. |
| NFR-SEC-005 | Evidence access, export, approval, and configuration changes shall be audit logged. |
| NFR-SEC-006 | No case data shall be sent to public external AI services unless explicitly approved by the department. |
| NFR-SEC-007 | Secrets, tokens, and private keys shall be stored in a dedicated secrets manager or department-approved equivalent. |

### 8.4 Availability, Backup & Recovery
| NFR ID | Requirement |
| --- | --- |
| NFR-AVL-001 | Target application availability shall be 99.5% monthly excluding approved maintenance windows. |
| NFR-AVL-002 | Background jobs shall be restart-safe and resumable after service interruption. |
| NFR-AVL-003 | Database backups shall run at least daily. |
| NFR-AVL-004 | Baseline recovery targets shall be RPO <= 24 hours and RTO <= 4 hours. |

### 8.5 Observability & Supportability
| NFR ID | Requirement |
| --- | --- |
| NFR-OBS-001 | All services shall expose health-check endpoints and structured logs. |
| NFR-OBS-002 | Application, audit, integration, and worker logs shall be centrally searchable by correlation_id. |
| NFR-OBS-003 | Metrics shall be exposed for request latency, queue depth, failed jobs, inference latency, and sync retry counts. |
| NFR-OBS-004 | Separate dev, test, UAT, and prod environments shall be supported. |

### 8.6 Accessibility & Internationalization
| NFR ID | Requirement |
| --- | --- |
| NFR-ACC-001 | The web UI shall meet WCAG 2.1 AA standards for applicable screens. |
| NFR-ACC-002 | Core workflows shall be keyboard accessible. |
| NFR-I18N-001 | The MVP UI language shall be English. |
| NFR-I18N-002 | The platform shall support Unicode evidence text. |
| NFR-I18N-003 | Keyword dictionaries and NLP pipelines shall be configurable for English, Telugu, Hindi, and other Unicode inputs. |
| NFR-I18N-004 | Date/time display shall be timezone-aware and configurable. |

## 9. Integration Requirements

| Integration ID | External System | Interface Type | Authentication Method | Data Format | Retry Mechanism | Failure Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| INT-01 | DOPAMS | API or approved secure file/data exchange | JWT bearer or mTLS | JSON or approved exchange file | Retry 1m/5m/15m/60m/240m with dead-letter after max attempts | Queue sync, create alert, allow manual replay after mapping correction |
| INT-02 | Forensic Tool Export Packages | File import adaptor | N/A (package upload within platform) | CSV/JSON/XML/HTML/PDF/ZIP/export folders | Per-file continue-on-error; reprocess allowed via new job version | Retain raw package, mark warnings/errors, avoid overwrite |
| INT-03 | SSO / LDAP / Active Directory | SAML / OIDC / LDAP | SAML assertions / OIDC tokens / LDAPS bind | Assertion / JWT / directory attributes | Auth retries per identity-provider policy; cache metadata | Fallback local auth when enabled and approved |
| INT-04 | Email Notification Service | SMTP / API | SMTP auth or API token | Email payload | Retry transient send failures 3 times with backoff | Retain in-app notifications even if email fails |
| INT-05 | Webhook Consumer | HTTPS webhook | Signed secret or mTLS | JSON | Retry transient delivery failures 5 times with backoff | Record delivery failure in alert and audit logs |
| INT-06 | OCR / Document Text Service | Internal API | mTLS or service token | Image/PDF in, JSON text out | Retry transient failures; mark Deferred on outage | Continue import, create derived-artifact retry task |

## 10. Compliance & Regulatory Mapping

| Compliance ID | Compliance Requirement | Mapped Functional Requirement(s) | System Control | Audit Artifact |
| --- | --- | --- | --- | --- |
| CMP-01 | Evidence immutability and forensic soundness | FR-02, FR-03, FR-04, FR-17 | Immutable object storage; checksum capture; versioned reprocessing; legal hold workflow | Checksum records, audit trail, chain-of-custody export |
| CMP-02 | Chain of custody | FR-04, FR-11 | Append-only audit events and exportable custody log | Chain-of-custody report, audit-event history |
| CMP-03 | Secure authentication and authorization | FR-14 | SSO/local auth, MFA, RBAC, case/unit scoping, step-up re-authentication | Auth logs, role-change audit logs |
| CMP-04 | Cybersecurity and data protection | FR-14, FR-16, FR-17 | TLS, encryption at rest, secrets management, retention policies, public-AI restriction | Security configuration export, environment checklist, audit logs |
| CMP-05 | Secure DOPAMS exchange | FR-12 | JWT/mTLS, payload hashing, idempotency keys, retry controls | Sync logs, payload hash records, dead-letter logs |
| CMP-06 | Human-in-the-loop legal defensibility | FR-07, FR-10, FR-11 | Analyst disposition, supervisor approvals, rationale capture, report publication gate | Finding review history, mapping approvals, report approval audit trail |
| CMP-07 | Data retention and controlled disposal | FR-17 | Retention policy IDs, legal hold states, privileged purge approval | Retention policy config, archive/purge audit events |
| CMP-08 | Operational traceability | FR-04, FR-12, FR-15 | Structured logs, health checks, correlation IDs, MIS outputs | Operational dashboards, log exports, scheduled MIS files |
| CMP-09 | Department ownership and customization | FR-16, Appendix-D | Configuration-driven rules/templates; solution ownership note | Configuration package export, acceptance dossier |

## 11. UI / UX Requirements

| Screen ID | Screen Name | Role Visibility | Input Fields | Validation Behavior | Error Display Rules | Conditional Rendering Logic |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | Login / SSO | All interactive roles | username, password, otp_code, SSO button | Require username/password for local auth; otp_code for MFA-enabled users | Display generic auth errors without revealing account existence | Show local-auth fields only when local auth is enabled |
| UI-02 | Case List | Admin, Supervisor, Analyst, Investigator, Auditor | search_text, unit_filter, status_filter, owner_filter, date_range | Validate date range and access scope | Inline validation above grid; preserve filters on refresh | Show edit actions only for roles with case_edit permission |
| UI-03 | Case Detail Overview | Admin, Supervisor, Analyst, Investigator, Auditor | status change, owner reassignment, notes | Mandatory close_reason on Close | Modal with specific field errors on invalid transition | Show close/reopen only for supervisor/admin |
| UI-04 | Evidence Import Wizard | Admin, Supervisor, Analyst | source_tool, source_device_ref, files, checksum, comments | Require source_tool and at least one file | Per-file validation with machine-readable error codes | Show quarantine warning panel when checksum mismatch detected |
| UI-05 | Import Job Monitor | Admin, Supervisor, Analyst, SupportOperator | job filters, retry action | Retry allowed only on Failed/CompletedWithWarnings jobs with permission | Status badge + expandable warnings/errors | Show retry button only for authorized roles |
| UI-06 | Artifact Explorer | Admin, Supervisor, Analyst, Investigator, Auditor | query_text, filters, sort, page_size | Whitelist sortable fields; page_size max 200 | Empty-state and filter-validation messages | Preview/download actions rendered by permission and artifact type |
| UI-07 | AI Findings Queue | Admin, Supervisor, Analyst | severity_filter, status_filter, assignee, review action | Comment required for FalsePositive or Escalated | Prevent invalid disposition transition with inline reason | Legal mapping panel visible only when finding is Confirmed or NeedsReview |
| UI-08 | Timeline View | Admin, Supervisor, Analyst, Investigator, Auditor | date window, artifact type filters, entity highlight | date_from <= date_to | Show message when data exceeds render limit | Cluster timeline entries when count exceeds threshold |
| UI-09 | Relationship Graph View | Admin, Supervisor, Analyst, Investigator, Auditor | depth, central entity, relation filter | Depth must be 1-4 | Prompt for refinement when graph too dense | Merge/split controls visible only to analyst+ |
| UI-10 | Legal Mapping Review | Admin, Supervisor, Analyst | mapping action, legal section selection, rationale | Rationale required for manual assignment or rejection | Prevent approval if no legal_section selected | Approve button visible only to supervisor/admin |
| UI-11 | Report Builder / Preview | Admin, Supervisor, Analyst | template selection, finding selection, redaction profile, annexure toggles | Template must be published; all findings reviewed | Template validation summary before generation | Publish controls visible only after supervisor approval |
| UI-12 | DOPAMS Sync Monitor | Admin, Supervisor, SupportOperator | direction, status, retry, payload view | Retry blocked for schema-invalid failures until corrected | Display sync error_message and correlation_id | Manual replay visible only to supervisor/admin |
| UI-13 | MIS Dashboard | Admin, Supervisor | report selector, filters, schedule options | Date range required; schedule frequency whitelist | Show export generation progress and errors | Scheduling section hidden for roles without schedule_manage permission |
| UI-14 | User / Role Administration | Admin | user profile, role, unit, status, reset actions | Unique username; privileged local users require MFA | Block save with field-level errors | Service-account controls visible only for admin |
| UI-15 | Audit Trail Viewer | Admin, Supervisor, Auditor | case filter, action filter, actor filter, export action | Filters limited to authorized cases | Show no-data and access-denied states distinctly | Export button hidden without audit_export permission |
| UI-16 | Configuration Management | Admin, ConfigurationManager | config type, version label, content editor/import, publish | Validation must pass before publish | Display structured validation errors by config key | Rollback action visible only for published versions |

## 12. Reporting & Analytics

| Report ID | Report Name | Data Source | Filters | Aggregations | Export Formats |
| --- | --- | --- | --- | --- | --- |
| REP-01 | Court-ready forensic report | Case + reviewed findings + legal mappings + report template | case_id, report_version, redaction_profile | Sectional totals, annexure counts, finding counts by severity | PDF, DOCX |
| REP-02 | Chain-of-custody log | AuditEvent + EvidenceSource + Artifact | case_id, evidence_id, date_range | Chronological custody events | PDF, CSV |
| REP-03 | Case volume MIS | Case | date_range, unit, status | case_count by date/unit/status | CSV, PDF |
| REP-04 | Import throughput MIS | ImportJob + EvidenceSource | date_range, source_tool, status | job_count, avg duration, warnings, failures | CSV, PDF |
| REP-05 | Risk distribution MIS | RiskScore + AIFinding | date_range, unit, risk_band, category | count by risk band and category | CSV, PDF |
| REP-06 | Turnaround time MIS | Case + Report | date_range, unit, analyst | avg days from Active to Published | CSV, PDF |
| REP-07 | User activity MIS | AuditEvent | date_range, user, unit, action | action counts by user/role | CSV, PDF |
| REP-08 | Integration status MIS | DOPAMSSyncEvent | date_range, status, event_type | success rate, retry count, dead-letter count | CSV, PDF |

## 13. Audit & Logging

### 13.1 What Is Logged
| Log ID | Log Area | Logged Events |
| --- | --- | --- |
| LOG-001 | Authentication events | login, logout, auth failure, MFA challenge, token refresh, session timeout |
| LOG-002 | Authorization events | permission denied, step-up re-auth required, role change |
| LOG-003 | Evidence events | upload, checksum verification, quarantine, import, reprocess, preview, export |
| LOG-004 | Analysis events | OCR execution, finding generation, risk scoring, entity merge/split |
| LOG-005 | Workflow events | case status changes, alert acknowledgement, report generation, report approval, report publication |
| LOG-006 | Integration events | DOPAMS inbound/outbound sync attempts, retries, failures, dead-letter |
| LOG-007 | Configuration events | config import, validation, publish, rollback, template change, dictionary change |
| LOG-008 | Operational events | service health degradation, job worker failure, queue threshold breach |

### 13.2 Who Can View Logs
| View ID | Role | Access Scope |
| --- | --- | --- |
| LOG-VIEW-01 | Administrator | All logs and exports |
| LOG-VIEW-02 | Supervisor | Case-scoped logs, alerts, report approvals, sync logs |
| LOG-VIEW-03 | Auditor | Case-scoped audit and custody records, no config write access |
| LOG-VIEW-04 | SupportOperator | Operational logs only; no evidence-content logs unless explicitly granted |

### 13.3 Log Retention
| Retention ID | Log Type | Retention Rule |
| --- | --- | --- |
| LOG-RET-01 | Audit events | Retain for the life of the originating case and never less than the active department retention policy. |
| LOG-RET-02 | Operational logs | Retain searchable copies for at least 180 days and archived copies per department policy. |
| LOG-RET-03 | Generated reports and sync records | Retain at least as long as the originating case unless legal hold requires longer retention. |

## 14. Test Case Derivation Section

| Test Case ID | Functional Requirement | Test Scenario | Expected Result |
| --- | --- | --- | --- |
| TC-FR-01-01 | FR-01 | Create a case with all mandatory fields and activate it. | Case is created with unique case_id and transitions from Draft to Active successfully. |
| TC-FR-01-02 | FR-01 | Attempt to close a case as Analyst. | API/UI blocks the action with access denied; audit event records denied attempt. |
| TC-FR-02-01 | FR-02 | Upload a valid evidence package with Idempotency-Key and checksum. | EvidenceSource is created, raw package stored immutably, and upload session returned. |
| TC-FR-02-02 | FR-02 | Upload a package with caller checksum mismatch. | Evidence enters Quarantined status and downstream ingest is blocked. |
| TC-FR-03-01 | FR-03 | Ingest a supported UFED export containing messages and call logs. | Import job completes and canonical Artifact rows are created with source lineage. |
| TC-FR-03-02 | FR-03 | Ingest a mixed package containing one corrupt file and one valid file. | Import job completes as CompletedWithWarnings; valid files parse and corrupt file is reported. |
| TC-FR-04-01 | FR-04 | Export a case chain-of-custody log. | System produces PDF/CSV export containing ordered custody events and immutable audit references. |
| TC-FR-04-02 | FR-04 | Force an audit write failure during evidence export. | Evidence export is aborted and error is surfaced; no unlogged export occurs. |
| TC-FR-05-01 | FR-05 | Search within a case for high-risk messages by date range. | Result set is returned with pagination, snippets, lineage, and sortable columns. |
| TC-FR-05-02 | FR-05 | Open an artifact with unsupported preview renderer. | UI shows metadata fallback and permitted download-original action. |
| TC-FR-06-01 | FR-06 | Enable OCR for uploaded screenshot image. | DerivedText artifact is created and linked to the source artifact with extraction metadata. |
| TC-FR-06-02 | FR-06 | Simulate OCR service outage during import. | Import completes for other artifacts and failed OCR artifacts are marked Deferred for retry. |
| TC-FR-07-01 | FR-07 | Run analysis on artifact containing suspicious keywords and financial routing indicators. | Finding is generated with category_code, confidence_score, rule hits, and model/rule provenance. |
| TC-FR-07-02 | FR-07 | Mark a finding FalsePositive without comment. | System blocks save and requires comment per validation rule. |
| TC-FR-08-01 | FR-08 | Merge two phone-number entities in the same case. | System creates merged entity state, preserves provenance, and writes audit event. |
| TC-FR-08-02 | FR-08 | Attempt to merge entities from different cases. | System rejects the request with ENTITY_CASE_MISMATCH. |
| TC-FR-09-01 | FR-09 | Recalculate risk after a finding is confirmed. | RiskScore recalculates, persists components_json, and updates review queues. |
| TC-FR-09-02 | FR-09 | Override a score without override reason. | System rejects override with validation error. |
| TC-FR-10-01 | FR-10 | Accept an auto-suggested legal mapping and approve it as Supervisor. | Mapping transitions to Approved and becomes available to report generation. |
| TC-FR-10-02 | FR-10 | Publish a report using a retired legal section. | System flags the draft for review and blocks publication until mapping is corrected. |
| TC-FR-11-01 | FR-11 | Generate a report draft from reviewed findings using a published template. | Report draft file is generated with sections and annexures as configured. |
| TC-FR-11-02 | FR-11 | Attempt to publish a report containing an Unreviewed finding. | System blocks approval/publication and identifies offending finding IDs. |
| TC-FR-12-01 | FR-12 | Sync a published report reference to DOPAMS. | Sync event is queued and processed idempotently; success recorded in sync log. |
| TC-FR-12-02 | FR-12 | Replay the same sync request with identical Idempotency-Key. | No duplicate sync side-effect occurs; original result is returned. |
| TC-FR-13-01 | FR-13 | Trigger a Critical alert from a new critical finding. | Alert is created within 30 seconds with SLA due time and assignment state. |
| TC-FR-13-02 | FR-13 | Dismiss an alert without dismissal reason. | System rejects dismissal and requires reason. |
| TC-FR-14-01 | FR-14 | Perform evidence export using a privileged role with MFA enabled. | System requires successful step-up re-authentication before export proceeds. |
| TC-FR-14-02 | FR-14 | Access a case outside the user's assignment/unit scope. | System returns HTTP 403 and does not reveal case content. |
| TC-FR-15-01 | FR-15 | Schedule weekly case-volume MIS report. | System persists schedule and generates/export report for authorized recipients. |
| TC-FR-15-02 | FR-15 | Generate a large MIS export exceeding synchronous threshold. | System processes report asynchronously and provides downloadable link when complete. |
| TC-FR-16-01 | FR-16 | Publish a validated new keyword dictionary version. | Version status changes to Published without application redeployment. |
| TC-FR-16-02 | FR-16 | Attempt to publish a template with missing required field references. | System blocks publish and returns validation errors. |
| TC-FR-17-01 | FR-17 | Place a case under LegalHold and attempt purge. | Purge is blocked and audit event records denied action. |
| TC-FR-17-02 | FR-17 | Archive an eligible closed case. | Case metadata remains discoverable and underlying storage moves to archive tier. |

## 15. Implementation Guidance for AI Development

### 15.1 Suggested Microservice Boundaries
| Service ID | Service Boundary | Responsibilities |
| --- | --- | --- |
| MS-01 | Identity & Access Service | Authentication, SSO federation, local auth, MFA, roles, permissions, session and service-account management. |
| MS-02 | Case & Evidence Service | Case master, evidence registration, immutable source metadata, legal hold flags, annotation anchors. |
| MS-03 | Ingestion & Parser Service | Upload finalization, parser adapters, normalization orchestration, import-job lifecycle. |
| MS-04 | Artifact & Search Service | Artifact persistence, search index projection, preview metadata, saved searches. |
| MS-05 | AI Analysis Service | OCR routing, rule engine, ML inference, finding creation, model/version governance hooks. |
| MS-06 | Entity & Graph Service | Entity extraction, merge/split logic, relationship edges, graph/timeline query API. |
| MS-07 | Scoring & Alert Service | Risk calculation, thresholds, alert rules, notification fan-out, SLA timers. |
| MS-08 | Report & Template Service | Template rendering, redaction, report approval workflow, PDF/DOCX generation. |
| MS-09 | Integration Service | DOPAMS sync, webhook/email connectors, field mapping, dead-letter queue, manual replay. |
| MS-10 | Admin & Governance Service | Configuration versions, report templates, legal mappings, dictionaries, audit viewer, MIS schedules. |

### 15.2 Suggested Database / Storage Groupings
| Grouping ID | Grouping | Contents |
| --- | --- | --- |
| DB-01 | Core OLTP schema | Case, EvidenceSource, ImportJob, Artifact metadata, AIFinding, RiskScore, LegalMapping, Report, Alert, User, Role, ConfigVersion. |
| DB-02 | Search/index store | Denormalized artifact text, entity lookup, relationship search projections, report text projections. |
| DB-03 | Object store | Raw evidence packages, generated report files, preview assets, archived exports. |
| DB-04 | Analytics marts | MIS/reporting aggregates and scheduled-report materializations. |

### 15.3 Suggested Frontend Module Breakdown
| Module ID | Module | Responsibilities |
| --- | --- | --- |
| FE-01 | Auth & Session | Login, SSO callback, MFA challenge, session timeout handling. |
| FE-02 | Case Workspace | Case list, case detail, assignment, notes, dashboard widgets. |
| FE-03 | Evidence Intake | Upload wizard, import monitor, quarantine handling. |
| FE-04 | Review Workspace | Artifact explorer, preview pane, findings queue, timeline, graph. |
| FE-05 | Legal & Reporting | Legal mapping review, report builder, report preview, approval flow. |
| FE-06 | Operations & Admin | DOPAMS sync monitor, MIS dashboard, audit viewer, user/role admin, configuration management. |

### 15.4 Suggested Folder Structure
| Folder ID | Path | Purpose |
| --- | --- | --- |
| FS-01 | /apps/web | React/TypeScript frontend. |
| FS-02 | /apps/api-gateway | Public REST gateway and auth middleware. |
| FS-03 | /services/case-service | Case and evidence domain. |
| FS-04 | /services/ingestion-service | Parser orchestration and import jobs. |
| FS-05 | /services/analysis-service | OCR, rules, model inference, finding creation. |
| FS-06 | /services/graph-service | Entity resolution and relationship APIs. |
| FS-07 | /services/report-service | Template rendering, export, approvals. |
| FS-08 | /services/integration-service | DOPAMS and notification connectors. |
| FS-09 | /packages/domain-models | Shared DTOs, enums, schema validators. |
| FS-10 | /packages/workflow-definitions | State machines, timer policies, retry policies. |
| FS-11 | /packages/infrastructure | Logging, metrics, config loading, secrets, storage adapters. |

### 15.5 Suggested API Grouping
| API Group ID | Group | Paths |
| --- | --- | --- |
| AG-01 | Auth APIs | /auth/* |
| AG-02 | Case & Evidence APIs | /cases/*, /evidence/*, /import-jobs/* |
| AG-03 | Review APIs | /artifacts/*, /findings/*, /entities/*, /relationships/* |
| AG-04 | Scoring & Alerts APIs | /risk/*, /alerts/* |
| AG-05 | Report & Legal APIs | /reports/*, /legal-mappings/*, /templates/* |
| AG-06 | Integration APIs | /integrations/dopams/*, /webhooks/* |
| AG-07 | Admin & Governance APIs | /users/*, /roles/*, /config/*, /audit-events/*, /mis/* |

### 15.6 Prompt Engineering Notes
| Prompt Note ID | Guidance |
| --- | --- |
| AI-PROMPT-01 | Treat AI findings as advisory; every prompt and model output must return structured reason codes, confidence, and source artifact IDs. |
| AI-PROMPT-02 | Prompt templates for NLP classification should include artifact_type, language_hint, prior rule hits, and a strict JSON schema response contract. |
| AI-PROMPT-03 | Never allow prompts or inference payloads to leave approved infrastructure; disable any external telemetry by default. |
| AI-PROMPT-04 | Use retrieval from case-local dictionaries, legal mappings, and slang lists rather than embedding hard-coded statutory language into model prompts. |
| AI-PROMPT-05 | Persist prompt_version_id and model_version for every AI-generated finding to support replay and audit. |

## Appendix A. Gap Analysis Matrix

| RFP Clause | RFP Location | Category | Present in BRD? (Y/N) | Gap Description | Required Enhancement |
| --- | --- | --- | --- | --- | --- |
| RFP-OBJ-01 | Tender p.1 | Product | Y | BRD states centralized platform but does not define service boundaries, deployment topology, or ownership of data stores. | Add target architecture principles, service boundaries, deployment model options, and data ownership rules. |
| RFP-OBJ-02 | Tender p.1 | Product | Y | Suspicious activity detection is present but decision thresholds, categories, and false-positive handling are not fully enumerated. | Add explicit detection categories, threshold configuration, review states, and model/rule explainability requirements. |
| RFP-OBJ-03 | Tender p.1 | Outcome | Y | Business value is stated narratively, not as measurable success metrics. | Add KPI baselines and target metrics for triage effort, turnaround time, and review throughput. |
| RFP-OBJ-04 | Tender p.1 | Outcome | Y | Standardized reporting is present but report approval, redaction, and template governance need more detail. | Add report versioning, approval workflow, template control, watermarking, and export manifest requirements. |
| RFP-OBJ-05 | Tender p.1 | Outcome | Y | Drug-related detection is covered, but category taxonomy is not implementation-ready. | Add configurable finding taxonomy, example categories, multilingual support, and escalation rules. |
| RFP-OBJ-06 | Tender p.1 | Product | Y | DOPAMS integration is covered but field-level mapping, retry schedule, and idempotency contract are not fully specified. | Add DOPAMS field mapping, sync payload schema, retry policy, deduplication key, and dead-letter handling. |
| RFP-OBJ-07 | Tender p.1 | Product | Y | Cross-platform monitoring is implied by multi-tool ingestion but not described as a unified analyst workflow. | Add cross-tool correlation, timeline, and graph navigation requirements tied to normalized artifacts. |
| RFP-OBJ-08 | Tender p.1 | Product | Y | AI-based categorization is present but classification outputs and taxonomy governance are under-specified. | Add category master data, model versioning, confidence bands, and disposition workflow. |
| RFP-OBJ-09 | Tender p.1 | Product | Y | Risk scoring exists, but scoring formula governance, override controls, and auditability are under-specified. | Add weighted scoring rules, score component persistence, score versioning, and override approvals. |
| RFP-OBJ-10 | Tender p.1 | Product | Y | Legal mapping exists but legal-section master data lifecycle and approval controls are not detailed. | Add legal section master, mapping versioning, acceptance workflow, and audit fields. |
| RFP-OBJ-11 | Tender p.1 | Compliance | Y | Evidence preservation is present, but quarantine, legal hold, archive, and purge controls are not fully defined. | Add evidence immutability, legal hold, archive/purge workflow, and checksum mismatch quarantine rules. |
| RFP-OBJ-12 | Tender p.1 | Product | Y | Alerts are present but real-time latency, acknowledgement SLAs, and escalation timers are not measurable. | Add alert generation latency, SLA timers, assignment rules, and escalation ladder. |
| RFP-SOW-01 | Tender p.12 | Product | Y | Named tool support is listed but parser plugin contract and onboarding process for new tools are not defined. | Add parser interface contract, supported export package matrix, and parser certification test cases. |
| RFP-SOW-02 | Tender p.12 | Product | Y | Structured/unstructured coverage is broad but artifact-level parsing expectations are not fully defined. | Add canonical artifact types, file types, parsing outcomes, and unsupported-file handling. |
| RFP-SOW-03 | Tender p.12 | Product | Y | Normalization is present but canonical schema, enumerations, and mandatory lineage fields need formalization. | Add canonical data model, attribute-level validation rules, and lineage metadata. |
| RFP-SOW-04 | Tender p.12 | Product | Y | AI analysis scope is present but OCR/text extraction and multimodal processing behavior are not separated into pipeline stages. | Add OCR/derived-artifact pipeline, media/document processing rules, and failure isolation. |
| RFP-SOW-05 | Tender p.12 | Product | Y | Relationship detection is present but rule outputs, entity types, and provenance requirements need formal definitions. | Add entity types, relation types, provenance links, and rationale fields. |
| RFP-SOW-06 | Tender p.12 | Product | Y | Prioritization is present but queue ordering rules and tie-breakers are not defined. | Add queue sorting algorithm, score bands, analyst override rules, and audit trail requirements. |
| RFP-SOW-07 | Tender p.12 | Product | Y | Dashboard exists but widgets, filters, and refresh behavior are not precise. | Add screen-level functional specs, default widgets, filter persistence, and refresh intervals. |
| RFP-SOW-08 | Tender p.12 | Product | Y | Search and visualization are present but query behavior, pagination, and graph constraints are not specified. | Add search API behavior, filter schema, pagination, export, and graph rendering requirements. |
| RFP-SOW-09 | Tender p.12 | Security | Y | RBAC exists but authorization scope model and privileged action controls are under-specified. | Add role-permission matrix, case/unit scoping, MFA, and privileged re-authentication rules. |
| RFP-SOW-10 | Tender p.12 | Product | Y | Court-ready reporting exists but publication controls and annexure assembly rules require more detail. | Add report status workflow, annexure composition, approval gates, and immutable publication records. |
| RFP-SOW-11 | Tender p.12 | Product | Y | Template configurability is present but versioning and rollback are limited to generic statements. | Add template schema, version lifecycle, validation, and publish/rollback controls. |
| RFP-SOW-12 | Tender p.12 | Product | Y | Export formats are listed but output fidelity and error handling are not measurable. | Add PDF/DOCX export acceptance criteria, file naming, metadata embedding, and export failure responses. |
| RFP-SOW-13 | Tender p.12 | Integration | Y | Integration is present but inbound/outbound scope is not translated into field-level contracts. | Add case link API, status sync events, report reference schema, and sync observability. |
| RFP-SOW-14 | Tender p.12 | Integration | Y | Secure data exchange is stated but transport, auth, encryption, and failure fallback are not explicit. | Add auth mechanisms, transport security, payload hashing, retry logic, and fallback process. |
| RFP-ARCH-01 | Tender p.12 | Architecture | Y | Centralized platform is described conceptually only. | Add component topology, tenancy assumption (single department), and deployment zones. |
| RFP-ARCH-02 | Tender p.12 | Architecture | Y | Modular/scalable is stated but no service decomposition or scaling strategy is defined. | Add microservice boundaries, independent scaling units, and queue-based workloads. |
| RFP-ARCH-03 | Tender p.12 | Compliance | Y | Forensic soundness is covered generally but not expressed as explicit controls. | Add immutability, checksum verification, source lineage, reprocessing versioning, and legal hold controls. |
| RFP-ARCH-04 | Tender p.12 | Compliance | Y | Audit/chain of custody are present but viewer permissions, retention, and export formats are not defined. | Add audit event schema, retention rules, audit viewer requirements, and export controls. |
| RFP-ARCH-05 | Tender p.12 | Security | Y | Authentication/authorization are partially present. | Add SSO/OIDC/SAML, local fallback auth, service accounts, session timeout, and MFA requirements. |
| RFP-ARCH-06 | Tender p.12 | Compliance | Y | Cybersecurity/data protection is stated but control catalogue is not formalized. | Add encryption, secrets management, logging, retention, public-AI restrictions, and compliance artifacts. |
| RFP-IMP-01 | Tender p.12 | Delivery | Y | The BRD contains a milestone suggestion, not a formal implementation plan specification. | Add implementation workstreams, environment readiness inputs, data migration/import readiness, and acceptance deliverables. |
| RFP-IMP-02 | Tender p.12 | Deployment | Y | Deployment options are listed but runtime assumptions and infra dependency outputs are not detailed. | Add environment matrix, sizing inputs, deployment prerequisites, and approved hosting patterns. |
| RFP-IMP-03 | Tender p.12 | Delivery | N | BRD lacks formal system testing and acceptance criteria section. | Add UAT entry/exit criteria, test case derivation, acceptance metrics, and sign-off roles. |
| RFP-IMP-04 | Tender p.12 | Delivery | Y | BRD has milestones/phases but not pilot success criteria or rollout gates. | Add pilot scope, rollout readiness checklist, and hypercare exit criteria. |
| RFP-IMP-05 | Tender p.13 | Deployment | N | Infrastructure requirement disclosure is not formalized in BRD. | Add infrastructure sizing worksheet and required hardware/software/OS outputs. |
| RFP-IMP-06 | Tender p.3 | Delivery | Y | Timeline is noted as a constraint only. | Add delivery milestone dependencies and scope prioritization aligned to 6-week delivery. |
| RFP-IMP-07 | Tender p.3 | Delivery | Y | Installation window is noted but not operationalized. | Add installation checklist, cutover tasks, and sign-off outputs for week 7. |
| RFP-SUP-01 | Tender p.12 | Service | Y | Training is mentioned but curricula, roles, and completion artifacts are not specified. | Add training plan by role, attendance evidence, and handover outputs. |
| RFP-SUP-02 | Tender p.12 | Service | Y | Documentation is mentioned but required document set is not enumerated. | Add required documents: user guide, admin guide, API spec, deployment guide, runbook, and support SOP. |
| RFP-SUP-03 | Tender p.12 | Service | Y | Remote support is mentioned but service channels and severity handling are not defined. | Add support channel matrix, severity levels, response targets, and escalation route. |
| RFP-SUP-04 | Tender p.12 | Service | Y | Updates/upgrades are mentioned but change control is not defined. | Add release management, maintenance windows, rollback, and compatibility rules. |
| RFP-SUP-05 | Tender p.12 | Service | N | On-site support requirement is absent in the BRD. | Add support delivery model and distinguish included hypercare from chargeable additional on-site support. |
| RFP-SUP-06 | Tender p.13 | Service | N | Two-week post-deployment manpower requirement is absent in the BRD. | Add hypercare staffing, roles, on-site coverage hours, and handover expectations. |
| RFP-SUP-07 | Tender p.4 | Service | Y | Warranty is captured, but onsite warranty service boundaries are not detailed. | Add warranty coverage scope, exclusions, and defect response/closure targets. |
| RFP-SUP-08 | Tender p.13 | Service | Y | Maintenance/upgradation is captured generically. | Add maintenance deliverables, patch policy, and compatibility responsibilities. |
| RFP-SUP-09 | Tender p.13 | Service | N | Post-warranty ATS option is not captured. | Add post-warranty support option as a contractual appendix reference. |
| RFP-DEL-01 | Tender p.12-13 | Deliverable | Y | Platform deliverable is present but acceptance deliverables are not itemized. | Add deliverable checklist with acceptance evidence. |
| RFP-DEL-02 | Tender p.12-13 | Deliverable | Y | Dashboard deliverable exists but not screen-wise. | Add UI screen catalogue and acceptance criteria. |
| RFP-DEL-03 | Tender p.12-13 | Deliverable | Y | Reporting module exists but not acceptance-tested as a deliverable. | Add report module deliverable criteria and sample output validation. |
| RFP-DEL-04 | Tender p.12-13 | Deliverable | Y | DOPAMS integration exists but not framed as acceptance deliverable. | Add integration test pack and sync monitoring requirements. |
| RFP-DEL-05 | Tender p.12-13 | Deliverable | Y | Training/documentation deliverable not itemized. | Add deliverable checklist for training completion and documentation handover. |
| RFP-DEL-06 | Tender p.12-13 | Deliverable | Y | Support/maintenance deliverable not itemized. | Add support model, runbook, and warranty deliverable records. |
| RFP-DEL-07 | Tender p.13 | Deliverable | Y | MIS is present but output catalogue is not enumerated. | Add report IDs, filters, schedules, and exports. |
| RFP-DEL-08 | Tender p.13 | Security | Y | RBAC is present but not shown as a deliverable matrix. | Add role matrix and access-control configuration artefacts. |
| RFP-DEL-09 | Tender p.13 | Architecture | Y | Scalable/customizable is present but not reduced to implementation constraints. | Add configuration boundaries, no-code admin settings, and extension points. |
| RFP-DEL-10 | Tender p.13 | Governance | Y | Ownership is assumed but not operationalized. | Add IP/ownership, source configuration ownership, and data ownership notes in governance appendix. |
| RFP-ANN-01 | Tender p.15-71 | UX | Y | BRD references mixed-format evidence, but UI/report component requirements are still high level. | Add mixed-media preview rules, annexure rendering, and graph/image/document support requirements. |
| RFP-COM-01 | Tender p.4 | Commercial | N | Commercial payment clause is not reflected in BRD. | Add non-product contractual appendix linking delivery milestones to payment evidence. |
| RFP-COM-02 | Tender p.4 | Commercial | N | Penalty clause is not reflected in BRD. | Add delivery control appendix with milestone dates and delay-risk dependencies. |
| RFP-COM-03 | Tender p.4 | Commercial | N | PBG requirement is not reflected in BRD. | Add vendor/commercial traceability appendix. |
| RFP-COM-04 | Tender p.2, p.5-6 | Governance | N | Contract governance clauses are not reflected in BRD. | Add governance appendix for legal/jurisdiction/language constraints. |
| RFP-COM-05 | Tender p.3, p.4 | Governance | N | No-consortium/no-subcontracting clause is not reflected in BRD. | Add vendor qualification appendix so procurement clauses remain traceable. |
| RFP-COM-06 | Tender p.4 | Governance | N | Evaluation criteria are not reflected in BRD. | Add design-review checklist aligned to evaluation criteria. |
| RFP-BID-01 | Tender p.2-3 | Qualification | N | Bidder legal-entity qualification is not a product requirement and is absent from BRD. | Track in vendor compliance appendix; do not convert into system functionality. |
| RFP-BID-02 | Tender p.2, p.8 | Qualification | N | OEM authorization/support clause is absent from BRD. | Track in vendor compliance appendix with service dependency notes. |
| RFP-BID-03 | Tender p.2-3 | Qualification | N | Past experience qualification is absent from BRD. | Track in vendor compliance appendix. |
| RFP-BID-04 | Tender p.3 | Qualification | N | Turnover qualification is absent from BRD. | Track in vendor compliance appendix. |
| RFP-BID-05 | Tender p.3 | Qualification | N | Hyderabad office qualification is absent from BRD. | Track in vendor compliance appendix. |
| RFP-BID-06 | Tender p.3, p.11 | Qualification | N | Clean-track-record qualification is absent from BRD. | Track in vendor compliance appendix. |
| RFP-BID-07 | Tender p.3 | Qualification | N | ISO certification qualification is absent from BRD. | Track in vendor compliance appendix and security assurance checklist. |
| RFP-BID-08 | Tender p.3 | Qualification | N | Manpower qualification is absent from BRD. | Track in vendor compliance appendix and delivery staffing plan. |

## Appendix B. RFP Traceability Matrix

| RFP Clause | RFP Location | Category | Requirement Summary | Refined BRD Reference | Implementation Artifacts | Traceability Status |
| --- | --- | --- | --- | --- | --- | --- |
| RFP-OBJ-01 | Tender p.1 | Product | Procure an AI-powered centralized digital forensic analysis and reporting platform. | §1 OBJ-001; §4 FR-01, FR-02, FR-03 | DM: Case/EvidenceSource/ImportJob; API-02/API-03/API-04; WF: Case Lifecycle | Covered in refined BRD |
| RFP-OBJ-02 | Tender p.1 | Product | Automate identification of suspicious activities. | §1 OBJ-002; §4 FR-07, FR-09, FR-13 | DM: AIFinding/RiskScore/Alert; API-07; WF: Finding Review | Covered in refined BRD |
| RFP-OBJ-03 | Tender p.1 | Outcome | Reduce manual forensic analysis effort and overall case turnaround time. | §1 OBJ-002; §1 ROI-001/002; §8 Performance | NFR-PERF-001..004; REP-06 | Covered in refined BRD |
| RFP-OBJ-04 | Tender p.1 | Outcome | Standardize forensic reporting across multiple forensic tools. | §1 OBJ-004; §4 FR-11 | DM: Report/LegalMapping/AuditEvent; API-09/API-10; WF: Report Lifecycle | Covered in refined BRD |
| RFP-OBJ-05 | Tender p.1 | Outcome | Improve detection accuracy for drug-related and other illicit activities. | §1 OBJ-003; §4 FR-07 | DM: AIFinding; Config taxonomy in FR-16 | Covered in refined BRD |
| RFP-OBJ-06 | Tender p.1 | Product | Enable seamless integration with DOPAMS for centralized case tracking and management. | §1 OBJ-005; §4 FR-01, FR-12 | DM: Case/DOPAMSSyncEvent; API-11; WF: DOPAMS Sync Lifecycle | Covered in refined BRD |
| RFP-OBJ-07 | Tender p.1 | Product | Support cross-platform monitoring. | §4 FR-03, FR-05, FR-08 | DM: Artifact/ExtractedEntity/Relationship; UI-08/UI-09 | Covered in refined BRD |
| RFP-OBJ-08 | Tender p.1 | Product | Support AI-based content categorization. | §4 FR-07, FR-16 | DM: AIFinding/ConfigVersion | Covered in refined BRD |
| RFP-OBJ-09 | Tender p.1 | Product | Support risk scoring and prioritization. | §4 FR-09 | DM: RiskScore; API search and queues | Covered in refined BRD |
| RFP-OBJ-10 | Tender p.1 | Product | Support legal section mapping. | §4 FR-10, FR-11 | DM: LegalMapping; UI-10 | Covered in refined BRD |
| RFP-OBJ-11 | Tender p.1 | Compliance | Support digital evidence preservation. | §4 FR-02, FR-04, FR-17 | DM: EvidenceSource/AuditEvent; REP-02 | Covered in refined BRD |
| RFP-OBJ-12 | Tender p.1 | Product | Support real-time alerts and escalation. | §4 FR-13; §7 Finding Review & DOPAMS Sync | DM: Alert; NFR-PERF-003; WF alert timers | Covered in refined BRD |
| RFP-SOW-01 | Tender p.12 | Product | Ingest output data generated by multiple forensic tools. | §4 FR-02, FR-03 | DM: EvidenceSource/ImportJob/Artifact; API-03/API-04/API-05 | Covered in refined BRD |
| RFP-SOW-02 | Tender p.12 | Product | Support structured and unstructured forensic data formats. | §4 FR-02, FR-03 | DM: EvidenceSource/ImportJob/Artifact; API-03/API-04/API-05 | Covered in refined BRD |
| RFP-SOW-03 | Tender p.12 | Product | Convert source data into a standardized, machine-readable format. | §4 FR-02, FR-03 | DM: EvidenceSource/ImportJob/Artifact; API-03/API-04/API-05 | Covered in refined BRD |
| RFP-SOW-04 | Tender p.12 | Product | Apply AI/ML to analyze messages, multimedia files, browsing history, application usage, and social media artifacts. | §4 FR-06, FR-07 | DM: Artifact/AIFinding; API-04 | Covered in refined BRD |
| RFP-SOW-05 | Tender p.12 | Product | Automatically detect suspicious keywords, behavioral patterns, and communication relationships. | §4 FR-07, FR-08 | DM: AIFinding/ExtractedEntity/Relationship | Covered in refined BRD |
| RFP-SOW-06 | Tender p.12 | Product | Prioritize high-risk artifacts for investigator review. | §4 FR-09, FR-13 | DM: RiskScore/Alert; UI-07 | Covered in refined BRD |
| RFP-SOW-07 | Tender p.12 | Product | Provide a centralized dashboard for forensic analysts. | §4 FR-05 | UI-02/UI-03/UI-06/UI-07 | Covered in refined BRD |
| RFP-SOW-08 | Tender p.12 | Product | Enable search, filtering, correlation, and visualization of evidence. | §4 FR-05, FR-08 | API-06; UI-06/UI-08/UI-09 | Covered in refined BRD |
| RFP-SOW-09 | Tender p.12 | Security | Support role-based access control. | §4 FR-14 | DM: User/Role; UI-14 | Covered in refined BRD |
| RFP-SOW-10 | Tender p.12 | Product | Generate automated, standardized, and court-ready forensic reports. | §4 FR-11 | DM: Report/LegalMapping/AuditEvent; API-09/API-10 | Covered in refined BRD |
| RFP-SOW-11 | Tender p.12 | Product | Support configurable report templates. | §4 FR-11, FR-16 | DM: Report/ConfigVersion; UI-11/UI-16 | Covered in refined BRD |
| RFP-SOW-12 | Tender p.12 | Product | Enable export in commonly used formats including PDF and DOCX. | §4 FR-11 | API-09/API-10; REP-01/REP-02 | Covered in refined BRD |
| RFP-SOW-13 | Tender p.12 | Integration | Integrate analyzed forensic data with DOPAMS. | §4 FR-01, FR-12 | DM: Case/DOPAMSSyncEvent; API-11; INT-01 | Covered in refined BRD |
| RFP-SOW-14 | Tender p.12 | Integration | Ensure secure data exchange and case linkage with DOPAMS. | §4 FR-12; §9 INT-01 | NFR-SEC-001; DOPAMS Sync Lifecycle | Covered in refined BRD |
| RFP-ARCH-01 | Tender p.12 | Architecture | Operate as an independent centralized platform. | §2 Constraints; §15 MS-01..MS-10 | Architecture boundaries and deployment patterns | Covered in refined BRD |
| RFP-ARCH-02 | Tender p.12 | Architecture | Support modular and scalable architecture. | §8 Capacity & Scalability; §15 microservices | MS-03..MS-10; DB-01..DB-04 | Covered in refined BRD |
| RFP-ARCH-03 | Tender p.12 | Compliance | Ensure data integrity and forensic soundness. | §4 FR-02, FR-03, FR-04, FR-17 | DM: EvidenceSource/ImportJob/AuditEvent | Covered in refined BRD |
| RFP-ARCH-04 | Tender p.12 | Compliance | Maintain audit trails and chain-of-custody logs. | §4 FR-04; §13 Audit & Logging | API-12; REP-02 | Covered in refined BRD |
| RFP-ARCH-05 | Tender p.12 | Security | Support secure user authentication and authorization. | §4 FR-14; §6 API-01 | DM: User/Role; UI-01/UI-14 | Covered in refined BRD |
| RFP-ARCH-06 | Tender p.12 | Compliance | Comply with applicable cybersecurity and data protection standards. | §8 Security; §10 CMP-04 | NFR-SEC; FR-17 retention | Covered in refined BRD |
| RFP-IMP-01 | Tender p.12 | Delivery | Provide a detailed system design and implementation plan. | Appendix D DLV-01; §15 folder/API guidance | System design pack | Covered in refined BRD |
| RFP-IMP-02 | Tender p.12 | Deployment | Deploy on customer-specified infrastructure: on-premise, hybrid, or cloud. | §2 Constraints; Appendix D ACC-02 | Environment matrix and infra sizing | Covered in refined BRD |
| RFP-IMP-03 | Tender p.12 | Delivery | Conduct system testing and acceptance. | §14 Test Case Derivation; Appendix D ACC-03 | TC-FR-*; UAT acceptance pack | Covered in refined BRD |
| RFP-IMP-04 | Tender p.12 | Delivery | Support pilot and phased rollout. | Appendix D DLV-01..DLV-04 | Pilot and phased rollout plan | Covered in refined BRD |
| RFP-IMP-05 | Tender p.13 | Deployment | Bidder shall inform the hardware, software, and OS requirements needed to host the solution. | §2 Assumptions/Constraints; Appendix D ACC-02 | Infrastructure sizing worksheet | Covered in refined BRD |
| RFP-IMP-06 | Tender p.3 | Delivery | Deliver the tool within 6 weeks from the purchase order. | §2 Constraints CON-INF-001; Appendix D DLV-01..DLV-04 | Delivery plan aligned to 6 weeks | Covered in refined BRD |
| RFP-IMP-07 | Tender p.3 | Delivery | Complete installation within 1 additional week. | §2 Constraints CON-INF-001; Appendix D DLV-04 | Installation checklist and sign-off | Covered in refined BRD |
| RFP-SUP-01 | Tender p.12 | Service | Provide comprehensive training for forensic analysts and administrators. | §2 In Scope; Appendix D ACC-05 | Training plan and attendance records | Covered in refined BRD |
| RFP-SUP-02 | Tender p.12 | Service | Provide detailed user manuals and technical documentation. | §2 In Scope; Appendix D ACC-04/05 | User/admin/API/deployment docs | Covered in refined BRD |
| RFP-SUP-03 | Tender p.12 | Service | Provide remote technical support for software-related issues. | §13 Audit & Logging; Appendix D ACC-04/06 | Support matrix and operational logs | Covered in refined BRD |
| RFP-SUP-04 | Tender p.12 | Service | Provide periodic software updates and upgrades. | §4 FR-16; Appendix D ACC-04 | ConfigVersion, release management | Covered in refined BRD |
| RFP-SUP-05 | Tender p.12 | Service | Provide on-site support if required. | Appendix D ACC-06 | Support model and on-site support note | Covered in refined BRD |
| RFP-SUP-06 | Tender p.13 | Service | Deploy 1-2 technical support personnel for 2 weeks post deployment. | Appendix D ACC-06 | Hypercare staffing schedule | Covered in refined BRD |
| RFP-SUP-07 | Tender p.4 | Service | Provide minimum 1 year comprehensive onsite warranty on the entire solution. | §2 In Scope; Appendix D ACC-06 | Warranty coverage note | Covered in refined BRD |
| RFP-SUP-08 | Tender p.13 | Service | Warranty shall include maintenance and upgradations for 1 year. | §2 In Scope; Appendix D ACC-06 | Maintenance/upgradation note | Covered in refined BRD |
| RFP-SUP-09 | Tender p.13 | Service | Annual Technical Support may be procured after the first year if required. | Appendix D commercial/governance | ATS post-warranty reference | Traced as contractual appendix, not product feature |
| RFP-DEL-01 | Tender p.12-13 | Deliverable | Deliver the AI-powered forensic analysis platform. | §4 FR-01..FR-17 | Full product deliverable | Covered in refined BRD |
| RFP-DEL-02 | Tender p.12-13 | Deliverable | Deliver the centralized dashboard. | §4 FR-05; §11 UI-02..UI-13 | Dashboard screens | Covered in refined BRD |
| RFP-DEL-03 | Tender p.12-13 | Deliverable | Deliver the automated reporting module. | §4 FR-11; §12 REP-01 | Reporting module | Covered in refined BRD |
| RFP-DEL-04 | Tender p.12-13 | Deliverable | Deliver DOPAMS integration. | §4 FR-12; §9 INT-01 | DOPAMS integration | Covered in refined BRD |
| RFP-DEL-05 | Tender p.12-13 | Deliverable | Deliver training and documentation. | §2 In Scope; Appendix D ACC-05 | Training + docs | Covered in refined BRD |
| RFP-DEL-06 | Tender p.12-13 | Deliverable | Deliver ongoing support and maintenance. | Appendix D ACC-04/06 | Support and maintenance | Covered in refined BRD |
| RFP-DEL-07 | Tender p.13 | Deliverable | Provide MIS reports as per department requirement. | §4 FR-15; §12 REP-03..REP-08 | MIS catalogue | Covered in refined BRD |
| RFP-DEL-08 | Tender p.13 | Security | Provide a role-based access system. | §4 FR-14; §3 Roles | Role/access matrix | Covered in refined BRD |
| RFP-DEL-09 | Tender p.13 | Architecture | Provide a scalable and customizable solution. | §4 FR-16; §8 Capacity & Scalability; §15 | Configuration-driven customization and scale | Covered in refined BRD |
| RFP-DEL-10 | Tender p.13 | Governance | The solution shall be owned by EAGLE FORCE Telangana. | §2 Assumptions; Appendix D | Governance/ownership note | Covered in refined BRD |
| RFP-ANN-01 | Tender p.15-71 | UX | Sample annexures demonstrate mixed-format evidence tables, relationship diagrams, screenshots, documents, financial images, and identity-document images that the solution must render and report. | §4 FR-05, FR-06, FR-08, FR-11; §11 UI-06/UI-09/UI-11 | Mixed-media preview and annexure support | Covered in refined BRD |
| RFP-COM-01 | Tender p.4 | Commercial | Payment terms: 80% on delivery and successful installation; 20% after satisfactory performance report 60 days post installation. | Appendix D commercial controls | Payment evidence mapping | Tracked as contractual appendix |
| RFP-COM-02 | Tender p.4 | Commercial | Late delivery/installation penalties apply up to 10%; delays beyond 30 days may trigger cancellation and forfeiture. | Appendix D commercial controls | Milestone and delay-risk controls | Tracked as contractual appendix |
| RFP-COM-03 | Tender p.4 | Commercial | Performance Bank Guarantee of 5% of project value is required within 1 week of purchase order and valid 30 days beyond warranty. | Appendix D commercial controls | PBG tracking | Tracked as contractual appendix |
| RFP-COM-04 | Tender p.2, p.5-6 | Governance | Contractual terms include 90-day bid validity, English language, Indian law, and Hyderabad jurisdiction. | Appendix D vendor/governance trace | Legal and language constraints | Tracked as contractual appendix |
| RFP-COM-05 | Tender p.3, p.4 | Governance | No consortium and no subcontracting are permitted. | Appendix D vendor/governance trace | Vendor governance constraint | Tracked as contractual appendix |
| RFP-COM-06 | Tender p.4 | Governance | Evaluation considers technical compliance, architecture, AI capability, implementation approach, support, and commercial competitiveness. | Appendix D acceptance deliverables | Design review checklist | Tracked as contractual appendix |
| RFP-BID-01 | Tender p.2-3 | Qualification | Bidder must be a legally registered Indian entity with RoC, PAN, and GST documentation. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-02 | Tender p.2, p.8 | Qualification | Bidder must provide OEM / Manufacturer Authorization Form with delivery timeline and support commitments. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-03 | Tender p.2-3 | Qualification | Bidder must demonstrate qualifying past experience with government / PSU deployments. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-04 | Tender p.3 | Qualification | Bidder must demonstrate minimum financial turnover of INR 1 crore in each of the last 3 financial years. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-05 | Tender p.3 | Qualification | Bidder must have an office at Hyderabad with Telangana GST registration and PAN. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-06 | Tender p.3, p.11 | Qualification | Bidder must declare not blacklisted / not debarred / clean track record. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-07 | Tender p.3 | Qualification | Bidder must hold valid ISO 9001 and ISO 27001 certifications. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |
| RFP-BID-08 | Tender p.3 | Qualification | Bidder must have at least 10 qualified technical professionals on rolls. | Appendix D vendor qualification trace | Procurement qualification appendix only | Non-product procurement clause retained for traceability |

## Appendix C. Delivery, Acceptance, Training, Warranty & Vendor Governance

### C.1 Delivery Milestones
| Milestone ID | Milestone | Target Window | Scope |
| --- | --- | --- | --- |
| DLV-01 | Discovery & Design | Week 1 | Finalize requirements, canonical schema, integration mappings, infrastructure readiness checklist, acceptance plan. |
| DLV-02 | Core Build | Weeks 2-4 | Case/evidence, ingestion, audit, auth/RBAC, base UI, canonical data model. |
| DLV-03 | AI + Review + Reporting | Weeks 5-6 | AI triage, OCR, scoring, review workspace, reporting, MIS. |
| DLV-04 | Integration, UAT & Deployment | Week 7 | DOPAMS integration, UAT remediation, training, installation, hypercare kickoff. |

### C.2 Acceptance Deliverables
| Deliverable ID | Deliverable | Contents |
| --- | --- | --- |
| ACC-01 | System design pack | Context architecture, deployment topology, API catalogue, ERD, workflow/state machine definitions. |
| ACC-02 | Environment pack | Infrastructure sizing and prerequisite checklist for dev/test/UAT/prod. |
| ACC-03 | Test pack | System test evidence, UAT scripts, signed acceptance checklist. |
| ACC-04 | Operational handover pack | Runbooks, support matrix, monitoring dashboard list, backup/restore procedure. |
| ACC-05 | Training pack | Role-based training material, attendance record, knowledge-transfer sign-off. |
| ACC-06 | Warranty/hypercare pack | Named support contacts, escalation matrix, 2-week manpower schedule, defect log template. |

### C.3 Commercial Controls
| Control ID | Control | Implementation Note |
| --- | --- | --- |
| COM-CTRL-01 | Payment evidence | Tie 80% payment to delivery + successful installation sign-off; tie remaining 20% to satisfactory performance report after 60 days. |
| COM-CTRL-02 | Delay controls | Track milestone dates and readiness dependencies because RFP penalties apply up to 10% and >30 day delay may trigger cancellation. |
| COM-CTRL-03 | PBG tracking | Track performance bank guarantee as procurement governance item, not as product functionality. |

### C.4 Vendor Qualification Trace
| Trace ID | Qualification / Constraint | Trace Treatment |
| --- | --- | --- |
| VQ-01 | Legal registration, GST, PAN | Procurement qualification appendix only. |
| VQ-02 | OEM authorization and support commitments | Procurement qualification appendix only. |
| VQ-03 | Past experience, turnover, Hyderabad office, certifications, manpower, clean track record | Procurement qualification appendix only. |
| VQ-04 | No consortium / no subcontracting | Procurement governance constraint. |

## Appendix D. Clarification Questions

| Question ID | Area | Question |
| --- | --- | --- |
| CQ-01 | DOPAMS | What are the exact DOPAMS integration patterns available (REST API, DB link, SFTP, webhook), and can sample request/response schemas be provided? |
| CQ-02 | DOPAMS | Which fields are authoritative in DOPAMS vs this platform for case metadata, status, and report references? |
| CQ-03 | Infrastructure | Which deployment model is approved for MVP: on-premise, hybrid, or cloud, and what hardware/storage/network baseline is already available? |
| CQ-04 | Authentication | Will the department provide SAML/OIDC identity federation, or must local authentication be enabled for go-live? |
| CQ-05 | Evidence Retention | What retention periods are mandated for source evidence, normalized artifacts, reports, audit logs, and archived cases? |
| CQ-06 | Legal Mapping | What is the authoritative legal-section master and who approves updates to that taxonomy? |
| CQ-07 | AI Governance | Which AI/ML models, OCR engines, and third-party libraries are approved for use inside department infrastructure? |
| CQ-08 | Forensic Tool Inputs | Can representative export packages from UFED, XRY, Oxygen, FTK, Magnet AXIOM, and Belkasoft be shared for parser certification testing? |
| CQ-09 | Performance | Should the baseline capacity targets (100 named users / 25 concurrent / 10 imports) be treated as contractual minimums or design assumptions? |
| CQ-10 | Alerts | Which external notification channels are approved for MVP: in-app only, email, webhook, or SMS? |
| CQ-11 | Reporting | Are there department-approved court report templates, watermarks, or mandatory annexure formats that must be replicated exactly? |
| CQ-12 | Security | What department-approved encryption standards, secrets-management tools, and log-retention controls must be used? |
| CQ-13 | Support Model | Please confirm whether on-site support beyond the 2-week post-deployment manpower is included in warranty or chargeable on actuals. |
| CQ-14 | Language Support | Is multilingual OCR/NLP for Telugu and Hindi required in MVP or acceptable as phased enhancement with English-first rollout? |
| CQ-15 | Acceptance | Who are the named sign-off authorities for installation, UAT acceptance, performance sign-off, and warranty-performance sign-off? |
