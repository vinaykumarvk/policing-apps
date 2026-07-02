# Police-Focused Feature Write-Up: DOPAMS & Social Media Monitoring

*Prepared for Telangana Eagle Force (TEF) — Narcotics Enforcement Platforms*
*Date: 15 June 2026*

---

## App 1 — DOPAMS (Department of Police Analytics & Management System)

### Purpose & Mission

DOPAMS is an **on-premises, AI-assisted intelligence consolidation platform** built for EAGLE Force Telangana's narcotics enforcement operations. It replaces fragmented, manual intelligence work — subject-history collation, interrogation-report drafting, legal-status tracking — with a single, evidence-backed, audit-controlled operating system. Criminal records, telecom data (CDR/IPDR), financial intelligence, court updates, grievances, and lawfully monitored digital content are consolidated into one canonical case picture, with full chain-of-custody and a human reviewer at every decision point. The platform targets a 60–80% cut in manual effort, report generation reduced from hours to minutes, and 100% digital auditability — all while keeping data on Department-controlled Indian infrastructure.

### Who Uses It

DOPAMS serves the full policing hierarchy through ~13 jurisdiction-scoped roles: **District Operators** (intake and validation), **Investigating Officers** (case work), **Intelligence Analysts** (search, scoring, link analysis), **Supervisory Officers / SP / Zonal Officers** (approvals and escalations), **Legal Reviewers**, **Toll-Free / WhatsApp Operators** (grievance intake), **Read-Only Auditors**, **HQ Administrators**, and **Model Governance Reviewers**. Access is enforced at State, Zone, District, and Police-Station levels; cross-jurisdiction queries return redacted stubs unless authorized.

### Core Police Capabilities

- **Canonical Subject Profile (54-column).** A unified criminal-intelligence record combining identity, crime history, aliases, addresses, legal status, gang associates, offender role, drug procurement/delivery methods, and technical links — each field carrying provenance, confidence score, source-trust ranking, and version history. Automated **deduplication and controlled merge** prevents fragmented identities.

- **Case Lifecycle Management.** Full case tracking (OPEN → UNDER_INVESTIGATION → CHARGESHEETED → CLOSED → ARCHIVED) with linked subjects, legal sections, and crime numbers, all jurisdiction-aware.

- **Multi-Source Ingestion & Bilingual OCR.** Ingests from CCTNS, C-DAT, CDR, IPDR, FIR repositories, confession/seizure memos, C-Trace, eSakshya, and E-Courts. Telugu/English OCR extracts structured fields with confidence scoring; low-confidence extractions (<60%) route automatically to human review.

- **Network & Link Analysis (Kingpin Discovery).** Multi-hop (1–5 hop) graph analysis over communication, financial, co-case, and co-location evidence. Ranks high-centrality and bridge nodes to surface kingpins, with an evidence-by-evidence explanation of *why* each node ranks where it does.

- **Technical Analysis.** Tower-dump analytics with criminal-link scoring, plus automated CDR/CDAT/LBS reports covering route maps, stay locations, top-10 contacts, IMEI history, and silence/switch-off patterns (inferred fields explicitly labelled).

- **Geofence & Watchlist Alerts.** Monitors high-value watchlisted subjects/numbers against Department-defined geofences (Goa, Bengaluru, Mumbai, Orissa Agency, and custom polygons), generating entry/exit/dwell alerts with severity and recommended action, routed through a NEW → ACKNOWLEDGED → ESCALATED → RESOLVED lifecycle.

- **Drug Offender Role Classification.** Classifies suspects into NDPS roles — Cultivator, Manufacturer, Supplier, Peddler, Transporter, Consumer, Mediator, Financier — using 50 Department-provided ideal FIRs, returning supporting snippets and confidence; low-confidence cases route to manual review.

- **Content Monitoring & Risk Scoring.** Categorizes lawfully obtained online content into a controlled taxonomy (DRUG_SALE_SIGNAL, COORDINATION_SIGNAL, LOGISTICS_SIGNAL, etc.) and assigns a 0–100 risk score, escalating high-scoring items to PRIORITY_REVIEW or CRITICAL_ALERT queues.

- **Interrogation Reports & Requisition Drafts.** Generates fixed-template interrogation reports from FIR and supplementary sources, and auto-drafts Unocross bank-data requisitions when financial trigger rules fire — both gated behind named-approver sign-off.

- **Legal & Court Integration.** Periodic E-Courts monitoring matches bail orders and judgments to cases; AI-proposed legal-section mappings include rationale and evidence snippets but require reviewer confirmation (no auto-apply on ambiguous matches).

- **Grievance & Lead Management.** Toll-free / WhatsApp intake creates permanent lead records (anonymous supported), auto-generates routed memos, and runs a NEW → VALIDATED → MEMO_GENERATED → ROUTED → CLOSED workflow with immediate alerting on critical-urgency leads.

- **Natural-Language Query Assistant.** An on-prem assistant (approved open-source models only — no public LLM APIs) answers plain-language questions with cited sources, applied filters, and output-type explanation.

### Compliance, Legal & Audit

DOPAMS treats governance as a first-class feature: **immutable append-only audit logs** (actor, role, timestamp, IP, before/after snapshots), **SHA-256 evidence integrity with chain-of-custody and legal hold**, **role-based masking** of Aadhaar/PAN/bank/chat data, **access-justification codes** for sensitive exports, and **model governance** requiring evaluation metrics and named-approver promotion before any AI model reaches production. No autonomous enforcement actions occur — every AI output is advisory until a human signs off.

