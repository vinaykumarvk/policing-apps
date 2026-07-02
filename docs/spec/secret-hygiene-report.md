# P0 Secret Hygiene Report

Generated: 2026-07-02T01:10:00+05:30  
Phase: P0 - Source Freeze, Secret Hygiene, and Import Map

## Outcome

Selected import files are clean for P0:

- Import allowlist validation passed for 21 entries.
- Allowlist-mode secret/path/content scan checked 1,590 included files.
- Known secret or sensitive local paths in selected import files: 0.
- High-confidence secret content findings in selected import files: 0.
- No file contents, `.env` values, tokens, service-account JSON, PII, or active case data were printed into this report.

No source code was imported and no source history was rewritten. Sensitive local paths were quarantined by exclusion from `docs/spec/import-map.yaml` rather than moved, deleted, or edited.

## Tool Availability

Command:

```sh
command -v gitleaks
```

Output summary: no `gitleaks` executable was found in the local shell, so P0 used the repository-local Node scanners below. No package was installed and no new dependency was added.

## Commands Run

Import allowlist validation:

```sh
node scripts/check-import-allowlist.mjs
```

Output summary:

```text
ok import allowlist: 21 entries verified
```

Allowlist secret/path/content enforcement:

```sh
node scripts/check-no-known-secret-paths.mjs --json
```

Output summary:

```json
{
  "mode": "allowlist-enforcement",
  "scanned_files": 1590,
  "known_secret_or_sensitive_paths": 0,
  "high_confidence_content_findings": 0,
  "path_finding_counts": {}
}
```

Full source-root hygiene report, path-only and report-only:

```sh
node scripts/check-no-known-secret-paths.mjs --scan-source-roots --report-only --summary-only --json
```

Output summary:

```json
{
  "mode": "source-root-report",
  "scanned_files": 3375,
  "known_secret_or_sensitive_paths": 28,
  "high_confidence_content_findings": 0,
  "path_finding_counts": {
    "known-secret-path": 14,
    "sensitive-local-data-path": 14
  }
}
```

## Source-Root Findings

The source-root scan intentionally reports local-risk paths outside the selected import scope. The scanner does not print values from these paths.

| Source | Path | Reason | P0 disposition |
|---|---|---|---|
| policing-apps | `.env` | known secret path | Excluded by import map; do not import. |
| policing-apps | `.env.example` | env template path | Excluded by import map; regenerate sanitized examples later if needed. |
| policing-apps | `apps/dopams-api/.env.example` | env template path | Excluded by import map. |
| policing-apps | `apps/forensic-api/.env.example` | env template path | Excluded by import map. |
| policing-apps | `apps/social-media-api/.env` | known secret path | Excluded by import map; rotate externally if active. |
| policing-apps | `apps/social-media-api/.env.example` | env template path | Excluded by import map. |
| policing-apps | `apps/social-media-api/apps/social-media-api/evidence-local/screenshots` | sensitive local data path | Excluded by import map; no import. |
| policing-apps | `apps/social-media-api/evidence-local/screenshots` | sensitive local data path | Excluded by import map; no import. |
| policing-apps | `docs/deployed-apps-credentials.xlsx` | credential-named file | Excluded by import map; do not import or commit into platform docs. |
| policing-apps | `outputs` | sensitive/generated local data path | Excluded by import map. |
| policing-apps | `playwright-report` | generated report path | Excluded by import map. |
| policing-apps | `test-results` | generated test output path | Excluded by import map. |
| policing-apps | `uploads` | sensitive local upload path | Excluded by import map. |
| compliant-parser | `.env` | known secret path | Excluded by import map; rotate externally if active. |
| compliant-parser | `.env.example` | env template path | Excluded by import map. |
| compliant-parser | `.object-storage` | sensitive local object-storage path | Excluded by import map; no import. |
| compliant-parser | `complaints` | complaint document path | Excluded by import map; no active case data import. |
| compliant-parser | `credentials` | credential directory | Excluded by import map; includes the plan-called-out service-account location. |
| compliant-parser | `services/knowledge-intelligence-service/.env.example` | env template path | Excluded by import map. |
| RAG-app | `.env` | known secret path | Excluded by import map; rotate externally if active. |
| RAG-app | `.env.example` | env template path | Excluded by import map. |
| RAG-app | `apps/api/uploads/.DS_Store` | sensitive local upload path | Excluded by import map. |
| RAG-app | `apps/api/uploads/c2f1b045-c481-4b57-86cf-cff8e6b1fb0c` | sensitive local upload path | Excluded by import map; no import. |
| RAG-app | `apps/web/.env.local` | known secret path | Excluded by import map; rotate externally if active. |
| RAG-app | `playwright-report` | generated report path | Excluded by import map. |
| RAG-app | `test-results` | generated test output path | Excluded by import map. |
| RAG-app | `tmp` | sensitive/generated local data path | Excluded by import map. |
| RAG-app | `uploads` | sensitive local upload path | Excluded by import map. |

## Quarantine And Rotation Notes

P0 quarantine is implemented by allowlist exclusion and validator enforcement:

- `scripts/check-import-allowlist.mjs` verifies selected source checksums and import status.
- `scripts/check-no-known-secret-paths.mjs` fails in default mode if known secret/sensitive paths or high-confidence secret content appear in selected import files.
- `docs/spec/import-map.yaml` excludes the path classes listed in `docs/spec/source-inventory.md`.

Rotation was not performed in P0 because rotating `.env` values, service-account files, connector tokens, or local credentials is an external secret-management action and may affect running local services. Owners should rotate any active values before a later import or deployment phase.

## Remaining Risks

- The three source repos are dirty. Checksums freeze the current filesystem state, not a clean commit-only state.
- Env templates were excluded conservatively. P1 should create sanitized examples from documented variable names, not copy local `.env.example` files blindly.
- The source-root report found credential and local data paths outside the import allowlist. They are safely excluded for P0, but active secret rotation remains an owner action.
- Knowledge/RAG remains planned-not-active until scoped retrieval and citation filtering are proven.
- Social Media and Forensic domains remain planned-not-active until server-side platform claim enforcement and decision evidence tests pass.

## P0 Secret Hygiene Decision

P0 can proceed because selected import files contain no known secret paths and no high-confidence secret content findings. Local sensitive paths exist, but they are quarantined by exclusion and guarded by scripts. No destructive cleanup is required for P0.

