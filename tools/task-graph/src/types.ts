export const taskGraphSchemaVersion = 2 as const;
export const taskGraphVersion = "3.1.0" as const;
export const defaultTaskGraphIndexPath =
  "docs/task-graph/task-graph-index.json" as const;
export const taskGraphRuntimeProtocolVersion = 1 as const;
export const taskGraphSupportedNodeRange =
  "^22.22.2 || ^24.15.0 || >=26.0.0" as const;

export const taskControlModes = [
  "inherit",
  "candidate",
  "queued",
  "waiting",
  "paused"
] as const;
export const taskExecutionPhases = [
  "idle",
  "running",
  "succeeded",
  "failed",
  "cancelled"
] as const;
export const taskEffectiveStates = [
  "candidate",
  "waiting",
  "paused",
  "ready",
  "running",
  "recovery-needed",
  "succeeded",
  "failed",
  "cancelled"
] as const;

export type TaskControlMode = (typeof taskControlModes)[number];
export type TaskExecutionPhase = (typeof taskExecutionPhases)[number];
export type TaskEffectiveState = (typeof taskEffectiveStates)[number];

export type TaskControl =
  | { mode: "inherit" | "candidate" | "queued"; reason: null }
  | { mode: "waiting" | "paused"; reason: string };

export type TaskLease = {
  id: string;
  actor: string;
  claimedAt: string;
  renewedAt: string;
  expiresAt: string;
};

export type TaskExecution =
  | { phase: "idle"; attempt: number }
  | { phase: "running"; attempt: number; lease: TaskLease }
  | { phase: "succeeded"; attempt: number }
  | { phase: "failed"; attempt: number; reason: string }
  | { phase: "cancelled"; attempt: number; reason: string };

export type TaskResult = {
  summary: string;
  references: Record<string, string>;
};

export type TaskMutationPrecondition =
  | { leaseId: string; expectedRevision?: never }
  | { leaseId?: never; expectedRevision: number };

export type CompleteTaskOptions = {
  taskId: string;
  result: TaskResult;
} & TaskMutationPrecondition;

export type CancelTaskOptions = {
  taskId: string;
  reason: string;
} & TaskMutationPrecondition;

export type ClaimTaskOptions = {
  taskId: string;
  actor: string;
  durationSeconds?: number;
} & (
  | {
      recoverLeaseId: string;
      expectedRevision: number;
      reason: string;
    }
  | {
      recoverLeaseId?: never;
      expectedRevision?: never;
      reason?: never;
    }
);

export type TaskContent = {
  title: string;
  goal: string;
  acceptance: string[];
  context: string | null;
  references: Record<string, string>;
  result: TaskResult | null;
};

export type TaskRelations = {
  parentId: string | null;
  dependsOn: Record<string, true>;
  excludes: Record<string, true>;
};

export type TaskTimestamps = {
  createdAt: string;
  updatedAt: string;
};

export type TaskState = {
  control: TaskControl;
  execution: TaskExecution;
  relations: TaskRelations;
  timestamps: TaskTimestamps;
};

export type TaskEntry = {
  content: TaskContent;
  state: TaskState;
};

export type TaskIndex = {
  schemaVersion: typeof taskGraphSchemaVersion;
  revision: number;
  nextTaskId: number;
  tasks: Record<string, TaskEntry>;
};

export type TaskBlockerKind =
  | "control-candidate"
  | "control-waiting"
  | "control-paused"
  | "dependency-incomplete"
  | "dependency-cancelled"
  | "dependency-failed"
  | "exclusion-running"
  | "ancestor-terminal"
  | "child-incomplete"
  | "all-children-cancelled"
  | "descendant-lease";

type TaskBlockerBase = {
  taskId: string;
  relatedTaskId: string;
  sourceTaskId: string;
  inheritancePath: string[];
};

export type TaskBlocker = TaskBlockerBase & (
  | { kind: "control-candidate"; state: "candidate" }
  | { kind: "control-waiting"; state: "waiting" }
  | { kind: "control-paused"; state: "paused" }
  | { kind: "dependency-failed"; state: "failed" }
  | { kind: "dependency-cancelled"; state: "cancelled" }
  | {
      kind: "dependency-incomplete";
      state: Exclude<TaskEffectiveState, "succeeded" | "failed" | "cancelled">;
    }
  | {
      kind: "child-incomplete";
      state: Exclude<TaskEffectiveState, "succeeded" | "cancelled">;
    }
  | {
      kind: "exclusion-running" | "descendant-lease";
      state: "running" | "recovery-needed";
    }
  | { kind: "ancestor-terminal"; state: "succeeded" | "cancelled" }
  | { kind: "all-children-cancelled"; state: "cancelled" }
);

export type TaskConstraintSource = {
  targetTaskId: string;
  sourceTaskId: string;
  inheritancePath: string[];
  declaredTargetTaskId: string;
  targetInheritancePath: string[];
};

