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

echo "== P5 exit criteria =="
for pkg in authz audit-ledger case-core evidence-core; do
  need_file "packages/$pkg/package.json" 80
  node -e "JSON.parse(require('fs').readFileSync('packages/$pkg/package.json','utf8'))" >/dev/null 2>&1 && grn "packages/$pkg/package.json parses" || red "packages/$pkg/package.json invalid"
  npm --workspace "packages/$pkg" run test >/dev/null 2>&1 && grn "$pkg tests" || red "$pkg tests failed"
done

if rg -n "\\bas any\\b|: any\\b" packages/authz packages/audit-ledger packages/case-core packages/evidence-core >/dev/null 2>&1; then
  red "TypeScript any/as any found in platform packages"
else
  grn "no TypeScript any/as any in platform packages"
fi

if [ "$fail" -eq 0 ]; then echo "== GREEN: P5 exit criteria met =="; else echo "== RED: P5 not complete =="; fi
exit "$fail"

