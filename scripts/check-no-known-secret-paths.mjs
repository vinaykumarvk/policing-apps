#!/usr/bin/env node
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAP_PATH = path.join(ROOT, "docs/spec/import-map.yaml");
const SCAN_SOURCE_ROOTS = process.argv.includes("--scan-source-roots");
const REPORT_ONLY = process.argv.includes("--report-only");
const JSON_OUTPUT = process.argv.includes("--json");
const SUMMARY_ONLY = process.argv.includes("--summary-only");

const SECRET_PATH_PATTERNS = [
  "**/.env",
  "**/.env.*",
  "**/credentials/**",
  "**/secrets/**",
  "**/*credential*.json",
  "**/*credential*.xlsx",
  "**/*credential*.csv",
  "**/*secret*.env",
  "**/*secret*.json",
  "**/*secret*.yaml",
  "**/*secret*.yml",
  "**/*service-account*.json",
  "**/*service_account*.json",
  "**/*-sa.json",
  "**/*.pem",
  "**/*.p12",
  "**/*.pfx",
  "**/*.key",
  "**/id_rsa",
  "**/id_ed25519",
];

const SENSITIVE_LOCAL_DATA_PATTERNS = [
  "**/.object-storage/**",
  "**/uploads/**",
  "**/outputs/**",
  "**/tmp/**",
  "**/evidence-local/**",
  "**/test-results/**",
  "**/playwright-report/**",
  "**/complaints/**",
];

const GENERATED_PATTERNS = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.vite/**",
  "**/.pytest_cache/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/coverage/**",
];

const HIGH_CONFIDENCE_CONTENT_RULES = [
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "google-api-key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { id: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { id: "slack-token", pattern: /xox[baprs]-[0-9A-Za-z-]{20,}/ },
  { id: "openai-secret-key", pattern: /sk-[A-Za-z0-9]{32,}/ },
  { id: "jwt-token", pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
];

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

function isMatched(relativePath, patterns) {
  return patterns.some((pattern) => matchesPattern(relativePath, pattern));
}

function walk(basePath, scanRoot, excludes, prunePatterns = [], current = "") {
  const absoluteCurrent = path.join(scanRoot, current);
  const relFromBase = normalizeSlash(path.relative(basePath, absoluteCurrent));
  const relForExclude = normalizeSlash(current || ".");
  if (current && isMatched(relForExclude, excludes)) return [];

  const info = lstatSync(absoluteCurrent);
  if (current && isMatched(relFromBase, prunePatterns)) {
    return [{ absolutePath: absoluteCurrent, relativePath: relFromBase, size: info.size, isFile: info.isFile(), pruned: true }];
  }
  if (info.isSymbolicLink() || info.isFile()) {
    return [{ absolutePath: absoluteCurrent, relativePath: relFromBase, size: info.size, isFile: info.isFile() }];
  }
  if (!info.isDirectory()) return [];

  return readdirSync(absoluteCurrent, { withFileTypes: true })
    .flatMap((entry) => walk(basePath, scanRoot, excludes, prunePatterns, path.join(current, entry.name)));
}

function isProbablyText(filePath, size) {
  if (size > 2_000_000) return false;
  const buffer = readFileSync(filePath);
  return !buffer.includes(0);
}

function scanContent(files) {
  const findings = [];
  for (const file of files) {
    if (!file.isFile || !isProbablyText(file.absolutePath, file.size)) continue;
    const content = readFileSync(file.absolutePath, "utf8");
    for (const rule of HIGH_CONFIDENCE_CONTENT_RULES) {
      if (rule.pattern.test(content)) {
        findings.push({ path: file.relativePath, rule: rule.id });
      }
    }
  }
  return findings;
}

const importMap = loadYaml(MAP_PATH);
const roots = new Map((importMap.source_roots || []).map((root) => [root.id, root]));
const globalExcludes = importMap.checksum?.exclude_path_patterns || [];
const sourceRootEntries = SCAN_SOURCE_ROOTS
  ? importMap.source_roots.map((root) => ({
      id: root.id,
      root,
      source_path: ".",
      exclude_path_patterns: GENERATED_PATTERNS,
      prune_path_patterns: [...SECRET_PATH_PATTERNS, ...SENSITIVE_LOCAL_DATA_PATTERNS],
    }))
  : importMap.allowlist;

const pathFindings = [];
const includedFiles = [];

for (const entry of sourceRootEntries) {
  const root = roots.get(entry.source_repo || entry.id) || entry.root;
  if (!root) continue;
  const sourceRoot = path.resolve(ROOT, root.path);
  const sourcePath = path.resolve(sourceRoot, entry.source_path);
  try {
    statSync(sourcePath);
  } catch {
    pathFindings.push({ source: entry.id, path: `${root.path}/${entry.source_path}`, reason: "missing-source-path" });
    continue;
  }
  const excludes = SCAN_SOURCE_ROOTS
    ? [...(entry.exclude_path_patterns || [])]
    : [...globalExcludes, ...(entry.exclude_path_patterns || [])];
  const files = walk(sourceRoot, sourcePath, excludes, entry.prune_path_patterns || []);
  for (const file of files) {
    const rel = file.relativePath;
    if (file.pruned && isMatched(rel, SECRET_PATH_PATTERNS)) {
      pathFindings.push({ source: entry.id, path: rel, reason: "known-secret-path" });
    } else if (file.pruned && isMatched(rel, SENSITIVE_LOCAL_DATA_PATTERNS)) {
      pathFindings.push({ source: entry.id, path: rel, reason: "sensitive-local-data-path" });
    } else if (isMatched(rel, SECRET_PATH_PATTERNS)) {
      pathFindings.push({ source: entry.id, path: rel, reason: "known-secret-path" });
    } else if (isMatched(rel, SENSITIVE_LOCAL_DATA_PATTERNS)) {
      pathFindings.push({ source: entry.id, path: rel, reason: "sensitive-local-data-path" });
    } else {
      includedFiles.push(file);
    }
  }
}

const contentFindings = SCAN_SOURCE_ROOTS ? [] : scanContent(includedFiles);
const summary = {
  mode: SCAN_SOURCE_ROOTS ? "source-root-report" : "allowlist-enforcement",
  scanned_files: includedFiles.length,
  known_secret_or_sensitive_paths: pathFindings.length,
  high_confidence_content_findings: contentFindings.length,
  path_finding_counts: pathFindings.reduce((acc, finding) => {
    acc[finding.reason] = (acc[finding.reason] || 0) + 1;
    return acc;
  }, {}),
  path_findings: pathFindings,
  content_findings: contentFindings,
};

if (JSON_OUTPUT) {
  const output = SUMMARY_ONLY ? {
    mode: summary.mode,
    scanned_files: summary.scanned_files,
    known_secret_or_sensitive_paths: summary.known_secret_or_sensitive_paths,
    high_confidence_content_findings: summary.high_confidence_content_findings,
    path_finding_counts: summary.path_finding_counts,
  } : summary;
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`${summary.mode}: scanned ${summary.scanned_files} files`);
  console.log(`known secret/sensitive paths: ${summary.known_secret_or_sensitive_paths}`);
  console.log(`high-confidence content findings: ${summary.high_confidence_content_findings}`);
  for (const finding of [...pathFindings, ...contentFindings]) {
    console.log(`${finding.reason || finding.rule}: ${finding.source ? `${finding.source}:` : ""}${finding.path}`);
  }
}

if (!REPORT_ONLY && (pathFindings.length > 0 || contentFindings.length > 0)) {
  process.exitCode = 1;
}
