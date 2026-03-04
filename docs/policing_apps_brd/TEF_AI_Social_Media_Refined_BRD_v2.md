# AI-Driven Social Media Monitoring Tool - Refined BRD and Implementation Specification
**Document ID:** BRD-TEF-SMMT-2.0  
**Version:** 2.0  
**Status:** Refined for implementation  
**Date:** 2026-03-02  
**Prepared for:** Telangana Eagle Force / Telangana Technology Services Ltd.  
**Source inputs:** Tender - social media.pdf; BRD - Social Media.pdf
## 0. Document control and requirement conventions
| Field | Value |
|---|---|
| Document ID | BRD-TEF-SMMT-2.0 |
| Version | 2.0 |
| Status | Refined for implementation |
| Primary purpose | Convert the draft BRD into an implementation-ready specification for backend, frontend, API, database, workflow, and AI-assisted development. |
| Source documents | Tender - social media.pdf; BRD - Social Media.pdf |
| ID conventions | FR functional requirement; NFR non-functional requirement; ENT data entity; API interface; WF workflow; UI screen; RPT report; TC test case; CMP compliance control; CQ clarification question |
| Interpretation rule | Where the RFP is silent, this BRD applies explicit baseline assumptions so the specification remains buildable and testable. |

## 1. Executive Summary
### 1.1 Business objective
Provide Telangana Eagle Force with a production-grade AI-driven platform that lawfully ingests and analyzes approved public social-media signals, prioritizes narcotics-related threats, preserves digital evidence, and accelerates investigation-ready outputs with human oversight.
### 1.2 System goals
| Goal ID | Goal | Definition |
|---|---|---|
| GOL-01 | Detect | Detect narcotics-linked content from approved sources within minutes of ingestion and route high-risk signals to the correct queue. |
| GOL-02 | Prioritize | Score and rank signals using transparent risk factors so analysts focus first on urgent, viral, repeat-actor, or high-severity events. |
| GOL-03 | Preserve | Capture evidence with metadata, timestamps, hashes, and chain-of-custody controls suitable for operational and legal use. |
| GOL-04 | Document | Generate structured investigation-ready drafts and reports with legal references, evidence references, and multilingual support. |
| GOL-05 | Govern | Operate securely in government hosting with RBAC, auditability, retention controls, and human review gates for AI-generated outputs. |
| GOL-06 | Scale | Support phased rollout from state-level users to district-level operational units without application redesign. |

### 1.3 Expected ROI
- **ROI-01**: Reduce analyst triage effort by at least 40 percent versus manual open-web monitoring, measured during pilot baseline comparison.
- **ROI-02**: Reduce time to assemble an exportable evidence bundle by at least 50 percent versus manual packaging.
- **ROI-03**: Reduce first-draft investigation-report preparation time by at least 60 percent for supported templates.
- **ROI-04**: Achieve critical-alert acknowledgement within 15 minutes under agreed operating hours.

### 1.4 Strategic alignment
- Supports technology-led narcotics enforcement and state-wide operational standardization.
- Creates auditable and legally defensible digital evidence workflows instead of fragmented manual capture.
- Uses AI as decision support with human control, aligning with responsible-government deployment principles.
- Creates reusable configuration assets - taxonomies, legal mappings, templates, workflows - for district expansion.

## 2. Scope Definition
### 2.1 In Scope
- **INS-01**: Deploy one licensed production-ready application with separate Production and UAT environments.
- **INS-02**: Support approved ingestion or lawful acquisition workflows for X/Twitter, Instagram, Facebook, YouTube, and Reddit.
- **INS-03**: Provide cross-platform monitoring dashboards with role-specific views for Intelligence Wing and Control Room.
- **INS-04**: Normalize text, metadata, media, author handles, and language for downstream search, scoring, and reporting.
- **INS-05**: Detect narcotics-related keywords, slang, coded communication, and multilingual patterns.
- **INS-06**: Provide LLM-assisted categorization of text and images into department-approved narcotics taxonomy categories.
- **INS-07**: Compute risk scores and priority bands using configurable factors and analyst-visible indicators.
- **INS-08**: Map categorized content to department-approved legal provisions and generate investigation-ready drafts subject to human approval.
- **INS-09**: Provide alert, escalation, case, task, evidence, translation, reporting, and audit workflows.
- **INS-10**: Support digital evidence capture, chain of custody, master-copy preservation, export manifests, and reference numbering.
- **INS-11**: Support configurable report templates, versioning, PDF/DOCX export, and MIS dashboards.
- **INS-12**: Support RBAC, organization hierarchy, encryption, logging, observability, backup, and disaster recovery.
- **INS-13**: Deliver training, handover documentation, and post-go-live support obligations required by the RFP.
- **INS-14**: Provide implementation artifacts suitable for AI-assisted development, including IDs, schema definitions, APIs, workflows, and test cases.

### 2.2 Out of Scope
- **OOS-01**: Monitoring or acquisition of private content without lawful authorization and technical entitlement.
- **OOS-02**: Covert interception, account compromise, device intrusion, malware deployment, or any unlawful access mechanism.
- **OOS-03**: Autonomous punitive action, filing, detention recommendation, or legal issuance without human approval.
- **OOS-04**: Replacement of a full police case diary, FIR system, prosecution management system, or records management platform unless integrated in a later phase.
- **OOS-05**: Custom mobile app development for citizens or public reporting in Phase 1.
- **OOS-06**: Monitoring of unsupported platforms unless separately approved through change control.
- **OOS-07**: Historical bulk data migration from external systems unless a source-specific migration scope is separately approved.
- **OOS-08**: Commercial procurement activities such as bid security, bidder qualification, and commercial evaluation; these remain outside the solution design baseline.

### 2.3 Assumptions
- **ASM-01**: The Department will provide lawful basis, SOPs, and approval authority for monitoring, evidence handling, and external sharing.
- **ASM-02**: Day-1 supported UI/report languages are English, Telugu, and Hindi unless the Department approves a different list.
- **ASM-03**: Source-platform access will use officially approved APIs, lawful open-source acquisition methods, or Department-approved data provider workflows.
- **ASM-04**: The Department will nominate owners for taxonomy approval, legal mapping approval, UAT sign-off, and template approval.
- **ASM-05**: Department identity infrastructure will support OIDC, SAML 2.0, or LDAP/AD integration; if unavailable at go-live, a local break-glass authentication option may be used for administrators only.
- **ASM-06**: Critical/higher-risk alerts require 24x7 visibility; other queues may operate under configured business hours.
- **ASM-07**: Historical complaint data, where used for tuning, will be lawfully supplied in structured digital format with data quality reviewed during discovery.
- **ASM-08**: Master evidence copies will be stored in immutable object storage or equivalent write-protected repository if supported by hosting architecture.
- **ASM-09**: All system timestamps will be stored in UTC and rendered in Asia/Kolkata in the UI unless the user explicitly switches time-zone display.
- **ASM-10**: Retention baseline is seven years for audit and evidence records, or longer when legal hold is active, unless Department policy specifies otherwise.
- **ASM-11**: All AI outputs are advisory and are not externally actionable until reviewed by an authorized human role.
- **ASM-12**: Any additional source systems such as case-management, SIEM, or document repositories will be integrated using separate interface specifications.

### 2.4 Constraints
#### Regulatory
- **CNR-01**: Only lawfully obtainable content may be ingested, stored, shared, or preserved.
- **CNR-02**: Human approval is mandatory before external use of AI-generated legal text or action narratives.
- **CNR-03**: Chain-of-custody, auditability, and evidence integrity must be preserved for all exported material.
- **CNR-04**: The solution must support Bharatiya Nyaya Sanhita mapping at minimum and allow additional Department-approved legal frameworks by configuration.
- **CNR-05**: Data sharing outside the Department must occur only through approved channels and role-based approval.
#### Infrastructure
- **CNI-01**: The production solution must run in Telangana State Data Centre or a Government-approved cloud tenancy.
- **CNI-02**: Production and UAT must be isolated by environment, URL, credentials, storage, and secrets.
- **CNI-03**: The implementation must declare all required hosting dependencies including compute, storage, network, OS, database, queue, object store, and external service dependencies.
- **CNI-04**: The application must support district-level expansion without schema redesign.
- **CNI-05**: No unsupported third-party dependency may be introduced without Department approval.
#### Security
- **CNS-01**: TLS 1.2 or above is mandatory for all UI and API traffic.
- **CNS-02**: AES-256 or equivalent encryption at rest is mandatory for databases, object storage, and backups.
- **CNS-03**: Privileged actions require named accounts; shared administrator accounts are prohibited.
- **CNS-04**: All secrets and service credentials must be stored in a secure secrets manager and rotated at least every 90 days.
- **CNS-05**: All administrative changes, exports, approvals, and failed login attempts must be logged in tamper-evident form.
- **CNS-06**: Local file-system storage for master evidence is prohibited unless explicitly approved as immutable storage.
#### Performance
- **CNP-01**: Critical-alert flow must support near-real-time ingestion-to-queue processing for approved sources.
- **CNP-02**: The system must support concurrent district users without a separate deployment per district.
- **CNP-03**: Search, dashboards, and report exports must remain within measurable SLAs defined in Section 8.
- **CNP-04**: Queue backlog, connector failure, and model degradation must be observable in operations dashboards.

## 3. Stakeholders & Roles
### 3.1 Stakeholders
| Stakeholder ID | Stakeholder Group | Primary Responsibility |
|---|---|---|
| STK-01 | Business Sponsor | Police leadership / Home Department sponsorship, funding approvals, policy direction |
| STK-02 | Intelligence Wing | Signal review, pattern analysis, watchlists, escalation |
| STK-03 | Control Room | High-priority queue handling, rapid response coordination, escalation tracking |
| STK-04 | District Investigation Units | Case follow-up, evidence use, field action |
| STK-05 | Legal Reviewer Group | Legal mapping validation, report wording approval, template governance |
| STK-06 | Cyber / Forensics | Evidence verification, extraction integrity, chain-of-custody oversight |
| STK-07 | Department IT / Security | Hosting, SSO, hardening, observability, DR, access review |
| STK-08 | Implementation Vendor | Delivery, configuration, integration, training, support, warranty |
| STK-09 | Audit / Vigilance | Access audit, evidence review, exception monitoring, compliance verification |

### 3.2 Roles
| Role ID | Role Name | Description | System Permissions Level |
|---|---|---|---|
| ROL-01 | Integration Service Account | Non-human account used by source connectors, notification adapters, and workflow callbacks. | PL0 - system integration |
| ROL-02 | Leadership Read Only | Read-only consumption of dashboards, KPIs, and approved reports. | PL1 - read only |
| ROL-03 | Intelligence Analyst | Triages alerts, reviews content, captures evidence, and opens cases. | PL2 - operational |
| ROL-04 | Control Room Operator | Monitors critical queue, escalates urgent items, and issues rapid sharing actions. | PL2 - operational |
| ROL-05 | Investigator | Works assigned cases, views linked evidence, adds case notes, and exports authorized packages. | PL2 - operational |
| ROL-06 | Supervisor / Approver | Approves escalations, case closure, external sharing, and SLA overrides. | PL3 - approver |
| ROL-07 | Legal Reviewer | Approves legal mappings, report wording, and template releases. | PL3 - approver |
| ROL-08 | Evidence Custodian | Verifies evidence integrity, release history, legal hold, and export approvals. | PL3 - custodian |
| ROL-09 | Security Auditor | Views audit logs, access anomalies, privileged events, and retention/purge records. | PL3 - auditor |
| ROL-10 | Platform Administrator | Manages users, roles, organization hierarchy, taxonomy, integrations, and environment configuration. | PL4 - administrator |

## 4. Functional Requirements

### FR-01 - Platform deployment and environment management
**Description:** Deploy a licensed, production-ready application in TSDC or Government-approved cloud with separate Production and UAT environments, secure URLs, backup/restore, and controlled configuration promotion.  
**RFP Traceability Reference:** RFP-TEC-01, RFP-TEC-02, RFP-TEC-03, RFP-TEC-04, RFP-TEC-05, RFP-DEL-01, RFP-DEL-02

**User Stories**
- As a Platform Administrator, I want separate UAT and Production environments so that changes can be validated before go-live.
- As Department IT, I want documented infrastructure prerequisites and backup/restore procedures so that the platform can be operated within Government hosting standards.

**Acceptance Criteria (Testable)**
- AC-FR-01-01: UAT and Production are deployed at separate URLs, use separate credentials and storage paths, and cannot share runtime secrets.
- AC-FR-01-02: HTTPS is enforced for all user and API endpoints; certificates are monitored and renewed before expiry.
- AC-FR-01-03: Configuration promotion from UAT to Production requires approver authorization and records an audit entry with before/after version numbers.
- AC-FR-01-04: Full backup runs at least daily; restore of database and object-store metadata is demonstrated in UAT before production acceptance.
- AC-FR-01-05: A hosting bill of materials and deployment runbook are delivered as implementation artifacts.

**Business Rules**
- BR-FR-01-01: Production data shall not be copied to UAT unless masked and approved.
- BR-FR-01-02: Environment-specific configuration values shall be externalized and not hard-coded in application logic.

**Edge Cases**
- Certificate renewal failure
- Site-not-ready condition for target hosting environment
- Rollback after failed deployment

**Failure Handling**
- On deployment failure, the system shall revert to the last known stable release and notify Platform Administrator and Vendor support.
- On backup failure, the system shall generate a severity-1 operational alert and prevent the next release promotion until backup integrity is restored.

### FR-02 - Identity, RBAC, and organization hierarchy
**Description:** Provide role-based access control, unit/district hierarchy, maker-checker approvals, privileged action boundaries, session controls, and identity integration.  
**RFP Traceability Reference:** RFP-TEC-06, RFP-RPT-07

**User Stories**
- As a Supervisor, I want users to see only their authorized district, unit, and approval actions so that sensitive investigations remain segregated.
- As a Security Auditor, I want all authorization decisions and failed access attempts logged so that access misuse can be investigated.

**Acceptance Criteria (Testable)**
- AC-FR-02-01: Each user is assigned one or more roles and one primary organization unit; effective permissions are computed from role plus unit scope.
- AC-FR-02-02: Leadership Read Only users cannot create, edit, export, or approve operational objects.
- AC-FR-02-03: Approver roles are required for case closure, legal report approval, retention override, and external sharing above configured thresholds.
- AC-FR-02-04: Idle sessions expire after 15 minutes for privileged roles and after 30 minutes for non-privileged roles.
- AC-FR-02-05: Integration with SSO/AD/LDAP is supported through OIDC, SAML 2.0, or LDAP/AD connector configuration.

**Business Rules**
- BR-FR-02-01: Cross-district access is denied by default unless granted through an explicit supervisory role.
- BR-FR-02-02: Disabled users cannot authenticate and all owned open tasks must be reassigned by a supervisor.

**Edge Cases**
- User transfer between districts
- Concurrent roles with conflicting privileges
- Break-glass administrator access during SSO outage

**Failure Handling**
- If identity provider is unavailable, only pre-approved break-glass administrator accounts may authenticate locally; all other users receive a controlled denial message.
- If authorization evaluation fails, the request shall be denied, logged, and returned with an authorization error code.

### FR-03 - Source onboarding and lawful ingestion
**Description:** Support approved source connectors or acquisition workflows for X/Twitter, Instagram, Facebook, YouTube, and Reddit, including schedule configuration, raw payload retention, normalization, and retry handling.  
**RFP Traceability Reference:** RFP-OBJ-01, RFP-MON-01, RFP-MON-05

**User Stories**
- As a Platform Administrator, I want each source connector configured with entitlement, polling schedule, and rate limits so that ingestion remains lawful and supportable.
- As an Intelligence Analyst, I want normalized content records from multiple sources so that downstream search and scoring are consistent.

**Acceptance Criteria (Testable)**
- AC-FR-03-01: Each supported platform has a connector record with acquisition mode, entitlement reference, polling interval, retry policy, and status.
- AC-FR-03-02: Raw source payload and normalized content record are both retained with linkable identifiers.
- AC-FR-03-03: Connector retries use exponential backoff and move failed payloads to a dead-letter queue after configured retry exhaustion.
- AC-FR-03-04: Duplicate source-object ingestion is prevented using source ID plus normalized content hash.
- AC-FR-03-05: Source-specific rate-limit and legal-basis metadata are viewable by administrators.

**Business Rules**
- BR-FR-03-01: Only approved public or otherwise lawfully authorized content sources may be onboarded.
- BR-FR-03-02: Connector credentials shall be stored only in the secrets manager and never in source code or plain-text configuration.

**Edge Cases**
- Deleted source content after ingestion
- Source API quota exhaustion
- Clock skew between source timestamp and ingestion timestamp

**Failure Handling**
- If a connector is unavailable, the system shall keep the previous connector status, raise an operational incident, and continue processing available sources.
- If normalization fails, the raw payload shall be preserved with processing_status = FAILED_NORMALIZATION and routed for reprocessing.

### FR-04 - Unified monitoring dashboard and search workspace
**Description:** Provide a unified dashboard with cross-platform filters, role-specific queue views, saved searches, aggregated actor timelines, and logical navigation optimized for Intelligence Wing and Control Room usage.  
**RFP Traceability Reference:** RFP-MON-02, RFP-MON-03, RFP-MON-06, RFP-MON-07

**User Stories**
- As an Intelligence Analyst, I want a single monitoring workspace across platforms so that I do not switch tools during triage.
- As a Control Room Operator, I want a dedicated high-priority dashboard so that urgent action items are visible immediately.

**Acceptance Criteria (Testable)**
- AC-FR-04-01: The default dashboard supports filters for platform, district, language, category, risk band, alert status, and time range.
- AC-FR-04-02: Control Room view shows only Critical and High queue items by default and surfaces SLA countdown and escalation actions.
- AC-FR-04-03: Aggregated actor timelines group platform handles using configurable confidence thresholds and display underlying source records.
- AC-FR-04-04: Saved searches can be named, shared within a unit, and re-run without manual query reconstruction.
- AC-FR-04-05: Navigation uses fixed tabs for Dashboard, Alerts, Cases, Evidence, Reports, Admin, and Audit, with role-based visibility.

