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

test("strict schema rejects unknown fields and illegal state unions", () => {
  expectTaskGraphError(
    () => parseTaskIndex({ ...emptyTaskIndex(), unexpected: true }),
    "INDEX_INVALID"
  );

  const valid = graphIndex([
    taskOperation("work", { control: { mode: "queued" } })
  ]);
  const illegalControl = structuredClone(valid) as unknown as {
    scopes: Record<string, {
      tasks: Record<string, { state: { control: unknown } }>;
    }>;
  };
  illegalControl.scopes["scope-000001"]!.tasks["task-000001"]!
    .state.control = { mode: "waiting", reason: null };
  expectTaskGraphError(() => parseTaskIndex(illegalControl), "INDEX_INVALID");

  const illegalExecution = structuredClone(valid) as unknown as {
    scopes: Record<string, {
      tasks: Record<string, { state: { execution: unknown } }>;
    }>;
  };
  illegalExecution.scopes["scope-000001"]!.tasks["task-000001"]!
    .state.execution = { phase: "idle", attempt: 0, lease: {} };
  expectTaskGraphError(() => parseTaskIndex(illegalExecution), "INDEX_INVALID");

  expectTaskGraphError(() => parseTaskGraphApplyRequest({
    expectedRevision: 0,
    operations: [{ kind: "create-scope", key: "scope", extra: true }]
  }), "REQUEST_INVALID");

  const longDictionaryKey = "a".repeat(81);
  const longBindingKey = structuredClone(valid);
  longBindingKey.scopes["scope-000001"]!.bindings = Object.fromEntries([
    [longDictionaryKey, "value"]
  ]);
  expectTaskGraphError(() => parseTaskIndex(longBindingKey), "INDEX_INVALID");

  const longReferenceKey = structuredClone(valid);
  longReferenceKey.scopes["scope-000001"]!.tasks["task-000001"]!
    .content.references = Object.fromEntries([[longDictionaryKey, "value"]]);
  expectTaskGraphError(() => parseTaskIndex(longReferenceKey), "INDEX_INVALID");

  expectTaskGraphError(() => parseTaskGraphApplyRequest({
    expectedRevision: 0,
    operations: [{
      kind: "create-task",
      scopeId: "scope-000001",
      alias: longDictionaryKey,
      content: taskContent("long alias")
    }]
  }), "REQUEST_INVALID");

  const duplicateLeases = graphIndex([
    taskOperation("first", { control: { mode: "queued" } }),
    taskOperation("second", { control: { mode: "queued" } })
  ]);
  const duplicatedLease = {
    phase: "running" as const,
    attempt: 1,
    lease: {
      id: "lease-00000000-0000-4000-8000-000000000101",
      actor: "worker",
      claimedAt: "2026-08-06T08:00:00.000Z",
      renewedAt: "2026-08-06T08:00:00.000Z",
      expiresAt: "2026-08-06T08:30:00.000Z"
    }
  };
  duplicateLeases.scopes["scope-000001"]!.tasks["task-000001"]!
    .state.execution = structuredClone(duplicatedLease);
  duplicateLeases.scopes["scope-000001"]!.tasks["task-000002"]!
    .state.execution = structuredClone(duplicatedLease);
  expectTaskGraphError(() => parseTaskIndex(duplicateLeases), "INDEX_INVALID");
});

test("canonical serialization keeps dictionary identity, sorting, LF, and round trip", () => {
  const index = graphIndex([
    taskOperation("z-task", { control: { mode: "queued" }, title: "Z" }),
    taskOperation("a-task", { control: { mode: "queued" }, title: "A" }),
    {
      kind: "set-exclusion",
      scopeId: "scope-000001",
      taskId: "@z-task",
      excludedTaskId: "@a-task",
      present: true
    }
  ]);
  index.scopes["scope-000001"]!.bindings = {
    "z-binding": "last",
    "a-binding": "first"
  };
  const text = serializeTaskIndex(index);

  assert.ok(text.endsWith("\n"));
  assert.equal(text.includes("\r"), false);
  assert.ok(text.indexOf('"a-binding"') < text.indexOf('"z-binding"'));
  assert.ok(text.indexOf('"task-000001"') < text.indexOf('"task-000002"'));
  const roundTrip = parseTaskIndex(JSON.parse(text) as unknown);
  assert.deepEqual(roundTrip, parseTaskIndex(index));
  assert.equal("scopeId" in roundTrip.scopes["scope-000001"]!, false);
  assert.equal(
    "taskId" in roundTrip.scopes["scope-000001"]!.tasks["task-000001"]!,
    false
  );
});

