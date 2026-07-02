# Council Evaluation: Policing Platform Integration Execution Plan
*2026-07-02 00:06 IST - Framed question: Should the proposed policing-platform integration plan be adopted as the execution path for consolidating DOPAMS, Social Media Intelligence, Forensic, IQW complaint intake, and Justice Knowledge/RAG into one repository and one entitlement-based platform?*

## Chairman's Verdict

### Where the Council Agrees

The council agrees that the architecture direction is sound: one platform entrypoint and one entitlement model, while preserving DOPAMS, Social Media Intelligence, Forensic, IQW, and Justice Knowledge/RAG as bounded services. No advisor recommended a full rewrite or one shared domain schema for Release 1.

The council also agrees that the draft Release 1 was too broad. The safest first release is not "all apps unified"; it is a control-plane proof: platform identity, entitlements, record-level authorization, decision evidence, one TypeScript domain adapter, IQW/Python adapter, and narrow pilot case/evidence projections.

### Where the Council Clashes

The main clash was whether the draft plan could be adopted with small additions or needed sequencing changes. The Proponent argued that the original order was broadly defensible because it starts with secret hygiene and preserves bounded services. The Contrarian, First Principles, Outsider, and peer reviewers found a release-blocking sequencing flaw: the app registry could expose domain routes before every exposed domain enforces platform claims server-side and before record-level ABAC, field classification, stale projection handling, and immutable decision evidence exist.

The chairman sides with the stricter view. The plan is adopted only after revision: active routes are allowed only for domains that pass platform-claim enforcement and decision-evidence gates. Release 1 narrows to DOPAMS plus IQW as the pilot cross-runtime integration.

### Blind Spots Caught

Peer review identified four shared blind spots:

- Operational cutover governance: how live users, active investigations, audit trails, retention/legal holds, incident response, rollback, and dual-running access histories are handled.
- Run-state accountability: who owns access reviews, entitlement changes, stale projection remediation, incident response, emergency revocation, and audit review after launch.
- Defensible authorization evidence: every allow/deny needs user identity, claims snapshot, policy version, source record version, projection version, redaction decision, retrieval/service path, outcome, and correlation ID.
- Operational proof standard over time: entitlement correctness must be continuously regression-tested across import, projection, cache, search/RAG, API, and UI paths, not only proven during a one-time gate.

### Idea Evolution

The idea evolved from "build one repo and platform shell with all modules represented" to "prove the platform control plane first, then widen module exposure." The council preserved the bounded-service architecture but tightened the sequencing. Repository consolidation is now subordinate to access-safety proof. Knowledge integration is now blocked until pre-retrieval scoping and citation filtering are proven. Case/evidence projections are now pilot-only and must carry stale-state behavior and immutable decision evidence.

### Risk Register

| Risk | Severity | Source Advisor | Addressed in Second Pass? | Mitigation |
| --- | --- | --- | --- | --- |
| Platform route exposure before domain server-side claim enforcement | High | Contrarian, Outsider, First Principles, Executor | Yes | App registry states: planned/pilot/available/blocked; no active route until domain claim enforcement gate passes. |
| Read-only metadata leakage | High | Contrarian | Yes | Field-level redaction, opaque evidence references, no default `storage_uri`, purpose checks, decision evidence. |
| Entitlement drift across platform, domain roles, and break-glass auth | High | Contrarian, Executor | Yes | Short-lived break-glass, access reviews, canonical claims, domain adapters, revocation tests. |
| RAG/knowledge leakage through vector/graph retrieval | High | Contrarian | Yes | Prove pre-retrieval scoping and citation filtering before platform query UI. |
| Release 1 breadth creates false certainty | High | First Principles, Outsider, Executor | Yes | Narrow Release 1 to DOPAMS + IQW pilot and control-plane proof. |
| Lack of operational cutover governance | High | Peer Review | Yes | Add cutover governance runbook and run-state governance deliverables. |
| Lack of defensible authorization audit evidence | High | Peer Review | Yes | Add authorization decision evidence contract before projections. |
| Docker Compose creates false production confidence | Medium | Contrarian, Executor | Yes | Local profile marked as dev proof only; production security checks remain separate gates. |
| Secret leakage during source import | High | Proponent, Executor | N/A | WS-00 secret scan, rotation, import allowlist with checksums. |
| Ownership ambiguity | Medium | Outsider, Executor | Yes | Require named owners for platform/API, auth/security, DevOps, Python/IQW, and TS domains. |

### Recommendation

Adopt the platform-shell-over-bounded-services strategy, but use the revised execution plan, not the draft. The first release must be a gated control-plane pilot, not broad consolidation.

### The One Thing to Do First

Run WS-00 and WS-02/WS-02.5 together: complete source inventory/secret hygiene, then define the platform claim contract, ABAC/data-classification policy, and immutable authorization decision-evidence contract before exposing active platform routes.

## Advisor Responses

### Proponent

The Proponent would adopt the plan because it solves the actual integration problem without pretending the portfolio is ready for a rewrite. The plan correctly treats one platform as identity, entitlements, navigation, gateway APIs, and canonical projections while preserving bounded services. The proposed additions were versioned claim fixtures and seed personas, a hard knowledge-runtime decision gate, field-level classification/redaction for `platform_case` and `platform_evidence`, and a checksum import allowlist.

