import { createServer } from "node:http";
import { createPlatformApp } from "./app";

const app = createPlatformApp(
  process.env.PLATFORM_FIXED_NOW
    ? { now: () => new Date(process.env.PLATFORM_FIXED_NOW as string) }
    : {},
);
const port = Number(process.env.PORT ?? 8080);

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
    const request = new Request(`${String(protocol)}://${host}${req.url ?? "/"}`, {
      method,
      headers: req.headers as HeadersInit,
      body,
    });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const responseBody = Buffer.from(await response.arrayBuffer());
    res.end(responseBody);
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { code: "PLATFORM_API_REQUEST_FAILED" } }));
  }
}).listen(port, "0.0.0.0");
