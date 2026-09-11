import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  TaskGraphService,
  cancelTask,
  defaultTaskGraphIndexPath,
  removeTasks as removeTaskEntries,
  serializeTaskIndex
} from "../src/cli.ts";
import {
  applyOperations,
  expectTaskGraphRejection,
  graphIndex,
  initialNow,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";
import {
  baseIndex,
  createRepositoryFixture,
  initializeRepository,
  pendingChangedPaths,
  readPendingTaskIndex,
  runGit,
  writeFile
} from "./staging-test-support.ts";

const testOptions = { timeout: 20_000 };

test(
  "stages selected task additions and deletions with monotonic root watermarks",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      let candidate = applyOperations(baseline, [
        taskOperation("charlie", {
          title: "charlie workspace"
        })
      ]);
      candidate = cancelTask(
        candidate,
        {
          taskId: "task-000002",
          expectedRevision: candidate.revision,
          reason: "remove obsolete task"
        },
        new Date(initialNow.valueOf() + 1_000)
      ).index;
      candidate = removeTaskEntries(candidate, {
        taskIds: ["task-000002"],
        expectedRevision: candidate.revision,
        resultsDelivered: true
      }).index;
      await createRepositoryFixture({ baseline, candidate, repositoryRoot });

      await new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
        "task-000003",
        "task-000002"
      ]);
      const pending = await readPendingTaskIndex(repositoryRoot);
      assert.deepEqual(pending, candidate);
      assert.equal(pending.nextTaskId, 4);
      assert.equal(pending.revision, 4);
      assert.deepEqual(Object.keys(pending.tasks), [
        "task-000001",
        "task-000003"
      ]);
    });
  }
);

test(
  "stages a new task index from an empty HEAD baseline",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "outside/keep.md", "outside baseline\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, [
        "commit",
        "--quiet",
        "--message",
        "base without index"
      ]);
      const candidate = graphIndex([
        taskOperation("alpha", { title: "alpha workspace" })
      ]);
      await writeFile(
        repositoryRoot,
        defaultTaskGraphIndexPath,
        serializeTaskIndex(candidate)
      );

      await new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
        "task-000001"
      ]);

      assert.deepEqual(await readPendingTaskIndex(repositoryRoot), candidate);
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), [
        defaultTaskGraphIndexPath
      ]);
    });
  }
);

test(
  "rejects regressing workspace watermarks without changing pending content",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      const candidate = {
        ...structuredClone(baseline),
        revision: baseline.revision - 1
      };
      await createRepositoryFixture({ baseline, candidate, repositoryRoot });

      const error = await expectTaskGraphRejection(
        async () =>
          await new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
            "task-000001"
          ]),
        "REVISION_CONFLICT"
      );

      assert.equal(error.retryable, true);
      assert.equal(error.details.baselineRevision, baseline.revision);
      assert.equal(error.details.workspaceRevision, candidate.revision);
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
    });
  }
);

test(
  "rejects a selected task set that breaks relation closure without changing pending content",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      const candidate = applyOperations(baseline, [
        {
          kind: "set-exclusion",
          taskId: "task-000001",
          excludedTaskId: "task-000002",
          present: true
        }
      ]);
      const fixture = await createRepositoryFixture({
        baseline,
        candidate,
        repositoryRoot
      });

      const error = await expectTaskGraphRejection(
        async () =>
          await new TaskGraphService({ root: repositoryRoot }).stageTaskIndex([
            "task-000001"
          ]),
        "TOPOLOGY_INVALID"
      );

      assert.deepEqual(error.details.selectedTaskIds, ["task-000001"]);
      assert.deepEqual(await readPendingTaskIndex(repositoryRoot), baseline);
      assert.deepEqual(await pendingChangedPaths(repositoryRoot), []);
      assert.equal(
        await fs.readFile(
          path.join(repositoryRoot, defaultTaskGraphIndexPath),
          "utf8"
        ),
        fixture.candidateText
      );
    });
  }
);