### Contrarian

The Contrarian rejected the draft as written because it could expose a unified platform surface before proving complete record-level authorization and data classification. AC-03 listed all five domains while AC-04 required server-side validation for only one TypeScript domain and IQW. The Contrarian highlighted read-only metadata leakage, entitlement drift, RAG retrieval leakage, and false confidence from local Compose smoke tests. Mitigations: mandatory ABAC/threat-model tests, no route until claim enforcement, no default storage URI, stale-state handling, and scoped knowledge retrieval proof.

### First Principles Thinker

The First Principles Thinker reframed the goal: not one repository, but one authenticated operator experience, one entitlement model, auditable cross-domain access, and safe shared case/evidence/knowledge visibility. A monorepo may help but is not inherently the problem. The simpler robust path is to prove the control plane first, integrate one TypeScript service and IQW/Python, add one pilot projection, and keep other modules as registry entries until authorization and projection models survive negative tests.

### Outsider

The Outsider accepted the architectural direction but found Release 1 too broad and jargon-heavy. Terms like DOPAMS, IQW, KIS, RAG, Case 360, canonical projection, legal hold, clearance, purpose, and break-glass need definitions. The plan also lacked clear ownership for platform API, entitlement conflicts, external AI approval, release gates, and cross-runtime auth correctness. The Outsider recommended stricter gates and delaying knowledge consolidation or broad projections until ownership, identity provider, clearance model, and release subset are decided.

### Executor

The Executor saw the plan as feasible only as a gated program. Critical path: secret/inventory, identity and entitlement contract, platform API, shell, one TypeScript adapter plus IQW adapter, then integrated deployment health contracts. Monday actions: freeze repos, run secret scans, create source inventory/import map, identify pilot users and a DOPAMS/IQW pilot case/evidence fixture, and assign named owners. Case/evidence projections and knowledge integration wait until auth contract and pilot data shape are stable.

## Peer Reviews

Anonymisation mapping:

- A = Contrarian
- B = Proponent
- C = Outsider
- D = Executor
- E = First Principles Thinker

### Peer Review 1

Strongest: Response A, because it identified the concrete AC gap and non-obvious leakage paths. Biggest blind spot: Response B, because it was too ready to adopt the plan and underweighted route exposure before deny-by-default enforcement. Shared miss: operational cutover governance for live users, active investigations, audit continuity, legal holds, incident response, and rollback.

### Peer Review 2

Strongest: Response E, because it separated the real objective from the monorepo artifact and gave a pragmatic release shape. Biggest blind spot: Response B, because it treated broad sequencing as mostly defensible. Shared miss: operational accountability after launch, including access reviews, entitlement changes, incident response, stale projection remediation, audit review, and emergency revocation.

### Peer Review 3

Strongest: Response E, because it centered enforceable entitlement boundaries and a narrow proof path. Biggest blind spot: Response B, because bounded services and read-only projections do not make runtime access safe by themselves. Shared miss: authoritative audit/accountability model for why an operator saw a record at a time, including claims snapshot, policy version, source record version, redaction decision, retrieval path, and outcome.

### Peer Review 4

Strongest: Response E, because it reframed the plan around safe operator use rather than repo mechanics and proposed narrow integration. Biggest blind spot: Response B, because it did not challenge whether the sequencing itself was safe. Shared miss: immutable audit and evidence layer for authorization decisions, projection generation, RAG retrieval, entitlement changes, and denied-access attempts.

### Peer Review 5

Strongest: Response E, because it combined security skepticism, scope reduction, and execution sequencing without overcommitting. Biggest blind spot: Response B, because it treated controls as add-ons when the core order may be wrong. Shared miss: an operational proof standard for entitlement correctness over time: every user/action/record/field decision must be traceable to current source-of-truth claims, deny by default on stale or missing state, and be continuously regression-tested across import, projection, cache, search/RAG, and UI paths.

## Second Pass

### Contested Point

Should Release 1 expose all domain routes in the platform registry while only one TypeScript domain and IQW enforce platform claims, or should route exposure be blocked until each domain passes server-side claim enforcement and ABAC/decision-evidence gates?

### Proponent Revision

The Proponent's strongest original point was speed: the platform can deliver user-visible value quickly by showing one entrypoint and app registry while domains remain bounded. After accounting for the Contrarian's AC gap, the Proponent position changes: the registry may list all modules only as metadata, but active launch links must require domain claim enforcement. This preserves the single platform vision without creating a UI-only launcher.

### Contrarian Revision

The Contrarian accepts bounded-service integration only if the route registry has explicit availability states and no active route is exposed until the target service proves server-side platform-claim validation, ABAC denial behavior, revocation semantics, and decision evidence. The Contrarian also requires read-only projections and RAG retrieval to be treated as sensitive access paths, not harmless summaries.

### Chairman Resolution

The revised plan adopts the Contrarian gate and the First Principles release scope. Release 1 narrows to DOPAMS plus IQW pilot integration, with other modules marked planned/blocked until their own gates pass. WS-02.5 is added for data classification, ABAC, threat model, and decision evidence before platform API/shell exposure.

