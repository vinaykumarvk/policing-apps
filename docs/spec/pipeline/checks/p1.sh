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

echo "== P1 exit criteria =="
need_file docs/spec/repo-layout.md 700
need_file docs/spec/import-map.yaml 200
need_file package.json 100

node -e 'const p=require("./package.json"); if(!p.scripts||!p.scripts["build:packages"]||!p.scripts.typecheck) throw new Error("missing build:packages/typecheck scripts")' >/dev/null 2>&1 && grn "package scripts exist" || red "package scripts missing"
grep -Eiq "apps|domains|packages|deploy|ownership|python|typescript" docs/spec/repo-layout.md && grn "repo layout covers target areas" || red "repo layout missing required sections"
npm run build:packages >/dev/null 2>&1 && grn "npm run build:packages" || red "npm run build:packages failed"
npm run typecheck >/dev/null 2>&1 && grn "npm run typecheck" || red "npm run typecheck failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P1 exit criteria met =="; else echo "== RED: P1 not complete =="; fi
exit "$fail"

