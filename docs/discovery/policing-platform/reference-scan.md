# Policing Platform Discovery: Reference Scan

This scan used local repository files only. No external internet references were used.

## Existing Patterns Worth Reusing

### NPM workspace monorepo

Source: `policing-apps/package.json`

The existing workspace layout already supports `apps/*` and `packages/*`. This is suitable for the consolidated repo and should be extended rather than replaced.

### Bounded police domain apps

Sources:

- `apps/dopams-api/src/app.ts`
- `apps/social-media-api/src/app.ts`
- `apps/forensic-api/src/app.ts`

DOPAMS, Social Media, and Forensic already share a backend shape: Fastify, Swagger/OpenAPI, auth middleware, audit logger, rate limiting, idempotency middleware, health/ready endpoints, domain route registration, and optional LDAP/OIDC integration through `@puda/api-core`.

### Shared platform packages

Source: `packages/api-core/src/*`, `packages/api-integrations/src/*`, `packages/workflow-engine/src/*`, `packages/nl-assistant/src/*`

These packages are the natural seed for platform services:

- auth and app builder;
- audit middleware;
- role guard;
- idempotency;
- LLM provider abstraction;
- config governance;
- notification/task routes;
- evidence/report generation;
- shared workflow engine;
- NL assistant UI.

### Separate data stores per bounded context

Source: `docker-compose.yml`

Current local deployment runs separate Postgres databases for Social Media, DOPAMS, Forensic, and PUDA. This supports initial consolidation because domains can be deployed together while retaining schema isolation.

### IQW as Python service

Sources:

- `/Users/n15318/compliant-parser/README.md`
- `/Users/n15318/compliant-parser/api_v1.py`
- `/Users/n15318/compliant-parser/deploy/docker-compose.onprem.yml`

IQW has a mature Python ecosystem around OCR, translation, complaint parsing, and case lifecycle. It should initially be integrated through service APIs, not immediately rewritten.

### IntelliRAG as knowledge runtime

Sources:

- `/Users/n15318/RAG-app/CLAUDE.md`
- `/Users/n15318/RAG-app/docs/IntelliRAG-Police-Features.md`

RAG-app already separates web, API, and Python worker and has legal/police knowledge features. It should be the preferred foundation for the Justice Knowledge module unless a later evaluation proves KIS should replace it.

## Anti-Patterns to Avoid

- One giant backend process containing every domain. This would couple deployment, risk, schema churn, and scaling.
- One shared database schema for all detailed domain tables. Keep a central platform schema plus domain schemas/databases.
- Multiple knowledge/RAG runtimes. Pick one runtime and migrate governance features into it.
- Multiple identity stores. Use one platform identity and entitlement service, with domain-specific permissions derived from central claims.
- UI-only consolidation with separate auth and data scopes. That would not solve audit, entitlements, evidence, or cross-case visibility.
- Importing repositories with local secrets or credential files.

