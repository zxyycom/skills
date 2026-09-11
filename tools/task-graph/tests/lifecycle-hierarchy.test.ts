import assert from "node:assert/strict";
import test from "node:test";
import { cancelTask, completeTask, projectTaskGraph } from "../src/index.ts";
import {
  expectTaskGraphError,
  graphIndex,
  initialNow,
  taskOperation
} from "./helpers.ts";
import { claim } from "./lifecycle-test-support.ts";

test("parent completion requires settled children, one success, and no descendant lease", () => {
  let index = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("success-child", {
      parentId: "@parent",
      control: { mode: "queued" }
    }),
    taskOperation("cancel-child", {
      parentId: "@parent",
      control: { mode: "queued" }
    })
  ]);
  expectTaskGraphError(
    () =>
      completeTask(
        index,
        {
          taskId: "task-000001",
          expectedRevision: index.revision,
          result: { summary: "too early", references: {} }
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );

  const childClaim = claim(index, "task-000002");
  const leasedParent = projectTaskGraph(childClaim.index, initialNow).tasks[
    "task-000001"
  ]!;
  assert.ok(
    leasedParent.blockers.some(
      (blocker) =>
        blocker.kind === "descendant-lease" &&
        blocker.relatedTaskId === "task-000002"
    )
  );
  expectTaskGraphError(
    () =>
      completeTask(
        childClaim.index,
        {
          taskId: "task-000001",
          expectedRevision: childClaim.index.revision,
          result: { summary: "leased descendant", references: {} }
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );
  index = completeTask(
    childClaim.index,
    {
      taskId: "task-000002",
      leaseId: childClaim.data.leaseId,
      result: { summary: "done", references: {} }
    },
    initialNow
  ).index;
  index = cancelTask(
    index,
    {
      taskId: "task-000003",
      expectedRevision: index.revision,
      reason: "not needed"
    },
    initialNow
  ).index;
  const completed = completeTask(
    index,
    {
      taskId: "task-000001",
      expectedRevision: index.revision,
      result: { summary: "parent done", references: {} }
    },
    initialNow
  );
  assert.deepEqual(completed.index.tasks["task-000001"]!.state.execution, {
    phase: "succeeded",
    attempt: 0
  });

  let allCancelled = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", { parentId: "@parent" })
  ]);
  allCancelled = cancelTask(
    allCancelled,
    {
      taskId: "task-000002",
      expectedRevision: allCancelled.revision,
      reason: "cancel child"
    },
    initialNow
  ).index;
  expectTaskGraphError(
    () =>
      completeTask(
        allCancelled,
        {
          taskId: "task-000001",
          expectedRevision: allCancelled.revision,
          result: { summary: "invalid", references: {} }
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );
});

test("recursive cancellation preserves terminal descendants and rejects leased descendants atomically", () => {
  let index = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("done-child", {
      parentId: "@parent",
      control: { mode: "queued" }
    }),
    taskOperation("pending-child", { parentId: "@parent" }),
    taskOperation("grandchild", { parentId: "@pending-child" })
  ]);
  const doneClaim = claim(index, "task-000002");
  index = completeTask(
    doneClaim.index,
    {
      taskId: "task-000002",
      leaseId: doneClaim.data.leaseId,
      result: { summary: "kept", references: {} }
    },
    initialNow
  ).index;
  const cancelled = cancelTask(
    index,
    {
      taskId: "task-000001",
      expectedRevision: index.revision,
      reason: "stop branch"
    },
    initialNow
  );
  assert.deepEqual(cancelled.data.cancelledTaskIds, [
    "task-000001",
    "task-000003",
    "task-000004"
  ]);
  assert.equal(
    cancelled.index.tasks["task-000002"]!.state.execution.phase,
    "succeeded"
  );

  let leased = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", {
      parentId: "@parent",
      control: { mode: "queued" }
    })
  ]);
  leased = claim(leased, "task-000002").index;
  const before = structuredClone(leased);
  expectTaskGraphError(
    () =>
      cancelTask(
        leased,
        {
          taskId: "task-000001",
          expectedRevision: leased.revision,
          reason: "must not partially cancel"
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );
  assert.deepEqual(leased, before);
});
