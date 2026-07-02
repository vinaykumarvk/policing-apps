import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import { createPlatformApp } from "../app";
import {
  AppRegistryConfigurationError,
  appView,
  createPlatformAppRegistry,
  defaultPlatformApps,
  launchUrlForApp,
} from "../app-registry";
import type { PlatformClaims } from "../../../../packages/authz/src";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface AppsResponse {
  apps: Array<{
    id: string;
    state: string;
    launch_url?: string;
    launch_block_reason?: string;
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
  };
}

const NOW = "2026-07-01T18:45:00Z";
const typedClaimFixtures = claimFixtures as ClaimFixtureDocument;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing persona ${id}`);
  }
  return found.claim;
}

function platformRequest(path: string, claim: PlatformClaims): Request {
  return new Request(`http://platform.test${path}`, {
    headers: {
      "x-platform-claims": JSON.stringify(claim),
      "x-platform-claims-verified": "true",
    },
  });
}

describe("platform app registry launch safety", () => {
  it("represents the current P15 launch-capable states", () => {
    const apps = createPlatformAppRegistry();
    expect(new Set(apps.map((app) => app.state))).toEqual(new Set(["pilot", "available"]));
  });

  it("does not expose an active launch URL for planned or blocked modules", () => {
    const apps = defaultPlatformApps();
    const socialMedia = apps.find((app) => app.id === "social-media");
    const knowledge = apps.find((app) => app.id === "knowledge");
    if (!socialMedia || !knowledge) {
      throw new Error("missing apps for inactive route variants");
    }
    const inactiveApps = [
      { ...socialMedia, state: "planned" as const, launch_url: undefined },
      { ...knowledge, state: "blocked" as const, launch_url: undefined },
    ];

    inactiveApps.forEach((app) => {
      expect(app.launch_url, app.id).toBeUndefined();
      expect(launchUrlForApp(app, true), app.id).toBeNull();
      const view = appView(app, true);
      expect(view.launch_url, app.id).toBeUndefined();
      expect(view.launch_block_reason, app.id).toMatch(/APP_|NO_LAUNCH/);
    });
  });

  it("rejects pilot or available launch URLs unless the server-side platform-claim gate passed", () => {
    const apps = defaultPlatformApps();
    const dopams = apps.find((app) => app.id === "dopams");
    if (!dopams) {
      throw new Error("missing dopams registry entry");
    }

    expect(() =>
      createPlatformAppRegistry([
        {
          ...dopams,
          platform_claim_gate: {
            ...dopams.platform_claim_gate,
            status: "pending",
            server_side_enforced: false,
          },
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
  });

  it("requires adapter evidence before pilot domain launch URLs can be active", () => {
    const apps = defaultPlatformApps();
    const dopams = apps.find((app) => app.id === "dopams");
    const iqw = apps.find((app) => app.id === "iqw");
    const forensic = apps.find((app) => app.id === "forensic");
    const socialMedia = apps.find((app) => app.id === "social-media");
    const knowledge = apps.find((app) => app.id === "knowledge");
    if (!dopams || !iqw || !forensic || !socialMedia || !knowledge) {
      throw new Error("missing pilot registry entries");
    }

    expect(dopams.platform_claim_gate.evidence_ref).toBe("P8-dopams-platform-auth-adapter");
    expect(iqw.platform_claim_gate.evidence_ref).toBe("P8-iqw-platform-auth-adapter");
    expect(forensic.platform_claim_gate.evidence_ref).toBe("P13-forensic-platform-auth-adapter");
    expect(socialMedia.platform_claim_gate.evidence_ref).toBe("P14-social-media-platform-auth-adapter");
    expect(knowledge.platform_claim_gate.evidence_ref).toBe("P15-knowledge-platform-auth-adapter");
    expect(() =>
      createPlatformAppRegistry([
        {
          ...dopams,
          platform_claim_gate: {
            ...dopams.platform_claim_gate,
            evidence_ref: "P6-dopams-platform-claim-gate",
          },
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
    expect(() =>
      createPlatformAppRegistry([
        {
          ...socialMedia,
          platform_claim_gate: {
            ...socialMedia.platform_claim_gate,
            evidence_ref: "P6-social-media-platform-claim-gate",
          },
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
    expect(() =>
      createPlatformAppRegistry([
        {
          ...knowledge,
          platform_claim_gate: {
            ...knowledge.platform_claim_gate,
            evidence_ref: "P10-knowledge-scope-contract-only",
          },
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
  });

  it("rejects blocked or planned modules that are configured with launch URLs", () => {
    const socialMedia = defaultPlatformApps().find((app) => app.id === "social-media");
    const knowledge = defaultPlatformApps().find((app) => app.id === "knowledge");
    if (!socialMedia || !knowledge) {
      throw new Error("missing inactive registry entries");
    }

    expect(() =>
      createPlatformAppRegistry([
        {
          ...socialMedia,
          state: "planned",
          launch_url: "/domains/social-media",
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
    expect(() =>
      createPlatformAppRegistry([
        {
          ...knowledge,
          state: "blocked",
          launch_url: "/domains/knowledge",
        },
      ]),
    ).toThrow(AppRegistryConfigurationError);
  });

  it("exposes the Forensic launch URL only to an entitled forensic analyst", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(platformRequest("/api/v1/platform/apps?limit=100", persona("forensic-analyst")));
    const body = (await response.json()) as AppsResponse;
    const forensic = body.apps.find((entry) => entry.id === "forensic");
    const socialMedia = body.apps.find((entry) => entry.id === "social-media");
    const knowledge = body.apps.find((entry) => entry.id === "knowledge");

    expect(response.status).toBe(200);
    expect(forensic?.state).toBe("pilot");
    expect(forensic?.launch_url).toBe("/domains/forensic");
    expect(socialMedia?.state).toBe("pilot");
    expect(socialMedia?.launch_url).toBeUndefined();
    expect(knowledge?.state).toBe("pilot");
    expect(knowledge?.launch_url).toBeUndefined();
  });

  it("exposes the Social Media launch URL only to an entitled analyst", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(platformRequest("/api/v1/platform/apps?limit=100", persona("analyst")));
    const body = (await response.json()) as AppsResponse;
    const socialMedia = body.apps.find((entry) => entry.id === "social-media");
    const knowledge = body.apps.find((entry) => entry.id === "knowledge");

    expect(response.status).toBe(200);
    expect(socialMedia?.state).toBe("pilot");
    expect(socialMedia?.launch_url).toBe("/domains/social-media");
    expect(knowledge?.state).toBe("pilot");
    expect(knowledge?.launch_url).toBeUndefined();
  });

  it("exposes the Knowledge launch URL only to an entitled IO", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(platformRequest("/api/v1/platform/apps?limit=100", persona("io")));
    const body = (await response.json()) as AppsResponse;
    const knowledge = body.apps.find((entry) => entry.id === "knowledge");
    const forensic = body.apps.find((entry) => entry.id === "forensic");
    const socialMedia = body.apps.find((entry) => entry.id === "social-media");

    expect(response.status).toBe(200);
    expect(knowledge?.state).toBe("pilot");
    expect(knowledge?.launch_url).toBe("/domains/knowledge");
    expect(forensic?.launch_url).toBeUndefined();
    expect(socialMedia?.launch_url).toBeUndefined();
  });

  it("serves the apps list with bounded pagination and no inactive launch URLs", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(platformRequest("/api/v1/platform/apps?limit=2", persona("desk-operator")));
    const body = (await response.json()) as AppsResponse;

    expect(response.status).toBe(200);
    expect(body.apps).toHaveLength(2);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBeGreaterThan(2);
    expect(body.pagination.next_offset).toBe(2);

    const allResponse = await app.handle(platformRequest("/api/v1/platform/apps?limit=100", persona("desk-operator")));
    const allBody = (await allResponse.json()) as AppsResponse;
    const deniedEntitlementApps = allBody.apps.filter((entry) => entry.launch_block_reason === "ENTITLEMENT_DENIED");
    expect(deniedEntitlementApps.length).toBeGreaterThan(0);
    deniedEntitlementApps.forEach((entry) => {
      expect(entry.launch_url, entry.id).toBeUndefined();
    });
  });
});