**Business Rules**
- BR-FR-04-01: If cross-platform actor matching confidence is below configured threshold, the UI shall show separate actor cards and a merge suggestion rather than auto-merge.
- BR-FR-04-02: Dashboard widgets shall be configuration-driven and not require code changes for reordering or enablement.

**Edge Cases**
- Same person uses multiple unrelated handles
- Partial source outage causing incomplete dashboard totals
- Large saved searches with stale filters

**Failure Handling**
- If one or more sources are unavailable, the dashboard shall display a partial-data banner with affected platforms and last successful sync timestamp.
- If a saved search fails validation after taxonomy changes, the user shall receive a remediation prompt and the search shall not execute until corrected.

### FR-05 - Keyword, slang, entity, OCR, and transcript analysis
**Description:** Detect narcotics-related keywords, slang, aliases, coded communication, and extract entities from text, OCR, and media transcripts where enabled.  
**RFP Traceability Reference:** RFP-MON-04, RFP-MON-05

**User Stories**
- As an Intelligence Analyst, I want the system to detect slang and coded terms so that non-obvious drug promotion signals are not missed.
- As a Legal Reviewer, I want entity extraction and highlighted term matches so that supporting rationale is easy to inspect.

**Acceptance Criteria (Testable)**
- AC-FR-05-01: Department-managed slang dictionary supports term, language, transliteration, severity hint, and effective date fields.
- AC-FR-05-02: Entity extraction identifies at minimum handles, hashtags, phone numbers, payment references, location mentions, and substance references where present.
- AC-FR-05-03: If OCR and transcript features are enabled, extracted text is searchable and linked to source media with page/time offsets.
- AC-FR-05-04: Match results display the matched term, dictionary version, context snippet, and confidence where AI-derived.
- AC-FR-05-05: Analysts can add new candidate slang terms for approval without directly publishing them to Production.

**Business Rules**
- BR-FR-05-01: Department glossary overrides generic translation output for approved slang terms.
- BR-FR-05-02: OCR/transcript extraction is advisory and must retain the original media as the evidentiary master.

**Edge Cases**
- Mixed-language or transliterated text
- Image-only posts with no caption
- False positives from non-narcotics slang usage

**Failure Handling**
- If OCR/transcript providers are unavailable, the content shall continue through text-only processing and be flagged MEDIA_TEXT_NOT_AVAILABLE.
- If entity extraction fails, keyword and AI categorization shall still execute and the content item shall remain triageable.

### FR-06 - AI categorization and model operations
**Description:** Automatically classify content into predefined narcotics-related categories using LLM-assisted and rules-assisted analysis of text and images, while storing model version, prompt version, and analyst feedback.  
**RFP Traceability Reference:** RFP-OBJ-02, RFP-AI-01, RFP-AI-02, RFP-AI-03, RFP-AI-04, RFP-RSK-04, RFP-RSK-05

**User Stories**
- As an Intelligence Analyst, I want each item categorized with rationale and confidence so that I can quickly validate or correct it.
- As a Platform Administrator, I want model/rule versions recorded so that output changes can be traced and rolled back.

**Acceptance Criteria (Testable)**
- AC-FR-06-01: Classifier output conforms to a fixed JSON schema containing one or more category codes, confidence score, rationale snippet, and processing version identifiers.
- AC-FR-06-02: The taxonomy supports parent-child categories, local slang attachments, and effective-dated versions.
- AC-FR-06-03: Analyst decisions Accepted, Corrected, Rejected are captured and linked to the model/prompt/rule version that produced the original classification.
- AC-FR-06-04: Rule-layer updates for category thresholds or legal hints can be deployed without changing LLM weights or prompts.
- AC-FR-06-05: When classifier confidence is below configurable threshold, the alert is marked NEEDS_REVIEW and is not auto-escalated.

**Business Rules**
- BR-FR-06-01: AI classification results are advisory and cannot directly trigger external sharing or case closure.
- BR-FR-06-02: Production prompts and taxonomy versions require approval before activation.

**Edge Cases**
- Content fits multiple categories
- Content lacks text and contains only visual cues
- Model drift causes rising false positives

**Failure Handling**
- If AI services are unavailable, the system shall fall back to rules-based triage and mark processing_mode = RULES_ONLY.
- If classifier output violates schema, the item shall be rejected from automated decisioning, logged, and routed to manual review.

### FR-07 - Risk scoring and prioritization
**Description:** Compute explainable risk scores and priority bands using severity, frequency, virality, historical behavior, and policy-driven weightings with analyst-visible score factors.  
**RFP Traceability Reference:** RFP-OBJ-03, RFP-RSK-01, RFP-RSK-02, RFP-RSK-03, RFP-RSK-04

**User Stories**
- As a Control Room Operator, I want the highest-risk signals surfaced first so that urgent enforcement action is not delayed.
- As a Supervisor, I want transparent score components so that I can validate why an item was escalated.

**Acceptance Criteria (Testable)**
- AC-FR-07-01: Risk score is stored on a 0-100 scale and maps to priority bands Critical (85-100), High (70-84), Medium (50-69), Low (0-49) unless configured otherwise.
- AC-FR-07-02: Scorecard shows factor contributions for content severity, actor frequency, virality, historical behavior, and policy weights.
- AC-FR-07-03: Thresholds can route alerts to analyst review, supervisor review, or Control Room queue through configuration.
- AC-FR-07-04: Repeat-actor indicators use historical alerts/cases where confidence-linked actor records exist.
- AC-FR-07-05: Scoring recalculation is triggered when category, virality metrics, or linked history changes.

**Business Rules**
- BR-FR-07-01: Missing virality or history data shall default to zero contribution, not null failure.
- BR-FR-07-02: Analysts may override priority with a mandatory reason, but the original computed score must remain audit-visible.

**Edge Cases**
- Brand-new actor with no history
- Conflicting severity signals across platforms
- Rapid virality spike after initial low score

**Failure Handling**
- If risk engine is unavailable, alerts shall be routed with priority = REVIEW_REQUIRED and visible warning RISK_PENDING.
- If recalculation fails after an analyst override, the manual override remains in effect until system recomputation succeeds.

### FR-08 - Legal and policy mapping
**Description:** Map categorized content to Bharatiya Nyaya Sanhita and other Department-approved legal provisions using versioned rule sets and generate investigation-ready legal draft content subject to review.  
**RFP Traceability Reference:** RFP-OBJ-04, RFP-LEG-01, RFP-LEG-02, RFP-LEG-03, RFP-LEG-04

**User Stories**
- As a Legal Reviewer, I want candidate legal provisions and rationale linked to each alert so that drafting can start from verified grounds.
- As an Investigator, I want structured legal draft sections with evidence references so that report assembly is faster.

**Acceptance Criteria (Testable)**
- AC-FR-08-01: Legal mapping results store law name, provision code, rule version, rationale, confidence, reviewer status, and linked evidence references.
- AC-FR-08-02: Alert cards show top legal mapping suggestions with rationale and reviewer status.
- AC-FR-08-03: Investigation-ready report drafts contain chronology, categorized findings, translated excerpts, legal references, evidence references, and disclaimer text.
- AC-FR-08-04: Rule changes are versioned, testable in UAT, effective-dated, and rollback-capable without LLM core changes.
- AC-FR-08-05: No legal draft may be exported externally until approved by a Legal Reviewer or authorized approver.

**Business Rules**
- BR-FR-08-01: Legal mapping suggestions are advisory until a human reviewer sets reviewer_status = APPROVED.
- BR-FR-08-02: If no legal mapping rule applies, the alert shall remain triageable with legal_status = NO_MATCH_FOUND.

**Edge Cases**
- Multiple provisions apply to one content item
- Conflicting rules across law versions
- Evidence reference removed from draft input

**Failure Handling**
- If legal generation fails, the system shall preserve structured inputs and allow manual drafting using the selected template.
- If rule evaluation fails, the alert shall show legal_status = PENDING_REVIEW and record the error event.

### FR-09 - Translation and language intelligence
**Description:** Automatically detect source language, provide on-demand translation, preserve the original content, and support side-by-side review with glossary overrides.  
**RFP Traceability Reference:** RFP-LNG-01, RFP-LNG-02, RFP-LNG-03, RFP-LNG-04, RFP-MON-05

**User Stories**
- As an Intelligence Analyst, I want to translate an alert with one click so that I can review non-English content without leaving the tool.
- As a Legal Reviewer, I want original and translated text displayed together so that legal context is not lost.

**Acceptance Criteria (Testable)**
- AC-FR-09-01: The platform stores ISO language code, detection method, and detection confidence for each content item where available.
- AC-FR-09-02: Users can request translation from alert, content, evidence, or report-generation screens.
- AC-FR-09-03: Original text is immutable and translation is stored as a separate versioned record.
- AC-FR-09-04: The UI can display side-by-side original and translated text with source timestamp and reference number.
- AC-FR-09-05: Department glossary terms override generic translation output when exact or approved fuzzy match exists.

**Business Rules**
- BR-FR-09-01: Translation requests are user-initiated unless a report template explicitly requires pre-generated translation.
- BR-FR-09-02: Unsupported languages shall not block alert creation.

**Edge Cases**
- Mixed-language posts
- Slang with no glossary equivalent
- Unsupported language or script

**Failure Handling**
- If translation provider fails, the user shall see the original text, an error code, and an option to retry later.
- If language detection confidence is below threshold, the system shall mark detected_language = UNKNOWN and allow manual override.

### FR-10 - Alerts, escalation, collaboration, and SLA management
**Description:** Generate alerts with source attribution, category, risk score, filters, sharing actions, comments, approvals, and SLA timers for analyst, supervisor, and Control Room processing.  
**RFP Traceability Reference:** RFP-OBJ-06, RFP-ALT-01, RFP-ALT-02, RFP-ALT-03, RFP-ALT-04, RFP-ALT-05

**User Stories**
- As a Control Room Operator, I want critical alerts to appear immediately with escalation actions and time remaining so that urgent events are handled fast.
- As a Supervisor, I want closure, external sharing, and false-positive decisions to follow maker-checker controls.

**Acceptance Criteria (Testable)**
- AC-FR-10-01: Every alert stores source attribution, platform, content reference, category, risk score, priority, owner, status, and due timestamp.
- AC-FR-10-02: Default SLA targets are configurable by priority band; baseline values are Critical ack 15 min/disposition 2 hr, High ack 30 min/disposition 4 hr, Medium ack 2 hr/disposition 1 business day, Low ack 1 business day/disposition 3 business days.
- AC-FR-10-03: External sharing via WhatsApp or approved secure channel is watermarked, access-controlled, and audit logged.
- AC-FR-10-04: Users can comment, tag authorized colleagues, add action notes, suppress duplicates, and mark false positives with mandatory reason.
- AC-FR-10-05: System-generated notifications are sent on alert creation, SLA breach, escalation, and closure according to role and priority.

**Business Rules**
- BR-FR-10-01: Critical alerts are auto-routed to the Control Room queue if computed priority is Critical and status is not manually suppressed.
- BR-FR-10-02: Closing an alert requires a disposition code and cannot occur while mandatory approvals or linked open tasks are pending.

**Edge Cases**
- Repeated signals for the same actor/event
- Notification channel outage
- Alert reopened after closure

**Failure Handling**
- If sharing gateway fails, the alert remains unchanged, the failure is logged, and the user is offered fallback email/SMS channels if configured.
- If SLA timer service fails, the alert screen shall display SLA state as UNKNOWN and raise an operational incident.

### FR-11 - Evidence preservation and chain of custody
**Description:** Capture and preserve posts, reposts, images, videos, metadata, timestamps, reference numbers, hashes, and release/export history with controlled master-copy protection.  
**RFP Traceability Reference:** RFP-OBJ-05, RFP-EVD-01, RFP-EVD-02, RFP-EVD-03, RFP-EVD-04, RFP-EVD-05, RFP-EVD-06

**User Stories**
- As an Evidence Custodian, I want every preserved item hashed, time-stamped, and traceable so that evidentiary integrity can be demonstrated.
- As an Investigator, I want an exportable evidence pack with manifest and reference numbers so that reports and downstream legal processes are consistent.

**Acceptance Criteria (Testable)**
- AC-FR-11-01: Evidence capture stores source identifiers, capture time, operator, source URL, posted time, metadata snapshot, and SHA-256 hash of preserved media/files where applicable.
- AC-FR-11-02: The system generates a unique evidence reference number and displays it on UI cards, exports, and linked reports.
- AC-FR-11-03: Master evidence objects are immutable after verification; working/redacted copies are stored separately from the master.
- AC-FR-11-04: Every view, export, approval, legal hold, and release event writes a chain-of-custody log entry.
- AC-FR-11-05: Evidence packaging export includes manifest, hash list, index, and optional translated excerpts linked back to evidence references.

**Business Rules**
- BR-FR-11-01: Destructive changes to evidence are prohibited; retention expiry uses defensible purge workflow only.
- BR-FR-11-02: Evidence capture requires confirmation for manual deletion of non-master working copies and for export of high-risk items.

**Edge Cases**
- Source media deleted after capture
- Re-capture request for same source object
- Corrupted media file or incomplete download

**Failure Handling**
- If media capture partially succeeds, the evidence item shall be stored with status = PARTIAL_CAPTURE and missing component list for retry.
- If hash verification fails, the item shall be marked INTEGRITY_EXCEPTION and hidden from export until reviewed by an Evidence Custodian.

### FR-12 - Case, task, and workflow management
**Description:** Create cases from alerts, assign tasks, track timeline events, manage approvals, and maintain configurable case lifecycle and closure rules.  
**RFP Traceability Reference:** RFP-LEG-04, RFP-EVD-05, RFP-RPT-03

**User Stories**
- As an Investigator, I want related alerts and evidence grouped into a case so that operational follow-up is coordinated.
- As a Supervisor, I want assignments, timelines, and closure approvals tracked so that workload and accountability are visible.

**Acceptance Criteria (Testable)**
- AC-FR-12-01: Users can create a case from one or more alerts and link multiple evidence items, notes, and reports to the same case.
- AC-FR-12-02: Cases support assignment to unit and individual, due dates, priority, and configurable status values.
- AC-FR-12-03: Timeline records include alert creation, escalation, evidence capture, report generation, assignment changes, and closure actions.
- AC-FR-12-04: Case closure requires closure reason, outcome code, and supervisory approval when configured.
- AC-FR-12-05: Reopened cases preserve original closure metadata and append a new timeline event.

**Business Rules**
- BR-FR-12-01: An alert may link to one primary case and multiple related-reference cases.
- BR-FR-12-02: Closed cases are read-only except for reopen action by authorized approvers.

**Edge Cases**
- Merging duplicate cases
- Assigned user becomes inactive
- Evidence on legal hold prevents case archive

**Failure Handling**
- If assignment target is unavailable, the case shall route to the owning unit queue and notify the supervisor.
- If workflow engine is unavailable, new cases shall be saved in DRAFT_PENDING_WORKFLOW and surfaced to administrators.

### FR-13 - Reporting, template management, and MIS analytics
**Description:** Support dynamic report template creation, template versioning, structured report generation, PDF/DOCX export, and management reporting.  
**RFP Traceability Reference:** RFP-RPT-01, RFP-RPT-02, RFP-RPT-03, RFP-RPT-04, RFP-RPT-05, RFP-RPT-06

**User Stories**
- As a Legal Reviewer, I want approved templates with placeholders and standard clauses so that reports remain consistent.
- As Leadership, I want MIS dashboards and exports by district, platform, category, and queue status so that performance is measurable.

**Acceptance Criteria (Testable)**
- AC-FR-13-01: Authorized users can create or upload templates, define placeholders, and submit them for approval and version release.
- AC-FR-13-02: Generated reports can include chronology, evidence annexures, translated excerpts, legal references, and reference-number cross-links.
- AC-FR-13-03: Exports are supported in PDF and DOCX with preserved formatting and metadata summary page.
- AC-FR-13-04: MIS catalog includes at least Daily Alert Summary, SLA Breach Report, Platform Trend Report, Category Heat Map, Case Progress Report, and Evidence Export Register.
- AC-FR-13-05: Reports and dashboards are filterable by date range, platform, district, category, priority, status, and owner unit.

**Business Rules**
- BR-FR-13-01: Only APPROVED template versions may be used in Production report generation.
- BR-FR-13-02: Report exports use the evidence/reference numbering current at generation time and preserve version traceability.

**Edge Cases**
- Template placeholder missing source data
- Large annexure exceeding default export size
- Template version superseded after draft generation

**Failure Handling**
- If export generation fails, the report remains in GENERATION_FAILED with retriable error details and no partial document released to users.
- If a template is withdrawn after draft creation, existing drafts remain viewable but cannot be newly approved without revalidation.

### FR-14 - Administration, taxonomy, legal rules, and configuration governance
**Description:** Provide administrative management of taxonomies, dictionaries, legal rules, risk weights, workflow settings, organization hierarchy, and environment promotion with audit trail.  
**RFP Traceability Reference:** RFP-RPT-08, RFP-RSK-05, RFP-LEG-02, RFP-MON-04

**User Stories**
- As a Platform Administrator, I want configuration changes versioned and promoted through UAT so that production remains stable.
- As a Legal Reviewer, I want legal rules effective-dated and rollback-capable so that changes remain controlled.

**Acceptance Criteria (Testable)**
- AC-FR-14-01: Configuration objects include taxonomy categories, slang dictionary terms, legal rules, risk weights, organization units, workflow settings, and report templates.
- AC-FR-14-02: Each configuration object stores version number, approval status, effective dates, change reason, and approver identity.
- AC-FR-14-03: UAT validation and Production promotion create distinct audit events and release artifacts.
- AC-FR-14-04: Conflicting configuration definitions are blocked by validation rules before publication.
- AC-FR-14-05: Rollback can restore the previous approved configuration version without changing application code.

