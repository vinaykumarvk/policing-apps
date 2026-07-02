# Policing Platform Integration Execution Plan

Version: 1.0-final  
Path: full after discovery approval  
Source architecture: `docs/discovery/policing-platform/holistic-architecture.md`  
Council status: revised after adversarial evaluation

## 1. Objective

Consolidate the existing police application portfolio into one repository and one user-facing platform while preserving bounded domain ownership for:

- DOPAMS intelligence operations;
- Social Media Intelligence;
- Forensic digital analysis;
- IQW complaint and investigation intake;
- Justice Knowledge/RAG.

The first integrated release must prove the platform control plane before broad consolidation. It must provide a single platform entrypoint, central identity and entitlement resolution, deny-by-default authorization decision evidence, a pilot DOPAMS plus IQW cross-runtime integration, one pilot case projection, one pilot evidence metadata projection, and a local one-product deployment profile. Other modules may be listed as planned modules, but no route may appear as available until the target domain enforces platform claims server-side.

## 2. Classification

Selected process path: full.

Rationale: this is a foundational platform integration across multiple apps, data stores, auth boundaries, evidence workflows, legal/justice knowledge, and police-sensitive data. Implementation changes will touch architecture, deployment, auth, data projections, API contracts, UI shell, and regulated data handling.

## 3. Scope

### In Scope for Integration Release 1

- Repository consolidation plan and import hygiene.
- Platform app shell.
- Platform API/gateway.
- App registry and entitlement-driven navigation.
- Central platform auth claim contract.
- Module entitlement model.
- Record-level ABAC policy, data classification, redaction, and threat model.
- Immutable authorization decision evidence for allow and deny outcomes.
- One TypeScript domain adapter, using DOPAMS as the pilot unless blocked.
- Python IQW gateway/middleware validation.
- One pilot canonical case index projection across DOPAMS and IQW.
- One pilot evidence metadata projection across DOPAMS and IQW.
- Justice Knowledge runtime decision spike, without platform query UI until scoped retrieval is proven.
- Local integrated deployment profile.
- Validation suite for entitlement visibility, server-side authz, case/evidence projections, health checks, and smoke routing.

### Out of Scope for Release 1

- Full rewrite of IQW from Python to TypeScript.
- Full UI unification of all domain screens into one React route tree.
- Full domain database migration into one schema.
- Replacement of all domain-specific audit logs.
- Production data migration.
- New police features beyond integration surfaces.
- External AI enablement for police data without written approval metadata and masking policy.
- Broad platform route exposure for Social Media, Forensic, and Knowledge before each service enforces platform claims server-side.

## 4. Architectural Bet

The integration will use a platform shell over bounded services:

```text
platform-web -> platform-api/gateway -> bounded domain APIs
                                      -> platform projections
                                      -> knowledge API/worker
```

This is not a UI-only launcher. Platform API will own identity, entitlement resolution, app registry, canonical case/evidence projections, health aggregation, and cross-domain read APIs. Domain services remain authoritative for their own operational records.

## 5. Workstreams

### WS-00: Safety, Inventory, and Repository Hygiene

Purpose: prevent secret leakage and integration drift before importing or moving code.

Tasks:

- Freeze source repositories: `policing-apps`, `compliant-parser`, `RAG-app`.
- Confirm excluded repos: PUDA workflow, PS-WMS, HRMS, custody dashboard unless user changes scope.
- Run secret scan on source repos and local workspaces.
- Quarantine or rotate local secrets, especially `compliant-parser/.env` and `compliant-parser/credentials/wealth-report-sa.json`.
- Capture current app inventory: commands, ports, env vars, migrations, health endpoints, Dockerfiles, DBs, tests.
- Record current domain route prefixes and auth behavior.

Deliverables:

- `docs/spec/source-inventory.md`
- `docs/spec/secret-hygiene-report.md`
- `docs/spec/import-map.yaml`

Exit criteria:

- No known real secrets in files selected for import.
- User approves exact repos and subtrees to consolidate.

### WS-01: Monorepo Target Structure

Purpose: create the target layout without breaking existing apps.

Tasks:

