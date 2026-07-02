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

echo "== P9 exit criteria =="
need_file apps/platform-api/src/migrations/002_platform_case_projection.sql 300
need_file apps/platform-api/src/migrations/003_platform_evidence_projection.sql 300
need_file apps/platform-api/src/services/case-projection.ts 300
need_file apps/platform-api/src/services/evidence-projection.ts 300
need_file apps/platform-api/src/routes/case360.routes.ts 300
need_file apps/platform-api/src/__tests__/case-projection.test.ts 300
need_file apps/platform-api/src/__tests__/evidence-projection.test.ts 300
need_file apps/platform-api/src/__tests__/case360.authz.test.ts 300

grep -Eiq "source.*version|projection.*version|ttl|retention|legal|redact" apps/platform-api/src/services/case-projection.ts apps/platform-api/src/services/evidence-projection.ts apps/platform-api/src/__tests__/*.test.ts && grn "projection lifecycle terms covered" || red "projection lifecycle terms missing"
grep -Eiq "storage_uri|storageUri|storage uri" apps/platform-api/src/__tests__/evidence-projection.test.ts apps/platform-api/src/__tests__/case360.authz.test.ts && grn "storage location behavior tested" || red "storage location behavior not tested"
grep -Eiq "decision|evidence|deny|denied" apps/platform-api/src/__tests__/case360.authz.test.ts && grn "case360 decision evidence tested" || red "case360 decision evidence missing"
npm --workspace apps/platform-api run test >/dev/null 2>&1 && grn "platform-api projection tests" || red "platform-api tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P9 exit criteria met =="; else echo "== RED: P9 not complete =="; fi
exit "$fail"

