import * as v from "valibot";
import { TaskGraphError } from "./errors.ts";
import { validateTaskIndexGraph } from "./graph.ts";
import {
  taskGraphSchemaVersion,
  type TaskControl,
  type TaskControlInput,
  type TaskContent,
  type TaskContentInput,
  type TaskEntry,
  type TaskExecution,
  type TaskGraphApplyRequest,
  type TaskIndex,
  type TaskResult
} from "./types.ts";

const positiveCanonicalIdSuffixPatternSource =
  "(?:(?!000000$)[0-9]{6}|[1-9][0-9]{6,15})";
export const taskIdPatternSource = `^task-${positiveCanonicalIdSuffixPatternSource}$`;
export const leaseIdPatternSource =
  "^lease-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
export const dictionaryKeyPatternSource =
  "^(?!(?:constructor|prototype|__proto__)$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$";
export const aliasPatternSource = "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$";
export const timestampPatternSource =
  "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$";

const unicodeLength = (value: string): number => Array.from(value).length;

const reservedObjectKeys = new Set(["__proto__", "constructor", "prototype"]);

function findReservedOwnKey(
  input: unknown,
  path = "$",
  seen = new WeakSet<object>()
): { key: string; path: string } | null {
  if (input === null || typeof input !== "object" || seen.has(input))
    return null;
  seen.add(input);
  for (const key of Object.keys(input)) {
    if (reservedObjectKeys.has(key)) return { key, path };
    const found = findReservedOwnKey(
      (input as Record<string, unknown>)[key],
      Array.isArray(input) ? `${path}[${key}]` : `${path}.${key}`,
      seen
    );
    if (found !== null) return found;
  }
  return null;
}

function rejectReservedOwnKey(
  input: unknown,
  code: "INDEX_INVALID" | "REQUEST_INVALID"
): void {
  const found = findReservedOwnKey(input);
  if (found === null) return;
  throw new TaskGraphError(
    code,
    `Reserved object key ${found.key} is not allowed`,
    {
      issues: [`${found.path}: reserved object key ${found.key} is not allowed`]
    }
  );
}

type BoundedTextConstraint = {
  maximum: number;
  minimum: number;
  pattern: string;
};

const boundedTextConstraints = new WeakMap<object, BoundedTextConstraint>();

function boundedTextPattern(singleLine: boolean): string {
  const lineConstraint = singleLine ? "(?![\\s\\S]*[\\r\\n])" : "";
  return `^${lineConstraint}(?!\\s)(?:[\\s\\S]*\\S)?$`;
}

export function taskGraphJsonSchemaOverrideAction(context: {
  valibotAction: object;
}):
  | {
      type: "string";
      minLength: number;
      maxLength: number;
      pattern: string;
    }
  | undefined {
  const constraint = boundedTextConstraints.get(context.valibotAction);
  if (constraint === undefined) return undefined;
  return {
    type: "string",
    minLength: constraint.minimum,
    maxLength: constraint.maximum,
    pattern: constraint.pattern
  };
}

function boundedText(
  label: string,
  minimum: number,
  maximum: number,
  options: { singleLine?: boolean } = {}
) {
  const constraint = {
    maximum,
    minimum,
    pattern: boundedTextPattern(options.singleLine === true)
  } satisfies BoundedTextConstraint;
  const runtimeConstraint = v.check(
    (value: string) =>
      unicodeLength(value) >= minimum &&
      unicodeLength(value) <= maximum &&
      value.trim() === value &&
      (options.singleLine !== true || !/[\r\n]/u.test(value)),
    `${label} must contain ${minimum} to ${maximum} Unicode code points, ` +
      "have no surrounding whitespace, and satisfy its line policy"
  );
  boundedTextConstraints.set(runtimeConstraint, constraint);
  return v.pipe(v.string(`${label} must be a string`), runtimeConstraint);
}

const nonNegativeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.minValue(0, "must be non-negative"),
  v.maxValue(Number.MAX_SAFE_INTEGER, "must be a safe integer")
);
const positiveIntegerSchema = v.pipe(
  nonNegativeIntegerSchema,
  v.minValue(1, "must be positive")
);
export function isCanonicalTaskId(value: string): boolean {
  const suffix = value.slice("task-".length);
  const number = Number(suffix);
  return (
    Number.isSafeInteger(number) &&
    number >= 1 &&
    `task-${String(number).padStart(6, "0")}` === value
  );
}
const taskIdSchema = v.pipe(
  v.string("task id must be a string"),
  v.regex(new RegExp(taskIdPatternSource, "u"), "must be a canonical task id"),
  v.check(
    (value) => isCanonicalTaskId(value),
    "must contain a positive safe canonical task number"
  )
);
const taskReferenceSchema = v.pipe(
  v.string("task reference must be a string"),
  v.regex(
    new RegExp(
      `^(?:task-${positiveCanonicalIdSuffixPatternSource}|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$`,
      "u"
    ),
    "must be a canonical task id or apply alias"
  ),
  v.check(
    (value) => value.startsWith("@") || isCanonicalTaskId(value),
    "must contain a positive safe canonical task number or apply alias"
  )
);
const dictionaryKeySchema = v.pipe(
  v.string("dictionary key must be a string"),
  v.regex(
    new RegExp(dictionaryKeyPatternSource, "u"),
    "must be a kebab-case dictionary key"
  ),
  v.maxLength(80, "dictionary key must be at most 80 characters")
);
const timestampSchema = v.pipe(
  v.string("timestamp must be a string"),
  v.regex(
    new RegExp(timestampPatternSource, "u"),
    "must be a millisecond UTC RFC 3339 timestamp"
  ),
  v.check((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
  }, "must be a real canonical UTC instant")
);
const reasonSchema = boundedText("reason", 1, 1000);
const referenceValueSchema = boundedText("reference", 1, 500);
const referenceDictionarySchema = v.record(
  dictionaryKeySchema,
  referenceValueSchema
);

export const taskResultSchema = v.strictObject({
  summary: boundedText("result summary", 1, 1000),
  references: referenceDictionarySchema
});

export const taskContentSchema = v.strictObject({
  title: boundedText("task title", 1, 120, { singleLine: true }),
  goal: boundedText("task goal", 1, 1000),
  acceptance: v.pipe(
    v.array(boundedText("acceptance item", 1, 300)),
    v.maxLength(20, "acceptance must contain at most 20 items")
  ),
  context: v.nullable(boundedText("task context", 1, 2000)),
  references: referenceDictionarySchema,
  result: v.nullable(taskResultSchema)
});

export const taskContentInputSchema = v.strictObject({
  title: boundedText("task title", 1, 120, { singleLine: true }),
  goal: boundedText("task goal", 1, 1000),
  acceptance: v.optional(
    v.pipe(
      v.array(boundedText("acceptance item", 1, 300)),
      v.maxLength(20, "acceptance must contain at most 20 items")
    )
  ),
  context: v.optional(v.nullable(boundedText("task context", 1, 2000))),
  references: v.optional(referenceDictionarySchema)
});

const controlNoReasonSchema = (mode: "inherit" | "candidate" | "queued") =>
  v.strictObject({
    mode: v.literal(mode),
    reason: v.null()
  });
const controlWithReasonSchema = (mode: "waiting" | "paused") =>
  v.strictObject({
    mode: v.literal(mode),
    reason: reasonSchema
  });

export const taskControlSchema = v.variant("mode", [
  controlNoReasonSchema("inherit"),
  controlNoReasonSchema("candidate"),
  controlNoReasonSchema("queued"),
  controlWithReasonSchema("waiting"),
  controlWithReasonSchema("paused")
]);

export const taskControlInputSchema = v.variant("mode", [
  v.strictObject({
    mode: v.literal("inherit"),
    reason: v.optional(v.null())
  }),
  v.strictObject({
    mode: v.literal("candidate"),
    reason: v.optional(v.null())
  }),
  v.strictObject({
    mode: v.literal("queued"),
    reason: v.optional(v.null())
  }),
  controlWithReasonSchema("waiting"),
  controlWithReasonSchema("paused")
]);

