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

echo "== P15 exit criteria =="

need_file docs/spec/p15-knowledge-platform-launch-plan.md 1200
need_file domains/knowledge/api/package.json 200
need_file domains/knowledge/api/src/platform-auth.ts 1200
need_file domains/knowledge/api/src/platform-scope.ts 800
need_file domains/knowledge/api/src/__tests__/platform-auth.test.ts 1200
need_file deploy/docker-compose/policing-platform.yml 500
need_file deploy/nginx/policing-platform.local.conf 300
need_file scripts/smoke-platform-local.sh 500

contains "P15-knowledge-platform-auth-adapter" domains/knowledge/api/src/platform-auth.ts
contains "buildPreRetrievalScope" domains/knowledge/api/src/platform-scope.ts
contains "filterCitations" domains/knowledge/api/src/platform-scope.ts
contains "knowledgeRetrievalEnabled" packages/authz/src/abac.ts
contains "P15-knowledge-platform-auth-adapter" apps/platform-api/src/app-registry.ts
contains "launch_url: \"/domains/knowledge\"" apps/platform-api/src/app-registry.ts
contains "/domains/knowledge" deploy/nginx/policing-platform.local.conf
contains "knowledge-api" deploy/docker-compose/policing-platform.yml
contains "P15" docs/spec/traceability-matrix.md
contains "Knowledge" docs/spec/release-gate.md
contains "Knowledge" docs/spec/run-state-governance.md

node - <<'NODE' && grn "registry P15 launch state" || red "registry P15 launch state invalid"
const { readFileSync } = require("node:fs");
const src = readFileSync("apps/platform-api/src/app-registry.ts", "utf8");
function block(id) {
  const start = src.indexOf(`id: "${id}"`);
  if (start < 0) throw new Error(`missing ${id}`);
  const next = src.indexOf("\n  {", start + 1);
  return src.slice(start, next < 0 ? src.length : next);
}
if (!src.includes('"P15-"') && !src.includes("P15-")) throw new Error("P15 evidence prefix missing");
const knowledge = block("knowledge");
if (!/state:\s*"pilot"/.test(knowledge)) throw new Error("knowledge is not pilot");
if (!/launch_url:\s*"\/domains\/knowledge"/.test(knowledge)) throw new Error("knowledge launch_url missing");
if (!/status:\s*"passed"/.test(knowledge)) throw new Error("knowledge gate not passed");
if (!/server_side_enforced:\s*true/.test(knowledge)) throw new Error("knowledge server_side_enforced missing");
if (!/evidence_ref:\s*"P15-knowledge-platform-auth-adapter"/.test(knowledge)) throw new Error("knowledge evidence ref missing");
if (!/entitlement_request:/.test(knowledge)) throw new Error("knowledge entitlement_request missing");
if (!/permission:\s*"query:case-summary"/.test(knowledge)) throw new Error("knowledge entitlement permission missing");
for (const [id, evidence] of [
  ["dopams", "P8-dopams-platform-auth-adapter"],
  ["iqw", "P8-iqw-platform-auth-adapter"],
  ["forensic", "P13-forensic-platform-auth-adapter"],
  ["social-media", "P14-social-media-platform-auth-adapter"],
]) {
  const app = block(id);
  if (!/state:\s*"pilot"/.test(app)) throw new Error(`${id} must stay pilot`);
  if (!app.includes(evidence)) throw new Error(`${id} evidence changed`);
}
NODE

node - <<'NODE' && grn "claim fixture includes Knowledge entitlement persona" || red "claim fixture missing Knowledge capability"
const fixtures = require("./docs/spec/auth-claim-fixtures.json");
const io = fixtures.personas.find((entry) => entry.id === "io")?.claim;
if (!io) throw new Error("missing io persona");
if (!io.modules.includes("knowledge")) throw new Error("io missing knowledge module");
const knowledge = io.domain_permissions.find((entry) => entry.domain === "knowledge");
if (!knowledge || !knowledge.permissions.includes("query:case-summary")) {
  throw new Error("io missing knowledge query permission");
}
if (!io.purpose.allowed.includes("case_review")) throw new Error("io missing case_review purpose");
NODE

python3 -m json.tool docs/spec/manifest.json >/dev/null 2>&1 \
  && grn "manifest json parses" \
  || red "manifest json invalid"

node - <<'NODE' && grn "manifest records P15" || red "manifest missing P15"
const manifest = require("./docs/spec/manifest.json");
const p15 = manifest.phase_execution && manifest.phase_execution.P15;
if (!p15 || p15.status !== "complete") throw new Error("P15 not complete");
for (const required of [
  "domains/knowledge/api/src/platform-auth.ts",
  "domains/knowledge/api/src/platform-scope.ts",
  "domains/knowledge/api/src/__tests__/platform-auth.test.ts",
  "apps/platform-api/src/app-registry.ts",
  "scripts/smoke-platform-local.sh",
]) {
  if (!JSON.stringify(p15).includes(required)) throw new Error(`missing evidence ${required}`);
}
const scope = JSON.stringify(manifest.release_scope ?? manifest.release_1_scope ?? manifest);
if (!scope.includes("knowledge-api")) throw new Error("manifest scope missing knowledge-api");
NODE

npm --workspace domains/knowledge/api run test >/tmp/p15-knowledge-test.log 2>&1 \
  && grn "knowledge platform adapter tests" \
  || { red "knowledge platform adapter tests failed"; tail -100 /tmp/p15-knowledge-test.log; }

npm --workspace domains/knowledge/api run typecheck >/tmp/p15-knowledge-typecheck.log 2>&1 \
  && grn "knowledge typecheck" \
  || { red "knowledge typecheck failed"; tail -100 /tmp/p15-knowledge-typecheck.log; }

npm --workspace packages/authz run test >/tmp/p15-authz-test.log 2>&1 \
  && grn "authz tests" \
  || { red "authz tests failed"; tail -100 /tmp/p15-authz-test.log; }

npm --workspace apps/platform-api run test >/tmp/p15-platform-api-test.log 2>&1 \
  && grn "platform-api tests" \
  || { red "platform-api tests failed"; tail -100 /tmp/p15-platform-api-test.log; }

npm --workspace apps/platform-web run test >/tmp/p15-platform-web-test.log 2>&1 \
  && grn "platform-web tests" \
  || { red "platform-web tests failed"; tail -100 /tmp/p15-platform-web-test.log; }

(cd /Users/n15318/RAG-app && npm --workspace apps/api exec -- vitest run src/__tests__/retrieval/platform-scope-contract.test.ts) >/tmp/p15-rag-scope-test.log 2>&1 \
  && grn "RAG-app platform scope contract" \
  || { red "RAG-app platform scope contract failed"; tail -100 /tmp/p15-rag-scope-test.log; }

bash scripts/smoke-platform-local.sh >/tmp/p15-smoke.log 2>&1 \
  && grn "local smoke script" \
  || { red "local smoke script failed"; tail -100 /tmp/p15-smoke.log; }

if [ "$fail" -eq 0 ]; then
  echo "== GREEN: P15 exit criteria met =="
else
  echo "== RED: P15 not complete =="
fi
exit "$fail"
