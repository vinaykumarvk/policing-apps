---
name: brd-coverage
description: Full BRD audit — maps requirements to implemented code and test coverage. Produces a traceability report with gap analysis, coverage scorecard, and compliance verdict.
argument-hint: "[system] [phase]"
---

# BRD Coverage Audit

Perform a full BRD audit: map every requirement to implemented code and test coverage. Produce a traceability report with gap analysis, coverage scorecard, and compliance verdict.

## Scoping

Parse the user's arguments to determine scope:

- **Single system**: `/brd-coverage DOPAMS` — audit one system only.
- **Phase filter**: `/brd-coverage Forensic code-only` — run only code traceability (skip test coverage).
- **No arguments**: audit all systems with full analysis.

Phase keywords:

| Keyword | Phases Run |
|---------|------------|
| `code-only` | Phases 0-2 only (preflight + requirement extraction + code traceability) |
| `test-only` | Phases 0-1, 3 only (preflight + requirement extraction + test coverage) |
| `full` (default) | All phases 0-5 |

System name mapping:

| Argument (case-insensitive) | BRD File | App Directory | TC File | Report Output |
|-----------------------------|----------|---------------|---------|---------------|
| `DOPAMS` | `docs/policing_apps_brd/DOPAMS_Refined_BRD_AI_Ready.md` | `apps/dopams-api/` | `docs/test-cases/DOPAMS_Functional_Test_Cases.md` | `docs/reviews/brd-coverage-dopams-{YYYY-MM-DD}.md` |
| `Forensic` | `docs/policing_apps_brd/Refined_BRD_Forensic_AI_Platform.md` | `apps/forensic-api/` | `docs/test-cases/Forensic_Functional_Test_Cases.md` | `docs/reviews/brd-coverage-forensic-{YYYY-MM-DD}.md` |
| `SocialMedia` | `docs/policing_apps_brd/TEF_AI_Social_Media_Refined_BRD_v2.md` | `apps/social-media-api/` | `docs/test-cases/SocialMedia_Functional_Test_Cases.md` | `docs/reviews/brd-coverage-socialmedia-{YYYY-MM-DD}.md` |

Also search the corresponding UI app (`apps/{dopams,forensic,social-media}-ui/`) for frontend implementation evidence.

## Operating Rules

- Evidence-first: cite exact file paths and line numbers for every implementation claim.
- Separate `confirmed` evidence from `inferred` conclusions.
- Never claim a requirement is implemented unless you found concrete code evidence.
- If evidence is ambiguous, mark as `PARTIAL` with explanation.
- Search broadly: routes, migrations, models, UI components, workflows, middleware, tests.
- Use multiple search strategies per requirement (route names, table names, field names, UI labels).
- Prioritize: Data integrity requirements > Security requirements > Core workflow > Supporting features.

## Phase 0 — Preflight

Capture and report:

1. **BRD location**: Confirm BRD file exists and is readable.
2. **App directory**: Confirm app source directory exists. List key subdirectories (routes, migrations, models, tests).
3. **Test files**: Locate unit tests (`src/__tests__/`), E2E tests (`e2e/tests/`), and functional test case docs (`docs/test-cases/`).
4. **Current state**: Git branch, commit hash.
5. **Tech stack**: Confirm frameworks (Fastify, React, PostgreSQL) and testing tools.
6. **Scope summary**: Number of FRs to audit, phase filter if any, exclusions.

Output a preflight block so readers understand coverage boundaries.

## Phase 1 — Requirement Extraction

Read the BRD and extract a structured inventory of all requirements:

### Functional Requirements (FR)

For each FR, extract:

- **FR ID and title**
- **Acceptance Criteria** (AC-nn) — each is a testable assertion
- **Business Rules** (BR-nn) — constraints and validation logic
- **Priority** (if stated in BRD)

### Scope Items (SCP)

