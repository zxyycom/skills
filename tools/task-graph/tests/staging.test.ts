import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  TaskGraphError,
  TaskGraphService,
  cancelTask,
  defaultTaskGraphIndexPath,
  parseTaskIndex,
  removeTasks as removeTaskEntries,
  runTaskGraphCli,
  serializeTaskIndex,
  type TaskIndex
} from "../src/cli.ts";
import {
  applyOperations,
  expectTaskGraphRejection,
  graphIndex,
  initialNow,
  taskContent,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";

const testOptions = { timeout: 20_000 };

type RepositoryFixture = {
  candidate: TaskIndex;
  candidateText: string;
  repositoryRoot: string;
};

test("stages selected tasks with candidate watermarks while preserving workspace and outside pending paths", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
    candidate = applyOperations(candidate, [taskOperation("charlie", {
      title: "charlie workspace"
    })]);
    const fixture = await createRepositoryFixture({
      baseline,
      candidate,
      repositoryRoot,
      stageOutside: true
    });

    const staged = await new TaskGraphService({ root: repositoryRoot }).stageTasks([
      "task-000001"
    ]);

    assert.deepEqual(staged, {
      revision: candidate.revision,
      data: {
        changed: true,
        nextTaskId: candidate.nextTaskId,
        selectedTaskIds: ["task-000001"],
        state: "staged",
        taskCount: 2
      }
    });
    const pending = await readPendingTaskIndex(repositoryRoot);
    assert.equal(pending.revision, candidate.revision);
    assert.equal(pending.nextTaskId, candidate.nextTaskId);
    assert.deepEqual(Object.keys(pending.tasks), ["task-000001", "task-000002"]);
    assert.equal(pending.tasks["task-000001"]!.content.title, "alpha workspace");
    assert.equal(
      pending.tasks["task-000002"]!.content.title,
      baseline.tasks["task-000002"]!.content.title
    );
    assert.deepEqual(await pendingChangedPaths(repositoryRoot), [
      defaultTaskGraphIndexPath,
      "outside/keep.md"
    ]);
    assert.equal(
      await readPendingText(repositoryRoot, "outside/keep.md"),
      "outside pending\n"
    );
    assert.equal(
      await fs.readFile(path.join(repositoryRoot, defaultTaskGraphIndexPath), "utf8"),
      fixture.candidateText
    );
  });
});

test("forms separate commits from concurrent task changes without modifying the workspace index", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
    candidate = updateTitle(candidate, "task-000002", "bravo workspace");
    const fixture = await createRepositoryFixture({ baseline, candidate, repositoryRoot });
    const service = new TaskGraphService({ root: repositoryRoot });

    await service.stageTasks(["task-000001"]);
    const firstPending = await readPendingTaskIndex(repositoryRoot);
    assert.equal(firstPending.tasks["task-000001"]!.content.title, "alpha workspace");
    assert.equal(
      firstPending.tasks["task-000002"]!.content.title,
      baseline.tasks["task-000002"]!.content.title
    );
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "stage alpha"]);
    assert.equal(
      await fs.readFile(path.join(repositoryRoot, defaultTaskGraphIndexPath), "utf8"),
      fixture.candidateText
    );

    await service.stageTasks(["task-000002"]);
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "stage bravo"]);
    const firstCommit = parseTaskIndex(JSON.parse(runGit(
      repositoryRoot,
      ["show", `HEAD^:${defaultTaskGraphIndexPath}`]
    )) as unknown);
    const secondCommit = parseTaskIndex(JSON.parse(runGit(
      repositoryRoot,
      ["show", `HEAD:${defaultTaskGraphIndexPath}`]
    )) as unknown);
    assert.equal(firstCommit.revision, candidate.revision);
    assert.equal(secondCommit.revision, candidate.revision);
    assert.equal(firstCommit.tasks["task-000001"]!.content.title, "alpha workspace");
    assert.equal(
      firstCommit.tasks["task-000002"]!.content.title,
      baseline.tasks["task-000002"]!.content.title
    );
    assert.deepEqual(secondCommit, candidate);
    assert.equal(runGit(repositoryRoot, ["status", "--porcelain"]), "");
  });
});