- Define target tree: `apps/platform-web`, `apps/platform-api`, `domains/*`, `packages/*`, `migrations/*`, `deploy/*`.
- Keep current apps runnable during migration.
- Add ownership conventions for TypeScript and Python domains.
- Define package naming and import policy.
- Add root scripts for platform-only, domain-only, and full integrated checks.

Deliverables:

- `docs/spec/repo-layout.md`
- root workspace/package plan
- target import sequence

Exit criteria:

- All existing apps have a mapped target path.
- No build/test command is removed without replacement.

### WS-02: Platform Identity and Entitlements Contract

Purpose: create one source of truth for access decisions.

Tasks:

- Define canonical auth claim payload.
- Define entitlement dimensions: module, domain permission, org scope, jurisdiction, clearance, assignment, purpose, MFA state.
- Define platform tables and migrations.
- Map existing DOPAMS/Social/Forensic roles to platform roles.
- Map IQW roles to platform roles.
- Decide SSO/OIDC/LDAP/local bootstrap order.
- Define API contract for `/api/v1/platform/me`, `/api/v1/platform/apps`, and `/api/v1/platform/entitlements/check`.
- Produce versioned claim fixtures and golden seed personas used by TypeScript and Python tests.

Deliverables:

- `docs/spec/auth-entitlements-contract.md`
- platform auth/entitlement migration draft
- entitlement seed data for pilot users
- `docs/spec/auth-claim-fixtures.json`

Exit criteria:

- Domain services can make server-side allow/deny decisions from platform claims.
- UI shell visibility is explicitly non-authoritative.
- The app registry marks a module `available` only when that domain enforces platform claims server-side.

### WS-02.5: Data Classification, ABAC, and Decision Evidence

Purpose: make cross-domain access defensible before any route, projection, or knowledge result is exposed.

Tasks:

- Define classification levels and field-level redaction behavior for platform records.
- Define ABAC inputs: module, domain permission, org scope, jurisdiction, assignment, clearance, purpose, MFA state, legal hold, source record status, and policy version.
- Threat-model platform route exposure, projections, evidence metadata, and RAG retrieval.
- Define deny-by-default behavior for missing/stale claims, missing policy, stale projection, source deletion, and legal hold conflicts.
- Define immutable decision evidence for every allow/deny: user identity, claims snapshot, policy version, source record version, projection version, redaction decision, retrieval path, route/service path, outcome, and correlation ID.
- Define `storage_uri` handling: do not return storage URIs from central evidence APIs unless explicitly approved and audited.
- Add negative test matrix before WS-03/04 mark any domain as available.

Deliverables:

- `docs/spec/access-control-threat-model.md`
- `docs/spec/data-classification-policy.md`
- `docs/spec/authorization-decision-evidence.md`
- platform decision evidence migration draft
- ABAC negative test matrix

Exit criteria:

- Every platform read path has a deny-by-default policy and audit evidence contract.
- No domain route can be marked available without a passing claim-validation and decision-evidence test.
- Field-level redaction is defined for `platform_case` and `platform_evidence`.

### WS-03: Platform API and App Registry

Purpose: expose the first platform control plane.

Tasks:

- Create `apps/platform-api`.
- Reuse `@puda/api-core` app builder where practical.
- Add platform health/readiness aggregation.
- Add app registry endpoint with entitled modules, route metadata, and availability state: `planned`, `pilot`, `available`, `blocked`.
- Add reverse-proxy route map contract for existing apps.
- Add audit event envelope for platform-level actions.
- Enforce that unavailable modules never receive active launch links.

Deliverables:

- `apps/platform-api`
- platform OpenAPI contract
- app registry config

Exit criteria:

- Sample users receive different app lists based on entitlements.
- Only domains with server-side platform-claim enforcement can be launched.
- Health endpoint reports platform and domain service readiness.

### WS-04: Platform Web Shell

Purpose: provide the single user-facing platform entrypoint.

Tasks:

- Create `apps/platform-web`.
- Build login/session-aware shell.
- Render entitled app navigation from platform API.
- Add landing dashboard with module cards, global search placeholder, unified inbox placeholder, and Case 360 placeholder.
- Link only platform-claim-enforced apps through proxy paths initially.
- Render non-integrated apps as planned/blocked modules without active route exposure.
- Use shared UI/i18n/theme patterns from current React apps.