**Business Rules**
- BR-FR-14-01: Production configuration edits must not bypass UAT unless an emergency change override is approved and logged.
- BR-FR-14-02: Effective-dated rules cannot overlap for the same scope without explicit priority.

**Edge Cases**
- Two active categories with same code
- Rule effective date overlap
- Rollback after already processed alerts

**Failure Handling**
- If configuration validation fails, the system shall reject publication and show precise field-level errors.
- If a promoted configuration causes runtime exceptions, administrators shall be able to revert to the prior version within one action.

### FR-15 - Notifications, sharing, and external integrations
**Description:** Integrate with approved notification, sharing, identity, storage, OCR, translation, AI, and security monitoring services using secure APIs and controlled retries.  
**RFP Traceability Reference:** RFP-ALT-04, RFP-ALT-05, RFP-TEC-05, RFP-TEC-06, RFP-NTE-02

**User Stories**
- As Department IT, I want integration adapters with clear authentication and retry behavior so that external dependencies are supportable.
- As a Control Room Operator, I want secure rapid sharing channels so that critical alerts can be escalated without copying data manually.

**Acceptance Criteria (Testable)**
- AC-FR-15-01: Every external integration has a documented adapter with endpoint, auth type, payload schema, retry policy, and failure fallback.
- AC-FR-15-02: Outbound share messages include watermark, source reference, category, priority, and link/access control where supported.
- AC-FR-15-03: Integration calls use idempotency keys for retriable write operations.
- AC-FR-15-04: Failed integration events are retried according to policy and then moved to a dead-letter queue with operator-visible status.
- AC-FR-15-05: Security integrations can forward audit and operational events to SIEM/SOC tooling.

**Business Rules**
- BR-FR-15-01: Consumer messaging accounts or unsanctioned channels are prohibited for official sharing.
- BR-FR-15-02: System-to-system integrations must authenticate using client credentials, signed webhook secret, or mutually authenticated transport approved by Department IT.

**Edge Cases**
- Temporary provider outage
- Webhook replay attack attempt
- Message payload size above gateway limit

**Failure Handling**
- If an integration write times out, the operation may be safely retried using the same idempotency key without duplicate external actions.
- If security-forwarding integration fails, local audit logging remains authoritative and queued for later forwarding.

### FR-16 - Audit logging, observability, and data retention
**Description:** Maintain tamper-evident logs for all material events, expose operational health and queue metrics, and enforce retention, legal hold, purge, and restore controls.  
**RFP Traceability Reference:** RFP-ALT-05, RFP-EVD-05, RFP-RPT-07, RFP-NTE-03

**User Stories**
- As a Security Auditor, I want immutable logs of all privileged and evidentiary events so that compliance review is possible.
- As Department IT, I want health dashboards for connectors, queues, and storage so that incidents are visible before users are blocked.

**Acceptance Criteria (Testable)**
- AC-FR-16-01: Audit log captures actor, role, action, object type, object ID, timestamp, source IP, outcome, and before/after values for create/update/delete/approval actions.
- AC-FR-16-02: Audit records are append-only and chained or otherwise tamper-evident.
- AC-FR-16-03: Operational dashboards show connector status, queue depth, job latency, export backlog, storage utilization, and error-rate trends.
- AC-FR-16-04: Retention policies can be configured by object type and legal-hold state; purge actions require approval and are logged.
- AC-FR-16-05: Backup restore verification is performed at least quarterly and evidence is retained.

**Business Rules**
- BR-FR-16-01: Audit logs and evidence-retention metadata shall not be editable from the normal user interface.
- BR-FR-16-02: Objects under legal hold are excluded from purge schedules.

**Edge Cases**
- Clock skew across nodes
- Large audit volume burst
- Retention policy update after legal hold applied

**Failure Handling**
- If audit-log write fails, the triggering transaction shall fail closed for privileged/evidence actions and raise a severity-1 operational alert.
- If observability pipeline is degraded, the primary application remains available but the dashboard shall show monitoring data stale status.

### FR-17 - Security, privacy, and responsible AI controls
**Description:** Implement encryption, secrets management, least privilege, watermarking, model/prompt traceability, and human-in-the-loop controls for AI-supported outputs.  
**RFP Traceability Reference:** RFP-TEC-05, RFP-TEC-06, RFP-LEG-04, RFP-NTE-03

**User Stories**
- As Department IT Security, I want data encrypted in transit and at rest so that intelligence data is protected.
- As a Legal Reviewer, I want all AI-generated output marked as draft until approved so that unsupported text is not released.

**Acceptance Criteria (Testable)**
- AC-FR-17-01: Databases, backups, and object storage are encrypted at rest; all endpoints use TLS 1.2 or higher.
- AC-FR-17-02: Privileged roles require MFA where identity platform supports it; all secrets are centrally managed and rotation dates are tracked.
- AC-FR-17-03: AI-generated text, summaries, or recommendations are labeled DRAFT and require authorized approval before export or sharing.
- AC-FR-17-04: Model, prompt, rule, and taxonomy versions are stored on all material AI-derived outputs.
- AC-FR-17-05: Exported sensitive content may be watermarked and redacted according to role and template policy.

**Business Rules**
- BR-FR-17-01: AI shall not directly execute autonomous punitive or legal actions.
- BR-FR-17-02: Prompts and retrieval context shall be role- and tenant-scoped to prevent cross-case data leakage.

**Edge Cases**
- Prompt injection or adversarial content
- Expired encryption key
- Unauthorized export attempt

**Failure Handling**
- If watermarking service fails for a policy-enforced export, the export shall be blocked and recorded as denied.
- If prompt execution detects unsafe content or policy violation, the request shall be stopped and surfaced for manual handling.

### FR-18 - Implementation delivery, training, support, warranty, and ownership
**Description:** Track non-functional implementation obligations from the RFP, including delivery timeline, installation, training, hypercare staffing, warranty, maintenance/upgrades, ATS transition, and Department ownership.  
**RFP Traceability Reference:** RFP-NTE-01, RFP-NTE-02, RFP-NTE-03, RFP-NTE-04, RFP-NTE-05, RFP-NTE-06, RFP-DEL-01, RFP-DEL-02, RFP-PAY-01, RFP-PEN-01, RFP-WAR-01

**User Stories**
- As the Business Sponsor, I want milestone-based delivery obligations visible so that acceptance and payment decisions are objective.
- As Department IT, I want infrastructure specification, training artifacts, and support roster handed over so that operations can continue after go-live.

**Acceptance Criteria (Testable)**
- AC-FR-18-01: Delivery plan defines D+42 build delivery, D+49 installation completion, UAT sign-off, hypercare start, and warranty start dates from Purchase Order issue date.
- AC-FR-18-02: The vendor delivers a hosting infrastructure specification listing required compute, storage, network, OS, middleware, DB, object-store, queue, and external service dependencies.
- AC-FR-18-03: Role-based training is completed before go-live and evidenced by attendance, material handover, and quick-reference guides.
- AC-FR-18-04: Hypercare support provides 1-2 technical resources for 2 weeks post deployment, with named roster, duty hours, and escalation contacts.
- AC-FR-18-05: Warranty covers break/fix, maintenance, and upgradations for one year from acceptance; Department ownership of data, configuration, templates, and custom-developed solution assets is documented.

**Business Rules**
- BR-FR-18-01: Site-not-ready delays caused by Department infrastructure must be documented through a signed site-not-ready certificate.
- BR-FR-18-02: Milestone acceptance artifacts shall be the basis for payment release and delay tracking.

**Edge Cases**
- Delayed infrastructure readiness
- Partial training attendance
- Warranty incident during post-go-live support transition

**Failure Handling**
- If training completion criteria are not met, go-live approval shall remain pending unless the Department grants a documented waiver.
- If a warranty defect breaches severity targets, the incident shall be escalated through the vendor governance matrix and linked to service-credit/delay tracking outside the application.

## 5. Data Model Requirements
### 5.1 Master Enumerations
| Enum ID | Name | Allowed Values |
|---|---|---|
| ENUM-01 | platform_code | X, INSTAGRAM, FACEBOOK, YOUTUBE, REDDIT |
| ENUM-02 | priority_band | CRITICAL, HIGH, MEDIUM, LOW, REVIEW_REQUIRED |
| ENUM-03 | alert_status | NEW, IN_REVIEW, ESCALATED_SUPERVISOR, ESCALATED_CONTROL_ROOM, CONVERTED_TO_CASE, FALSE_POSITIVE, CLOSED_NO_ACTION, CLOSED_ACTIONED, REOPENED |
| ENUM-04 | case_status | OPEN, ASSIGNED, UNDER_INVESTIGATION, AWAITING_REVIEW, CLOSED, REOPENED |
| ENUM-05 | evidence_status | CAPTURE_REQUESTED, CAPTURED, VERIFIED, PARTIAL_CAPTURE, INTEGRITY_EXCEPTION, PACKAGED, EXPORTED, LEGAL_HOLD, PURGED |
| ENUM-06 | report_status | DRAFT, IN_REVIEW, APPROVED, EXPORTED, SUPERSEDED, GENERATION_FAILED |
| ENUM-07 | translation_status | REQUESTED, COMPLETED, FAILED, UNSUPPORTED |
| ENUM-08 | config_status | DRAFT, APPROVED_UAT, APPROVED_PROD, RETIRED, ROLLED_BACK |
| ENUM-09 | approval_status | PENDING, APPROVED, REJECTED |
| ENUM-10 | task_status | OPEN, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED |
| ENUM-11 | share_channel | WHATSAPP_APPROVED, EMAIL, SMS, INTERNAL_LINK |
| ENUM-12 | acquisition_mode | API, WEBHOOK, MANUAL_IMPORT, FILE_IMPORT, PROVIDER_FEED |

### ENT-01 - OrganizationUnit
Hierarchy node for State, Wing, District, Unit, or Team.  
**RFP Ref:** RFP-TEC-06, RFP-RPT-07

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | unit_id | UUID | Y | System generated; primary key | System | RFP-TEC-06 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | unit_code | VARCHAR(30) | Y | Unique uppercase code | Admin | RFP-TEC-06 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | unit_name | VARCHAR(150) | Y | 1-150 chars | Admin | RFP-TEC-06 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | unit_type | ENUM | Y | STATE|WING|DISTRICT|UNIT|TEAM | Admin | RFP-TEC-06 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | parent_unit_id | UUID | N | Must reference existing unit for non-root nodes | Admin | RFP-TEC-06 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | is_active | BOOLEAN | Y | Default true | Admin | RFP-RPT-07 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | created_at | TIMESTAMP | Y | UTC | System | RFP-RPT-07 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | created_by | UUID | Y | FK UserAccount | System | RFP-RPT-07 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | updated_at | TIMESTAMP | Y | UTC | System | RFP-RPT-07 |
| OrganizationUnit | Hierarchy node for State, Wing, District, Unit, or Team. | updated_by | UUID | Y | FK UserAccount | System | RFP-RPT-07 |

### ENT-02 - UserAccount
Named user with identity, role assignments, and organization scope.  
**RFP Ref:** RFP-TEC-06, RFP-RPT-07

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| UserAccount | Named user with identity, role assignments, and organization scope. | user_id | UUID | Y | System generated; primary key | System | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | username | VARCHAR(100) | Y | Unique; email or AD identifier | Identity provider/System | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | display_name | VARCHAR(150) | Y | 1-150 chars | Identity provider/Admin | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | email | VARCHAR(150) | Y | Valid email format | Identity provider/Admin | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | mobile_no | VARCHAR(20) | N | E.164 recommended | Identity provider/Admin | RFP-ALT-04 |
| UserAccount | Named user with identity, role assignments, and organization scope. | auth_provider | VARCHAR(30) | Y | OIDC|SAML|LDAP|LOCAL_BREAK_GLASS | System | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | primary_unit_id | UUID | Y | FK OrganizationUnit | Admin | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | account_status | ENUM | Y | ACTIVE|DISABLED|LOCKED | Admin/System | RFP-TEC-06 |
| UserAccount | Named user with identity, role assignments, and organization scope. | last_login_at | TIMESTAMP | N | UTC | System | RFP-ALT-05 |
| UserAccount | Named user with identity, role assignments, and organization scope. | created_at | TIMESTAMP | Y | UTC | System | RFP-ALT-05 |
| UserAccount | Named user with identity, role assignments, and organization scope. | updated_at | TIMESTAMP | Y | UTC | System | RFP-ALT-05 |

### ENT-03 - Role
System role with permission level and approval capability metadata.  
**RFP Ref:** RFP-TEC-06

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| Role | System role with permission level and approval capability metadata. | role_id | UUID | Y | Primary key | System | RFP-TEC-06 |
| Role | System role with permission level and approval capability metadata. | role_code | VARCHAR(30) | Y | Unique uppercase code | Admin | RFP-TEC-06 |
| Role | System role with permission level and approval capability metadata. | role_name | VARCHAR(100) | Y | Unique display name | Admin | RFP-TEC-06 |
| Role | System role with permission level and approval capability metadata. | permission_level | VARCHAR(10) | Y | PL0..PL4 | Admin | RFP-TEC-06 |
| Role | System role with permission level and approval capability metadata. | can_approve_external_share | BOOLEAN | Y | Default false | Admin | RFP-ALT-04 |
| Role | System role with permission level and approval capability metadata. | can_approve_legal_text | BOOLEAN | Y | Default false | Admin | RFP-LEG-04 |
| Role | System role with permission level and approval capability metadata. | can_manage_config | BOOLEAN | Y | Default false | Admin | RFP-RPT-08 |
| Role | System role with permission level and approval capability metadata. | is_system_role | BOOLEAN | Y | Default false | Admin | RFP-TEC-06 |

### ENT-04 - SourceConnector
Connector or acquisition workflow definition for each supported source.  
**RFP Ref:** RFP-MON-01, RFP-TEC-03

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| SourceConnector | Connector or acquisition workflow definition for each supported source. | connector_id | UUID | Y | Primary key | System | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | platform_code | ENUM | Y | Must be supported platform enum | Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | acquisition_mode | ENUM | Y | From ENUM-12 | Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | entitlement_reference | VARCHAR(150) | Y | Ticket/approval/reference ID | Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | poll_interval_sec | INTEGER | N | 10-86400 | Admin | RFP-OBJ-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | rate_limit_per_min | INTEGER | N | Positive integer | Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | connector_status | VARCHAR(20) | Y | ACTIVE|PAUSED|ERROR|RETIRED | System/Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | last_success_at | TIMESTAMP | N | UTC | System | RFP-OBJ-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | retry_policy_json | JSONB | Y | Must include maxRetries and backoff | Admin | RFP-MON-01 |
| SourceConnector | Connector or acquisition workflow definition for each supported source. | created_at | TIMESTAMP | Y | UTC | System | RFP-TEC-03 |

### ENT-05 - ContentItem
Normalized post/comment/profile/media content record ingested from a source platform.  
**RFP Ref:** RFP-OBJ-01, RFP-MON-03, RFP-MON-05, RFP-AI-01

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | content_id | UUID | Y | Primary key | System | RFP-OBJ-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | platform_code | ENUM | Y | Supported platform | Connector | RFP-MON-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | source_object_type | VARCHAR(30) | Y | POST|COMMENT|PROFILE|VIDEO|IMAGE|CHANNEL | Connector | RFP-OBJ-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | source_content_id | VARCHAR(200) | Y | Unique with platform_code | Connector | RFP-MON-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | source_url | TEXT | N | Valid URL if available | Connector | RFP-OBJ-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | author_handle | VARCHAR(200) | N | Raw handle as sourced | Connector | RFP-MON-03 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | author_display_name | VARCHAR(200) | N | Nullable | Connector | RFP-MON-03 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | content_text | TEXT | N | Normalized UTF-8 text | Connector/System | RFP-MON-05 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | detected_language | VARCHAR(10) | N | ISO 639-1/2 code or UNKNOWN | System | RFP-LNG-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | posted_at | TIMESTAMP | N | UTC source timestamp | Connector | RFP-EVD-03 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | ingested_at | TIMESTAMP | Y | UTC | System | RFP-OBJ-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | engagement_json | JSONB | N | Likes/shares/comments/view counts | Connector | RFP-RSK-01 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | normalized_hash | VARCHAR(64) | Y | SHA-256 of normalized payload | System | RFP-EVD-05 |
| ContentItem | Normalized post/comment/profile/media content record ingested from a source platform. | processing_status | VARCHAR(30) | Y | INGESTED|CLASSIFIED|FAILED_NORMALIZATION|ARCHIVED | System | RFP-AI-01 |

### ENT-06 - ContentMedia
Media object linked to ContentItem, including OCR or transcript outputs where applicable.  
**RFP Ref:** RFP-EVD-01, RFP-EVD-02

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | media_id | UUID | Y | Primary key | System | RFP-EVD-01 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | content_id | UUID | Y | FK ContentItem | System | RFP-EVD-01 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | media_type | VARCHAR(20) | Y | IMAGE|VIDEO|AUDIO|DOCUMENT | Connector | RFP-EVD-02 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | source_media_url | TEXT | N | Nullable when imported | Connector | RFP-EVD-01 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | stored_object_key | VARCHAR(300) | Y | Immutable object-store key | System | RFP-EVD-02 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | mime_type | VARCHAR(100) | Y | Valid MIME type | System | RFP-EVD-02 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | file_size_bytes | BIGINT | Y | >= 0 | System | RFP-EVD-02 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | sha256_hash | VARCHAR(64) | N | SHA-256 of binary object | System | RFP-EVD-05 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | ocr_text | TEXT | N | Optional extracted text | AI/OCR provider | RFP-MON-04 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | transcript_text | TEXT | N | Optional transcript | AI/STT provider | RFP-MON-05 |
| ContentMedia | Media object linked to ContentItem, including OCR or transcript outputs where applicable. | processing_status | VARCHAR(30) | Y | READY|FAILED_MEDIA_PROCESSING|PARTIAL | System | RFP-EVD-02 |

