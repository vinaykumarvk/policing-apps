// App-launch handoff: /domains/<app> validates the platform session, evaluates
// the tenant-aware entitlement (recording decision evidence), and redirects the
// browser to the destination application. This is the cloud equivalent of the
// local stack's nginx /domains/* routes. Domain-local auth remains authoritative
// inside each destination app (transition contract, auth-entitlements v1.1).
import { createHmac, randomUUID } from "node:crypto";
import {
  createAuthorizationDecisionEvidence,
  type AuthorizationDecisionEvidence,
} from "../../../../packages/audit-ledger/src";
import { evaluateEntitlement, type PlatformClaims } from "../../../../packages/authz/src";
import {
  createPlatformAppRegistry,
  entitlementRequestForTenant,
  type PlatformAppDefinition,
} from "../app-registry";
import type { AdminEvidenceSink } from "./admin-routes";

const LAUNCH_PREFIX = "/domains/";

export const DEFAULT_LAUNCH_TARGETS: Readonly<Record<string, string>> = {
  dopams: "https://police-dopams.adssoftek.com",
  iqw: "https://police-complaints.adssoftek.com",
  forensic: "https://police-forensic.adssoftek.com",
  "social-media": "https://police-smmt.adssoftek.com",
  knowledge: "https://puda-kbase.adssoftek.com",
};

/** How each destination app receives its SSO launch token. */
const SSO_REDIRECT_BUILDERS: Readonly<Record<string, (target: string, token: string) => string>> = {
  // dopams-ui is a SPA: it exchanges ?sso= for a local JWT via its API.
  dopams: (target, token) => `${target}/?sso=${encodeURIComponent(token)}`,
  // IQW establishes its server-side session directly on /sso and redirects.
  iqw: (target, token) => `${target}/sso?token=${encodeURIComponent(token)}`,
};

export const SSO_TOKEN_TTL_SECONDS = 60;

export interface SsoTokenPayload {
  u: string; // username
  d: string; // display name
  p: string; // persona
  t: string; // tenant id
  a: string; // audience (destination app slug)
  e: number; // expiry epoch ms
}

export function createSsoLaunchToken(
  claims: PlatformClaims,
  audience: string,
  secret: string,
  nowMs: number,
): string {
  const payload: SsoTokenPayload = {
    u: claims.subject.user_id,
    d: claims.subject.display_name,
    p: claims.subject.persona,
    t: claims.subject.tenant_id,
    a: audience,
    e: nowMs + SSO_TOKEN_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export interface LaunchRouterOptions {
  apps?: readonly PlatformAppDefinition[];
  targets?: Readonly<Record<string, string>>;
  evidenceSink?: AdminEvidenceSink;
  now?: () => Date;
  /** Shared secret for SSO launch tokens. Without it, launches redirect plainly. */
  ssoSecret?: string;
}

export function isLaunchRoute(pathname: string): boolean {
  return pathname.startsWith(LAUNCH_PREFIX);
}

export interface LaunchRouter {
  handle: (request: Request, claims: PlatformClaims | null) => Promise<Response | null>;
}

export function createLaunchRouter(options: LaunchRouterOptions = {}): LaunchRouter {
  const apps = options.apps ?? createPlatformAppRegistry();
  const targets = options.targets ?? DEFAULT_LAUNCH_TARGETS;
  const now = options.now ?? (() => new Date());

  const handle = async (request: Request, claims: PlatformClaims | null): Promise<Response | null> => {
    const url = new URL(request.url);
    if (!isLaunchRoute(url.pathname)) {
      return null;
    }
    const slug = url.pathname.slice(LAUNCH_PREFIX.length).split("/")[0];
    const app = apps.find((entry) => entry.launch_url === `${LAUNCH_PREFIX}${slug}`);
    if (!app) {
      return htmlResponse(404, "Unknown application", `No platform application is registered at /domains/${escapeHtml(slug)}.`);
    }

    if (!claims) {
      // Not signed in — back to the shell's login screen. Relative Location:
      // behind the web proxy this response is served from the shell's origin.
      return new Response(null, { status: 302, headers: { location: "/" } });
    }

    const launchRequest = entitlementRequestForTenant(app, claims.subject.tenant_id);
    const decision = launchRequest
      ? evaluateEntitlement(claims, { ...launchRequest, serverVerified: true }, { now: now() })
      : null;
    const allowed = decision?.allowed === true && app.state !== "planned" && app.state !== "blocked";
    const reason = decision ? decision.reason : "NO_ENTITLEMENT_REQUEST";

    await options.evidenceSink?.append(
      launchDecisionEvidence({
        app,
        outcome: allowed ? "allow" : "deny",
        reason,
        path: url.pathname,
        claims,
        now: now(),
      }),
    );

    if (!allowed) {
      return htmlResponse(
        403,
        `Launch denied — ${escapeHtml(app.label)}`,
        `Your platform entitlements do not permit launching this application (reason: ${escapeHtml(reason)}). The decision has been recorded in the authorization ledger.`,
      );
    }

    const target = targets[slug];
    if (!target) {
      return htmlResponse(
        503,
        `${escapeHtml(app.label)} is not reachable yet`,
        "This application passed its launch gate but has no destination configured in this environment.",
      );
    }
    const ssoBuilder = SSO_REDIRECT_BUILDERS[slug];
    const location =
      options.ssoSecret && ssoBuilder
        ? ssoBuilder(target, createSsoLaunchToken(claims, slug, options.ssoSecret, now().getTime()))
        : target;
    return new Response(null, { status: 302, headers: { location } });
  };

  return { handle };
}

function launchDecisionEvidence(input: {
  app: PlatformAppDefinition;
  outcome: "allow" | "deny";
  reason: string;
  path: string;
  claims: PlatformClaims;
  now: Date;
}): Readonly<AuthorizationDecisionEvidence> {
  return createAuthorizationDecisionEvidence({
    occurred_at: input.now.toISOString(),
    correlation_id: `launch-${randomUUID()}`,
    outcome: input.outcome,
    reason: input.reason,
    policy_version: "platform.app_launch.v1",
    entitlement_policy_version: "platform.entitlements.v1",
    path: input.path,
    action: `platform.launch.${input.app.id}`,
    claims_snapshot: {
      subject: input.claims.subject,
      session_id: input.claims.session_id,
      source_version: input.claims.source_version,
    },
    resource: {
      kind: "app_route",
      resource_id: input.app.id,
      source_system: input.app.domain,
      source_record_id: input.app.module,
      source_version: "platform.app_registry.v1",
      projection_version: "platform.app_registry.v1",
      source_status: "active",
      classification: "restricted",
      legal_hold_status: "none",
    },
    redaction_decision: {
      profile: "app-launch-v1",
      fields_redacted: [],
      storage_uri_exposed: false,
      reason: "redirect_only_no_domain_payload",
    },
    decision_inputs: {
      server_verified: true,
      claim_valid: true,
      policy_present: true,
      resource_complete: true,
      projection_fresh: true,
      source_active: true,
      redaction_complete: true,
      storage_uri_exposed: false,
      legal_hold_checked: true,
      jurisdiction_checked: true,
      assignment_checked: true,
      clearance_checked: true,
      purpose_checked: true,
      mfa_checked: true,
    },
  });
}

function htmlResponse(status: number, heading: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#f4f6f8;color:#17202a;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;border:1px solid #d7dee8;border-radius:8px;max-width:460px;padding:28px}
h1{font-size:19px;color:#0b2e59}a{color:#0b2e59}</style></head>
<body><main><h1>${heading}</h1><p>${body}</p><p><a href="/">Back to the platform</a></p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
