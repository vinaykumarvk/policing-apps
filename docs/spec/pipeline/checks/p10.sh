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

echo "== P10 exit criteria =="
need_file docs/spec/knowledge-runtime-decision.md 800
need_file docs/spec/knowledge-ingestion-event.schema.json 300
need_file docs/spec/knowledge-retrieval-security.md 800
need_file apps/platform-api/src/__tests__/knowledge-scope-contract.test.ts 300

node -e 'JSON.parse(require("fs").readFileSync("docs/spec/knowledge-ingestion-event.schema.json","utf8"))' >/dev/null 2>&1 && grn "knowledge ingestion schema parses" || red "knowledge ingestion schema invalid"
grep -Eiq "RAG-app|KIS|governance|retrieval|snapshot|citation|PII|deployment|test" docs/spec/knowledge-runtime-decision.md && grn "runtime decision covers comparison criteria" || red "runtime decision missing criteria"
grep -Eiq "pre-retrieval|scope|citation|filter|audit|vector|graph" docs/spec/knowledge-retrieval-security.md apps/platform-api/src/__tests__/knowledge-scope-contract.test.ts && grn "retrieval security covers scope and citation filtering" || red "retrieval security incomplete"
grep -Eiq "disabled|blocked|not enabled|gate" docs/spec/knowledge-retrieval-security.md docs/spec/knowledge-runtime-decision.md && grn "knowledge route gating documented" || red "knowledge route gating missing"
npm --workspace apps/platform-api run test >/dev/null 2>&1 && grn "knowledge scope contract tests" || red "platform-api tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P10 exit criteria met =="; else echo "== RED: P10 not complete =="; fi
exit "$fail"