### ENT-07 - TaxonomyCategory
Category master used by AI classification, dashboards, and reports.  
**RFP Ref:** RFP-AI-01, RFP-AI-03, RFP-RPT-08

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | category_id | UUID | Y | Primary key | System | RFP-AI-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | category_code | VARCHAR(30) | Y | Unique uppercase code | Admin | RFP-AI-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | parent_category_id | UUID | N | FK TaxonomyCategory | Admin | RFP-AI-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | category_name | VARCHAR(120) | Y | 1-120 chars | Admin | RFP-AI-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | description | TEXT | N | Nullable | Admin | RFP-AI-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | severity_default | INTEGER | Y | 0-100 | Admin | RFP-RSK-01 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | config_status | ENUM | Y | From ENUM-08 | Admin | RFP-RPT-08 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | version_no | INTEGER | Y | >=1 | System | RFP-RPT-08 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | effective_from | TIMESTAMP | Y | UTC | Admin | RFP-AI-03 |
| TaxonomyCategory | Category master used by AI classification, dashboards, and reports. | effective_to | TIMESTAMP | N | UTC; null when active | Admin | RFP-AI-03 |

### ENT-08 - Alert
Primary triage object created from a classified/scored content signal.  
**RFP Ref:** RFP-ALT-01, RFP-ALT-02, RFP-ALT-03

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| Alert | Primary triage object created from a classified/scored content signal. | alert_id | UUID | Y | Primary key | System | RFP-ALT-01 |
| Alert | Primary triage object created from a classified/scored content signal. | alert_ref_no | VARCHAR(40) | Y | Unique format TEF-ALT-YYYY-NNNNNN | System | RFP-EVD-04 |
| Alert | Primary triage object created from a classified/scored content signal. | content_id | UUID | Y | FK ContentItem | System | RFP-ALT-01 |
| Alert | Primary triage object created from a classified/scored content signal. | primary_category_id | UUID | Y | FK TaxonomyCategory | System | RFP-ALT-02 |
| Alert | Primary triage object created from a classified/scored content signal. | risk_score | DECIMAL(5,2) | Y | 0.00-100.00 | System | RFP-RSK-01 |
| Alert | Primary triage object created from a classified/scored content signal. | priority_band | ENUM | Y | From ENUM-02 | System | RFP-ALT-02 |
| Alert | Primary triage object created from a classified/scored content signal. | alert_status | ENUM | Y | From ENUM-03 | System/User | RFP-ALT-03 |
| Alert | Primary triage object created from a classified/scored content signal. | owner_user_id | UUID | N | FK UserAccount | System/User | RFP-ALT-05 |
| Alert | Primary triage object created from a classified/scored content signal. | owner_unit_id | UUID | Y | FK OrganizationUnit | System | RFP-MON-06 |
| Alert | Primary triage object created from a classified/scored content signal. | legal_status | VARCHAR(30) | Y | PENDING_REVIEW|APPROVED|NO_MATCH_FOUND | System/User | RFP-LEG-03 |
| Alert | Primary triage object created from a classified/scored content signal. | due_at | TIMESTAMP | Y | Derived from SLA policy | System | RFP-OBJ-06 |
| Alert | Primary triage object created from a classified/scored content signal. | created_at | TIMESTAMP | Y | UTC | System | RFP-ALT-01 |
| Alert | Primary triage object created from a classified/scored content signal. | closed_at | TIMESTAMP | N | UTC | System | RFP-ALT-05 |

### ENT-09 - AlertAction
Detailed action log for alert workflow events and user collaboration.  
**RFP Ref:** RFP-ALT-05, RFP-ALT-04

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| AlertAction | Detailed action log for alert workflow events and user collaboration. | action_id | UUID | Y | Primary key | System | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | alert_id | UUID | Y | FK Alert | System | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | action_type | VARCHAR(40) | Y | VIEW|ACKNOWLEDGE|ESCALATE|SHARE|COMMENT|SUPPRESS|CLOSE|REOPEN | System/User | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | action_reason | TEXT | N | Mandatory for CLOSE/SUPPRESS/OVERRIDE actions | User | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | actor_user_id | UUID | Y | FK UserAccount | System | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | channel | ENUM | N | From ENUM-11 when share action | User/System | RFP-ALT-04 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | action_payload_json | JSONB | N | Structured action details | System | RFP-ALT-05 |
| AlertAction | Detailed action log for alert workflow events and user collaboration. | created_at | TIMESTAMP | Y | UTC | System | RFP-ALT-05 |

### ENT-10 - EvidenceItem
Preserved evidentiary record with chain-of-custody controls and retention metadata.  
**RFP Ref:** RFP-EVD-01, RFP-EVD-02, RFP-EVD-03, RFP-EVD-04, RFP-EVD-05, RFP-EVD-06

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | evidence_id | UUID | Y | Primary key | System | RFP-EVD-01 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | evidence_ref_no | VARCHAR(40) | Y | Unique format TEF-EVD-YYYY-NNNNNN | System | RFP-EVD-04 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | source_content_id | UUID | Y | FK ContentItem | System | RFP-EVD-01 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | case_id | UUID | N | FK CaseRecord | User/System | RFP-EVD-05 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | capture_mode | VARCHAR(20) | Y | SNAPSHOT|DOWNLOAD|MANUAL_UPLOAD | User/System | RFP-EVD-01 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | master_object_key | VARCHAR(300) | Y | Immutable storage path | System | RFP-EVD-02 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | preview_object_key | VARCHAR(300) | N | Redacted/preview copy path | System | RFP-EVD-02 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | sha256_hash | VARCHAR(64) | Y | 64-hex characters | System | RFP-EVD-05 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | metadata_json | JSONB | Y | Must include source_url, posted_at, captured_at, operator_id | System | RFP-EVD-03 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | evidence_status | ENUM | Y | From ENUM-05 | System/User | RFP-EVD-05 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | legal_hold_flag | BOOLEAN | Y | Default false | User/System | RFP-EVD-05 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | retention_until | DATE | N | Null when legal hold or policy-driven | System | RFP-EVD-05 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | captured_by | UUID | Y | FK UserAccount | System | RFP-EVD-03 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | captured_at | TIMESTAMP | Y | UTC | System | RFP-EVD-03 |
| EvidenceItem | Preserved evidentiary record with chain-of-custody controls and retention metadata. | verified_at | TIMESTAMP | N | UTC | Evidence Custodian | RFP-EVD-05 |

### ENT-11 - CaseRecord
Operational case/incident linking alerts, evidence, tasks, and reports.  
**RFP Ref:** RFP-LEG-04, RFP-RPT-03

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | case_id | UUID | Y | Primary key | System | RFP-LEG-04 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | case_ref_no | VARCHAR(40) | Y | Unique format TEF-CAS-YYYY-NNNNNN | System | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | title | VARCHAR(200) | Y | 1-200 chars | User | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | description | TEXT | N | Nullable | User | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | originating_alert_id | UUID | N | FK Alert | User/System | RFP-LEG-04 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | owner_unit_id | UUID | Y | FK OrganizationUnit | System/User | RFP-MON-06 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | assigned_to_user_id | UUID | N | FK UserAccount | User/System | RFP-ALT-05 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | priority_band | ENUM | Y | From ENUM-02 | System/User | RFP-RSK-01 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | case_status | ENUM | Y | From ENUM-04 | System/User | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | opened_at | TIMESTAMP | Y | UTC | System | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | closed_at | TIMESTAMP | N | UTC | System | RFP-RPT-03 |
| CaseRecord | Operational case/incident linking alerts, evidence, tasks, and reports. | closure_reason | VARCHAR(100) | N | Mandatory when CLOSED | User | RFP-RPT-03 |

### ENT-12 - CaseTask
Assigned work item inside a case or alert workflow.  
**RFP Ref:** RFP-OBJ-06, RFP-RPT-03

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| CaseTask | Assigned work item inside a case or alert workflow. | task_id | UUID | Y | Primary key | System | RFP-OBJ-06 |
| CaseTask | Assigned work item inside a case or alert workflow. | case_id | UUID | N | FK CaseRecord | System/User | RFP-RPT-03 |
| CaseTask | Assigned work item inside a case or alert workflow. | alert_id | UUID | N | FK Alert | System/User | RFP-ALT-05 |
| CaseTask | Assigned work item inside a case or alert workflow. | task_type | VARCHAR(40) | Y | REVIEW|VERIFY_EVIDENCE|LEGAL_REVIEW|FOLLOW_UP|EXPORT | User/System | RFP-LEG-04 |
| CaseTask | Assigned work item inside a case or alert workflow. | assigned_to_user_id | UUID | N | FK UserAccount | User/System | RFP-OBJ-06 |
| CaseTask | Assigned work item inside a case or alert workflow. | assigned_unit_id | UUID | Y | FK OrganizationUnit | User/System | RFP-MON-06 |
| CaseTask | Assigned work item inside a case or alert workflow. | due_at | TIMESTAMP | N | UTC | System/User | RFP-OBJ-06 |
| CaseTask | Assigned work item inside a case or alert workflow. | task_status | ENUM | Y | From ENUM-10 | System/User | RFP-OBJ-06 |
| CaseTask | Assigned work item inside a case or alert workflow. | remarks | TEXT | N | Nullable | User | RFP-ALT-05 |

### ENT-13 - LegalMappingRule
Versioned rules and legal references used for automated legal mapping.  
**RFP Ref:** RFP-LEG-01, RFP-LEG-02, RFP-RSK-05

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | rule_id | UUID | Y | Primary key | System | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | rule_code | VARCHAR(40) | Y | Unique | Admin | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | law_name | VARCHAR(150) | Y | Department-approved legal framework | Admin | RFP-LEG-01 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | provision_code | VARCHAR(100) | Y | Section/provision identifier | Admin | RFP-LEG-01 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | rule_expression | TEXT | Y | Structured rule or DSL expression | Admin | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | severity_weight | DECIMAL(5,2) | N | Optional weight | Admin | RFP-RSK-01 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | version_no | INTEGER | Y | >=1 | System | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | approval_status | ENUM | Y | From ENUM-09 | Admin/Legal Reviewer | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | effective_from | TIMESTAMP | Y | UTC | Admin | RFP-LEG-02 |
| LegalMappingRule | Versioned rules and legal references used for automated legal mapping. | effective_to | TIMESTAMP | N | UTC | Admin | RFP-LEG-02 |

### ENT-14 - LegalMappingResult
Computed legal suggestion results for content/alerts, subject to review.  
**RFP Ref:** RFP-LEG-01, RFP-LEG-03, RFP-LEG-04

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | mapping_id | UUID | Y | Primary key | System | RFP-LEG-03 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | alert_id | UUID | Y | FK Alert | System | RFP-LEG-03 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | rule_id | UUID | N | FK LegalMappingRule | System | RFP-LEG-02 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | provision_code | VARCHAR(100) | Y | Must match law rule | System | RFP-LEG-01 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | rationale_text | TEXT | Y | 1-2000 chars | System | RFP-LEG-03 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | confidence_score | DECIMAL(5,2) | N | 0.00-100.00 | System | RFP-LEG-03 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | reviewer_status | ENUM | Y | From ENUM-09 | Legal Reviewer | RFP-LEG-04 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | reviewed_by | UUID | N | FK UserAccount | Legal Reviewer | RFP-LEG-04 |
| LegalMappingResult | Computed legal suggestion results for content/alerts, subject to review. | reviewed_at | TIMESTAMP | N | UTC | System | RFP-LEG-04 |

### ENT-15 - TranslationRecord
Original/translated content pair linked to alerts, evidence, or reports.  
**RFP Ref:** RFP-LNG-01, RFP-LNG-02, RFP-LNG-03, RFP-LNG-04

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | translation_id | UUID | Y | Primary key | System | RFP-LNG-02 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | source_object_type | VARCHAR(30) | Y | ALERT|CONTENT|EVIDENCE|REPORT | System/User | RFP-LNG-02 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | source_object_id | UUID | Y | FK to typed object | System/User | RFP-LNG-02 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | source_language | VARCHAR(10) | Y | ISO code or UNKNOWN | System | RFP-LNG-01 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | target_language | VARCHAR(10) | Y | Configured allowed language | User/System | RFP-LNG-03 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | translation_text | TEXT | N | Nullable when failed/unsupported | Translation engine | RFP-LNG-02 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | glossary_version | VARCHAR(30) | N | Nullable | System | RFP-LNG-04 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | provider_name | VARCHAR(100) | Y | Configured provider | System | RFP-LNG-02 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | translation_status | ENUM | Y | From ENUM-07 | System | RFP-LNG-03 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | requested_by | UUID | Y | FK UserAccount | System/User | RFP-LNG-03 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | requested_at | TIMESTAMP | Y | UTC | System | RFP-LNG-03 |
| TranslationRecord | Original/translated content pair linked to alerts, evidence, or reports. | completed_at | TIMESTAMP | N | UTC | System | RFP-LNG-03 |

### ENT-16 - ReportTemplate
Template master for investigation reports, notes, annexures, and MIS output definitions.  
**RFP Ref:** RFP-RPT-01, RFP-RPT-02, RFP-RPT-03

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | template_id | UUID | Y | Primary key | System | RFP-RPT-01 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | template_code | VARCHAR(40) | Y | Unique uppercase code | Admin | RFP-RPT-01 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | template_name | VARCHAR(150) | Y | 1-150 chars | Admin | RFP-RPT-01 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | report_type | VARCHAR(40) | Y | INVESTIGATION_NOTE|INTEL_BRIEF|ANNEXURE|MIS | Admin | RFP-RPT-03 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | version_no | INTEGER | Y | >=1 | System | RFP-RPT-02 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | config_status | ENUM | Y | From ENUM-08 | Admin/Legal Reviewer | RFP-RPT-02 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | storage_key | VARCHAR(300) | Y | Template file or definition location | System | RFP-RPT-02 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | placeholder_schema_json | JSONB | Y | Required placeholder definitions | Admin | RFP-RPT-01 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | approved_by | UUID | N | FK UserAccount | Legal Reviewer/Admin | RFP-RPT-02 |
| ReportTemplate | Template master for investigation reports, notes, annexures, and MIS output definitions. | approved_at | TIMESTAMP | N | UTC | System | RFP-RPT-02 |

### ENT-17 - ReportInstance
Generated report artifact linked to source case/alert and template version.  
**RFP Ref:** RFP-RPT-03, RFP-RPT-04, RFP-RPT-05

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| ReportInstance | Generated report artifact linked to source case/alert and template version. | report_id | UUID | Y | Primary key | System | RFP-RPT-03 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | template_id | UUID | Y | FK ReportTemplate | System/User | RFP-RPT-02 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | case_id | UUID | N | FK CaseRecord | User/System | RFP-RPT-03 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | alert_id | UUID | N | FK Alert | User/System | RFP-RPT-03 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | report_status | ENUM | Y | From ENUM-06 | System/User | RFP-RPT-03 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | generated_object_key | VARCHAR(300) | N | Storage path after generation | System | RFP-RPT-04 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | request_payload_json | JSONB | Y | Generation input snapshot | System | RFP-RPT-05 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | reviewer_user_id | UUID | N | FK UserAccount | User | RFP-RPT-03 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | exported_at | TIMESTAMP | N | UTC | System | RFP-RPT-04 |
| ReportInstance | Generated report artifact linked to source case/alert and template version. | created_at | TIMESTAMP | Y | UTC | System | RFP-RPT-03 |

### ENT-18 - NotificationEvent
Outbound notification/share event for alerts, SLA breaches, or workflow actions.  
**RFP Ref:** RFP-ALT-04, RFP-ALT-05

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | notification_id | UUID | Y | Primary key | System | RFP-ALT-04 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | alert_id | UUID | N | FK Alert | System | RFP-ALT-04 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | case_id | UUID | N | FK CaseRecord | System | RFP-ALT-04 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | channel | ENUM | Y | From ENUM-11 | System/User | RFP-ALT-04 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | recipient | VARCHAR(200) | Y | Validated channel address | System/User | RFP-ALT-04 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | payload_summary | TEXT | Y | Sanitized summary only | System | RFP-ALT-05 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | delivery_status | VARCHAR(20) | Y | PENDING|SENT|FAILED|DLQ | System | RFP-ALT-05 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | delivery_attempts | INTEGER | Y | >=0 | System | RFP-ALT-05 |
| NotificationEvent | Outbound notification/share event for alerts, SLA breaches, or workflow actions. | last_attempt_at | TIMESTAMP | N | UTC | System | RFP-ALT-05 |

### ENT-19 - AuditLog
Immutable audit trail record for access, changes, approvals, exports, and system events.  
**RFP Ref:** RFP-ALT-05, RFP-EVD-05, RFP-WAR-01

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | audit_id | UUID | Y | Primary key | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | actor_user_id | UUID | N | FK UserAccount; null for system events | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | actor_role_id | UUID | N | FK Role | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | action_name | VARCHAR(80) | Y | Normalized event code | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | object_type | VARCHAR(40) | Y | ALERT|CASE|EVIDENCE|REPORT|CONFIG|USER|SYSTEM | System | RFP-EVD-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | object_id | UUID | N | Nullable for system-wide events | System | RFP-EVD-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | source_ip | VARCHAR(64) | N | IPv4/IPv6 | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | user_agent | TEXT | N | Nullable | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | outcome | VARCHAR(20) | Y | SUCCESS|DENIED|FAILED | System | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | reason | TEXT | N | Optional reason/details | System/User | RFP-ALT-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | before_json | JSONB | N | Snapshot before change | System | RFP-EVD-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | after_json | JSONB | N | Snapshot after change | System | RFP-EVD-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | hash_chain_value | VARCHAR(128) | Y | Tamper-evident chain/hash | System | RFP-EVD-05 |
| AuditLog | Immutable audit trail record for access, changes, approvals, exports, and system events. | created_at | TIMESTAMP | Y | UTC | System | RFP-ALT-05 |

