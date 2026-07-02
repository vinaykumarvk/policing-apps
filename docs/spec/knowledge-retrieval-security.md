# Knowledge Retrieval Security

Version: 1.0
Phase: P10 - Knowledge Runtime Decision and Retrieval Security
Status: proof contract, route disabled
Traceability: G-SEC-004, R-KNOW-001, R-SEC-001, R-SEC-002, R-DATA-001

## Gate

The platform knowledge UI and platform knowledge query route are blocked until this contract is implemented in the selected runtime and verified in CI. P10 proves the required retrieval and citation controls with synthetic fixtures only. It does not approve ingestion of real sensitive case data.

The current platform gate remains:

- app registry entry `knowledge` is `blocked`;
- blocked apps expose no active launch URL;
- `platform.knowledge.retrieve` denies by default;
- rollback is to keep RAG-app and KIS standalone with no platform query UI.

## Required Order

Knowledge retrieval must run in this order:

1. Verify platform claims server-side.
2. Validate request purpose, module, domain, org, jurisdiction, assignment, clearance, MFA, source status, projection freshness, legal hold, and redaction inputs.
3. Resolve a pre-retrieval scope from platform ABAC metadata and the published knowledge snapshot.
4. Produce an allowlist of source records, documents, chunks, graph nodes, graph edges, facts, wiki articles, and citation IDs.
5. Execute cache, vector, lexical, wiki, and graph search only with that allowlist applied.
6. Apply defense-in-depth candidate filtering after search.
7. Generate an answer only from scoped snippets.
8. Filter citations before response.
9. Audit both retained and dropped citations before returning the answer.

Post-search filtering alone is not sufficient. Scoped retrieval must happen before vector or graph search.

## Pre-Retrieval Scope

The selected runtime adapter must receive:

- platform claim snapshot;
- policy version;
- correlation ID;
- request purpose;
- requested domain and module;
- published snapshot version;
- candidate metadata from `docs/spec/knowledge-ingestion-event.schema.json`;
- resource classification, jurisdiction, assignment, legal hold, source status, source version, projection version, and redaction decision.

The adapter must deny or drop a candidate before search when:

- claim validation fails;
- server verification is absent;
- module, domain, permission, org, jurisdiction, assignment, purpose, MFA, or clearance fails;
- legal hold blocks the purpose;
- source status is deleted, sealed, purged, superseded, inaccessible, or unknown;
- source or projection version is missing;
- projection freshness cannot be established;
- redaction decision is incomplete;
- `storage_uri_exposed` is true;
- candidate metadata lacks a citation ID.

The output of scope resolution is an immutable scope token or equivalent signed server-side object. Search code may not widen this scope.

## Vector, Graph, Wiki, and Cache Rules

Vector search must restrict candidate embeddings before nearest-neighbor search by workspace/domain plus scoped document or chunk identifiers. If an index cannot apply candidate IDs before search, that index is not approved for platform knowledge queries.

Graph search must restrict traversal seeds, nodes, edges, facts, and related chunk expansion to scoped IDs before graph traversal. Graph paths that include an unauthorized node, edge, assertion, or source chunk are dropped before answer generation.

Wiki selection must restrict articles by scoped source chunks and snapshot version. Wiki text can frame retrieval, but legally material answer claims must still be supported by scoped source chunks.

Cache lookup must include the scope token, policy version, snapshot version, clearance, purpose, and redaction profile in its key. A broader cached answer must never satisfy a narrower query.

## Citation Filtering

Citation filtering runs after answer generation and before response. It is not optional because models can produce stale or hallucinated citations even when generation context was scoped.

A response citation is retained only when:

- citation ID is in the pre-retrieval allowed set;
- cited source record is from the selected published snapshot;
- cited classification is within claim clearance;
- cited jurisdiction and assignment still match;
- redaction decision remains complete;
- citation text does not reveal fields listed in `fields_redacted`;
- citation audit event is appended successfully.

Dropped citations are audited with the drop reason. If all citations are dropped, the answer must be withheld or replaced with a no-answer response.

## Audit Evidence

Every retrieval attempt records:

- correlation ID;
- query hash, not raw sensitive query text where policy requires masking;
- claim snapshot and validation result;
- policy version and entitlement policy version;
- selected runtime and snapshot version;
- pre-retrieval scope inputs and allowed counts;
- vector, graph, wiki, lexical, and cache search plan with scoped IDs or scope token;
- candidate counts before and after defense-in-depth filtering;
- generated citation IDs before filtering;
- retained and dropped citation IDs with reasons;
- final outcome and response citation IDs.

Audit payloads must not log passwords, tokens, storage URIs, raw PII values, or real sensitive case narrative.

## Tests

P10 introduces two proof layers:

- `apps/platform-api/src/__tests__/knowledge-scope-contract.test.ts` proves the platform gate remains blocked and models pre-retrieval scope plus citation filtering against platform ABAC fixture claims.
- `/Users/n15318/RAG-app/apps/api/src/__tests__/retrieval/platform-scope-contract.test.ts` proves the selected RAG-app runtime contract filters candidates before vector or graph search and filters citations before response.

These tests use synthetic candidates only. They are a contract for the later integration phase; passing them does not activate the platform knowledge route.

