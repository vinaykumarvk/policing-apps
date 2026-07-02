#!/usr/bin/env node
import { readFileSync } from "node:fs";

const surfaces = [
  { id: "dopams", route: "/domains/dopams", evidence: "P8-dopams-platform-auth-adapter" },
  { id: "iqw", route: "/domains/iqw", evidence: "P8-iqw-platform-auth-adapter" },
  { id: "forensic", route: "/domains/forensic", evidence: "P13-forensic-platform-auth-adapter" },
  { id: "social-media", route: "/domains/social-media", evidence: "P14-social-media-platform-auth-adapter" },
  { id: "knowledge", route: "/domains/knowledge", evidence: "P15-knowledge-platform-auth-adapter" },
];

const requiredRoles = [
  "platform_release_owner",
  "security_risk_owner",
  "dopams_domain_owner",
  "iqw_domain_owner",
  "forensic_domain_owner",
  "social_media_domain_owner",
  "knowledge_rag_owner",
  "legal_audit_owner",
  "operations_owner",
];

function read(path) {
  return readFileSync(path, "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireText(path, patterns) {
  const text = read(path);
  for (const pattern of patterns) {
    assert(text.includes(pattern), `${path} missing ${pattern}`);
  }
  return text;
}

const approval = json("docs/spec/pilot-cutover-approval.json");
assert(approval.schema_version === "platform.pilot_cutover_approval.v1", "approval schema mismatch");
assert(approval.phase === "P16", "approval phase mismatch");
assert(approval.approval_status === "pending_human_approval", "approval must remain pending");
const approvalsByRole = new Map((approval.required_approvals ?? []).map((entry) => [entry.role, entry]));
for (const role of requiredRoles) {
  const entry = approvalsByRole.get(role);
  assert(entry, `approval missing role ${role}`);
  assert(entry.status === "pending", `${role} must remain pending`);
  assert(!("approved_at" in entry), `${role} must not include approved_at`);
  assert(!("approved_by" in entry), `${role} must not include approved_by`);
}

const registry = requireText("apps/platform-api/src/app-registry.ts", [
  "P8-dopams-platform-auth-adapter",
  "P8-iqw-platform-auth-adapter",
  "P13-forensic-platform-auth-adapter",
  "P14-social-media-platform-auth-adapter",
  "P15-knowledge-platform-auth-adapter",
]);
const nginx = read("deploy/nginx/policing-platform.local.conf");
const smoke = read("scripts/smoke-platform-local.sh");
const localDeployment = requireText("docs/spec/platform-local-deployment.md", ["P16", "pending human approval"]);
const cutover = requireText("docs/spec/cutover-governance-runbook.md", [
  "P16",
  "pending human approval",
  "docs/spec/pilot-cutover-approval.json",
]);
const releaseGate = requireText("docs/spec/release-gate.md", ["P16", "pilot-cutover-approval.json"]);
const runState = requireText("docs/spec/run-state-governance.md", ["P16", "pilot-cutover-approval.json"]);
const traceability = requireText("docs/spec/traceability-matrix.md", ["P16", "pilot-cutover-approval.json"]);
const releaseGateLower = releaseGate.toLowerCase();
const runStateLower = runState.toLowerCase();
const traceabilityLower = traceability.toLowerCase();

for (const surface of surfaces) {
  assert(registry.includes(`id: "${surface.id}"`), `registry missing ${surface.id}`);
  assert(registry.includes(`launch_url: "${surface.route}"`), `registry missing ${surface.route}`);
  assert(registry.includes(surface.evidence), `registry missing ${surface.evidence}`);
  assert(nginx.includes(surface.route), `nginx missing ${surface.route}`);
  assert(smoke.includes(surface.route), `smoke missing ${surface.route}`);
  assert(localDeployment.includes(surface.route), `local deployment missing ${surface.route}`);
  assert(cutover.includes(surface.route), `cutover runbook missing ${surface.route}`);
  assert(releaseGateLower.includes(surface.id), `release gate missing ${surface.id}`);
  assert(runStateLower.includes(surface.id), `run-state missing ${surface.id}`);
  assert(traceabilityLower.includes(surface.id), `traceability missing ${surface.id}`);
}

for (const persona of ["forensic", "analyst", "knowledge"]) {
  assert(smoke.includes(`X-Platform-Smoke-Persona: ${persona}`), `smoke missing ${persona} persona`);
}

const manifest = json("docs/spec/manifest.json");
const p16 = manifest.phase_execution?.P16;
assert(p16?.status === "complete", "manifest must record P16 complete");
for (const evidence of [
  "docs/spec/pilot-cutover-approval.json",
  "scripts/check-pilot-cutover-readiness.mjs",
  "docs/spec/platform-local-deployment.md",
  "docs/spec/cutover-governance-runbook.md",
  "docs/spec/release-gate.md",
  "docs/spec/run-state-governance.md",
  "docs/spec/traceability-matrix.md",
]) {
  assert(JSON.stringify(p16).includes(evidence), `P16 manifest evidence missing ${evidence}`);
}
assert((p16.checks ?? []).includes("node scripts/check-pilot-cutover-readiness.mjs"), "P16 manifest missing readiness checker");
assert((p16.checks ?? []).includes("bash docs/spec/pipeline-p16/checks/p16.sh"), "P16 manifest missing P16 oracle");
assert(JSON.stringify(manifest.pipeline_gates).includes("P16"), "pipeline gates missing P16");

console.log("P16 pilot cutover readiness checks passed");
