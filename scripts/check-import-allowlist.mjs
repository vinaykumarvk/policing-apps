#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAP_PATH = path.join(ROOT, "docs/spec/import-map.yaml");
const PRINT_CURRENT = process.argv.includes("--print-current");

function fail(message) {
  console.error(`RED ${message}`);
  process.exitCode = 1;
}

function loadYaml(filePath) {
  const ruby = spawnSync(
    "ruby",
    ["-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.load_file(ARGV[0]))", filePath],
    { encoding: "utf8" },
  );
  if (ruby.status !== 0) {
    throw new Error(`Ruby YAML parser failed: ${ruby.stderr.trim() || ruby.stdout.trim()}`);
  }
  return JSON.parse(ruby.stdout);
}

function normalizeSlash(value) {
  return value.split(path.sep).join("/");
}

function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesPattern(relativePath, pattern) {
  const rel = normalizeSlash(relativePath);
  const pat = normalizeSlash(pattern);
  if (pat.startsWith("**/") && pat.includes("*", 3)) {
    const rest = pat.slice(3);
    return matchesPattern(rel, rest) || patternToRegex(pat).test(rel);
  }
  if (pat.startsWith("**/") && pat.endsWith("/**")) {
    const segment = pat.slice(3, -3);
    return rel === segment || rel.startsWith(`${segment}/`) || rel.includes(`/${segment}/`);
  }
  if (pat.endsWith("/**")) {
    const prefix = pat.slice(0, -3);
    return rel === prefix || rel.startsWith(`${prefix}/`);
  }
  if (pat.startsWith("**/") && !pat.includes("*", 3)) {
    const suffix = pat.slice(3);
    return rel === suffix || rel.endsWith(`/${suffix}`);
  }
  return patternToRegex(pat).test(rel);
}

function isExcluded(relativePath, patterns) {
  return patterns.some((pattern) => matchesPattern(relativePath, pattern));
}

function walk(basePath, patterns, current = "") {
  const absoluteCurrent = path.join(basePath, current);
  const relativeForMatch = current || ".";
  if (current && isExcluded(relativeForMatch, patterns)) return [];

  const info = lstatSync(absoluteCurrent);
  if (info.isSymbolicLink()) {
    return [{
      relativePath: normalizeSlash(current),
      type: "symlink",
      bytes: 0,
      contentHash: createHash("sha256").update(readlinkSync(absoluteCurrent)).digest("hex"),
    }];
  }
  if (info.isFile()) {
    const bytes = readFileSync(absoluteCurrent);
    return [{
      relativePath: normalizeSlash(current || path.basename(basePath)),
      type: "file",
      bytes: info.size,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    }];
  }
  if (!info.isDirectory()) return [];

  return readdirSync(absoluteCurrent, { withFileTypes: true })
    .flatMap((entry) => walk(basePath, patterns, path.join(current, entry.name)));
}

function checksumPath(sourcePath, patterns) {
  const info = statSync(sourcePath);
  const basePath = info.isDirectory() ? sourcePath : path.dirname(sourcePath);
  const start = info.isDirectory() ? "" : path.basename(sourcePath);
  const records = walk(basePath, patterns, start).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const digest = createHash("sha256");
  let byteCount = 0;
  for (const record of records) {
    byteCount += record.bytes;
    digest.update(`${record.type}\0${record.relativePath}\0${record.contentHash}\0${record.bytes}\n`);
  }
  return {
    checksum: `sha256:${digest.digest("hex")}`,
    file_count: records.length,
    byte_count: byteCount,
  };
}

function requireString(entry, key) {
  if (typeof entry[key] !== "string" || entry[key].trim() === "") {
    fail(`${entry.id || "allowlist entry"} missing ${key}`);
  }
}

const importMap = loadYaml(MAP_PATH);
const roots = new Map((importMap.source_roots || []).map((root) => [root.id, root]));
const globalExcludes = importMap.checksum?.exclude_path_patterns || [];
const allowlist = importMap.allowlist || [];

if (!Array.isArray(allowlist) || allowlist.length === 0) {
  fail("import map allowlist is empty");
}

const current = [];
for (const entry of allowlist) {
  for (const key of ["id", "source_repo", "source_path", "target_path", "owner", "import_status", "checksum", "risk_notes"]) {
    requireString(entry, key);
  }
  const root = roots.get(entry.source_repo);
  if (!root) {
    fail(`${entry.id} references unknown source repo ${entry.source_repo}`);
    continue;
  }
  const sourceRoot = path.resolve(ROOT, root.path);
  const sourcePath = path.resolve(sourceRoot, entry.source_path);
  if (!sourcePath.startsWith(sourceRoot)) {
    fail(`${entry.id} source path escapes source root`);
    continue;
  }
  try {
    statSync(sourcePath);
  } catch {
    fail(`${entry.id} source path does not exist: ${entry.source_repo}/${entry.source_path}`);
    continue;
  }
  const excludes = [...globalExcludes, ...(entry.exclude_path_patterns || [])];
  const actual = checksumPath(sourcePath, excludes);
  current.push({ id: entry.id, ...actual });
  if (!PRINT_CURRENT && entry.checksum !== actual.checksum) {
    fail(`${entry.id} checksum mismatch: expected ${entry.checksum}, actual ${actual.checksum}`);
  }
  if (!PRINT_CURRENT && entry.file_count !== actual.file_count) {
    fail(`${entry.id} file_count mismatch: expected ${entry.file_count}, actual ${actual.file_count}`);
  }
  if (!PRINT_CURRENT && entry.byte_count !== actual.byte_count) {
    fail(`${entry.id} byte_count mismatch: expected ${entry.byte_count}, actual ${actual.byte_count}`);
  }
  if (!PRINT_CURRENT && entry.import_status === "imported") {
    fail(`${entry.id} is marked imported during P0`);
  }
}

if (PRINT_CURRENT) {
  console.log(JSON.stringify(current, null, 2));
} else if (!process.exitCode) {
  console.log(`ok import allowlist: ${allowlist.length} entries verified`);
}
