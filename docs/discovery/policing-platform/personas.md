# Policing Platform Discovery: Personas

These are implementation personas inferred from the scanned repos and BRDs. They should be validated with the department before formal requirements are promoted.

## Desk Operator / Complaint Clerk

Primary apps today: IQW complaint parser and case intake.

Needs:

- upload complaint documents in English, Hindi, Telugu, Urdu, or scanned handwriting;
- review OCR, translation, 5W+1H extraction, missing information, and FIR draft;
- create or update complaint/case records;
- route incomplete complaints back for petitioner clarification.

Entitlements:

- complaint intake create/update within assigned station;
- no access to sensitive intelligence, social-media watchlists, or forensic evidence unless explicitly granted.

## Investigating Officer

Primary apps today: DOPAMS, Forensic, IQW case lifecycle, RAG/knowledge.

Needs:

- see case 360 view across complaint, FIR, subjects, evidence, forensic findings, social-media alerts, legal history, and tasks;
- generate investigation plans, requisitions, interrogation reports, legal notes, and evidence packages;
- query justice knowledge and case files with citations.

Entitlements:

- assigned cases and jurisdiction-scoped search;
- purpose-based access to sensitive fields;
- maker-checker approval for exports and governed outputs.

## Intelligence Analyst

Primary apps today: DOPAMS and Social Media Intelligence.

Needs:

- monitor content, leads, watchlists, subjects, CDR/IPDR inputs, graph relationships, geofence alerts, and risk scores;
- identify repeat actors, kingpins, and cross-platform links;
- convert signals into cases or intelligence reports.

Entitlements:

- analyst tools within assigned unit/jurisdiction;
- redacted cross-jurisdiction stubs unless approved;
- access justification for sensitive exports.

## Forensic Analyst / Evidence Custodian

Primary apps today: Forensic and DOPAMS evidence workflows.

Needs:

- register immutable evidence packages;
- run parser imports for forensic-tool exports;
- review extracted artifacts, entities, findings, reports, and chain-of-custody records;
- publish court-ready evidence outputs.

Entitlements:

- case/evidence access by lab/unit assignment;
- custody actions require audit and often maker-checker approval;
- sealed evidence requires clearance and legal hold policy.

## Supervisor / Approver

Primary apps today: DOPAMS, Social Media, Forensic, IQW dashboard.

Needs:

- approve memos, exports, report publication, legal mappings, model/taxonomy changes, escalations, and case closure;
- see SLA, backlog, dashboard, and operational risk across units.

Entitlements:

- broader org-unit read and approval actions;
- cannot bypass audit, legal hold, or maker-checker controls.

## Legal Reviewer

Primary apps today: DOPAMS, Social Media, Forensic, RAG/justice knowledge.

Needs:

- validate legal section mappings, report wording, court export narratives, and statutory references;
- query judgments and legal knowledge with citations.

Entitlements:

- legal review queues and approved evidence/document views;
- no operational write unless assigned as approver.

## Platform Administrator / Security Auditor

Primary apps today: all apps, admin consoles, deployment configs.

Needs:

- manage users, roles, entitlements, org hierarchy, providers, feature flags, connectors, prompts, taxonomies, and deployments;
- inspect audit trails, access anomalies, model usage, and provider policy violations.

Entitlements:

- admin/config scope only as assigned;
- no decrypted secrets;
- production access requires named identity and audit.

