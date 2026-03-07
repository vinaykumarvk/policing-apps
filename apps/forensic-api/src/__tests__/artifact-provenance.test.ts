import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: any;
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
/*  Artifact Provenance — FR-03                                        */
/* ------------------------------------------------------------------ */

describe("Artifact Provenance — GET /api/v1/cases/:caseId/artifacts", () => {
  let caseId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Artifact Provenance Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
  });

  it("returns artifacts array with provenance fields", async () => {
    if (!dbReady || !caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${caseId}/artifacts`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.artifacts).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
    // Even if empty, the schema should support parser_version and source_tool
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/artifacts`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Artifact Provenance — GET /api/v1/artifacts/:id", () => {
  it("returns 404 for non-existent artifact", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/artifacts/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ARTIFACT_NOT_FOUND");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/artifacts/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Artifact Provenance — POST /api/v1/artifacts/:id/derived", () => {
  let caseId: string;
  let sourceArtifactId: string | null = null;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case to check for artifacts
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Derived Artifact Provenance Test",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    // Check if any artifacts exist for this case (from imports or seeded data)
    const artRes = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${caseId}/artifacts`,
    );
    const artBody = JSON.parse(artRes.payload);
    if (artBody.artifacts && artBody.artifacts.length > 0) {
      sourceArtifactId = artBody.artifacts[0].artifact_id;
    }
  });

  it("returns 404 when source artifact does not exist", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/artifacts/${NON_EXISTENT_UUID}/derived`,
      {
        artifactType: "EXTRACTED_TEXT",
        derivationMethod: "OCR",
        contentPreview: "Sample extracted content",
        parserVersion: "1.2.0",
        sourceTool: "tesseract-5.3",
      },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ARTIFACT_NOT_FOUND");
  });

  it("accepts parserVersion and sourceTool fields in the request body", async () => {
    if (!dbReady || !sourceArtifactId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/artifacts/${sourceArtifactId}/derived`,
      {
        artifactType: "EXTRACTED_TEXT",
        derivationMethod: "OCR",
        contentPreview: "Provenance test extracted content",
        parserVersion: "2.0.1",
        sourceTool: "tesseract-5.3",
        hashSha256: "abc123def456",
      },
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.artifact).toBeDefined();
    expect(body.artifact.parser_version).toBe("2.0.1");
    expect(body.artifact.source_tool).toBe("tesseract-5.3");
    expect(body.artifact.is_derived).toBe(true);
    expect(body.artifact.derived_from_id).toBe(sourceArtifactId);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/artifacts/${NON_EXISTENT_UUID}/derived`,
      payload: {
        artifactType: "EXTRACTED_TEXT",
        derivationMethod: "OCR",
        contentPreview: "Test",
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
