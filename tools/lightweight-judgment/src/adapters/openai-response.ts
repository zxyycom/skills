import { fail } from "../failure.ts";
import {
  orderedKeys,
  preserveKeyOrder,
  record,
  type JsonObject,
  type JsonValue
} from "../protocol/json.ts";
import type { Request, Question } from "../protocol/request.ts";
import type { NormalizedAnswer, NormalizedScore } from "./adapter-response.ts";
import { parseResponse } from "../protocol/response.ts";

type ChoiceQuestion = Extract<Question, { type: "choice" }>;
type ScoreQuestion = Extract<Question, { type: "score" }>;
type DistributionQuestion = ChoiceQuestion | ScoreQuestion;
type NativeResponse = JsonObject &
  Readonly<{ model: string; answers: readonly JsonValue[] }>;

function invalid(location: string, reason: string): never {
  return fail("invalid_response", location, reason);
}
function probability(value: JsonValue | undefined, location: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  )
    invalid(location, "概率或 confidence 须为 0–1 有限数值");
  return value;
}
function object(value: JsonValue | undefined, location: string): JsonObject {
  if (!record(value)) invalid(location, "需要对象");
  return value;
}

function distributionEntry(
  item: JsonObject,
  question: DistributionQuestion,
  location: string
): Readonly<{ key: string; label?: string }> {
  if (question.type === "choice") {
    if (typeof item.value !== "string")
      invalid(location, "Choice value 必须保留原字符串类型");
    return { key: item.value };
  }
  if (typeof item.value !== "number" || !Number.isSafeInteger(item.value))
    invalid(location, "Score value 须为等级整数索引");
  if (typeof item.label !== "string")
    invalid(location, "Score label 须为字符串");
  const criterion = question.criteria[item.value];
  const expected =
    typeof criterion === "string" ? criterion : String(item.value);
  if (item.label !== expected)
    invalid(location, "Score label 与请求等级不对应");
  return { key: String(item.value), label: item.label };
}

function orderedProbabilities(
  values: ReadonlyMap<string, number>,
  keys: readonly string[],
  location: string
): Readonly<Record<string, number>> {
  const probabilities: Record<string, number> = Object.create(null);
  for (const key of keys) {
    const value = values.get(key);
    if (value === undefined) invalid(location, "缺少候选概率");
    probabilities[key] = value;
  }
  preserveKeyOrder(probabilities, keys);
  return probabilities;
}

function readProbabilityVector(
  answer: JsonObject,
  question: DistributionQuestion,
  location: string
): Readonly<{
  probabilities: Readonly<Record<string, number>>;
  providerLabels: Readonly<Record<string, string>>;
}> {
  // Score criteria is a validated dense array: its own keys are ordinal indices.
  // Choice instead keeps the carrier's original string-key order.
  const keys = orderedKeys(question.criteria);
  if (!Array.isArray(answer.probabilities))
    invalid(location, "需要 probabilities 数组");
  if (answer.probabilities.length !== keys.length)
    invalid(location, "候选或等级数量不匹配");
  const values = new Map<string, number>();
  const labels: Record<string, string> = Object.create(null);
  for (const entry of answer.probabilities) {
    const item = object(entry, location);
    const { key, label } = distributionEntry(item, question, location);
    if (label !== undefined) labels[key] = label;
    if (!keys.includes(key) || values.has(key))
      invalid(location, "重复或未知候选/等级 value");
    values.set(key, probability(item.probability, location));
  }
  return {
    probabilities: orderedProbabilities(values, keys, location),
    providerLabels: labels
  };
}

function choiceAnswer(
  answer: JsonObject,
  question: ChoiceQuestion,
  location: string
): Extract<NormalizedAnswer, { type: "choice" }> {
  if (
    answer.type !== "choice" ||
    typeof answer.choice !== "string" ||
    !Object.hasOwn(question.criteria, answer.choice)
  )
    invalid(location, "Choice 类型或选择不匹配");
  return {
    status: "answered",
    type: "choice",
    choice: answer.choice,
    confidence: probability(answer.confidence, location),
    probabilities: readProbabilityVector(answer, question, location)
      .probabilities
  };
}
function scoreAnswer(
  answer: JsonObject,
  question: ScoreQuestion,
  location: string
): Readonly<{ status: "answered" }> & NormalizedScore {
  if (answer.type !== "score" || typeof answer.score !== "number")
    invalid(location, "Score 类型或数值范围不匹配");
  if (
    !Number.isFinite(answer.score) ||
    answer.score < 0 ||
    answer.score > question.criteria.length - 1
  )
    invalid(location, "Score 类型或数值范围不匹配");
  return {
    status: "answered",
    type: "score",
    score: answer.score,
    confidence: probability(answer.confidence, location),
    ...readProbabilityVector(answer, question, location),
    requestRubric: question.criteria
  };
}

function openaiAnswer(
  raw: JsonValue,
  question: Question,
  ordinal: number
): NormalizedAnswer {
  const location = `response.answers[${ordinal}]`;
  const answer = object(raw, location);
  if (answer.name !== `q${ordinal}`)
    invalid(location, "答案 name 或顺序不匹配");
  if (answer.type === "refusal")
    return { status: "refused", requestedType: question.type };
  switch (question.type) {
    case "box":
      return invalid(location, "OpenAI 不支持 Box");
    case "noul":
      if (answer.type !== "predicate") invalid(location, "答案 type 不匹配");
      return {
        status: "answered",
        type: "noul",
        noul: probability(answer.probability, location)
      };
    case "choice":
      return choiceAnswer(answer, question, location);
    case "score":
      return scoreAnswer(answer, question, location);
  }
}

function validateUsage(raw: JsonObject): void {
  const usage = object(raw.usage, "response.usage");
  for (const field of ["input_tokens", "output_tokens", "total_tokens"]) {
    const value = usage[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      invalid("response.usage", "usage 数量须为安全非负整数");
  }
}
function validateNativeResponse(
  raw: JsonValue,
  count: number
): asserts raw is NativeResponse {
  const reason = "需要 OpenAI 原生 model 与对应有序 answers";
  if (!record(raw)) return invalid("response", reason);
  if (
    typeof raw.model !== "string" ||
    !/^gpt-6-luna(?:-[A-Za-z0-9._-]+)?$/u.test(raw.model)
  )
    invalid("response", reason);
  if (!Array.isArray(raw.answers) || raw.answers.length !== count)
    invalid("response", reason);
  validateUsage(raw);
}

export function validateOpenaiResponse(
  text: string,
  request: Request
): Readonly<{
  result: NativeResponse;
  answers: Readonly<Record<string, NormalizedAnswer>>;
}> {
  const ids = orderedKeys(request.questions);
  const result = parseResponse(text);
  validateNativeResponse(result, ids.length);
  const answers: Record<string, NormalizedAnswer> = Object.create(null);
  for (const [ordinal, id] of ids.entries())
    answers[id] = openaiAnswer(
      result.answers[ordinal],
      request.questions[id],
      ordinal
    );
  return { result, answers };
}
