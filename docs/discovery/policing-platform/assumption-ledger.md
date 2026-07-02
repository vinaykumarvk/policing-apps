# Policing Platform Discovery: Assumption Ledger

| ID | Claim | Confidence | Would be falsified by |
| --- | --- | --- | --- |
| A-001 | `policing-apps`, `compliant-parser`, and `RAG-app` are the core repositories for this consolidation. | High | User identifies another police app repo with active domain code, not just incidental keyword matches. |
| A-002 | `PUDA_workflow_engine`, `PS-WMS`, `hrms`, and `custody_dashboard` are not core police platform repos for this effort. | Medium | User confirms PUDA/civic workflows, PS-WMS, HRMS, or custody dashboard must be included in the police platform. |
| A-003 | The right target is one repository and one platform entrypoint, not necessarily one process or one database schema. | High | User requires a single deployable binary or one physical database schema for all modules. |
| A-004 | Existing TypeScript police apps should remain bounded domain services initially. | High | Team is willing to pause delivery and fund a full backend rewrite before consolidation. |
| A-005 | IQW complaint intake should remain Python/FastAPI initially and be integrated behind the platform gateway. | High | Team decides to rewrite IQW into TypeScript before first consolidated release. |
| A-006 | IntelliRAG should become the primary knowledge foundation, with KIS governance ideas merged or bridged. | Medium | Team prefers the smaller KIS service as the long-term knowledge runtime. |
| A-007 | Department production should default to self-hosted OCR/LLM and approved in-country infrastructure. | High | Department provides written approval for managed external AI services handling case data. |
| A-008 | Entitlements must combine module access, role, jurisdiction/org unit, clearance, record assignment, and purpose justification. | High | Department only requires coarse role-based app access. |
| A-009 | A canonical case index and evidence registry are required even if each domain keeps its own detailed tables. | High | The user only wants navigation-level consolidation and no cross-app case/evidence visibility. |
| A-010 | Existing social media, DOPAMS, and forensic UI modules can be migrated into one React shell in phases. | Medium | Current UIs have incompatible routing/state patterns that make phased migration too expensive. |
| A-011 | Repository consolidation should include secret hygiene before import. | High | All sensitive files are proven untracked, rotated, and excluded from the migration input. |
| A-012 | Deployment should support both GCP Cloud Run profiles and on-prem/Kubernetes profiles. | High | Department chooses exactly one runtime target and rejects the other. |

