import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  TaskGraphService,
  defaultTaskGraphIndexPath,
  parseTaskIndex
} from "../src/cli.ts";
import {
  applyOperations,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";
import {
  baseIndex,
  createRepositoryFixture,
  pendingChangedPaths,
  readPendingTaskIndex,
  readPendingText,
  runGit,
  updateTitle
} from "./staging-test-support.ts";

const testOptions = { timeout: 20_000 };

test(
  "stages selected tasks with candidate watermarks while preserving workspace and outside pending paths",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
      candidate = applyOperations(candidate, [
        taskOperation("charlie", {
          title: "charlie workspace"
        })
      ]);
      const fixture = await createRepositoryFixture({
        baseline,
        candidate,
        repositoryRoot,
        stageOutside: true
      });

      const staged = await new TaskGraphService({
        root: repositoryRoot
      }).stageTaskIndex(["task-000001"]);

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
      assert.deepEqual(Object.keys(pending.tasks), [
        "task-000001",
        "task-000002"
      ]);
      assert.equal(
        pending.tasks["task-000001"]!.content.title,
        "alpha workspace"
      );
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
        await fs.readFile(
          path.join(repositoryRoot, defaultTaskGraphIndexPath),
          "utf8"
        ),
        fixture.candidateText
      );
    });
  }
);

test(
  "forms separate commits from concurrent task changes without modifying the workspace index",
  testOptions,
  async () => {
    await withTempWorkspace(async (repositoryRoot) => {
      const baseline = baseIndex();
      let candidate = updateTitle(baseline, "task-000001", "alpha workspace");
      candidate = updateTitle(candidate, "task-000002", "bravo workspace");
      const fixture = await createRepositoryFixture({
        baseline,
        candidate,
        repositoryRoot
      });
      const service = new TaskGraphService({ root: repositoryRoot });

      await service.stageTaskIndex(["task-000001"]);
      const firstPending = await readPendingTaskIndex(repositoryRoot);
      assert.equal(
        firstPending.tasks["task-000001"]!.content.title,
        "alpha workspace"
      );
      assert.equal(
        firstPending.tasks["task-000002"]!.content.title,
        baseline.tasks["task-000002"]!.content.title
      );
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "stage alpha"]);
      assert.equal(
        await fs.readFile(
          path.join(repositoryRoot, defaultTaskGraphIndexPath),
          "utf8"
        ),
        fixture.candidateText
      );

      await service.stageTaskIndex(["task-000002"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "stage bravo"]);
      const firstCommit = parseTaskIndex(
        JSON.parse(
          runGit(repositoryRoot, ["show", `HEAD^:${defaultTaskGraphIndexPath}`])
        ) as unknown
      );
      const secondCommit = parseTaskIndex(
        JSON.parse(
          runGit(repositoryRoot, ["show", `HEAD:${defaultTaskGraphIndexPath}`])
        ) as unknown
      );
      assert.equal(firstCommit.revision, candidate.revision);
      assert.equal(secondCommit.revision, candidate.revision);
      assert.equal(
        firstCommit.tasks["task-000001"]!.content.title,
        "alpha workspace"
      );
      assert.equal(
        firstCommit.tasks["task-000002"]!.content.title,
        baseline.tasks["task-000002"]!.content.title
      );
      assert.deepEqual(secondCommit, candidate);
      assert.equal(runGit(repositoryRoot, ["status", "--porcelain"]), "");
    });
  }
);