Deliverables:

- `apps/platform-web`
- shell route map
- app registry UI tests

Exit criteria:

- User can sign in and see only entitled modules.
- DOPAMS and IQW pilot paths are reachable only after server-side enforcement passes.
- Non-pilot modules are visible only as planned modules unless explicitly enabled by gate.

### WS-05: Pilot Domain Auth Adapters

Purpose: make existing services trust platform identity without weakening their internal authorization.

Tasks:

- Add TypeScript middleware package for platform claim verification.
- Adapt one pilot TypeScript service first, preferably DOPAMS.
- Add Python FastAPI middleware or gateway validation for IQW.
- Decide whether RAG/Knowledge uses service-to-service API key plus user context or direct platform JWT, but do not expose knowledge query UI yet.
- Add negative tests for missing, expired, wrong-module, wrong-clearance, and wrong-jurisdiction claims.
- Add revocation behavior tests and local break-glass expiry rules.

Deliverables:

- `packages/authz`
- domain adapter docs
- cross-runtime JWT verification tests

Exit criteria:

- DOPAMS and IQW can reject unauthorized platform claims.
- Existing local auth remains available only as break-glass/bootstrap until decommissioned.
- The app registry can mark DOPAMS and IQW as `pilot`.

### WS-06: Pilot Canonical Case Index Projection

Purpose: enable read-only cross-domain case visibility without merging domain schemas.

Tasks:

- Define `platform_case` and `platform_case_link` tables.
- Build pilot read adapters/outbox projection contracts for DOPAMS `dopams_case` and IQW cases.
- Define later adapters for Social Media, Forensic, and Knowledge as planned extensions only.
- Add projection backfill job for pilot local/demo data.
- Add Case 360 summary endpoint.
- Add record-level entitlement checks.
- Add stale-state handling: source version, projection version, TTL, deletion/retention behavior, and conflict policy.

Deliverables:

- `packages/case-core`
- platform case migrations
- projection adapters
- Case 360 read API

Exit criteria:

- A pilot case can show linked domain records without copying all domain fields.
- Unauthorized users receive redacted or denied responses.
- Every allow/deny records decision evidence.

### WS-07: Pilot Canonical Evidence Registry Projection

Purpose: provide a shared view of evidence metadata and legal-hold state.

Tasks:

- Define `platform_evidence` and `platform_evidence_link` tables.
- Project pilot DOPAMS evidence metadata and IQW documents.
- Define later adapters for Social Media `evidence_item`, Forensic `evidence_source`, and RAG evidence exports as planned extensions only.
- Normalize hash, storage URI/reference, classification, legal hold, and chain-of-custody head.
- Add evidence summary endpoint for Case 360.
- Add audit event for every evidence read/export request.
- Do not return storage URI by default; return opaque evidence reference unless policy explicitly allows URI release.
- Add stale-state handling and legal-hold conflict handling.

Deliverables:

- `packages/evidence-core`
- platform evidence migrations
- projection adapters

Exit criteria:

- Evidence metadata can be viewed centrally while detailed content remains domain-owned.
- Legal hold and clearance constraints are enforced in platform API.
- Every evidence read/export records immutable decision evidence.

### WS-08: Knowledge Runtime Decision and Retrieval-Security Proof

Purpose: avoid duplicate RAG/KIS systems.

Tasks:

- Compare RAG-app and KIS against ingestion, graph, wiki, snapshots, BNS reasoning, provider governance, PII masking, citations, domain isolation, deployment, and tests.
- Select target runtime.
- Define migration path for rejected runtime features.
- Define platform knowledge query contract.
- Prove retrieval scoping before vector/graph search and citation filtering before response.
- Add service-to-service ingestion event contract for complaint/FIR docs, forensic reports, social evidence packages, and DOPAMS docs.
- Add user-context-scoped knowledge query from platform shell only after scoped retrieval and citation filtering tests pass.

Deliverables:

- `docs/spec/knowledge-runtime-decision.md`
- knowledge API contract
- ingestion event schema

