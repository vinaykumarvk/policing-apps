// Private pilot composition: serves the platform-web SPA and the platform API
// in one process, injecting synthetic pilot-persona claims (same profile as the
// local docker-compose stack) when a request carries none. This entry must only
// run behind authenticated ingress (Cloud Run IAM) — the personas are synthetic
// credentials, not production identity.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import pilotClaims from "../../../fixtures/platform/pilot-claims.json";
import { createPlatformApp } from "./app";

const app = createPlatformApp(
  process.env.PLATFORM_FIXED_NOW
    ? { now: () => new Date(process.env.PLATFORM_FIXED_NOW as string) }
    : {},
);
const port = Number(process.env.PORT ?? 8080);
const staticDir = process.env.STATIC_DIR ?? "/app/web";

const personas: Record<string, unknown> = pilotClaims;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/v1/platform")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const method = req.method ?? "GET";
      const headers = new Headers(req.headers as HeadersInit);
      // Always overwrite claim headers (nginx proxy_set_header semantics):
      // clients behind the IAM gate select a persona, never supply claims.
      const persona = headers.get("x-platform-smoke-persona") ?? "pilot";
      const claim = personas[persona] ?? personas.pilot;
      headers.set("x-platform-claims", JSON.stringify(claim));
      headers.set("x-platform-claims-verified", "true");
      const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
      });
      const response = await app.fetch(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    // Static SPA with fallback to index.html
    const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(staticDir, safePath === "/" ? "/index.html" : safePath);
    try {
      const body = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader("content-type", MIME[extname(filePath)] ?? "application/octet-stream");
      res.end(body);
    } catch {
      const body = await readFile(join(staticDir, "index.html"));
      res.statusCode = 200;
      res.setHeader("content-type", MIME[".html"]);
      res.end(body);
    }
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "PLATFORM_PILOT_REQUEST_FAILED" } }));
  }
}).listen(port, "0.0.0.0");
