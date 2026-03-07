import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, NON_EXISTENT_UUID } from "../test-helpers";

let app: any;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(app);
  if (t) { token = t; dbReady = true; }
});
afterAll(async () => { await app.close(); });

describe("Legal — GET /api/v1/legal/sections", () => {
  it("returns statutes array", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/legal/sections");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.statutes).toBeInstanceOf(Array);
  });

  it("supports search query parameter", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/legal/sections?q=evidence");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.statutes).toBeInstanceOf(Array);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/legal/sections",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Legal — POST /api/v1/legal/suggest", () => {
  it("returns suggestions for free text", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/legal/suggest", {
      text: "digital evidence tampering",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.suggestions).toBeInstanceOf(Array);
  });

  it("returns empty suggestions for empty text", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/legal/suggest", {
      text: "",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.suggestions).toBeInstanceOf(Array);
    expect(body.suggestions).toHaveLength(0);
  });
});

describe("Legal — POST /api/v1/legal/map", () => {
  it("returns 404 for non-existent entity", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/legal/map", {
      entityType: "forensic_case",
      entityId: NON_EXISTENT_UUID,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 400 for unknown entity type", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/legal/map", {
      entityType: "unknown_type",
      entityId: NON_EXISTENT_UUID,
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/legal/map",
      payload: { entityType: "forensic_case", entityId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Legal — GET /api/v1/legal/mappings/:entityType/:entityId", () => {
  it("returns mappings array for an entity", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/legal/mappings/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.mappings).toBeInstanceOf(Array);
  });
});

describe("Legal — GET /api/v1/legal/mappings/pending", () => {
  it("returns pending mappings with total", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/legal/mappings/pending");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.mappings).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});