export type TaskProjection = {
  taskId: string;
  effectiveState: TaskEffectiveState;
  effectiveControl: {
    mode: Exclude<TaskControlMode, "inherit">;
    reason: string | null;
    sourceTaskId: string;
    inheritancePath: string[];
  };
  blockers: TaskBlocker[];
  dependencies: TaskConstraintSource[];
  exclusions: TaskConstraintSource[];
  children: string[];
  dependents: string[];
  nextAction: "claim" | "complete" | null;
};

export type TaskListItem = TaskProjection & {
  title: string;
  parentId: string | null;
  phase: TaskExecutionPhase;
};

export type TaskGraphProjection = {
  revision: number;
  tasks: Record<string, TaskProjection>;
  actionable: Record<string, TaskProjection>;
  actionableOrder: string[];
};

export type TaskGraphErrorCode =
  | "ARGUMENT_INVALID"
  | "REQUEST_INVALID"
  | "INDEX_NOT_FOUND"
  | "INDEX_EXISTS"
  | "INDEX_READ_FAILED"
  | "INDEX_INVALID"
  | "SCHEMA_UNSUPPORTED"
  | "RUNTIME_MISSING"
  | "RUNTIME_UNSUPPORTED"
  | "RUNTIME_INCOMPATIBLE"
  | "LOCK_TIMEOUT"
  | "REVISION_CONFLICT"
  | "TASK_NOT_FOUND"
  | "STATE_CONFLICT"
  | "TOPOLOGY_INVALID"
  | "LEASE_CONFLICT"
  | "LEASE_EXPIRED"
  | "DELIVERY_NOT_CONFIRMED"
  | "TASKS_NOT_REMOVABLE"
  | "WRITE_FAILED"
  | "WRITE_OUTCOME_UNKNOWN";

export type TaskGraphErrorBody = {
  code: TaskGraphErrorCode;
  retryable: boolean;
  message: string;
  details: JsonObject;
};

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type TaskGraphSuccess<TData = unknown> = {
  ok: true;
  indexPath: string;
  revision: number | null;
  data: TData;
};

export type TaskGraphFailure = {
  ok: false;
  indexPath: string;
  revision: number | null;
  error: TaskGraphErrorBody;
};

export type TaskGraphResult<TData = unknown> =
  | TaskGraphSuccess<TData>
  | TaskGraphFailure;

export type Clock = () => Date;

export type TaskGraphRuntimeState = "missing" | "compatible" | "incompatible";

export type TaskGraphRuntimeInstallCommand = {
  command: "npm";
  args: string[];
};

export type TaskGraphRuntimeInfo = {
  runtimeId: string;
  protocolVersion: typeof taskGraphRuntimeProtocolVersion;
  toolHome: string;
  runtimePath: string;
  toolHomeSource: "default" | "environment";
  state: TaskGraphRuntimeState;
  compatible: boolean;
  reason: string | null;
  installCommand: TaskGraphRuntimeInstallCommand | null;
  nodeVersion: string;
  platform: string;
  arch: string;
};

export type TaskIndexInfo = {
  valid: true;
  canonical: boolean;
  diagnostics: Array<{
    code: "index-not-canonical";
    message: string;
  }>;
  revision: number;
  schemaVersion: typeof taskGraphSchemaVersion;
  taskCount: number;
  topTaskCount: number;
  nextTaskId: number;
};

type TaskIndexStageResultBase = {
  nextTaskId: number;
  selectedTaskIds: string[];
  taskCount: number;
};

export type TaskIndexStageResult = TaskIndexStageResultBase & ({
  changed: true;
  state: "staged";
} | {
  changed: false;
  state: "unchanged";
});

export type TaskContentInput = {
  title: string;
  goal: string;
  acceptance?: string[];
  context?: string | null;
  references?: Record<string, string>;
};

export type TaskControlInput =
  | { mode: "inherit" | "candidate" | "queued"; reason?: null }
  | { mode: "waiting" | "paused"; reason: string };

export type CreateTaskOperation = {
  kind: "create-task";
  alias?: string;
  content: TaskContentInput;
  parentId?: string | null;
  control?: TaskControlInput;
};

export type UpdateTaskContentOperation = {
  kind: "update-task-content";
  taskId: string;
  content: TaskContentInput;
};

export type UpdateTaskControlOperation = {
  kind: "update-task-control";
  taskId: string;
  control: TaskControlInput;
};

export type SetParentOperation = {
  kind: "set-parent";
  taskId: string;
  parentId: string | null;
};

export type SetDependencyOperation = {
  kind: "set-dependency";
  taskId: string;
  dependencyId: string;
  present: boolean;
};

export type SetExclusionOperation = {
  kind: "set-exclusion";
  taskId: string;
  excludedTaskId: string;
  present: boolean;
};

export type TaskGraphRevisionOperation =
  | CreateTaskOperation
  | UpdateTaskContentOperation
  | UpdateTaskControlOperation
  | SetParentOperation
  | SetDependencyOperation
  | SetExclusionOperation;

export type TaskGraphApplyRequest = {
  expectedRevision: number;
  operations: TaskGraphRevisionOperation[];
};

export type TaskGraphApplyResult = {
  aliases: Record<string, string>;
  createdTaskIds: string[];
};

export type RemoveTasksOptions = {
  expectedRevision: number;
  taskIds: string[];
  resultsDelivered: true;
};
