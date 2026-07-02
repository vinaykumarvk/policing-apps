#!/usr/bin/env bash
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2

fail=0
red() { echo "  RED  $*"; fail=1; }
grn() { echo "  ok   $*"; }

need_file() {
  local file="$1"
  local min_bytes="${2:-1}"
  if [ -s "$file" ] && [ "$(wc -c < "$file")" -ge "$min_bytes" ]; then
    grn "$file"
  else
    red "missing or too small: $file"
  fi
}

contains() {
  local pattern="$1"
  local file="$2"
  if grep -Eiq "$pattern" "$file"; then
    grn "$file contains $pattern"
  else
    red "$file missing pattern: $pattern"
  fi
}

echo "== P16 exit criteria =="

need_file docs/spec/p16-pilot-cutover-readiness-plan.md 1200
need_file docs/spec/pilot-cutover-approval.json 800
need_file scripts/check-pilot-cutover-readiness.mjs 1200
need_file docs/spec/platform-local-deployment.md 900
need_file docs/spec/cutover-governance-runbook.md 1200
need_file docs/spec/release-gate.md 1200
need_file docs/spec/run-state-governance.md 1200
need_file docs/spec/traceability-matrix.md 1200
need_file docs/spec/manifest.json 1200

for route in dopams iqw forensic social-media knowledge; do
  contains "/domains/${route}" docs/spec/platform-local-deployment.md
  contains "/domains/${route}" docs/spec/cutover-governance-runbook.md
  contains "/domains/${route}" scripts/smoke-platform-local.sh
done

contains "P16" docs/spec/release-gate.md
contains "P16" docs/spec/run-state-governance.md
contains "P16" docs/spec/traceability-matrix.md
contains "pilot-cutover-approval" docs/spec/manifest.json
contains "pending_human_approval" docs/spec/pilot-cutover-approval.json

python3 -m json.tool docs/spec/pilot-cutover-approval.json >/dev/null 2>&1 \
  && grn "approval json parses" \
  || red "approval json invalid"

node - <<'NODE' && grn "approval record keeps human approvals pending" || red "approval record invalid"
const approval = require("./docs/spec/pilot-cutover-approval.json");
if (approval.schema_version !== "platform.pilot_cutover_approval.v1") throw new Error("bad schema version");
if (approval.phase !== "P16") throw new Error("bad phase");
if (approval.approval_status !== "pending_human_approval") throw new Error("approval status must remain pending");
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
const approvals = new Map((approval.required_approvals || []).map((entry) => [entry.role, entry]));
for (const role of requiredRoles) {
  const entry = approvals.get(role);
  if (!entry) throw new Error(`missing role ${role}`);
  if (entry.status !== "pending") throw new Error(`${role} must be pending`);
  if ("approved_at" in entry || "approved_by" in entry) throw new Error(`${role} must not be approved`);
}
const text = JSON.stringify(approval);
for (const surface of ["dopams", "iqw", "forensic", "social-media", "knowledge"]) {
  if (!text.includes(surface)) throw new Error(`missing surface ${surface}`);
}
NODE

node scripts/check-pilot-cutover-readiness.mjs \
  && grn "pilot cutover readiness checker" \
  || red "pilot cutover readiness checker failed"

bash docs/spec/pipeline-p15/checks/p15.sh >/tmp/p16-p15-gate.log 2>&1 \
  && grn "P15 predecessor gate remains green" \
  || { red "P15 predecessor gate failed"; tail -100 /tmp/p16-p15-gate.log; }

node - <<'NODE' && grn "manifest records P16" || red "manifest missing P16"
const manifest = require("./docs/spec/manifest.json");
const p16 = manifest.phase_execution && manifest.phase_execution.P16;
if (!p16 || p16.status !== "complete") throw new Error("P16 not complete");
for (const required of [
  "docs/spec/pilot-cutover-approval.json",
  "scripts/check-pilot-cutover-readiness.mjs",
  "docs/spec/platform-local-deployment.md",
  "docs/spec/cutover-governance-runbook.md",
]) {
  if (!JSON.stringify(p16).includes(required)) throw new Error(`missing evidence ${required}`);
}
NODE

if [ "$fail" -eq 0 ]; then
  echo "== GREEN: P16 exit criteria met =="
else
  echo "== RED: P16 not complete =="
fi
exit "$fail"
