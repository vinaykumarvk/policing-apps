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

echo "== P13 exit criteria =="

need_file docs/spec/p13-forensic-platform-launch-plan.md 1000
need_file apps/forensic-api/src/middleware/platform-auth.ts 1000
need_file apps/forensic-api/src/__tests__/platform-auth.test.ts 1000
need_file deploy/docker-compose/policing-platform.yml 500
need_file deploy/nginx/policing-platform.local.conf 300
need_file scripts/smoke-platform-local.sh 500

contains "P13-forensic-platform-auth-adapter" apps/forensic-api/src/middleware/platform-auth.ts
contains "registerForensicPlatformAuthMiddleware" apps/forensic-api/src/app.ts
contains "P13-forensic-platform-auth-adapter" apps/platform-api/src/app-registry.ts
contains "launch_url: \"/domains/forensic\"" apps/platform-api/src/app-registry.ts
contains "/domains/forensic" deploy/nginx/policing-platform.local.conf
contains "forensic-api" deploy/docker-compose/policing-platform.yml
contains "P13" docs/spec/traceability-matrix.md
contains "Forensic" docs/spec/release-gate.md
contains "Forensic" docs/spec/run-state-governance.md

node - <<'NODE' && grn "registry P13 launch state" || red "registry P13 launch state invalid"
const { readFileSync } = require("node:fs");
const src = readFileSync("apps/platform-api/src/app-registry.ts", "utf8");
function block(id) {
  const start = src.indexOf(`id: "${id}"`);
  if (start < 0) throw new Error(`missing ${id}`);
  const next = src.indexOf("\n  {", start + 1);
  return src.slice(start, next < 0 ? src.length : next);
}
const forensic = block("forensic");
if (!/state:\s*"pilot"/.test(forensic)) throw new Error("forensic is not pilot");
if (!/launch_url:\s*"\/domains\/forensic"/.test(forensic)) throw new Error("forensic launch_url missing");
if (!/status:\s*"passed"/.test(forensic)) throw new Error("forensic gate not passed");
if (!/server_side_enforced:\s*true/.test(forensic)) throw new Error("forensic server_side_enforced missing");
if (!/entitlement_request:/.test(forensic)) throw new Error("forensic entitlement_request missing");
const social = block("social-media");
if (!/state:\s*"planned"/.test(social)) throw new Error("social-media must stay planned");
if (/launch_url:/.test(social)) throw new Error("social-media must not have launch_url");
const knowledge = block("knowledge");
if (!/state:\s*"blocked"/.test(knowledge)) throw new Error("knowledge must stay blocked");
if (/launch_url:/.test(knowledge)) throw new Error("knowledge must not have launch_url");
NODE

python3 -m json.tool docs/spec/manifest.json >/dev/null 2>&1 \
  && grn "manifest json parses" \
  || red "manifest json invalid"

node - <<'NODE' && grn "manifest records P13" || red "manifest missing P13"
const manifest = require("./docs/spec/manifest.json");
const p13 = manifest.phase_execution && manifest.phase_execution.P13;
if (!p13 || p13.status !== "complete") throw new Error("P13 not complete");
for (const required of [
  "apps/forensic-api/src/middleware/platform-auth.ts",
  "apps/forensic-api/src/__tests__/platform-auth.test.ts",
  "apps/platform-api/src/app-registry.ts",
  "scripts/smoke-platform-local.sh",
]) {
  if (!JSON.stringify(p13).includes(required)) throw new Error(`missing evidence ${required}`);
}
NODE

npm --workspace apps/forensic-api exec -- vitest run src/__tests__/platform-auth.test.ts >/tmp/p13-forensic-test.log 2>&1 \
  && grn "forensic platform-auth tests" \
  || { red "forensic platform-auth tests failed"; tail -80 /tmp/p13-forensic-test.log; }

npm --workspace apps/forensic-api run typecheck >/tmp/p13-forensic-typecheck.log 2>&1 \
  && grn "forensic typecheck" \
  || { red "forensic typecheck failed"; tail -80 /tmp/p13-forensic-typecheck.log; }

npm --workspace apps/platform-api run test >/tmp/p13-platform-api-test.log 2>&1 \
  && grn "platform-api tests" \
  || { red "platform-api tests failed"; tail -80 /tmp/p13-platform-api-test.log; }

npm --workspace apps/platform-web run test >/tmp/p13-platform-web-test.log 2>&1 \
  && grn "platform-web tests" \
  || { red "platform-web tests failed"; tail -80 /tmp/p13-platform-web-test.log; }

bash scripts/smoke-platform-local.sh >/tmp/p13-smoke.log 2>&1 \
  && grn "local smoke script" \
  || { red "local smoke script failed"; tail -80 /tmp/p13-smoke.log; }

if [ "$fail" -eq 0 ]; then
  echo "== GREEN: P13 exit criteria met =="
else
  echo "== RED: P13 not complete =="
fi
exit "$fail"
