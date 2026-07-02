# Knowledge Runtime Decision

Version: 1.0
Phase: P10 - Knowledge Runtime Decision and Retrieval Security
Status: selected, gated
Traceability: G-SEC-004, R-KNOW-001, P3, P4, P10

## Decision

Select `RAG-app` as the long-term Justice Knowledge runtime. Do not run `RAG-app` and KIS as independent long-term RAG stacks. Promote KIS governance controls into the selected `RAG-app` runtime before any platform knowledge query UI is enabled.

The platform knowledge route remains blocked. `apps/platform-api/src/app-registry.ts` keeps the `knowledge` module in `blocked` state with no launch URL, and `packages/authz/src/abac.ts` still denies `platform.knowledge.retrieve` with `KNOWLEDGE_RETRIEVAL_DISABLED`. This decision is a target-runtime decision, not approval to expose retrieval in the platform shell.

## Evidence Reviewed

- `docs/spec/phased-plan.yaml` phase `P10`
- `docs/spec/access-control-threat-model.md`
- `docs/spec/data-classification-policy.md`
- `docs/spec/pilot-fixtures.md`
- `docs/spec/source-inventory.md`
- `docs/discovery/policing-platform/holistic-architecture.md`
- `/Users/n15318/RAG-app` API, web, worker, retrieval, graph, and test materials
- `/Users/n15318/compliant-parser/services/knowledge-intelligence-service` KIS service, retrieval, snapshot, provider, privacy, reasoning, and test materials

Only code, docs, and synthetic fixture metadata were reviewed. No real sensitive case data was ingested for P10.

## Comparison Criteria

Scores use `0` for absent, `1` for partial, `2` for usable with hardening, and `3` for strong fit.

| Criterion | RAG-app | KIS | Decision note |
|---|---:|---:|---|
| Runtime shape | 3 | 2 | RAG-app already separates Fastify API, React web, Python worker, migrations, and deployment assets. KIS is a compact FastAPI service. |
| Retrieval depth | 3 | 2 | RAG-app has pgvector, lexical search, wiki selection, graph lookup, reranking, answer generation, and answer journey tracing. KIS has vector, graph/fact, and wiki hybrid retrieval. |
| Governance | 1 | 3 | KIS has stronger domain-scoped governance, provider controls, prompt registry, quality gates, and API-key scoped service auth. These must be ported into RAG-app. |
| Published snapshots and rollback | 1 | 3 | KIS has explicit snapshot publish, quality gate, latest-published, and rollback services. RAG-app needs this promoted before platform UI enablement. |
| Citation behavior | 2 | 2 | RAG-app records answer citations and retrieval traces. KIS requires cited hybrid results. P10 adds the stricter citation filter and audit contract for both. |
| PII and provider governance | 1 | 3 | KIS masks PII before outbound provider calls and manages providers per domain. RAG-app has provider routing but needs KIS-style masking and allowlists for platform use. |
| Data isolation | 2 | 3 | RAG-app has workspace membership and workspace-scoped queries. KIS has domain-scoped knowledge bases. The target must map platform org, jurisdiction, assignment, clearance, and purpose into a pre-retrieval scope. |
| Deployment fit | 3 | 2 | RAG-app already has API/web/worker Dockerfiles, Cloud Build references, npm workspace commands, and worker separation. KIS has a smaller Docker surface but less UI/runtime breadth. |
| Police/legal knowledge features | 3 | 2 | RAG-app has police-specific metadata extraction, legal corpus work, knowledge graph, district court ingestion, and answer journeys. KIS has BNS reasoning and fact/wiki flows that should be migrated. |
| Test coverage | 2 | 3 | RAG-app has API and retrieval tests, including route and pipeline tests. KIS has focused Python tests for domain isolation, snapshots, provider governance, PII, BNS, and hybrid retrieval. |

Total: RAG-app `21`, KIS `25`. The numeric score shows KIS is stronger as a governance reference, but RAG-app is selected because P10 is choosing the long-term runtime, not the smallest control-plane service. RAG-app has the broader production shape required for Justice Knowledge: API, web, worker, document ingestion, pgvector, graph, wiki, analytics, and answer journey tracing. KIS governance features become mandatory promotion items in the RAG-app integration backlog.

## Selected Runtime Contract

`RAG-app` may become the platform knowledge runtime only after these contract items pass:

1. Platform claims are verified server-side and translated into a knowledge scope before any vector, graph, lexical, wiki, cache, or answer-generation step.
2. The pre-retrieval scope is represented as an allowlist of source records, documents, chunks, graph nodes, graph edges, facts, wiki articles, and citation IDs derived from platform ABAC metadata.
3. Vector search, graph search, wiki selection, and lexical search receive the scope allowlist before they execute. Post-retrieval filtering is allowed only as defense in depth.
4. Answer generation receives only scoped snippets.
5. Citations are filtered again before response. Dropped citations are audited with reason, source metadata, policy version, correlation ID, and decision evidence ID.
6. Published snapshot selection is required before retrieval. Queries must identify the snapshot version used to build every candidate and citation.
7. PII masking and provider allowlists run before outbound LLM calls. Provider, model, prompt, token, and cost metadata are audited without logging PII values.
8. The platform registry remains blocked until the selected-runtime tests and platform scope contract tests pass in CI.

## Migration Direction

RAG-app remains the selected runtime boundary:

- keep RAG-app API/web/worker architecture;
- keep RAG-app document ingestion, pgvector, graph, wiki, district court, and answer journey surfaces;
- add a platform retrieval adapter that accepts the P10 ingestion event and platform claim context;
- add KIS-style domain knowledge bases as a governance layer over RAG workspaces;
- add KIS-style published snapshots and rollback to the retrieval plan;
- add KIS provider governance, prompt registry, BNS reasoning, and PII masking before platform LLM execution;
- add P10 scope and citation audit events to answer journey tracing.

KIS is not selected as the runtime to expose directly through the platform. Its features are reference controls to merge into RAG-app. Carrying two independent stacks would increase policy drift and retrieval leakage risk.

## Gate Outcome

The P10 decision is complete only for runtime selection and security proof artifacts. It does not activate the platform knowledge UI. Activation requires a later phase to wire RAG-app to platform claims, snapshots, citation filtering, PII masking, provider governance, and audit persistence using the tests introduced in P10.

