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

echo "== P14 exit criteria =="

need_file docs/spec/p14-social-media-platform-launch-plan.md 1000
need_file apps/social-media-api/src/middleware/platform-auth.ts 1000
need_file apps/social-media-api/src/__tests__/platform-auth.test.ts 1000
need_file deploy/docker-compose/policing-platform.yml 500
need_file deploy/nginx/policing-platform.local.conf 300
need_file scripts/smoke-platform-local.sh 500

contains "P14-social-media-platform-auth-adapter" apps/social-media-api/src/middleware/platform-auth.ts
contains "registerSocialMediaPlatformAuthMiddleware" apps/social-media-api/src/app.ts
contains "P14-social-media-platform-auth-adapter" apps/platform-api/src/app-registry.ts
contains "launch_url: \"/domains/social-media\"" apps/platform-api/src/app-registry.ts
contains "/domains/social-media" deploy/nginx/policing-platform.local.conf
contains "social-media-api" deploy/docker-compose/policing-platform.yml
contains "P14" docs/spec/traceability-matrix.md
contains "Social Media" docs/spec/release-gate.md
contains "Social Media" docs/spec/run-state-governance.md

node - <<'NODE' && grn "registry P14 launch state" || red "registry P14 launch state invalid"
const { readFileSync } = require("node:fs");
const src = readFileSync("apps/platform-api/src/app-registry.ts", "utf8");
function block(id) {
  const start = src.indexOf(`id: "${id}"`);
  if (start < 0) throw new Error(`missing ${id}`);
  const next = src.indexOf("\n  {", start + 1);
  return src.slice(start, next < 0 ? src.length : next);
}
const social = block("social-media");
if (!/state:\s*"pilot"/.test(social)) throw new Error("social-media is not pilot");
if (!/launch_url:\s*"\/domains\/social-media"/.test(social)) throw new Error("social-media launch_url missing");
if (!/status:\s*"passed"/.test(social)) throw new Error("social-media gate not passed");
if (!/server_side_enforced:\s*true/.test(social)) throw new Error("social-media server_side_enforced missing");
if (!/evidence_ref:\s*"P14-social-media-platform-auth-adapter"/.test(social)) throw new Error("social-media evidence ref missing");
if (!/entitlement_request:/.test(social)) throw new Error("social-media entitlement_request missing");
if (!/permission:\s*"content:metadata-read"/.test(social)) throw new Error("social-media entitlement permission missing");
const knowledge = block("knowledge");
if (!/state:\s*"blocked"/.test(knowledge)) throw new Error("knowledge must stay blocked");
if (/launch_url:/.test(knowledge)) throw new Error("knowledge must not have launch_url");
const forensic = block("forensic");
if (!/state:\s*"pilot"/.test(forensic)) throw new Error("forensic must stay pilot");
if (!/evidence_ref:\s*"P13-forensic-platform-auth-adapter"/.test(forensic)) throw new Error("forensic P13 evidence changed");
NODE

python3 -m json.tool docs/spec/manifest.json >/dev/null 2>&1 \
  && grn "manifest json parses" \
  || red "manifest json invalid"

node - <<'NODE' && grn "manifest records P14" || red "manifest missing P14"
const manifest = require("./docs/spec/manifest.json");
const p14 = manifest.phase_execution && manifest.phase_execution.P14;
if (!p14 || p14.status !== "complete") throw new Error("P14 not complete");
for (const required of [
  "apps/social-media-api/src/middleware/platform-auth.ts",
  "apps/social-media-api/src/__tests__/platform-auth.test.ts",
  "apps/platform-api/src/app-registry.ts",
  "scripts/smoke-platform-local.sh",
]) {
  if (!JSON.stringify(p14).includes(required)) throw new Error(`missing evidence ${required}`);
}
const scope = JSON.stringify(manifest.release_scope ?? manifest.release_1_scope ?? manifest);
if (!scope.includes("social-media-api")) throw new Error("manifest scope missing social-media-api");
if (!scope.includes("knowledge-api")) throw new Error("manifest scope missing knowledge-api");
NODE

npm --workspace apps/social-media-api exec -- vitest run src/__tests__/platform-auth.test.ts >/tmp/p14-social-media-test.log 2>&1 \
  && grn "social-media platform-auth tests" \
  || { red "social-media platform-auth tests failed"; tail -80 /tmp/p14-social-media-test.log; }

npm --workspace apps/social-media-api run typecheck >/tmp/p14-social-media-typecheck.log 2>&1 \
  && grn "social-media typecheck" \
  || { red "social-media typecheck failed"; tail -80 /tmp/p14-social-media-typecheck.log; }

npm --workspace apps/platform-api run test >/tmp/p14-platform-api-test.log 2>&1 \
  && grn "platform-api tests" \
  || { red "platform-api tests failed"; tail -80 /tmp/p14-platform-api-test.log; }

npm --workspace apps/platform-web run test >/tmp/p14-platform-web-test.log 2>&1 \
  && grn "platform-web tests" \
  || { red "platform-web tests failed"; tail -80 /tmp/p14-platform-web-test.log; }

bash scripts/smoke-platform-local.sh >/tmp/p14-smoke.log 2>&1 \
  && grn "local smoke script" \
  || { red "local smoke script failed"; tail -80 /tmp/p14-smoke.log; }

if [ "$fail" -eq 0 ]; then
  echo "== GREEN: P14 exit criteria met =="
else
  echo "== RED: P14 not complete =="
fi
exit "$fail"
