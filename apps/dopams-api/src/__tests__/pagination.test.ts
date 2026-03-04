import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
  if (dbReady) {
    token = await getAuthToken(app, "officer1", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Pagination – Alerts", () => {
  it.skipIf(!dbReady)("respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/alerts?limit=2",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.alerts.length).toBeLessThanOrEqual(2);
  });

  it.skipIf(!dbReady)("respects offset parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/alerts?limit=1&offset=0",
    });
    const resOffset = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/alerts?limit=1&offset=1",
    });

    expect(res.statusCode).toBe(200);
    expect(resOffset.statusCode).toBe(200);

    const first = JSON.parse(res.body).alerts;
    const second = JSON.parse(resOffset.body).alerts;

    // If there is more than 1 alert, the two should differ
    if (first.length > 0 && second.length > 0) {
      expect(first[0].alert_id).not.toBe(second[0].alert_id);
    }
  });
});

describe("Pagination – Leads", () => {
  it.skipIf(!dbReady)("respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/leads?limit=3",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.leads.length).toBeLessThanOrEqual(3);
  });

  it.skipIf(!dbReady)("returns total count alongside paginated results", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/leads?limit=1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(body.leads.length);
  });
});

describe("Pagination – Cases", () => {
  it.skipIf(!dbReady)("respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/cases?limit=2",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cases.length).toBeLessThanOrEqual(2);
  });
});

describe("Pagination – Subjects", () => {
  it.skipIf(!dbReady)("respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/subjects?limit=2",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.subjects.length).toBeLessThanOrEqual(2);
  });

  it.skipIf(!dbReady)("respects offset parameter on subjects", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/subjects?limit=1&offset=0",
    });
    const resOffset = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/subjects?limit=1&offset=1",
    });

    expect(res.statusCode).toBe(200);
    expect(resOffset.statusCode).toBe(200);

    const first = JSON.parse(res.body).subjects;
    const second = JSON.parse(resOffset.body).subjects;

    if (first.length > 0 && second.length > 0) {
      expect(first[0].subject_id).not.toBe(second[0].subject_id);
    }
  });
});
