// Claims-issuer gateway: authenticates users (password + TOTP), maintains a
// signed session cookie, and injects freshly minted, server-verified platform
// claims into requests before they reach the platform app. The platform app
// itself stays unchanged — it continues to trust only the claims headers.
import { createSessionToken, verifyPassword, verifySessionToken, verifyTotp } from "./crypto";
import { mintPlatformClaims, type IdentityStore } from "./identity";

const SESSION_COOKIE = "platform_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

export interface AuthGatewayOptions {
  store: IdentityStore;
  sessionSecret: string;
  now?: () => Date;
  secureCookies?: boolean;
}

export interface AuthGateway {
  /** Handles /api/v1/platform/auth/* requests. Returns null for other paths. */
  handleAuthRoute: (request: Request) => Promise<Response | null>;
  /** Returns claim headers for a valid session, or null. Never throws. */
  claimsHeadersFor: (request: Request) => Promise<Record<string, string> | null>;
}

interface FailureState {
  count: number;
  lockedUntilMs: number;
}

export function createAuthGateway(options: AuthGatewayOptions): AuthGateway {
  const now = options.now ?? (() => new Date());
  const secure = options.secureCookies ?? true;
  const failures = new Map<string, FailureState>();

  const readSession = (request: Request) => {
    const cookie = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
    if (!cookie) {
      return null;
    }
    return verifySessionToken(cookie, options.sessionSecret, now().getTime());
  };

  const handleAuthRoute = async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/v1/platform/auth/")) {
      return null;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/platform/auth/login") {
      return login(request);
    }
    if (request.method === "POST" && url.pathname === "/api/v1/platform/auth/logout") {
      return json(200, { ok: true }, clearCookieHeader(secure));
    }
    if (request.method === "GET" && url.pathname === "/api/v1/platform/auth/session") {
      const session = readSession(request);
      if (!session) {
        return json(200, { authenticated: false });
      }
      const user = await options.store.getUserById(session.userId);
      if (!user || user.status !== "active") {
        return json(200, { authenticated: false }, clearCookieHeader(secure));
      }
      return json(200, {
        authenticated: true,
        user: { username: user.username, display_name: user.displayName, persona: user.persona },
      });
    }
    return json(404, { error: { code: "AUTH_ROUTE_NOT_FOUND" } });
  };

  const login = async (request: Request): Promise<Response> => {
    let body: { username?: unknown; password?: unknown; totp?: unknown };
    try {
      body = await request.json();
    } catch {
      return json(400, { error: { code: "LOGIN_BODY_INVALID" } });
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const totp = typeof body.totp === "string" ? body.totp.trim() : "";
    if (!username || !password || !totp) {
      return json(400, { error: { code: "LOGIN_FIELDS_REQUIRED" } });
    }

    const nowMs = now().getTime();
    const failure = failures.get(username);
    if (failure && failure.lockedUntilMs > nowMs) {
      return json(429, { error: { code: "LOGIN_LOCKED", message: "too many failed attempts" } });
    }

    const user = await options.store.getUserByUsername(username);
    const passwordOk = user ? verifyPassword(password, user.passwordHash) : false;
    const totpOk = user ? verifyTotp(user.totpSecret, totp, nowMs) : false;
    if (!user || user.status !== "active" || !passwordOk || !totpOk) {
      const next: FailureState = {
        count: (failure?.count ?? 0) + 1,
        lockedUntilMs: 0,
      };
      if (next.count >= LOGIN_MAX_FAILURES) {
        next.lockedUntilMs = nowMs + LOGIN_LOCKOUT_MS;
        next.count = 0;
      }
      failures.set(username, next);
      return json(401, { error: { code: "LOGIN_FAILED", message: "invalid credentials" } });
    }

    failures.delete(username);
    const token = createSessionToken(user.userId, options.sessionSecret, nowMs, SESSION_TTL_SECONDS);
    return json(
      200,
      {
        ok: true,
        user: { username: user.username, display_name: user.displayName, persona: user.persona },
      },
      sessionCookieHeader(token, SESSION_TTL_SECONDS, secure),
    );
  };

  const claimsHeadersFor = async (request: Request): Promise<Record<string, string> | null> => {
    try {
      const session = readSession(request);
      if (!session) {
        return null;
      }
      const user = await options.store.getUserById(session.userId);
      if (!user || user.status !== "active") {
        return null;
      }
      const entitlements = await options.store.getEntitlements(user.userId);
      const current = now();
      const claims = mintPlatformClaims({
        user,
        entitlements,
        sessionId: session.sessionId,
        mfaVerifiedAt: current.toISOString(),
        now: current,
      });
      return {
        "x-platform-claims": JSON.stringify(claims),
        "x-platform-claims-verified": "true",
      };
    } catch {
      return null;
    }
  };

  return { handleAuthRoute, claimsHeadersFor };
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}

function sessionCookieHeader(token: string, ttlSeconds: number, secure: boolean): Record<string, string> {
  const attrs = [`${SESSION_COOKIE}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${ttlSeconds}`];
  if (secure) {
    attrs.push("Secure");
  }
  return { "set-cookie": attrs.join("; ") };
}

function clearCookieHeader(secure: boolean): Record<string, string> {
  const attrs = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) {
    attrs.push("Secure");
  }
  return { "set-cookie": attrs.join("; ") };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
