# P1 Target Monorepo Layout

Generated: 2026-07-02T01:35:00+05:30  
Phase: P1 - Target Monorepo Layout  
Inputs: `docs/spec/phased-plan.yaml`, `docs/spec/source-inventory.md`, `docs/spec/import-map.yaml`, and `docs/spec/policing-platform-integration-execution-plan.md`

## Decision Summary

P1 defines the target monorepo shape without moving or importing source subtrees. P0 is recorded as complete and approved, but this phase keeps all current source paths runnable while future phases import or create bounded platform and domain packages behind explicit gates.

The target layout is:

```text
apps/
  platform-api/        # P6 control-plane API, app registry, health, entitlements
  platform-web/        # P7 user-facing platform shell
  api/                 # existing PUDA workflow API, retained in place
  citizen/             # existing PUDA citizen UI, retained in place
  officer/             # existing PUDA officer UI, retained in place
  dopams-api/          # current DOPAMS API until domain move is executed
  dopams-ui/           # current DOPAMS UI until domain move is executed
  forensic-api/        # current Forensic API until domain move is executed
  forensic-ui/         # current Forensic UI until domain move is executed
  social-media-api/    # current Social Media API until domain move is executed
  social-media-ui/     # current Social Media UI until domain move is executed

domains/
  dopams/
    api/
    web/
  iqw/
    api/
  forensic/
    api/
    web/
  social-media/
    api/
    web/
  knowledge/
    api/
    web/
    worker/
    packages/

packages/
  api-core/            # existing shared Fastify/auth/audit helper package
  api-integrations/    # existing connector/helper package
  shared/              # existing shared UI/models package
  workflow-engine/     # existing workflow package, reference unless later promoted
  nl-assistant/        # existing assistant package, reference unless later approved
  authz/               # P5 platform authorization contracts
  audit-ledger/        # P5 decision evidence and audit contracts
  case-core/           # P5 canonical case contracts
  evidence-core/       # P5 canonical evidence contracts

migrations/
  platform/            # platform-owned migrations introduced by later phases

deploy/
  local/               # integrated local profile introduced by P11
  cloud-run/           # production-like service definitions introduced later
  source/
    policing-apps/docker-compose.yml
    compliant-parser/
    RAG-app/
```

The root npm workspace list is intentionally broader than the current filesystem:

- `apps/*` keeps all current app commands and will include `apps/platform-api` and `apps/platform-web` when created.
- `domains/*/*` allows future domain services such as `domains/dopams/api` or `domains/knowledge/web` to become npm workspaces when they contain `package.json`.
- `domains/*/packages/*` allows domain-owned package variants, especially Knowledge reference packages, without making them shared platform packages.
- `packages/*` remains the only shared TypeScript package boundary.

Python services are not required to be npm workspaces. `domains/iqw/api` and `domains/knowledge/worker` own their Python virtualenv, `requirements.txt` or `pyproject.toml`, Dockerfile, tests, and runtime commands inside their domain folder. A Python folder may have a `package.json` only for optional generated-contract validation or wrapper scripts; it must not become the source of Python dependency truth.

## Current App Compatibility

No existing app command is removed or replaced in P1.

