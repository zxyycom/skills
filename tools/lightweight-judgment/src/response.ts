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
    answers: JsonObject;
  }>;

export const probabilityTolerance = 0.000001;

export const scoreTolerance = 0.000001;

function valid(path: string, condition: boolean, reason: string): void {
  if (!condition) {
    fail("invalid_response", path, reason);
  }
}

function probability(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
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

const probabilityMapSchema = v.custom<Readonly<Record<string, number>>>(
  (value) => record(value) && Object.values(value).every(probability)
);

const legendMapSchema = v.custom<Readonly<Record<string, string>>>(
  (value) =>
    record(value) &&
    Object.values(value).every((item) => typeof item === "string")
);

function distribution(
  answer: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  field: string
): Readonly<Record<string, number>> {
  const parsed = v.safeParse(probabilityMapSchema, answer.probabilities);
  if (!parsed.success) {
    fail(
      "invalid_response",
      `${field}.probabilities`,
      "概率须为 0–1 有限数值映射"
    );
  }
  valid(
    `${field}.probabilities`,
    sameKeys(parsed.output, keys),
    "概率键不匹配"
  );
  const sum = Object.values(parsed.output).reduce((total, p) => total + p, 0);
  valid(
    `${field}.probabilities`,
    Math.abs(sum - 1) <= probabilityTolerance + Number.EPSILON,
    "概率和不等于 1"
  );
  valid(
    `${field}.confidence`,
    probability(answer.confidence),
    "confidence 须为 0–1 有限数值"
  );
  return parsed.output;
}

function choiceResponse(
  answer: Readonly<Record<string, unknown>>,
  question: Extract<Question, { type: "choice" }>,
  field: string
): void {
  const keys = Object.keys(question.criteria);
  const probabilities = distribution(answer, keys, field);
  const choice = answer.choice;
  if (typeof choice !== "string" || !keys.includes(choice)) {
    fail("invalid_response", `${field}.choice`, "choice 不是候选键");
  }
  const max = Math.max(...Object.values(probabilities));
  valid(
    `${field}.choice`,
    Math.abs(probabilities[choice] - max) <=
      probabilityTolerance + Number.EPSILON,
    "choice 不是最大概率项"
  );
}

function scoreLegend(
  raw: unknown,
  levels: readonly unknown[],
  keys: readonly string[],
  field: string
): void {
  const parsed = v.safeParse(legendMapSchema, raw);
  if (!parsed.success) {
    fail("invalid_response", `${field}.legend`, "需要字符串 legend 映射");
  }
  valid(`${field}.legend`, sameKeys(parsed.output, keys), "legend 键不匹配");
  valid(
    `${field}.legend`,
    levels.every(
      (level, index) =>
        typeof level !== "string" || parsed.output[String(index)] === level
    ),
    "legend 与字符串等级不对应"
  );
}

function scoreResponse(
  answer: Readonly<Record<string, unknown>>,
  question: Extract<Question, { type: "score" }>,
  field: string
): void {
  const keys = question.criteria.map((_, index) => String(index));
  const probabilities = distribution(answer, keys, field);
  const weighted = keys.reduce(
    (total, key, index) => total + index * probabilities[key],
    0
  );
  const score = answer.score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    fail("invalid_response", `${field}.score`, "score 须为有限数值");
  }
  valid(
    `${field}.score`,
    score >= 0 && score <= keys.length - 1,
    "score 超出等级范围"
  );
  valid(
    `${field}.score`,
    Math.abs(score - weighted) <= scoreTolerance + Number.EPSILON,
    "score 与加权结果不一致"
  );
  scoreLegend(answer.legend, question.criteria, keys, field);
}

function answerResponse(raw: unknown, question: Question, field: string): void {
  if (!record(raw)) {
    fail("invalid_response", field, "需要答案对象");
  }
  valid(field, raw.type === question.type, "答案 type 不匹配");
  switch (question.type) {
    case "noul":
      valid(`${field}.noul`, probability(raw.noul), "需要 0–1 有限概率");
      break;
    case "choice":
      choiceResponse(raw, question, field);
      break;
    case "score":
      scoreResponse(raw, question, field);
      break;
  }
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
  if (!record(raw)) {
    fail("invalid_response", "response", "需要响应对象");
  }
  valid(
    "response.model",
    typeof raw.model === "string" &&
      /^(?:typesafe\/)?jev-[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(raw.model),
    "无法识别实际模型"
  );
  const answers = raw.answers;
  if (!record(answers)) {
    fail("invalid_response", "response.answers", "需要答案映射");
  }
  valid(
    "response.answers",
    sameKeys(answers, Object.keys(request.questions)),
    "答案 ID 集合不匹配"
  );
  for (const [ordinal, id] of orderedKeys(request.questions).entries()) {
    const question = request.questions[id];
    answerResponse(answers[id], question, `response.answers[${ordinal}]`);
  }
}

export function validateResponse(
  text: string,
  request: Request
): ValidatedResponse {
  const raw = parseResponse(text);
  validateResponseObject(raw, request);
  return raw;
}
