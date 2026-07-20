import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  runDecisionRecordsCli,
  validateDecisionRecords as validateBundledDecisionRecords
} from "../../../skills/decision-records/scripts/decision-records.mjs";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedRelativePath,
  currentRelativePath,
  fixtureRoot,
  generatedCliPath,
  runSuccessfulCli,
  traceDecision
} from "./support.ts";

const validation = await validateDecisionRecords({ workspaceRoot: fixtureRoot });
assert.deepEqual(validation.errors, []);
assert.equal(validation.areaCount, 1);
assert.equal(validation.decisionCount, 2);
assert.equal(validation.activeCount, 1);
assert.equal(validation.archivedCount, 1);
assert.deepEqual(
  await validateBundledDecisionRecords({ workspaceRoot: fixtureRoot }),
  validation
);
assert.equal(typeof runDecisionRecordsCli, "function");

// Keep one real Node success smoke; detailed behavior uses the same bundled export.
const cliOutput = execFileSync(
  "node",
  [generatedCliPath, "check", "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(
  cliOutput,
  /Decision records check passed \(1 areas, 2 decisions, 1 active, 1 archived\)\./
);

const defaultCliOutput = await runSuccessfulCli(["--root", fixtureRoot]);
assert.match(defaultCliOutput, /Decision records check passed/);

const activeList = await runSuccessfulCli(["list", "--root", fixtureRoot]);
assert.match(activeList, /active 2026-07-11 tooling\/use-generated-cli\.md/);
assert.match(activeList, /title: 使用生成 CLI/);
assert.match(activeList, /purpose: 确保生成后的 CLI/);
assert.match(activeList, /background: 需要验证生成后的 CLI/);
assert.match(activeList, /decision: 使用固定结构的测试夹具/);
assert.doesNotMatch(activeList, /260710-use-source-cli/);
assert.doesNotMatch(activeList, /relations/);

const archivedList = await runSuccessfulCli([
  "list",
  "--status",
  "archived",
  "--root",
  fixtureRoot
]);
assert.match(
  archivedList,
  /archived 2026-07-10 tooling\/260710-use-source-cli\.md/
);
assert.doesNotMatch(archivedList, /tooling\/use-generated-cli\.md/);

const completeList = await runSuccessfulCli([
  "list",
  "--status",
  "all",
  "--full-time",
  "--root",
  fixtureRoot
]);
assert.match(completeList, /2026-07-10T09:10:11\+08:00/);
assert.match(completeList, /2026-07-11T14:15:16\+08:00/);

const topicList = await runSuccessfulCli([
  "list",
  "--topic",
  "tooling",
  "--status",
  "all",
  "--root",
  fixtureRoot
]);
assert.match(topicList, /tooling\/260710-use-source-cli\.md/);
assert.match(topicList, /tooling\/use-generated-cli\.md/);

const emptyTopicList = await runSuccessfulCli([
  "list",
  "--topic",
  "unrelated-topic",
  "--root",
  fixtureRoot
]);
assert.equal(
  emptyTopicList,
  "No decisions matched status active and topic unrelated-topic.\n"
);

const shownDecision = await runSuccessfulCli([
  "show",
  currentRelativePath,
  "--root",
  fixtureRoot
]);
assert.match(shownDecision, /^path: tooling\/use-generated-cli\.md/m);
assert.match(shownDecision, /^status: active$/m);
assert.match(
  shownDecision,
  /^createdAt: 2026-07-11T14:15:16\+08:00$/m
);
assert.match(shownDecision, /^# 使用生成 CLI$/m);
assert.doesNotMatch(shownDecision, /^title:/m);

const relationTrace = await traceDecision(archivedRelativePath);
assert.match(
  relationTrace,
  /tooling\/use-generated-cli\.md --修订--> tooling\/260710-use-source-cli\.md/
);

const predecessorTrace = await traceDecision(
  currentRelativePath,
  ["--direction", "predecessors"]
);
assert.match(predecessorTrace, /tooling\/260710-use-source-cli\.md/);

const noPredecessorTrace = await traceDecision(
  archivedRelativePath,
  ["--direction", "predecessors"]
);
assert.doesNotMatch(noPredecessorTrace, /use-generated-cli/);

const successorTrace = await traceDecision(
  archivedRelativePath,
  ["--direction", "successors"]
);
assert.match(successorTrace, /tooling\/use-generated-cli\.md/);

// Keep real Node failures to prove removed aliases and invalid-argument exit codes.
for (const invalidArguments of [
  ["list", "--archived", "--root", fixtureRoot],
  [
    "archive",
    currentRelativePath,
    "--by",
    archivedRelativePath,
    "--root",
    fixtureRoot
  ]
]) {
  const result = spawnSync("node", [generatedCliPath, ...invalidArguments], {
    encoding: "utf8"
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);
}

const invalidDepth = spawnSync(
  "node",
  [
    generatedCliPath,
    "trace",
    archivedRelativePath,
    "--depth",
    "-1",
    "--root",
    fixtureRoot
  ],
  { encoding: "utf8" }
);
assert.equal(invalidDepth.status, 2);
assert.match(invalidDepth.stderr, /must be a non-negative integer/);

const invalidTopic = spawnSync(
  "node",
  [
    generatedCliPath,
    "list",
    "--topic",
    "Invalid_Topic",
    "--root",
    fixtureRoot
  ],
  { encoding: "utf8" }
);
assert.equal(invalidTopic.status, 2);
assert.match(invalidTopic.stderr, /must be a kebab-case topic id/);
