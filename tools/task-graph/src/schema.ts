import * as v from "valibot";
import { TaskGraphError } from "./errors.ts";
import { validateTaskIndexGraph } from "./graph.ts";
import { rejectReservedOwnKey } from "./schema-constraints.ts";
import {
  taskContentInputSchema,
  taskControlInputSchema,
  taskGraphApplyRequestSchema,
  taskIndexStructuralSchema,
  taskResultSchema
} from "./schema-definitions.ts";
import { taskGraphSchemaVersion } from "./types.ts";
import type {
  TaskControl,
  TaskControlInput,
  TaskContent,
  TaskContentInput,
  TaskEntry,
  TaskExecution,
  TaskGraphApplyRequest,
  TaskIndex,
  TaskResult
} from "./types.ts";
export {
  aliasPatternSource,
  dictionaryKeyPatternSource,
  isCanonicalTaskId,
  leaseIdPatternSource,
  taskGraphJsonSchemaOverrideAction,
  taskIdPatternSource,
  timestampPatternSource
} from "./schema-constraints.ts";
export {
  taskContentInputSchema,
  taskContentSchema,
  taskControlInputSchema,
  taskControlSchema,
  taskExecutionSchema,
  taskGraphApplyRequestSchema,
  taskIndexSchema,
  taskResultSchema
} from "./schema-definitions.ts";

function suffixNumber(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1));
}

export function validateTaskIndexSemantics(index: TaskIndex): string[] {
  const issues: string[] = [];
  const taskIds = Object.keys(index.tasks);
  const maximumTaskId = Math.max(0, ...taskIds.map(suffixNumber));
  if (index.nextTaskId <= maximumTaskId) {
    issues.push("nextTaskId must be greater than every allocated task id");
  }

  for (const [taskId, task] of Object.entries(index.tasks)) {
    if (task.state.relations.parentId === null) {
      if (task.state.control.mode === "inherit") {
        issues.push(`${taskId} top-level control cannot inherit`);
      }
    }
    const phase = task.state.execution.phase;
    if (phase === "succeeded" && task.content.result === null) {
      issues.push(`${taskId} succeeded task must have a result`);
    }
    if (phase !== "succeeded" && task.content.result !== null) {
      issues.push(`${taskId} non-succeeded task cannot have a result`);
    }
    if (task.state.timestamps.createdAt > task.state.timestamps.updatedAt) {
      issues.push(`${taskId} updatedAt cannot precede createdAt`);
    }
  }
  issues.push(...validateTaskIndexGraph(index));
  return issues;
}

function formatValibotIssue(issue: v.BaseIssue<unknown>): string {
  const path = issue.path?.map((item) => String(item.key)).join(".");
  return `${path === undefined || path === "" ? "$" : path}: ${issue.message}`;
}

export function parseTaskIndex(input: unknown): TaskIndex {
  if (
    typeof input === "object" &&
    input !== null &&
    Object.hasOwn(input, "schemaVersion") &&
    (input as { schemaVersion?: unknown }).schemaVersion !==
      taskGraphSchemaVersion
  ) {
    throw new TaskGraphError(
      "SCHEMA_UNSUPPORTED",
      `Unsupported task index schemaVersion: ${String((input as { schemaVersion?: unknown }).schemaVersion)}`
    );
  }
  rejectReservedOwnKey(input, "INDEX_INVALID");
  const structural = v.safeParse(taskIndexStructuralSchema, input);
  if (!structural.success) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      "Task index does not match the strict schema",
      { issues: structural.issues.map(formatValibotIssue) }
    );
  }
  const semanticIssues = validateTaskIndexSemantics(structural.output);
  if (semanticIssues.length > 0) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      "Task index violates semantic invariants",
      { issues: semanticIssues }
    );
  }
  return structural.output;
}

