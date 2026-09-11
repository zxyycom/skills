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
  renewTaskLease
} from "../src/index.ts";
import {
  applyOperations,
  expectTaskGraphError,
  graphIndex,
  initialNow,
  taskOperation
} from "./helpers.ts";
import { claim, leaseUuidA, leaseUuidB } from "./lifecycle-test-support.ts";

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

function prepareLeaseLifecycleIndex() {
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

  return index;
}

test("lease lifecycle enforces duration, renewal, expiry, and explicit claim recovery", () => {
  let index = prepareLeaseLifecycleIndex();
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
