#!/usr/bin/env bash
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2

fail=0
red() { echo "  RED  $*"; fail=1; }
grn() { echo "  ok   $*"; }
need_file() {
  if [ -s "$1" ] && [ "$(wc -c < "$1")" -ge "${2:-1}" ]; then grn "$1"; else red "missing or too small: $1"; fi
}

echo "== P7 exit criteria =="
need_file apps/platform-web/package.json 80
need_file apps/platform-web/src/App.tsx 300
need_file apps/platform-web/src/routes.tsx 200
need_file apps/platform-web/src/components/AppLauncher.tsx 300
need_file apps/platform-web/src/components/DecisionAuditPanel.tsx 200
need_file apps/platform-web/src/__tests__/app-launcher.test.tsx 300
need_file e2e/tests/platform-app-registry.spec.ts 300

grep -Eiq "planned|blocked|pilot|available" apps/platform-web/src/components/AppLauncher.tsx apps/platform-web/src/__tests__/app-launcher.test.tsx && grn "launcher handles registry states" || red "launcher registry states missing"
grep -Eiq "entitlement|/apps|platform" apps/platform-web/src/App.tsx apps/platform-web/src/routes.tsx apps/platform-web/src/components/AppLauncher.tsx && grn "shell reads platform API data" || red "shell platform API integration missing"
if rg -n "localStorage|hardcoded|mockEntitlement|mockRole" apps/platform-web/src >/dev/null 2>&1; then
  red "possible local entitlement logic found"
else
  grn "no obvious local entitlement logic"
fi
npm --workspace apps/platform-web run test >/dev/null 2>&1 && grn "platform-web tests" || red "platform-web tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P7 exit criteria met =="; else echo "== RED: P7 not complete =="; fi
exit "$fail"