test("stages selected task additions and deletions with monotonic root watermarks", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    let candidate = applyOperations(baseline, [taskOperation("charlie", {
      title: "charlie workspace"
    })]);
    candidate = cancelTask(candidate, {
      taskId: "task-000002",
      expectedRevision: candidate.revision,
      reason: "remove obsolete task"
    }, new Date(initialNow.valueOf() + 1_000)).index;
    candidate = removeTaskEntries(candidate, {
      taskIds: ["task-000002"],
      expectedRevision: candidate.revision,
      resultsDelivered: true
    }).index;
    await createRepositoryFixture({ baseline, candidate, repositoryRoot });

    await new TaskGraphService({ root: repositoryRoot }).stageTasks([
      "task-000003",
      "task-000002"
    ]);
    const pending = await readPendingTaskIndex(repositoryRoot);
    assert.deepEqual(pending, candidate);
    assert.equal(pending.nextTaskId, 4);
    assert.equal(pending.revision, 4);
    assert.deepEqual(Object.keys(pending.tasks), ["task-000001", "task-000003"]);
  });
});

test("rejects a selected task set that breaks relation closure without changing pending content", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    const candidate = applyOperations(baseline, [{
      kind: "set-exclusion",
      taskId: "task-000001",
      excludedTaskId: "task-000002",
      present: true
    }]);
    const fixture = await createRepositoryFixture({ baseline, candidate, repositoryRoot });

    const error = await expectTaskGraphRejection(
      async () => await new TaskGraphService({ root: repositoryRoot }).stageTasks([
        "task-000001"
      ]),
      "TOPOLOGY_INVALID"
    );

    assert.deepEqual(error.details.selectedTaskIds, ["task-000001"]);
    assert.deepEqual(await readPendingTaskIndex(repositoryRoot), baseline);
    assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
    assert.equal(
      await fs.readFile(path.join(repositoryRoot, defaultTaskGraphIndexPath), "utf8"),
      fixture.candidateText
    );
  });
});

test("serializes concurrent selected-task staging without overwriting the winning batch", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
    candidate = updateTitle(candidate, "task-000002", "bravo workspace");
    await createRepositoryFixture({ baseline, candidate, repositoryRoot });

    const settled = await Promise.allSettled([
      new TaskGraphService({ root: repositoryRoot }).stageTasks(["task-000001"]),
      new TaskGraphService({ root: repositoryRoot }).stageTasks(["task-000002"])
    ]);
    const fulfilled = settled.filter((result) => result.status === "fulfilled");
    const rejected = settled.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const reason = rejected[0]?.reason as unknown;
    assert.ok(reason instanceof TaskGraphError);
    assert.equal(reason.code, "REVISION_CONFLICT");

    const selectedTaskId = fulfilled[0]?.status === "fulfilled"
      ? fulfilled[0].value.data.selectedTaskIds[0]
      : undefined;
    assert.ok(selectedTaskId === "task-000001" || selectedTaskId === "task-000002");
    const otherTaskId = selectedTaskId === "task-000001"
      ? "task-000002"
      : "task-000001";
    const pending = await readPendingTaskIndex(repositoryRoot);
    assert.equal(
      pending.tasks[selectedTaskId]!.content.title,
      candidate.tasks[selectedTaskId]!.content.title
    );
    assert.equal(
      pending.tasks[otherTaskId]!.content.title,
      baseline.tasks[otherTaskId]!.content.title
    );
  });
});

test("index stage exposes stable text and explicit JSON protocols without native runtime", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
    candidate = updateTitle(candidate, "task-000002", "bravo workspace");
    await createRepositoryFixture({ baseline, candidate, repositoryRoot });

    const textCall = await callCli(repositoryRoot, [
      "index", "stage", "--task", "task-000001"
    ]);
    assert.equal(textCall.exitCode, 0);
    assert.equal(
      textCall.output,
      "TASK INDEX STAGE state=staged revision=3 tasks=2 next-task-id=3 "
        + "selected=[\"task-000001\"]\n"
    );

    resetPendingPath(repositoryRoot);
    const jsonCall = await callCli(repositoryRoot, [
      "index", "stage", "--task", "task-000002", "--json"
    ]);
    assert.equal(jsonCall.exitCode, 0);
    const jsonResult = JSON.parse(jsonCall.output) as {
      ok: boolean;
      revision: number;
      data: unknown;
    };
    assert.equal(jsonResult.ok, true);
    assert.equal(jsonResult.revision, candidate.revision);
    assert.deepEqual(jsonResult.data, {
      changed: true,
      nextTaskId: 3,
      selectedTaskIds: ["task-000002"],
      state: "staged",
      taskCount: 2
    });

    resetPendingPath(repositoryRoot);
    const failureCall = await callCli(repositoryRoot, [
      "index", "stage", "--task", "task-000001", "--task", "task-000001"
    ]);
    assert.equal(failureCall.exitCode, 1);
    assert.equal(
      failureCall.output,
      "TASK INDEX STAGE failed code=ARGUMENT_INVALID retryable=false "
        + "message=\"Selected task id task-000001 appears more than once\"\n"
    );
    assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
  });
});

