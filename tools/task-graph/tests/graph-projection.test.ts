import assert from "node:assert/strict";
import test from "node:test";
import {
  TaskGraphService,
  applyTaskGraphOperations,
  projectTaskGraph,
  validateTaskIndexGraph,
  type TaskListItem
} from "../src/index.ts";
import {
  applyOperations,
  expectTaskGraphError,
  graphIndex,
  initialNow,
  loadUncontendedNativeLock,
  taskContent,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";

test("graph validation rejects cycles and dangling references", () => {
  const base = graphIndex([
    taskOperation("parent"),
    taskOperation("child", { parentId: "@parent" }),
    taskOperation("other")
  ]);
  const parentCycle = structuredClone(base);
  parentCycle.tasks["task-000001"]!
    .state.relations.parentId = "task-000002";
  assert.ok(validateTaskIndexGraph(parentCycle).some((issue) =>
    issue.includes("parent cycle")
  ));

  expectTaskGraphError(() => applyTaskGraphOperations(base, {
    expectedRevision: base.revision,
    operations: [
      {
        kind: "set-dependency",
        taskId: "task-000001",
        dependencyId: "task-000003",
        present: true
      },
      {
        kind: "set-dependency",
        taskId: "task-000003",
        dependencyId: "task-000002",
        present: true
      }
    ]
  }, initialNow), "INDEX_INVALID");

  const dangling = structuredClone(base);
  dangling.tasks["task-000003"]!
    .state.relations.dependsOn = { "task-999999": true };
  assert.ok(validateTaskIndexGraph(dangling).some((issue) =>
    issue.includes("is missing")
  ));
});

test("relations enforce symmetric exclusions and reject conflicting inherited pairs", () => {
  let index = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", { parentId: "@parent" }),
    taskOperation("other", { control: { mode: "queued" } })
  ]);
  index = applyOperations(index, [{
    kind: "set-exclusion",
    taskId: "task-000001",
    excludedTaskId: "task-000003",
    present: true
  }]);
  const tasks = index.tasks;
  assert.equal(tasks["task-000001"]!.state.relations.excludes["task-000003"], true);
  assert.equal(tasks["task-000003"]!.state.relations.excludes["task-000001"], true);

  const asymmetric = structuredClone(index);
  delete asymmetric.tasks["task-000003"]!
    .state.relations.excludes["task-000001"];
  assert.ok(validateTaskIndexGraph(asymmetric).some((issue) =>
    issue.includes("is not symmetric")
  ));

  expectTaskGraphError(() => applyOperations(index, [{
    kind: "set-dependency",
    taskId: "task-000002",
    dependencyId: "task-000003",
    present: true
  }]), "INDEX_INVALID");

  expectTaskGraphError(() => applyOperations(index, [{
    kind: "set-exclusion",
    taskId: "task-000001",
    excludedTaskId: "task-000002",
    present: true
  }]), "INDEX_INVALID");
});

test("projection expands ancestor constraints with declaration paths and reverse links", () => {
  let index = graphIndex([
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", { parentId: "@parent" }),
    taskOperation("dependency", { control: { mode: "queued" } }),
    taskOperation("excluded", { control: { mode: "queued" } })
  ]);
  index = applyOperations(index, [
    {
      kind: "set-dependency",
      taskId: "task-000001",
      dependencyId: "task-000003",
      present: true
    },
    {
      kind: "set-exclusion",
      taskId: "task-000001",
      excludedTaskId: "task-000004",
      present: true
    }
  ]);
  const projection = projectTaskGraph(index, initialNow);
  const child = projection.tasks["task-000002"]!;

  assert.deepEqual(child.dependencies, [{
    targetTaskId: "task-000003",
    sourceTaskId: "task-000001",
    inheritancePath: ["task-000002", "task-000001"],
    declaredTargetTaskId: "task-000003",
    targetInheritancePath: ["task-000003"]
  }]);
  assert.ok(child.exclusions.some((source) =>
    source.targetTaskId === "task-000004"
    && source.sourceTaskId === "task-000001"
    && source.inheritancePath.join("/") === "task-000002/task-000001"
  ));
  assert.deepEqual(
    projection.tasks["task-000003"]!.dependents,
    ["task-000001", "task-000002"]
  );
  assert.deepEqual(projection.tasks["task-000001"]!.children, ["task-000002"]);
});

