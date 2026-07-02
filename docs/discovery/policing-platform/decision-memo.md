# Policing Platform Discovery: Decision Memo

status: draft
selected_option: platform shell over bounded services
promote_to_next_phase: pending human approval

## Recommendation

Consolidate the police portfolio into one monorepo and one platform entrypoint, but do not force all apps into one backend or one database schema in the first phase.

Use `policing-apps` as the base repository shape because it already has npm workspaces, shared packages, TypeScript police apps, deployment assets, and tests. Import `compliant-parser` as the Complaint/IQW domain and `RAG-app` as the Justice Knowledge/RAG domain after secret cleanup and architecture alignment.

## Why This Is the Right First Bet

The user's stated goal is "single app" access based on entitlements. That is primarily an identity, entitlement, navigation, and cross-domain projection problem. A full rewrite is not required to solve the first user-visible problem and would create unnecessary delivery risk.

Bounded services are also a better fit for this portfolio:

- IQW has Python OCR/translation and FastAPI investment.
- RAG has a Python worker and pgvector/knowledge pipeline.
- DOPAMS, Social Media, and Forensic already share TypeScript/Fastify patterns.
- Evidence, audit, legal hold, and AI governance require clear domain ownership.

## Candidate Requirements to Promote

| ID | Candidate | Classification | Rationale |
| --- | --- | --- | --- |
| CR-001 | Create a consolidated monorepo structure for platform, domains, packages, migrations, deploy, and docs. | promote | Required foundation. |
| CR-002 | Add platform web shell with entitlement-driven app registry/navigation. | promote | Directly satisfies single entrypoint. |
| CR-003 | Add platform API for identity/session, app registry, entitlement resolution, and health aggregation. | promote | Required for shell and auth. |
| CR-004 | Define central auth claims contract shared by TypeScript and Python services. | promote | Blocks secure integration. |
| CR-005 | Add canonical module entitlement model. | promote | Core user requirement. |
| CR-006 | Add read-only canonical case index projection. | promote | Enables holistic platform beyond app launcher. |
| CR-007 | Add read-only canonical evidence registry projection. | promote | Needed for court/evidence workflows. |
| CR-008 | Select one knowledge runtime and migration direction for RAG/KIS. | narrow-and-promote | Needs evaluation spike before implementation. |
| CR-009 | Include PUDA civic workflow in the police platform. | defer | Needs user decision. |
| CR-010 | Rewrite IQW from Python to TypeScript. | defer | Not required for first consolidated release. |
| CR-011 | Merge all domain databases into one schema. | drop | High risk and unnecessary; use projections and bounded schemas. |
| CR-012 | Build one platform reverse proxy/deployment profile for local UAT. | promote | Needed to test one-product deployment. |
| CR-013 | Run repository secret cleanup before import. | promote | Safety prerequisite. |

## Decisions Needed From User

1. Confirm whether PUDA/citizen/officer workflow should remain in the consolidated police platform.
2. Confirm first target deployment environment: Cloud Run, on-prem/Kubernetes, or both.
3. Confirm identity source: Department SSO/OIDC, LDAP/AD, HRMS, or local bootstrap.
4. Confirm first release modules: DOPAMS, Social Media, Forensic, IQW, Justice Knowledge, or a subset.
5. Confirm whether RAG-app should be the knowledge foundation, with KIS governance merged into it.

## Suggested Next Command

Run a standard-path planning phase for Phase 1 after user approval:

```text
Build Phase 1: consolidated monorepo shell, platform API, entitlement app registry, shared auth claim contract, and local one-product deployment profile.
```

