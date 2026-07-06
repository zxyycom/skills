import fs from "node:fs/promises";
import {
  buildSkillPackageLock,
  calculateSkillPackageHashes,
  readRecordedSkillPackageLock,
  readRecordedSkillPackageLockText,
  skillPackageLockFileName,
  stringifySkillPackageLock,
  writeRecordedSkillPackageLock
} from "./lib/skill-package-hash.ts";
import {
  discoverSkillPackages,
  rootDir
} from "./lib/project.ts";

const allowedArgs = new Set(["--check", "--github-output", "--quiet", "--write"]);
const args = new Set(process.argv.slice(2));

for (const arg of args) {
  if (!allowedArgs.has(arg)) {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

const discovery = await discoverSkillPackages(rootDir);
if (discovery.errors.length > 0) {
  throw new Error(`Cannot hash skills:\n- ${discovery.errors.join("\n- ")}`);
}

const currentHashes = await calculateSkillPackageHashes(discovery.skills);
const currentHash = currentHashes.aggregateHash;
const currentLock = buildSkillPackageLock(currentHashes);
const currentLockText = stringifySkillPackageLock(currentLock);
const recordedLock = await readRecordedSkillPackageLock(rootDir);
const recordedLockText = await readRecordedSkillPackageLockText(rootDir);
const changed = recordedLock?.aggregateHash !== currentHash;
const lockChanged = recordedLockText !== currentLockText;
const quiet = args.has("--quiet");
const shouldPrintSummary = !quiet || changed || lockChanged;

if (shouldPrintSummary) {
  console.log(`Current skill package hash: ${currentHash}`);
  console.log(`Recorded skill package hash: ${recordedLock?.aggregateHash ?? "(none)"}`);
  console.log(`Skill package hash changed: ${changed ? "yes" : "no"}`);
  console.log(`Skill package lock changed: ${lockChanged ? "yes" : "no"}`);
}

if (args.has("--write")) {
  if (lockChanged) {
    await writeRecordedSkillPackageLock(currentLock, rootDir);
    console.log(`Wrote ${skillPackageLockFileName}.`);
  }
}

if (args.has("--github-output")) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throw new Error("--github-output requires GITHUB_OUTPUT to be set");
  }

  await fs.appendFile(
    outputPath,
    [
      `current_hash=${currentHash}`,
      `recorded_hash=${recordedLock?.aggregateHash ?? ""}`,
      `changed=${changed ? "true" : "false"}`
    ].join("\n") + "\n",
    "utf8"
  );
}

if (args.has("--check") && (changed || lockChanged)) {
  if (lockChanged) {
    console.error(`${skillPackageLockFileName} does not match the current skill package hashes.`);
  }

  process.exitCode = 1;
}
