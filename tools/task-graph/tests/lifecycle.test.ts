import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTaskGraphOperations,
  cancelTask,
  claimTask,
  completeTask,
  failTask,
  projectTaskGraph,
  releaseTask,
  renewTaskLease,
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

const leaseUuidA = "00000000-0000-4000-8000-000000000101";
const leaseUuidB = "00000000-0000-4000-8000-000000000102";

function claim(
  index: ReturnType<typeof graphIndex>,
  taskId: string,
  leaseUuid = leaseUuidA,
  now = initialNow
) {
  return claimTask(
    index,
    {
      taskId,
      actor: "test-worker",
      leaseUuid
    },
    now
  );
}

test("effective-state priority and actionable distinguish leaf claim from parent complete", () => {
  let index = graphIndex([
    taskOperation("candidate"),
    taskOperation("waiting", {
      control: { mode: "waiting", reason: "waiting input" }
    }),
    taskOperation("paused", {
      control: { mode: "paused", reason: "paused by user" }
    }),
    taskOperation("ready-leaf", { control: { mode: "queued" } }),
    taskOperation("expired", { control: { mode: "queued" } }),
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", {
      parentId: "@parent",
      control: { mode: "queued" }
    })
  ]);
  const expiredClaim = claim(index, "task-000005");
  index = expiredClaim.index;
  const childClaim = claim(index, "task-000007", leaseUuidB);
  index = completeTask(
    childClaim.index,
    {
      taskId: "task-000007",
      leaseId: childClaim.data.leaseId,
      result: { summary: "child done", references: {} }
    },
    initialNow
  ).index;

  const projection = projectTaskGraph(
    index,
    new Date("2026-08-06T08:31:00.000Z")
  );
  assert.equal(projection.tasks["task-000001"]!.effectiveState, "candidate");
  assert.equal(projection.tasks["task-000002"]!.effectiveState, "waiting");
  assert.equal(projection.tasks["task-000003"]!.effectiveState, "paused");
  assert.equal(
    projection.tasks["task-000005"]!.effectiveState,
    "recovery-needed"
  );
  assert.equal(projection.tasks["task-000007"]!.effectiveState, "succeeded");
  assert.equal(projection.tasks["task-000004"]!.nextAction, "claim");
  assert.equal(projection.tasks["task-000006"]!.nextAction, "complete");
  assert.deepEqual(projection.actionableOrder, [
    "task-000004",
    "task-000005",
    "task-000006"
  ]);
});

