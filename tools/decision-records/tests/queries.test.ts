import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  runDecisionRecordsCli,
  validateDecisionRecords as validateBundledDecisionRecords
} from "../../../skills/decision-records/scripts/decision-records.mjs";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedRelativePath,
  createFixtureWorkspace,
  currentRelativePath,
  generatedCliPath,
  runBundledCli,
  runSourceCli,
  runSuccessfulCli,
  traceDecision
} from "./support.ts";

test("decision check preserves source, bundled API, and process CLI parity", async () => {
const fixtureRoot = await createFixtureWorkspace("query-check");
try {
  const validation = await validateDecisionRecords({ workspaceRoot: fixtureRoot });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.domainCount, 3);
  assert.equal(validation.decisionCount, 2);
  assert.equal(validation.activeCount, 1);
  assert.equal(validation.alignedCount, 1);
  assert.equal(validation.unalignedCount, 0);
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
    /Decision records check passed \(3 domains, 2 decisions, 1 active, 1 aligned, 0 unaligned, 1 archived\)\./
  );

  const defaultCliOutput = await runSuccessfulCli(["--root", fixtureRoot]);
  assert.match(defaultCliOutput, /Decision records check passed/);
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});

test("decision list filters lifecycle, domain, and alignment selectors", async () => {
const fixtureRoot = await createFixtureWorkspace("query-list");
try {
  const activeList = await runSuccessfulCli(["list", "--root", fixtureRoot]);
  assert.match(activeList, /^Domains:$/m);
  assert.match(activeList, /project-tooling: 维护仓库校验、生成、打包、发布和更新工具链。/);
  assert.match(
    activeList,
    /active aligned 2026-07-11 project-tooling\/use-generated-cli\.md/
  );
  assert.doesNotMatch(activeList, /^\s+domain:/m);
  assert.match(activeList, /title: 使用生成 CLI/);
  assert.match(activeList, /purpose: 确保生成后的 CLI/);
  assert.doesNotMatch(activeList, /^\s+background:/m);
  assert.doesNotMatch(activeList, /^\s+decision:/m);
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
    /archived null 2026-07-10 decision-records\/260710-use-source-cli\.md/
  );
  assert.doesNotMatch(archivedList, /project-tooling\/use-generated-cli\.md/);

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

  const decisionDomainList = await runSuccessfulCli([
    "list",
    "--domain",
    "decision-records",
    "--status",
    "all",
    "--root",
    fixtureRoot
  ]);
  assert.match(
    decisionDomainList,
    /decision-records\/260710-use-source-cli\.md/
  );
  assert.doesNotMatch(
    decisionDomainList,
    /project-tooling\/use-generated-cli\.md/
  );

  for (const repeatedDomain of ["decision-records", "project-tooling"]) {
    const repeatedDomainList = spawnSync(
      "node",
      [
        generatedCliPath,
        "list",
        "--domain",
        "decision-records",
        "--domain",
        repeatedDomain,
        "--status",
        "all",
        "--root",
        fixtureRoot
      ],
      { encoding: "utf8" }
    );
    assert.equal(repeatedDomainList.status, 2);
    assert.match(repeatedDomainList.stderr, /must not be repeated/);
  }

  const emptyDomainList = await runSuccessfulCli([
    "list",
    "--domain",
    "change-plan",
    "--root",
    fixtureRoot
  ]);
  assert.equal(
    emptyDomainList,
    "Domains:\n"
      + "- change-plan: 维护明确变更的提案、设计、任务分解与结构检查。\n"
      + "Decisions:\n"
      + "- none\n"
  );

  const unknownDomain = await runBundledCli([
    "list",
    "--domain",
    "unrelated-domain",
    "--root",
    fixtureRoot
  ]);
  assert.equal(unknownDomain.exitCode, 2);
  assert.match(unknownDomain.stderr, /Unknown decision domain/);

  const unalignedList = await runSuccessfulCli([
    "list",
    "--alignment",
    "unaligned",
    "--root",
    fixtureRoot
  ]);
  assert.equal(
    unalignedList,
    "Domains:\n- none\nDecisions:\n- none\n"
  );
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});