- **In-scope** (SCP-IS-nn): features explicitly committed to
- **Out-of-scope** (SCP-OS-nn): features explicitly excluded — do NOT look for these in code

### Constraints (CNS)

- **CNS-nn**: Technical or business constraints (performance targets, data limits, compliance requirements)

### Non-Functional Requirements (NFR)

- If the BRD has NFRs, extract them but mark as `NFR` category (separate from functional traceability)

Produce a requirements inventory table:

| ID | Type | Title | AC Count | BR Count | Priority |
|----|------|-------|----------|----------|----------|

## Phase 2 — Code Traceability

For each FR and its ACs/BRs, search the codebase for implementation evidence.

### Search Strategy

For each requirement, search across these layers:

1. **API routes**: `apps/{system}-api/src/routes/` — endpoint definitions, request handlers
2. **Database**: `apps/{system}-api/migrations/` — schema definitions, tables, columns, indexes
3. **Business logic**: `apps/{system}-api/src/` — services, utilities, middleware, validators
4. **UI components**: `apps/{system}-ui/src/` — React components, pages, forms
5. **Shared packages**: `packages/shared/` — shared schemas, types, utilities
6. **Workflow configs**: service pack workflow definitions if applicable

### Search Techniques

- Search by **keywords** from the FR title and description
- Search by **entity names** (table names, column names, route paths)
- Search by **AC/BR identifiers** if referenced in code comments
- Search by **UI screen references** (SCR-nn) from the BRD

### Verdict per Requirement

| Verdict | Criteria |
|---------|----------|
| `IMPLEMENTED` | Clear, complete code evidence covering all ACs for this FR |
| `PARTIAL` | Some ACs implemented, others missing; or implementation exists but incomplete |
| `NOT_FOUND` | No code evidence found for any AC in this FR |

### Output Format

Per-FR traceability table:

| FR ID | FR Title | Verdict | Evidence (file:line) | ACs Covered | ACs Missing | Notes |
|-------|----------|---------|----------------------|-------------|-------------|-------|

For `PARTIAL` verdicts, detail which specific ACs are implemented and which are missing.

## Phase 3 — Test Coverage

For each FR, check for test coverage across three layers:

### Layer 1: Functional Test Cases (docs)

- Search `docs/test-cases/{System}_Functional_Test_Cases.md` for TC IDs referencing this FR.
- Count test cases per FR and note priority spread.

### Layer 2: Unit/Integration Tests (code)

- Search `apps/{system}-api/src/__tests__/` for test files covering this FR's functionality.
- Look for test descriptions, route tests, service tests that exercise this FR's logic.
- Check for both positive and negative test cases.

### Layer 3: E2E Tests

- Search `apps/{system}-api/e2e/tests/` or `e2e/tests/` for end-to-end test scenarios.
- Look for user journey tests that exercise this FR's workflow.

### Verdict per Requirement

| Verdict | Criteria |
|---------|----------|
| `COVERED` | Functional TCs exist AND (unit tests OR E2E tests) cover this FR |
| `PARTIAL` | Only functional TCs exist, OR only code tests exist, OR coverage is incomplete |
| `MISSING` | No test coverage found at any layer |

### Output Format

Per-FR test coverage table:

| FR ID | FR Title | Doc TCs | Unit Tests | E2E Tests | Verdict | Gaps |
|-------|----------|---------|------------|-----------|---------|------|

## Phase 4 — Gap Analysis

Synthesize findings from Phases 2 and 3 into gap categories:

### A) Unimplemented Requirements

Requirements in the BRD with `NOT_FOUND` code verdict:

| FR ID | Title | Priority | Impact | Recommendation |
|-------|-------|----------|--------|----------------|

Impact: `HIGH` (core functionality), `MEDIUM` (supporting feature), `LOW` (nice-to-have).

### B) Untested Requirements

Requirements with code implementation but `MISSING` test verdict:

| FR ID | Title | Code Verdict | Test Gap | Risk |
|-------|-------|-------------|----------|------|