Exit criteria:

- Only one long-term knowledge runtime is selected.
- Platform can query legal knowledge with citations under user clearance only after pre-retrieval scoping is verified.

### WS-09: Integrated Local Deployment

Purpose: prove one-product deployment before UI/domain rewrites.

Tasks:

- Add integrated Docker Compose profile for platform-web, platform-api, DOPAMS, IQW, Postgres/pgvector, object storage, Redis/queue, and stubs/health contracts for non-pilot services.
- Add reverse proxy path routing.
- Add seed users and entitlements.
- Add health/readiness checks and startup ordering.
- Add smoke script for login, app registry, domain route reachability, and case/evidence projection readiness.
- Add warnings that local Compose does not prove production cookie/JWT, CSRF, service-to-service trust, token revocation, or reverse-proxy safety.

Deliverables:

- `deploy/docker-compose/policing-platform.yml`
- reverse proxy config
- smoke scripts

Exit criteria:

- A developer can start the integrated platform locally from one command.
- All critical services report ready or degraded with actionable reasons.
- DOPAMS and IQW route smoke tests pass; non-pilot services remain planned/blocked.

### WS-10: Verification, Governance, and Release Gate

Purpose: prevent an integrated demo from hiding security or data-boundary failures.

Tasks:

- Add tests for entitlement visibility and server-side enforcement.
- Add projection tests with unauthorized cases/evidence.
- Add audit completeness tests.
- Add dependency and secret scanning.
- Add DAST/SAST plan for platform API.
- Add release gate checklist and rollback plan.
- Add operational cutover governance: active investigation freeze/transition rules, audit continuity, legal hold continuity, incident response, emergency revocation, access reviews, stale projection remediation, and rollback ownership.

Deliverables:

- `docs/spec/release-gate.md`
- test plan and CI matrix
- rollback runbook
- `docs/spec/cutover-governance-runbook.md`
- `docs/spec/run-state-governance.md`

Exit criteria:

- Release 1 cannot pass if unauthorized app/case/evidence access is possible.
- Rollback preserves domain apps in their pre-integration state.
- The platform can prove why each pilot case/evidence/knowledge access was allowed or denied.

## 6. Dependency Order

1. WS-00 Safety and inventory.
2. WS-02 Auth and entitlement contract.
3. WS-02.5 Data classification, ABAC, and decision evidence.
4. WS-01 Repo target structure.
5. WS-03 Platform API and app registry.
6. WS-04 Platform Web Shell.
7. WS-05 Pilot domain auth adapters.
8. WS-09 Integrated local deployment health contracts.
9. WS-06 Pilot case projection.
10. WS-07 Pilot evidence projection.
11. WS-08 Knowledge runtime decision and retrieval-security proof.
12. WS-10 Verification, governance, and release gate.

Parallelizable groups:

- WS-01 repo mapping can run in parallel with WS-02/02.5, but imports wait for secret hygiene.
- WS-03 and WS-04 can start after WS-02/02.5 contracts are drafted, but route launch waits for WS-05 gate.
- WS-06 and WS-07 can design schemas in parallel, but implementation waits for DOPAMS/IQW auth gates and decision evidence.
- WS-08 comparison can run in parallel, but platform query UI waits for retrieval-security proof.
- WS-09 health contracts start early; full route smoke waits for WS-05.

## 7. Acceptance Criteria

- AC-01: One platform URL presents entitled modules for a signed-in user.
- AC-02: A user without a module entitlement cannot see or access that module through UI or API.
- AC-03: DOPAMS and IQW have pilot route entries; Social Media, Forensic, and Knowledge are planned/blocked until their server-side claim enforcement gates pass.
- AC-04: DOPAMS and IQW enforce platform claim validation server-side before active links appear.
- AC-05: Case 360 read endpoint returns one linked DOPAMS/IQW pilot case.
- AC-06: Evidence registry read endpoint returns metadata only, excludes `storage_uri` by default, and enforces clearance/legal-hold constraints.
- AC-07: Knowledge runtime decision is complete; platform query UI is enabled only if scoped retrieval and citation filtering tests pass.
- AC-08: Integrated local deployment starts from one documented command.
- AC-09: Audit records exist for login, app launch, entitlement denial, case read, evidence read, and knowledge query.
- AC-10: Secret scan and import hygiene report are complete before importing external repo content.
- AC-11: Every allow/deny decision stores claims snapshot, policy version, source record version, redaction decision, retrieval/service path, outcome, and correlation ID.
- AC-12: Operational cutover and run-state governance are documented before any production pilot.