### ENT-20 - Watchlist
Configurable watch target for account, phrase, location, or visual-pattern monitoring.  
**RFP Ref:** RFP-OBJ-01, RFP-MON-02

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | watchlist_id | UUID | Y | Primary key | System | RFP-OBJ-01 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | watchlist_type | VARCHAR(30) | Y | ACCOUNT|PHRASE|HASHTAG|LOCATION|VISUAL_PATTERN | User/Admin | RFP-MON-02 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | pattern_value | TEXT | Y | Must be unique within owner scope | User/Admin | RFP-MON-02 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | owner_unit_id | UUID | Y | FK OrganizationUnit | User/Admin | RFP-MON-02 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | priority_hint | ENUM | N | From ENUM-02 | User/Admin | RFP-RSK-01 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | is_active | BOOLEAN | Y | Default true | User/Admin | RFP-MON-02 |
| Watchlist | Configurable watch target for account, phrase, location, or visual-pattern monitoring. | created_at | TIMESTAMP | Y | UTC | System | RFP-MON-02 |

### ENT-21 - SavedSearch
Named reusable search/query definition for dashboards and investigations.  
**RFP Ref:** RFP-MON-02, RFP-RPT-06

| Entity Name | Description | Attribute | Data Type | Mandatory | Validation Rule | Source | RFP Ref |
|---|---|---|---|---|---|---|---|
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | saved_search_id | UUID | Y | Primary key | System | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | search_name | VARCHAR(120) | Y | Unique per owner | User | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | search_scope | VARCHAR(20) | Y | PRIVATE|UNIT_SHARED | User | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | query_json | JSONB | Y | Validated filter schema | User/System | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | owner_user_id | UUID | Y | FK UserAccount | User/System | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | created_at | TIMESTAMP | Y | UTC | System | RFP-MON-02 |
| SavedSearch | Named reusable search/query definition for dashboards and investigations. | updated_at | TIMESTAMP | Y | UTC | System | RFP-MON-02 |

## 6. API Specifications
### 6.1 Common Error Catalogue
| Error Code | Meaning |
|---|---|
| VAL-400 | Validation failed |
| AUTH-401 | Authentication required or token invalid |
| AUTH-403 | User lacks required permission |
| OBJ-404 | Requested object not found |
| CON-409 | Conflict with current object state |
| IDM-409 | Duplicate idempotency key or replayed request |
| EXT-424 | Dependent external service failed |
| SYS-500 | Unhandled server error |
| OPS-503 | Service temporarily unavailable |

### API-01 - POST /api/v1/connectors/{platform}/ingest-events
- **Purpose:** Receive or ingest normalized source payloads from connector adapters.
- **Authentication Mechanism:** OAuth2 client credentials or signed service account token
- **Rate Limits:** 600 requests/min per connector
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-MON-01, RFP-OBJ-01

**Request Schema**
```json
{
  "connectorId": "UUID",
  "sourceBatchId": "SRCBATCH-20260302-0001",
  "items": [
    {
      "sourceContentId": "1234567890",
      "sourceObjectType": "POST",
      "sourceUrl": "https://...",
      "authorHandle": "@example",
      "contentText": "sample text",
      "postedAt": "2026-03-02T08:30:00Z",
      "media": [{"mediaType": "IMAGE", "sourceMediaUrl": "https://..."}],
      "engagement": {"likes": 10, "shares": 4, "comments": 2},
      "rawPayload": {...}
    }
  ]
}
```

**Response Schema**
```json
{
  "sourceBatchId": "SRCBATCH-20260302-0001",
  "acceptedCount": 25,
  "duplicateCount": 2,
  "rejectedCount": 1,
  "status": "ACCEPTED"
}
```

**Validation Rules**
- platform path parameter must match supported platform enum.
- connectorId must belong to an ACTIVE connector for the same platform.
- items array length 1-100; each sourceContentId must be unique within the batch.
- postedAt must be valid ISO-8601 UTC or include timezone offset.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- IDM-409
- OPS-503

### API-02 - GET /api/v1/content-items/search
- **Purpose:** Search normalized content across platforms with filters used by the dashboard.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 120 requests/min per user
- **Idempotency Handling:** Not applicable
- **RFP Ref:** RFP-MON-02, RFP-MON-03, RFP-MON-05

**Request Schema**
```json
Query params:
platform, districtId, categoryCode, priorityBand, language, q, from, to, page, pageSize
```

**Response Schema**
```json
{
  "page": 1,
  "pageSize": 25,
  "total": 250,
  "items": [
    {
      "contentId": "UUID",
      "platformCode": "X",
      "sourceContentId": "123",
      "authorHandle": "@example",
      "excerpt": "sample excerpt",
      "detectedLanguage": "te",
      "riskScore": 88.5,
      "alertRefNo": "TEF-ALT-2026-000123"
    }
  ]
}
```

**Validation Rules**
- pageSize max 100.
- Date range must not exceed 92 days unless Leadership or Auditor role has extended scope.
- districtId filter must be within the user's effective organization scope.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OPS-503

### API-03 - GET /api/v1/alerts
- **Purpose:** List alerts for dashboard, queue management, and SLA review.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 120 requests/min per user
- **Idempotency Handling:** Not applicable
- **RFP Ref:** RFP-ALT-01, RFP-ALT-02, RFP-ALT-03

**Request Schema**
```json
Query params:
status, priorityBand, ownerUnitId, ownerUserId, categoryCode, platformCode, dueBefore, page, pageSize
```

**Response Schema**
```json
{
  "items": [
    {
      "alertId": "UUID",
      "alertRefNo": "TEF-ALT-2026-000123",
      "priorityBand": "CRITICAL",
      "riskScore": 91.0,
      "alertStatus": "NEW",
      "sourceAttribution": {"platformCode": "X", "sourceContentId": "123"},
      "dueAt": "2026-03-02T09:15:00Z"
    }
  ]
}
```

**Validation Rules**
- ownerUnitId and ownerUserId must be within authorization scope.
- priorityBand must be from ENUM-02.
- pageSize max 100.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OPS-503

### API-04 - PATCH /api/v1/alerts/{alertId}
- **Purpose:** Update alert state, ownership, disposition, or analyst comments.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 60 requests/min per user
- **Idempotency Handling:** Optional for client retries using X-Idempotency-Key
- **RFP Ref:** RFP-ALT-05, RFP-OBJ-06

**Request Schema**
```json
{
  "alertStatus": "IN_REVIEW",
  "ownerUserId": "UUID",
  "comment": "Initial analyst review complete",
  "dispositionCode": null,
  "priorityOverride": null,
  "overrideReason": null
}
```

**Response Schema**
```json
{
  "alertId": "UUID",
  "alertStatus": "IN_REVIEW",
  "ownerUserId": "UUID",
  "updatedAt": "2026-03-02T09:02:00Z"
}
```

**Validation Rules**
- Transition must be valid for current alert state.
- priorityOverride requires overrideReason of 10-500 chars.
- dispositionCode required when moving to closed states.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- CON-409

### API-05 - POST /api/v1/alerts/{alertId}/escalations
- **Purpose:** Escalate an alert to Supervisor or Control Room with optional sharing channel.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 30 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-OBJ-06, RFP-ALT-04, RFP-ALT-05

**Request Schema**
```json
{
  "targetLevel": "CONTROL_ROOM",
  "reason": "High virality and repeat actor",
  "shareChannel": "WHATSAPP_APPROVED",
  "shareRecipients": ["group-ops-01"]
}
```

**Response Schema**
```json
{
  "alertId": "UUID",
  "escalationLevel": "CONTROL_ROOM",
  "notificationIds": ["UUID"],
  "status": "ESCALATED_CONTROL_ROOM"
}
```

**Validation Rules**
- targetLevel must be SUPERVISOR or CONTROL_ROOM.
- shareChannel allowed only if the user's role can share externally and policy permits it.
- reason length 10-500 chars.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- EXT-424
- IDM-409

### API-06 - POST /api/v1/translations
- **Purpose:** Request translation for a content, alert, evidence, or report object.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 60 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-LNG-02, RFP-LNG-03, RFP-LNG-04

**Request Schema**
```json
{
  "sourceObjectType": "ALERT",
  "sourceObjectId": "UUID",
  "targetLanguage": "en",
  "useGlossary": true
}
```

**Response Schema**
```json
{
  "translationId": "UUID",
  "translationStatus": "REQUESTED"
}
```

**Validation Rules**
- sourceObjectType must be one of ALERT, CONTENT, EVIDENCE, REPORT.
- targetLanguage must be configured as enabled.
- The requester must have access to the source object.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- EXT-424

### API-07 - POST /api/v1/evidence-captures
- **Purpose:** Capture or preserve a content item as evidence and return evidence reference details.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 60 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-EVD-01, RFP-EVD-02, RFP-EVD-03, RFP-EVD-04, RFP-EVD-05

**Request Schema**
```json
{
  "contentId": "UUID",
  "caseId": "UUID",
  "captureMode": "SNAPSHOT",
  "includeMedia": true,
  "includeMetadata": true,
  "reason": "Narcotics promotion evidence"
}
```

**Response Schema**
```json
{
  "evidenceId": "UUID",
  "evidenceRefNo": "TEF-EVD-2026-000321",
  "evidenceStatus": "CAPTURED",
  "sha256Hash": "..."
}
```

**Validation Rules**
- contentId must exist and be visible to the requester.
- caseId optional, but if provided must reference an active case.
- captureMode must be SNAPSHOT, DOWNLOAD, or MANUAL_UPLOAD.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- CON-409
- IDM-409
- OPS-503

### API-08 - POST /api/v1/cases
- **Purpose:** Create a case from one or more alerts and assign ownership.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 30 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-LEG-04, RFP-RPT-03

**Request Schema**
```json
{
  "title": "Investigation of suspected narcotics promotion network",
  "description": "Initial case from multiple alerts",
  "originatingAlertIds": ["UUID", "UUID"],
  "ownerUnitId": "UUID",
  "assignedToUserId": "UUID",
  "priorityBand": "HIGH"
}
```

**Response Schema**
```json
{
  "caseId": "UUID",
  "caseRefNo": "TEF-CAS-2026-000045",
  "caseStatus": "OPEN"
}
```

**Validation Rules**
- title 1-200 chars.
- At least one originatingAlertId required.
- ownerUnitId must be within requester's scope or require approver role.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- IDM-409

### API-09 - PATCH /api/v1/cases/{caseId}
- **Purpose:** Update case ownership, status, due dates, and closure metadata.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 30 requests/min per user
- **Idempotency Handling:** Optional via X-Idempotency-Key header
- **RFP Ref:** RFP-RPT-03, RFP-OBJ-06

**Request Schema**
```json
{
  "caseStatus": "UNDER_INVESTIGATION",
  "assignedToUserId": "UUID",
  "dueAt": "2026-03-05T12:00:00Z",
  "closureReason": null
}
```

**Response Schema**
```json
{
  "caseId": "UUID",
  "caseStatus": "UNDER_INVESTIGATION",
  "updatedAt": "2026-03-02T10:15:00Z"
}
```

**Validation Rules**
- Transition must comply with case workflow.
- closureReason required when caseStatus = CLOSED.
- Only approver role may reopen a closed case.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- CON-409

### API-10 - POST /api/v1/reports/generate
- **Purpose:** Generate a report draft from a template and case/alert input payload.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 20 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-RPT-01, RFP-RPT-02, RFP-RPT-03, RFP-RPT-04, RFP-RPT-05

**Request Schema**
```json
{
  "templateId": "UUID",
  "caseId": "UUID",
  "targetFormat": "PDF",
  "includeEvidenceAnnexure": true,
  "targetLanguage": "en"
}
```

**Response Schema**
```json
{
  "reportId": "UUID",
  "reportStatus": "DRAFT",
  "templateVersion": 3
}
```

**Validation Rules**
- templateId must reference an APPROVED production template.
- targetFormat must be PDF or DOCX.
- User must have access to all source objects included in the report.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- CON-409
- EXT-424
- IDM-409

### API-11 - POST /api/v1/templates
- **Purpose:** Create or upload a report template definition.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 15 requests/min per user
- **Idempotency Handling:** Optional for file upload retries
- **RFP Ref:** RFP-RPT-01, RFP-RPT-02

**Request Schema**
```json
{
  "templateCode": "INVEST_NOTE",
  "templateName": "Investigation Note",
  "reportType": "INVESTIGATION_NOTE",
  "placeholderSchema": {...},
  "fileUploadToken": "opaque-upload-token"
}
```

**Response Schema**
```json
{
  "templateId": "UUID",
  "versionNo": 1,
  "configStatus": "DRAFT"
}
```

**Validation Rules**
- templateCode must be unique.
- placeholderSchema must validate against supported fields catalog.
- Only configured admin/legal roles may create templates.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- CON-409
- OPS-503

### API-12 - POST /api/v1/admin/config-promotions
- **Purpose:** Promote an approved configuration package from UAT to Production.
- **Authentication Mechanism:** SSO bearer token with approver role
- **Rate Limits:** 10 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-LEG-02, RFP-RSK-05, RFP-RPT-08

**Request Schema**
```json
{
  "configObjectType": "LEGAL_RULE_SET",
  "sourceVersion": 12,
  "targetEnvironment": "PRODUCTION",
  "changeTicketRef": "CHG-2026-0310",
  "approvalComment": "UAT signed off"
}
```

**Response Schema**
```json
{
  "promotionId": "UUID",
  "status": "PROMOTED",
  "targetVersion": 12
}
```

**Validation Rules**
- Source version must be APPROVED_UAT.
- targetEnvironment must be PRODUCTION.
- changeTicketRef is mandatory and 1-50 chars.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- CON-409
- IDM-409
- OPS-503

### API-13 - GET /api/v1/audit-logs
- **Purpose:** Retrieve audit records for authorized reviewers.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 60 requests/min per user
- **Idempotency Handling:** Not applicable
- **RFP Ref:** RFP-ALT-05, RFP-EVD-05

**Request Schema**
```json
Query params:
actorUserId, objectType, objectId, actionName, outcome, from, to, page, pageSize
```

**Response Schema**
```json
{
  "items": [
    {
      "auditId": "UUID",
      "actionName": "ALERT_ESCALATED",
      "objectType": "ALERT",
      "objectId": "UUID",
      "outcome": "SUCCESS",
      "createdAt": "2026-03-02T09:00:00Z"
    }
  ]
}
```

**Validation Rules**
- Accessible only to Security Auditor, Platform Administrator, or explicitly authorized Evidence Custodian.
- Date range max 365 days per query unless batch export is used.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OPS-503

### API-14 - POST /api/v1/notifications/shares
- **Purpose:** Send a secure share package through approved channels.
- **Authentication Mechanism:** SSO bearer token
- **Rate Limits:** 30 requests/min per user
- **Idempotency Handling:** Required via X-Idempotency-Key header
- **RFP Ref:** RFP-ALT-04, RFP-ALT-05

**Request Schema**
```json
{
  "objectType": "ALERT",
  "objectId": "UUID",
  "channel": "WHATSAPP_APPROVED",
  "recipients": ["ops-group-01"],
  "messageTemplateCode": "ALERT_SHARE_CRITICAL"
}
```

**Response Schema**
```json
{
  "notificationId": "UUID",
  "deliveryStatus": "PENDING"
}
```

**Validation Rules**
- Only approved channels can be used.
- Object must exist and the user must have share permission for the object's scope.
- Message template must be active and channel-compatible.

**Error Codes**
- VAL-400
- AUTH-401
- AUTH-403
- OBJ-404
- EXT-424
- IDM-409

## 7. Workflow / State Machine

### WF-ALT-01 - Alert Lifecycle
**States:** NEW, IN_REVIEW, ESCALATED_SUPERVISOR, ESCALATED_CONTROL_ROOM, CONVERTED_TO_CASE, FALSE_POSITIVE, CLOSED_NO_ACTION, CLOSED_ACTIONED, REOPENED

| From State | Trigger | Condition | To State | Actor | Notes / Approval Layer |
|---|---|---|---|---|---|
| NEW | Acknowledge | Analyst opens alert | IN_REVIEW | Intelligence Analyst / Control Room Operator | Start SLA clock if not already started |
| NEW | Auto-escalate | Priority = CRITICAL | ESCALATED_CONTROL_ROOM | System | Immediate notification |
| IN_REVIEW | Escalate to supervisor | Analyst selects escalate | ESCALATED_SUPERVISOR | Intelligence Analyst | Supervisor notified |
| IN_REVIEW | Escalate to control room | Analyst or system escalation rule | ESCALATED_CONTROL_ROOM | Analyst / System | Control Room notified |
| IN_REVIEW | Convert to case | Analyst creates case | CONVERTED_TO_CASE | Analyst | Case WF-CAS-01 starts |
| IN_REVIEW | Mark false positive | Analyst provides mandatory reason | FALSE_POSITIVE | Analyst; Supervisor approval optional by policy | Quality metrics updated |
| ESCALATED_SUPERVISOR | Approve action | Supervisor reviews | IN_REVIEW | Supervisor | Owner may change |
| ESCALATED_CONTROL_ROOM | Action taken and alert retained | Control Room completes action | CLOSED_ACTIONED | Control Room Operator; Supervisor if configured | Closure reason mandatory |
| IN_REVIEW | Close no action | Analyst or Supervisor with disposition | CLOSED_NO_ACTION | Authorized user | Disposition reason mandatory |
| CLOSED_NO_ACTION | Reopen | New evidence or user action | REOPENED | Supervisor | SLA recalculated |
| FALSE_POSITIVE | Reopen | Supervisor rejects false-positive disposition | REOPENED | Supervisor | Quality feedback recorded |
| REOPENED | Resume review | User acknowledges | IN_REVIEW | Authorized user | Original history preserved |

