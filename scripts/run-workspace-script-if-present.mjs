#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [, , scriptName, ...patterns] = process.argv;

function fail(message) {
  console.error(`RED ${message}`);
  process.exit(1);
}

if (!scriptName || patterns.length === 0) {
  fail("usage: node scripts/run-workspace-script-if-present.mjs <script> <workspace-path-or-glob>...");
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function expandSegments(segments, absoluteBase) {
  if (segments.length === 0) return [absoluteBase];
  const [segment, ...rest] = segments;
  if (segment === "*") {
    if (!existsSync(absoluteBase)) return [];
    return readdirSync(absoluteBase, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => expandSegments(rest, path.join(absoluteBase, entry.name)));
  }
  return expandSegments(rest, path.join(absoluteBase, segment));
}

const workspacePaths = [...new Set(patterns.flatMap((pattern) => {
  const matches = expandSegments(pattern.split("/"), ROOT)
    .filter((workspacePath) => existsSync(path.join(workspacePath, "package.json")))
    .map((workspacePath) => toPosix(path.relative(ROOT, workspacePath)));
  return matches;
}))].sort();

if (workspacePaths.length === 0) {
  console.log(`ok no workspaces matched ${patterns.join(", ")}; ${scriptName} skipped`);
  process.exit(0);
}

let ran = 0;
for (const workspacePath of workspacePaths) {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, workspacePath, "package.json"), "utf8"));
  if (!packageJson.scripts?.[scriptName]) {
    console.log(`ok ${workspacePath} has no ${scriptName} script; skipped`);
    continue;
  }
  ran += 1;
  const result = spawnSync("npm", ["--workspace", workspacePath, "run", scriptName], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (ran === 0) {
  console.log(`ok no matched workspaces expose ${scriptName}; skipped`);
}
