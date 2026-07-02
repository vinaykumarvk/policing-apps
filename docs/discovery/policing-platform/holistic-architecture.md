# Holistic Policing Platform Architecture

## Executive Recommendation

Build a single repository and single user-facing platform, but keep the domain systems as bounded modules and services. The practical target is:

- one platform web shell;
- one platform API/gateway for identity, entitlements, app registry, global navigation, case index, audit/event aggregation, notifications, and cross-domain search;
- bounded domain APIs for DOPAMS, Social Media Intelligence, Forensic, Complaint/IQW, and Justice Knowledge/RAG;
- one shared package layer for auth, audit, workflow, evidence, reports, LLM governance, UI components, and contracts;
- one deployment product composed of multiple services.

This avoids a risky rewrite while solving the real user problem: one entrypoint, one identity, entitlement-based access, shared case/evidence/knowledge visibility, and common governance.

## Repositories Scanned

| Repository | Include? | Reason |
| --- | --- | --- |
| `/Users/n15318/policing-apps` | Yes | Main TS monorepo with DOPAMS, Social Media, Forensic, shared packages, workflow engine, and deployment assets. |
| `/Users/n15318/compliant-parser` | Yes | Python IQW complaint intake, OCR, translation, FIR drafting, case lifecycle, KIS, senior dashboard. |
| `/Users/n15318/RAG-app` | Yes | IntelliRAG legal/justice knowledge platform with pgvector, graph, worker pipeline, police-specific RAG features. |
| `/Users/n15318/PUDA_workflow_engine` | Reference only | PUDA civic workflow; police matches are incidental. |
| `/Users/n15318/PS-WMS` | Exclude | Portfolio/wealth system; matches are copied skills or generic forensic wording. |
| `/Users/n15318/hrms` | Exclude by default | HRMS with external police/FIR reference fields only. |
| `/Users/n15318/custody_dashboard` | Exclude | Financial custody dashboard, not police custody/evidence. |

## Target Product Shape

```text
policing-platform
  apps/
    platform-web              # one React shell and route-level domain modules
    platform-api              # gateway/BFF, entitlements, app registry, case index
  domains/
    dopams-api                # existing TS service, later refactored behind shared core
    social-media-api          # existing TS service
    forensic-api              # existing TS service
    iqw-api                   # Python/FastAPI service imported from compliant-parser
    knowledge-api             # selected RAG/KIS runtime API
    knowledge-worker          # ingestion/OCR/chunk/embed/KG worker
  packages/
    platform-core             # shared app builder, env, errors, config
    authz                     # SSO, JWT claims, entitlements, policy checks
    audit-ledger              # tamper-evident audit, access logs, event envelope
    case-core                 # canonical case index contracts and adapters
    evidence-core             # evidence registry, chain-of-custody, legal hold
    workflow-engine           # existing state machine package
    ai-governance             # model/provider/prompt/taxonomy policy
    integrations              # connectors, retry, dead letter, report generation
    ui                        # design system, charts, tables, i18n, assistant
    shared                    # shared types, Zod schemas, constants
  migrations/
    platform/
    dopams/
    social-media/
    forensic/
    iqw/
    knowledge/
  deploy/
    docker-compose/
    cloudrun/
    k8s/
    terraform/
  docs/
```

## Logical Architecture

```text
Users
  |
  v
Platform Web Shell
  - entitled app launcher
  - global search
  - Case 360
  - unified task/alert inbox
  - knowledge assistant
  |
  v
Platform API / Gateway
  - SSO/session
  - entitlement policy
  - app registry
  - canonical case index
  - evidence registry facade
  - audit/event ingestion
  - notification fan-out
  - API aggregation
  |
  +--> DOPAMS API
  +--> Social Media API
  +--> Forensic API
  +--> IQW Complaint API
  +--> Justice Knowledge/RAG API
  |
  v
Platform Data Plane
  - Postgres cluster with platform and domain schemas/databases
  - pgvector for knowledge
  - object storage with legal hold/WORM profile
  - Redis/queue/outbox
  - OpenSearch or Postgres FTS/trigram where required
```

## Domain Boundaries

### Platform Core

Owns:

- users, external identities, sessions, token revocation;
- org hierarchy and jurisdiction;
- module entitlements;
- global roles, domain roles, clearance, access purpose rules;
- app registry and navigation;
- canonical case index and cross-domain references;
- canonical evidence registry metadata;
- central audit/event envelope;
- global notifications and task summaries.

Does not own:

- DOPAMS subject intelligence internals;
- social-media connector internals;
- forensic parser internals;
- OCR/translation parsing internals;
- vector chunks and graph internals.

### DOPAMS

Owns:

