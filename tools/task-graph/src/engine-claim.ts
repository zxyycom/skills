import { projectTaskGraph } from "./graph.ts";
import { TaskGraphError } from "./errors.ts";
import type { IndexMutation } from "./engine-content.ts";
import {
  boundedString,
  canonicalNow,
  cloneIndex,
  nextRevision,
  requireExpectedRevision,
  requireTask,
  updateTaskTime
} from "./engine-content.ts";
import { parseTaskIndex } from "./schema.ts";
import type { ClaimTaskOptions, TaskIndex } from "./types.ts";

export function mutateExecution<TData>(
  current: TaskIndex,
  taskId: string,
  now: Date,
  mutate: (candidate: TaskIndex, timestamp: string) => TData
): IndexMutation<TData> {
  const candidate = cloneIndex(current);
  requireTask(candidate, taskId);
  const timestamp = canonicalNow(now);
  const data = mutate(candidate, timestamp);
  updateTaskTime(candidate, taskId, timestamp);
  candidate.revision = nextRevision(current);
  return { index: parseTaskIndex(candidate), data };
}

export function leaseDurationMilliseconds(durationSeconds: number): number {
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 60 ||
    durationSeconds > 86_400
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Lease duration must be an integer from 60 to 86400 seconds",
      { durationSeconds }
    );
  }
  return durationSeconds * 1000;
}

export function canonicalLeaseId(value: string): string {
  const id = value.startsWith("lease-") ? value : `lease-${value}`;
  if (
    !/^lease-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      id
    )
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Lease generator returned a non-canonical UUID",
      { leaseId: id }
    );
  }
  return id;
}

export function requireRunningLease(
  index: TaskIndex,
  taskId: string,
  leaseId: string,
  now: Date,
  allowExpired: boolean
) {
  const task = requireTask(index, taskId);
  const execution = task.state.execution;
  if (execution.phase !== "running" || execution.lease.id !== leaseId) {
    throw new TaskGraphError(
      "LEASE_CONFLICT",
      `Lease ${leaseId} does not own task ${taskId}`,
      { taskId, leaseId }
    );
  }
  if (!allowExpired && new Date(execution.lease.expiresAt) <= now) {
    throw new TaskGraphError(
      "LEASE_EXPIRED",
      `Lease ${leaseId} has expired and requires claim recovery`,
      { taskId, leaseId, expiresAt: execution.lease.expiresAt }
    );
  }
  return execution;
}

export function claimTask(
  current: TaskIndex,
  options: ClaimTaskOptions & { leaseUuid: string },
  now: Date
): IndexMutation<{ taskId: string; leaseId: string; expiresAt: string }> {
  const duration = leaseDurationMilliseconds(options.durationSeconds ?? 1800);
  const actor = boundedString(options.actor, "actor", 200, {
    singleLine: true
  });
  const recoveryValues = [
    options.recoverLeaseId,
    options.expectedRevision,
    options.reason
  ];
  const recoveryValueCount = recoveryValues.filter(
    (value) => value !== undefined
  ).length;
  if (
    recoveryValueCount !== 0 &&
    recoveryValueCount !== recoveryValues.length
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Expired lease recovery requires recoverLeaseId, expectedRevision, and reason together"
    );
  }
  const recovering = recoveryValueCount === recoveryValues.length;
  if (recovering) boundedString(options.reason ?? "", "recovery reason", 1000);
  return mutateExecution(current, options.taskId, now, (candidate, timestamp) =>
    applyClaimMutation(candidate, timestamp, {
      actor,
      duration,
      now,
      options,
      recovering
    })
  );
}

type ClaimMutationContext = Readonly<{
  actor: string;
  duration: number;
  now: Date;
  options: ClaimTaskOptions & { leaseUuid: string };
  recovering: boolean;
}>;

export function applyClaimMutation(
  candidate: TaskIndex,
  timestamp: string,
  context: ClaimMutationContext
): { taskId: string; leaseId: string; expiresAt: string } {
  const task = requireTask(candidate, context.options.taskId);
  const projection = projectTaskGraph(candidate, context.now).tasks[
    context.options.taskId
  ];
  validateClaimState(candidate, task, projection, context);
  const leaseId = canonicalLeaseId(context.options.leaseUuid);
  assertLeaseAvailable(candidate, context.options.taskId, leaseId);
  const expiresAt = new Date(
    context.now.valueOf() + context.duration
  ).toISOString();
  task.state.execution = {
    attempt: task.state.execution.attempt + 1,
    lease: {
      actor: context.actor,
      claimedAt: timestamp,
      expiresAt,
      id: leaseId,
      renewedAt: timestamp
    },
    phase: "running"
  };
  return { expiresAt, leaseId, taskId: context.options.taskId };
}

