# Policing Platform Discovery: Prototype Options

## Option 1: Platform Shell Over Existing Apps

Summary: create a new platform web shell and platform API/gateway in the consolidated monorepo. Keep DOPAMS, Social Media, Forensic, IQW, and RAG as bounded services. Route users to modules based on entitlements.

Pros:

- fastest path to one repository and one entrypoint;
- preserves existing working apps and tests;
- centralizes login, entitlements, navigation, audit fan-out, and app registry first;
- lets IQW remain Python and RAG keep its worker architecture;
- reduces migration risk for police-sensitive data.

Cons:

- duplicate domain UI patterns remain for a while;
- cross-app case/evidence views need adapters;
- still multiple services/databases under one product.

Recommendation: choose this as Phase 1.

## Option 2: One React App, Bounded Backend Services

Summary: migrate each existing UI into route-level domain modules inside `apps/platform-web`, while backends remain bounded services behind a gateway.

Pros:

- one coherent UX;
- route-level entitlements are easier to reason about;
- shared design system, charts, i18n, assistant, and table components;
- domain backends can still scale independently.

Cons:

- more frontend migration work;
- requires navigation, state, API client, and auth normalization;
- needs UI parity tests to avoid regressions.

Recommendation: use as Phase 2 after the shell and entitlements are stable.

## Option 3: Full Modular Monolith Rewrite

Summary: rewrite all domain APIs and UIs into a single TypeScript backend and one React frontend with one database schema.

Pros:

- cleanest conceptual model if started greenfield;
- fewer deployment artifacts;
- easier global transactions in theory.

Cons:

- highest delivery risk;
- loses Python OCR/translation/IQW investment unless rewritten;
- forces RAG/worker pipeline into the wrong runtime shape;
- creates a large blast radius for evidence, intelligence, and legal workflows;
- delays usable consolidation.

Recommendation: do not choose for the first consolidation.

## Option 4: Micro-Frontend Federation

Summary: keep each UI independently built and loaded into a platform shell through module federation or equivalent.

Pros:

- independent domain UI releases;
- smaller initial rewrites;
- platform shell controls login and app registry.

Cons:

- more build/runtime complexity;
- shared dependency/version conflicts;
- weaker UX consistency;
- harder E2E testing.

Recommendation: only consider if teams need independent releases. A monorepo route-module approach is simpler for this portfolio.