test("rejects a noncanonical workspace index before changing pending content", testOptions, async () => {
  await withTempWorkspace(async (repositoryRoot) => {
    const baseline = baseIndex();
    const candidate = updateTitle(baseline, "task-000001", "alpha workspace");
    await createRepositoryFixture({ baseline, candidate, repositoryRoot });
    await fs.writeFile(
      path.join(repositoryRoot, defaultTaskGraphIndexPath),
      JSON.stringify(candidate),
      "utf8"
    );

    const error = await expectTaskGraphRejection(
      async () => await new TaskGraphService({ root: repositoryRoot }).stageTasks([
        "task-000001"
      ]),
      "INDEX_INVALID"
    );
    assert.equal(error.details.source, "workspace");
    assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
  });
});

function baseIndex(): TaskIndex {
  return graphIndex([
    taskOperation("alpha", { title: "alpha baseline" }),
    taskOperation("bravo", { title: "bravo baseline" })
  ]);
}

function updateTitle(index: TaskIndex, taskId: string, title: string): TaskIndex {
  return applyOperations(index, [{
    kind: "update-task-content",
    taskId,
    content: taskContent(title)
  }]);
}

async function createRepositoryFixture(options: {
  baseline: TaskIndex;
  candidate: TaskIndex;
  repositoryRoot: string;
  stageOutside?: boolean;
}): Promise<RepositoryFixture> {
  initializeRepository(options.repositoryRoot);
  await writeFile(
    options.repositoryRoot,
    defaultTaskGraphIndexPath,
    serializeTaskIndex(options.baseline)
  );
  await writeFile(options.repositoryRoot, "outside/keep.md", "outside baseline\n");
  runGit(options.repositoryRoot, ["add", "."]);
  runGit(options.repositoryRoot, ["commit", "--quiet", "--message", "base"]);

  const candidateText = serializeTaskIndex(options.candidate);
  await writeFile(options.repositoryRoot, defaultTaskGraphIndexPath, candidateText);
  if (options.stageOutside === true) {
    await writeFile(options.repositoryRoot, "outside/keep.md", "outside pending\n");
    runGit(options.repositoryRoot, ["add", "outside/keep.md"]);
  }
  return {
    candidate: options.candidate,
    candidateText,
    repositoryRoot: options.repositoryRoot
  };
}

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "task-stage@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Task Stage Test"]);
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

async function writeFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(rootDirectory, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

async function readPendingTaskIndex(repositoryRoot: string): Promise<TaskIndex> {
  return parseTaskIndex(JSON.parse(await readPendingText(
    repositoryRoot,
    defaultTaskGraphIndexPath
  )) as unknown);
}

async function readPendingText(
  repositoryRoot: string,
  filePath: string
): Promise<string> {
  const files = await (await openVersionControl(repositoryRoot)).readPendingFiles({
    pathScopes: [filePath]
  });
  assert.equal(files.length, 1);
  return Buffer.from(files[0]!.data).toString("utf8");
}

async function pendingChangedPaths(repositoryRoot: string): Promise<string[]> {
  const repository = await openVersionControl(repositoryRoot);
  const revision = await repository.getCurrentRevision();
  assert.notEqual(revision, null);
  return await repository.listPendingChangedPaths({ from: revision! });
}

function resetPendingPath(repositoryRoot: string): void {
  runGit(repositoryRoot, ["reset", "--quiet", "HEAD", "--", defaultTaskGraphIndexPath]);
}

async function callCli(
  repositoryRoot: string,
  args: string[]
): Promise<{ exitCode: number; output: string }> {
  const chunks: string[] = [];
  const exitCode = await runTaskGraphCli(["--root", repositoryRoot, ...args], {
    io: { stdout: (text) => chunks.push(text) }
  });
  assert.equal(chunks.length, 1);
  return { exitCode, output: chunks[0]! };
}