export function parseTaskGraphApplyRequest(
  input: unknown
): TaskGraphApplyRequest {
  rejectReservedOwnKey(input, "REQUEST_INVALID");
  const parsed = v.safeParse(taskGraphApplyRequestSchema, input);
  if (!parsed.success) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Apply request does not match the strict schema",
      { issues: parsed.issues.map(formatValibotIssue) }
    );
  }
  return parsed.output;
}

export function normalizeTaskContent(input: TaskContentInput): TaskContent {
  const parsed = v.parse(taskContentInputSchema, input);
  return {
    title: parsed.title,
    goal: parsed.goal,
    acceptance: [...(parsed.acceptance ?? [])],
    context: parsed.context ?? null,
    references: { ...parsed.references },
    result: null
  };
}

export function normalizeTaskControl(input: TaskControlInput): TaskControl {
  const parsed = v.parse(taskControlInputSchema, input);
  return parsed.mode === "waiting" || parsed.mode === "paused"
    ? { mode: parsed.mode, reason: parsed.reason }
    : { mode: parsed.mode, reason: null };
}

export function parseTaskResult(input: unknown): TaskResult {
  rejectReservedOwnKey(input, "REQUEST_INVALID");
  const parsed = v.safeParse(taskResultSchema, input);
  if (!parsed.success) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Task result does not match the strict schema",
      { issues: parsed.issues.map(formatValibotIssue) }
    );
  }
  return parsed.output;
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    )
  );
}

function canonicalResult(result: TaskResult | null): TaskResult | null {
  return result === null
    ? null
    : { summary: result.summary, references: sortedRecord(result.references) };
}

function canonicalExecution(execution: TaskExecution): TaskExecution {
  switch (execution.phase) {
    case "idle":
    case "succeeded":
      return { phase: execution.phase, attempt: execution.attempt };
    case "failed":
    case "cancelled":
      return {
        phase: execution.phase,
        attempt: execution.attempt,
        reason: execution.reason
      };
    case "running":
      return {
        phase: execution.phase,
        attempt: execution.attempt,
        lease: {
          id: execution.lease.id,
          actor: execution.lease.actor,
          claimedAt: execution.lease.claimedAt,
          renewedAt: execution.lease.renewedAt,
          expiresAt: execution.lease.expiresAt
        }
      };
  }
}

function canonicalTask(task: TaskEntry): TaskEntry {
  return {
    content: {
      title: task.content.title,
      goal: task.content.goal,
      acceptance: [...task.content.acceptance],
      context: task.content.context,
      references: sortedRecord(task.content.references),
      result: canonicalResult(task.content.result)
    },
    state: {
      control:
        task.state.control.mode === "waiting" ||
        task.state.control.mode === "paused"
          ? {
              mode: task.state.control.mode,
              reason: task.state.control.reason
            }
          : { mode: task.state.control.mode, reason: null },
      execution: canonicalExecution(task.state.execution),
      relations: {
        parentId: task.state.relations.parentId,
        dependsOn: sortedRecord(task.state.relations.dependsOn),
        excludes: sortedRecord(task.state.relations.excludes)
      },
      timestamps: {
        createdAt: task.state.timestamps.createdAt,
        updatedAt: task.state.timestamps.updatedAt
      }
    }
  };
}

export function canonicalTaskIndex(index: TaskIndex): TaskIndex {
  return {
    schemaVersion: taskGraphSchemaVersion,
    revision: index.revision,
    nextTaskId: index.nextTaskId,
    tasks: Object.fromEntries(
      Object.entries(index.tasks)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([taskId, task]) => [taskId, canonicalTask(task)])
    )
  };
}

export function serializeTaskIndex(index: TaskIndex): string {
  return `${JSON.stringify(canonicalTaskIndex(parseTaskIndex(index)), null, 2)}\n`;
}

export function emptyTaskIndex(): TaskIndex {
  return {
    schemaVersion: taskGraphSchemaVersion,
    revision: 0,
    nextTaskId: 1,
    tasks: {}
  };
}

export type { TaskContent, TaskControl, TaskEntry, TaskIndex };
