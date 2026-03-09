---
name: full-review
description: Run all four review skills (UI, quality, security, infra) in parallel, then sanity-check, then fix all issues found until every finding is resolved.
argument-hint: "[target] [options]"
user_invocable: true
---

# Full Review Playbook

Run a comprehensive review cycle: four parallel reviews, sanity-check, remediation, and re-verification.

## Scoping

If the user specifies a target (example: `/full-review social-media-api`), pass that scope to each review skill. Otherwise review the entire project.

Options the user may append:
- `critical-only` — only fix CRITICAL findings
- `high+` — fix HIGH and CRITICAL findings (default)
- `all` — fix all findings including LOW and MEDIUM
- `no-fix` — produce reports only, skip remediation
- `no-commit` — fix but do not commit

## Phase 1: Parallel Reviews

Launch these four reviews in parallel using background agents:

1. `/ui-review <target>`
2. `/quality-review <target>`
3. `/security-review <target>`
4. `/infra-review <target>`

Wait for all four to complete. Collect and summarize findings from each report.

## Phase 2: Sanity Check

Run `/sanity-check` to cross-validate findings across all four domains and check for regressions or conflicts between recommendations.

## Phase 3: Remediation (skip if `no-fix`)

Work through findings by severity (CRITICAL first, then HIGH, then MEDIUM, then LOW — stopping at the user's chosen floor, default HIGH+).

For each finding:
1. Create a task for the finding
2. Implement the fix
3. Verify the fix resolves the finding without introducing regressions

After completing fixes for each review domain, commit with a descriptive message (skip if `no-commit`).

## Phase 4: Re-verification

Run `/sanity-check` again after all fixes to confirm:
- All targeted findings are resolved
- No new regressions were introduced
- Builds and tests still pass

If new issues are found, loop back to Phase 3 (max 3 iterations to avoid infinite loops).

## Output

Produce a final summary with:
- Total findings per domain and severity
- Findings fixed vs remaining
- Commits created
- Final sanity-check verdict (PASS / FAIL)
