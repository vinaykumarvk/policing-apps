# Policing Platform Discovery: Repository Inventory

## Included Repositories

### `/Users/n15318/policing-apps`

Current role: primary TypeScript monorepo for police operational apps plus legacy PUDA workflow.

Evidence:

- Root `package.json` uses npm workspaces for `apps/*` and `packages/*`.
- `docker-compose.yml` runs separate services for PUDA, Social Media, DOPAMS, and Forensic with separate Postgres databases.
- `docs/policing_apps_brd/` contains BRDs and test material for DOPAMS, Social Media, and Forensic.
- `docs/DOPAMS-and-SocialMedia-Police-Features.md` describes DOPAMS and Social Media as TEF narcotics enforcement platforms.

Apps:

- `apps/dopams-api`, `apps/dopams-ui`
- `apps/social-media-api`, `apps/social-media-ui`
- `apps/forensic-api`, `apps/forensic-ui`
- `apps/api`, `apps/citizen`, `apps/officer` for PUDA/citizen/officer workflow

Shared packages:

- `packages/api-core`: auth, middleware, app builder, LLM/provider routes, idempotency, config governance, task/notification routes.
- `packages/api-integrations`: connectors, evidence packaging, report generation.
- `packages/workflow-engine`: reusable state machine/workflow engine.
- `packages/shared`: shared types, validation, master model.
- `packages/nl-assistant`: React NL query/page-agent UI.

Main consolidation value:

- Best starting repository for the final monorepo because it already has workspace structure, shared packages, and the three major police TypeScript apps.

### `/Users/n15318/compliant-parser`

Current role: Python/FastAPI complaint and investigation quality workbench.

Evidence:

- `README.md` describes police complaint OCR, translation, parsing, and parse history.
- `PROJECT_SUMMARY.md` describes ADS Complaint Analyser with FIR draft generation.
- `docs/police-feature-writeup.md` describes IQW complaint intake, FIR drafting, case lifecycle, document management, legal drafting, senior dashboard, privacy, and audit.
- `api_v1.py` exposes API routers for auth, cases, analysis, documents, admin, analytics, senior dashboard, audit logs, notifications, police stations, offence types, templates, and knowledge search.
- `services/knowledge-intelligence-service/` contains a standalone KIS MVP for domain-scoped knowledge, graph/wiki/vector retrieval, governed LLM execution, and BNS reasoning.

Main consolidation value:

- Should become the Complaint and Investigation Intake domain.
- Should supply OCR/translation/5W+1H/FIR drafting/case lifecycle patterns.
- Its KIS service should be merged with or bridged to the selected knowledge platform.

Important migration warning:

- Local sensitive-looking files exist in the workspace: `.env` and `credentials/wealth-report-sa.json`. Do not import repository history or files into the consolidated repository until secrets are confirmed untracked, rotated, and excluded.

### `/Users/n15318/RAG-app`

Current role: IntelliRAG knowledge platform for legal/police case knowledge.

Evidence:

- `CLAUDE.md` describes React web, Fastify API, Python worker, PostgreSQL + pgvector, Ollama/local and cloud LLM support.
- `PROJECT_SUMMARY.md` describes document ingestion, OCR, RAG retrieval, knowledge graph, conversations, analytics, admin, audit, and compliance.
- `docs/IntelliRAG-Police-Features.md` describes police-specific case metadata, legal LLM use cases, statutory extraction, legal knowledge graph, chunk-level sensitivity, legal translation, and evidence packaging.
- `apps/api/src/migrations/` includes document, conversation, knowledge graph, access control, retention, judgment, district court, and analytics migrations.

Main consolidation value:

- Should become the Justice Knowledge and RAG domain.
- Best candidate for the long-term knowledge runtime because it already has API/web/worker separation, pgvector, legal corpus ingestion, worker pipeline, and police-specific RAG features.

## Excluded or Reference-Only Repositories

### `/Users/n15318/PUDA_workflow_engine`

Reason: mostly PUDA civic workflow. Police matches are incidental references such as FIR/DDR document fields and copied complaint parser contract notes. It may be a reference for workflow/service-pack architecture, but should not be a core police platform domain unless the user explicitly includes PUDA.

### `/Users/n15318/PS-WMS`

Reason: primarily wealth/portfolio management. Matches are copied skills, "forensic" as generic audit wording, and one reference to IntelliRAG. The intelligence-service may have influenced KIS, but this repo should not be consolidated into the police platform.

### `/Users/n15318/hrms`

Reason: HRMS service-register and disciplinary modules. Police/FIR references are external case-link fields, not a police operating app. Exclude unless HRMS identity/org hierarchy is intentionally selected as an upstream source.

### `/Users/n15318/custody_dashboard`

Reason: "custody" refers to financial assets under custody, not law-enforcement custody/evidence.

