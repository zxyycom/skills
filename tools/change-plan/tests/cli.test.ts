import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  completedTasks,
  generatedCliPath,
  validProposal,
  validBaseCommit,
  withTempRoot,
  writePlan
} from "./support.ts";

type CliFixture = {
  activeDirectory: string;
  invalidListedDirectory: string;
  invalidTasksDirectory: string;
  lifecycleRoot: string;
  linkedPlanDirectory: string;
  nonDirectoryChangeRoot: string;
  validDirectory: string;
};

function runCli(arguments_: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...arguments_], {
    encoding: "utf8"
  });
}

function runGit(directory: string, arguments_: readonly string[]): void {
  const result = spawnSync("git", ["-C", directory, ...arguments_], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
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
  await writePlan(
    path.join(lifecycleRoot, "archive"),
    "old-plan",
    { tasks: completedTasks }
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
    invalidListedDirectory,
    invalidTasksDirectory,
    lifecycleRoot,
    linkedPlanDirectory,
    nonDirectoryChangeRoot,
    validDirectory
  };
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
  const jsonResult = JSON.parse(cliJson.stdout) as { valid: boolean };
  assert.equal(jsonResult.valid, false);
}

function testListLifecycleJson(fixture: CliFixture): void {
  const cliList = spawnSync(
    "node",
    [generatedCliPath, "list", fixture.lifecycleRoot, "--all", "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliList.status, 0, cliList.stderr);
  assert.equal(cliList.stderr, "");
  const cliListResult = JSON.parse(cliList.stdout) as {
    entries: Array<{ changeName: string; status: string }>;
  };
  assert.ok(
    cliListResult.entries.some(
      (entry) => entry.changeName === "active-plan" && entry.status === "active"
    )
  );
  assert.ok(
    cliListResult.entries.some(
      (entry) => entry.changeName === "old-plan" && entry.status === "archived"
    )
  );

  const stageList = runCli([
    "list",
    fixture.lifecycleRoot,
    "--stage",
    "implementation",
    "--json"
  ]);
  assert.equal(stageList.status, 0, stageList.stderr);
  const stageListResult = JSON.parse(stageList.stdout) as {
    entries: Array<{ stage: string | null }>;
  };
  assert.ok(stageListResult.entries.length > 0);
  assert.ok(stageListResult.entries.every(
    (entry) => entry.stage === "implementation"
  ));
}

function testListRootDiagnostics(fixture: CliFixture): void {
  const cliListFailure = spawnSync(
    "node",
    [generatedCliPath, "list", fixture.nonDirectoryChangeRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliListFailure.status, 1);
  assert.equal(cliListFailure.stderr, "");
  const cliListFailureResult = JSON.parse(cliListFailure.stdout) as {
    errors: string[];
  };
  assert.match(cliListFailureResult.errors[0] ?? "", /must be a directory/u);
}

function testListOptionConflicts(fixture: CliFixture): void {
  const conflictingListOptions = spawnSync(
    "node",
    [
      generatedCliPath,
      "list",
      fixture.lifecycleRoot,
      "--archived",
      "--all"
    ],
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
  assert.match(cliShow.stdout, /Stage: implementation/u);
  assert.match(cliShow.stdout, /Assessment: not-applicable/u);
  assert.match(cliShow.stdout, /--- proposal\.md ---/u);
  assert.equal(cliShow.stderr, "");

  const cliInvalidShow = spawnSync(
    "node",
    [generatedCliPath, "show", fixture.invalidListedDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliInvalidShow.status, 1);
  assert.equal(cliInvalidShow.stderr, "");
  const cliInvalidShowResult = JSON.parse(cliInvalidShow.stdout) as {
    artifacts: Record<string, string | null>;
    check: { valid: boolean };
  };
  assert.equal(cliInvalidShowResult.check.valid, false);
  assert.equal(cliInvalidShowResult.artifacts["design.md"], null);
}

async function testLifecycleCommands(tempRoot: string): Promise<void> {
  const repository = path.join(tempRoot, "lifecycle-repository");
  await initializeGitRepository(repository);
  const changeRoot = path.join(repository, "changes");
  const implementationDirectory = await writePlan(
    changeRoot,
    "implementation-path",
    { metadata: { schemaVersion: 1, stage: "draft" } }
  );
  const shelvingDirectory = await writePlan(
    changeRoot,
    "shelving-path",
    { metadata: { schemaVersion: 1, stage: "draft" } }
  );
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "add lifecycle plans"]);

  const plannedImplementation = runCli([
    "plan",
    implementationDirectory,
    "--json"
  ]);
  assert.equal(plannedImplementation.status, 0, plannedImplementation.stderr);
  const plannedResult = JSON.parse(plannedImplementation.stdout) as {
    check: { assessment: { assessment: string }; stage: string };
    fromStage: string;
    success: boolean;
    toStage: string;
  };
  assert.equal(plannedResult.success, true);
  assert.equal(plannedResult.fromStage, "draft");
  assert.equal(plannedResult.toStage, "plan");
  assert.equal(plannedResult.check.stage, "plan");
  assert.equal(plannedResult.check.assessment.assessment, "current");

  const implemented = runCli([
    "implement",
    implementationDirectory,
    "--json"
  ]);
  assert.equal(implemented.status, 0, implemented.stderr);
  assert.equal(
    (JSON.parse(implemented.stdout) as { toStage: string }).toStage,
    "implementation"
  );

  assert.equal(
    runCli(["plan", shelvingDirectory, "--json"]).status,
    0
  );
  const shelved = runCli([
    "shelve",
    shelvingDirectory,
    "--reason",
    "等待产品方向",
    "--json"
  ]);
  assert.equal(shelved.status, 0, shelved.stderr);
  const shelvedResult = JSON.parse(shelved.stdout) as {
    check: {
      metadata: {
        shelf: { reason: string; source: string };
        stage: string;
      };
    };
  };
  assert.equal(shelvedResult.check.metadata.stage, "shelved");
  assert.equal(shelvedResult.check.metadata.shelf.source, "explicit");
  assert.equal(shelvedResult.check.metadata.shelf.reason, "等待产品方向");

  const resumed = runCli(["resume", shelvingDirectory, "--json"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const resumedResult = JSON.parse(resumed.stdout) as {
    check: {
      assessment: { assessment: string };
      metadata: { baseCommit: string | null; stage: string };
    };
  };
  assert.deepEqual(resumedResult.check.metadata, {
    baseCommit: null,
    schemaVersion: 1,
    stage: "plan"
  });
  assert.equal(
    resumedResult.check.assessment.assessment,
    "plan-review-required"
  );

  const directImplement = runCli([
    "implement",
    shelvingDirectory,
    "--json"
  ]);
  assert.equal(directImplement.status, 1);
  assert.match(
    (JSON.parse(directImplement.stdout) as { error: string }).error,
    /reviewed with plan/u
  );

  assert.equal(runCli(["plan", shelvingDirectory]).status, 0);
  assert.equal(runCli(["implement", shelvingDirectory]).status, 0);
}

async function testReconcileCandidate(tempRoot: string): Promise<void> {
  const repository = path.join(tempRoot, "reconcile-repository");
  await initializeGitRepository(repository);
  const changeRoot = path.join(repository, "changes");
  const candidateDirectory = await writePlan(changeRoot, "candidate-plan", {
    metadata: { schemaVersion: 1, stage: "draft" }
  });
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "add candidate plan"]);
  assert.equal(runCli(["plan", candidateDirectory]).status, 0);

  const progressFile = path.join(repository, "project-progress.txt");
  for (let index = 1; index <= 9; index += 1) {
    await fs.appendFile(progressFile, `project change ${index}\n`, "utf8");
    runGit(repository, ["add", "project-progress.txt"]);
    runGit(repository, ["commit", "-m", `project change ${index}`]);
  }

  const candidateCheck = runCli(["check", candidateDirectory, "--json"]);
  assert.equal(candidateCheck.status, 0, candidateCheck.stderr);
  const candidateCheckResult = JSON.parse(candidateCheck.stdout) as {
    assessment: {
      assessment: string;
      baseCommit: string;
      changedLines: number;
      commitCount: number;
      headCommit: string;
      policy: string;
    };
  };
  assert.equal(
    candidateCheckResult.assessment.assessment,
    "shelve-candidate"
  );
  assert.match(candidateCheckResult.assessment.baseCommit, /^[0-9a-f]{40}$/u);
  assert.match(candidateCheckResult.assessment.headCommit, /^[0-9a-f]{40}$/u);
  assert.equal(candidateCheckResult.assessment.commitCount, 9);
  assert.equal(candidateCheckResult.assessment.changedLines, 9);
  assert.equal(candidateCheckResult.assessment.policy, "git-distance-v1");

  const candidateList = runCli(["list", changeRoot]);
  assert.equal(candidateList.status, 0, candidateList.stderr);
  assert.match(
    candidateList.stdout,
    /shelve-candidate: 9 commits \/ 9 changed lines since plan/u
  );

  const reconciled = runCli(["reconcile", candidateDirectory, "--json"]);
  assert.equal(reconciled.status, 0, reconciled.stderr);
  const reconciledResult = JSON.parse(reconciled.stdout) as {
    check: {
      metadata: {
        shelf: {
          changedLines: number;
          commitCount: number;
          source: string;
        };
        stage: string;
      };
    };
  };
  assert.equal(reconciledResult.check.metadata.stage, "shelved");
  assert.deepEqual(
    {
      changedLines: reconciledResult.check.metadata.shelf.changedLines,
      commitCount: reconciledResult.check.metadata.shelf.commitCount,
      source: reconciledResult.check.metadata.shelf.source
    },
    {
      changedLines: 9,
      commitCount: 9,
      source: "git-distance-v1"
    }
  );
}

async function testReconfirmCandidate(tempRoot: string): Promise<void> {
  const repository = path.join(tempRoot, "reconfirm-repository");
  await initializeGitRepository(repository);
  const candidateDirectory = await writePlan(
    path.join(repository, "changes"),
    "reconfirmed-candidate",
    { metadata: { schemaVersion: 1, stage: "draft" } }
  );
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "add candidate plan"]);
  assert.equal(runCli(["plan", candidateDirectory]).status, 0);

  const progressFile = path.join(repository, "project-progress.txt");
  for (let index = 1; index <= 9; index += 1) {
    await fs.appendFile(progressFile, `project change ${index}\n`, "utf8");
    runGit(repository, ["add", "project-progress.txt"]);
    runGit(repository, ["commit", "-m", `project change ${index}`]);
  }

  const replanned = runCli(["plan", candidateDirectory, "--json"]);
  assert.equal(replanned.status, 0, replanned.stderr);
  const replannedResult = JSON.parse(replanned.stdout) as {
    check: {
      assessment: {
        assessment: string;
        commitCount: number;
        changedLines: number;
      };
      stage: string;
    };
    fromStage: string;
    toStage: string;
  };
  assert.equal(replannedResult.fromStage, "plan");
  assert.equal(replannedResult.toStage, "plan");
  assert.equal(replannedResult.check.stage, "plan");
  assert.equal(replannedResult.check.assessment.assessment, "current");
  assert.equal(replannedResult.check.assessment.commitCount, 0);
  assert.equal(replannedResult.check.assessment.changedLines, 0);

  const currentPlanAgain = runCli([
    "plan",
    candidateDirectory,
    "--json"
  ]);
  assert.equal(currentPlanAgain.status, 1);
  assert.match(
    (JSON.parse(currentPlanAgain.stdout) as { error: string }).error,
    /plan accepts draft, plan-review-required, or shelve-candidate/u
  );
  assert.equal(runCli(["implement", candidateDirectory]).status, 0);
}

async function testPlanRequiresCommittedArtifacts(
  tempRoot: string
): Promise<void> {
  const repository = path.join(tempRoot, "uncommitted-repository");
  await initializeGitRepository(repository);
  await fs.writeFile(path.join(repository, "README.md"), "fixture\n", "utf8");
  runGit(repository, ["add", "README.md"]);
  runGit(repository, ["commit", "-m", "initialize repository"]);
  const draftDirectory = await writePlan(
    path.join(repository, "changes"),
    "uncommitted-plan",
    { metadata: { schemaVersion: 1, stage: "draft" } }
  );

  const result = runCli(["plan", draftDirectory, "--json"]);
  assert.equal(result.status, 1);
  assert.match(
    (JSON.parse(result.stdout) as { error: string }).error,
    /must be committed at HEAD/u
  );
}

async function testLifecycleOutputChannels(tempRoot: string): Promise<void> {
  const repository = path.join(tempRoot, "lifecycle-output-repository");
  await initializeGitRepository(repository);
  const changeRoot = path.join(repository, "changes");
  const textSuccessDirectory = await writePlan(
    changeRoot,
    "text-success",
    {
      metadata: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        shelf: {
          atCommit: validBaseCommit,
          reason: "等待方向",
          source: "explicit"
        },
        stage: "shelved"
      }
    }
  );
  const jsonSuccessDirectory = await writePlan(
    changeRoot,
    "json-success",
    {
      metadata: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        shelf: {
          atCommit: validBaseCommit,
          reason: "等待方向",
          source: "explicit"
        },
        stage: "shelved"
      }
    }
  );
  const failureDirectory = await writePlan(
    changeRoot,
    "invalid-resume",
    {
      metadata: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        stage: "implementation"
      }
    }
  );
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "-m", "add lifecycle output fixtures"]);

  const textSuccess = runCli(["resume", textSuccessDirectory]);
  assert.equal(textSuccess.status, 0, textSuccess.stderr);
  assert.equal(textSuccess.stderr, "");
  assert.match(textSuccess.stdout, /shelved -> plan \(resume\)/u);

  const jsonSuccess = runCli(["resume", jsonSuccessDirectory, "--json"]);
  assert.equal(jsonSuccess.status, 0, jsonSuccess.stderr);
  assert.equal(jsonSuccess.stderr, "");
  const jsonSuccessResult = JSON.parse(jsonSuccess.stdout) as {
    check: { valid: boolean };
    errorCode: null;
    success: boolean;
  };
  assert.equal(jsonSuccessResult.success, true);
  assert.equal(jsonSuccessResult.errorCode, null);
  assert.equal(jsonSuccessResult.check.valid, false);

  const textFailure = runCli(["resume", failureDirectory]);
  assert.equal(textFailure.status, 1);
  assert.equal(textFailure.stdout, "");
  assert.match(textFailure.stderr, /\[invalid-source-stage\]/u);
  assert.match(textFailure.stderr, /inspect the current stage first/u);

  const jsonFailure = runCli(["resume", failureDirectory, "--json"]);
  assert.equal(jsonFailure.status, 1);
  assert.equal(jsonFailure.stderr, "");
  const jsonFailureResult = JSON.parse(jsonFailure.stdout) as {
    errorCode: string;
    success: boolean;
  };
  assert.equal(jsonFailureResult.success, false);
  assert.equal(jsonFailureResult.errorCode, "invalid-source-stage");
}

