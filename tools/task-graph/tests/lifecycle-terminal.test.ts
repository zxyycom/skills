import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelTask,
  completeTask,
  failTask,
  projectTaskGraph,
  retryTask
} from "../src/index.ts";
import {
  applyOperations,
  expectTaskGraphError,
  graphIndex,
  initialNow,
  taskContent,
  taskOperation
} from "./helpers.ts";
import { claim, leaseUuidB } from "./lifecycle-test-support.ts";

test("failure retry preserves attempts and terminal tasks cannot reopen", () => {
  let index = graphIndex([
    taskOperation("work", { control: { mode: "queued" } })
  ]);
  const firstClaim = claim(index, "task-000001");
  index = failTask(
    firstClaim.index,
    {
      taskId: "task-000001",
      leaseId: firstClaim.data.leaseId,
      reason: "first attempt failed"
    },
    initialNow
  ).index;
  assert.equal(index.tasks["task-000001"]!.state.execution.attempt, 1);
  index = retryTask(
    index,
    {
      taskId: "task-000001",
      expectedRevision: index.revision
    },
    initialNow
  ).index;
  const secondClaim = claim(index, "task-000001", leaseUuidB);
  assert.equal(
    secondClaim.index.tasks["task-000001"]!.state.execution.attempt,
    2
  );
  const completed = completeTask(
    secondClaim.index,
    {
      taskId: "task-000001",
      leaseId: secondClaim.data.leaseId,
      result: { summary: "done", references: {} }
    },
    initialNow
  ).index;

  expectTaskGraphError(
    () =>
      applyOperations(completed, [
        {
          kind: "update-task-content",
          taskId: "task-000001",
          content: taskContent("rewritten")
        }
      ]),
    "STATE_CONFLICT"
  );
  expectTaskGraphError(
    () =>
      applyOperations(completed, [
        {
          kind: "update-task-control",
          taskId: "task-000001",
          control: { mode: "queued" }
        }
      ]),
    "STATE_CONFLICT"
  );
  expectTaskGraphError(
    () =>
      retryTask(
        completed,
        {
          taskId: "task-000001",
          expectedRevision: completed.revision
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );

  let cancelled = graphIndex([taskOperation("cancelled")]);
  cancelled = cancelTask(
    cancelled,
    {
      taskId: "task-000001",
      expectedRevision: cancelled.revision,
      reason: "cancelled"
    },
    initialNow
  ).index;
  expectTaskGraphError(
    () =>
      applyOperations(cancelled, [
        {
          kind: "update-task-content",
          taskId: "task-000001",
          content: taskContent("reopened cancelled task")
        }
      ]),
    "STATE_CONFLICT"
  );
});

test("ancestor control changes cannot alter a running descendant effective control", () => {
  let inherited = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", { parentId: "@parent" })
  ]);
  inherited = claim(inherited, "task-000002").index;
  expectTaskGraphError(
    () =>
      applyOperations(inherited, [
        {
          kind: "update-task-control",
          taskId: "task-000001",
          control: { mode: "paused", reason: "pause parent" }
        }
      ]),
    "STATE_CONFLICT"
  );

  let overridden = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", {
      parentId: "@parent",
      control: { mode: "queued" }
    })
  ]);
  overridden = claim(overridden, "task-000002").index;
  const changed = applyOperations(overridden, [
    {
      kind: "update-task-control",
      taskId: "task-000001",
      control: { mode: "paused", reason: "pause parent" }
    }
  ]);
  assert.equal(
    projectTaskGraph(changed, initialNow).tasks["task-000002"]!.effectiveControl
      .sourceTaskId,
    "task-000002"
  );
});
