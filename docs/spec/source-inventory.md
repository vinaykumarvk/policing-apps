# P0 Source Inventory

Generated: 2026-07-02T01:10:00+05:30  
Phase: P0 - Source Freeze, Secret Hygiene, and Import Map  
Source plan: `docs/spec/phased-plan.yaml` and `docs/spec/policing-platform-integration-execution-plan.md`

## Scope Decision

P0 freezes three source repositories for later integration work:

| Repo | Local path | Git HEAD | State | Integration role |
|---|---|---:|---|---|
| policing-apps | `/Users/n15318/policing-apps` | `967073cf49f0c00797b9bb34ed42cff48cd6fed3` | dirty before P0 edits | Target repo plus existing DOPAMS, Social Media, Forensic, and shared TypeScript source |
| compliant-parser | `/Users/n15318/compliant-parser` | `4d1d3124048d916800086603fedaca9321b1b628` | dirty before P0 edits | IQW complaint and investigation intake source |
| RAG-app | `/Users/n15318/RAG-app` | `bed69cceddca4f7fd2328f076d01640da69ec2d9` | dirty before P0 edits | Justice Knowledge/RAG source |

No source code was imported into the target monorepo during P0. Existing dirty worktree state was recorded only; no source history was rewritten.

## Excluded And Reference Scope

The execution plan excludes PUDA workflow, PS-WMS, HRMS, and custody dashboard unless the user changes scope.

| Repo/surface | Local evidence | P0 status | Notes |
|---|---|---|---|
| PUDA workflow | `/Users/n15318/PUDA_workflow_engine`, `/Users/n15318/PUDA_workflow_engine_uat_clean`, and existing PUDA workflow paths inside `policing-apps` | Excluded/reference | Existing `apps/api`, `apps/citizen`, `apps/officer`, `service-packs`, and `packages/workflow-engine` are not pilot imports unless P1 maps them explicitly. |
| PS-WMS | `/Users/n15318/PS-WMS` | Excluded/reference | Not part of Release 1 source allowlist. |
| HRMS | no matching sibling repo found | Excluded/reference | HRMS may remain an external identity integration later; no source import in P0. |
| custody dashboard | `/Users/n15318/custody_dashboard` | Excluded/reference | Not part of Release 1 source allowlist. |

## Selected Allowlist Summary

The deterministic import allowlist is `docs/spec/import-map.yaml`. It contains 21 entries. Each entry has owner, source path, target path, SHA-256 tree checksum, file count, byte count, import status, release scope, and risk notes.

| Source repo | Selected paths | Target intent | Import status |
|---|---|---|---|
| policing-apps | `apps/dopams-api`, `apps/dopams-ui` | `domains/dopams/api`, `domains/dopams/web` | `selected_not_imported_p0` pilot |
| policing-apps | `apps/forensic-api`, `apps/forensic-ui` | `domains/forensic/*` | `deferred_planned_not_active` |
| policing-apps | `apps/social-media-api`, `apps/social-media-ui` | `domains/social-media/*` | `deferred_planned_not_active` |
| policing-apps | `packages/api-core`, `packages/api-integrations`, `packages/shared` | shared packages | `selected_not_imported_p0` shared candidates |
| policing-apps | `packages/workflow-engine`, `packages/nl-assistant`, `docker-compose.yml` | reference/shared/deploy review | `reference_only` |
| compliant-parser | `.` with exclusions | `domains/iqw/api` | `selected_not_imported_p0` pilot |
| RAG-app | `apps/api`, `apps/web`, `apps/worker` | `domains/knowledge/*` | `deferred_planned_not_active` |
| RAG-app | `packages/api-core`, `packages/api-integrations`, `packages/shared`, `packages/workflow-engine`, `packages/nl-assistant` | `domains/knowledge/packages/*` | `reference_only` package variant review |

## Current App And Runtime Inventory

### policing-apps

Package manager: npm workspaces. Root package name is `puda-workflow-engine`.

Primary policing commands:

