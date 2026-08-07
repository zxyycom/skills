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
  claimTask,
  closeScopes,
  failTask,
  scopeCloseProjection
} from "../src/index.ts";
import { runTaskGraphCli, type TaskGraphResult } from "../src/cli.ts";
import {
  applyOperations,
  expectTaskGraphError,
  expectTaskGraphRejection,
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

test("scope close projection reports terminal, failed, active, and recovery blockers", async () => {
  let index = applyOperations(graphIndex([
    taskOperation("candidate")
  ]), [
    { kind: "create-scope", key: "failed-scope" },
    {
      kind: "create-task",
      scopeId: "scope-000002",
      content: taskContent("failed"),
      control: { mode: "queued" }
    },
    { kind: "create-scope", key: "active-scope" },
    {
      kind: "create-task",
      scopeId: "scope-000003",
      content: taskContent("active"),
      control: { mode: "queued" }
    },
    { kind: "create-scope", key: "expired-scope" },
    {
      kind: "create-task",
      scopeId: "scope-000004",
      content: taskContent("expired"),
      control: { mode: "queued" }
    },
    { kind: "create-scope", key: "closable-scope" },
    {
      kind: "create-task",
      scopeId: "scope-000005",
      content: taskContent("cancelled")
    }
  ]);
  const failedClaim = claimTask(index, {
    scopeId: "scope-000002",
    taskId: "task-000002",
    actor: "worker",
    leaseUuid: "00000000-0000-4000-8000-000000000201"
  }, initialNow);
  index = failTask(failedClaim.index, {
    scopeId: "scope-000002",
    taskId: "task-000002",
    leaseId: failedClaim.data.leaseId,
    reason: "failed"
  }, initialNow).index;
  index = claimTask(index, {
    scopeId: "scope-000003",
    taskId: "task-000003",
    actor: "worker",
    leaseUuid: "00000000-0000-4000-8000-000000000202",
    durationSeconds: 3600
  }, initialNow).index;
  index = claimTask(index, {
    scopeId: "scope-000004",
    taskId: "task-000004",
    actor: "worker",
    leaseUuid: "00000000-0000-4000-8000-000000000203"
  }, initialNow).index;
  index = cancelTask(index, {
    scopeId: "scope-000005",
    taskId: "task-000005",
    expectedRevision: index.revision,
    reason: "done"
  }, initialNow).index;

  const projectedAt = new Date("2026-08-06T08:31:00.000Z");
  const projections = Object.fromEntries(Object.keys(index.scopes).map((scopeId) => [
    scopeId,
    scopeCloseProjection(index, scopeId, projectedAt)
  ]));
  assert.ok(projections["scope-000001"]!.blockers.some((item) =>
    item.kind === "top-task-not-terminal"
  ));
  assert.ok(projections["scope-000002"]!.blockers.some((item) =>
    item.kind === "failed-task"
  ));
  assert.ok(projections["scope-000003"]!.blockers.some((item) =>
    item.kind === "active-lease"
  ));
  assert.ok(projections["scope-000004"]!.blockers.some((item) =>
    item.kind === "recovery-needed"
  ));
  assert.equal(projections["scope-000005"]!.closable, true);

  expectTaskGraphError(() => closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: ["scope-000005"],
    resultsDelivered: false as unknown as true
  }, initialNow), "DELIVERY_NOT_CONFIRMED");
  const closed = closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: ["scope-000005"],
    resultsDelivered: true
  }, initialNow);
  assert.equal(closed.index.scopes["scope-000005"], undefined);

  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      leaseIdGenerator: uuidSequence(4001),
      loadNativeLock: loadUncontendedNativeLock,
      lockRoot: path.join(root, "test-locks")
    });
    await service.init();
    const scope = await service.apply({
      expectedRevision: 0,
      operations: [{
        kind: "create-scope",
        key: "service-close",
        bindings: { thread: "supported" }
      }]
    });
    const scopeId = scope.data.createdScopeIds[0] ?? "";
    assert.deepEqual((await service.listScopes({
      bindingKind: "thread",
      bindingValue: "supported"
    })).data[scopeId]?.bindings, { thread: "supported" });
    assert.equal((await service.listScopes()).data[scopeId]?.close.closable, true);
    await expectTaskGraphRejection(
      () => service.listScopes({ bindingKind: "thread" } as never),
      "ARGUMENT_INVALID"
    );
    await expectTaskGraphRejection(
      () => service.listScopes({ bindingValue: "supported" } as never),
      "ARGUMENT_INVALID"
    );
    const task = await service.apply({
      expectedRevision: scope.revision,
      operations: [{
        kind: "create-task",
        scopeId,
        content: taskContent("service close")
      }]
    });
    const taskId = task.data.createdTaskIds[0] ?? "";
    const cancelled = await service.cancel({
      expectedRevision: task.revision,
      scopeId,
      taskId,
      reason: "settled"
    });
    await expectTaskGraphRejection(
      () => service.closeScopes({
        expectedRevision: cancelled.revision,
        scopeIds: [scopeId],
        resultsDelivered: false
      } as never),
      "DELIVERY_NOT_CONFIRMED"
    );
    await expectTaskGraphRejection(
      () => service.closeScopes({
        expectedRevision: cancelled.revision,
        scopeIds: [scopeId]
      } as never),
      "DELIVERY_NOT_CONFIRMED"
    );
    assert.ok((await service.readIndex()).data.scopes[scopeId]);
  });
});