export function validateClaimState(
  candidate: TaskIndex,
  task: TaskIndex["tasks"][string],
  projection: ReturnType<typeof projectTaskGraph>["tasks"][string] | undefined,
  context: ClaimMutationContext
): void {
  const execution = task.state.execution;
  if (execution.phase === "idle") {
    if (context.recovering) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        "An idle task claim does not accept lease recovery arguments"
      );
    }
    if (
      projection?.effectiveState !== "ready" ||
      projection.nextAction !== "claim"
    ) {
      throw claimStateConflict(context.options.taskId, projection);
    }
    return;
  }
  if (execution.phase !== "running") {
    throw claimStateConflict(context.options.taskId, projection);
  }
  validateExpiredClaimRecovery(candidate, execution, projection, context);
}

function assertExpiredLease(
  execution: Extract<
    TaskIndex["tasks"][string]["state"]["execution"],
    { phase: "running" }
  >,
  context: ClaimMutationContext
): void {
  if (new Date(execution.lease.expiresAt) <= context.now) return;
  throw new TaskGraphError(
    "LEASE_CONFLICT",
    `Task ${context.options.taskId} still has an active lease`,
    { expiresAt: execution.lease.expiresAt, leaseId: execution.lease.id }
  );
}

function assertRecoveryClaim(
  execution: Extract<
    TaskIndex["tasks"][string]["state"]["execution"],
    { phase: "running" }
  >,
  projection: ReturnType<typeof projectTaskGraph>["tasks"][string] | undefined,
  context: ClaimMutationContext
): void {
  if (!context.recovering)
    throw new TaskGraphError(
      "LEASE_EXPIRED",
      `Task ${context.options.taskId} requires explicit expired lease recovery`,
      { expiresAt: execution.lease.expiresAt, leaseId: execution.lease.id }
    );
  if (execution.lease.id !== context.options.recoverLeaseId)
    throw new TaskGraphError(
      "LEASE_CONFLICT",
      `Lease ${context.options.recoverLeaseId ?? ""} does not own task ${context.options.taskId}`,
      {
        expectedLeaseId: execution.lease.id,
        recoverLeaseId: context.options.recoverLeaseId ?? ""
      }
    );
  if (
    projection?.effectiveState === "recovery-needed" &&
    projection.nextAction === "claim"
  )
    return;
  throw new TaskGraphError(
    "STATE_CONFLICT",
    `Task ${context.options.taskId} is not recoverable through claim`,
    { projection }
  );
}

export function validateExpiredClaimRecovery(
  candidate: TaskIndex,
  execution: Extract<
    TaskIndex["tasks"][string]["state"]["execution"],
    { phase: "running" }
  >,
  projection: ReturnType<typeof projectTaskGraph>["tasks"][string] | undefined,
  context: ClaimMutationContext
): void {
  assertExpiredLease(execution, context);
  if (!context.recovering) {
    assertRecoveryClaim(execution, projection, context);
    return;
  }
  requireExpectedRevision(candidate, context.options.expectedRevision ?? -1);
  assertRecoveryClaim(execution, projection, context);
}

export function claimStateConflict(
  taskId: string,
  projection: ReturnType<typeof projectTaskGraph>["tasks"][string] | undefined
): TaskGraphError {
  return new TaskGraphError(
    "STATE_CONFLICT",
    `Task ${taskId} is not claimable`,
    {
      projection
    }
  );
}

export function assertLeaseAvailable(
  candidate: TaskIndex,
  taskId: string,
  leaseId: string
): void {
  for (const [candidateTaskId, candidateTask] of Object.entries(
    candidate.tasks
  )) {
    const execution = candidateTask.state.execution;
    if (execution.phase === "running" && execution.lease.id === leaseId) {
      throw new TaskGraphError(
        "LEASE_CONFLICT",
        `Lease ${leaseId} is already assigned to another running task`,
        { leaseId, ownerTaskId: candidateTaskId, requestedTaskId: taskId }
      );
    }
  }
}