Risk: `HIGH` (critical path untested), `MEDIUM` (important feature untested), `LOW` (edge case untested).

### C) Partially Implemented Requirements

Requirements with `PARTIAL` code or test verdicts — detail what's missing:

| FR ID | Title | What's Implemented | What's Missing | Effort to Complete |
|-------|-------|--------------------|----------------|-------------------|

Effort: `S` (< 2 hours), `M` (2 hours – 2 days), `L` (> 2 days).

### D) Orphan Code

Code that doesn't trace to any BRD requirement:

- Routes with no FR mapping
- Database tables/columns with no requirement backing
- UI screens not referenced in BRD

Note: orphan code is not necessarily bad — it may be infrastructure, utilities, or future-proofing. Flag but don't treat as a defect.

## Phase 5 — Scorecard and Verdict

### Coverage Metrics

Calculate and report:

```
Code Coverage:  {implemented + partial} / {total FRs} × 100%
  - Fully Implemented: {count} / {total}
  - Partially Implemented: {count} / {total}
  - Not Found: {count} / {total}

Test Coverage:  {covered + partial} / {total FRs} × 100%
  - Fully Covered: {count} / {total}
  - Partially Covered: {count} / {total}
  - Missing: {count} / {total}
```

### Gap Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| P0 | {n} | Unimplemented core requirements or critical untested paths |
| P1 | {n} | Partial implementations of important features |
| P2 | {n} | Missing test coverage for implemented features |
| P3 | {n} | Minor gaps, edge cases, nice-to-have coverage |

### Compliance Verdict

| Verdict | Criteria |
|---------|----------|
| `COMPLIANT` | Code coverage ≥ 90% AND test coverage ≥ 80% AND zero P0 gaps |
| `GAPS-FOUND` | Code coverage ≥ 70% AND test coverage ≥ 50% AND ≤ 2 P0 gaps |
| `AT-RISK` | Code coverage < 70% OR test coverage < 50% OR > 2 P0 gaps |

### Verdict Block

```text
System:              {system name}
BRD FRs:             {total FR count}
Code Coverage:       {percentage}% ({implemented}/{total} fully, {partial}/{total} partially)
Test Coverage:       {percentage}% ({covered}/{total} fully, {partial_test}/{total} partially)
P0 Gaps:             {count}
P1 Gaps:             {count}
P2 Gaps:             {count}
P3 Gaps:             {count}
Compliance Verdict:  [COMPLIANT | GAPS-FOUND | AT-RISK]
```

### Top 5 Priority Actions

List the 5 most impactful actions to improve coverage, ordered by priority:

| # | Action | FR(s) Affected | Impact | Effort |
|---|--------|----------------|--------|--------|
| 1 | ... | ... | ... | ... |

## Output

Final report sections in order:

1. Preflight Summary
2. Requirements Inventory
3. Code Traceability Matrix
4. Test Coverage Matrix
5. Gap Analysis (Unimplemented, Untested, Partial, Orphan)
6. Coverage Scorecard and Verdict
7. Top 5 Priority Actions

### Output File

Write to: `docs/reviews/brd-coverage-{system}-{YYYY-MM-DD}.md`

Use lowercase system slug: `dopams`, `forensic`, `socialmedia`.

If `docs/reviews/` does not exist, create it.

If running for all systems, produce one report per system.

## Quality Checklist

Before finalizing output, verify:

```
□ Every FR in the BRD appears in the traceability matrix
□ Every verdict has supporting evidence (file:line) or explicit "no evidence found"
□ PARTIAL verdicts detail exactly what's implemented and what's missing
□ Gap analysis covers all three categories (unimplemented, untested, partial)
□ Scorecard percentages are arithmetically correct
□ Verdict follows the defined criteria (not subjective)
□ Top 5 actions are specific and actionable (not generic advice)
□ Out-of-scope items (SCP-OS) are excluded from gap counts
□ Report is saved to the correct output path
```