test("bulk scope close validates all selections before one revision and preserves nextIds", () => {
  let index = applyOperations(graphIndex([
    taskOperation("first")
  ]), [
    { kind: "create-scope", key: "second" },
    {
      kind: "create-task",
      scopeId: "scope-000002",
      content: taskContent("second")
    },
    { kind: "create-scope", key: "blocked" },
    {
      kind: "create-task",
      scopeId: "scope-000003",
      content: taskContent("blocked")
    }
  ]);
  index = cancelTask(index, {
    scopeId: "scope-000001",
    taskId: "task-000001",
    expectedRevision: index.revision,
    reason: "delivered"
  }, initialNow).index;
  index = cancelTask(index, {
    scopeId: "scope-000002",
    taskId: "task-000002",
    expectedRevision: index.revision,
    reason: "delivered"
  }, initialNow).index;
  const before = structuredClone(index);
  expectTaskGraphError(() => closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: ["scope-000001", "scope-000003"],
    resultsDelivered: true
  }, initialNow), "SCOPE_NOT_CLOSABLE");
  assert.deepEqual(index, before);

  const closed = closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: ["scope-000002", "scope-000001"],
    resultsDelivered: true
  }, initialNow);
  assert.deepEqual(closed.data.closedScopeIds, ["scope-000001", "scope-000002"]);
  assert.equal(closed.index.revision, index.revision + 1);
  assert.deepEqual(closed.index.nextIds, index.nextIds);
  assert.deepEqual(Object.keys(closed.index.scopes), ["scope-000003"]);
  expectTaskGraphError(() => closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: [],
    resultsDelivered: true
  }, initialNow), "ARGUMENT_INVALID");
  expectTaskGraphError(() => closeScopes(index, {
    expectedRevision: index.revision,
    scopeIds: ["scope-000001", "scope-000001"],
    resultsDelivered: true
  }, initialNow), "ARGUMENT_INVALID");
});

test("CLI exposes scope-only cleanup and no single-task deletion command", async () => {
  await withTempWorkspace(async (root) => {
    const chunks: string[] = [];
    const exitCode = await runTaskGraphCli([
      "--root", root,
      "task", "delete", "scope-000001", "task-000001"
    ], { io: { stdout: (text) => chunks.push(text) } });
    assert.equal(exitCode, 1);
    assert.equal(chunks.length, 1);
    const result = JSON.parse(chunks[0]!) as TaskGraphResult;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ARGUMENT_INVALID");
    }
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
      operations: [{ kind: "create-scope", key: "git-boundary" }]
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
