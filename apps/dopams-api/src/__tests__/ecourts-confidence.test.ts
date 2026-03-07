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
    token = await getAuthToken(app, "admin", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("eCourts Confidence Scoring — FR-06", () => {
  it("POST /api/v1/court-cases without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: "CNR-NOAUTH-001",
        caseNumber: "CC/2026/NA",
        courtName: "Test Court",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("court case with confidenceScore < 0.6 gets review_status=AMBIGUOUS", async () => {
    const cnr = `CNR-LOW-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/LOW",
        courtName: "District Court, Hyderabad",
        confidenceScore: 0.35,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCase");
    expect(body.courtCase.review_status).toBe("AMBIGUOUS");
    expect(body.courtCase.confidence_score).toBe(0.35);
  });

  it.skipIf(!dbReady)("court case with confidenceScore = 0.59 gets AMBIGUOUS", async () => {
    const cnr = `CNR-EDGE-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/EDGE",
        courtName: "District Court, Visakhapatnam",
        confidenceScore: 0.59,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.courtCase.review_status).toBe("AMBIGUOUS");
  });

  it.skipIf(!dbReady)("court case with confidenceScore >= 0.6 gets AUTO_MATCHED", async () => {
    const cnr = `CNR-HIGH-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/HIGH",
        courtName: "High Court, Telangana",
        confidenceScore: 0.85,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCase");
    expect(body.courtCase.review_status).toBe("AUTO_MATCHED");
    expect(body.courtCase.confidence_score).toBe(0.85);
  });

  it.skipIf(!dbReady)("court case with confidenceScore = 0.6 gets AUTO_MATCHED (boundary)", async () => {
    const cnr = `CNR-BOUNDARY-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/BOUND",
        courtName: "Sessions Court, Warangal",
        confidenceScore: 0.6,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.courtCase.review_status).toBe("AUTO_MATCHED");
  });

  it.skipIf(!dbReady)("court case without confidenceScore defaults to AUTO_MATCHED", async () => {
    const cnr = `CNR-NOCONF-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/NOCONF",
        courtName: "Magistrate Court, Nizamabad",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.courtCase.review_status).toBe("AUTO_MATCHED");
  });

  it.skipIf(!dbReady)("GET /api/v1/court-cases filters by review_status", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/court-cases?review_status=AMBIGUOUS",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCases");
    expect(Array.isArray(body.courtCases)).toBe(true);
    // All returned cases should have AMBIGUOUS review_status
    for (const cc of body.courtCases) {
      expect(cc.review_status).toBe("AMBIGUOUS");
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/court-cases filters by review_status=AUTO_MATCHED", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/court-cases?review_status=AUTO_MATCHED",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCases");
    expect(Array.isArray(body.courtCases)).toBe(true);
    for (const cc of body.courtCases) {
      expect(cc.review_status).toBe("AUTO_MATCHED");
    }
  });
});
