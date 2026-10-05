import * as v from "valibot";
import { fail, JudgmentFailure } from "./failure.ts";
import {
  parseJson,
  record,
  orderedKeys,
  type JsonValue,
  type JsonObject
} from "./json.ts";
import type { Question, Request } from "./request.ts";

export type ValidatedResponse = JsonObject &
  Readonly<{
    model: string;
    answers: Readonly<
      Record<
        string,
        JsonObject & Readonly<v.InferOutput<ReturnType<typeof answerSchema>>>
      >
    >;
  }>;

function probabilitySchema(message: string) {
  return v.pipe(
    v.number(message),
    v.finite(message),
    v.minValue(0, message),
    v.maxValue(1, message)
  );
}

function sameKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function distributionEntries(keys: readonly string[]) {
  const probability = probabilitySchema("概率须为 0–1 有限数值");
  return {
    probabilities: v.pipe(
      // 自定义映射保留并检查全部 own key，包括原型同名候选。
      v.custom<Readonly<Record<string, number>>>(
        (value) =>
          record(value) &&
          Object.values(value).every((item) => v.is(probability, item)),
        "概率须为 0–1 有限数值映射"
      ),
      v.check((value) => sameKeys(value, keys), "概率键不匹配")
    ),
    confidence: probabilitySchema("confidence 须为 0–1 有限数值")
  };
}

function protocolObject<const Entries extends v.ObjectEntries>(
  entries: Entries,
  message: string
) {
  return v.pipe(
    // 协议对象不接受数组；Valibot object 本身接受任意非空 object。
    v.custom<Readonly<Record<string, unknown>>>(record, message),
    v.object(entries, (issue) => {
      // 缺失字段沿用其字段 Schema 的原因，而非 object 的整体形状诊断。
      const key = issue.path?.[0]?.key;
      if (typeof key === "string" && Object.hasOwn(entries, key)) {
        const missing = v.safeParse(entries[key], undefined, {
          abortEarly: true
        });
        if (!missing.success) return missing.issues[0].message;
      }
      return message;
    })
  );
}

function scoreResponseSchema(question: Extract<Question, { type: "score" }>) {
  const keys = question.criteria.map((_, index) => String(index));
  return protocolObject(
    {
      type: v.literal("score", "答案 type 不匹配"),
      ...distributionEntries(keys),
      score: v.pipe(
        v.number("score 须为有限数值"),
        v.finite("score 须为有限数值"),
        v.minValue(0, "score 超出等级范围"),
        v.maxValue(keys.length - 1, "score 超出等级范围")
      ),
      legend: v.pipe(
        v.custom<Readonly<Record<string, string>>>(
          (value) =>
            record(value) &&
            Object.values(value).every((item) => typeof item === "string"),
          "需要字符串 legend 映射"
        ),
        v.check((value) => sameKeys(value, keys), "legend 键不匹配"),
        v.check(
          (value) =>
            question.criteria.every(
              (level, index) =>
                typeof level !== "string" || value[String(index)] === level
            ),
          "legend 与字符串等级不对应"
        )
      )
    },
    "需要答案对象"
  );
}

function answerSchema(question: Question) {
  switch (question.type) {
    case "noul":
      return protocolObject(
        {
          type: v.literal("noul", "答案 type 不匹配"),
          noul: probabilitySchema("需要 0–1 有限概率")
        },
        "需要答案对象"
      );
    case "choice":
      return protocolObject(
        {
          type: v.literal("choice", "答案 type 不匹配"),
          ...distributionEntries(Object.keys(question.criteria)),
          choice: v.pipe(
            v.string("choice 不是候选键"),
            v.check(
              (value) => Object.hasOwn(question.criteria, value),
              "choice 不是候选键"
            )
          )
        },
        "需要答案对象"
      );
    case "score":
      return scoreResponseSchema(question);
  }
}

const responseSchema = protocolObject(
  {
    model: v.pipe(
      v.string("无法识别实际模型"),
      v.regex(
        /^(?:typesafe\/)?jev-[A-Za-z0-9][A-Za-z0-9._-]*$/u,
        "无法识别实际模型"
      )
    ),
    answers: v.custom<Readonly<Record<string, unknown>>>(record, "需要答案映射")
  },
  "需要响应对象"
);

function validateSchema<Schema extends v.GenericSchema>(
  schema: Schema,
  raw: unknown,
  field: string
): v.InferOutput<Schema> {
  const parsed = v.safeParse(schema, raw, { abortEarly: true });
  if (!parsed.success) {
    const issue = parsed.issues[0];
    // Schema 路径只含固定协议字段；动态问题与候选映射不展开原始键。
    const fields = issue.path?.map(({ key }) => String(key)) ?? [];
    // type 诊断定位答案整体，维持既有协议位置。
    if (fields.at(-1) === "type") fields.pop();
    fail("invalid_response", [field, ...fields].join("."), issue.message);
  }
  return parsed.output;
}

function parseResponse(text: string): JsonValue {
  try {
    return parseJson(text, "invalid_response", "response");
  } catch (error) {
    if (error instanceof JudgmentFailure && error.validation !== undefined) {
      // JSON paths can contain arbitrary remote keys. Only the parser's static reason is safe.
      fail("invalid_response", "response.json", error.validation.reason);
    }
    throw error;
  }
}

function validateResponseObject(
  raw: JsonValue,
  request: Request
): asserts raw is ValidatedResponse {
  const { answers } = validateSchema(responseSchema, raw, "response");
  if (!sameKeys(answers, Object.keys(request.questions))) {
    fail("invalid_response", "response.answers", "答案 ID 集合不匹配");
  }
  for (const [ordinal, id] of orderedKeys(request.questions).entries()) {
    const question = request.questions[id];
    validateSchema(
      answerSchema(question),
      answers[id],
      `response.answers[${ordinal}]`
    );
  }
}

export function validateResponse(
  text: string,
  request: Request
): ValidatedResponse {
  const raw = parseResponse(text);
  validateResponseObject(raw, request);
  // Schema 只提供验证与类型证据；返回原对象，保留额外字段和原始键顺序。
  return raw;
}