- subject profiles, criminal intelligence records, CDR/IPDR/financial/court integrations;
- leads, memos, interrogation reports, watchlists, geofence alerts;
- graph/entity enrichment for narcotics intelligence;
- DOPAMS domain reports and workflows.

Platform integration:

- publish case/subject/evidence summary events;
- consume canonical user claims and entitlements;
- accept case links from IQW, Social Media, Forensic, and Knowledge.

### Social Media Intelligence

Owns:

- source connectors, monitored content, actor profiles, content taxonomy, slang dictionaries;
- risk scoring, alert queues, content evidence capture, platform cooperation workflows;
- social media reports and early warning analytics.

Platform integration:

- publish alert-to-case and evidence events;
- use platform evidence registry for hash/legal hold summaries;
- route critical alerts to unified inbox.

### Forensic

Owns:

- forensic cases, evidence sources, import jobs, artifact parsers, extracted entities;
- AI findings, parser versions, findings, reports, DOPAMS sync;
- forensic evidence integrity and report approval.

Platform integration:

- publish evidence source and report references;
- expose findings to Case 360 under entitlement and clearance;
- consume platform case links.

### Complaint and Investigation Intake (IQW)

Owns:

- complaint OCR and translation;
- 5W+1H extraction and gap analysis;
- FIR drafting and petition rewrite assistance;
- police station/offence type registries;
- investigation lifecycle, statutory deadlines, senior dashboard, quality checks.

Platform integration:

- create canonical case index records on complaint/FIR transition;
- provide complaint/FIR documents to knowledge ingestion and case timeline;
- consume platform identity/entitlements through gateway or shared JWT verification.

### Justice Knowledge / RAG

Owns:

- legal/case corpus ingestion;
- document chunks, embeddings, graph nodes/edges, wiki/articles, answer generation;
- citations, answer journeys, sensitivity filtering, conversation history;
- legal/judgment analytics and BNS/IPC/CrPC/NDPS/POCSO knowledge.

Platform integration:

- expose query and citation APIs to every entitled module;
- apply platform clearance and case/org scope before retrieval;
- receive documents from IQW, DOPAMS, Social Media, and Forensic through ingestion events.

## Entitlement Model

Use layered authorization instead of app-only roles.

```text
Decision = module entitlement
         + domain permission
         + org/jurisdiction scope
         + record assignment or case membership
         + clearance level
         + legal hold/export policy
         + purpose/access justification
         + MFA/maker-checker requirement for sensitive actions
```

Core tables/contracts:

- `platform_user`
- `external_identity`
- `org_unit`
- `role`
- `permission`
- `module_entitlement`
- `user_role_assignment`
- `user_clearance`
- `access_policy`
- `access_justification`
- `approval_request`
- `auth_session`
- `auth_token_denylist`

Claims emitted by platform auth:

```json
{
  "sub": "user_id",
  "display_name": "Officer Name",
  "org_scope": ["STATE:TS", "DISTRICT:..."],
  "roles": ["INVESTIGATOR", "DOPAMS_ANALYST"],
  "modules": ["dopams", "forensic", "knowledge"],
  "clearance": "RESTRICTED",
  "purpose_required": true,
  "mfa_level": "verified"
}
```

Every domain API must still enforce server-side authorization. The web shell only controls visibility, not security.

## Data Architecture

Recommended physical model:

- one Postgres cluster for the platform deployment;
- separate logical databases or schemas per bounded context;
- central `platform` schema for identity, entitlements, app registry, case index, evidence registry, audit/event envelope, notification summaries;
- `knowledge` database/schema with pgvector and graph tables;
- object storage buckets or prefixes per domain with immutable/legal-hold profile;
- event outbox table per domain, consumed by platform projection workers.

Canonical platform records should be projections, not replacements for domain records.

### Canonical Case Index

Minimal fields:

- `platform_case_id`
- `domain`
- `domain_case_id`
- `case_number`
- `case_type`
- `title`
- `jurisdiction`
- `state`
- `priority`
- `owner_unit`
- `assigned_user_ids`
- `subject_refs`
- `evidence_refs`
- `source_refs`
- `created_at`
- `updated_at`

### Canonical Evidence Registry

Minimal fields:

- `platform_evidence_id`
- `domain`
- `domain_evidence_id`
- `platform_case_id`
- `evidence_type`
- `source_system`
- `hash_sha256`
- `storage_uri`
- `classification`
- `legal_hold_state`
- `chain_of_custody_head`
- `created_by`
- `created_at`

Domain services keep detailed evidence data and domain-specific chain-of-custody events.

## Knowledge Runtime Decision

RAG-app should be treated as the likely long-term knowledge runtime because it already has:

- web/API/worker separation;
- pgvector and graph migrations;
- document ingestion pipeline;
- police-specific metadata extraction;
- legal knowledge graph;
- chunk-level sensitivity filtering;
- citation-backed answers and answer journey.