test("higher-priority execution and control states suppress lower-priority blockers", () => {
  const index = graphIndex([
    taskOperation("succeeded"),
    taskOperation("failed"),
    taskOperation("running"),
    taskOperation("dependency"),
    taskOperation("candidate"),
    taskOperation("waiting", {
      control: { mode: "waiting", reason: "waiting" }
    }),
    taskOperation("paused", {
      control: { mode: "paused", reason: "paused" }
    })
  ]);
  const tasks = index.tasks;
  tasks["task-000001"]!.state.execution = { phase: "succeeded", attempt: 1 };
  tasks["task-000001"]!.content.result = { summary: "done", references: {} };
  tasks["task-000001"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000002"]!.state.control = {
    mode: "waiting",
    reason: "lower priority"
  };
  tasks["task-000002"]!.state.execution = {
    phase: "failed",
    attempt: 1,
    reason: "failed"
  };
  tasks["task-000002"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000003"]!.state.control = {
    mode: "paused",
    reason: "lower priority"
  };
  tasks["task-000003"]!.state.execution = {
    phase: "running",
    attempt: 1,
    lease: {
      id: "lease-00000000-0000-4000-8000-000000000103",
      actor: "worker",
      claimedAt: "2026-08-06T08:00:00.000Z",
      renewedAt: "2026-08-06T08:00:00.000Z",
      expiresAt: "2026-08-06T08:30:00.000Z"
    }
  };
  tasks["task-000003"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000005"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000006"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000007"]!.state.relations.dependsOn = { "task-000004": true };

  const projection = projectTaskGraph(index, initialNow);
  for (const taskId of ["task-000001", "task-000002", "task-000003"]) {
    assert.deepEqual(projection.tasks[taskId]!.blockers, []);
    assert.equal(projection.tasks[taskId]!.nextAction, null);
  }
  assert.equal(projection.tasks["task-000001"]!.effectiveState, "succeeded");
  assert.equal(projection.tasks["task-000002"]!.effectiveState, "failed");
  assert.equal(projection.tasks["task-000003"]!.effectiveState, "running");
  for (const [taskId, kind] of [
    ["task-000005", "control-candidate"],
    ["task-000006", "control-waiting"],
    ["task-000007", "control-paused"]
  ] as const) {
    assert.deepEqual(
      projection.tasks[taskId]!.blockers.map((blocker) => blocker.kind),
      [kind]
    );
  }
});

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

test("claim revalidates same-task and exclusion conflicts against the latest index", () => {
  let index = graphIndex([
    taskOperation("left", { control: { mode: "queued" } }),
    taskOperation("right", { control: { mode: "queued" } })
  ]);
  index = applyOperations(index, [
    {
      kind: "set-exclusion",
      taskId: "task-000001",
      excludedTaskId: "task-000002",
      present: true
    }
  ]);
  const leftClaim = claim(index, "task-000001");
  expectTaskGraphError(
    () => claim(leftClaim.index, "task-000001", leaseUuidB),
    "LEASE_CONFLICT"
  );
  expectTaskGraphError(
    () => claim(leftClaim.index, "task-000002", leaseUuidB),
    "STATE_CONFLICT"
  );
  expectTaskGraphError(
    () =>
      applyTaskGraphOperations(
        leftClaim.index,
        {
          expectedRevision: index.revision,
          operations: [
            {
              kind: "update-task-control",
              taskId: "task-000002",
              control: { mode: "paused", reason: "stale edit" }
            }
          ]
        },
        initialNow
      ),
    "REVISION_CONFLICT"
  );
});

test("lease lifecycle enforces duration, renewal, expiry, and explicit claim recovery", () => {
  const collisionIndex = graphIndex([
    taskOperation("first", { control: { mode: "queued" } }),
    taskOperation("second", { control: { mode: "queued" } })
  ]);
  const firstCollisionClaim = claim(collisionIndex, "task-000001", leaseUuidA);
  const beforeCollision = structuredClone(firstCollisionClaim.index);
  const collision = expectTaskGraphError(
    () => claim(firstCollisionClaim.index, "task-000002", leaseUuidA),
    "LEASE_CONFLICT"
  );
  assert.equal(collision.retryable, true);
  assert.deepEqual(firstCollisionClaim.index, beforeCollision);

  let index = graphIndex([
    taskOperation("work", { control: { mode: "queued" } })
  ]);
  for (const precondition of [
    {},
    { leaseId: `lease-${leaseUuidA}`, expectedRevision: index.revision }
  ]) {
    expectTaskGraphError(
      () =>
        completeTask(
          index,
          {
            taskId: "task-000001",
            ...precondition,
            result: { summary: "invalid precondition", references: {} }
          } as never,
          initialNow
        ),
      "ARGUMENT_INVALID"
    );
    expectTaskGraphError(
      () =>
        cancelTask(
          index,
          {
            taskId: "task-000001",
            ...precondition,
            reason: "invalid precondition"
          } as never,
          initialNow
        ),
      "ARGUMENT_INVALID"
    );
  }
  expectTaskGraphError(
    () =>
      claimTask(
        index,
        {
          taskId: "task-000001",
          actor: "worker",
          durationSeconds: 59,
          leaseUuid: leaseUuidA
        },
        initialNow
      ),
    "ARGUMENT_INVALID"
  );
  expectTaskGraphError(
    () =>
      claimTask(
        index,
        {
          taskId: "task-000001",
          actor: "worker",
          durationSeconds: 86_401,
          leaseUuid: leaseUuidA
        },
        initialNow
      ),
    "ARGUMENT_INVALID"
  );
  assert.equal(
    claimTask(
      index,
      {
        taskId: "task-000001",
        actor: "worker",
        durationSeconds: 60,
        leaseUuid: leaseUuidA
      },
      initialNow
    ).data.expiresAt,
    "2026-08-06T08:01:00.000Z"
  );
  assert.equal(
    claimTask(
      index,
      {
        taskId: "task-000001",
        actor: "worker",
        durationSeconds: 86_400,
        leaseUuid: leaseUuidA
      },
      initialNow
    ).data.expiresAt,
    "2026-08-07T08:00:00.000Z"
  );

  const claimed = claim(index, "task-000001");
  assert.equal(claimed.data.expiresAt, "2026-08-06T08:30:00.000Z");
  expectTaskGraphError(
    () =>
      releaseTask(
        claimed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId,
          control: { mode: "inherit" }
        },
        initialNow
      ),
    "STATE_CONFLICT"
  );
  const pausedRelease = releaseTask(
    claimed.index,
    {
      taskId: "task-000001",
      leaseId: claimed.data.leaseId,
      control: { mode: "paused", reason: "paused after release" }
    },
    initialNow
  );
  assert.deepEqual(pausedRelease.index.tasks["task-000001"]!.state, {
    control: { mode: "paused", reason: "paused after release" },
    execution: { phase: "idle", attempt: 1 },
    relations: { parentId: null, dependsOn: {}, excludes: {} },
    timestamps: {
      createdAt: "2026-08-06T08:00:00.000Z",
      updatedAt: "2026-08-06T08:00:00.000Z"
    }
  });
  const renewed = renewTaskLease(
    claimed.index,
    {
      taskId: "task-000001",
      leaseId: claimed.data.leaseId,
      durationSeconds: 60
    },
    new Date("2026-08-06T08:10:00.000Z")
  );
  assert.equal(renewed.data.expiresAt, "2026-08-06T08:11:00.000Z");
  expectTaskGraphError(
    () =>
      releaseTask(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: `lease-${leaseUuidB}`,
          control: { mode: "queued" }
        },
        new Date("2026-08-06T08:10:30.000Z")
      ),
    "LEASE_CONFLICT"
  );
  expectTaskGraphError(
    () =>
      completeTask(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId,
          result: { summary: "late", references: {} }
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    "LEASE_EXPIRED"
  );
  for (const operation of [
    () =>
      renewTaskLease(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    () =>
      releaseTask(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId,
          control: { mode: "queued" }
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    () =>
      failTask(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId,
          reason: "late failure"
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    () =>
      cancelTask(
        renewed.index,
        {
          taskId: "task-000001",
          leaseId: claimed.data.leaseId,
          reason: "late cancellation"
        },
        new Date("2026-08-06T08:12:00.000Z")
      )
  ]) {
    expectTaskGraphError(operation, "LEASE_EXPIRED");
  }
  expectTaskGraphError(
    () =>
      claimTask(
        renewed.index,
        {
          taskId: "task-000001",
          actor: "replacement",
          leaseUuid: leaseUuidB,
          recoverLeaseId: `lease-${leaseUuidB}`,
          expectedRevision: renewed.index.revision,
          reason: "wrong previous lease"
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    "LEASE_CONFLICT"
  );
  expectTaskGraphError(
    () =>
      claimTask(
        renewed.index,
        {
          taskId: "task-000001",
          actor: "replacement",
          leaseUuid: leaseUuidB
        },
        new Date("2026-08-06T08:12:00.000Z")
      ),
    "LEASE_EXPIRED"
  );
  const expiredProjection = projectTaskGraph(
    renewed.index,
    new Date("2026-08-06T08:12:00.000Z")
  );
  assert.equal(
    expiredProjection.tasks["task-000001"]?.effectiveState,
    "recovery-needed"
  );
  assert.equal(expiredProjection.tasks["task-000001"]?.nextAction, "claim");
  assert.deepEqual(expiredProjection.actionableOrder, ["task-000001"]);
  const recovered = claimTask(
    renewed.index,
    {
      taskId: "task-000001",
      actor: "replacement",
      leaseUuid: leaseUuidB,
      recoverLeaseId: claimed.data.leaseId,
      expectedRevision: renewed.index.revision,
      reason: "expired worker disappeared"
    },
    new Date("2026-08-06T08:12:00.000Z")
  );
  assert.equal(recovered.data.leaseId, `lease-${leaseUuidB}`);
  assert.deepEqual(recovered.index.tasks["task-000001"]!.state.execution, {
    phase: "running",
    attempt: 2,
    lease: {
      id: `lease-${leaseUuidB}`,
      actor: "replacement",
      claimedAt: "2026-08-06T08:12:00.000Z",
      renewedAt: "2026-08-06T08:12:00.000Z",
      expiresAt: "2026-08-06T08:42:00.000Z"
    }
  });

  index = graphIndex([
    taskOperation("active", { control: { mode: "queued" } })
  ]);
  const active = claim(index, "task-000001");
  expectTaskGraphError(
    () =>
      claimTask(
        active.index,
        {
          taskId: "task-000001",
          actor: "replacement",
          leaseUuid: leaseUuidB,
          recoverLeaseId: active.data.leaseId,
          expectedRevision: active.index.revision,
          reason: "too early"
        },
        new Date("2026-08-06T08:01:00.000Z")
      ),
    "LEASE_CONFLICT"
  );
});
