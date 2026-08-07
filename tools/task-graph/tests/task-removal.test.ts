import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  TaskGraphService,
  cancelTask,
  removeTasks
} from "../src/index.ts";
import { runTaskGraphCli, type TaskGraphResult } from "../src/cli.ts";
import {
  applyOperations,
  expectTaskGraphError,
  graphIndex,
  initialNow,
  loadUncontendedNativeLock,
  taskContent,
  taskOperation,
  uuidSequence,
  withTempWorkspace
} from "./helpers.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

function cancel(index: ReturnType<typeof graphIndex>, taskId: string) {
  return cancelTask(index, {
    taskId,
    expectedRevision: index.revision,
    reason: "test cleanup"
  }, initialNow).index;
}

function removalFixture() {
  let index = graphIndex([
    taskOperation("parent"),
    taskOperation("child", { parentId: "@parent" }),
    taskOperation("dependency"),
    taskOperation("dependent"),
    taskOperation("excluded-left"),
    taskOperation("excluded-right"),
    taskOperation("idle")
  ]);
  index = applyOperations(index, [
    {
      kind: "set-dependency",
      taskId: "task-000004",
      dependencyId: "task-000003",
      present: true
    },
    {
      kind: "set-exclusion",
      taskId: "task-000005",
      excludedTaskId: "task-000006",
      present: true
    }
  ]);
  index = cancel(index, "task-000001");
  index = cancel(index, "task-000003");
  index = cancel(index, "task-000004");
  index = cancel(index, "task-000005");
  return cancel(index, "task-000006");
}

test("task removal reports terminal and graph-boundary blockers without mutation", () => {
  const index = removalFixture();
  const before = structuredClone(index);
  const selections = [
    ["task-000007", "task-not-terminal"],
    ["task-000002", "parent-crosses-selection"],
    ["task-000001", "child-crosses-selection"],
    ["task-000003", "dependency-crosses-selection"],
    ["task-000005", "exclusion-crosses-selection"]
  ] as const;

  for (const [taskId, blockerKind] of selections) {
    const error = expectTaskGraphError(() => removeTasks(index, {
      expectedRevision: index.revision,
      taskIds: [taskId],
      resultsDelivered: true
    }), "TASKS_NOT_REMOVABLE");
    const blockers = error.details.blockers as unknown as Array<{ kind: string }>;
    assert.ok(blockers.some((blocker) => blocker.kind === blockerKind));
    assert.deepEqual(index, before);
  }
});

test("bulk task removal is atomic, explicit, and preserves monotonic allocation", () => {
  const index = removalFixture();
  const nextTaskId = index.nextTaskId;
  const removed = removeTasks(index, {
    expectedRevision: index.revision,
    taskIds: ["task-000002", "task-000001"],
    resultsDelivered: true
  });
  assert.deepEqual(removed.data.removedTaskIds, ["task-000001", "task-000002"]);
  assert.equal(removed.index.revision, index.revision + 1);
  assert.equal(removed.index.nextTaskId, nextTaskId);
  assert.equal(removed.index.tasks["task-000001"], undefined);
  assert.equal(removed.index.tasks["task-000002"], undefined);

  expectTaskGraphError(() => removeTasks(index, {
    expectedRevision: index.revision,
    taskIds: [],
    resultsDelivered: true
  }), "ARGUMENT_INVALID");
  expectTaskGraphError(() => removeTasks(index, {
    expectedRevision: index.revision,
    taskIds: ["task-000001", "task-000001"],
    resultsDelivered: true
  }), "ARGUMENT_INVALID");
  expectTaskGraphError(() => removeTasks(index, {
    expectedRevision: index.revision,
    taskIds: ["task-000001", "task-000002"],
    resultsDelivered: false
  } as never), "DELIVERY_NOT_CONFIRMED");
});

test("CLI exposes batch task removal and no scope command", async () => {
  await withTempWorkspace(async (root) => {
    const helpChunks: string[] = [];
    const helpExit = await runTaskGraphCli([
      "--root", root,
      "--help"
    ], { io: { stdout: (text) => helpChunks.push(text) } });
    assert.equal(helpExit, 0);
    const help = JSON.parse(helpChunks[0]!) as TaskGraphResult<{
      commands: string[];
    }>;
    assert.equal(help.ok, true);
    if (help.ok) {
      assert.ok(help.data.commands.includes("task remove"));
      assert.equal(help.data.commands.some((command) => command.startsWith("scope ")), false);
    }

    const scopeChunks: string[] = [];
    const scopeExit = await runTaskGraphCli([
      "--root", root,
      "scope", "list"
    ], { io: { stdout: (text) => scopeChunks.push(text) } });
    assert.equal(scopeExit, 1);
    const scopeResult = JSON.parse(scopeChunks[0]!) as TaskGraphResult;
    assert.equal(scopeResult.ok, false);
    if (!scopeResult.ok) assert.equal(scopeResult.error.code, "ARGUMENT_INVALID");
  });
});

test("task index mutations leave Git staging, commits, and ignore policy caller-owned", async () => {
  await withTempWorkspace(async (root) => {
    await fs.copyFile(
      path.join(repositoryRoot, ".gitignore"),
      path.join(root, ".gitignore")
    );
    await execFileAsync("git", ["init"], { cwd: root, windowsHide: true });
    await execFileAsync("git", ["config", "user.name", "Task Graph Test"], {
      cwd: root,
      windowsHide: true
    });
    await execFileAsync("git", ["config", "user.email", "task-graph@example.invalid"], {
      cwd: root,
      windowsHide: true
    });
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      leaseIdGenerator: uuidSequence(1),
      loadNativeLock: loadUncontendedNativeLock
    });
    await service.init();
    await execFileAsync("git", [
      "add",
      ".gitignore",
      "docs/task-graph/task-graph-index.json"
    ], {
      cwd: root,
      windowsHide: true
    });
    await execFileAsync("git", ["commit", "-m", "baseline"], {
      cwd: root,
      windowsHide: true
    });
    const beforeHead = (await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    })).stdout.trim();
    await service.apply({
      expectedRevision: 0,
      operations: [{ kind: "create-task", content: taskContent("git boundary") }]
    });

    await fs.writeFile(`${service.store.indexPath}.tmp-test`, "temporary\n", "utf8");
    const status = (await execFileAsync(
      "git",
      ["status", "--porcelain=v1", "--ignored"],
      { cwd: root, encoding: "utf8", windowsHide: true }
    )).stdout.replaceAll("\\", "/");
    assert.match(status, /^ M docs\/task-graph\/task-graph-index\.json$/mu);
    assert.doesNotMatch(status, /^M  docs\/task-graph\/task-graph-index\.json$/mu);
    assert.match(status, /^\?\? docs\/task-graph\/task-graph-index\.json\.tmp-test$/mu);
    assert.doesNotMatch(status, /docs\/task-graph\/\.gitignore/u);
    await assert.rejects(fs.stat(`${service.store.indexPath}.lock`), { code: "ENOENT" });
    const afterHead = (await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    })).stdout.trim();
    assert.equal(afterHead, beforeHead);
    await fs.unlink(service.store.lockPath);
  });
});