---

## App 2 — Social Media Monitoring Tool (TEF AI-Driven SMMT)

### Purpose & Mission

The **TEF AI-Driven Social Media Monitoring Tool (SMMT)** gives Telangana Eagle Force a production-grade platform that **lawfully ingests and analyzes approved public social-media signals, prioritizes narcotics-related threats, preserves digital evidence, and accelerates investigation-ready outputs** — always with human oversight. It targets a 40–60% reduction in analyst triage effort and faster, court-ready evidence assembly. The system is explicitly scoped to lawful, public content only: no covert interception or account compromise.

### Who Uses It

Roles map directly to a law-enforcement watch floor: **Intelligence Analyst** (triage, evidence capture, case opening), **Control Room Operator** (critical-queue monitoring, rapid sharing), **Investigator** (case work, exports), **Supervisor/Approver** (escalations, closures, external sharing), **Evidence Custodian** (integrity and legal hold), **Legal Reviewer** (legal mappings, report wording), **Security Auditor** (audit logs, privileged events), **Platform Administrator**, and **Leadership Read-Only**. Permissions are scoped by role (PL0–PL4) and by organization unit (State → Wing → District → Unit → Team).

### Core Police Capabilities

- **Lawful Multi-Platform Ingestion.** Connector adapters acquire content from X/Twitter, Instagram, Facebook, YouTube, and Reddit under rate-limit and entitlement controls, normalizing posts, comments, profiles, media, and engagement metrics into one model with source-ID + hash deduplication.

- **Narcotics Threat Detection & Classification.** LLM-assisted classification sorts content into a Department-approved narcotics taxonomy with confidence and rationale; a dedicated drug-role classifier identifies a subject's function in the drug ecosystem. A **rules-only fallback** keeps triage running if AI services are unavailable.

- **Keyword, Slang & Entity Detection.** A Department-managed multilingual **slang dictionary** (English/Telugu/Hindi) with approval workflows, plus automatic extraction of handles, hashtags, phone numbers, payment references, locations, and substance mentions. OCR and speech-to-text pull evidentiary text from images and video.

- **Risk Scoring & Alert Prioritization.** A 0–100 score (Critical 85–100, High 70–84, Medium 50–69, Low 0–49) built from content severity, actor frequency, virality, and historical behavior, with an analyst-visible breakdown. Critical alerts auto-route to the Control Room; repeat-actor detection links alerts to recidivists and kingpins.

- **Alerts, SLA & Escalation.** Alerts carry unique references (TEF-ALT-YYYY-NNNNNN) and configurable SLAs (Critical 15-min ack / 2-hr disposition, down to Low). A full state machine (NEW → IN_REVIEW → ESCALATED → CONVERTED_TO_CASE → CLOSED) governs handling, with watermarked sharing over WhatsApp or approved secure channels.

- **Early Warning & Trend Analysis.** Time-series trend monitoring, **spike detection** above baseline, and a **New Potential Slang (NPS) queue** that auto-promotes confirmed terms into the slang dictionary.

- **Evidence Preservation & Chain-of-Custody.** Snapshot/download/upload capture produces immutable master copies (TEF-EVD-YYYY-NNNNNN) with **SHA-256 hashing**, tamper-evident logging of every view/export/release, exportable evidence packs with hash manifests, and a **Court Export Wizard** for court-ready packages with legal disclaimers.

- **Legal & Compliance Mapping.** A versioned, DSL-based rule engine maps categorized content to **Bharatiya Nyaya Sanhita** and other approved provisions, offering ranked suggestions with rationale and confidence, plus AI-drafted investigation sections (chronology, findings, translated excerpts, legal references) subject to mandatory human review.

- **Multilingual Translation.** Automatic language detection and on-demand translation (English/Telugu/Hindi at Day-1) with a narcotics-domain glossary and side-by-side original/translated display.

- **Case & Task Management.** Cases assemble multiple alerts, evidence, notes, and reports; configurable lifecycle, timeline tracking, supervised closure, and linked tasks (REVIEW, VERIFY_EVIDENCE, LEGAL_REVIEW, EXPORT).

- **Network & Geo Intelligence.** Graph analysis with **kingpin identification** and cross-platform actor matching, plus geofencing (polygon/circle/point), tower-dump processing, point-in-fence checks, and a Geo dashboard correlating activity to location.

### Compliance, Legal & Audit

SMMT enforces **lawful-ingestion-only** connectors, **immutable tamper-evident audit logs**, **legal hold and 7-year retention** with approval-gated purge, **AES-256 at rest / TLS 1.2+ in transit**, **MFA for privileged roles**, and **maker-checker approval** for external sharing. Every AI-derived output is labelled DRAFT and carries its model/prompt/rule/taxonomy version for traceability — and no autonomous punitive or legal action is ever taken without a human in the loop.

---

## Common Thread

Both platforms are purpose-built for **narcotics enforcement under Indian law**, share an **on-premises / data-sovereign** posture, and embed the same operating principle: **AI accelerates the analyst, but never replaces the officer's judgment.** Risk scoring, classification, legal mapping, and report drafting are all advisory, gated behind named-approver sign-off, immutable audit trails, and verifiable chain-of-custody — making outputs defensible in court while cutting manual investigative effort by more than half.
