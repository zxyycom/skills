import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  completedTasks,
  generatedCliPath,
  validProposal,
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

function testListCommands(fixture: CliFixture): void {
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
  assert.match(help.stdout, /change-plan\.mjs archive/u);
  assert.equal(help.stderr, "");

  const invalidArgument = spawnSync("node", [generatedCliPath, "check"], {
    encoding: "utf8"
  });
  assert.equal(invalidArgument.status, 2);
  assert.match(invalidArgument.stderr, /Expected:/u);
}

export async function runCliTests(): Promise<void> {
  await withTempRoot("cli", async (tempRoot) => {
    const fixture = await createCliFixture(tempRoot);
    testCheckCommands(fixture);
    testListCommands(fixture);
    testShowCommands(fixture);
    await testArchiveCommands(fixture);
    testUsageCommands();
  });
}
