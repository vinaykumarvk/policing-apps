import type { EntitlementRequest } from "../../../packages/authz/src";

export type PlatformAppState = "planned" | "pilot" | "available" | "blocked";

export type PlatformClaimGateStatus = "passed" | "pending" | "failed";

export interface PlatformClaimGate {
  domain: string;
  status: PlatformClaimGateStatus;
  server_side_enforced: boolean;
  evidence_ref: string;
  checked_at: string;
  reason_code: string;
}

export type LaunchEntitlementRequest = Omit<EntitlementRequest, "serverVerified">;

export interface PlatformAppDefinition {
  id: string;
  module: string;
  domain: string;
  label: string;
  state: PlatformAppState;
  description: string;
  launch_url?: string;
  status_reason_code: string;
  platform_claim_gate: PlatformClaimGate;
  entitlement_request?: LaunchEntitlementRequest;
}

export interface PlatformAppView {
  id: string;
  module: string;
  domain: string;
  label: string;
  state: PlatformAppState;
  description: string;
  status_reason_code: string;
  platform_claim_gate: PlatformClaimGate;
  launch_url?: string;
  launch_block_reason?: string;
}

export interface RegistryValidationIssue {
  app_id: string;
  reason_code: string;
  detail: string;
}

export class AppRegistryConfigurationError extends Error {
  readonly issues: readonly RegistryValidationIssue[];

  constructor(issues: RegistryValidationIssue[]) {
    super(`platform app registry is unsafe: ${issues.map((issue) => issue.reason_code).join(", ")}`);
    this.name = "AppRegistryConfigurationError";
    this.issues = issues.map((issue) => ({ ...issue }));
  }
}

export const PLATFORM_REGISTRY_VERSION = "platform.app_registry.v1";
const DOMAIN_PLATFORM_AUTH_GATE_EVIDENCE_PREFIXES = ["P8-", "P13-", "P14-", "P15-"] as const;

const DEFAULT_PLATFORM_APPS: readonly PlatformAppDefinition[] = [
  {
    id: "platform-admin",
    module: "platform_admin",
    domain: "platform",
    label: "Platform Administration",
    state: "available",
    description: "Platform registry, entitlement seed, and health control surface.",
    launch_url: "/platform/admin",
    status_reason_code: "AVAILABLE_PLATFORM_CONTROL_PLANE",
    platform_claim_gate: {
      domain: "platform",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P6-platform-api-local-claim-gate",
      checked_at: "2026-07-02T00:00:00Z",
      reason_code: "PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "platform_admin",
      domain: "platform",
      permission: "app_registry:manage",
      org_id: "platform-ops",
      unit_id: "platform-control-plane",
      jurisdiction: {
        country: "IN",
        state: "PB",
      },
      requiredClearance: "restricted",
      assignment: { queue_id: "platform-admin" },
      purpose: "platform_admin",
      requireMfa: true,
    },
  },
  {
    id: "dopams",
    module: "dopams",
    domain: "dopams",
    label: "DOPAMS",
    state: "pilot",
    description: "Pilot DOPAMS case and lead workflow.",
    launch_url: "/domains/dopams",
    status_reason_code: "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: "dopams",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P8-dopams-platform-auth-adapter",
      checked_at: "2026-07-02T00:00:00Z",
      reason_code: "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "dopams",
      domain: "dopams",
      permission: "case:read",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      requiredClearance: "confidential",
      assignment: { case_id: "CASE-DOPAMS-001" },
      purpose: "investigation",
      requireMfa: true,
    },
  },
  {
    id: "iqw",
    module: "iqw",
    domain: "iqw",
    label: "IQW Intake",
    state: "pilot",
    description: "Pilot complaint intake and queue workflow.",
    launch_url: "/domains/iqw",
    status_reason_code: "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: "iqw",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P8-iqw-platform-auth-adapter",
      checked_at: "2026-07-02T00:00:00Z",
      reason_code: "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "iqw",
      domain: "iqw",
      permission: "complaint:read",
      org_id: "mohali-district",
      unit_id: "desk-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      requiredClearance: "restricted",
      assignment: { queue_id: "desk-mohali-intake" },
      purpose: "complaint_intake",
      requireMfa: true,
    },
  },
  {
    id: "social-media",
    module: "social_media",
    domain: "social_media",
    label: "Social Media Intelligence",
    state: "pilot",
    description: "Pilot social media intelligence metadata workflow.",
    launch_url: "/domains/social-media",
    status_reason_code: "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: "social_media",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P14-social-media-platform-auth-adapter",
      checked_at: "2026-07-02T13:00:00Z",
      reason_code: "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "social_media",
      domain: "social_media",
      permission: "content:metadata-read",
      org_id: "state-intelligence",
      unit_id: "analysis-cell",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
      },
      requiredClearance: "confidential",
      assignment: { queue_id: "analysis-state-feed" },
      purpose: "intelligence_analysis",
      requireMfa: true,
    },
  },
  {
    id: "knowledge",
    module: "knowledge",
    domain: "knowledge",
    label: "Knowledge Search",
    state: "pilot",
    description: "Pilot Knowledge Search case-summary retrieval with scoped citations.",
    launch_url: "/domains/knowledge",
    status_reason_code: "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: "knowledge",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P15-knowledge-platform-auth-adapter",
      checked_at: "2026-07-02T13:30:00Z",
      reason_code: "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "knowledge",
      domain: "knowledge",
      permission: "query:case-summary",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      requiredClearance: "confidential",
      assignment: { case_id: "CASE-DOPAMS-001" },
      purpose: "case_review",
      requireMfa: true,
    },
  },
  {
    id: "forensic",
    module: "forensic",
    domain: "forensic",
    label: "Forensic Lab",
    state: "pilot",
    description: "Pilot Forensic evidence metadata workflow.",
    launch_url: "/domains/forensic",
    status_reason_code: "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: "forensic",
      status: "passed",
      server_side_enforced: true,
      evidence_ref: "P13-forensic-platform-auth-adapter",
      checked_at: "2026-07-02T12:22:00Z",
      reason_code: "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement_request: {
      module: "forensic",
      domain: "forensic",
      permission: "evidence:metadata-read",
      org_id: "forensic-lab",
      unit_id: "digital-forensics",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
      },
      requiredClearance: "secret",
      assignment: { evidence_id: "EVID-DOPAMS-001" },
      purpose: "forensic_review",
      requireMfa: true,
    },
  },
];