export const taskLeaseSchema = v.strictObject({
  id: v.pipe(
    v.string("lease id must be a string"),
    v.regex(
      new RegExp(leaseIdPatternSource, "u"),
      "must be a canonical lease id"
    )
  ),
  actor: boundedText("actor", 1, 200, { singleLine: true }),
  claimedAt: timestampSchema,
  renewedAt: timestampSchema,
  expiresAt: timestampSchema
});

export const taskExecutionSchema = v.variant("phase", [
  v.strictObject({
    phase: v.literal("idle"),
    attempt: nonNegativeIntegerSchema
  }),
  v.strictObject({
    phase: v.literal("running"),
    attempt: positiveIntegerSchema,
    lease: taskLeaseSchema
  }),
  v.strictObject({
    phase: v.literal("succeeded"),
    attempt: nonNegativeIntegerSchema
  }),
  v.strictObject({
    phase: v.literal("failed"),
    attempt: positiveIntegerSchema,
    reason: reasonSchema
  }),
  v.strictObject({
    phase: v.literal("cancelled"),
    attempt: nonNegativeIntegerSchema,
    reason: reasonSchema
  })
]);

const relationSetSchema = v.record(taskIdSchema, v.literal(true));
const taskRelationsSchema = v.strictObject({
  parentId: v.nullable(taskIdSchema),
  dependsOn: relationSetSchema,
  excludes: relationSetSchema
});
const timestampsSchema = v.strictObject({
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});
const taskStateSchema = v.strictObject({
  control: taskControlSchema,
  execution: taskExecutionSchema,
  relations: taskRelationsSchema,
  timestamps: timestampsSchema
});
const taskEntrySchema = v.strictObject({
  content: taskContentSchema,
  state: taskStateSchema
});
const taskIndexStructuralSchema = v.strictObject({
  schemaVersion: v.literal(taskGraphSchemaVersion),
  revision: nonNegativeIntegerSchema,
  nextTaskId: positiveIntegerSchema,
  tasks: v.record(taskIdSchema, taskEntrySchema)
});

export const taskIndexSchema = v.pipe(
  taskIndexStructuralSchema,
  v.check(
    (index) => validateTaskIndexSemantics(index).length === 0,
    "task index semantic invariants are invalid"
  )
);

const createTaskOperationSchema = v.strictObject({
  kind: v.literal("create-task"),
  alias: v.optional(
    v.pipe(
      v.string("alias must be a string"),
      v.regex(
        new RegExp(aliasPatternSource, "u"),
        "must be a kebab-case alias"
      ),
      v.maxLength(80, "alias must be at most 80 characters")
    )
  ),
  content: taskContentInputSchema,
  parentId: v.optional(v.nullable(taskReferenceSchema)),
  control: v.optional(taskControlInputSchema)
});
const updateTaskContentOperationSchema = v.strictObject({
  kind: v.literal("update-task-content"),
  taskId: taskReferenceSchema,
  content: taskContentInputSchema
});
const updateTaskControlOperationSchema = v.strictObject({
  kind: v.literal("update-task-control"),
  taskId: taskReferenceSchema,
  control: taskControlInputSchema
});
const setParentOperationSchema = v.strictObject({
  kind: v.literal("set-parent"),
  taskId: taskReferenceSchema,
  parentId: v.nullable(taskReferenceSchema)
});
const setDependencyOperationSchema = v.strictObject({
  kind: v.literal("set-dependency"),
  taskId: taskReferenceSchema,
  dependencyId: taskReferenceSchema,
  present: v.boolean()
});
const setExclusionOperationSchema = v.strictObject({
  kind: v.literal("set-exclusion"),
  taskId: taskReferenceSchema,
  excludedTaskId: taskReferenceSchema,
  present: v.boolean()
});

export const taskGraphApplyRequestSchema = v.strictObject({
  expectedRevision: nonNegativeIntegerSchema,
  operations: v.pipe(
    v.array(
      v.variant("kind", [
        createTaskOperationSchema,
        updateTaskContentOperationSchema,
        updateTaskControlOperationSchema,
        setParentOperationSchema,
        setDependencyOperationSchema,
        setExclusionOperationSchema
      ])
    ),
    v.minLength(1, "apply must include at least one operation"),
    v.maxLength(200, "apply must include at most 200 operations")
  )
});

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