**SLA Timers / Escalations**

| Priority | Acknowledge SLA | Disposition SLA | Escalation Rule |
|---|---|---|---|
| Critical | 15 min | 2 hr | Auto-escalate to Control Room immediately; notify supervisor at 15 min if unacknowledged |
| High | 30 min | 4 hr | Escalate to Supervisor on breach |
| Medium | 2 hr | 1 business day | Escalate to Supervisor on breach |
| Low | 1 business day | 3 business days | Supervisor dashboard flag on breach |

### WF-CAS-01 - Case Lifecycle
**States:** OPEN, ASSIGNED, UNDER_INVESTIGATION, AWAITING_REVIEW, CLOSED, REOPENED

| From State | Trigger | Condition | To State | Actor | Notes / Approval Layer |
|---|---|---|---|---|---|
| OPEN | Assign | Supervisor/Analyst assigns owner | ASSIGNED | Authorized user | Due date optional |
| ASSIGNED | Start investigation | Assignee accepts work | UNDER_INVESTIGATION | Investigator | Task timers active |
| UNDER_INVESTIGATION | Submit for review | Evidence/report prepared | AWAITING_REVIEW | Investigator | Supervisor/Legal review pending |
| AWAITING_REVIEW | Approve and close | All required approvals complete | CLOSED | Supervisor | Closure reason required |
| AWAITING_REVIEW | Return for rework | Review comments issued | UNDER_INVESTIGATION | Supervisor/Legal Reviewer | Comments mandatory |
| CLOSED | Reopen | New evidence or directive | REOPENED | Supervisor | Original closure metadata retained |
| REOPENED | Resume work | Assignee acknowledges | UNDER_INVESTIGATION | Investigator | Timeline updated |

**SLA Timers / Escalations**

| Workflow Stage | Target SLA |
|---|---|
| Case assignment | 4 hr from case creation for High/Critical; 1 business day otherwise |
| Case review | 2 business days from submit for review unless overridden |

### WF-EVD-01 - Evidence Lifecycle
**States:** CAPTURE_REQUESTED, CAPTURED, PARTIAL_CAPTURE, VERIFIED, INTEGRITY_EXCEPTION, PACKAGED, EXPORTED, LEGAL_HOLD, PURGED

| From State | Trigger | Condition | To State | Actor | Notes / Approval Layer |
|---|---|---|---|---|---|
| CAPTURE_REQUESTED | Capture success | Content and metadata preserved | CAPTURED | System | Hash generated |
| CAPTURE_REQUESTED | Capture partial | One or more components missing | PARTIAL_CAPTURE | System | Retry permitted |
| CAPTURED | Verify | Custodian verifies integrity | VERIFIED | Evidence Custodian | Master object locked |
| CAPTURED | Integrity issue | Hash mismatch or corruption | INTEGRITY_EXCEPTION | System/Custodian | Export blocked |
| VERIFIED | Package for case/report | User requests package | PACKAGED | Authorized user | Manifest generated |
| PACKAGED | Export | Approval complete | EXPORTED | Authorized user | Release log written |
| VERIFIED | Apply legal hold | Legal hold approved | LEGAL_HOLD | Evidence Custodian / Legal Reviewer | Purge disabled |
| LEGAL_HOLD | Release legal hold | Approver action | VERIFIED | Evidence Custodian / Legal Reviewer | Reason mandatory |
| VERIFIED | Purge | Retention expired and approved | PURGED | Authorized approver | Purge record retained |

**SLA Timers / Escalations**

| Workflow Stage | Target SLA |
|---|---|
| Evidence capture | Within 2 minutes for 95 percent of text/image items; within 10 minutes for 95 percent of video items under agreed size limits |
| Custodian verification | Within 1 business day for High/Critical case-linked evidence |

### WF-RPT-01 - Report Lifecycle
**States:** DRAFT, IN_REVIEW, APPROVED, EXPORTED, SUPERSEDED, GENERATION_FAILED

| From State | Trigger | Condition | To State | Actor | Notes / Approval Layer |
|---|---|---|---|---|---|
| DRAFT | Submit for review | User submits generated report | IN_REVIEW | Analyst/Investigator | Reviewer assigned |
| IN_REVIEW | Approve | Reviewer approves | APPROVED | Legal Reviewer/Supervisor | Export enabled |
| IN_REVIEW | Reject | Reviewer rejects | DRAFT | Legal Reviewer/Supervisor | Comments mandatory |
| APPROVED | Export | Authorized user exports | EXPORTED | Authorized user | Export audit created |
| APPROVED | Supersede | New version approved | SUPERSEDED | Reviewer/Admin | Prior version retained read-only |
| DRAFT | Generation failure | Render or data merge error | GENERATION_FAILED | System | Retry allowed |
| GENERATION_FAILED | Retry generation | User retries | DRAFT | Authorized user | Error history retained |

**SLA Timers / Escalations**

| Workflow Stage | Target SLA |
|---|---|
| Report generation | <= 120 seconds for standard report with <= 200 evidence references |
| Review turnaround | 1 business day unless priority-specific override applies |

## 8. Non-Functional Requirements
| NFR ID | Area | Requirement | Verification Approach |
|---|---|---|---|
| NFR-01 | Performance | Dashboard summary p95 response time <= 3 seconds for last-24-hour default dashboard under baseline load. | Load test with 120 concurrent users |
| NFR-02 | Performance | Alert search p95 response time <= 5 seconds for filtered 7-day queries over up to 1 million indexed content items. | Search benchmark report |
| NFR-03 | Performance | Alert detail and evidence detail p95 response time <= 4 seconds excluding media-streaming latency. | API/UI performance tests |
| NFR-04 | Performance | Standard report generation <= 120 seconds for report with <= 200 evidence references and <= 50 MB export size. | Batch export performance test |
| NFR-05 | Performance | Ingestion and classification pipeline supports at least 100,000 content items/day baseline and scales horizontally. | Throughput and scale test |
| NFR-06 | Concurrency | Support 300 named users and 120 concurrent active sessions at day 1, with scale target to 1,000 named users and 300 concurrent sessions without redesign. | Capacity test and sizing note |
| NFR-07 | Availability | Production monthly availability >= 99.5 percent excluding approved maintenance windows. | Monitoring and uptime reports |
| NFR-08 | Disaster Recovery | Recovery Point Objective <= 4 hours and Recovery Time Objective <= 8 hours. | Backup/restore and DR drill evidence |
| NFR-09 | Security | TLS 1.2+ for all network traffic and AES-256 or equivalent encryption at rest for databases, object storage, and backups. | Security architecture review |
| NFR-10 | Security | MFA required for PL3 and PL4 roles when identity platform supports MFA. | Authentication configuration test |
| NFR-11 | Security | All privileged actions and evidence/export events must fail closed if audit logging is unavailable. | Negative path test |
| NFR-12 | Auditability | Every material user/system action must be reconstructible from immutable audit logs, object histories, and workflow events. | Audit trace test |
| NFR-13 | Retention | Audit and evidence records retained for 7 years or longer if legal hold is active; purge requires approval and audit record. | Retention policy and purge test |
| NFR-14 | Scalability | District onboarding requires configuration only - no schema change or separate code branch. | Config-only rollout demonstration |
| NFR-15 | Observability | Expose structured logs, application metrics, connector health, queue depth, job latency, and alerting thresholds. | Ops dashboard walkthrough |
| NFR-16 | Maintainability | Configuration changes for taxonomy, legal rules, templates, and risk thresholds require no code change and are promotable through UAT. | Configuration promotion test |
| NFR-17 | Localization | UI and report rendering must support Unicode text and configured Department languages without character corruption. | Multilingual UAT scripts |
| NFR-18 | Accessibility | Primary operational screens must be keyboard navigable and readable at 1280x720 resolution without horizontal scrolling on standard layouts. | UX/UAT checklist |
| NFR-19 | Portability | Department can export data, reports, and configuration in standard formats without proprietary lock-in. | Bulk export demonstration |
| NFR-20 | Responsible AI | Model output schema compliance >= 99 percent on regression test set; hallucinated legal citations are blocked by validation rules. | AI regression suite |

## 9. Integration Requirements
| Interface ID | External System | Interface Type | Authentication Method | Data Format | Retry Mechanism | Failure Fallback | RFP Ref |
|---|---|---|---|---|---|---|---|
| INT-01 | X/Twitter connector | API / approved acquisition adapter | OAuth2/API key or provider credential | JSON | Exponential backoff 3 attempts then DLQ | Connector marked DEGRADED; dashboard shows partial-data banner | RFP-MON-01 |
| INT-02 | Instagram connector | API / approved acquisition adapter | OAuth2/API key or provider credential | JSON | Exponential backoff 3 attempts then DLQ | Connector marked DEGRADED; dashboard shows partial-data banner | RFP-MON-01 |
| INT-03 | Facebook connector | API / approved acquisition adapter | OAuth2/API key or provider credential | JSON | Exponential backoff 3 attempts then DLQ | Connector marked DEGRADED; dashboard shows partial-data banner | RFP-MON-01 |
| INT-04 | YouTube connector | API / approved acquisition adapter | OAuth2/API key or provider credential | JSON | Exponential backoff 3 attempts then DLQ | Connector marked DEGRADED; dashboard shows partial-data banner | RFP-MON-01 |
| INT-05 | Reddit connector | API / approved acquisition adapter | OAuth2/API key or provider credential | JSON | Exponential backoff 3 attempts then DLQ | Connector marked DEGRADED; dashboard shows partial-data banner | RFP-MON-01 |
| INT-06 | Identity Provider / AD / LDAP | OIDC / SAML / LDAP | Mutual trust + client credentials | JWT / SAML / LDAP | 3 retries for non-auth transient errors | Break-glass admin login only if configured and approved | RFP-TEC-06 |
| INT-07 | Approved WhatsApp / secure mobile sharing gateway | API | Service credential + allowlisted sender | JSON | 3 retries with idempotency key | Fallback to email/SMS/internal link based on policy | RFP-ALT-04 |
| INT-08 | Email / SMS gateway | API / SMTP / provider SDK | API key / SMTP auth | JSON / MIME | 3 retries then DLQ | Notification visible as failed on alert/case timeline | RFP-ALT-05 |
| INT-09 | Object storage / immutable evidence store | SDK / S3-compatible API | IAM role / access key | Binary + metadata JSON | Retry 3 times then block export/release if master write failed | No evidence export until master copy write is successful | RFP-EVD-02 |
| INT-10 | LLM / translation / OCR / transcription services | API | Service credential | JSON | Retry 2 times for idempotent requests | Fallback to rules-only triage or untranslated display | RFP-AI-04 |
| INT-11 | SIEM / SOC | Webhook / syslog / API | Signed webhook secret or client credential | JSON / CEF | Queue and retry for 24 hours | Local audit log remains authoritative | RFP-ALT-05 |
| INT-12 | Optional Department case or document system | API / SFTP / DB link | Department-approved auth | JSON / CSV / XML | Per-interface retry policy | Manual export package if integration unavailable | RFP-RPT-03 |

## 10. Compliance & Regulatory Mapping
| Compliance ID | Requirement | Mapped Functional Requirement | System Control | Audit Artifact |
|---|---|---|---|---|
| CMP-01 | Lawful monitoring and source entitlement | FR-03, FR-15 | Approved connector registry with entitlement reference; source onboarding approval gate | Connector configuration records; onboarding approval log |
| CMP-02 | Human approval before external use of legal text | FR-08, FR-13, FR-17 | Report workflow requires Legal Reviewer/Supervisor approval before export | Report approval audit trail; template approval records |
| CMP-03 | Evidence integrity and chain of custody | FR-11, FR-16 | SHA-256 hashing, immutable master copies, custody logs, legal hold controls | Evidence manifest; hash verification log; release history |
| CMP-04 | Role-based least privilege | FR-02, FR-17 | PL0-PL4 permission model; org-scope authorization; MFA for privileged roles | User-role assignment export; access review log |
| CMP-05 | Encryption in transit and at rest | FR-01, FR-17 | TLS 1.2+ enforced; encrypted databases/object storage/backups | Security configuration report; certificate inventory |
| CMP-06 | Auditability of alert actions and exports | FR-10, FR-16 | Immutable audit log for create/update/share/escalate/export | Audit-log extract; SIEM forwarding records |
| CMP-07 | Retention, legal hold, and defensible purge | FR-11, FR-16 | Retention policies with approval-based purge and legal-hold exclusion | Purge approval records; retention job logs |
| CMP-08 | Department ownership and portability | FR-18, NFR-19 | Handover/export obligations; configuration and data export in standard formats | Handover checklist; export test evidence |
| CMP-09 | Hosting in Government-approved environment | FR-01, FR-18 | Deployment in TSDC/gov cloud with documented infrastructure prerequisites | Deployment architecture sign-off; infra BOM |
| CMP-10 | Warranty, training, and post-go-live support | FR-18 | Training sign-off, hypercare roster, warranty matrix, support severity model | Training attendance records; support roster; incident tracker |

## 11. UI / UX Requirements
| Screen ID | Screen Name | Role Visibility | Input Fields / Actions | Validation Behavior | Error Display Rules | Conditional Rendering Logic |
|---|---|---|---|---|---|---|
| UI-01 | Login / SSO Entry | All named roles | Username/SSO button; break-glass admin only if enabled | Block disabled or locked accounts; enforce MFA for privileged roles where supported | Inline error for auth failure; no stack traces | Break-glass option visible only when SSO unavailable and requestor is on allowlist |
| UI-02 | Monitoring Dashboard | Leadership, Analyst, Control Room, Supervisor | Filters: platform, district, category, priority, language, date range | Date range max 92 days for standard users; invalid filters blocked | Field-level filter validation and partial-data banner | Control Room sees critical/high widgets first; Leadership sees aggregated KPIs only |
| UI-03 | Content / Alert Search | Analyst, Control Room, Supervisor, Investigator | Search query, saved search selector, results grid, actor timeline panel | Page size max 100; search scope limited by org access | Retry message for search timeout; stale filter warning | Actor merge suggestions shown only when confidence threshold met |
| UI-04 | Alert Detail Workbench | Analyst, Control Room, Supervisor | Alert header, source card, risk scorecard, legal suggestions, comments, actions | Cannot close without disposition reason; cannot share without permission | Action-specific inline validation plus toast/summary error | Translation panel shown when content language != preferred language; Control Room buttons shown for High/Critical only |
| UI-05 | Evidence Detail | Analyst, Investigator, Evidence Custodian, Supervisor | Metadata, master/preview media, hash, chain-of-custody timeline, export actions | Export blocked when status INTEGRITY_EXCEPTION or approval missing | Prominent integrity warning and blocked-action message | Legal-hold banner shown when enabled; preview hidden if sensitive-policy role restriction applies |
| UI-06 | Case Workspace | Analyst, Investigator, Supervisor, Legal Reviewer | Case header, linked alerts, tasks, evidence, notes, reports, timeline | Cannot close while open mandatory tasks or pending approvals exist | Missing-required-approval banner | Legal review tab visible only to authorized roles |
| UI-07 | Template Designer / Manager | Legal Reviewer, Platform Administrator | Template metadata, placeholders, version history, upload controls | Unique code; placeholder schema validation; approved-only production release | Inline placeholder error markers | Production release action visible only for approver roles |
| UI-08 | Report Generation and Review | Analyst, Investigator, Legal Reviewer, Supervisor | Template select, source object select, export format, draft preview | Template must be approved; source access enforced; target format limited to PDF/DOCX | Generation failed panel with retry and error ID | Approve button visible only for reviewer roles; watermark preview shown when policy requires |
| UI-09 | Administration Console | Platform Administrator | Users, roles, units, taxonomies, legal rules, risk weights, connectors, feature flags | Strict server-side validation for all config objects | Field-level validation plus change-summary modal | Production promotion hidden until UAT approval present |
| UI-10 | Audit and Access Review | Security Auditor, Platform Administrator, Evidence Custodian (limited) | Audit filters, access-review reports, export | Date range max 365 days per query unless batch export | No details shown beyond user scope | Evidence-specific logs visible to Custodian; full logs visible to Auditor/Admin |
| UI-11 | MIS and Leadership Dashboard | Leadership, Supervisor, Auditor | Report widgets, trend charts, district comparison, export | Read-only; no operational edits | If source data stale, show last refreshed timestamp | Leadership sees no PII beyond approved summary level |
| UI-12 | Operational Health Dashboard | Platform Administrator, Department IT, Vendor Support (if approved) | Connector health, queue depth, failures, certificate expiry, storage usage | Only system roles can acknowledge incidents | Severity banner and recommended action | Vendor support access hidden unless explicitly enabled |

## 12. Reporting & Analytics
| Report ID | Report Name | Data Source | Filters | Aggregations | Export Formats |
|---|---|---|---|---|---|
| RPT-01 | Daily Alert Summary | Alert, AlertAction, OrganizationUnit | Date, platform, district, priority, category | Counts by priority/status; ageing buckets | PDF, XLSX, CSV |
| RPT-02 | SLA Breach Report | Alert, AlertAction, UserAccount | Date, owner unit, priority, alert status | Breach count, avg delay, breach trend | PDF, XLSX, CSV |
| RPT-03 | Platform Trend Report | ContentItem, Alert | Platform, date range, category | Posts monitored, alerts generated, virality trend | PDF, XLSX, CSV |
| RPT-04 | Category Heat Map | Alert, TaxonomyCategory, OrganizationUnit | District, category, date range | Counts by district/category | PDF, PNG, XLSX |
| RPT-05 | Case Progress Report | CaseRecord, CaseTask, ReportInstance | Owner unit, assignee, status, date range | Open/closed cases, stage ageing, pending reviews | PDF, XLSX, CSV |
| RPT-06 | Evidence Export Register | EvidenceItem, AuditLog | Date, case, exported by, evidence status | Export count, legal hold count, integrity exceptions | PDF, XLSX, CSV |
| RPT-07 | False Positive Quality Report | Alert, AlertAction, TaxonomyCategory | Category, language, date range | False-positive rate, override rate | PDF, XLSX, CSV |
| RPT-08 | User Activity and Access Report | AuditLog, UserAccount, Role | User, role, date range, action | Login count, privileged actions, failed logins | PDF, XLSX, CSV |
| RPT-09 | Connector Health Report | SourceConnector, AuditLog | Platform, date range | Success rate, retry count, downtime duration | PDF, XLSX, CSV |
| RPT-10 | Leadership Executive Brief | Alert, CaseRecord, EvidenceItem, ReportInstance | Date range, district, category | Critical trend, top districts, top categories, closure summary | PDF, PPTX-ready summary, XLSX |