| Current surface | Current path | Target path | Direct command compatibility | Root command compatibility |
|---|---|---|---|---|
| PUDA workflow API | `apps/api` | `apps/api` until explicitly excluded or separated later | `npm --workspace apps/api run dev`, `build`, `typecheck`, `test` | `npm run dev:api`, `build:api`, `test:api` |
| PUDA citizen UI | `apps/citizen` | `apps/citizen` until explicitly excluded or separated later | `npm --workspace apps/citizen run dev`, `build`, `typecheck`, `preview` | `npm run dev:citizen`, `build:citizen`, `test:citizen:unit` |
| PUDA officer UI | `apps/officer` | `apps/officer` until explicitly excluded or separated later | `npm --workspace apps/officer run dev`, `build`, `typecheck`, `preview` | `npm run dev:officer`, `build:officer` |
| DOPAMS API | `apps/dopams-api` | `domains/dopams/api` | `npm --workspace apps/dopams-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `npm run dev:dopams`, `build:dopams`, `test:dopams` |
| DOPAMS UI | `apps/dopams-ui` | `domains/dopams/web` | `npm --workspace apps/dopams-ui run dev`, `build`, `typecheck`, `preview` | `npm run dev:dopams-ui`, `build:dopams-ui` |
| Forensic API | `apps/forensic-api` | `domains/forensic/api` | `npm --workspace apps/forensic-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `npm run dev:forensic`, `build:forensic`, `test:forensic` |
| Forensic UI | `apps/forensic-ui` | `domains/forensic/web` | `npm --workspace apps/forensic-ui run dev`, `build`, `typecheck`, `preview` | `npm run dev:forensic-ui`, `build:forensic-ui` |
| Social Media API | `apps/social-media-api` | `domains/social-media/api` | `npm --workspace apps/social-media-api run dev`, `build`, `typecheck`, `test`, `migrate`, `seed` | `npm run dev:social-media`, `build:social-media`, `test:social-media` |
| Social Media UI | `apps/social-media-ui` | `domains/social-media/web` | `npm --workspace apps/social-media-ui run dev`, `build`, `typecheck`, `preview` | `npm run dev:social-media-ui`, `build:social-media-ui` |
| IQW API | sibling `../compliant-parser` | `domains/iqw/api` | Existing Docker/Python command remains `uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}` until import | No root npm command until the source is imported and wrapped |
| Knowledge API | sibling `../RAG-app/apps/api` | `domains/knowledge/api` | Existing RAG-app command remains in the source repo until import | No root npm command until the source is imported |
| Knowledge Web | sibling `../RAG-app/apps/web` | `domains/knowledge/web` | Existing RAG-app command remains in the source repo until import | No root npm command until the source is imported |
| Knowledge Worker | sibling `../RAG-app/apps/worker` | `domains/knowledge/worker` | Existing Python worker command remains in the source repo until import | No root npm command until the source is imported |

When a current `apps/*` source is moved to `domains/*/*`, the phase that performs the move must either preserve the old root script as an alias or document an explicit replacement in this file before removing the old path.

## Import Map Alignment

`docs/spec/import-map.yaml` remains the authoritative P0 allowlist and target-path record. P1 does not change checksums or import statuses.

| Import-map id | Target path | P1 placement |
|---|---|---|
| `policing-dopams-api` | `domains/dopams/api` | Pilot domain API target |
| `policing-dopams-ui` | `domains/dopams/web` | Pilot domain web target |
| `iqw-compliant-parser` | `domains/iqw/api` | Pilot Python API target |
| `policing-forensic-api` | `domains/forensic/api` | Planned domain API target |
| `policing-forensic-ui` | `domains/forensic/web` | Planned domain web target |
| `policing-social-media-api` | `domains/social-media/api` | Planned domain API target |
| `policing-social-media-ui` | `domains/social-media/web` | Planned domain web target |
| `rag-api` | `domains/knowledge/api` | Planned Knowledge API target |
| `rag-web` | `domains/knowledge/web` | Planned Knowledge web target |
| `rag-worker` | `domains/knowledge/worker` | Planned Knowledge worker target |
| `policing-domain-dockerfiles` | `deploy/source/policing-apps/docker-compose.yml` | Deployment reference target |

Shared package entries from `policing-apps` keep their existing `packages/*` targets. RAG package variants stay under `domains/knowledge/packages/*` as reference material until a later reconciliation phase promotes code into a shared package boundary.

The planned P5 shared package targets are `packages/authz`, `packages/audit-ledger`, `packages/case-core`, and `packages/evidence-core`. These paths are reserved only; P1 does not create their source trees.

## Ownership And Import Rules

### TypeScript

