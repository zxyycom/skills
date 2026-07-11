import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDecisionRecords } from "../src/index.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "valid");
const generatedCliPath = path.join(
  rootDir,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.mjs"
);
const generatedUpdaterPath = path.join(
  rootDir,
  "skills",
  "decision-records",
  "scripts",
  "update-skill.cjs"
);

const validation = await validateDecisionRecords({ workspaceRoot: fixtureRoot });
assert.deepEqual(validation.errors, []);
assert.equal(validation.areaCount, 1);
assert.equal(validation.decisionCount, 1);
assert.equal(validation.activeCount, 1);

const cliOutput = execFileSync(
  "node",
  [generatedCliPath, "check", "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(cliOutput, /Decision records check passed \(1 areas, 1 decisions, 1 active, 0 archived\)\./);

const cliSource = await fs.readFile(generatedCliPath, "utf8");
assert.match(cliSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(cliSource, /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/decision-records\/src\/cli\.ts/);
assert.match(cliSource, /Source path: scripts\/decision-records\/src\/cli\.ts/);
assert.match(cliSource, /Skill source directory: https:\/\/github\.com\/zxyycom\/skills\/tree\/main\/skills\/decision-records/);
assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);

const updaterSource = await fs.readFile(generatedUpdaterPath, "utf8");
assert.match(updaterSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(updaterSource, /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/templates\/update-skill\.ts/);
assert.match(updaterSource, /Rebuild: bun run sync:skill-updaters/);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "decision-records-test-"));
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
  const copiedContractPath = path.join(
    tempRoot,
    "docs",
    "decisions",
    "decision-record-rules.md"
  );
  await fs.writeFile(copiedContractPath, "# Copied contract\n", "utf8");
  const withCopiedContract = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withCopiedContract.errors.some(
    (error) => error.includes("root contains unsupported file decision-record-rules.md")
  ));
  await fs.rm(copiedContractPath);

  const indexPath = path.join(tempRoot, "docs", "decisions", "decision-record-index.md");
  const index = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(indexPath, index.replace("[active:", "[stale:"), "utf8");

  const drifted = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(drifted.errors.some((error) => error.includes("active decision section is out of sync")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Decision records CLI tests passed.");