test("decision show returns metadata and reports body read failures", async () => {
const fixtureRoot = await createFixtureWorkspace("query-show");
try {
  const shownDecision = await runSuccessfulCli([
    "show",
    currentRelativePath,
    "--root",
    fixtureRoot
  ]);
  assert.match(
    shownDecision,
    /^path: project-tooling\/use-generated-cli\.md/m
  );
  assert.match(shownDecision, /^domain: project-tooling$/m);
  assert.match(
    shownDecision,
    /^domainDescription: 维护仓库校验、生成、打包、发布和更新工具链。$/m
  );
  assert.match(shownDecision, /^status: active$/m);
  assert.match(shownDecision, /^alignment: aligned$/m);
  assert.doesNotMatch(shownDecision, /^pending:/m);
  assert.match(
    shownDecision,
    /^createdAt: 2026-07-11T14:15:16\+08:00$/m
  );
  assert.match(shownDecision, /^title: 使用生成 CLI$/m);
  assert.doesNotMatch(shownDecision, /^# /m);

  const shownDecisionPath = path.join(
    fixtureRoot,
    "docs",
    "decisions",
    ...currentRelativePath.split("/")
  );
  const originalReadFileDescriptor = Object.getOwnPropertyDescriptor(
    fs,
    "readFile"
  );
  assert.ok(originalReadFileDescriptor);
  const originalReadFile = fs.readFile.bind(fs);
  let shownDecisionReadCount = 0;
  Object.defineProperty(fs, "readFile", {
    ...originalReadFileDescriptor,
    value: async (
      filePath: string,
      encoding: BufferEncoding
    ): Promise<string> => {
      if (path.resolve(filePath) === shownDecisionPath) {
        shownDecisionReadCount += 1;
        throw new Error("simulated decision body read failure");
      }
      return await originalReadFile(filePath, encoding);
    }
  });
  try {
    const failedShow = await runSourceCli([
      "show",
      currentRelativePath,
      "--root",
      fixtureRoot
    ]);
    assert.equal(failedShow.exitCode, 1);
    assert.equal(failedShow.stdout, "");
    assert.match(
      failedShow.stderr,
      /Failed to read decision body project-tooling\/use-generated-cli\.md: simulated decision body read failure/
    );
    assert.equal(shownDecisionReadCount, 1);
  } finally {
    Object.defineProperty(fs, "readFile", originalReadFileDescriptor);
  }
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});

test("decision trace follows predecessor and successor directions", async () => {
const fixtureRoot = await createFixtureWorkspace("query-trace");
try {
  const relationTrace = await traceDecision(archivedRelativePath, [], fixtureRoot);
  assert.match(
    relationTrace,
    /project-tooling\/use-generated-cli\.md --修订--> decision-records\/260710-use-source-cli\.md/
  );
  assert.match(relationTrace, /^Domains:$/m);
  assert.match(relationTrace, /decision-records: 维护长期决策/);
  assert.match(relationTrace, /project-tooling: 维护仓库校验/);

  const predecessorTrace = await traceDecision(
    currentRelativePath,
    ["--direction", "predecessors"],
    fixtureRoot
  );
  assert.match(
    predecessorTrace,
    /decision-records\/260710-use-source-cli\.md/
  );

  const noPredecessorTrace = await traceDecision(
    archivedRelativePath,
    ["--direction", "predecessors"],
    fixtureRoot
  );
  assert.doesNotMatch(noPredecessorTrace, /use-generated-cli/);

  const successorTrace = await traceDecision(
    archivedRelativePath,
    ["--direction", "successors"],
    fixtureRoot
  );
  assert.match(
    successorTrace,
    /project-tooling\/use-generated-cli\.md/
  );
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});

test("decision queries use persisted snapshots while check detects source drift", async () => {
const fixtureRoot = await createFixtureWorkspace("query-index-snapshot");
try {
  const decisionPath = path.join(
    fixtureRoot,
    "docs",
    "decisions",
    ...currentRelativePath.split("/")
  );
  await fs.rm(decisionPath);

  const listed = await runSuccessfulCli(["list", "--root", fixtureRoot]);
  assert.match(listed, /project-tooling\/use-generated-cli\.md/);
  const traced = await traceDecision(currentRelativePath, [], fixtureRoot);
  assert.match(traced, /decision-records\/260710-use-source-cli\.md/);

  const shown = await runBundledCli([
    "show",
    currentRelativePath,
    "--root",
    fixtureRoot
  ]);
  assert.equal(shown.exitCode, 1);
  assert.match(shown.stderr, /Failed to read decision body/);

  const checked = await runBundledCli(["check", "--root", fixtureRoot]);
  assert.equal(checked.exitCode, 1);
  assert.match(checked.stderr, /out of sync|references missing decision/);
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});

test("decision CLI help and invalid options expose one consistent contract", async () => {
const fixtureRoot = await createFixtureWorkspace("query-cli-args");
try {
  const help = spawnSync("node", [generatedCliPath, "--help"], {
    encoding: "utf8"
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Query and maintain agent-oriented decision records/);
  assert.match(help.stdout, /This is the default command/);
  assert.match(help.stdout, /Check the JSON index against established\s+Markdown/);
  assert.match(help.stdout, /candidates remain outside the index and make strict check fail/i);

  const archiveHelp = spawnSync(
    "node",
    [generatedCliPath, "archive", "--help"],
    { encoding: "utf8" }
  );
  assert.equal(archiveHelp.status, 0);
  assert.match(archiveHelp.stdout, /preserving their last alignment/);

  const markAlignedHelp = spawnSync(
    "node",
    [generatedCliPath, "mark-aligned", "--help"],
    { encoding: "utf8" }
  );
  assert.equal(markAlignedHelp.status, 0);
  assert.match(
    markAlignedHelp.stdout,
    /only after its complete\s+direction\s+has become current fact\s+and been verified against the relevant\s+fact sources/
  );

  // Keep real Node failures to prove invalid-option exit codes.
  for (const invalidArguments of [
    ["list", "--unknown-option", "--root", fixtureRoot],
    [
      "archive",
      currentRelativePath,
      "--unknown-option",
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

  const invalidDomain = spawnSync(
    "node",
    [
      generatedCliPath,
      "list",
      "--domain",
      "Invalid_Domain",
      "--root",
      fixtureRoot
    ],
    { encoding: "utf8" }
  );
  assert.equal(invalidDomain.status, 2);
  assert.match(invalidDomain.stderr, /must be a kebab-case domain id/);

  const missingActivationAlignment = spawnSync(
    "node",
    [
      generatedCliPath,
      "activate",
      currentRelativePath,
      "--root",
      fixtureRoot
    ],
    { encoding: "utf8" }
  );
  assert.equal(missingActivationAlignment.status, 2);
  assert.match(missingActivationAlignment.stderr, /required option '--alignment <value>'/);
} finally {
  await fs.rm(fixtureRoot, { force: true, recursive: true });
}
});
