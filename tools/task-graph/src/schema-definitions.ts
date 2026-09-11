import * as v from "valibot";
import { taskGraphSchemaVersion } from "./types.ts";
import {
  aliasPatternSource,
  boundedText,
  leaseIdPatternSource,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  reasonSchema,
  referenceDictionarySchema,
  taskIdSchema,
  taskReferenceSchema,
  timestampSchema
} from "./schema-constraints.ts";
import { validateTaskIndexSemantics } from "./schema.ts";

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
export const taskIndexStructuralSchema = v.strictObject({
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
