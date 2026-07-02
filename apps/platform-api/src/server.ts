import { createServer } from "node:http";
import { Pool } from "pg";
import { createPlatformApp } from "./app";
import { createAuthGateway, type AuthGateway } from "./auth/gateway";
import { createPgEvidenceStore } from "./auth/pg-evidence-store";
import { createPgIdentityStore } from "./auth/pg-identity-store";
import { createCaseProjectionService } from "./services/case-projection";
import { createEvidenceProjectionService } from "./services/evidence-projection";

const port = Number(process.env.PORT ?? 8080);
const fixedNow = process.env.PLATFORM_FIXED_NOW
  ? { now: () => new Date(process.env.PLATFORM_FIXED_NOW as string) }
  : {};

// Claims-issuer mode: active when a user store and session secret are
// configured. Without them the server runs claims-passthrough only (every
// request is denied downstream unless a trusted proxy injected claims).
let gateway: AuthGateway | null = null;
let evidenceStore: ReturnType<typeof createPgEvidenceStore> | null = null;
if (process.env.DATABASE_URL && process.env.PLATFORM_SESSION_SECRET) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  evidenceStore = createPgEvidenceStore(pool);
  const allowPasswordOnly = process.env.PLATFORM_DEMO_ALLOW_PASSWORD_ONLY === "true";
  gateway = createAuthGateway({
    store: createPgIdentityStore(pool),
    sessionSecret: process.env.PLATFORM_SESSION_SECRET,
    evidenceSink: evidenceStore,
    evidenceReader: evidenceStore,
    allowPasswordOnly,
  });
  console.log("platform-api: claims issuer enabled (decision-evidence ledger on)");
  if (allowPasswordOnly) {
    console.warn(
      "platform-api: DEMO MODE — password-only login enabled; sessions minted with mfa.methods=[password]. Unset PLATFORM_DEMO_ALLOW_PASSWORD_ONLY before handling real data.",
    );
  }
}

// Fixture-backed pilot projections carry a fixed projected_at; against the
// real clock they trip the STALE_PROJECTION guard. For demo deployments an
// explicit TTL override keeps the synthetic projections readable.
const projectionTtlSeconds = Number(process.env.PLATFORM_PROJECTION_TTL_SECONDS ?? "");
const projectionOverrides =
  Number.isFinite(projectionTtlSeconds) && projectionTtlSeconds > 0
    ? {
        caseProjectionService: createCaseProjectionService({ projectionTtlSeconds }),
        evidenceProjectionService: createEvidenceProjectionService({ projectionTtlSeconds }),
      }
    : {};

const app = createPlatformApp({
  ...fixedNow,
  // G-SEC-002: persist every platform allow/deny decision to the ledger.
  ...(evidenceStore ? { evidenceSink: evidenceStore } : {}),
  ...projectionOverrides,
});

createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const method = req.method ?? "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    const host = req.headers.host ?? `platform-api:${port}`;
    const headers = new Headers(req.headers as HeadersInit);

    // Never trust caller-supplied claim headers on this ingress: claims enter
    // only via the session gateway below.
    headers.delete("x-platform-claims");
    headers.delete("x-platform-claims-verified");

    const url = `${String(protocol)}://${host}${req.url ?? "/"}`;

    if (gateway) {
      const authResponse = await gateway.handleAuthRoute(
        new Request(url, { method, headers, body }),
      );
      if (authResponse) {
        await writeResponse(res, authResponse);
        return;
      }
      const claimHeaders = await gateway.claimsHeadersFor(new Request(url, { method, headers }));
      if (claimHeaders) {
        for (const [key, value] of Object.entries(claimHeaders)) {
          headers.set(key, value);
        }
      }
    }

    const response = await app.fetch(new Request(url, { method, headers, body }));
    await writeResponse(res, response);
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "PLATFORM_API_REQUEST_FAILED" } }));
  }
}).listen(port, "0.0.0.0");

async function writeResponse(
  res: import("node:http").ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