test("service list projection preserves complete graph semantics and actual task IDs", async () => {
  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      loadNativeLock: loadUncontendedNativeLock,
      lockRoot: root
    });
    await service.init();
    const created = await service.apply({
      expectedRevision: 0,
      operations: [
        taskOperation("parent", {
          control: { mode: "paused", reason: "awaiting review" },
          title: "Parent title"
        }),
        taskOperation("child", {
          parentId: "@parent",
          title: "Child title"
        }),
        taskOperation("dependency", {
          control: { mode: "queued" },
          title: "Dependency title"
        }),
        taskOperation("excluded", {
          control: { mode: "queued" },
          title: "Excluded title"
        })
      ]
    });
    await service.apply({
      expectedRevision: created.revision,
      operations: [
        {
          kind: "set-dependency",
          taskId: "task-000001",
          dependencyId: "task-000003",
          present: true
        },
        {
          kind: "set-exclusion",
          taskId: "task-000001",
          excludedTaskId: "task-000004",
          present: true
        }
      ]
    });

    const { data: index } = await service.readIndex();
    const projection = projectTaskGraph(index, initialNow);
    const listed = await service.listTasks();
    const taskIds = Object.keys(index.tasks).sort();

    assert.equal(listed.revision, index.revision);
    assert.deepEqual(Object.keys(listed.data), taskIds);
    for (const taskId of taskIds) {
      const task = index.tasks[taskId];
      const projected = projection.tasks[taskId];
      const listedItem = listed.data[taskId];
      assert.notEqual(task, undefined);
      assert.notEqual(projected, undefined);
      assert.notEqual(listedItem, undefined);
      if (task === undefined || projected === undefined || listedItem === undefined) {
        continue;
      }
      const expected = {
        ...projected,
        title: task.content.title,
        parentId: task.state.relations.parentId,
        phase: task.state.execution.phase
      } satisfies TaskListItem;
      assert.equal(listedItem.taskId, taskId);
      assert.deepEqual(listedItem, expected);
    }
  });
});

test("nearest local control overrides ancestor soft control without removing hard constraints", () => {
  let index = graphIndex([
    taskOperation("parent", {
      control: { mode: "paused", reason: "parent pause" }
    }),
    taskOperation("child", {
      parentId: "@parent",
      control: { mode: "queued" }
    }),
    taskOperation("dependency", { control: { mode: "queued" } })
  ]);
  index = applyOperations(index, [{
    kind: "set-dependency",
    taskId: "task-000001",
    dependencyId: "task-000003",
    present: true
  }]);
  const child = projectTaskGraph(index, initialNow)
    .tasks["task-000002"]!;

  assert.deepEqual(child.effectiveControl, {
    mode: "queued",
    reason: null,
    sourceTaskId: "task-000002",
    inheritancePath: ["task-000002"]
  });
  assert.equal(child.effectiveState, "waiting");
  assert.ok(child.blockers.some((blocker) =>
    blocker.kind === "dependency-incomplete"
    && blocker.sourceTaskId === "task-000001"
  ));
});

test("topology edits cannot rewrite running or terminal execution evidence", () => {
  let index = graphIndex([
    taskOperation("protected", { control: { mode: "queued" } }),
    taskOperation("other", { control: { mode: "queued" } })
  ]);
  index = applyOperations(index, [{
    kind: "set-exclusion",
    taskId: "task-000001",
    excludedTaskId: "task-000002",
    present: true
  }]);
  index.tasks["task-000001"]!.state.execution = {
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
  expectTaskGraphError(() => applyOperations(index, [{
    kind: "set-dependency",
    taskId: "task-000001",
    dependencyId: "task-000002",
    present: true
  }]), "STATE_CONFLICT");
  const beforeRunningChild = structuredClone(index);
  expectTaskGraphError(() => applyOperations(index, [{
    kind: "create-task",
    parentId: "task-000002",
    content: taskContent("new excluded descendant")
  }]), "STATE_CONFLICT");
  assert.deepEqual(index, beforeRunningChild);

  const terminal = structuredClone(index);
  terminal.tasks["task-000001"]!.state.execution = {
    phase: "succeeded",
    attempt: 1
  };
  terminal.tasks["task-000001"]!.content.result = {
    summary: "done",
    references: {}
  };
  expectTaskGraphError(() => applyOperations(terminal, [{
    kind: "set-parent",
    taskId: "task-000002",
    parentId: "task-000001"
  }]), "STATE_CONFLICT");
  const beforeTerminalChild = structuredClone(terminal);
  expectTaskGraphError(() => applyOperations(terminal, [{
    kind: "create-task",
    parentId: "task-000002",
    content: taskContent("new terminal exclusion descendant")
  }]), "STATE_CONFLICT");
  assert.deepEqual(terminal, beforeTerminalChild);
});
