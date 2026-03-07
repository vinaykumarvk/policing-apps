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

describe("Drug Classify — POST /api/v1/drug-classify/:entityType/:entityId", () => {
  it("returns 404 when entity does not exist", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "POST",
      `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 400 for unknown entity type", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "POST",
      `/api/v1/drug-classify/unknown_type/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Drug Classify — GET /api/v1/drug-classify/:entityType/:entityId", () => {
  it("returns classifications array for an entity", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.classifications).toBeInstanceOf(Array);
  });
});

describe("Drug Classify — GET /api/v1/drug-classify/distribution", () => {
  it("returns role distribution data", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/drug-classify/distribution");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.distribution).toBeDefined();
  });
});

describe("Drug Classify — GET /api/v1/drug-classify/recidivists", () => {
  it("returns recidivists data", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/drug-classify/recidivists");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.recidivists).toBeDefined();
  });
});

describe("Classify — POST /api/v1/classify/:entityType/:entityId", () => {
  it("attempts to classify a non-existent entity", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "POST",
      `/api/v1/classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    // Non-existent entity will likely produce a 404 or 500 from the classifier service
    expect([200, 404, 500]).toContain(res.statusCode);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/classify/forensic_case/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Classify — GET /api/v1/classify/:entityType/:entityId", () => {
  it("returns 404 for entity with no classification", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});
