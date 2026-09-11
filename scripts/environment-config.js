import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { errorMessage, repoRoot } from "./environment-command.js";

const manifestPath = path.join(repoRoot, "package.json");
const lockfilePath = path.join(repoRoot, "pnpm-lock.yaml");

export function parseAction(argv) {
  if (argv.length === 0) return "check";
  if (argv.length === 1 && (argv[0] === "check" || argv[0] === "setup")) {
    return argv[0];
  }
  throw new Error("usage: node scripts/environment.js <check|setup>");
}

export function readEnvironmentConfig() {
  if (!existsSync(manifestPath)) {
    throw new Error(`package.json is missing at ${manifestPath}`);
  }
  if (!existsSync(lockfilePath)) {
    throw new Error(`pnpm-lock.yaml is missing at ${lockfilePath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`package.json is not valid JSON: ${errorMessage(error)}`);
  }
  const packageManagerMatch = /^pnpm@(\d+\.\d+\.\d+)$/u.exec(
    typeof manifest.packageManager === "string" ? manifest.packageManager : ""
  );
  if (!packageManagerMatch) {
    throw new Error(
      "package.json packageManager must pin pnpm as pnpm@<major>.<minor>.<patch>"
    );
  }
  const bunRange =
    typeof manifest.engines?.bun === "string" ? manifest.engines.bun : "";
  const bunMinimumMatch = /^>=(\d+\.\d+(?:\.\d+)?)$/u.exec(bunRange);
  if (!bunMinimumMatch) {
    throw new Error("package.json engines.bun must use a simple >= version");
  }
  const nodeRange =
    typeof manifest.engines?.node === "string" ? manifest.engines.node : "";
  const nodeMinimumMatch = /^>=(\d+\.\d+(?:\.\d+)?)$/u.exec(nodeRange);
  if (!nodeMinimumMatch) {
    throw new Error("package.json engines.node must use a simple >= version");
  }
  return {
    bunMinimum: parseVersion(bunMinimumMatch[1]),
    dependencyNames: dependencyNamesFrom(manifest),
    manifest,
    nodeMinimum: parseVersion(nodeMinimumMatch[1]),
    pnpmVersion: parseVersion(packageManagerMatch[1])
  };
}

export function dependencyNamesFrom(record) {
  const names = new Set();
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies"
  ]) {
    const dependencies = record?.[field];
    if (!dependencies || typeof dependencies !== "object") continue;
    for (const name of Object.keys(dependencies)) names.add(name);
  }
  return [...names].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  );
}

export function parseVersion(value) {
  const match = /(?<!\d)(\d+)\.(\d+)(?:\.(\d+))?/u.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
    text: `${match[1]}.${match[2]}.${match[3] ?? 0}`
  };
}

export function compareVersions(left, right) {
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) {
      return left[field] < right[field] ? -1 : 1;
    }
  }
  return 0;
}
