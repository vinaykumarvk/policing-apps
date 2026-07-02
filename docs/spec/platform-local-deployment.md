# Platform Pilot Local Deployment

Phase: P16 - Pilot Cutover Readiness and Approval Evidence  
Applies after: P15 Knowledge Platform Adapter and Pilot Launch  
Approval state: pending human approval in `docs/spec/pilot-cutover-approval.json`

The local pilot profile starts the platform shell, platform API, DOPAMS, IQW, Forensic, Social Media, and Knowledge platform-gate harnesses, pgvector Postgres, Redis queue, MinIO object storage, and an nginx reverse proxy:

```bash
docker compose -f deploy/docker-compose/policing-platform.yml up --wait
```

The proxy listens on `http://localhost:8088` by default. Override the host port with `POLICING_PLATFORM_PORT`.

## Exposed Pilot Routes

- `/` routes to `platform-web`.
- `/api/v1/platform/*` routes to `platform-api`.
- `/domains/dopams/*` routes to the DOPAMS P8 platform-claim adapter harness.
- `/domains/iqw/*` routes to the IQW P8 platform-claim adapter harness.
- `/domains/forensic/*` routes to the Forensic P13 platform-claim adapter harness.
- `/domains/social-media/*` routes to the Social Media P14 platform-claim adapter harness.
- `/domains/knowledge/*` routes to the Knowledge P15 scoped retrieval gate harness.

The route surface is launchable only through platform claims and entitlement decisions. The local proxy injects synthetic server-verified claims for smoke testing; production must use the approved identity provider and managed claim verification path.

## Smoke Personas

The default local pilot claim launches only DOPAMS and IQW:

```bash
curl http://localhost:8088/api/v1/platform/apps?limit=100
```

Additional smoke personas verify entitlement-bounded launch URLs:

```bash
curl -H "X-Platform-Smoke-Persona: forensic" http://localhost:8088/api/v1/platform/apps?limit=100
curl -H "X-Platform-Smoke-Persona: analyst" http://localhost:8088/api/v1/platform/apps?limit=100
curl -H "X-Platform-Smoke-Persona: knowledge" http://localhost:8088/api/v1/platform/apps?limit=100
```

Expected launch behavior:

| Persona | Expected launch URLs |
|---|---|
| default pilot operator | `/domains/dopams`, `/domains/iqw` |
| forensic | `/domains/forensic` only for the Forensic pilot route |
| analyst or social-media | `/domains/social-media` only for the Social Media pilot route |
| knowledge or io | `/domains/knowledge` only for the Knowledge pilot route |

Each persona must not receive unrelated launch URLs. For example, the Knowledge persona must not launch Forensic or Social Media, and the analyst persona must not launch Knowledge.

## Local Limitations

This profile is pilot proof only. It is not production security evidence, does not use production credentials, and does not replace standalone app deployment profiles.

The proxy uses fixture clocks and synthetic claims so the P2 seed claim shape remains valid. Production must use the platform identity provider, real claim verification, production audit sinks, managed secrets, TLS, persistent policy stores, service-to-service authentication, monitoring, and incident response controls.

Knowledge is enabled only as a bounded P15 pilot route. It does not ingest real corpus data in this profile. `platform.knowledge.retrieve` remains default-denied unless the Knowledge adapter proves platform claims, explicit Knowledge entitlement, pre-retrieval scope filtering, citation filtering, and decision evidence.

Production cutover remains pending human approval through `docs/spec/pilot-cutover-approval.json`.

## Verification

Static and live smoke checks use:

```bash
bash scripts/smoke-platform-local.sh
```

When the proxy is running, the smoke script verifies platform health, app registry behavior, all five pilot domain health routes, and persona-scoped launch URL exposure. Without a running proxy, it verifies the compose and nginx route contract statically.
