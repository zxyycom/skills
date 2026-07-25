import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  archiveChangePlanDirectory as archiveBundledChangePlanDirectory,
  checkChangePlanDirectory as checkBundledChangePlanDirectory,
  listChangePlans as listBundledChangePlans,
  showChangePlanDirectory as showBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import { archiveChangePlanDirectory } from "../src/archive.ts";
import {
  listChangePlans,
  showChangePlanDirectory
} from "../src/catalog.ts";
import { checkChangePlanDirectory } from "../src/check.ts";

type PlanOverrides = {
  design?: string;
  proposal?: string;
  tasks?: string;
};

const validProposal = `# Proposal

本 change 建立一个可复核的变更计划。

## Why

当前工作缺少持久、可交接的实施计划。

## Outcome

形成能够指导实现与验证的 change artifacts。

## Scope

只处理计划结构和对应检查器。

## Success Criteria

三个 artifact 可独立阅读，并通过结构检查。

## Affected Owners

受影响 owner 为 change-plan skill 和配套工具源码。
`;

const validDesign = `# Design

本 change 使用三个职责分离的 Markdown artifacts。

## Context

项目已经有稳定事实与长期决策 owner。

## Goals / Non-Goals

目标是保存当前 change 的实施计划；不拥有长期事实。

## Decisions

采用 proposal、design 和 tasks 三文件结构。

## Risks / Trade-offs

固定结构提高可检查性，但不会证明内容正确。

## Open Questions

无未回答开放问题。
`;

const validTasks = `# Tasks

本 change 先完成准备审计，再实施并验证。

## Readiness

- [x] 0.1 核对目标、范围、owner 和开放问题。

## Implementation

- [ ] 1.1 实现 change-plan skill 与检查器。

## Verification

- [ ] 2.1 运行结构、CLI 和项目级检查。
`;

const completedTasks = validTasks.replaceAll("- [ ]", "- [x]");

async function writePlan(
  root: string,
  name: string,
  overrides: PlanOverrides = {}
): Promise<string> {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(directory, "proposal.md"),
      overrides.proposal ?? validProposal,
      "utf8"
    ),
    fs.writeFile(
      path.join(directory, "design.md"),
      overrides.design ?? validDesign,
      "utf8"
    ),
    fs.writeFile(
      path.join(directory, "tasks.md"),
      overrides.tasks ?? validTasks,
      "utf8"
    )
  ]);
  return directory;
}

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "../../..");
const generatedCliPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.mjs"
);
const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.d.mts"
);
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "change-plan-test-"));

