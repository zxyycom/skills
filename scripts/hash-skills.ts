import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  calculateSkillPackageSnapshotHash,
  getSkillPackageVersionIssues,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline
} from "./lib/skill-package-hash.ts";
import { rootDir } from "./lib/project.ts";

const { values: options } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "baseline-ref": { type: "string" },
    "github-output": { type: "boolean" },
    quiet: { type: "boolean" }
  },
  strict: true
});
const baselineRef = options["baseline-ref"] ?? "HEAD";

const snapshot = await readPendingSkillPackageSnapshot(rootDir);
const currentPackage = calculateSkillPackageSnapshotHash(snapshot);
const currentHash = currentPackage.aggregateHash;
const baseline = await readSkillPackageSnapshotVersionBaseline(
  snapshot,
  baselineRef,
  rootDir
);
const versionIssues = getSkillPackageVersionIssues(currentPackage, baseline);
if (versionIssues.length > 0) {
  throw new Error(
    `Skill package versions are invalid against ${baselineRef}:\n- ` +
      versionIssues.join("\n- ")
  );
}

if (!options.quiet) {
  console.log(`Current skill package hash: ${currentHash}`);
  console.log(`Skill version baseline: ${baselineRef} (${baseline.revision})`);
  console.log(
    `Changed skill versions checked: ${Object.keys(baseline.skills).length}`
  );
}

if (options["github-output"]) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throw new Error("--github-output requires GITHUB_OUTPUT to be set");
  }

  await fs.appendFile(
    outputPath,
    [`current_hash=${currentHash}`].join("\n") + "\n",
    "utf8"
  );
}