## 13. Audit & Logging
| Audit ID | Log Domain | What is Logged | Who Can View Logs | Retention Period |
|---|---|---|---|---|
| AUD-01 | Authentication and access events | Login success/failure, logout, MFA challenge, token refresh, access denied | Security Auditor, Platform Administrator | 7 years |
| AUD-02 | Alert workflow events | Create, view, acknowledge, assign, escalate, share, suppress, close, reopen | Security Auditor, Platform Administrator, Supervisor (scoped) | 7 years |
| AUD-03 | Evidence lifecycle events | Capture, verify, hash check, export, legal hold, release, purge | Evidence Custodian, Security Auditor, Platform Administrator | 7 years or legal hold release |
| AUD-04 | Case and task events | Case create/update/assign/close/reopen; task create/update/complete | Supervisor, Security Auditor, Platform Administrator | 7 years |
| AUD-05 | Report and template events | Template create/version/release, report generate/review/export/supersede | Legal Reviewer, Security Auditor, Platform Administrator | 7 years |
| AUD-06 | Administrative configuration changes | Role/user/unit changes, taxonomy, legal rules, thresholds, connectors, feature flags | Security Auditor, Platform Administrator | 7 years |
| AUD-07 | Integration and system events | Connector failures, queue backlog, retry exhaustion, certificate expiry, health incidents | Platform Administrator, Department IT, Security Auditor | 3 years |
| AUD-08 | Retention and purge events | Retention policy change, purge approval, purge execution, purge failure | Security Auditor, Platform Administrator, Evidence Custodian | 7 years |

## 14. Test Case Derivation Section
| Test Case ID | Test Scenario | Expected Result |
|---|---|---|
| TC-FR-01-01 | Deploy UAT and Production separately and promote an approved configuration package | UAT and Production remain isolated; promotion succeeds only with approval and creates audit entries |
| TC-FR-02-01 | Attempt cross-district alert access with non-authorized analyst | Access is denied, event is logged, and no alert data is disclosed |
| TC-FR-03-01 | Ingest a source batch containing valid, duplicate, and malformed items | Valid items are accepted, duplicates are counted, malformed items are rejected with reasons, and raw payload is retained |
| TC-FR-04-01 | Run dashboard for Control Room role with Critical alert backlog | Only Control Room widgets and urgent queue actions are shown; SLA countdown is visible |
| TC-FR-05-01 | Process multilingual post containing slang term and embedded image text | Slang is matched, OCR/transcript text is searchable if enabled, and match evidence is displayed |
| TC-FR-06-01 | Classify a post that matches two narcotics categories with medium confidence | System returns schema-valid multi-category output, stores model/prompt version, and marks item NEEDS_REVIEW if below threshold |
| TC-FR-07-01 | Recalculate risk score after virality metrics spike for an existing alert | Risk score updates, factor contributions are visible, and alert priority changes according to thresholds |
| TC-FR-08-01 | Generate legal mapping for categorized content and attempt export before reviewer approval | Legal references are suggested, but export remains blocked until authorized approval |
| TC-FR-09-01 | Request translation for unsupported language content | Original content remains visible, translation record is created with status UNSUPPORTED, and user receives a clear message |
| TC-FR-10-01 | Escalate a Critical alert via approved sharing channel | Alert status updates, secure share is queued/sent, watermark policy is applied, and action is fully audit logged |
| TC-FR-11-01 | Capture evidence from a post containing image and video components | Evidence reference number, metadata, hashes, and custody record are created; partial failures are flagged if any component fails |
| TC-FR-12-01 | Create a case from multiple alerts and close it with pending task | System blocks closure until mandatory task/approval conditions are satisfied |
| TC-FR-13-01 | Create template version, approve it, and generate report export | Only approved version is usable; generated report preserves reference numbers and exports in selected format |
| TC-FR-14-01 | Promote revised legal rule set from UAT to Production with overlapping effective dates | Validation blocks promotion until overlap is resolved and logs the failed attempt |
| TC-FR-15-01 | Trigger notification gateway outage during secure share | System retries per policy, records failure/DLQ status, and offers configured fallback channel |
| TC-FR-16-01 | Simulate audit-log storage failure during evidence export | Export fails closed, severity-1 operational alert is raised, and no evidence is released |
| TC-FR-17-01 | Attempt to export AI-generated legal draft without approval | Export is denied and draft remains labeled as DRAFT |
| TC-FR-18-01 | Verify delivery artifacts at go-live readiness checkpoint | Infrastructure BOM, training sign-off, hypercare roster, and warranty baseline are all present before acceptance |

## 15. Implementation Guidance for AI Development
### 15.1 Suggested reference implementation stack
| Architecture ID | Layer | Suggested Baseline |
|---|---|---|
| ARC-01 | Frontend | React / Next.js with TypeScript, TanStack Query, form validation library, component library with RBAC-aware route guards |
| ARC-02 | Backend API | FastAPI (Python) or NestJS (Node.js/TypeScript) with OpenAPI-first contracts |
| ARC-03 | Workflow Engine | Temporal or Camunda/Zeebe for alert, evidence, and report approval workflows |
| ARC-04 | Relational Database | PostgreSQL for transactional data and configuration |
| ARC-05 | Search / Analytics Index | OpenSearch or Elasticsearch-compatible engine for content, alert, and actor search |
| ARC-06 | Object Storage | S3-compatible storage with immutable/WORM option for master evidence |
| ARC-07 | Eventing / Queue | Kafka, RabbitMQ, or cloud-native queue for ingestion, classification, notification, and export jobs |
| ARC-08 | Observability | OpenTelemetry-compatible traces, metrics, and centralized logs |

### 15.2 Suggested microservices boundaries
| Service ID | Service Name | Responsibility | Primary Storage / Dependency |
|---|---|---|---|
| SVC-01 | identity-access-service | User sync, role resolution, auth scopes, session policy, MFA hooks | PostgreSQL (master) |
| SVC-02 | source-ingestion-service | Connector orchestration, raw payload receipt, normalization, dedupe, entitlement checks | PostgreSQL (ingest) + object store |
| SVC-03 | content-intelligence-service | Keyword/slang matching, OCR/transcript orchestration, entity extraction, AI categorization | Queue + model provider + search index |
| SVC-04 | risk-prioritization-service | Risk scoring, thresholds, priority bands, recalculation events | PostgreSQL (workflow) |
| SVC-05 | legal-mapping-service | Rule evaluation, legal hints, reviewer workflow, legal draft preparation | PostgreSQL (config/workflow) |
| SVC-06 | alert-workflow-service | Alert lifecycle, SLA timers, assignments, escalations, comments | Workflow engine + PostgreSQL |
| SVC-07 | case-management-service | Case record, tasks, timelines, links to alerts/evidence/reports | PostgreSQL (workflow) |
| SVC-08 | evidence-service | Capture, hashing, custody logs, legal hold, packaging, export | Object store + PostgreSQL (evidence) |
| SVC-09 | reporting-service | Template management, report generation, MIS aggregations, export jobs | PostgreSQL (reporting) + object store |
| SVC-10 | notification-integration-service | WhatsApp/email/SMS, SIEM forwarding, webhook delivery, DLQ handling | Queue + PostgreSQL |
| SVC-11 | config-governance-service | Taxonomy, slang dictionary, legal rules, risk weights, feature flags, promotion workflow | PostgreSQL (config) |
| SVC-12 | audit-observability-service | Audit logs, operational metrics, health status, retention jobs | PostgreSQL (audit) + metrics store |

### 15.3 Suggested DB schema groupings
| Schema ID | Schema | Tables / Purpose |
|---|---|---|
| SCH-01 | master | organization_unit, user_account, role, user_role, watchlist, saved_search |
| SCH-02 | config | taxonomy_category, legal_mapping_rule, report_template, connector_config, feature_flag |
| SCH-03 | ingest | source_connector, raw_ingest_batch, content_item, content_media |
| SCH-04 | workflow | alert, alert_action, case_record, case_task, workflow_timer |
| SCH-05 | evidence | evidence_item, evidence_export, legal_hold, custody_event |
| SCH-06 | reporting | report_instance, report_job, materialized_kpi tables |
| SCH-07 | audit | audit_log, access_review, retention_job_log |
| SCH-08 | search/index | content_search, alert_search, actor_search projections in OpenSearch/Elasticsearch-compatible engine |

### 15.4 Suggested frontend module breakdown
| Module ID | Module | Responsibility |
|---|---|---|
| MOD-01 | app-shell | Auth shell, layout, navigation, session handling |
| MOD-02 | monitoring | Dashboard, search, saved searches, actor timeline |
| MOD-03 | alerts | Alert list/detail, comments, escalation, SLA indicators |
| MOD-04 | evidence | Evidence detail, package builder, custody timeline |
| MOD-05 | cases | Case workspace, tasks, related objects, closure workflow |
| MOD-06 | reports | Template manager, draft preview, report review/export |
| MOD-07 | admin | Users, roles, units, taxonomy, legal rules, risk config, connectors |
| MOD-08 | audit-ops | Audit explorer, health dashboard, access review |

### 15.5 Suggested API grouping
| Tag ID | API Group | Purpose |
|---|---|---|
| TAG-01 | Auth & Identity | Session, SSO callback, user profile, role scope |
| TAG-02 | Content & Search | Content search, actor timeline, saved searches, watchlists |
| TAG-03 | Alerts | List, detail, update, escalate, share, comments |
| TAG-04 | Cases | Create, update, tasks, timeline, closure |
| TAG-05 | Evidence | Capture, verify, export, legal hold, manifest |
| TAG-06 | Reports | Template CRUD, generate, review, export |
| TAG-07 | Config | Taxonomy, rules, thresholds, promotions, connectors |
| TAG-08 | Audit & Ops | Audit logs, health metrics, retention jobs |
| TAG-09 | Integrations | Inbound ingestion, outbound notifications, webhooks |

### 15.6 Suggested folder structure
```text
backend/
  apps/
    api-gateway/
    identity-access-service/
    source-ingestion-service/
    content-intelligence-service/
    risk-prioritization-service/
    legal-mapping-service/
    alert-workflow-service/
    case-management-service/
    evidence-service/
    reporting-service/
    notification-integration-service/
    config-governance-service/
    audit-observability-service/
  packages/
    domain-models/
    shared-auth/
    shared-events/
    shared-validation/
    shared-logging/
  infra/
    docker/
    helm/
    terraform/
    workflows/
    sql/
frontend/
  app/
    monitoring/
    alerts/
    evidence/
    cases/
    reports/
    admin/
    audit-ops/
  components/
  lib/
  api/
  tests/
data/
  seed/
  taxonomy/
  legal-rules/
  report-templates/
docs/
  openapi/
  workflows/
  architecture/
```

### 15.7 Prompt Engineering Notes
- **PRM-01**: Classification prompt input must include normalized text, OCR text, transcript text, platform metadata, taxonomy version, and glossary version.
- **PRM-02**: Classification output must be strict JSON with categoryCodes[], confidence, rationale, riskSignals[], legalKeywords[], and schemaVersion.
- **PRM-03**: Prompts must explicitly forbid unsupported legal citations, autonomous punitive recommendations, and output outside the defined JSON schema.
- **PRM-04**: All prompts, model versions, and retrieval context IDs must be stored on the resulting classification/report object.
- **PRM-05**: Use retrieval-grounded prompts for legal mapping and template generation; do not allow the model to invent law names, sections, or template clauses.
- **PRM-06**: Provide fallback deterministic rules-only path for categorization and triage if model provider is unavailable.
- **PRM-07**: Maintain benchmark datasets for multilingual slang, image-heavy posts, adversarial content, and false-positive review.

## Appendix A. Gap Analysis Matrix
| RFP Clause | Present in BRD? (Y/N) | Gap Description | Required Enhancement |
|---|---|---|---|
| RFP-OBJ-01 - Cross-platform monitoring capability | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-OBJ-02 - AI-based content categorization | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-OBJ-03 - Risk scoring and prioritization | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-OBJ-04 - Legal section mapping | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-OBJ-05 - Digital evidence preservation | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-OBJ-06 - Real-time alerts and escalation | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-TEC-01 - Licensed production-ready platform | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-TEC-02 - Scalable architecture for district-level expansion | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-TEC-03 - Deployment in Telangana State Data Centre or Government-approved cloud | Y | Hosting target is present, but infrastructure bill of materials, environment separation, network/security zones, and deployment prerequisites are absent. | Add deployment architecture baseline, infrastructure specification table, and environment prerequisites. |
| RFP-TEC-04 - Separate Production and UAT environments | Y | Separate environments are mentioned, but promotion controls, masking rules, and release gates are absent. | Add UAT to Production promotion workflow, data masking requirements, and release approval gates. |
| RFP-TEC-05 - Secure domain and SSL setup | Y | Secure domain and SSL are stated, but certificate management, TLS policy, and renewal monitoring are absent. | Add TLS version policy, certificate lifecycle controls, expiry alerting, and fail-safe renewal requirements. |
| RFP-TEC-06 - Role-based access control | Y | RBAC is present, but the role-permission model, approval boundaries, and organization hierarchy are not normalized into implementation entities. | Add role catalog, permission levels, organization hierarchy rules, and API authorization scope matrix. |
| RFP-MON-01 - Integration/workflows for X/Twitter, Instagram, Facebook, YouTube, Reddit | Y | Supported platforms are listed, but connector acquisition mode, lawful-source assumptions, rate-limit handling, retry behavior, and onboarding artifacts are not specified. | Add source connector specification, acquisition mode per platform, rate-limit controls, retries, dead-letter handling, and source entitlement tracking. |
| RFP-MON-02 - Unified cross-platform monitoring dashboard | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-MON-03 - Aggregated user activity tracking | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-MON-04 - Detect narcotics-related keywords, slang, and coded communication | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-MON-05 - Support multilingual content | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-MON-06 - Separate dashboards for Intelligence Wing and Control Room | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-MON-07 - Logical navigation and structured dashboard tabs | N | The draft BRD references dashboards but does not define screen layout intent, structured tabs, navigation model, conditional widgets, or role-wise UI behavior. | Add explicit UI/UX screen catalog with navigation structure, tab definitions, role visibility, field validations, and conditional rendering rules. |
| RFP-AI-01 - Automatically classify content into predefined narcotics-related categories | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-AI-02 - Contextual analysis of text and images | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-AI-03 - Consistent categorization for downstream legal mapping | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-AI-04 - LLM-based intelligent classification | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RSK-01 - Dynamic risk scoring using severity, frequency, virality/engagement, historical behavior | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RSK-02 - Escalation-aware scoring | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RSK-03 - Analyst-reviewable risk indicators | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RSK-04 - Learn from historical complaint data | Y | Historical complaint-data learning is mentioned, but data ingestion format, feedback loop, retraining cadence, and approval controls are not specified. | Add model-operations controls for training data intake, approval workflow, versioning, benchmark metrics, and rollback. |
| RFP-RSK-05 - Background retraining of legal rule engine without modifying LLM core | Y | Rule-engine retraining independence from the LLM core is mentioned, but the separation-of-concerns architecture is not defined. | Add an explicit architecture rule that legal/risk rules run as a versioned configuration layer separate from model weights and prompts. |
| RFP-LEG-01 - Map categorized content to relevant provisions under Bharatiya Nyaya Sanhita | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LEG-02 - Support rule-based and data-driven legal updates | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LEG-03 - Display legal references clearly in alert cards | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LEG-04 - Generate legally structured investigation-ready reports | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LNG-01 - Automatically detect language | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LNG-02 - Single-click translation per alert | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LNG-03 - Translation on user demand | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-LNG-04 - Preserve original content integrity | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-ALT-01 - Generate alerts with source attribution | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-ALT-02 - Display risk score and category | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-ALT-03 - Provide simplified category filters | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-ALT-04 - Enable WhatsApp sharing for rapid escalation | Y | WhatsApp sharing is stated, but the approved channel, security controls, watermarking, approval rules, and fallback path are not defined. | Add a secure sharing requirement specifying approved gateway, watermarking, audit logging, approval thresholds, and fallback notifications. |
| RFP-ALT-05 - Maintain audit logs of alert actions | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-EVD-01 - Enable download/capture of posts, retweets, images, and videos | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-EVD-02 - Support multiple media formats | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-EVD-03 - Preserve metadata and timestamps | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-EVD-04 - Provide highlighted reference numbers | Y | Reference numbers are required, but the numbering pattern, uniqueness scope, and usage across evidence/report exports are not defined. | Define reference-number generation rules, prefixes, uniqueness constraints, visibility rules, and cross-reference propagation into reports. |
| RFP-EVD-05 - Maintain secure audit trail | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-EVD-06 - Prevent accidental modifications via confirmation prompts | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-01 - Dynamic report template creation | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-02 - Upload and version custom templates | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-03 - Provide structured narcotics investigation reports | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-04 - Export in standard formats such as PDF and DOC | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-05 - Ensure visibility of reference numbers | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-06 - Provide MIS reports as per Department requirement | Y | MIS reporting is mentioned, but no report inventory, filter set, aggregation logic, cadence, or export schema is defined. | Add a structured reporting catalog with report IDs, sources, filters, aggregation logic, and export formats. |
| RFP-RPT-07 - Role-based access system | Y | Requirement exists in the draft BRD at feature level, but is not expressed with atomic acceptance criteria, explicit data structures, workflow states, API contracts, or test cases. | Convert to structured requirement IDs, add measurable acceptance criteria, business rules, error handling, UI behavior, entity definitions, and API/state references. |
| RFP-RPT-08 - Scalable and customizable as per Department needs | Y | Scalability and customization are stated at a narrative level without concrete configuration boundaries or extension rules. | Add configurable taxonomy, rules, templates, workflow, organization hierarchy, and feature-flag controls with promotion workflow. |
| RFP-NTE-01 - Solution shall be owned by EAGLE Force Telangana | N | Department ownership of the solution is not clearly stated in the draft BRD. | Add IP/data ownership, source-code/configuration ownership, and handover/export obligations. |
| RFP-NTE-02 - Bidder shall inform infrastructure required for hosting the solution | N | Infrastructure disclosure by the bidder is not explicitly structured as a required deliverable. | Add a mandatory hosting infrastructure specification artifact with hardware, software, OS, network, storage, and sizing details. |
| RFP-NTE-03 - One-year warranty including maintenance and upgradations | N | Warranty including maintenance and upgrades is not captured as a measurable obligation. | Add support window, maintenance scope, upgrade coverage, defect severity definitions, and acceptance service levels. |
| RFP-NTE-04 - Training for Department officials | Y | Training is mentioned generically but without curriculum, audience, completion criteria, or handover artifacts. | Add role-based training plan, training outputs, attendance/sign-off requirements, and hypercare support obligations. |
| RFP-NTE-05 - Deploy 1-2 technical manpower for 2 weeks post deployment | N | The required 1-2 technical support personnel for 2 weeks post deployment are absent from the draft BRD. | Add hypercare staffing, support roster, duty timings, and escalation responsibilities. |
| RFP-NTE-06 - ATS may be obtained after one year if required | N | Optional ATS after warranty is not reflected. | Add a post-warranty support transition note and data/configuration portability requirements. |
| RFP-DEL-01 - Delivery within 6 weeks from Purchase Order | N | No explicit six-week delivery milestone exists in the draft BRD. | Add implementation schedule baseline with D+42 delivery milestone and associated acceptance gates. |
| RFP-DEL-02 - Installation within 1 week | N | Installation duration and site-readiness handling are not explicit. | Add installation milestone, site-not-ready exception flow, and completion criteria. |
| RFP-PAY-01 - 80 percent on delivery and successful installation; 20 percent after satisfactory performance report at 60 days | N | Payment milestones are procurement terms, not current system requirements. | Reference milestone-linked acceptance artifacts in the implementation appendix so finance and implementation remain aligned. |
| RFP-PEN-01 - Liquidated damages for delay up to 10 percent; cancellation if delay exceeds 30 days | N | Delay penalties are procurement terms, not system requirements. | Retain as contractual dependency and align implementation milestones to avoid ambiguity. |
| RFP-WAR-01 - Minimum 1 year comprehensive onsite warranty on the entire solution | N | The one-year onsite warranty commitment is not expressed as a tracked obligation. | Add warranty coverage, service levels, break/fix obligations, and defect closure commitments. |
| RFP-PROC-01 - Bid validity, fee, EMD, and document submission conditions | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |
| RFP-PROC-02 - Bidder legal eligibility, MAF, experience, turnover, certifications, local office, staffing | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |
| RFP-PROC-03 - No consortium and no subcontracting | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |
| RFP-PROC-04 - Bid evaluation process, technical presentation, L1 commercial evaluation | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |
| RFP-PROC-05 - Performance Bank Guarantee of 5 percent | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |
| RFP-PROC-06 - Contract execution, force majeure, notices, taxes, governing law | N | Procurement/commercial clause is outside the draft BRD scope and therefore not traceable from system requirements. | Retain in a contractual obligations register and mark as non-solution requirement so that it is not lost during implementation governance. |

