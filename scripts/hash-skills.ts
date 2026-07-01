import fs from "node:fs/promises";
import {
  calculateSkillPackageHash,
  readRecordedSkillPackageHash,
  skillPackageHashFileName,
  writeRecordedSkillPackageHash
} from "./lib/skill-package-hash.ts";
import {
  discoverSkillPackages,
  rootDir
} from "./lib/project.ts";

const allowedArgs = new Set(["--check", "--github-output", "--write"]);
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

function readRecordedHashOverride(): string | null {
  const hash = process.env.RECORDED_SKILL_HASH?.trim();
  return hash && hash.length > 0 ? hash : null;
}

const currentHash = await calculateSkillPackageHash(discovery.skills);
const recordedHash = readRecordedHashOverride() ?? await readRecordedSkillPackageHash(rootDir);
const changed = recordedHash !== currentHash;

console.log(`Current skill package hash: ${currentHash}`);
console.log(`Recorded skill package hash: ${recordedHash ?? "(none)"}`);
console.log(`Skill package hash changed: ${changed ? "yes" : "no"}`);

if (args.has("--write")) {
  await writeRecordedSkillPackageHash(currentHash, rootDir);
  console.log(`Wrote ${skillPackageHashFileName}.`);
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
      `recorded_hash=${recordedHash ?? ""}`,
      `changed=${changed ? "true" : "false"}`
    ].join("\n") + "\n",
    "utf8"
  );
}

if (args.has("--check") && changed) {
  console.error(`${skillPackageHashFileName} does not match the current skill package hash.`);
  process.exitCode = 1;
}
