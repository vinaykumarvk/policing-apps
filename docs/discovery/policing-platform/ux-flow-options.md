# Policing Platform Discovery: UX Flow Options

## Flow A: Role-Based Platform Home

1. User signs in once through Department SSO, LDAP/AD, or local fallback.
2. Platform API resolves user profile, org unit, roles, clearance, and module entitlements.
3. Platform web renders only entitled module cards and work queues.
4. User opens DOPAMS, Social Media, Forensic, IQW, or Justice Knowledge from the same shell.
5. Domain modules receive platform auth claims and enforce server-side authorization.

Use this for Phase 1.

## Flow B: Case 360 First

1. User searches by crime number, case number, FIR, subject, phone, handle, evidence hash, or document reference.
2. Platform API queries the central case index and domain adapters.
3. Case 360 shows tabs: Overview, Complaint/FIR, Subjects, Social Signals, DOPAMS Intelligence, Forensic Evidence, Knowledge, Tasks, Reports, Audit.
4. Tabs are hidden or redacted based on entitlements and clearance.
5. Sensitive views require purpose selection and may require MFA or maker-checker approval.

Use after central case/evidence indexing exists.

## Flow C: Alert to Case

1. Social-media connector creates a high-risk alert.
2. Analyst triages alert in Social Media module.
3. Analyst captures evidence package and requests case conversion.
4. Platform creates or links a canonical case index record.
5. DOPAMS receives an intelligence lead and Forensic can receive evidence tasks if needed.
6. Supervisor approves external sharing or escalation.

Use to validate cross-domain events.

## Flow D: Complaint to Investigation

1. Desk operator uploads a complaint in IQW.
2. OCR, translation, 5W+1H extraction, completeness score, and FIR draft are generated.
3. Operator creates complaint/case record.
4. If FIR is registered, platform creates canonical case index record.
5. IO sees the case in their unified work queue and can invoke justice knowledge or DOPAMS enrichment.

Use to validate IQW integration.

## Flow E: Justice Knowledge Assistant Everywhere

1. User asks a question from a case, report editor, or standalone knowledge view.
2. Query is scoped to user clearance, case, org unit, and selected corpus.
3. RAG service returns citation-backed answer and answer journey.
4. Exports are watermarked, masked, and audited.

Use after one knowledge runtime is selected.

