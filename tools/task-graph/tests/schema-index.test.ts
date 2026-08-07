import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTaskGraphOperations,
  emptyTaskIndex,
  parseTaskGraphApplyRequest,
  parseTaskIndex,
  serializeTaskIndex
} from "../src/index.ts";
import {
  applyOperations,
  expectTaskGraphError,
  graphIndex,
  initialNow,
  taskContent,
  taskOperation
} from "./helpers.ts";

test("strict schema rejects unknown fields, illegal state unions, and duplicate leases", () => {
  const base = graphIndex([
    taskOperation("first"),
    taskOperation("second")
  ]);

  const unknownRoot = structuredClone(base) as unknown as Record<string, unknown>;
  unknownRoot.extra = true;
  expectTaskGraphError(() => parseTaskIndex(unknownRoot), "INDEX_INVALID");

  const illegalControl = structuredClone(base);
  (illegalControl.tasks["task-000001"]!.state.control as {
    mode: string;
    reason: string | null;
  }).reason = "candidate cannot carry a reason";
  expectTaskGraphError(() => parseTaskIndex(illegalControl), "INDEX_INVALID");

  const duplicateLeases = structuredClone(base);
  for (const task of Object.values(duplicateLeases.tasks)) {
    task.state.execution = {
      phase: "running",
      attempt: 1,
      lease: {
        id: "lease-00000000-0000-4000-8000-000000000001",
        actor: "worker",
        claimedAt: "2026-08-06T08:00:00.000Z",
        renewedAt: "2026-08-06T08:00:00.000Z",
        expiresAt: "2026-08-06T08:30:00.000Z"
      }
    };
  }
  expectTaskGraphError(() => parseTaskIndex(duplicateLeases), "INDEX_INVALID");

  const reservedReference = structuredClone(base);
  reservedReference.tasks["task-000001"]!.content.references = Object.fromEntries([
    ["constructor", "reserved"]
  ]);
  expectTaskGraphError(() => parseTaskIndex(reservedReference), "INDEX_INVALID");

  expectTaskGraphError(() => parseTaskGraphApplyRequest({
    expectedRevision: 0,
    operations: [{ kind: "create-task", content: taskContent("strict"), extra: true }]
  }), "REQUEST_INVALID");
});

test("canonical serialization keeps root task identity, sorting, LF, and round trip", () => {
  let index = graphIndex([
    taskOperation("left"),
    taskOperation("right")
  ]);
  index = applyOperations(index, [{
    kind: "set-exclusion",
    taskId: "task-000001",
    excludedTaskId: "task-000002",
    present: true
  }]);
  index.tasks["task-000001"]!.content.references = {
    zebra: "last",
    alpha: "first"
  };

  const text = serializeTaskIndex(index);
  assert.equal(text.endsWith("\n"), true);
  assert.equal(text.includes("\r"), false);
  assert.ok(text.indexOf('"alpha"') < text.indexOf('"zebra"'));
  assert.ok(text.indexOf('"task-000001"') < text.indexOf('"task-000002"'));

  const roundTrip = parseTaskIndex(JSON.parse(text) as unknown);
  assert.deepEqual(roundTrip, index);
  assert.equal("taskId" in roundTrip.tasks["task-000001"]!, false);
});

test("nextTaskId stays monotonic beyond six digits and failed apply consumes nothing", () => {
  const extended = emptyTaskIndex();
  extended.nextTaskId = 1_000_000;
  const allocated = applyOperations(extended, [{
    kind: "create-task",
    content: taskContent("large task")
  }]);
  assert.ok(allocated.tasks["task-1000000"]);
  assert.equal(allocated.nextTaskId, 1_000_001);

  const beforeFailure = structuredClone(allocated);
  expectTaskGraphError(() => applyTaskGraphOperations(allocated, {
    expectedRevision: allocated.revision,
    operations: [
      { kind: "create-task", content: taskContent("rolled back") },
      {
        kind: "update-task-control",
        taskId: "task-999999",
        control: { mode: "queued" }
      }
    ]
  }, initialNow), "TASK_NOT_FOUND");
  assert.deepEqual(allocated, beforeFailure);

  const invalidCounter = structuredClone(allocated);
  invalidCounter.nextTaskId = 1_000_000;
  expectTaskGraphError(() => parseTaskIndex(invalidCounter), "INDEX_INVALID");
});

test("scope-shaped schema v1 is unsupported without a compatibility path", () => {
  expectTaskGraphError(() => parseTaskIndex({
    schemaVersion: 1,
    revision: 0,
    nextIds: { scope: 1, task: 1 },
    scopes: {}
  }), "SCHEMA_UNSUPPORTED");
});

test("task creation applies safe top-level and child defaults", () => {
  const index = graphIndex([
    taskOperation("parent"),
    {
      kind: "create-task",
      content: taskContent("child"),
      parentId: "task-000001"
    }
  ]);
  const parent = index.tasks["task-000001"]!;
  const child = index.tasks["task-000002"]!;

  assert.deepEqual(parent.state.control, { mode: "candidate", reason: null });
  assert.deepEqual(child.state.control, { mode: "inherit", reason: null });
  assert.equal(parent.content.context, null);
  assert.deepEqual(parent.content.references, {});
  assert.equal(parent.content.result, null);
});
