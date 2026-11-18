/*
 * Synced TypeScript runtime; repository maintenance edits tools/agent-memory/src/input.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/agent-memory/src/input.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/agent-memory/src/input.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/agent-memory
 * Rebuild: bun run sync:agent-memory-cli
 */
import * as v from "valibot";
import { fail, MemoryError } from "./errors.ts";
import { closeOutcome, edgeType, forgetAction, memoryKind } from "./model.ts";

const text = (field: string) =>
  v.pipe(
    v.string(`${field} must be a nonempty string`),
    v.check((x) => x.trim().length > 0, `${field} must be a nonempty string`)
  );
const number = (field: string) =>
  v.pipe(
    v.number(`${field} must be a positive integer`),
    v.safeInteger(`${field} must be a positive integer`),
    v.minValue(1, `${field} must be a positive integer`)
  );
const object = <const T extends v.ObjectEntries>(fields: T) =>
  v.object(fields, "expected a JSON object");
const reference = {
  id: text("id"),
  expectedVersion: number("expectedVersion")
};
const edge = object({
  target: text("edge target"),
  version: number("edge version"),
  type: edgeType,
  role: text("edge role")
});
const edges = v.pipe(
  v.array(edge, "edges must be an array"),
  v.check(
    (entries) =>
      new Set(entries.map((e) => JSON.stringify([e.target, e.type]))).size ===
      entries.length,
    "duplicate edge"
  )
);
const strings = (field: string) =>
  v.pipe(
    v.array(text(field), `${field} must be an array of nonempty strings`),
    v.transform((entries) => [...new Set(entries)])
  );

const contentFields = {
  kind: memoryKind,
  title: text("title"),
  body: text("body"),
  source: text("source"),
  conditions: text("conditions")
};
const content = object({
  ...contentFields,
  reason: v.pipe(
    v.optional(v.unknown(), ""),
    v.transform((value) => (typeof value === "string" ? value : ""))
  ),
  tags: v.nullish(strings("tags"), []),
  edges: v.nullish(edges, [])
});
const changes = {
  ...v.partial(v.object(contentFields)).entries,
  tags: v.nullish(strings("tags")),
  edges: v.nullish(edges)
};
const batch = object({
  items: v.pipe(
    v.array(content, "items must be a nonempty array"),
    v.minLength(1, "items must be a nonempty array")
  )
});
const revise = object({
  ...reference,
  ...changes,
  reason: text("reason"),
  semanticChange: v.boolean("semanticChange must be boolean")
});
const review = object({
  ...reference,
  ...changes,
  reason: text("reason"),
  outcome: v.picklist(
    ["unchanged", "changed", "pending"],
    "invalid review outcome"
  )
});
const close = v.strictObject(
  {
    ...reference,
    outcome: closeOutcome,
    reason: text("reason")
  },
  "close does not accept content changes"
);
const show = object({ id: text("id"), version: v.optional(number("version")) });
const recall = v.pipe(
  object({
    tags: v.nullish(strings("tags"), []),
    terms: v.nullish(strings("terms"), []),
    limit: v.optional(number("limit"), 10)
  }),
  v.check(
    (query) => query.tags.length + query.terms.length > 0,
    "recall needs at least one tag or term"
  )
);
const preview = object({ id: text("id"), action: forgetAction });
const forget = v.variant(
  "action",
  [
    object({
      id: text("id"),
      confirm: text("confirm"),
      action: v.literal("purge")
    }),
    object({
      ...reference,
      confirm: text("confirm"),
      action: v.literal("disable")
    }),
    object({
      ...reference,
      confirm: text("confirm"),
      action: v.literal("hide")
    })
  ],
  "invalid forget action"
);

