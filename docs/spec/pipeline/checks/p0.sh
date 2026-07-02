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
need_exec() {
  if [ -x "$1" ] || [ -s "$1" ]; then grn "$1"; else red "missing script: $1"; fi
}

echo "== P0 exit criteria =="
need_file docs/spec/source-inventory.md 500
need_file docs/spec/secret-hygiene-report.md 500
need_file docs/spec/import-map.yaml 200
need_exec scripts/check-import-allowlist.mjs
need_exec scripts/check-no-known-secret-paths.mjs

ruby -ryaml -e 'YAML.load_file("docs/spec/import-map.yaml")' >/dev/null 2>&1 && grn "import map parses" || red "import map does not parse"
node scripts/check-import-allowlist.mjs >/dev/null 2>&1 && grn "import allowlist check" || red "import allowlist check failed"
node scripts/check-no-known-secret-paths.mjs >/dev/null 2>&1 && grn "known secret path check" || red "known secret path check failed"

grep -Eiq "command|scan|secret|quarantine|rotate|finding" docs/spec/secret-hygiene-report.md && grn "secret hygiene report records scan evidence" || red "secret hygiene report missing scan evidence"
grep -Eiq "policing-apps|compliant-parser|RAG-app" docs/spec/source-inventory.md && grn "source inventory names scoped repos" || red "source inventory missing scoped repos"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P0 exit criteria met =="; else echo "== RED: P0 not complete =="; fi
exit "$fail"