try {
  const validDirectory = await writePlan(tempRoot, "add-change-plan");
  const validResult = await checkChangePlanDirectory(validDirectory);
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.diagnostics, []);
  assert.equal(validResult.taskCount, 3);
  assert.equal(validResult.completedTaskCount, 1);
  assert.deepEqual(
    await checkBundledChangePlanDirectory(validDirectory),
    validResult
  );

  const lifecycleRoot = path.join(tempRoot, "changes");
  const activeDirectory = await writePlan(lifecycleRoot, "active-plan");
  const completedDirectory = await writePlan(
    lifecycleRoot,
    "completed-plan",
    { tasks: completedTasks }
  );
  const archiveRoot = path.join(lifecycleRoot, "archive");
  const archivedDirectory = await writePlan(
    archiveRoot,
    "old-plan",
    { tasks: completedTasks }
  );

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.deepEqual(activeList.errors, []);
  assert.equal(activeList.status, "active");
  assert.deepEqual(
    activeList.entries.map((entry) => entry.changeName),
    ["active-plan", "completed-plan"]
  );
  assert.ok(activeList.entries.every((entry) => entry.status === "active"));
  assert.deepEqual(
    await listBundledChangePlans({ changeRoot: lifecycleRoot }),
    activeList
  );

  const archivedList = await listChangePlans({
    changeRoot: lifecycleRoot,
    status: "archived"
  });
  assert.deepEqual(archivedList.errors, []);
  assert.deepEqual(
    archivedList.entries.map((entry) => [entry.status, entry.changeName]),
    [["archived", "old-plan"]]
  );

  const allList = await listChangePlans({
    changeRoot: lifecycleRoot,
    status: "all"
  });
  assert.deepEqual(
    allList.entries.map((entry) => [entry.status, entry.changeName]),
    [
      ["active", "active-plan"],
      ["active", "completed-plan"],
      ["archived", "old-plan"]
    ]
  );

  const invalidListedDirectory = path.join(lifecycleRoot, "invalid-plan");
  await fs.mkdir(invalidListedDirectory);
  await fs.writeFile(
    path.join(invalidListedDirectory, "proposal.md"),
    validProposal,
    "utf8"
  );
  const listWithInvalid = await listChangePlans({ changeRoot: lifecycleRoot });
  const invalidListEntry = listWithInvalid.entries.find(
    (entry) => entry.changeName === "invalid-plan"
  );
  assert.equal(listWithInvalid.errors.length, 0);
  assert.equal(invalidListEntry?.valid, false);

  const shownInvalid = await showChangePlanDirectory(invalidListedDirectory);
  assert.equal(shownInvalid.check.valid, false);
  assert.equal(shownInvalid.artifacts["proposal.md"], validProposal);
  assert.equal(shownInvalid.artifacts["design.md"], null);

  const structurallyInvalidArchive = await archiveChangePlanDirectory(
    invalidListedDirectory
  );
  assert.equal(structurallyInvalidArchive.archived, false);
  assert.match(structurallyInvalidArchive.error ?? "", /must pass check/u);

  const emptyChangeRoot = path.join(tempRoot, "empty-changes");
  await fs.mkdir(emptyChangeRoot);
  const emptyArchivedList = await listChangePlans({
    changeRoot: emptyChangeRoot,
    status: "archived"
  });
  assert.deepEqual(emptyArchivedList.errors, []);
  assert.deepEqual(emptyArchivedList.entries, []);

  const missingRootList = await listChangePlans({
    changeRoot: path.join(tempRoot, "missing-changes")
  });
  assert.equal(missingRootList.entries.length, 0);
  assert.match(missingRootList.errors[0] ?? "", /does not exist/u);
  const nonDirectoryChangeRoot = path.join(tempRoot, "changes-file");
  await fs.writeFile(nonDirectoryChangeRoot, "not a directory", "utf8");
  const nonDirectoryRootList = await listChangePlans({
    changeRoot: nonDirectoryChangeRoot
  });
  assert.equal(nonDirectoryRootList.entries.length, 0);
  assert.match(nonDirectoryRootList.errors[0] ?? "", /must be a directory/u);
  const inaccessibleChangeRoot = `${tempRoot}\0inaccessible-root`;
  const inaccessibleRootList = await listChangePlans({
    changeRoot: inaccessibleChangeRoot
  });
  assert.equal(inaccessibleRootList.entries.length, 0);
  assert.match(inaccessibleRootList.errors[0] ?? "", /cannot access change root/u);

  const shownActive = await showChangePlanDirectory(activeDirectory);
  assert.equal(shownActive.status, "active");
  assert.equal(shownActive.check.valid, true);
  assert.equal(shownActive.artifacts["proposal.md"], validProposal);
  assert.deepEqual(
    await showBundledChangePlanDirectory(activeDirectory),
    shownActive
  );
  const shownArchived = await showChangePlanDirectory(archivedDirectory);
  assert.equal(shownArchived.status, "archived");

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
  const linkedArchive = await archiveChangePlanDirectory(linkedPlanDirectory);
  assert.equal(linkedArchive.archived, false);
  assert.equal(linkedArchive.check, null);
  assert.match(linkedArchive.error, /must not be a symbolic link/u);
  const listWithLinkedPlan = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.equal(
    listWithLinkedPlan.entries.some((entry) => entry.changeName === "linked-plan"),
    false
  );
  const linkedRootList = await listChangePlans({
    changeRoot: linkedPlanDirectory
  });
  assert.match(linkedRootList.errors[0] ?? "", /must be a directory/u);

  const incompleteArchive = await archiveChangePlanDirectory(activeDirectory);
  assert.equal(incompleteArchive.archived, false);
  assert.notEqual(incompleteArchive.check, null);
  assert.match(incompleteArchive.error ?? "", /all tasks must be completed/u);
  assert.equal(await fs.stat(activeDirectory).then(() => true), true);

  const collisionDirectory = await writePlan(
    lifecycleRoot,
    "collision-plan",
    { tasks: completedTasks }
  );
  await writePlan(archiveRoot, "collision-plan", { tasks: completedTasks });
  const collisionArchive = await archiveChangePlanDirectory(collisionDirectory);
  assert.equal(collisionArchive.archived, false);
  assert.match(collisionArchive.error ?? "", /target already exists/u);
  assert.equal(await fs.stat(collisionDirectory).then(() => true), true);

  await fs.writeFile(
    path.join(completedDirectory, "evidence.md"),
    "验证证据。\n",
    "utf8"
  );
  const completedArchive = await archiveChangePlanDirectory(completedDirectory);
  assert.equal(completedArchive.archived, true);
  assert.equal(completedArchive.error, null);
  await assert.rejects(fs.stat(completedDirectory), { code: "ENOENT" });
  assert.equal(
    await fs.stat(completedArchive.archivedDirectory).then((stat) => stat.isDirectory()),
    true
  );
  assert.equal(
    await fs.readFile(
      path.join(completedArchive.archivedDirectory, "evidence.md"),
      "utf8"
    ),
    "验证证据。\n"
  );

  const bundledDirectory = await writePlan(
    lifecycleRoot,
    "bundled-plan",
    { tasks: completedTasks }
  );
  const bundledArchive = await archiveBundledChangePlanDirectory(bundledDirectory);
  assert.equal(bundledArchive.archived, true);
  assert.equal(
    await fs.stat(bundledArchive.archivedDirectory).then((stat) => stat.isDirectory()),
    true
  );

  const alreadyArchived = await archiveChangePlanDirectory(archivedDirectory);
  assert.equal(alreadyArchived.archived, false);
  assert.equal(alreadyArchived.check, null);
  assert.match(alreadyArchived.error ?? "", /already archived/u);

  const blockedArchiveRoot = path.join(tempRoot, "blocked-archive-root");
  const blockedDirectory = await writePlan(
    blockedArchiveRoot,
    "blocked-plan",
    { tasks: completedTasks }
  );
  await fs.writeFile(path.join(blockedArchiveRoot, "archive"), "not a directory");
  const blockedArchive = await archiveChangePlanDirectory(blockedDirectory);
  assert.equal(blockedArchive.archived, false);
  assert.match(blockedArchive.error ?? "", /regular directory/u);
  const blockedArchivedList = await listChangePlans({
    changeRoot: blockedArchiveRoot,
    status: "archived"
  });
  assert.match(
    blockedArchivedList.errors[0] ?? "",
    /change archive must be a directory/u
  );

  const invalidNameDirectory = await writePlan(tempRoot, "Invalid_Name");
  const invalidNameResult = await checkChangePlanDirectory(invalidNameDirectory);
  assert.equal(invalidNameResult.valid, false);
  assert.ok(
    invalidNameResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-change-name"
    )
  );

  const missingFileDirectory = await writePlan(tempRoot, "missing-design");
  await fs.rm(path.join(missingFileDirectory, "design.md"));
  const missingFileResult = await checkChangePlanDirectory(missingFileDirectory);
  assert.ok(
    missingFileResult.diagnostics.some(
      (diagnostic) => (
        diagnostic.code === "missing-required-file"
        && diagnostic.file === "design.md"
      )
    )
  );

  const invalidProposalDirectory = await writePlan(tempRoot, "invalid-proposal", {
    proposal: `# Proposal

本 change 的 proposal 结构无效。

## Outcome

结果提前出现。

## Why

原因随后出现。

## Scope

范围存在。

## Success Criteria

成功标准存在。

## Affected Owners
`
  });
  const invalidProposalResult = await checkChangePlanDirectory(
    invalidProposalDirectory
  );
  assert.ok(
    invalidProposalResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "section-order"
    )
  );
  assert.ok(
    invalidProposalResult.diagnostics.some(
      (diagnostic) => (
        diagnostic.code === "empty-section"
        && diagnostic.file === "proposal.md"
      )
    )
  );

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
  const invalidTasksResult = await checkChangePlanDirectory(invalidTasksDirectory);
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-task-syntax"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "duplicate-task-id"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "missing-task"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "task-outside-required-section"
    )
  );

  const missingDirectoryResult = await checkChangePlanDirectory(
    path.join(tempRoot, "not-created")
  );
  assert.ok(
    missingDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-not-found"
    )
  );
  const inaccessibleDirectoryResult = await checkChangePlanDirectory(
    `${tempRoot}\0inaccessible-change`
  );
  assert.ok(
    inaccessibleDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-read-failed"
    )
  );

  const filePath = path.join(tempRoot, "not-a-directory");
  await fs.writeFile(filePath, "file", "utf8");
  const filePathResult = await checkChangePlanDirectory(filePath);
  assert.ok(
    filePathResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-path-not-directory"
    )
  );
  const fileArchive = await archiveChangePlanDirectory(filePath);
  assert.equal(fileArchive.archived, false);
  assert.equal(fileArchive.check, null);
  assert.match(fileArchive.error, /must be a directory/u);
  const inaccessibleArchive = await archiveChangePlanDirectory(
    `${tempRoot}\0inaccessible-archive`
  );
  assert.equal(inaccessibleArchive.archived, false);
  assert.equal(inaccessibleArchive.check, null);
  assert.match(inaccessibleArchive.error, /cannot inspect change directory/u);

  const cliSuccess = spawnSync(
    "node",
    [generatedCliPath, "check", validDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /Change plan check passed/u);
  assert.equal(cliSuccess.stderr, "");

  const cliFailure = spawnSync(
    "node",
    [generatedCliPath, "check", invalidTasksDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Change plan check failed/u);
  assert.equal(cliFailure.stdout, "");

  const cliJson = spawnSync(
    "node",
    [generatedCliPath, "check", invalidTasksDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliJson.status, 1);
  assert.equal(cliJson.stderr, "");
  const jsonResult = JSON.parse(cliJson.stdout) as { valid: boolean };
  assert.equal(jsonResult.valid, false);

  const cliList = spawnSync(
    "node",
    [generatedCliPath, "list", lifecycleRoot, "--all", "--json"],
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
    [generatedCliPath, "list", nonDirectoryChangeRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliListFailure.status, 1);
  assert.equal(cliListFailure.stderr, "");
  const cliListFailureResult = JSON.parse(cliListFailure.stdout) as {
    errors: string[];
  };
  assert.match(cliListFailureResult.errors[0] ?? "", /must be a directory/u);

  const cliShow = spawnSync(
    "node",
    [generatedCliPath, "show", activeDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliShow.status, 0, cliShow.stderr);
  assert.match(cliShow.stdout, /Status: active/u);
  assert.match(cliShow.stdout, /--- proposal\.md ---/u);
  assert.equal(cliShow.stderr, "");
  const cliInvalidShow = spawnSync(
    "node",
    [generatedCliPath, "show", invalidListedDirectory, "--json"],
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

  const cliLinkedArchive = spawnSync(
    "node",
    [generatedCliPath, "archive", linkedPlanDirectory, "--json"],
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
    lifecycleRoot,
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
    [generatedCliPath, "archive", activeDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliIncompleteArchive.status, 1);
  assert.match(cliIncompleteArchive.stderr, /all tasks must be completed/u);
  assert.equal(cliIncompleteArchive.stdout, "");

  const conflictingListOptions = spawnSync(
    "node",
    [generatedCliPath, "list", lifecycleRoot, "--archived", "--all"],
    { encoding: "utf8" }
  );
  assert.equal(conflictingListOptions.status, 2);
  assert.match(conflictingListOptions.stderr, /cannot be used together/u);

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

  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(
    cliSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/change-plan\/src\/cli\.ts/u
  );
  assert.match(cliSource, /Rebuild: bun run sync:change-plan-cli/u);
  assert.match(cliSource, /sourceMappingURL=change-plan\.mjs\.map/u);

  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(declarationSource, /archiveChangePlanDirectory/u);
  assert.match(declarationSource, /checkChangePlanDirectory/u);
  assert.match(declarationSource, /listChangePlans/u);
  assert.match(declarationSource, /runChangePlanCli/u);
  assert.match(declarationSource, /showChangePlanDirectory/u);
  assert.match(declarationSource, /archived: true/u);
  assert.match(declarationSource, /check: ChangePlanCheckResult \| null/u);
  assert.match(declarationSource, /change-directory-read-failed/u);

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  ) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/cli.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Change plan CLI tests passed.");
