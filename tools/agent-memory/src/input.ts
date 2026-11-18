import * as v from "valibot";
import { fail, MemoryError } from "./errors.ts";
import { closeOutcome, edgeType, forgetAction, memoryKind } from "./model.ts";

const unicodeString = (field: string) =>
  v.pipe(
    v.string(`${field} must be a string`),
    v.check((value) => value.isWellFormed(), "must contain valid Unicode")
  );
const text = (field: string) =>
  v.pipe(
    unicodeString(field),
    v.check((x) => x.trim().length > 0, `${field} must be a nonempty string`)
  );
const number = (field: string) =>
  v.pipe(
    v.number(`${field} must be a positive integer`),
    v.safeInteger(`${field} must be a positive integer`),
    v.minValue(1, `${field} must be a positive integer`)
  );
function strictObject<const T extends v.ObjectEntries>(
  fields: T,
  unknownFieldMessage = "unknown field in JSON object"
) {
  // Valibot checks entry membership with `in`; inherited names aren't fields.
  Object.setPrototypeOf(fields, null);
  return v.strictObject(fields, (issue) =>
    issue.expected === "never" ? unknownFieldMessage : "expected a JSON object"
  );
}
const init = strictObject({});
const reference = {
  id: text("id"),
  expectedVersion: number("expectedVersion")
};
const edge = strictObject({
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
  ),
  v.readonly()
);
const strings = (field: string) =>
  v.pipe(
    v.array(text(field), `${field} must be an array of nonempty strings`),
    v.transform((entries) => [...new Set(entries)]),
    v.readonly()
  );

const contentFields = {
  kind: memoryKind,
  title: text("title"),
  body: text("body"),
  source: text("source"),
  conditions: text("conditions")
};
const content = strictObject({
  ...contentFields,
  reason: v.optional(unicodeString("reason"), ""),
  tags: v.nullish(strings("tags"), []),
  edges: v.nullish(edges, [])
});
const changes = {
  ...v.partial(v.object(contentFields)).entries,
  tags: v.nullish(strings("tags")),
  edges: v.nullish(edges)
};
const batch = strictObject({
  items: v.pipe(
    v.array(content, "items must be a nonempty array"),
    v.minLength(1, "items must be a nonempty array")
  )
});
const revise = strictObject({
  ...reference,
  ...changes,
  reason: text("reason"),
  semanticChange: v.boolean("semanticChange must be boolean")
});
const review = strictObject({
  ...reference,
  ...changes,
  reason: text("reason"),
  outcome: v.picklist(
    ["unchanged", "changed", "pending"],
    "invalid review outcome"
  )
});
const close = strictObject(
  {
    ...reference,
    outcome: closeOutcome,
    reason: text("reason")
  },
  "close does not accept content changes"
);
const show = strictObject({
  id: text("id"),
  version: v.optional(number("version"))
});
const recall = v.pipe(
  strictObject({
    tags: v.nullish(strings("tags"), []),
    terms: v.nullish(strings("terms"), []),
    limit: v.optional(number("limit"), 10)
  }),
  v.check(
    (query) => query.tags.length + query.terms.length > 0,
    "recall needs at least one tag or term"
  )
);
const preview = strictObject({ id: text("id"), action: forgetAction });
const forget = v.variant(
  "action",
  [
    strictObject({
      id: text("id"),
      expectedVersion: v.optional(number("expectedVersion")),
      confirm: text("confirm"),
      action: v.literal("purge")
    }),
    strictObject({
      ...reference,
      confirm: text("confirm"),
      action: v.picklist(["disable", "hide"], "invalid forget action")
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
  return fail(validationMessage(result.issues[0]));
}

function validationMessage(issue: v.BaseIssue<unknown>): string {
  const path = issue.path ?? [];
  if (issue.type === "strict_object") {
    const expected = issue.expected ?? "";
    if (expected === "never") {
      return fieldMessage(path.slice(0, -1), issue.message);
    }
    if (expected.startsWith('"')) {
      return fieldMessage(path, "missing required field");
    }
  }
  return fieldMessage(path, issue.message);
}

function fieldMessage(
  path: readonly v.IssuePathItem[],
  message: string
): string {
  let location = "";
  // Only declared keys and array offsets are trusted, never the offending key or value.
  for (const item of path) {
    if (item.type === "array") location += `[${item.key}]`;
    if (item.type === "object")
      location += location ? `.${item.key}` : item.key;
  }
  return location === "" ? message : `${location}: ${message}`;
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
  switch (name) {
    case "init":
      validated(init, input);
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