export const command = v.picklist(
  ["init", "save", "revise", "recall", "show", "review", "close", "forget"],
  "invalid command"
);
export type Command = v.InferOutput<typeof command>;
export type Content = Readonly<v.InferOutput<typeof content>>;
export type Edge = Readonly<v.InferOutput<typeof edge>>;
export type ContentPatch = Readonly<
  v.InferOutput<typeof revise> | v.InferOutput<typeof review>
>;
type Operation =
  | {
      readonly name: "save";
      readonly items: readonly Content[];
      readonly batch: boolean;
    }
  | {
      readonly name: "revise";
      readonly data: Readonly<v.InferOutput<typeof revise>>;
    }
  | {
      readonly name: "review";
      readonly data: Readonly<v.InferOutput<typeof review>>;
    }
  | {
      readonly name: "close";
      readonly data: Readonly<v.InferOutput<typeof close>>;
    }
  | {
      readonly name: "show";
      readonly data: Readonly<v.InferOutput<typeof show>>;
    }
  | {
      readonly name: "recall";
      readonly data: Readonly<v.InferOutput<typeof recall>>;
    }
  | {
      readonly name: "forget-preview";
      readonly data: Readonly<v.InferOutput<typeof preview>>;
    }
  | {
      readonly name: "forget";
      readonly data: Readonly<v.InferOutput<typeof forget>>;
    };

export type ReadOperation = Extract<
  Operation,
  { name: "show" | "recall" | "forget-preview" }
>;
export type WriteOperation = Exclude<Operation, ReadOperation>;
export type WriteRequest = Readonly<{
  name: "write";
  action: WriteOperation["name"];
  requestId: string;
  operation: WriteOperation | MemoryError;
}>;
export type Invocation =
  | ReadOperation
  | WriteRequest
  | { readonly name: "init" };

function validated<T extends v.GenericSchema>(
  schema: T,
  value: unknown
): v.InferOutput<T> {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  // Valibot default messages may interpolate the actual input. Expose only static issue messages.
  const issue = result.issues[0];
  // An object issue with a quoted expectation identifies a declared required key.
  if (issue.type === "object" && issue.expected?.startsWith('"')) {
    fail(`missing required field ${issue.expected}`);
  }
  return fail(issue.message);
}

function parseSave(input: object): Extract<WriteOperation, { name: "save" }> {
  if ("items" in input) {
    return { name: "save", items: validated(batch, input).items, batch: true };
  }
  return { name: "save", items: [validated(content, input)], batch: false };
}

export function parseInvocation(name: Command, input: unknown): Invocation {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("input must be a JSON object");
  }
  return parseObject(name, input);
}

function parseObject(name: Command, input: object): Invocation {
  switch (name) {
    case "init":
      return { name };
    case "show":
      return { name, data: validated(show, input) };
    case "recall":
      return { name, data: validated(recall, input) };
    case "forget":
      if (!("confirm" in input) && !("requestId" in input))
        return { name: "forget-preview", data: validated(preview, input) };
      return parseRequest(name, input);
    default:
      return parseRequest(name, input);
  }
}

function parseRequest(
  action: WriteOperation["name"],
  input: object
): WriteRequest {
  if (!("requestId" in input)) fail("requestId must be a nonempty string");
  const { requestId: rawId, ...payload } = input;
  const requestId = validated(text("requestId"), rawId);
  try {
    return {
      name: "write",
      action,
      requestId,
      operation: parseWrite(action, payload)
    };
  } catch (error) {
    if (!(error instanceof MemoryError)) throw error;
    // Preserve validation failure so request conflicts can take precedence over it.
    return { name: "write", action, requestId, operation: error };
  }
}

function parseWrite(
  name: WriteOperation["name"],
  input: object
): WriteOperation {
  switch (name) {
    case "save":
      return parseSave(input);
    case "revise":
      return { name, data: validated(revise, input) };
    case "review":
      return { name, data: validated(review, input) };
    case "close":
      return { name, data: validated(close, input) };
    case "forget":
      return { name, data: validated(forget, input) };
  }
}