## 8. Test Strategy

Unit tests:

- entitlement resolution;
- app registry filtering;
- JWT/claim validation;
- ABAC policy evaluation;
- field-level redaction;
- authorization decision evidence serialization;
- case/evidence projection mapping;
- knowledge query request shaping.

Integration tests:

- platform login/session;
- module access allowed/denied;
- domain service claim validation;
- case projection backfill;
- evidence metadata projection;
- health aggregation.
- stale projection deny/degrade behavior;
- legal hold conflict behavior;

E2E smoke:

- sign in as each seed persona;
- verify visible app list differs by entitlement;
- open each domain route;
- verify planned/blocked modules do not expose active links;
- open Case 360 pilot case;
- attempt unauthorized module and evidence access;
- run knowledge query and verify citations.

Security checks:

- no secrets in imported files;
- auth tokens use httpOnly cookies or approved bearer flow;
- no domain API trusts UI-only state;
- all list endpoints bounded;
- every platform mutation has authorization and audit.
- retrieval scoping occurs before vector/graph search;
- decision evidence is immutable enough for audit review.

## 9. Rollback and Retry Policy

- Repository import rollback: remove imported subtree before migration commits are merged; never rewrite user changes without explicit approval.
- Platform shell rollback: route users directly to existing domain apps.
- Auth adapter rollback: keep domain-local auth enabled as break-glass until platform auth passes security tests.
- Projection rollback: disable projection consumers; domain databases remain authoritative and unchanged.
- Knowledge integration rollback: disable platform knowledge route; keep existing RAG/KIS service standalone.
- Deployment rollback: revert reverse proxy to previous per-app service URLs.
- Cutover rollback: preserve original domain auth and audit trails until platform access history is reconciled and signed off.

## 10. Open Decisions

- OD-01: Include or exclude PUDA/citizen/officer workflows from the first platform.
- OD-02: Cloud Run first, on-prem first, or dual-profile from day one.
- OD-03: Authoritative identity provider.
- OD-04: Final knowledge runtime: RAG-app, KIS, or merged target.
- OD-05: Required clearance levels and jurisdiction hierarchy.
- OD-06: First release module subset.
- OD-07: Whether public/citizen complaint intake is required.

## 11. Known Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Secret leakage during import | High | Secret scan, rotation, import allowlist, block known local secret files. |
| UI-only entitlement bypass | High | Server-side platform and domain checks; negative tests. |
| Duplicate RAG/KIS runtime | High | Make knowledge runtime decision before integration work. |
| Cross-jurisdiction data exposure | High | Case/evidence projection redaction and scope tests. |
| Read-only metadata leakage | High | Field-level redaction, no default storage URI, purpose checks, decision evidence. |
| Authorization drift across platform/domain/local auth | High | Short-lived break-glass, platform claim enforcement gate, access review cadence. |
| RAG retrieval leakage | High | Pre-retrieval scope filtering, citation filtering, answer journey audit. |
| Audit discontinuity during cutover | High | Cutover governance runbook and immutable decision evidence. |
| Full rewrite pressure delays value | High | Keep bounded services for Release 1. |
| Python/TypeScript auth mismatch | Medium | Define cross-runtime claim contract and verify in both runtimes. |
| Local integrated deployment becomes production architecture by accident | Medium | Separate local, UAT, Cloud Run, and on-prem profiles with explicit constraints. |
| Existing domain workflows regress | Medium | Keep domains independently runnable and preserve existing test commands. |

## 12. First Action

Run WS-00 and WS-02/WS-02.5 as the first implementation tranche: create the source inventory and secret hygiene report, then define the platform claim contract, ABAC/data-classification policy, and immutable decision-evidence contract before exposing any active platform routes.
