---
name: test-case-generator
description: Generate functional test cases from BRD requirements documents. Reads BRDs from docs/policing_apps_brd/, extracts FRs/ACs/BRs, and produces test case specifications in the established format.
argument-hint: "[system] [fr-range]"
---

# Functional Test Case Generator

Generate comprehensive functional test cases from BRD requirements documents. Produces test case specifications in the established TC ID format with full traceability to functional requirements.

## Scoping

Parse the user's arguments to determine scope:

- **Single system**: `/test-case-generator DOPAMS` — generate for one system only.
- **FR range**: `/test-case-generator Forensic FR-01 FR-05` — generate for a specific FR range within a system.
- **No arguments**: generate for all systems.

System name mapping:

| Argument (case-insensitive) | BRD File | TC Output File | TC ID Prefix |
|-----------------------------|----------|----------------|--------------|
| `DOPAMS` | `docs/policing_apps_brd/DOPAMS_Refined_BRD_AI_Ready.md` | `docs/test-cases/DOPAMS_Functional_Test_Cases.md` | `TC-DOPAMS` |
| `Forensic` | `docs/policing_apps_brd/Refined_BRD_Forensic_AI_Platform.md` | `docs/test-cases/Forensic_Functional_Test_Cases.md` | `TC-FORENSIC` |
| `SocialMedia` | `docs/policing_apps_brd/TEF_AI_Social_Media_Refined_BRD_v2.md` | `docs/test-cases/SocialMedia_Functional_Test_Cases.md` | `TC-SM` |

## Operating Rules

- Evidence-first: every test case must trace back to a specific FR, AC, BR, or constraint in the BRD.
- Use the exact table format and TC ID convention from existing test case documents.
- Priority distribution target: ~40% P1 (critical path), ~40% P2 (important), ~20% P3 (edge/failure).
- Generate 4-6 test cases per FR: happy path (AC coverage), business rule validation (BR), edge cases, failure/error scenarios, security/access control where applicable.
- Pre-conditions must be specific and testable (concrete user IDs, roles, data states).
- Test steps must be numbered and include both UI and API verification where relevant.
- Expected results must be precise and verifiable (HTTP status codes, field values, state transitions).
- Never invent requirements — only generate test cases for what the BRD explicitly states.
- If the BRD is ambiguous on a requirement, note it in the test description with `[BRD-AMBIGUOUS]`.

## Phase 0 — Preflight

Before generating test cases:

1. **Locate BRD**: Read the BRD file for the target system(s). If not found, report error and stop.
2. **Check existing test cases**: Read existing test case file in `docs/test-cases/` if it exists.
3. **Determine delta scope**: If existing test cases exist, identify which FRs already have coverage and which are new/changed.
4. **Report preflight summary**: System name, BRD location, FR count, existing TC count (if any), delta scope.

Output a preflight block so the user understands the generation scope.

## Phase 1 — BRD Analysis

For each FR in scope, extract:

- **FR ID and title** (e.g., FR-01: Identity, Access Control, Approvals, and Audit).
- **Acceptance Criteria** (AC-01, AC-02, ...) — each AC becomes at least one happy-path test case.
- **Business Rules** (BR-01, BR-02, ...) — each BR becomes at least one validation test case.
- **Constraints** (CNS-*) — boundary conditions, limits, thresholds.
- **Scope items** (SCP-IS-*, SCP-OS-*) — in-scope items need coverage, out-of-scope items are excluded.
- **Edge cases and failure modes** — infer from AC/BR descriptions (e.g., "must not exceed", "if unavailable", "when duplicate").
- **Security/access control requirements** — role-based access, jurisdiction scoping, audit logging.
- **Integration points** — external systems, connectors, APIs referenced in the FR.

Produce a structured FR inventory table before generating test cases.

## Phase 2 — Test Design

For each FR, generate test cases covering these categories:

### Category 1: Happy Path (AC Coverage)
- One test case per AC demonstrating the expected behavior when all preconditions are met.
- Priority: P1 for core functionality, P2 for supporting features.

### Category 2: Business Rule Validation (BR)
- One test case per BR verifying the rule is enforced.
- Include both valid (rule satisfied) and invalid (rule violated) scenarios.
- Priority: P1 for data integrity rules, P2 for operational rules.