The complaint-parser KIS service has strong governance concepts:

- domain-scoped knowledge bases;
- published snapshots and rollback;
- provider governance;
- prompt registry;
- BNS mapping reasoning;
- PII masking and API-key service auth.

Target decision: merge KIS governance concepts into the RAG-app runtime, or expose KIS as a governance/control-plane facade over RAG-app. Do not carry two independent RAG stacks indefinitely.

## Deployment Architecture

Support two deployment profiles from the same monorepo.

### Government Cloud / Cloud Run Profile

- Cloud Run services for platform API, domain APIs, knowledge worker, and platform web.
- Cloud SQL Postgres with pgvector.
- Secret Manager for secrets.
- Artifact Registry and Cloud Build.
- Cloud Storage buckets with retention/legal hold controls.
- Cloud Monitoring and structured logs.

### On-Prem / Department-Controlled Profile

- Kubernetes or Docker Compose for lower environments.
- Postgres/pgvector.
- MinIO or approved object storage with WORM/legal hold capability.
- Redis or queue.
- Self-hosted OCR gateway.
- Self-hosted OpenAI-compatible LLM/Ollama/vLLM gateway.
- OpenSearch if full text/search workload outgrows Postgres FTS.

Production policy should default to self-hosted OCR/LLM for police case data, with external AI providers blocked unless approval metadata and masking policy are present.

## Migration Roadmap

### Phase 0: Safety and Inventory

- Freeze source repo list.
- Run secret scan and remove/rotate local secrets before import.
- Record app/service inventory, ports, environment variables, DB names, migrations, tests, and deployment scripts.
- Decide whether PUDA/citizen/officer remains in scope.

### Phase 1: Repository Consolidation and Platform Shell

- Create consolidated monorepo structure.
- Import existing apps with history only after secret cleanup.
- Keep existing apps runnable with their current tests.
- Add `apps/platform-web` and `apps/platform-api`.
- Implement app registry and entitlement-driven navigation.
- Put existing apps behind one reverse proxy path layout:
  - `/dopams`
  - `/social-media`
  - `/forensic`
  - `/complaints`
  - `/knowledge`

### Phase 2: Central Identity and Entitlements

- Define platform JWT/claims contract.
- Implement SSO/LDAP/OIDC integration once.
- Add module entitlements and org/jurisdiction scope.
- Adapt TypeScript domain APIs to validate platform claims.
- Add Python IQW middleware or gateway validation.

### Phase 3: Canonical Case and Evidence Projections

- Add platform case index and evidence registry.
- Build adapters/outbox projections from DOPAMS, Social Media, Forensic, IQW, and Knowledge.
- Render read-only Case 360.
- Add purpose/access justification for sensitive views.

### Phase 4: Knowledge Consolidation

- Decide RAG-app vs KIS merged target.
- Integrate knowledge query into platform shell and domain pages.
- Add ingestion event path from complaint/FIR, forensic reports, social evidence packages, and DOPAMS documents into knowledge.
- Enforce clearance before retrieval.

### Phase 5: UI Unification

- Extract shared UI library.
- Move existing domain UIs into route-level modules inside `platform-web`.
- Preserve route parity and E2E workflows during migration.
- Decommission separate domain login pages after SSO is stable.

### Phase 6: Data and Operations Hardening

- Move from separate local DB containers to one managed Postgres cluster with separated schemas/databases.
- Add backups, restore tests, audit verification, legal hold tests, and DAST/SAST gates.
- Add deployment profiles for Cloud Run and on-prem/Kubernetes.

## Open Decisions

1. Is PUDA/citizen/officer workflow in scope for the police platform, or should it remain separate?
2. Should the final deployment prioritize on-prem first or Cloud Run first?
3. Which identity provider will be authoritative: Department SSO/OIDC, LDAP/AD, HRMS, or local bootstrap?
4. Which knowledge runtime is the final target: RAG-app, KIS, or a merged design?
5. What are the required clearance levels and jurisdiction hierarchy for entitlements?
6. Which modules must be available in the first unified release?
7. Are public/citizen complaint intake surfaces required, or only internal police operator surfaces?

## Primary Risks

- Secret leakage during repository import.
- Duplicated auth and role semantics causing inconsistent access.
- Duplicate RAG/KIS stacks increasing cost and governance risk.
- Cross-domain case/evidence joins exposing data across jurisdiction or clearance boundaries.
- External AI/OCR providers being used without approval for police case data.
- UI consolidation causing regressions in mature domain workflows.
- Attempting a full rewrite too early.

## Recommended Next Step

Approve Option 1: platform shell over existing bounded apps. Then run the five experiments in `experiment-plan.md`, starting with app registry/entitlements and shared auth claims.