## Appendix B. RFP Traceability Matrix
| RFP Clause ID | Clause Summary | Clause Type | Disposition in Refined BRD | Refined BRD Reference(s) | Implementation Note |
|---|---|---|---|---|---|
| RFP-OBJ-01 | Cross-platform monitoring capability | Solution | Implemented | FR-03, FR-04, ENT-04, ENT-05, INT-01..INT-05 | Source connector registry, dashboard, saved-search/watchlist model |
| RFP-OBJ-02 | AI-based content categorization | Solution | Implemented | FR-06, ENT-07, API-02, PRM-01..PRM-04 | AI classification service and taxonomy |
| RFP-OBJ-03 | Risk scoring and prioritization | Solution | Implemented | FR-07, ENT-08, WF-ALT-01, NFR-01..NFR-05 | Risk engine and SLA-driven queueing |
| RFP-OBJ-04 | Legal section mapping | Solution | Implemented | FR-08, ENT-13, ENT-14, API-10, WF-RPT-01 | Legal rule engine and reviewer approval |
| RFP-OBJ-05 | Digital evidence preservation | Solution | Implemented | FR-11, ENT-10, WF-EVD-01, AUD-03 | Evidence service, hashing, custody |
| RFP-OBJ-06 | Real-time alerts and escalation | Solution | Implemented | FR-10, FR-12, API-05, WF-ALT-01 | Alert escalation and workflow controls |
| RFP-TEC-01 | Licensed production-ready platform | Solution | Implemented | FR-01, NFR-14, FR-18 | Licensed production deployment baseline |
| RFP-TEC-02 | Scalable architecture for district-level expansion | Solution | Implemented | FR-01, FR-18, NFR-06, NFR-14 | Scale-out baseline and district rollout assumption |
| RFP-TEC-03 | Deployment in Telangana State Data Centre or Government-approved cloud | Solution | Implemented | FR-01, FR-18, INT-09, CMP-09 | Government hosting and infra BOM |
| RFP-TEC-04 | Separate Production and UAT environments | Solution | Implemented | FR-01, FR-14 | Environment separation and promotion control |
| RFP-TEC-05 | Secure domain and SSL setup | Solution | Implemented | FR-01, FR-15, FR-17, NFR-09 | TLS and certificate control |
| RFP-TEC-06 | Role-based access control | Solution | Implemented | FR-02, ENT-01..ENT-03, UI-01, CMP-04 | RBAC and org hierarchy |
| RFP-MON-01 | Integration/workflows for X/Twitter, Instagram, Facebook, YouTube, Reddit | Solution | Implemented | FR-03, INT-01..INT-05, API-01 | Platform connector onboarding |
| RFP-MON-02 | Unified cross-platform monitoring dashboard | Solution | Implemented | FR-04, UI-02, UI-03, API-02 | Unified monitoring dashboard |
| RFP-MON-03 | Aggregated user activity tracking | Solution | Implemented | FR-04, ENT-05, API-02 | Aggregated actor timeline and content search |
| RFP-MON-04 | Detect narcotics-related keywords, slang, and coded communication | Solution | Implemented | FR-05, FR-14, ENT-05, ENT-06 | Keyword/slang detection and config governance |
| RFP-MON-05 | Support multilingual content | Solution | Implemented | FR-03, FR-05, FR-09, ENT-05, ENT-15 | Multilingual ingestion and translation |
| RFP-MON-06 | Separate dashboards for Intelligence Wing and Control Room | Solution | Implemented | FR-04, FR-02, UI-02 | Role-specific dashboard views |
| RFP-MON-07 | Logical navigation and structured dashboard tabs | Solution | Implemented | FR-04, UI-02..UI-12 | Explicit screen/navigation catalog |
| RFP-AI-01 | Automatically classify content into predefined narcotics-related categories | Solution | Implemented | FR-06, ENT-07 | Category master and classifier |
| RFP-AI-02 | Contextual analysis of text and images | Solution | Implemented | FR-05, FR-06, ENT-06 | Text+image contextual pipeline |
| RFP-AI-03 | Consistent categorization for downstream legal mapping | Solution | Implemented | FR-06, FR-08, ENT-07 | Taxonomy versioning and downstream legal consistency |
| RFP-AI-04 | LLM-based intelligent classification | Solution | Implemented | FR-06, INT-10, PRM-01..PRM-07 | LLM-assisted classification |
| RFP-RSK-01 | Dynamic risk scoring using severity, frequency, virality/engagement, historical behavior | Solution | Implemented | FR-07, ENT-08, NFR-05 | Score factors and priority bands |
| RFP-RSK-02 | Escalation-aware scoring | Solution | Implemented | FR-07, WF-ALT-01 | Escalation-aware thresholds |
| RFP-RSK-03 | Analyst-reviewable risk indicators | Solution | Implemented | FR-07, UI-04 | Explainable scorecard |
| RFP-RSK-04 | Learn from historical complaint data | Solution | Implemented | FR-06, FR-07, CQ-11 | Historical data feedback loop |
| RFP-RSK-05 | Background retraining of legal rule engine without modifying LLM core | Solution | Implemented | FR-06, FR-08, FR-14, API-12 | Rule-layer separation from LLM core |
| RFP-LEG-01 | Map categorized content to relevant provisions under Bharatiya Nyaya Sanhita | Solution | Implemented | FR-08, ENT-13, ENT-14, CMP-01 | BNS legal mapping |
| RFP-LEG-02 | Support rule-based and data-driven legal updates | Solution | Implemented | FR-08, FR-14, API-12 | Versioned legal rules |
| RFP-LEG-03 | Display legal references clearly in alert cards | Solution | Implemented | FR-08, UI-04, ENT-14 | Legal references on alert cards |
| RFP-LEG-04 | Generate legally structured investigation-ready reports | Solution | Implemented | FR-08, FR-13, WF-RPT-01, UI-08 | Investigation-ready drafts with approval |
| RFP-LNG-01 | Automatically detect language | Solution | Implemented | FR-09, ENT-05, ENT-15 | Language detection |
| RFP-LNG-02 | Single-click translation per alert | Solution | Implemented | FR-09, API-06, UI-04/UI-08 | Single-click translation |
| RFP-LNG-03 | Translation on user demand | Solution | Implemented | FR-09, API-06 | On-demand translation |
| RFP-LNG-04 | Preserve original content integrity | Solution | Implemented | FR-09, ENT-15 | Original/translation separation |
| RFP-ALT-01 | Generate alerts with source attribution | Solution | Implemented | FR-10, ENT-08, API-03 | Alert generation with source attribution |
| RFP-ALT-02 | Display risk score and category | Solution | Implemented | FR-10, ENT-08, UI-04 | Risk score and category display |
| RFP-ALT-03 | Provide simplified category filters | Solution | Implemented | FR-10, UI-02/UI-03 | Category and priority filters |
| RFP-ALT-04 | Enable WhatsApp sharing for rapid escalation | Solution | Implemented | FR-10, FR-15, API-05, API-14, INT-07 | Approved rapid sharing |
| RFP-ALT-05 | Maintain audit logs of alert actions | Solution | Implemented | FR-10, FR-16, ENT-09, ENT-19, API-13 | Alert action auditability |
| RFP-EVD-01 | Enable download/capture of posts, retweets, images, and videos | Solution | Implemented | FR-11, API-07, ENT-10 | Evidence capture |
| RFP-EVD-02 | Support multiple media formats | Solution | Implemented | FR-11, ENT-06, ENT-10, INT-09 | Multi-format storage |
| RFP-EVD-03 | Preserve metadata and timestamps | Solution | Implemented | FR-11, ENT-10 | Metadata and timestamps |
| RFP-EVD-04 | Provide highlighted reference numbers | Solution | Implemented | FR-11, ENT-08, ENT-10, FR-13 | Reference numbering |
| RFP-EVD-05 | Maintain secure audit trail | Solution | Implemented | FR-11, FR-16, AUD-03, ENT-19 | Secure trail and custody |
| RFP-EVD-06 | Prevent accidental modifications via confirmation prompts | Solution | Implemented | FR-11, UI-05 | Confirmation and protected actions |
| RFP-RPT-01 | Dynamic report template creation | Solution | Implemented | FR-13, API-11, ENT-16 | Template creation |
| RFP-RPT-02 | Upload and version custom templates | Solution | Implemented | FR-13, ENT-16, API-11 | Template upload and versioning |
| RFP-RPT-03 | Provide structured narcotics investigation reports | Solution | Implemented | FR-08, FR-13, ENT-17 | Structured investigation reports |
| RFP-RPT-04 | Export in standard formats such as PDF and DOC | Solution | Implemented | FR-13, API-10, ENT-17 | PDF/DOCX export |
| RFP-RPT-05 | Ensure visibility of reference numbers | Solution | Implemented | FR-13, ENT-17 | Reference numbers in report outputs |
| RFP-RPT-06 | Provide MIS reports as per Department requirement | Solution | Implemented | FR-13, RPT-01..RPT-10 | MIS catalog |
| RFP-RPT-07 | Role-based access system | Solution | Implemented | FR-02, FR-16, ENT-01..ENT-03 | Role-based access |
| RFP-RPT-08 | Scalable and customizable as per Department needs | Solution | Implemented | FR-14, FR-18, NFR-16 | Scalable/customizable configuration |
| RFP-NTE-01 | Solution shall be owned by EAGLE Force Telangana | Contractual/Implementation | Implemented | FR-18, NFR-19, CMP-08 | Ownership and portability |
| RFP-NTE-02 | Bidder shall inform infrastructure required for hosting the solution | Contractual/Implementation | Implemented | FR-18, CNI-03, CMP-09 | Infrastructure specification artifact |
| RFP-NTE-03 | One-year warranty including maintenance and upgradations | Contractual/Implementation | Implemented | FR-18, AUD-07, CMP-10 | Warranty + maintenance/upgrades |
| RFP-NTE-04 | Training for Department officials | Contractual/Implementation | Implemented | FR-18 | Training and handover |
| RFP-NTE-05 | Deploy 1-2 technical manpower for 2 weeks post deployment | Contractual/Implementation | Implemented | FR-18 | Two-week hypercare staffing |
| RFP-NTE-06 | ATS may be obtained after one year if required | Contractual/Implementation | Implemented | FR-18, CQ-15 | ATS transition note |
| RFP-DEL-01 | Delivery within 6 weeks from Purchase Order | Contractual/Implementation | Implemented | FR-18 | D+42 delivery milestone |
| RFP-DEL-02 | Installation within 1 week | Contractual/Implementation | Implemented | FR-18 | D+49 installation milestone |
| RFP-PAY-01 | 80 percent on delivery and successful installation; 20 percent after satisfactory performance report at 60 days | Contractual/Procurement | Tracked as contractual appendix | FR-18 | Milestone evidence aligned to payment release |
| RFP-PEN-01 | Liquidated damages for delay up to 10 percent; cancellation if delay exceeds 30 days | Contractual/Procurement | Tracked as contractual appendix | FR-18 | Delivery milestones aligned to LD risk control |
| RFP-WAR-01 | Minimum 1 year comprehensive onsite warranty on the entire solution | Contractual/Implementation | Implemented | FR-18, CMP-10 | Warranty baseline |
| RFP-PROC-01 | Bid validity, fee, EMD, and document submission conditions | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |
| RFP-PROC-02 | Bidder legal eligibility, MAF, experience, turnover, certifications, local office, staffing | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |
| RFP-PROC-03 | No consortium and no subcontracting | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |
| RFP-PROC-04 | Bid evaluation process, technical presentation, L1 commercial evaluation | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |
| RFP-PROC-05 | Performance Bank Guarantee of 5 percent | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |
| RFP-PROC-06 | Contract execution, force majeure, notices, taxes, governing law | Procurement-only | Not a solution requirement | Traceability Appendix - procurement register | Retained as procurement governance input |

## Appendix C. Clarification Questions
- **CQ-01**: What lawful acquisition mode is approved for each supported platform at go-live: official API, approved third-party feed, manual import, or another sanctioned mechanism?
- **CQ-02**: Which languages and scripts are mandatory on day 1 for monitoring, translation, and report output: English, Telugu, Hindi, Urdu, Romanized Telugu/Hindi, or others?
- **CQ-03**: What is the expected day-1 named-user count, concurrent-user load, and district rollout sequence so that final infrastructure sizing can be confirmed?
- **CQ-04**: Which identity standard must be used at go-live: OIDC, SAML 2.0, LDAP/AD, or a hybrid model?
- **CQ-05**: Which WhatsApp or secure mobile sharing mechanism is officially approved for operational use?
- **CQ-06**: What retention policy applies to source content, alerts, evidence, generated reports, and audit logs if different from the seven-year baseline assumed here?
- **CQ-07**: Is immutable/WORM-capable storage mandatory for master evidence copies, or is write-protected object storage sufficient?
- **CQ-08**: Which Department-approved legal frameworks beyond Bharatiya Nyaya Sanhita must be enabled in Phase 1?
- **CQ-09**: What specific report templates are mandatory at go-live: intelligence note, preliminary inquiry summary, evidence annexure, district MIS pack, or others?
- **CQ-10**: Should the platform integrate with an existing case-management, FIR, document-management, or correspondence system in Phase 1?
- **CQ-11**: What historical complaint or prior-case dataset will be made available for tuning, and in what structure/quality level?
- **CQ-12**: What approval hierarchy is required for external sharing, legal-text approval, evidence release, and purge actions?
- **CQ-13**: What confidence threshold should govern cross-platform actor matching, and when should users be allowed to manually merge actor records?
- **CQ-14**: Does the Department require bilingual UI, bilingual reports only, or English UI with multilingual content support?
- **CQ-15**: What level of Department ownership is expected for source code, trained prompts/configuration, deployment scripts, and reusable templates/rules?
