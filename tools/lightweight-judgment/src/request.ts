import * as v from "valibot";
import { fail, type FailureKind } from "./failure.ts";
import {
  orderedKeys,
  preserveKeyOrder,
  hasOnlyFields,
  record,
  type JsonValue,
  type JsonObject
} from "./json.ts";

export const defaultModel = "typesafe/jev-1.13";

export const endpoint = "https://openrouter.ai/api/v1/systemone";

export type Structured = string | readonly JsonValue[] | JsonObject;

export type Question = Readonly<
  | {
      type: "choice";
      instructions: Structured;
      criteria: Readonly<Record<string, Structured | null>>;
    }
  | { type: "score"; instructions: Structured; criteria: readonly Structured[] }
  | {
      type: "noul";
      instructions: Structured;
      criteria?: Readonly<Partial<Record<"true" | "false", Structured>>>;
    }
>;

export type Request = Readonly<{
  model: JevModel;
  state: Structured;
  questions: Readonly<Record<string, Question>>;
}>;

const modelSchema = v.pipe(
  v.string(),
  v.regex(/^(?:~?typesafe\/)?jev-[a-zA-Z0-9][a-zA-Z0-9._-]*$/u),
  v.brand("JevRequestModel")
);

export type JevModel = v.InferOutput<typeof modelSchema>;

export function validateModel(
  value: unknown,
  kind: FailureKind,
  path: string
): JevModel {
  const parsed = v.safeParse(modelSchema, value);
  if (!parsed.success) {
    fail(
      kind,
      path,
      "需要 bare jev-*、typesafe/jev-* 或 ~typesafe/jev-* 模型标识"
    );
  }
  return parsed.output;
}

function structured(value: unknown): value is Structured {
  return typeof value === "string" || record(value) || Array.isArray(value);
}

const structuredSchema = v.custom<Structured>(structured);

const choiceCriteria = v.pipe(
  v.custom<Record<string, Structured | null>>(
    (value) =>
      record(value) &&
      Object.values(value).every((item) => item === null || structured(item))
  ),
  v.check(
    (value) =>
      Object.keys(value).length >= 1 && Object.keys(value).length <= 255
  )
);

const questionSchema = v.variant("type", [
  v.strictObject({
    type: v.literal("choice"),
    instructions: structuredSchema,
    criteria: choiceCriteria
  }),
  v.strictObject({
    type: v.literal("score"),
    instructions: structuredSchema,
    criteria: v.pipe(v.array(structuredSchema), v.minLength(2), v.maxLength(10))
  }),
  v.strictObject({
    type: v.literal("noul"),
    instructions: structuredSchema,
    criteria: v.optional(
      v.strictObject({
        true: v.optional(structuredSchema),
        false: v.optional(structuredSchema)
      })
    )
  })
]);

function validateQuestion(raw: unknown, field: string): Question {
  if (!hasOnlyFields(raw, ["type", "instructions", "criteria"])) {
    fail("input", field, "问题包含未知字段或不是对象");
  }
  if (
    raw.type === "noul" &&
    raw.criteria !== undefined &&
    !hasOnlyFields(raw.criteria, ["true", "false"])
  ) {
    fail("input", `${field}.criteria`, "Noul criteria 仅接受 true/false 对象");
  }
  const parsed = v.safeParse(questionSchema, raw);
  if (!parsed.success) {
    fail("input", field, "问题 type、instructions 或 criteria 不符合原生契约");
  }
  const question = parsed.output;
  if (question.type === "choice" && record(raw.criteria)) {
    preserveKeyOrder(question.criteria, orderedKeys(raw.criteria));
  }
  return question;
}

const requestSchema = v.strictObject({
  state: structuredSchema,
  questions: v.custom<Record<string, unknown>>(record),
  model: v.optional(v.string())
});

export function validateRequest(
  input: JsonValue,
  modelOverride: string | undefined,
  configModel: JevModel
): Request {
  if (!hasOnlyFields(input, ["state", "questions", "model"])) {
    fail("input", "$", "请求不是对象或包含未知顶层字段");
  }
  const parsed = v.safeParse(requestSchema, input);
  if (!parsed.success) {
    fail(
      "input",
      "$",
      "需要 state、非空 questions 与可选 model，不接受其他字段"
    );
  }
  const questions = parsed.output.questions;
  const keys = orderedKeys(questions);
  if (keys.length === 0) {
    fail("input", "$.questions", "问题集合不能为空");
  }
  const validated: Record<string, Question> = Object.create(null);
  for (const id of keys) {
    validated[id] = validateQuestion(
      questions[id],
      `$.questions[${JSON.stringify(id)}]`
    );
  }
  preserveKeyOrder(validated, keys);
  const requestModel =
    parsed.output.model === undefined
      ? undefined
      : validateModel(parsed.output.model, "input", "$.model");
  const overrideModel =
    modelOverride === undefined
      ? undefined
      : validateModel(modelOverride, "input", "--model");
  return {
    state: parsed.output.state,
    questions: validated,
    model: overrideModel ?? requestModel ?? configModel
  };
}