export function defaultPlatformApps(): PlatformAppDefinition[] {
  return DEFAULT_PLATFORM_APPS.map(copyAppDefinition);
}

export function createPlatformAppRegistry(
  apps: readonly PlatformAppDefinition[] = DEFAULT_PLATFORM_APPS,
): PlatformAppDefinition[] {
  const copied = apps.map(copyAppDefinition);
  const issues = validateAppRegistry(copied);
  if (issues.length > 0) {
    throw new AppRegistryConfigurationError(issues);
  }
  return copied;
}

export function validateAppRegistry(apps: readonly PlatformAppDefinition[]): RegistryValidationIssue[] {
  return apps.flatMap((app) => {
    const issues: RegistryValidationIssue[] = [];
    if ((app.state === "planned" || app.state === "blocked") && app.launch_url) {
      issues.push({
        app_id: app.id,
        reason_code: "INACTIVE_APP_HAS_LAUNCH_URL",
        detail: `${app.state} app ${app.id} must not include a launch URL`,
      });
    }

    if (isLaunchCapableState(app.state) && app.launch_url && !hasPassedPlatformClaimGate(app)) {
      issues.push({
        app_id: app.id,
        reason_code: "LAUNCH_URL_WITHOUT_PLATFORM_CLAIM_GATE",
        detail: `${app.id} has a launch URL before server-side platform claims are enforced`,
      });
    }

    if (isLaunchCapableState(app.state) && app.launch_url && !app.entitlement_request) {
      issues.push({
        app_id: app.id,
        reason_code: "LAUNCH_URL_WITHOUT_ENTITLEMENT_REQUEST",
        detail: `${app.id} has a launch URL without a server-side entitlement request`,
      });
    }

    if (isLaunchCapableState(app.state) && app.domain !== "platform" && hasPassedPlatformClaimGate(app)) {
      if (!hasDomainPlatformAuthGateEvidenceRef(app.platform_claim_gate.evidence_ref)) {
        issues.push({
          app_id: app.id,
          reason_code: "DOMAIN_GATE_EVIDENCE_NOT_PLATFORM_ADAPTER",
          detail: `${app.id} has a launch-capable domain state without platform adapter gate evidence`,
        });
      }
    }

    return issues;
  });
}

export function appView(app: PlatformAppDefinition, entitlementAllowed = false): PlatformAppView {
  const launchUrl = launchUrlForApp(app, entitlementAllowed);
  return {
    id: app.id,
    module: app.module,
    domain: app.domain,
    label: app.label,
    state: app.state,
    description: app.description,
    status_reason_code: app.status_reason_code,
    platform_claim_gate: { ...app.platform_claim_gate },
    ...(launchUrl ? { launch_url: launchUrl } : { launch_block_reason: launchBlockReason(app, entitlementAllowed) }),
  };
}

export function launchUrlForApp(app: PlatformAppDefinition, entitlementAllowed: boolean): string | null {
  if (!app.launch_url) {
    return null;
  }
  if (!isLaunchCapableState(app.state)) {
    return null;
  }
  if (!hasPassedPlatformClaimGate(app)) {
    return null;
  }
  if (!entitlementAllowed) {
    return null;
  }
  return app.launch_url;
}

export function hasPassedPlatformClaimGate(app: PlatformAppDefinition): boolean {
  return app.platform_claim_gate.status === "passed" && app.platform_claim_gate.server_side_enforced === true;
}

export function isLaunchCapableState(state: PlatformAppState): boolean {
  return state === "pilot" || state === "available";
}

function hasDomainPlatformAuthGateEvidenceRef(evidenceRef: string): boolean {
  return DOMAIN_PLATFORM_AUTH_GATE_EVIDENCE_PREFIXES.some((prefix) => evidenceRef.startsWith(prefix));
}

function launchBlockReason(app: PlatformAppDefinition, entitlementAllowed: boolean): string {
  if (!app.launch_url) {
    return "NO_LAUNCH_URL_CONFIGURED";
  }
  if (!isLaunchCapableState(app.state)) {
    return app.state === "blocked" ? "APP_BLOCKED" : "APP_PLANNED";
  }
  if (!hasPassedPlatformClaimGate(app)) {
    return "SERVER_SIDE_PLATFORM_CLAIM_GATE_REQUIRED";
  }
  if (!entitlementAllowed) {
    return "ENTITLEMENT_DENIED";
  }
  return "LAUNCH_BLOCKED";
}

function copyAppDefinition(app: PlatformAppDefinition): PlatformAppDefinition {
  return {
    ...app,
    platform_claim_gate: { ...app.platform_claim_gate },
    entitlement_request: app.entitlement_request
      ? {
          ...app.entitlement_request,
          jurisdiction: { ...app.entitlement_request.jurisdiction },
          assignment: app.entitlement_request.assignment ? { ...app.entitlement_request.assignment } : undefined,
        }
      : undefined,
  };
}
