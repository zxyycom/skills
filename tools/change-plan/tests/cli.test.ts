import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  completedTasks,
  generatedCliPath,
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

type CliFixture = {
  activeDirectory: string;
  archivedDirectory: string;
  invalidListedDirectory: string;
  invalidTasksDirectory: string;
  lifecycleRoot: string;
  linkedPlanDirectory: string;
  nonDirectoryChangeRoot: string;
  validDirectory: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function runCli(arguments_: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...arguments_], {
    encoding: "utf8"
  });
}

function runGit(directory: string, arguments_: readonly string[]): string {
  const result = spawnSync("git", ["-C", directory, ...arguments_], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function initializeGitRepository(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  runGit(directory, ["init"]);
  runGit(directory, ["config", "user.email", "change-plan@example.test"]);
  runGit(directory, ["config", "user.name", "Change Plan Test"]);
}

async function createCliFixture(tempRoot: string): Promise<CliFixture> {
  const validDirectory = await writePlan(tempRoot, "add-change-plan");
  const invalidTasksDirectory = await writePlan(tempRoot, "invalid-tasks", {
    tasks: `# Tasks

本 change 的任务结构无效。

## Readiness

- [ ] 0.1 完成准备。

## Implementation

- [ ] no-id 缺少合法编号。
- [ ] 0.1 重复任务编号。

## Verification

尚未形成验证任务。

## Notes

- [ ] 3.1 任务不能放在额外章节。
`
  });

  const lifecycleRoot = path.join(tempRoot, "changes");
  const activeDirectory = await writePlan(lifecycleRoot, "active-plan");
  const archivedDirectory = await writePlan(
    path.join(lifecycleRoot, "archive"),
    "old-plan",
    {
      tasks: completedTasks
    }
  );
  await fs.writeFile(
    path.join(archivedDirectory, "proposal.md"),
    "historical proposal without current headings\n",
    "utf8"
  );
  await fs.rm(path.join(archivedDirectory, "design.md"));
  await fs.rm(path.join(archivedDirectory, "tasks.md"));
  await fs.writeFile(
    path.join(archivedDirectory, ".change-plan.json"),
    "{",
    "utf8"
  );

  const invalidListedDirectory = path.join(lifecycleRoot, "invalid-plan");
  await fs.mkdir(invalidListedDirectory);
  await fs.writeFile(
    path.join(invalidListedDirectory, "proposal.md"),
    validProposal,
    "utf8"
  );

  const linkedPlanTargetDirectory = await writePlan(
    lifecycleRoot,
    "linked-plan-target",
    { tasks: completedTasks }
  );
  const linkedPlanDirectory = path.join(lifecycleRoot, "linked-plan");
  await fs.symlink(
    linkedPlanTargetDirectory,
    linkedPlanDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );

  const nonDirectoryChangeRoot = path.join(tempRoot, "changes-file");
  await fs.writeFile(nonDirectoryChangeRoot, "not a directory", "utf8");

  return {
    activeDirectory,
    archivedDirectory,
    invalidListedDirectory,
    invalidTasksDirectory,
    lifecycleRoot,
    linkedPlanDirectory,
    nonDirectoryChangeRoot,
    validDirectory
  };
}

function testArchivedCheckCommand(fixture: CliFixture): void {
  const textResult = runCli(["check", fixture.archivedDirectory]);
  assert.equal(textResult.status, 1);
  assert.equal(textResult.stdout, "");
  assert.match(textResult.stderr, /archived-change-not-checkable/u);
  assert.doesNotMatch(textResult.stderr, /missing-required-file|invalid-h1/u);

  const jsonResult = runCli(["check", fixture.archivedDirectory, "--json"]);
  assert.equal(jsonResult.status, 1);
  assert.equal(jsonResult.stderr, "");
  const parsed: unknown = JSON.parse(jsonResult.stdout);
  assert.ok(isRecord(parsed));
  assert.equal(parsed.valid, false);
  assert.equal(parsed.taskCount, 0);
}

function testCheckCommands(fixture: CliFixture): void {
  const cliSuccess = spawnSync(
    "node",
    [generatedCliPath, "check", fixture.validDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /Change plan check passed/u);
  assert.equal(cliSuccess.stderr, "");

  const cliFailure = spawnSync(
    "node",
    [generatedCliPath, "check", fixture.invalidTasksDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Change plan check failed/u);
  assert.equal(cliFailure.stdout, "");

  const cliJson = spawnSync(
    "node",
    [generatedCliPath, "check", fixture.invalidTasksDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliJson.status, 1);
  assert.equal(cliJson.stderr, "");
  const jsonResult: unknown = JSON.parse(cliJson.stdout);
  assert.ok(isRecord(jsonResult));
  assert.equal(jsonResult.valid, false);
}

function testActiveCollectionCheckResults(fixture: CliFixture): void {
  const textFailure = runCli(["check-all", fixture.lifecycleRoot]);
  assert.equal(textFailure.status, 1);
  assert.equal(textFailure.stdout, "");
  assert.match(textFailure.stderr, /collection check failed/u);
  assert.match(textFailure.stderr, /invalid-plan/u);
  assert.match(textFailure.stderr, /missing-required-file/u);

  const defaultRootFailure = spawnSync(
    "node",
    [generatedCliPath, "check-all", "--json"],
    { cwd: path.dirname(fixture.lifecycleRoot), encoding: "utf8" }
  );
  assert.equal(defaultRootFailure.status, 1);
  assert.equal(defaultRootFailure.stderr, "");
  const defaultRootResult: unknown = JSON.parse(defaultRootFailure.stdout);
  assert.ok(isRecord(defaultRootResult));
  assert.equal(defaultRootResult.changeRoot, fixture.lifecycleRoot);
  assert.equal(defaultRootResult.valid, false);
  assert.equal(defaultRootResult.checkedCount, 3);
  assert.equal(defaultRootResult.validCount, 2);
  assert.equal(defaultRootResult.invalidCount, 1);
  assert.ok(isUnknownArray(defaultRootResult.entries));
  assert.ok(
    defaultRootResult.entries.some(
      (entry) =>
        isRecord(entry) &&
        entry.changeName === "invalid-plan" &&
        entry.valid === false &&
        isUnknownArray(entry.diagnostics) &&
        entry.diagnostics.length > 0
    )
  );
  assert.ok(
    defaultRootResult.entries.every(
      (entry) => isRecord(entry) && "distance" in entry
    )
  );
  assert.ok(
    defaultRootResult.entries.every(
      (entry) => isRecord(entry) && entry.status === "active"
    )
  );
}

function testCollectionCheckRootDiagnostics(fixture: CliFixture): void {
  const rootFailure = runCli([
    "check-all",
    fixture.nonDirectoryChangeRoot,
    "--json"
  ]);
  assert.equal(rootFailure.status, 1);
  assert.equal(rootFailure.stderr, "");
  const rootFailureResult: unknown = JSON.parse(rootFailure.stdout);
  assert.ok(isRecord(rootFailureResult));
  assert.equal(rootFailureResult.valid, false);
  assert.ok(isUnknownArray(rootFailureResult.errors));
  assert.match(String(rootFailureResult.errors[0]), /must be a directory/u);

  const textRootFailure = runCli(["check-all", fixture.nonDirectoryChangeRoot]);
  assert.equal(textRootFailure.status, 1);
  assert.equal(textRootFailure.stdout, "");
  assert.match(textRootFailure.stderr, /collection check failed/u);
  assert.match(textRootFailure.stderr, /must be a directory/u);
}

function testCollectionCheckOptions(fixture: CliFixture): void {
  const archivedOption = runCli([
    "check-all",
    fixture.lifecycleRoot,
    "--archived"
  ]);
  assert.equal(archivedOption.status, 2);
  assert.match(archivedOption.stderr, /only valid with list/u);

  const allOption = runCli(["check-all", fixture.lifecycleRoot, "--all"]);
  assert.equal(allOption.status, 2);
  assert.match(allOption.stderr, /only valid with list/u);

  const stageConflict = runCli([
    "check-all",
    fixture.lifecycleRoot,
    "--stage",
    "draft"
  ]);
  assert.equal(stageConflict.status, 2);
  assert.match(stageConflict.stderr, /only valid with list/u);

  const help = runCli(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /change-plan\.mjs check-all/u);
}

function testListLifecycleJson(fixture: CliFixture): void {
  const cliList = spawnSync(
    "node",
    [generatedCliPath, "list", fixture.lifecycleRoot, "--all", "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliList.status, 0, cliList.stderr);
  assert.equal(cliList.stderr, "");
  const cliListResult: unknown = JSON.parse(cliList.stdout);
  assert.ok(isRecord(cliListResult));
  assert.ok(isUnknownArray(cliListResult.entries));
  assert.ok(
    cliListResult.entries.some(
      (entry) =>
        isRecord(entry) &&
        entry.changeName === "active-plan" &&
        entry.status === "active"
    )
  );
  assert.ok(
    cliListResult.entries.some(
      (entry) =>
        isRecord(entry) &&
        entry.changeName === "old-plan" &&
        entry.status === "archived"
    )
  );
  const archivedEntry = cliListResult.entries.find(
    (entry) => isRecord(entry) && entry.changeName === "old-plan"
  );
  assert.ok(isRecord(archivedEntry));
  assert.deepEqual(Object.keys(archivedEntry).sort(), [
    "changeDirectory",
    "changeName",
    "status"
  ]);

  const stageList = runCli([
    "list",
    fixture.lifecycleRoot,
    "--stage",
    "plan",
    "--json"
  ]);
  assert.equal(stageList.status, 0, stageList.stderr);
  const stageListResult: unknown = JSON.parse(stageList.stdout);
  assert.ok(isRecord(stageListResult));
  assert.ok(isUnknownArray(stageListResult.entries));
  assert.ok(stageListResult.entries.length > 0);
  assert.ok(
    stageListResult.entries.every(
      (entry) => isRecord(entry) && entry.stage === "plan"
    )
  );
}

function testArchivedShowCommand(fixture: CliFixture): void {
  const textResult = runCli(["show", fixture.archivedDirectory]);
  assert.equal(textResult.status, 0, textResult.stderr);
  assert.match(textResult.stdout, /Status: archived/u);
  assert.match(textResult.stdout, /Check: not applicable \(archived\)/u);
  assert.match(
    textResult.stdout,
    /historical proposal without current headings/u
  );
  assert.doesNotMatch(textResult.stdout, /Stage:|Tasks:|valid|invalid/u);
  assert.equal(textResult.stderr, "");

  const jsonResult = runCli(["show", fixture.archivedDirectory, "--json"]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed: unknown = JSON.parse(jsonResult.stdout);
  assert.ok(isRecord(parsed));
  assert.equal(parsed.status, "archived");
  assert.equal(parsed.check, null);
  assert.deepEqual(parsed.errors, []);
}

function testListRootDiagnostics(fixture: CliFixture): void {
  const cliListFailure = spawnSync(
    "node",
    [generatedCliPath, "list", fixture.nonDirectoryChangeRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliListFailure.status, 1);
  assert.equal(cliListFailure.stderr, "");
  const cliListFailureResult: unknown = JSON.parse(cliListFailure.stdout);
  assert.ok(isRecord(cliListFailureResult));
  assert.ok(isUnknownArray(cliListFailureResult.errors));
  const firstError = cliListFailureResult.errors[0];
  assert.ok(typeof firstError === "string");
  assert.match(firstError, /must be a directory/u);
}

function testListOptionConflicts(fixture: CliFixture): void {
  const conflictingListOptions = spawnSync(
    "node",
    [generatedCliPath, "list", fixture.lifecycleRoot, "--archived", "--all"],
    { encoding: "utf8" }
  );
  assert.equal(conflictingListOptions.status, 2);
  assert.match(conflictingListOptions.stderr, /cannot be used together/u);
}

function testShowCommands(fixture: CliFixture): void {
  const cliShow = spawnSync(
    "node",
    [generatedCliPath, "show", fixture.activeDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliShow.status, 0, cliShow.stderr);
  assert.match(cliShow.stdout, /Status: active/u);
  assert.match(cliShow.stdout, /Stage: plan/u);
  assert.match(
    cliShow.stdout,
    /自计划基线以来，未统计到 Change 目录外的项目变化。/u
  );
  assert.match(cliShow.stdout, /--- proposal\.md ---/u);
  assert.equal(cliShow.stderr, "");

  const cliInvalidShow = spawnSync(
    "node",
    [generatedCliPath, "show", fixture.invalidListedDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliInvalidShow.status, 1);
  assert.equal(cliInvalidShow.stderr, "");
  const cliInvalidShowResult: unknown = JSON.parse(cliInvalidShow.stdout);
  assert.ok(isRecord(cliInvalidShowResult));
  assert.ok(isRecord(cliInvalidShowResult.check));
  assert.ok(isRecord(cliInvalidShowResult.artifacts));
  assert.equal(cliInvalidShowResult.check.valid, false);
  assert.equal(cliInvalidShowResult.artifacts["design.md"], null);
}

async function testPlanConfirmsAndReconfirmsCanonicalInputs(
  tempRoot: string
): Promise<void> {
  const repository = path.join(tempRoot, "lifecycle-repository");
  await initializeGitRepository(repository);
  await fs.writeFile(path.join(repository, "README.md"), "fixture\n", "utf8");
  runGit(repository, ["add", "README.md"]);
  runGit(repository, ["commit", "-m", "initialize repository"]);
  const baseCommit = runGit(repository, ["rev-parse", "HEAD"]);
  const changeRoot = path.join(repository, "changes");
  const inputs = [
    await writePlan(changeRoot, "draft", {
      metadata: { stage: "draft" },
      tasks: `# Tasks

本 change 在 Plan 内保存已有进度，不把 checkbox 当作确认门禁。

## Readiness

- [ ] 0.1 准备项尚未完成。

## Implementation

- [x] 1.1 实现证据已经形成。

## Verification

- [x] 2.1 验证证据已经形成。
`
    }),
    await writePlan(changeRoot, "plan", {
      metadata: { baseCommit, stage: "plan" }
    })
  ];

  for (const [index, directory] of inputs.entries()) {
    const result = runCli(["plan", directory, "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const parsed: unknown = JSON.parse(result.stdout);
    assert.ok(isRecord(parsed));
    assert.ok(isRecord(parsed.metadata));
    assert.equal(parsed.success, true);
    assert.equal(parsed.action, "plan");
    assert.equal(parsed.fromStage, index === 0 ? "draft" : "plan");
    assert.equal(parsed.metadata.stage, "plan");
    assert.equal(parsed.metadata.baseCommit, baseCommit);
    assert.deepEqual(Object.keys(parsed.metadata).sort(), [
      "baseCommit",
      "stage"
    ]);
  }
}

async function testDistanceEvidenceAndDirectPrompts(
  tempRoot: string
): Promise<void> {
  const repository = path.join(tempRoot, "distance-repository");
  await initializeGitRepository(repository);
  const changeDirectory = await writePlan(
    path.join(repository, "changes"),
    "distance-plan",
    { metadata: { stage: "draft" } }
  );
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "add plan"]);
  assert.equal(runCli(["plan", changeDirectory]).status, 0);

  const zeroText = runCli(["check", changeDirectory]);
  assert.equal(zeroText.status, 0, zeroText.stderr);
  assert.match(
    zeroText.stdout,
    /自计划基线以来，未统计到 Change 目录外的项目变化。/u
  );
  const zeroJson = runCli(["check", changeDirectory, "--json"]);
  const zeroResult: unknown = JSON.parse(zeroJson.stdout);
  assert.ok(isRecord(zeroResult));
  assert.ok(isRecord(zeroResult.distance));
  assert.equal(zeroResult.distance.commitCount, 0);
  assert.equal(zeroResult.distance.changedLines, 0);
  assert.equal("assessment" in zeroResult, false);
  assert.equal("policy" in zeroResult.distance, false);

  await fs.writeFile(
    path.join(changeDirectory, "change-only.md"),
    "只修改当前 Change 目录。\n",
    "utf8"
  );
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "change only the current plan"]);
  const changeOnlyText = runCli(["check", changeDirectory]);
  assert.equal(changeOnlyText.status, 0, changeOnlyText.stderr);
  assert.match(
    changeOnlyText.stdout,
    /自计划基线以来，未统计到 Change 目录外的项目变化。/u
  );
  const changeOnlyJson = runCli(["check", changeDirectory, "--json"]);
  const changeOnlyResult: unknown = JSON.parse(changeOnlyJson.stdout);
  assert.ok(isRecord(changeOnlyResult));
  assert.ok(isRecord(changeOnlyResult.distance));
  assert.equal(changeOnlyResult.distance.commitCount, 0);
  assert.equal(changeOnlyResult.distance.changedLines, 0);
  assert.notEqual(
    changeOnlyResult.distance.baseCommit,
    changeOnlyResult.distance.headCommit
  );

  await fs.writeFile(path.join(repository, "project.txt"), "one\ntwo\n");
  runGit(repository, ["add", "project.txt"]);
  runGit(repository, ["commit", "-m", "change project"]);
  const changedText = runCli(["check", changeDirectory]);
  assert.equal(changedText.status, 0, changedText.stderr);
  assert.match(
    changedText.stdout,
    /距离计划基线已过去 1 个提交，Change 目录外累计变化 2 行；继续前请确认这些变化没有影响当前计划。/u
  );
  const changedJson = runCli(["check", changeDirectory, "--json"]);
  const changedResult: unknown = JSON.parse(changedJson.stdout);
  assert.ok(isRecord(changedResult));
  assert.deepEqual(changedResult.distance, {
    baseCommit: zeroResult.distance.baseCommit,
    changedLines: 2,
    commitCount: 1,
    headCommit: runGit(repository, ["rev-parse", "HEAD"])
  });
}

async function testPlanRecordsExistingHead(tempRoot: string): Promise<void> {
  const repository = path.join(tempRoot, "uncommitted-repository");
  await initializeGitRepository(repository);
  await fs.writeFile(path.join(repository, "README.md"), "fixture\n", "utf8");
  runGit(repository, ["add", "README.md"]);
  runGit(repository, ["commit", "-m", "initialize repository"]);
  const previousHead = runGit(repository, ["rev-parse", "HEAD"]);
  const draftDirectory = await writePlan(
    path.join(repository, "changes"),
    "uncommitted-plan",
    { metadata: { stage: "draft" } }
  );

  assert.match(
    runGit(repository, ["status", "--porcelain"]),
    /^\?\? changes\//u
  );
  const result = runCli(["plan", draftDirectory, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const parsedResult: unknown = JSON.parse(result.stdout);
  assert.ok(isRecord(parsedResult));
  assert.equal(parsedResult.success, true);
  assert.ok(isRecord(parsedResult.metadata));
  assert.equal(parsedResult.metadata.stage, "plan");
  assert.equal(parsedResult.metadata.baseCommit, previousHead);
  assert.equal(runGit(repository, ["rev-parse", "HEAD"]), previousHead);
}

async function testPlanRejectsRepositoryWithoutHead(
  tempRoot: string
): Promise<void> {
  const noHeadRepository = path.join(tempRoot, "no-head-repository");
  await initializeGitRepository(noHeadRepository);
  const noHeadDraftDirectory = await writePlan(
    path.join(noHeadRepository, "changes"),
    "no-head-plan",
    { metadata: { stage: "draft" } }
  );
  const metadataPath = path.join(noHeadDraftDirectory, ".change-plan.json");
  const metadataBefore = await fs.readFile(metadataPath, "utf8");
  const noHeadResult = runCli(["plan", noHeadDraftDirectory, "--json"]);
  assert.equal(noHeadResult.status, 1);
  assert.equal(noHeadResult.stderr, "");
  const parsedNoHeadResult: unknown = JSON.parse(noHeadResult.stdout);
  assert.ok(isRecord(parsedNoHeadResult));
  assert.equal(parsedNoHeadResult.success, false);
  assert.equal(parsedNoHeadResult.errorCode, "base-commit-unavailable");
  assert.equal(await fs.readFile(metadataPath, "utf8"), metadataBefore);
}

async function testArchiveCommands(fixture: CliFixture): Promise<void> {
  const cliLinkedArchive = spawnSync(
    "node",
    [generatedCliPath, "archive", fixture.linkedPlanDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliLinkedArchive.status, 1);
  assert.equal(cliLinkedArchive.stderr, "");
  const cliLinkedArchiveResult: unknown = JSON.parse(cliLinkedArchive.stdout);
  assert.ok(isRecord(cliLinkedArchiveResult));
  assert.equal(cliLinkedArchiveResult.archived, false);
  assert.equal(cliLinkedArchiveResult.check, null);
  assert.ok(typeof cliLinkedArchiveResult.error === "string");
  assert.match(cliLinkedArchiveResult.error, /must not be a symbolic link/u);

  const cliArchiveDirectory = await writePlan(
    fixture.lifecycleRoot,
    "cli-archive-plan",
    { tasks: completedTasks }
  );
  const cliArchive = spawnSync(
    "node",
    [generatedCliPath, "archive", cliArchiveDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliArchive.status, 0, cliArchive.stderr);
  assert.equal(cliArchive.stderr, "");
  const cliArchiveResult: unknown = JSON.parse(cliArchive.stdout);
  assert.ok(isRecord(cliArchiveResult));
  assert.equal(cliArchiveResult.archived, true);
  assert.ok(typeof cliArchiveResult.archivedDirectory === "string");
  assert.equal(
    await fs
      .stat(cliArchiveResult.archivedDirectory)
      .then((stat) => stat.isDirectory()),
    true
  );

  const cliIncompleteArchive = spawnSync(
    "node",
    [generatedCliPath, "archive", fixture.activeDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliIncompleteArchive.status, 1);
  assert.match(cliIncompleteArchive.stderr, /all tasks must be completed/u);
  assert.equal(cliIncompleteArchive.stdout, "");
}

function testUsageCommands(): void {
  const help = spawnSync("node", [generatedCliPath, "--help"], {
    encoding: "utf8"
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /change-plan\.mjs list/u);
  assert.match(help.stdout, /change-plan\.mjs show/u);
  assert.match(help.stdout, /change-plan\.mjs check/u);
  assert.match(help.stdout, /change-plan\.mjs check-all/u);
  assert.match(help.stdout, /change-plan\.mjs plan/u);
  assert.match(help.stdout, /change-plan\.mjs archive/u);
  assert.doesNotMatch(
    help.stdout,
    /change-plan\.mjs (?:implement|shelve|reconcile|resume)/u
  );
  assert.equal(help.stderr, "");

  const invalidArgument = spawnSync("node", [generatedCliPath, "check"], {
    encoding: "utf8"
  });
  assert.equal(invalidArgument.status, 2);
  assert.match(invalidArgument.stderr, /Expected:/u);

  for (const removedCommand of ["implement", "shelve", "reconcile", "resume"]) {
    const removed = runCli([removedCommand, "/tmp/example-change"]);
    assert.equal(removed.status, 2);
    assert.match(removed.stderr, /Unknown change-plan command/u);
  }

  const invalidStage = runCli(["list", "--stage", "unknown"]);
  assert.equal(invalidStage.status, 2);
  assert.match(invalidStage.stderr, /--stage must be/u);
  const legacyStage = runCli(["list", "--stage", "implementation"]);
  assert.equal(legacyStage.status, 2);
  assert.match(legacyStage.stderr, /--stage must be draft or plan/u);
}

async function withCliFixture(
  name: string,
  run: (fixture: CliFixture) => void | Promise<void>
): Promise<void> {
  await withTempRoot(`cli-${name}`, async (tempRoot) => {
    await run(await createCliFixture(tempRoot));
  });
}

test("CLI check preserves text and JSON exit contracts", () =>
  withCliFixture("check", testCheckCommands));

test("CLI check rejects archived changes without artifact diagnostics", () =>
  withCliFixture("check-archived", testArchivedCheckCommand));

test("CLI check-all gates active change collections", () =>
  withCliFixture("check-all", testActiveCollectionCheckResults));

test("CLI check-all reports lifecycle root diagnostics", () =>
  withCliFixture("check-all-roots", testCollectionCheckRootDiagnostics));

test("CLI check-all rejects incompatible options", () =>
  withCliFixture("check-all-options", testCollectionCheckOptions));

test("CLI list returns lifecycle-filtered JSON", () =>
  withCliFixture("list-lifecycle", testListLifecycleJson));

test("CLI list returns structured lifecycle root diagnostics", () =>
  withCliFixture("list-root", testListRootDiagnostics));

test("CLI list rejects conflicting lifecycle options", () =>
  withCliFixture("list-options", testListOptionConflicts));

test("CLI show returns artifacts and invalid-plan diagnostics", () =>
  withCliFixture("show", testShowCommands));

test("CLI show reads archived artifacts without a check result", () =>
  withCliFixture("show-archived", testArchivedShowCommand));

test("CLI archive enforces gates and moves complete plans", () =>
  withCliFixture("archive", testArchiveCommands));

test("CLI plan confirms drafts and reconfirms plans", () =>
  withTempRoot(
    "cli-plan-inputs",
    testPlanConfirmsAndReconfirmsCanonicalInputs
  ));

test("CLI reports raw distance evidence with direct Chinese prompts", () =>
  withTempRoot("cli-distance", testDistanceEvidenceAndDirectPrompts));

test("CLI plan records existing HEAD without requiring committed artifacts", () =>
  withTempRoot("cli-plan-commit", testPlanRecordsExistingHead));

test("CLI plan rejects a repository without HEAD", () =>
  withTempRoot("cli-plan-no-head", testPlanRejectsRepositoryWithoutHead));

test("CLI exposes only six commands and rejects removed lifecycle commands", () => {
  testUsageCommands();
});