test("nextIds stay monotonic, extend beyond six digits, and failed apply consumes nothing", () => {
  const extended = emptyTaskIndex();
  extended.nextIds.scope = 1_000_000;
  extended.nextIds.task = 1_000_000;
  const allocatedScope = applyOperations(extended, [
    { kind: "create-scope", key: "large-scope" }
  ]);
  const allocatedTask = applyOperations(allocatedScope, [{
    kind: "create-task",
    scopeId: "scope-1000000",
    content: taskContent("large task")
  }]);
  assert.ok(allocatedTask.scopes["scope-1000000"]);
  assert.ok(allocatedTask.scopes["scope-1000000"]!.tasks["task-1000000"]);
  assert.deepEqual(allocatedTask.nextIds, { scope: 1_000_001, task: 1_000_001 });

  const invalidCounter = structuredClone(allocatedTask);
  invalidCounter.nextIds.task = 1_000_000;
  expectTaskGraphError(() => parseTaskIndex(invalidCounter), "INDEX_INVALID");

  const duplicateIdentity = structuredClone(allocatedTask);
  duplicateIdentity.scopes["scope-1000001"] = {
    key: "duplicate-task-owner",
    bindings: {},
    timestamps: {
      createdAt: initialNow.toISOString(),
      updatedAt: initialNow.toISOString()
    },
    tasks: {
      "task-1000000": structuredClone(
        allocatedTask.scopes["scope-1000000"]!.tasks["task-1000000"]!
      )
    }
  };
  duplicateIdentity.nextIds.scope = 1_000_002;
  expectTaskGraphError(() => parseTaskIndex(duplicateIdentity), "INDEX_INVALID");

  const before = structuredClone(allocatedTask);
  expectTaskGraphError(() => applyTaskGraphOperations(allocatedTask, {
    expectedRevision: allocatedTask.revision,
    operations: [
      {
        kind: "create-task",
        scopeId: "scope-1000000",
        content: taskContent("would allocate")
      },
      {
        kind: "create-task",
        scopeId: "scope-999999",
        content: taskContent("must fail")
      }
    ]
  }, initialNow), "SCOPE_NOT_FOUND");
  assert.deepEqual(allocatedTask, before);
});

test("scope key identity is immutable while bindings remain replaceable and unique", () => {
  let index = applyOperations(emptyTaskIndex(), [
    { kind: "create-scope", key: "first", bindings: { thread: "thread-a" } },
    { kind: "create-scope", key: "second" }
  ]);
  expectTaskGraphError(() => parseTaskGraphApplyRequest({
    expectedRevision: index.revision,
    operations: [{
      kind: "update-scope-key",
      scopeId: "scope-000001",
      key: "renamed"
    }]
  }), "REQUEST_INVALID");
  expectTaskGraphError(() => applyOperations(index, [{
    kind: "create-scope",
    key: "first"
  }]), "SCOPE_KEY_CONFLICT");

  index = applyOperations(index, [{
    kind: "set-scope-binding",
    scopeId: "scope-000001",
    bindingKind: "thread",
    value: "thread-b"
  }]);
  assert.equal(index.scopes["scope-000001"]!.key, "first");
  assert.equal(index.scopes["scope-000001"]!.bindings.thread, "thread-b");

  expectTaskGraphError(() => applyOperations(index, [{
    kind: "set-scope-binding",
    scopeId: "scope-000002",
    bindingKind: "thread",
    value: "thread-b"
  }]), "BINDING_CONFLICT");
});

test("scope creation reports initial binding collisions with the stable binding error", () => {
  const index = applyOperations(emptyTaskIndex(), [{
    kind: "create-scope",
    key: "first-binding-owner",
    bindings: { thread: "thread-shared" }
  }]);
  expectTaskGraphError(() => applyOperations(index, [{
    kind: "create-scope",
    key: "second-binding-owner",
    bindings: { thread: "thread-shared" }
  }]), "BINDING_CONFLICT");
});

test("task creation applies safe top-level and child defaults", () => {
  const index = graphIndex([
    taskOperation("parent"),
    taskOperation("child", { parentId: "@parent" })
  ]);
  const scope = index.scopes["scope-000001"]!;
  const parent = scope.tasks["task-000001"]!;
  const child = scope.tasks["task-000002"]!;

  assert.deepEqual(parent.state.control, { mode: "candidate", reason: null });
  assert.deepEqual(child.state.control, { mode: "inherit", reason: null });
  assert.deepEqual(parent.state.execution, { phase: "idle", attempt: 0 });
  assert.deepEqual(child.state.execution, { phase: "idle", attempt: 0 });
  assert.equal(parent.state.relations.parentId, null);
  assert.equal(child.state.relations.parentId, "task-000001");
  assert.equal(parent.content.context, null);
  assert.deepEqual(parent.content.references, {});
  assert.equal(parent.content.result, null);
});
