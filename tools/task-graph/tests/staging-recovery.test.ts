import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  TaskGraphError,
  TaskGraphService,
  defaultTaskGraphIndexPath,
  serializeTaskIndex
} from "../src/cli.ts";
import { expectTaskGraphRejection, withTempWorkspace } from "./helpers.ts";
import {
  baseIndex,
  callCli,
  createRepositoryFixture,
  pendingChangedPaths,
  readPendingTaskIndex,
  resetPendingPath,
  updateTitle
} from "./staging-test-support.ts";

const testOptions = { timeout: 20_000 };

test(
  "serializes concurrent selected-task staging without overwriting the winning batch",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
      candidate = updateTitle(candidate, "task-000002", "bravo workspace");
      await createRepositoryFixture({ baseline, candidate, repositoryRoot });

      const settled = await Promise.allSettled([
        new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
          "task-000001"
        ]),
        new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
          "task-000002"
        ])
      ]);
      const fulfilled = settled.filter(
        (result) => result.status === "fulfilled"
      );
      const rejected = settled.filter((result) => result.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      const reason = rejected[0]?.reason as unknown;
      assert.ok(reason instanceof TaskGraphError);
      assert.equal(reason.code, "REVISION_CONFLICT");
      assert.equal(reason.retryable, true);

      const selectedTaskId =
        fulfilled[0]?.status === "fulfilled"
          ? fulfilled[0].value.data.selectedTaskIds[0]
          : undefined;
      assert.ok(
        selectedTaskId === "task-000001" || selectedTaskId === "task-000002"
      );
      const otherTaskId =
        selectedTaskId === "task-000001" ? "task-000002" : "task-000001";
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
  }
);

test(
  "index stage exposes stable text and explicit JSON protocols without native runtime",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
      candidate = updateTitle(candidate, "task-000002", "bravo workspace");
      await createRepositoryFixture({ baseline, candidate, repositoryRoot });

      const textCall = await callCli(repositoryRoot, [
        "index",
        "stage",
        "--task",
        "task-000001"
      ]);
      assert.equal(textCall.exitCode, 0);
      assert.equal(
        textCall.output,
        "TASK INDEX STAGE state=staged revision=3 task-count=2 next-task-id=3 " +
          'selected-task-ids=["task-000001"]\n'
      );

      resetPendingPath(repositoryRoot);
      const jsonCall = await callCli(repositoryRoot, [
        "index",
        "stage",
        "--task",
        "task-000002",
        "--json"
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
        "index",
        "stage",
        "--task",
        "task-000001",
        "--task",
        "task-000001"
      ]);
      assert.equal(failureCall.exitCode, 1);
      assert.equal(
        failureCall.output,
        "TASK INDEX STAGE failed code=ARGUMENT_INVALID retryable=false " +
          'message="Selected task id task-000001 appears more than once"\n'
      );
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);

      await fs.writeFile(
        path.join(repositoryRoot, defaultTaskGraphIndexPath),
        serializeTaskIndex(baseline),
        "utf8"
      );
      const unchangedCall = await callCli(repositoryRoot, [
        "index",
        "stage",
        "--task",
        "task-000001"
      ]);
      assert.equal(unchangedCall.exitCode, 0);
      assert.equal(
        unchangedCall.output,
        "TASK INDEX STAGE state=unchanged revision=1 task-count=2 next-task-id=3 " +
          'selected-task-ids=["task-000001"]\n'
      );
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
    });
  }
);

test(
  "rejects a noncanonical workspace index before changing pending content",
  testOptions,
  async () => {
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
        async () =>
          await new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
            "task-000001"
          ]),
        "INDEX_INVALID"
      );
      assert.equal(error.details.source, "workspace");
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
    });
  }
);
