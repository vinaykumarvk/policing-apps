#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = false;

function ok(message) {
  console.log(`ok ${message}`);
}

function red(message) {
  failed = true;
  console.error(`RED ${message}`);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const rootPackage = readJson("package.json");
const layoutPath = path.join(ROOT, "docs/spec/repo-layout.md");
const importMapPath = path.join(ROOT, "docs/spec/import-map.yaml");
const layoutText = existsSync(layoutPath) ? readFileSync(layoutPath, "utf8") : "";
const importMapText = existsSync(importMapPath) ? readFileSync(importMapPath, "utf8") : "";

for (const workspace of ["apps/*", "domains/*/*", "domains/*/packages/*", "packages/*"]) {
  if (rootPackage.workspaces?.includes(workspace)) ok(`workspace ${workspace}`);
  else red(`missing workspace ${workspace}`);
}

const expectedScripts = {
  "dev:api": "npm --workspace apps/api run dev",
  "dev:citizen": "npm --workspace apps/citizen run dev",
  "dev:officer": "npm --workspace apps/officer run dev",
  "dev:dopams": "npm --workspace apps/dopams-api run dev",
  "dev:forensic": "npm --workspace apps/forensic-api run dev",
  "dev:social-media": "npm --workspace apps/social-media-api run dev",
  "dev:dopams-ui": "npm --workspace apps/dopams-ui run dev",
  "dev:forensic-ui": "npm --workspace apps/forensic-ui run dev",
  "dev:social-media-ui": "npm --workspace apps/social-media-ui run dev",
  "build:packages": "npm run build:shared && npm run build:workflow-engine && npm run build:api-core && npm run build:api-integrations",
  "typecheck": "npm --workspace packages/workflow-engine run typecheck && npm --workspace packages/shared run typecheck && npm --workspace packages/api-core run typecheck && npm --workspace packages/api-integrations run typecheck && npm --workspace apps/api run typecheck && npm --workspace apps/citizen run typecheck && npm --workspace apps/officer run typecheck && npm --workspace apps/dopams-api run typecheck && npm --workspace apps/forensic-api run typecheck && npm --workspace apps/social-media-api run typecheck",
  "check:repo-layout": "node scripts/check-repo-layout.mjs",
  "build:platform": "node scripts/run-workspace-script-if-present.mjs build apps/platform-api apps/platform-web",
  "typecheck:platform": "node scripts/run-workspace-script-if-present.mjs typecheck apps/platform-api apps/platform-web",
  "build:domains": "node scripts/run-workspace-script-if-present.mjs build domains/*/* domains/*/packages/*",
  "typecheck:domains": "node scripts/run-workspace-script-if-present.mjs typecheck domains/*/* domains/*/packages/*",
};

for (const [scriptName, command] of Object.entries(expectedScripts)) {
  if (rootPackage.scripts?.[scriptName] === command) ok(`script ${scriptName}`);
  else red(`script ${scriptName} changed or missing`);
}

for (const currentPath of [
  "apps/api",
  "apps/citizen",
  "apps/officer",
  "apps/dopams-api",
  "apps/dopams-ui",
  "apps/forensic-api",
  "apps/forensic-ui",
  "apps/social-media-api",
  "apps/social-media-ui",
]) {
  if (existsSync(path.join(ROOT, currentPath, "package.json"))) ok(`current app package ${currentPath}`);
  else red(`missing current app package ${currentPath}`);
}

for (const targetPath of [
  "apps/platform-api",
  "apps/platform-web",
  "domains/dopams/api",
  "domains/dopams/web",
  "domains/iqw/api",
  "domains/forensic/api",
  "domains/forensic/web",
  "domains/social-media/api",
  "domains/social-media/web",
  "domains/knowledge/api",
  "domains/knowledge/web",
  "domains/knowledge/worker",
  "packages/authz",
  "packages/audit-ledger",
  "packages/case-core",
  "packages/evidence-core",
  "deploy/source/policing-apps/docker-compose.yml",
]) {
  if (layoutText.includes(targetPath)) ok(`layout documents ${targetPath}`);
  else red(`layout missing ${targetPath}`);
}

for (const importTarget of [
  "domains/dopams/api",
  "domains/dopams/web",
  "domains/iqw/api",
  "domains/forensic/api",
  "domains/forensic/web",
  "domains/social-media/api",
  "domains/social-media/web",
  "domains/knowledge/api",
  "domains/knowledge/web",
  "domains/knowledge/worker",
  "deploy/source/policing-apps/docker-compose.yml",
]) {
  if (importMapText.includes(`target_path: "${importTarget}"`)) ok(`import map target ${importTarget}`);
  else red(`import map missing target ${importTarget}`);
}

for (const sectionWord of ["apps", "domains", "packages", "deploy", "ownership", "python", "typescript"]) {
  if (layoutText.toLowerCase().includes(sectionWord)) ok(`layout covers ${sectionWord}`);
  else red(`layout missing ${sectionWord}`);
}

if (failed) {
  process.exit(1);
}
