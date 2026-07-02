# Policing Platform Discovery: Problem Brief

## Classification

Selected path: discovery.

Rationale: the target platform boundary is not yet fixed. Multiple solution shapes are plausible: a single runtime application, a platform shell over bounded services, or a full rewrite into one backend and one frontend. Because the portfolio handles police intelligence, evidence, case data, legal reasoning, social-media monitoring, and complaint intake, the next implementation phase should be treated as full-path work after this discovery decision is accepted.

## Problem

The police app portfolio is spread across multiple local repositories and runtime shapes:

- `policing-apps`: TypeScript monorepo containing DOPAMS, Social Media Intelligence, Forensic, legacy PUDA/citizen/officer workflow apps, shared API packages, workflow engine, and shared UI/NL assistant code.
- `compliant-parser`: Python/FastAPI complaint and investigation workbench with OCR, translation, 5W+1H complaint extraction, FIR drafting, case lifecycle, senior dashboard, privacy/governance controls, and an embedded Knowledge Intelligence Service.
- `RAG-app`: IntelliRAG knowledge platform with Fastify API, React web app, Python worker, pgvector, legal/case document ingestion, justice knowledge retrieval, and knowledge graph.

The user wants these capabilities consolidated into one repository and one usable police platform where access to apps and data is controlled by entitlements.

## Pain Points Observed

- Users currently face multiple app entrypoints, logins, routes, and duplicated navigation patterns.
- Backends duplicate platform concerns: auth, RBAC, audit logs, idempotency, model governance, NLP/LLM providers, OCR, notifications, reports, task queues, and evidence handling.
- Police domain concepts are duplicated with different names and tables: `dopams_case`, `case_record`, `forensic_case`, IQW `cases`, RAG `district_case`, social media `evidence_item`, DOPAMS `evidence_item`, forensic `evidence_source`.
- Knowledge is split between `RAG-app` and complaint-parser's `services/knowledge-intelligence-service`.
- Existing deployment is multi-service and multi-database. A forced single binary would increase risk without solving entitlement, case, evidence, or knowledge integration.
- Sensitive local files exist in the complaint-parser workspace (`.env`, `credentials/wealth-report-sa.json`). These need cleanup before repository consolidation or migration.

## Objective

Create a target architecture for a holistic police platform that:

- supports a single platform entrypoint;
- centralizes identity, entitlements, audit, case index, evidence registry, notifications, and knowledge access;
- preserves strong bounded contexts for DOPAMS, Social Media, Forensic, IQW complaint intake, and Justice Knowledge/RAG;
- supports deployment as one product while allowing domain services and workers to scale independently;
- keeps police data, evidence, and AI calls inside approved infrastructure unless a written approval policy permits an external provider.

## Evidence Sources

- `package.json`
- `docker-compose.yml`
- `docs/DOPAMS-and-SocialMedia-Police-Features.md`
- `docs/policing_apps_brd/*`
- `/Users/n15318/compliant-parser/README.md`
- `/Users/n15318/compliant-parser/PROJECT_SUMMARY.md`
- `/Users/n15318/compliant-parser/docs/police-feature-writeup.md`
- `/Users/n15318/compliant-parser/docs/knowledge-intelligence-service-brd.md`
- `/Users/n15318/RAG-app/CLAUDE.md`
- `/Users/n15318/RAG-app/PROJECT_SUMMARY.md`
- `/Users/n15318/RAG-app/docs/IntelliRAG-Police-Features.md`