async function testArchiveCommands(fixture: CliFixture): Promise<void> {
  const cliLinkedArchive = spawnSync(
    "node",
    [generatedCliPath, "archive", fixture.linkedPlanDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliLinkedArchive.status, 1);
  assert.equal(cliLinkedArchive.stderr, "");
  const cliLinkedArchiveResult = JSON.parse(cliLinkedArchive.stdout) as {
    archived: boolean;
    check: unknown;
    error: string;
  };
  assert.equal(cliLinkedArchiveResult.archived, false);
  assert.equal(cliLinkedArchiveResult.check, null);
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
  const cliArchiveResult = JSON.parse(cliArchive.stdout) as {
    archived: boolean;
    archivedDirectory: string;
  };
  assert.equal(cliArchiveResult.archived, true);
  assert.equal(
    await fs.stat(cliArchiveResult.archivedDirectory).then((stat) => stat.isDirectory()),
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
  assert.match(help.stdout, /change-plan\.mjs plan/u);
  assert.match(help.stdout, /change-plan\.mjs implement/u);
  assert.match(help.stdout, /change-plan\.mjs shelve/u);
  assert.match(help.stdout, /change-plan\.mjs reconcile/u);
  assert.match(help.stdout, /change-plan\.mjs resume/u);
  assert.match(help.stdout, /change-plan\.mjs archive/u);
  assert.equal(help.stderr, "");

  const invalidArgument = spawnSync("node", [generatedCliPath, "check"], {
    encoding: "utf8"
  });
  assert.equal(invalidArgument.status, 2);
  assert.match(invalidArgument.stderr, /Expected:/u);

  const missingReason = runCli(["shelve", "/tmp/example-change"]);
  assert.equal(missingReason.status, 2);
  assert.match(missingReason.stderr, /requires a non-empty --reason/u);

  const invalidStage = runCli(["list", "--stage", "unknown"]);
  assert.equal(invalidStage.status, 2);
  assert.match(invalidStage.stderr, /--stage must be/u);
}

async function withCliFixture(
  name: string,
  run: (fixture: CliFixture) => void | Promise<void>
): Promise<void> {
  await withTempRoot(`cli-${name}`, async (tempRoot) => {
    await run(await createCliFixture(tempRoot));
  });
}

test("CLI check preserves text and JSON exit contracts", () => (
  withCliFixture("check", testCheckCommands)
));

test("CLI list returns lifecycle-filtered JSON", () => (
  withCliFixture("list-lifecycle", testListLifecycleJson)
));

test("CLI list returns structured lifecycle root diagnostics", () => (
  withCliFixture("list-root", testListRootDiagnostics)
));

test("CLI list rejects conflicting lifecycle options", () => (
  withCliFixture("list-options", testListOptionConflicts)
));

test("CLI show returns artifacts and invalid-plan diagnostics", () => (
  withCliFixture("show", testShowCommands)
));

test("CLI archive enforces gates and moves complete plans", () => (
  withCliFixture("archive", testArchiveCommands)
));

test("CLI lifecycle commands enforce legal stage transitions", () => (
  withTempRoot("cli-lifecycle", testLifecycleCommands)
));

test("CLI reconcile shelves a Git-distance candidate with evidence", () => (
  withTempRoot("cli-reconcile", testReconcileCandidate)
));

test("CLI plan reconfirms a Git-distance candidate", () => (
  withTempRoot("cli-reconfirm", testReconfirmCandidate)
));

test("CLI plan requires artifacts committed at HEAD", () => (
  withTempRoot("cli-plan-commit", testPlanRequiresCommittedArtifacts)
));

test("CLI lifecycle output preserves result channels and error codes", () => (
  withTempRoot("cli-lifecycle-output", testLifecycleOutputChannels)
));

test("CLI help and argument errors use stable exit contracts", () => {
  testUsageCommands();
});
