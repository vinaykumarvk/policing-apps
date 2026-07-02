# Policing Platform Discovery: Experiment Plan

## Experiment 1: App Registry and Entitlement Spike

Goal: prove one login can drive module visibility without breaking current apps.

Scope:

- create platform app registry metadata;
- map sample users to module entitlements;
- return entitled navigation from a platform API stub;
- route to existing DOPAMS, Social Media, Forensic, IQW, and RAG endpoints.

Decision impact:

- validates Option 1 as the first build phase.

## Experiment 2: Shared Auth Claim Contract

Goal: prove domain APIs can consume the same auth claims.

Scope:

- define canonical claim shape: `user_id`, `display_name`, `roles`, `unit_scope`, `clearance`, `module_entitlements`, `purpose_required`;
- map existing JWT/LDAP/OIDC patterns from `@puda/api-core`;
- prototype claim validation in one TypeScript API and one Python IQW route.

Decision impact:

- determines whether a platform gateway can front all APIs or whether each domain needs direct SSO integration.

## Experiment 3: Case Index Adapter

Goal: prove cross-domain case visibility without full data migration.

Scope:

- define minimal canonical case index: `platform_case_id`, `domain`, `domain_case_id`, `case_number`, `title`, `jurisdiction`, `state`, `priority`, `subject_refs`, `evidence_refs`, `updated_at`;
- build read adapters for one DOPAMS table, one Social Media table, one Forensic table, and one IQW case source;
- render a read-only Case 360 summary.

Decision impact:

- determines migration complexity for common case/evidence views.

## Experiment 4: Knowledge Runtime Decision

Goal: choose between RAG-app as the long-term runtime, KIS as the long-term runtime, or a merged target.

Scope:

- compare RAG-app and KIS for ingestion, domain isolation, citations, graph, wiki, snapshots, provider governance, PII masking, deployment, tests, and API fit;
- run the same BNS/legal query through both where possible;
- decide migration direction.

Decision impact:

- prevents long-term duplicate RAG/KIS infrastructure.

## Experiment 5: Deployment Profile

Goal: prove the platform can run as one product while preserving service isolation.

Scope:

- compose platform-web, platform-api, dopams-api, social-media-api, forensic-api, iqw-api, rag-api, rag-worker, Postgres/pgvector, object storage, Redis/queue;
- expose one reverse proxy;
- validate health/readiness and startup order.

Decision impact:

- determines target local development and UAT deployment layout.

