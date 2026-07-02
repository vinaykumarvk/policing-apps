# Policing Intelligence Platform — Project Summary

> **Two flagship applications for modern law enforcement intelligence operations:**
> DOPAMS (Drug Offenders Profiling, Analysis & Monitoring System) and the Social Media Monitoring & Intelligence Platform.

---

## Table of Contents

- [Part A — DOPAMS](#part-a--dopams)
  - [1. Overview](#a1-overview)
  - [2. Main Features](#a2-main-features)
  - [3. Technical Architecture](#a3-technical-architecture)
  - [4. Benefits for the Police Department](#a4-benefits-for-the-police-department)
- [Part B — Social Media Intelligence Platform](#part-b--social-media-intelligence-platform)
  - [1. Overview](#b1-overview)
  - [2. Main Features](#b2-main-features)
  - [3. Technical Architecture](#b3-technical-architecture)
  - [4. Benefits for the Police Department](#b4-benefits-for-the-police-department)

---
---

# Part A — DOPAMS

## A1. Overview

**Drug Offenders Profiling, Analysis & Monitoring System**

DOPAMS is a comprehensive narcotics intelligence platform purpose-built for the Telangana EAGLE Force narcotics unit. It consolidates criminal records, telecom data, financial intelligence, legal status, and monitored digital content into a single, secure operational system — replacing fragmented manual workflows with an evidence-backed, human-review-driven operating model.

The platform ingests data from authorised government and law-enforcement sources (CCTNS, NDPS, eCourts, CDR/IPDR, eSakshya), builds rich 54-column intelligence profiles on drug offenders, and routes alerts, leads, and cases through role-based approval workflows. On-premises AI assists with document classification, entity extraction, and natural-language querying — all under strict model governance requiring named human approval before any AI output reaches operational use.

---

## A2. Main Features

### Identity, Access Control & Audit

- **Role-Based Access Control** — Seven defined roles (District Operator, Toll-Free Operator, Intelligence Analyst, Supervisory Officer, Zonal Officer, Investigating Officer, Administrator) with five permission levels governing data visibility and action rights.
- **Jurisdiction Scoping** — Every query automatically filters data by the officer's assigned unit (State, Zone, District, or Police Station), preventing unauthorised cross-jurisdiction access.
- **Multi-Factor Authentication** — Supports local credentials, LDAP/Active Directory single sign-on, and OIDC federated login; optional MFA at the identity-provider level.
- **Immutable Audit Trail** — Every user action — reads, writes, state transitions, exports — is permanently logged with actor identity, timestamp, IP address, and payload summary.

### Source Connectors & Data Ingestion

- **Government Source Integration** — Pre-built connectors for CCTNS (FIR records), NDPS (drug seizure data), eCourts (legal verdicts and bail updates), CDR/IPDR (telecom records), and eSakshya (evidence management).
- **Automated Ingestion Pipeline** — Scheduled polling (e.g., CCTNS every 6 hours, eCourts daily) with checksum-based deduplication, quarantine workflow for flagged payloads, and exponential-backoff retry with dead-letter queue.
- **Multi-Format Support** — Accepts PDF, images (JPG, PNG, TIFF), Office documents, CSV, JSON, XML, and ZIP archives.

### Subject Profiling & Intelligence Records

- **54-Column Intelligence Profile** — Captures personal details, physical identifiers, identity documents, contact information, financial accounts, criminal history, drug-specific intelligence (types dealt, supply chain position, territory, concealment methods), communication analysis status, and risk assessment.
- **Completeness Scoring** — Automated profile completeness calculation across 20 core fields, enabling supervisors to prioritise profiles that need enrichment.
- **PII Redaction** — Sensitive fields (Aadhaar, PAN, passport, bank details) are automatically masked for roles without explicit PII access; every access requires a recorded business justification.
- **Subject Deduplication** — Automated duplicate detection using name similarity scoring; merge operations are transactional, combining criminal history and updating all foreign-key relationships.

### Alert Management & Escalation

- **Multi-Type Alerts** — Geofence violations, watchlist hits, behavioural anomalies, legal status changes, and high-risk activity alerts, each categorised by severity (Critical, High, Medium, Low).
- **SLA-Tracked Escalation** — Unacknowledged Critical/High alerts automatically escalate to the Zonal Officer after 24 hours; configurable SLA deadlines for every alert type.
- **Task Routing** — Each alert or escalation creates an SLA-tracked task assigned to the appropriate officer role.

### Lead Management & Memo Routing

- **Multi-Channel Lead Intake** — Leads arrive via toll-free phone, WhatsApp, or field officer reports and are captured with structured metadata (source, urgency, informant contact, geolocation).
- **Investigation Workflow** — Leads progress through New → Assigned → Investigated → Closed, with duplicate detection flagging overlapping leads.
- **Memo Approval Pipeline** — Intelligence memos drafted from leads require named supervisory officer approval before dispatch, ensuring accountability at every step.

### Case Management

- **Case Lifecycle** — Cases move through Open → Under Investigation → Closed with auto-generated reference numbers.
- **Subject Linking** — Many-to-many relationships between cases and subjects, with typed roles (Subject, Witness, Supplier, Buyer, etc.).
- **Priority & District Filtering** — Officers see only cases within their jurisdiction and priority level.

### Network & Relationship Analysis

- **Entity Extraction** — Phone numbers, bank accounts, devices, vehicles, addresses, social accounts, identity documents, and organisations are normalised from ingested data.
- **Link Analysis** — Subject-to-subject relationships (Associate, Family, Gang, Co-Accused, Supplier, Buyer) with strength scoring (0–100) and evidence count.
- **Family Tree Mapping** — Dedicated family member tracking (Spouse, Sibling, Parent, Child) with dependency and involvement indicators.
- **Graph Visualisation** — Network graph projection (nodes and edges) for interactive relationship exploration in the UI.

### Natural Language Query Assistant

- **Conversational Search** — Officers type plain-language questions (e.g., "Show all subjects arrested in Hyderabad in 2025 with bail status pending") and the system generates secure, read-only SQL queries.
- **AI Provider Agnostic** — Supports OpenAI, Claude, Gemini, and on-premises Ollama; department controls which provider is active.
- **Security Safeguards** — Generated SQL is validated against a comprehensive blocklist (no DDL, no DML, no UNION, single statement only) before execution.

### Dossier & Report Generation

- **Intelligence Dossiers** — Assemble multi-section dossiers from subject profiles, criminal history, case links, financial summaries, communication analysis, and risk assessments.
- **Export Formats** — PDF (with digital watermarks, confidentiality markings, and role-based redaction) and DOCX.
- **Template Administration** — Supervisors configure report templates; field officers generate reports from pre-approved structures.

### Legal & Compliance

- **eCourts Integration** — Daily polling fetches verdicts, bail updates, and legal status changes; auto-creates alerts on status transitions.
- **Legal Section Mapping** — AI-assisted mapping of offences to IPC/NDPS sections, with mandatory named human approval.
- **Unocross Financial Requisitions** — Draft generation for financial intelligence requests with multi-step approval workflow.
- **Evidence Chain of Custody** — Immutable audit trail for all evidence access, export, and packaging (ZIP with SHA-256 manifest).

### AI Model Governance

- **Model Registry** — All AI models (classification, translation, narcotics analysis, legal reference) are registered with version, type, and performance metrics.
- **Approval Workflow** — Models progress through Draft → Validated → Active → Deprecated → Retired; promotion to Active requires sign-off from a designated Model Governance Reviewer.
- **On-Premises Only** — All inference runs on department-controlled infrastructure; no data leaves the department's network.

### Content Classification & OCR

- **Document Classification** — AI-assisted categorisation of document type, source system, and urgency.
- **OCR Processing** — Tesseract-based extraction for Telugu and English documents; low-confidence outputs are routed to a manual review queue.
- **Confidence Scoring** — Configurable threshold determines auto-approve vs. manual review.

### Monthly Report Ingestion

- **PDF Report Upload** — District-level monthly reports uploaded as PDFs.
- **KPI Extraction** — 20 key performance indicators (seizures, arrests, intelligence value, etc.) auto-extracted from report tables via OCR.
- **Central Aggregation** — District-wise trend dashboards for leadership review.

### Dashboards & Analytics

- **Control Room Dashboard** — Real-time operational view with alert counts, lead status, and case summaries.
- **Leadership Dashboard** — Executive-level KPIs, severity breakdowns, and district-wise comparisons.
- **Supervisor Dashboard** — Approval queues, escalation tracking, and SLA compliance metrics.
- **Early Warning Dashboard** — Behavioural anomaly signals and trend indicators.
- **Geo Dashboard** — Geofence alert mapping and location-based intelligence.
- **Pendency Dashboard** — Pending task and approval tracking across all workflows.
- **Drug Trend Dashboard** — Narcotics seizure trends, substance analysis, and territory mapping.
- **SLA Compliance Dashboard** — Task completion rates, breach counts, and bottleneck identification.

---

## A3. Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 6, Recharts (charts), i18next (4 languages: EN, HI, PA, TE) |
| **Backend** | Node.js 20, Fastify 5, TypeScript |
| **Database** | PostgreSQL 15 with UUID, JSONB, and full-text search (63 migrations) |
| **Authentication** | JWT (HS256 local + RS256 OIDC), LDAP/AD, optional MFA |
| **AI/ML** | Provider-agnostic LLM layer (OpenAI, Claude, Gemini, Ollama); Tesseract OCR |
| **Reports** | PDFKit (PDF generation), docx (Word generation) |
| **Validation** | Zod 4 (runtime schema validation + TypeScript inference) |
| **Containerisation** | Docker multi-stage builds (Node 20 Alpine, nginx unprivileged) |
| **Cloud Platform** | Google Cloud Run (asia-southeast1), Cloud SQL, Cloud Build CI/CD |
| **Reverse Proxy** | nginx with CSP headers, HSTS, SPA routing |

### System Architecture

DOPAMS follows a **client-server architecture** with clear separation between frontend and backend, both deployed as independent containerised services on Google Cloud Run.

- **API Server** — Stateless Fastify application with plugin-based middleware (auth, audit, rate limiting, CORS, compression). Horizontal scaling handled by Cloud Run auto-scaling (1–100 instances).
- **Frontend** — Single-page React application served via nginx. Communicates with the API exclusively through RESTful JSON endpoints.
- **Database** — Single PostgreSQL instance with connection pooling (20 max connections), SSL enforcement, and 30-second statement timeout. Migrations run automatically on container startup.
- **Shared Packages** — Reusable infrastructure libraries (`@puda/api-core` for auth/audit/logging, `@puda/api-integrations` for reports/connectors, `@puda/workflow-engine` for state machines, `@puda/shared` for schemas and UI components).

### Authentication & Authorisation

Three authentication methods — local credentials (Argon2 hashed), LDAP/Active Directory, and OIDC/SSO — all converge to issue a signed JWT stored in an HTTP-only cookie. Role-based guards enforce access at the route level, while jurisdiction filtering ensures every database query is scoped to the officer's organisational unit. Token revocation is supported both per-token (deny list) and per-user (blanket revocation timestamp).

### Data Flow

1. **Ingestion** — Scheduled connectors poll external sources → normalise data → deduplicate → store in PostgreSQL.
2. **Processing** — AI classifies documents, extracts entities, and enriches subject profiles (all with human review checkpoints).
3. **Workflow** — State machine engine manages lifecycle of subjects, leads, cases, alerts, and memos through defined transitions with role-based guards.
4. **Consumption** — Officers interact through dashboards, search, and the NL Query Assistant; supervisors review and approve through task queues.
5. **Export** — Intelligence dossiers, evidence packages, and reports are generated on demand with watermarks and chain-of-custody manifests.

### Deployment Model

- **CI/CD** — Google Cloud Build triggers on commit; builds multi-stage Docker images, pushes to Google Container Registry, and deploys to Cloud Run.
- **Infrastructure** — Serverless containers on Cloud Run with auto-scaling, Cloud SQL for managed PostgreSQL, and nginx reverse proxy for the frontend.
- **Health Monitoring** — Lightweight `/health` endpoint (always responds) and `/ready` endpoint (verifies database connectivity; returns 503 if degraded).
- **Observability** — Structured JSON logging to Cloud Logging, slow-query warnings (>500ms), database pool metrics every 30 seconds, and circuit-breaker protection on audit logging.

### Notable Design Patterns

- **Factory Pattern** — All middleware and infrastructure created via factory functions with dependency injection, enabling testability and per-deployment customisation.
- **Pluggable Workflow Engine** — Domain-agnostic state machine with pluggable storage, guard evaluation, action dispatch, audit writing, and SLA calculation.
- **Circuit Breaker** — Applied to audit logging (5 consecutive failures → block mutations), LLM providers (disable after threshold failures), and external connectors (backoff + dead-letter queue).
- **Mobile-First Responsive Design** — Base styles for 360px screens; progressive enhancement at 768px and 1280px breakpoints.
- **Bilingual UI** — Stacked English + regional language rendering for all labels and headings.

---

## A4. Benefits for the Police Department

### Operational Efficiency

- **Unified Intelligence Platform** — Eliminates the need to switch between multiple disconnected systems (CCTNS, eCourts, CDR portals, spreadsheets). A single login provides access to criminal history, financial intelligence, legal status, and communication analysis.
- **Automated Data Consolidation** — Scheduled connectors continuously ingest and normalise data from government sources, removing hours of manual data entry and cross-referencing.
- **Faster Lead Response** — Structured lead intake, automatic routing, and SLA-tracked task queues ensure no tip or intelligence input falls through the cracks.
- **Natural Language Search** — Officers can query the database in plain language instead of learning complex search interfaces, dramatically reducing training time and improving information retrieval speed.

### Data-Driven Decision Making

- **54-Column Intelligence Profiles** — Rich, standardised offender records enable pattern recognition, trend analysis, and evidence-based prioritisation of investigative resources.
- **Network Analysis** — Visual relationship graphs expose hidden connections between suspects, associates, financial accounts, and communication patterns that manual analysis would miss.
- **Dashboard Suite** — Eight specialised dashboards give leadership, supervisors, and control-room operators real-time visibility into alert volumes, case progress, SLA compliance, and district-wise trends.
- **Monthly KPI Aggregation** — Automated extraction of performance indicators from district reports enables data-driven resource allocation and accountability.

### Enhanced Inter-Departmental Coordination

- **Role-Based Workflow** — Clearly defined handoffs between District Operators, Intelligence Analysts, Supervisory Officers, and Investigating Officers ensure smooth cross-functional collaboration.
- **Memo Approval Pipeline** — Formalised approval workflows with audit trails ensure that intelligence products are reviewed and authorised before reaching the field.
- **Jurisdiction-Aware Data Sharing** — Officers at State and Zone levels see aggregated intelligence across districts, while district-level users see only their operational area — balancing need-to-know with cross-unit visibility.

### Compliance & Audit Readiness

- **Immutable Audit Trail** — Every action in the system is permanently recorded with actor identity, timestamp, and payload. This creates a defensible evidence chain for court proceedings and internal reviews.
- **Evidence Chain of Custody** — Digital evidence exports include SHA-256 integrity manifests, ensuring forensic admissibility.
- **PII Access Controls** — Sensitive personal data is masked by default; access requires recorded business justification, ensuring compliance with privacy norms.
- **AI Model Governance** — No AI output reaches operational use without passing through a validated, approved model with documented performance metrics and named human sign-off.

### Officer Safety & Accountability

- **Geofence Alerts** — Automatic notifications when monitored subjects enter or leave defined geographic areas, enabling proactive officer deployment.
- **Watchlist Monitoring** — Real-time alerts on watchlist hits ensure critical intelligence reaches officers before they encounter high-risk individuals.
- **Escalation Safeguards** — Critical alerts that remain unacknowledged are automatically escalated up the chain of command, preventing dangerous intelligence gaps.
- **Named Accountability** — Every approval, transition, and export is tied to a specific officer's identity — no shared or anonymous accounts.

### Cost Savings & Resource Optimisation

- **Reduced Manual Data Entry** — Automated ingestion from government sources eliminates redundant transcription work.
- **SLA Compliance Tracking** — Pendency dashboards highlight bottlenecks and overdue tasks, allowing supervisors to reallocate resources before deadlines are missed.
- **On-Premises AI** — Using department-controlled infrastructure for AI inference avoids recurring cloud API costs and prevents sensitive data from leaving the department's network.
- **Serverless Deployment** — Cloud Run auto-scaling means the department pays only for actual usage, with no idle server costs during low-activity periods.

### Public Trust & Transparency

- **Documented Workflows** — Every investigative step follows a defined, auditable process — from lead intake through case closure — demonstrating procedural rigour.
- **Approval-Gated Intelligence** — Intelligence products (memos, dossiers, legal section mappings) require supervisory sign-off before dissemination, reducing the risk of acting on unverified information.
- **Legal Compliance Monitoring** — Automated eCourts integration ensures bail conditions and legal status are always current, preventing procedural lapses.

---
---

# Part B — Social Media Intelligence Platform

## B1. Overview

**Social Media Monitoring & Intelligence Platform**

The Social Media Intelligence Platform is a purpose-built system for detecting, analysing, and investigating illicit and criminal activity across multiple social media networks. Designed primarily for Punjab Police and similar state-level law enforcement agencies, it provides continuous monitoring of platforms such as Twitter/X, Instagram, Facebook, and YouTube for content related to drug trafficking, radicalisation, communal incitement, cyberbullying, and other criminal activity.

The platform combines automated content ingestion with AI-powered classification, legal section mapping, risk scoring, and evidence preservation. It routes flagged content through structured analyst workflows — from initial detection through investigation, escalation, and legal action — while maintaining forensically sound evidence chains, complete audit trails, and strict role-based access controls throughout the process.

---

## B2. Main Features

### Content Ingestion & Monitoring

- **Multi-Platform Monitoring** — Pre-built connectors for Twitter/X, Instagram, Facebook, and YouTube with extensible connector framework for adding new platforms.
- **Keyword & Watchlist Monitoring** — Configurable monitoring rules based on keywords, hashtags, user handles, and watchlist entries; rules can be scoped by platform, language, and geographic region.
- **Automated Scheduling** — Connectors poll platforms on configurable intervals with exponential-backoff retry and dead-letter queue for failed ingestion jobs.
- **Screenshot Capture** — Automated Chromium-based screenshot preservation of flagged content for evidentiary purposes, capturing the content as it appeared at detection time.
- **Multi-Format Support** — Ingests text posts, images, videos, stories, reels, comments, and profile metadata.

### AI-Powered Content Classification

- **Threat Classification** — AI models classify ingested content across categories: drug trafficking, radicalisation/extremism, communal incitement, cyberbullying/harassment, financial fraud, and other criminal activity.
- **Severity Assessment** — Each flagged item receives a severity rating (Critical, High, Medium, Low) based on content analysis, account reach, and contextual signals.
- **Confidence Scoring** — AI outputs include confidence scores; items below the configurable threshold are routed to manual analyst review rather than auto-classified.
- **Multilingual Analysis** — Content analysis supports English, Hindi, Punjabi, and regional language detection, with AI-assisted translation for analyst review.
- **Provider-Agnostic AI** — Supports OpenAI, Claude, Gemini, and on-premises Ollama models; the department controls which provider processes sensitive content.

### Actor & Account Profiling

- **Social Media Actor Profiles** — Builds structured profiles of accounts of interest, capturing handle, platform, follower count, posting patterns, associated content, and risk score.
- **Cross-Platform Linking** — Associates multiple social media accounts to the same individual across platforms.
- **Behavioural Analysis** — Tracks posting frequency, timing patterns, engagement metrics, and network reach over time.
- **Risk Scoring** — Dynamic risk scores (0–100) based on content severity, posting frequency, follower reach, and historical activity.

### Alert Management & Triage

- **Real-Time Alerts** — Flagged content generates alerts categorised by type (content match, watchlist hit, behavioural anomaly) and severity.
- **Alert Lifecycle** — Alerts progress through Open → Acknowledged → Under Review → Resolved with full state-change audit trail.
- **Priority Queuing** — Critical and High severity alerts surface at the top of analyst queues with visual indicators and SLA countdowns.
- **Bulk Operations** — Analysts can acknowledge, assign, or dismiss multiple related alerts simultaneously.

### Case & Investigation Management

- **Case Creation** — Alerts and flagged content can be escalated into formal investigation cases with auto-generated reference numbers.
- **Case Workflow** — Cases progress through Open → Under Investigation → Escalated → Closed, with role-based transition guards.
- **Evidence Linking** — Cases aggregate all related content items, screenshots, actor profiles, and analyst notes into a single investigation record.
- **Multi-Analyst Collaboration** — Cases can be assigned and reassigned between analysts, with all handoffs logged in the audit trail.

### Escalation & Supervisory Review

- **Tiered Escalation** — Content flagged as requiring senior review or legal action is escalated through a structured approval hierarchy.
- **SLA-Tracked Queues** — Escalated items carry configurable SLA deadlines; breaches trigger automatic escalation to the next level.
- **Supervisory Audit View** — Supervisors see a dedicated audit trail of all escalation decisions, approvals, and rejections within their jurisdiction.
- **Inter-Agency Referral** — Cases requiring action beyond the department's jurisdiction can be formally referred with structured handoff documentation.

### Legal Mapping & Compliance

- **Legal Section Suggestions** — AI-assisted mapping of flagged content to relevant legal sections (IT Act, IPC, NDPS Act, etc.) with mandatory human review and approval.
- **Legal Status Tracking** — Tracks the legal disposition of referred cases (FIR filed, charge sheet, court proceedings, conviction/acquittal).
- **Takedown Request Management** — Tracks platform takedown requests, response times, and compliance status.
- **Evidence Integrity** — All evidence exports include SHA-256 integrity manifests ensuring forensic admissibility.

### Evidence Preservation & Export

- **Forensic Evidence Packages** — ZIP exports containing original content, screenshots, metadata, analyst notes, and SHA-256 hash manifest.
- **Chain of Custody** — Every evidence access, view, and export is logged with actor identity and timestamp.
- **Court-Ready Reports** — Generated PDF reports with watermarks, timestamps, and confidentiality markings suitable for legal proceedings.
- **Bulk Evidence Export** — Package multiple related evidence items for a case into a single court-submission bundle.

### Natural Language Query Assistant

- **Plain-Language Search** — Analysts type questions like "Show all Instagram posts about drug sales in Amritsar from the last 30 days" and receive structured results.
- **Secure SQL Generation** — AI-generated queries are validated against comprehensive security rules before execution (read-only, no DDL/DML, single statement).
- **Query History** — Previous queries are cached for quick re-execution and trend analysis.

### Dashboards & Analytics

- **Operations Dashboard** — Real-time overview of content ingestion rates, alert volumes, pending cases, and analyst workload.
- **Trend Analysis Dashboard** — Temporal analysis of content themes, platform activity, geographic distribution, and threat category trends.
- **Platform Analytics** — Per-platform breakdown of flagged content volume, response times, and takedown compliance.
- **Performance Metrics** — Analyst productivity metrics, average response times, SLA compliance rates, and case closure statistics.
- **Geographic Heatmaps** — Location-based visualisation of threat activity concentration.

### Administration & Configuration

- **User & Role Management** — Create, suspend, and manage analyst accounts with role-based permissions (Analyst, Senior Analyst, Supervisor, Administrator).
- **Monitoring Rule Configuration** — Add, modify, and deactivate keyword rules, watchlist entries, and platform-specific monitoring parameters.
- **Platform Connector Management** — Configure API credentials, polling intervals, and health monitoring for each social media platform connector.
- **Detection Dictionary** — Maintain and update slang terms, code words, and regional language variants used in criminal communications.
- **Report Template Management** — Configure and customise report templates for different output types (investigation summary, court submission, monthly review).

---

## B3. Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 6, Recharts (charts), i18next (EN, HI, PA) |
| **Backend** | Node.js 20, Fastify 5, TypeScript |
| **Database** | PostgreSQL 15 with UUID, JSONB, full-text search (66 migrations, 40+ tables) |
| **Authentication** | JWT (HS256 local + RS256 OIDC), LDAP/AD, optional MFA |
| **AI/ML** | Provider-agnostic LLM layer (OpenAI, Claude, Gemini, Ollama) |
| **Screenshot Capture** | Bundled Chromium for automated content preservation |
| **Reports** | PDFKit (PDF generation with watermarks), docx (Word generation) |
| **Evidence Packaging** | Archiver (ZIP creation with SHA-256 manifests) |
| **Validation** | Zod 4 (runtime schema validation + TypeScript inference) |
| **Containerisation** | Docker multi-stage builds (Node 20 Alpine + Chromium, nginx unprivileged) |
| **Cloud Platform** | Google Cloud Run (asia-southeast1), Cloud SQL, Cloud Build CI/CD |
| **Reverse Proxy** | nginx with CSP headers, HSTS, SPA routing |

### System Architecture

The Social Media Intelligence Platform follows a **client-server architecture** deployed as independent containerised services on Google Cloud Run.

- **API Server** — Stateless Fastify application (34 route modules, ~12,000+ lines of code) with plugin-based middleware stack (authentication, audit logging, rate limiting, CORS, compression, idempotency). Scales horizontally via Cloud Run auto-scaling.
- **Frontend** — Single-page React application (39 view components, 66 source files) served via nginx. Communicates exclusively through RESTful JSON endpoints.
- **Database** — PostgreSQL instance with 40+ tables covering content, actors, alerts, cases, evidence, watchlists, monitoring rules, and audit events. Connection pooling (20 max) with SSL enforcement.
- **Shared Packages** — Leverages the same infrastructure libraries as DOPAMS: `@puda/api-core` (auth, audit, logging), `@puda/api-integrations` (reports, connectors, evidence), `@puda/workflow-engine` (state machines), `@puda/shared` (schemas, UI components).
- **Screenshot Service** — Bundled Chromium instance within the API container captures and preserves social media content as rendered screenshots.

### Authentication & Authorisation

Identical to the platform-wide authentication architecture: local credentials (Argon2), LDAP/AD, and OIDC/SSO all converge to signed JWTs in HTTP-only cookies. Role-based guards at the route level restrict operations by analyst role. Jurisdiction scoping ensures analysts see only content within their assigned geographic area.

### Data Flow

1. **Collection** — Platform connectors poll social media APIs on scheduled intervals → normalise content metadata → deduplicate → store in PostgreSQL.
2. **Classification** — AI models classify content by threat category and severity; low-confidence items route to manual analyst review.
3. **Alerting** — Classified content matching monitoring rules generates alerts, which populate analyst triage queues.
4. **Investigation** — Analysts review alerts, build actor profiles, link evidence, and escalate to cases when investigation is warranted.
5. **Escalation** — Cases requiring supervisory review or legal action move through structured approval workflows with SLA tracking.
6. **Preservation** — Evidence packages (content, screenshots, metadata, hash manifests) are assembled for legal proceedings.
7. **Reporting** — Court-ready PDF reports and trend analytics are generated on demand.

### Deployment Model

- **CI/CD** — Google Cloud Build triggers on commit; multi-stage Docker builds include Chromium for screenshot capability.
- **Infrastructure** — Serverless Cloud Run containers with auto-scaling, Cloud SQL for PostgreSQL, nginx reverse proxy for the frontend.
- **Health Monitoring** — `/health` (lightweight) and `/ready` (database connectivity check) endpoints for container orchestration.
- **Observability** — Structured JSON logging, slow-query warnings, database pool metrics, and circuit-breaker protection on critical paths.
- **Local Development** — Docker Compose configuration with dedicated database (port 5434), API (port 3010), and UI (port 3020) services on an isolated backend network.

### Notable Design Patterns

- **Connector Framework** — Pluggable `ExternalConnector` interface with `authenticate()`, `fetch()`, `normalise()`, and `healthCheck()` methods; adding a new platform requires implementing one interface.
- **Factory Pattern** — All infrastructure (auth, audit, database, LLM) created via factory functions with dependency injection.
- **Circuit Breaker** — Applied to external platform APIs, LLM providers, and audit logging to gracefully degrade under failure conditions.
- **Idempotency Middleware** — `X-Idempotency-Key` header support prevents duplicate operations during network retries.
- **Workflow Engine** — Domain-agnostic state machine manages content escalation, case lifecycle, and approval workflows.

---

## B4. Benefits for the Police Department

### Operational Efficiency

- **Continuous Automated Monitoring** — Round-the-clock monitoring of multiple social media platforms without requiring officers to manually browse each site, freeing analyst time for investigation rather than detection.
- **AI-Assisted Triage** — Automated classification and severity assessment filters the high volume of social media content down to actionable intelligence, allowing analysts to focus on genuine threats rather than noise.
- **Structured Workflows** — Defined alert-to-case pipelines ensure every flagged item follows a consistent process, eliminating ad-hoc handling and reducing response times.
- **Natural Language Search** — Analysts can query the intelligence database in plain language, dramatically reducing training requirements and information retrieval time.

### Data-Driven Decision Making

- **Trend Analysis** — Temporal and geographic analysis of online criminal activity reveals emerging threats, seasonal patterns, and geographic hotspots before they escalate to offline incidents.
- **Platform Analytics** — Per-platform metrics on content volumes, response times, and takedown compliance inform resource allocation and platform engagement strategy.
- **Risk-Based Prioritisation** — Dynamic actor risk scores help supervisors allocate investigative resources to the highest-threat individuals and networks.
- **Performance Dashboards** — Analyst productivity, SLA compliance, and case closure metrics enable evidence-based workforce management.

### Enhanced Inter-Departmental Coordination

- **Structured Escalation** — Tiered approval hierarchies with SLA tracking ensure critical intelligence reaches decision-makers quickly, regardless of which analyst first detected it.
- **Cross-Platform Intelligence** — Linking accounts across Twitter, Instagram, Facebook, and YouTube provides a unified view of an individual's online activity, enabling coordinated investigations.
- **Inter-Agency Referral** — Formal referral documentation supports handoffs to other agencies (Cyber Crime, NIA, NCB) with complete evidence packages and investigation history.
- **Shared Infrastructure** — Common authentication, audit, and reporting systems across DOPAMS and Social Media Intelligence enable seamless cross-domain collaboration.

### Compliance & Audit Readiness

- **Forensic Evidence Integrity** — SHA-256 hash manifests on all evidence packages ensure tamper-proof chains of custody that withstand legal scrutiny.
- **Automated Screenshots** — Content is preserved as it appeared at detection time, providing court-admissible evidence even if the original post is later deleted.
- **Immutable Audit Trail** — Every analyst action — from viewing content to exporting evidence — is permanently logged with identity, timestamp, and IP address.
- **Legal Section Mapping** — AI-suggested legal sections always require named human approval, ensuring legal accuracy and personal accountability.
- **Takedown Compliance Tracking** — Documented records of takedown requests and platform responses demonstrate due diligence in content removal efforts.

### Officer Safety & Accountability

- **Watchlist Alerts** — Real-time notifications when monitored individuals post threats against officers, institutions, or public events.
- **Named Accountability** — Every classification, escalation, and approval is tied to a specific analyst's identity; no anonymous or shared accounts.
- **SLA Enforcement** — Automatic escalation of unaddressed critical alerts ensures time-sensitive intelligence is never overlooked.
- **Role-Based Access** — Analysts see only content within their assigned jurisdiction and role permissions, preventing unauthorised access to sensitive investigations.

### Cost Savings & Resource Optimisation

- **Automated Detection** — AI classification replaces manual monitoring of social media feeds, reducing the number of officers required for initial content screening.
- **On-Premises AI Option** — Ollama support allows the department to run classification models on its own infrastructure, avoiding recurring cloud API costs and keeping sensitive content within the department's network.
- **Serverless Scaling** — Cloud Run auto-scaling means infrastructure costs align with actual usage; no idle servers during low-activity periods.
- **Shared Platform** — Common infrastructure packages shared with DOPAMS reduce development and maintenance costs across the policing ecosystem.

### Public Trust & Transparency

- **Procedural Rigour** — Every piece of flagged content follows a documented, auditable path from detection through legal action, demonstrating systematic and fair enforcement.
- **Approval-Gated Actions** — Escalations, legal referrals, and evidence exports require supervisory sign-off, preventing unilateral action on sensitive matters.
- **Proportional Response** — Severity-based triage ensures enforcement resources are proportional to the threat level, avoiding over-reaction to low-risk content.
- **Privacy Controls** — PII masking, access justification requirements, and field-level redaction demonstrate respect for privacy rights even in intelligence operations.

---
---

*Document generated on 2026-03-30. For technical details, refer to the codebase documentation and BRD specifications in the `/docs/` directory.*