### Category 3: Edge Cases
- Boundary conditions (min/max values, empty inputs, large payloads).
- Concurrent operations (two users editing the same record).
- State transition edge cases (action on already-completed item).
- Priority: P2 or P3.

### Category 4: Failure Scenarios
- External dependency failures (DB down, service unavailable).
- Invalid input handling (malformed data, missing required fields).
- Timeout and retry behavior.
- Priority: P2 for graceful degradation, P3 for rare failure modes.

### Category 5: Security & Access Control
- Role-based access verification (authorized vs unauthorized).
- Jurisdiction scoping enforcement.
- Audit trail generation verification.
- Priority: P1 for access control, P2 for audit logging.

### TC ID Format

`TC-{SYSTEM}-FR{nn}-{nnn}`

- `{SYSTEM}`: `DOPAMS`, `FORENSIC`, or `SM`
- `{nn}`: FR number, zero-padded to 2 digits (e.g., `FR01`, `FR12`)
- `{nnn}`: Sequential test case number within the FR, zero-padded to 3 digits (e.g., `001`, `012`)

### Table Format

Each FR section uses this table:

```markdown
| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
```

- **TC ID**: `TC-{SYSTEM}-FR{nn}-{nnn}`
- **FR Ref**: FR ID with specific AC/BR references (e.g., `FR-01 AC-01, AC-02`)
- **Test Description**: Concise description starting with "Verify..." (include category tag for edge/failure cases)
- **Pre-conditions**: Numbered list of specific, testable preconditions
- **Test Steps**: Numbered steps including both UI and API actions
- **Expected Result**: Precise, verifiable outcomes with HTTP codes, field values, state changes
- **Priority**: P1, P2, or P3

## Phase 3 — Output

Generate the complete test case document with these sections:

### Document Header

```markdown
# {System} Functional Test Cases

| Field | Value |
|-------|-------|
| **Project** | {Full system name} |
| **Document Type** | Functional Test Case Specification |
| **Version** | {version — 1.0 for new, increment for updates} |
| **Date** | {YYYY-MM-DD} |
| **Author** | QA Engineering Team |
| **BRD Reference** | {BRD filename} |
| **Technology Stack** | React (Frontend), Node.js / Fastify (API), PostgreSQL (DB) |
| **Total FRs Covered** | FR-01 through FR-{nn} ({count} Functional Requirements) |
| **Total Test Cases** | {total count} |
```

### Section 1: Test Case Summary

Summary table showing per-FR test case counts and priority spread.

### Section 2: Test Cases by Functional Requirement

All test cases organized by FR, each FR as a subsection with its own table.

### Section 3: Traceability Matrix

| FR ID | FR Title | AC Count | BR Count | TC Count | Coverage |
|-------|----------|----------|----------|----------|----------|

Coverage: `Full` (all ACs and BRs have at least one TC), `Partial` (some gaps), `Minimal` (only happy path).

### Output File

Write to: `docs/test-cases/{System}_Functional_Test_Cases.md`

If `docs/test-cases/` does not exist, create it.

## Phase 4 — Delta Report

If existing test cases were found in Phase 0:

1. **New FRs**: List FRs that are in the BRD but had no existing test cases.
2. **Updated FRs**: List FRs where the BRD has changed (new ACs/BRs) requiring additional test cases.
3. **Unchanged FRs**: List FRs with existing adequate coverage.
4. **Removed FRs**: List FRs in existing test cases but no longer in the BRD.

Present delta as a summary table:

| FR ID | Status | Action | Details |
|-------|--------|--------|---------|
| FR-01 | Unchanged | None | 6 existing TCs cover all ACs |
| FR-27 | New | Generate | 3 ACs, 2 BRs — needs 5-6 TCs |

When updating an existing file, merge new test cases into the appropriate FR sections rather than overwriting the entire file. Preserve existing TC IDs — only append new ones.

## Quality Checklist

Before finalizing output, verify:

```
□ Every AC in the BRD has at least one test case
□ Every BR in the BRD has at least one test case
□ Priority distribution is approximately 40/40/20 (P1/P2/P3)
□ TC IDs are sequential within each FR with no gaps
□ All pre-conditions are specific and testable
□ All expected results include verifiable assertions
□ Table format matches existing test case documents exactly
□ Traceability matrix accounts for all FRs
□ No requirements were invented beyond what the BRD states
```
