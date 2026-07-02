// Role templates for user creation. Each template pins the org/jurisdiction/
// clearance/assignment context that the app-registry entitlement requests
// expect, so a user created from a template gets deterministic ABAC outcomes.
import type { AssignmentClaim, ClearanceClaim, JurisdictionClaim } from "../../../../packages/authz/src";
import type { UserEntitlement } from "./identity";

export interface RoleTemplate {
  id: string;
  label: string;
  persona: string;
  tenantId: string;
  orgId: string;
  unitIds: readonly string[];
  orgScope: string;
  jurisdiction: JurisdictionClaim;
  clearance: ClearanceClaim;
  assignment: AssignmentClaim;
  purposeAllowed: readonly string[];
  entitlements: readonly UserEntitlement[];
}

const PUNJAB = "punjab-police";

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    id: "platform_administrator",
    label: "Platform Administrator",
    persona: "platform_admin",
    tenantId: PUNJAB,
    orgId: "platform-ops",
    unitIds: ["platform-control-plane"],
    orgScope: "unit",
    jurisdiction: { country: "IN", state: "PB", districts: [], police_stations: [], scope: "state" },
    clearance: { level: "restricted", compartments: ["platform_admin"] },
    assignment: {
      case_ids: [],
      queue_ids: ["platform-admin"],
      evidence_ids: [],
      jurisdiction_wide: true,
      domain_wide: true,
    },
    purposeAllowed: ["platform_admin"],
    entitlements: [
      { module: "platform_admin", domain: "platform", permissions: ["app_registry:manage", "user:manage"] },
    ],
  },
  {
    id: "pilot_operator",
    label: "Pilot Operator (DOPAMS + IQW)",
    persona: "platform_pilot_operator",
    tenantId: PUNJAB,
    orgId: "mohali-district",
    unitIds: ["narcotics-cell-mohali", "desk-mohali"],
    orgScope: "unit",
    jurisdiction: {
      country: "IN",
      state: "PB",
      districts: ["SAS Nagar"],
      police_stations: ["Phase-8"],
      scope: "station",
    },
    clearance: { level: "confidential", compartments: ["narcotics", "casework", "intake"] },
    assignment: {
      case_ids: ["CASE-DOPAMS-001"],
      queue_ids: ["desk-mohali-intake"],
      evidence_ids: ["EVID-DOPAMS-001"],
      jurisdiction_wide: false,
      domain_wide: false,
    },
    purposeAllowed: ["investigation", "complaint_intake"],
    entitlements: [
      { module: "dopams", domain: "dopams", permissions: ["case:read", "evidence:metadata-read"] },
      { module: "iqw", domain: "iqw", permissions: ["complaint:read", "task:queue-read"] },
    ],
  },
  {
    id: "forensic_analyst",
    label: "Forensic Analyst",
    persona: "forensic_analyst",
    tenantId: PUNJAB,
    orgId: "forensic-lab",
    unitIds: ["digital-forensics"],
    orgScope: "unit",
    jurisdiction: {
      country: "IN",
      state: "PB",
      districts: ["SAS Nagar"],
      police_stations: [],
      scope: "district",
    },
    clearance: { level: "secret", compartments: ["digital_evidence", "casework"] },
    assignment: {
      case_ids: ["CASE-DOPAMS-001"],
      queue_ids: ["forensic-review"],
      evidence_ids: ["EVID-DOPAMS-001"],
      jurisdiction_wide: false,
      domain_wide: false,
    },
    purposeAllowed: ["forensic_review"],
    entitlements: [
      { module: "forensic", domain: "forensic", permissions: ["evidence:metadata-read"] },
    ],
  },
  {
    id: "intelligence_analyst",
    label: "Intelligence Analyst (Social Media)",
    persona: "analyst",
    tenantId: PUNJAB,
    orgId: "state-intelligence",
    unitIds: ["analysis-cell"],
    orgScope: "unit",
    jurisdiction: {
      country: "IN",
      state: "PB",
      districts: ["SAS Nagar"],
      police_stations: [],
      scope: "state",
    },
    clearance: { level: "confidential", compartments: ["intelligence"] },
    assignment: {
      case_ids: [],
      queue_ids: ["analysis-state-feed"],
      evidence_ids: [],
      jurisdiction_wide: true,
      domain_wide: false,
    },
    purposeAllowed: ["intelligence_analysis", "case_review"],
    entitlements: [
      {
        module: "social_media",
        domain: "social_media",
        permissions: ["content:metadata-read", "trend:read"],
      },
    ],
  },
  {
    id: "investigating_officer",
    label: "Investigating Officer (Knowledge)",
    persona: "io",
    tenantId: PUNJAB,
    orgId: "mohali-district",
    unitIds: ["narcotics-cell-mohali"],
    orgScope: "unit",
    jurisdiction: {
      country: "IN",
      state: "PB",
      districts: ["SAS Nagar"],
      police_stations: ["Phase-8"],
      scope: "station",
    },
    clearance: { level: "confidential", compartments: ["narcotics", "casework"] },
    assignment: {
      case_ids: ["CASE-DOPAMS-001"],
      queue_ids: ["io-active"],
      evidence_ids: ["EVID-DOPAMS-001"],
      jurisdiction_wide: false,
      domain_wide: false,
    },
    purposeAllowed: ["case_review", "investigation"],
    entitlements: [{ module: "knowledge", domain: "knowledge", permissions: ["query:case-summary"] }],
  },
];

export function findRoleTemplate(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((template) => template.id === id);
}