| Surface | Commands | Default port/health |
|---|---|---|
| DOPAMS API | `npm --workspace apps/dopams-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `PORT` or `DOPAMS_API_PORT`, default `8080`; `/health`, `/ready` |
| DOPAMS UI | `npm --workspace apps/dopams-ui run dev`, `build`, `typecheck`, `preview` | Vite default unless configured |
| Forensic API | `npm --workspace apps/forensic-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `PORT` or `FORENSIC_API_PORT`, default `3003`; `/health`, `/ready` |
| Forensic UI | `npm --workspace apps/forensic-ui run dev`, `build`, `typecheck`, `preview` | Vite default unless configured |
| Social Media API | `npm --workspace apps/social-media-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `PORT` or `SM_API_PORT`, default `3004`; `/health`, `/ready` |
| Social Media UI | `npm --workspace apps/social-media-ui run dev`, `build`, `typecheck`, `preview` | Vite default unless configured |

Route/auth behavior:

- DOPAMS, Forensic, and Social Media APIs are Fastify services.
- All three expose `/health` and `/ready`.
- All three register `/api/v1/auth/*` local auth routes through shared auth helpers.
- Domain routes currently rely on local JWT/cookie auth middleware, token revocation/session activity tables, and local role/unit checks.
- LDAP and OIDC routes are conditionally registered from environment variables.
- No platform claim enforcement exists yet; therefore only DOPAMS/IQW may become pilot later after P2/P3/P8 gates.

Data and migrations:

- DOPAMS, Forensic, and Social Media API migrations are under their app `migrations/` folders.
- Combined selected policing API migration/source inventory found 176 SQL migration/seed files under the three policing API surfaces.
- Dockerfiles exist for API/UI surfaces at the repo root.

Environment names observed from source, not values: database/JWT/cookie auth, OIDC, LDAP, CORS, rate limit, PII encryption, LLM provider keys, external connector tokens, evidence storage, SIEM, and screenshot capture variables.

### compliant-parser / IQW

Runtime: Python/FastAPI, `requirements.txt`, `Dockerfile`, and `deploy/docker-compose.onprem.yml`.

Commands and tests:

- Docker runtime command: `uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}`.
- Health endpoints: `/health`, `/api/health`, and `/api/v1/health`.
- Test surface found 53 Python test files across root tests and the knowledge-intelligence-service tests.

Route/auth behavior:

- Legacy FastAPI routes remain under `/api/*`.
- V1 API is mounted under `/api/v1`.
- V1 routers include auth, cases, analysis, documents, admin, analytics, senior dashboard, audit logs, notifications, police stations, offence types, templates, and knowledge.
- Auth is JWT/RBAC for `/api/v1/*`, with HRMS-compatible authentication/profile sync and legacy session auth retained for older `/api/*` routes.

Data and migrations:

- SQLAlchemy models/migration logic are in Python modules rather than a numbered SQL migration directory.
- Local object storage, complaint PDFs, credentials, and env files are excluded from import scope.

Environment names observed from source, not values: admin bootstrap, session/JWT, database/Cloud SQL, HRMS, Document AI, translation, OpenAI/Gemini, KIS, object storage, DSC, CCTNS, rate limit, and dashboard timezone variables.

### RAG-app / Justice Knowledge

Package manager: npm workspaces plus a Python worker.

Commands:

- Root commands include `dev:api`, `dev:web`, `build:packages`, `build:api`, `build:web`, `build:all`, `typecheck`, `test:api`, `test:e2e`, `lint`, `docker:up`, and `docker:down`.
- API commands include `build`, `dev`, `dev:watch`, `start`, `typecheck`, `migrate`, and `test`.
- Web commands include `dev`, `build`, and `preview`.

Route/auth behavior:

- API is a Fastify service with `/health`, `/ready`, `/docs`, `/api/v1/auth/login`, and `/api/v1/auth/refresh` public.
- Domain routes include workspaces, users, documents, RAG, graph, feedback, analytics, export, admin, org units, review queue, notifications, audit, ingestion, district source, district analytics, and district batch routes.
- Workspace membership guard protects workspace-scoped routes.
- Worker is FastAPI with `/health` and `/ready`.
- Knowledge query UI remains deferred until scoped retrieval and citation filtering are proven by later phases.

Data and migrations:

- API has 32 SQL migration files under `apps/api/src/migrations`.
- Worker has 19 Python test files.
- Installed `node_modules`, uploads, tmp, test results, and local reports are excluded from import scope.

Environment names observed from source, not values: API host/port, database, JWT, admin bootstrap, storage, OpenAI/OpenRouter/Gemini/Ollama, embeddings, GCS, OCR/Document AI, eCourts, captcha solver, Indian Kanoon, worker poller, translation, and local-storage safety variables.

## Import Hygiene Rules Applied

The allowlist checksum algorithm excludes:

- Git metadata, dependency installs, build outputs, caches, coverage, Python bytecode, and agent-local skill folders.
- `.env`, `.env.*`, credentials/secrets folders, service-account/key/certificate formats, and common private-key names.
- Local object storage, uploads, outputs, tmp, evidence-local, test-results, playwright-report, complaint PDFs, and binary evidence-like artifacts.
- PDF, DOCX, XLSX, and archive artifacts.

## P0 Evidence Links

- Deterministic allowlist: `docs/spec/import-map.yaml`
- Secret hygiene report: `docs/spec/secret-hygiene-report.md`
- Allowlist validator: `scripts/check-import-allowlist.mjs`
- Secret path/content validator: `scripts/check-no-known-secret-paths.mjs`