- `apps/platform-api` and `apps/platform-web` are platform-owned applications. They may import from `packages/*` and from their own source tree. They must not import directly from `domains/*` internals.
- `domains/<domain>/api` and `domains/<domain>/web` are domain-owned application workspaces. They may import from their own source tree and from shared `packages/*`.
- Domain-to-domain imports are forbidden. Cross-domain behavior must flow through platform API contracts, generated fixtures, HTTP clients, projection tables, or a new shared package approved in `packages/*`.
- `packages/*` are shared boundaries. Shared packages must not import from `apps/*` or `domains/*`.
- `domains/*/packages/*` are domain-owned variants, not shared platform packages. They may be used only by the owning domain unless promoted through a documented P5 or later package amendment.
- Existing `@puda/*` package names remain valid during migration. New platform-owned shared packages should use a platform-scoped name such as `@policing-platform/authz`, `@policing-platform/audit-ledger`, `@policing-platform/case-core`, and `@policing-platform/evidence-core`.
- New TypeScript packages must keep `build` and `typecheck` scripts. New production dependencies require an entry in this file explaining ownership, runtime impact, and why an existing package is insufficient.

### Python

- Python runtime code is owned by its domain folder, initially `domains/iqw/api` and `domains/knowledge/worker`.
- Python services must not import TypeScript source or shared package internals. Cross-runtime contracts must be JSON fixtures, OpenAPI documents, HTTP calls, or generated types checked into a shared contract location.
- Python dependencies stay in the owning domain service file, not in root `package.json`.
- Python secrets, local object stores, complaint PDFs, upload folders, caches, and credentials remain excluded by the P0 import hygiene rules.
- Python service launch commands must remain documented next to the service when imported. Root npm wrappers are optional and must be no-op safe until the service exists.

## Deploy Layout

Current root Dockerfiles and `docker-compose.yml` remain source-compatible in P1. The target deployment folders are reserved as follows:

- `deploy/source/policing-apps/docker-compose.yml` stores the frozen source deployment reference from P0.
- `deploy/source/compliant-parser/` stores IQW deployment references after import approval.
- `deploy/source/RAG-app/` stores Knowledge deployment references after import approval.
- `deploy/local/` is reserved for the integrated local profile in P11.
- `deploy/cloud-run/` is reserved for production-like service definitions. No production deployment behavior changes in P1.

## Validation Commands

Root scripts now separate current checks from future optional workspace checks:

| Command | Purpose |
|---|---|
| `npm run check:repo-layout` | Validates this document, root workspace metadata, preserved app scripts, and import-map target alignment. |
| `npm run build:packages` | Builds existing shared packages only. This is required P1 evidence and remains unchanged. |
| `npm run typecheck` | Runs the existing root TypeScript typecheck sequence. This is required P1 evidence and remains unchanged. |
| `npm run build:platform` | Safe no-op until `apps/platform-api` or `apps/platform-web` exists, then runs their `build` scripts when present. |
| `npm run typecheck:platform` | Safe no-op until platform app workspaces exist, then runs their `typecheck` scripts when present. |
| `npm run build:domains` | Safe no-op until `domains/*/*` or `domains/*/packages/*` npm workspaces exist, then runs their `build` scripts when present. |
| `npm run typecheck:domains` | Safe no-op until domain npm workspaces exist, then runs their `typecheck` scripts when present. |

P1 adds no production dependencies. If local package checks fail because `node_modules` is stale or incomplete, run `npm install` from the repo root to restore dependencies already declared by the existing workspaces.

## Caveats For Later Phases

- P1 does not make DOPAMS, IQW, Forensic, Social Media, or Knowledge available through the platform registry.
- P1 does not change auth, API routes, database schemas, migration ownership, or runtime ports.
- P1 does not import source subtrees. The target `domains/*` paths are placeholders until a later phase performs a gated import or move.
- Any later move from `apps/*` to `domains/*/*` must update this document, root scripts, package-lock workspace metadata, and deployment references in the same phase.
