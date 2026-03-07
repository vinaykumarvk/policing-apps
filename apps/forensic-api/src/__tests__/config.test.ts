import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
} from "../test-helpers";

let app: TestApp;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t) {
    token = t;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  Config — GET /api/v1/config/workflows                              */
/* ------------------------------------------------------------------ */

describe("Config — GET /api/v1/config/workflows", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config/workflows",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists workflow definitions", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/config/workflows");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.workflows).toBeInstanceOf(Array);
    // Forensic API should have at least one workflow definition
    expect(body.workflows.length).toBeGreaterThan(0);
    // Each workflow should have expected shape
    for (const wf of body.workflows) {
      expect(wf.entityType).toBeDefined();
      expect(typeof wf.stateCount).toBe("number");
      expect(typeof wf.transitionCount).toBe("number");
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Config — GET /api/v1/config/workflows/:entityType                  */
/* ------------------------------------------------------------------ */

describe("Config — GET /api/v1/config/workflows/:entityType", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config/workflows/forensic_case",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns workflow definition for a valid entity type", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/config/workflows/forensic_case",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.definition).toBeDefined();
  });

  it("returns 404 for a non-existent entity type", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/config/workflows/nonexistent_entity",
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("WORKFLOW_NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Config — GET /api/v1/config/roles                                  */
/* ------------------------------------------------------------------ */

describe("Config — GET /api/v1/config/roles", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config/roles",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists available roles", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/config/roles");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.roles).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Config — GET /api/v1/config/sla                                    */
/* ------------------------------------------------------------------ */

describe("Config — GET /api/v1/config/sla", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config/sla",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns SLA configuration", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/config/sla");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.slaConfig).toBeInstanceOf(Array);
  });
});
