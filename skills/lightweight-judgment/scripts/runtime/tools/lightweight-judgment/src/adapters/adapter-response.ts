/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/adapters/adapter-response.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/adapters/adapter-response.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/adapters/adapter-response.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import {
  adapterContract,
  type Adapter,
  type AdapterContract
} from "./adapter-contract.ts";
import {
  orderedKeys,
  preserveKeyOrder,
  type JsonObject
} from "../protocol/json.ts";
import { validateOpenaiResponse } from "./openai-response.ts";
import type { Request, Question, Structured } from "../protocol/request.ts";
import {
  validateResponse,
  type ValidatedResponse
} from "../protocol/response.ts";

type Probabilities = Readonly<Record<string, number>>;
type ScoreFields = Readonly<{
  type: "score";
  score: number;
  probabilities: Probabilities;
  confidence: number;
  requestRubric: readonly Structured[];
}>;
export type NormalizedScore = ScoreFields &
  (
    | Readonly<{ legend: JsonObject }>
    | Readonly<{
        providerLabels: Readonly<Record<string, string>>;
      }>
  );
export type NormalizedAnswer =
  | (Readonly<{ status: "answered" }> &
      (
        | Readonly<{ type: "noul"; noul: number }>
        | Readonly<{
            type: "choice";
            choice: string;
            probabilities: Probabilities;
            confidence: number;
          }>
        | NormalizedScore
        | Readonly<{
            type: "box";
            box: Readonly<{
              top: number;
              bottom: number;
              left: number;
              right: number;
            }>;
            confidence: number;
          }>
      ))
  | Readonly<{ status: "refused"; requestedType: Question["type"] }>;

export type NormalizedResponse = JsonObject &
  Readonly<{
    version: "1";
    adapterContract: AdapterContract;
    model: string;
    completion: "complete" | "partial" | "refused";
    answers: Readonly<Record<string, NormalizedAnswer>>;
  }>;
export type AdapterResponse = Readonly<{
  result: JsonObject & Readonly<{ model: string }>;
  normalized: NormalizedResponse;
}>;

function jevAnswer(
  native: ValidatedResponse["answers"][string],
  question: Question
): NormalizedAnswer {
  switch (native.type) {
    case "noul":
      return { status: "answered", type: "noul", noul: native.noul };
    case "choice":
      return {
        status: "answered",
        type: "choice",
        choice: native.choice,
        probabilities: native.probabilities,
        confidence: native.confidence
      };
    case "score":
      // The response boundary checked each answer against this exact question.
      // Keep that correlation explicit when accessing the request-only rubric.
      if (question.type !== "score")
        throw new Error("Validated Score answer has no request rubric");
      return {
        status: "answered",
        type: "score",
        score: native.score,
        probabilities: native.probabilities,
        confidence: native.confidence,
        legend: native.legend,
        requestRubric: question.criteria
      };
    case "box":
      return {
        status: "answered",
        type: "box",
        box: native.box,
        confidence: native.confidence
      };
  }
}
function validateJevResponse(
  text: string,
  request: Request,
  responseRequest: Request
): Readonly<{
  result: AdapterResponse["result"];
  answers: Readonly<Record<string, NormalizedAnswer>>;
}> {
  const result = validateResponse(text, responseRequest);
  const answers: Record<string, NormalizedAnswer> = Object.create(null);
  for (const id of orderedKeys(request.questions))
    answers[id] = jevAnswer(result.answers[id], request.questions[id]);
  return { result, answers };
}
function completion(
  answers: Readonly<Record<string, NormalizedAnswer>>
): NormalizedResponse["completion"] {
  const values = Object.values(answers);
  const refused = values.filter((answer) => answer.status === "refused").length;
  if (refused === 0) return "complete";
  return refused === values.length ? "refused" : "partial";
}

export function validateAdapterResponse(
  text: string,
  request: Request,
  adapter: Adapter,
  responseRequest: Request = request
): AdapterResponse {
  const { result, answers } =
    adapter === "openai-decisions"
      ? validateOpenaiResponse(text, request)
      : validateJevResponse(text, request, responseRequest);
  preserveKeyOrder(answers, orderedKeys(request.questions));
  return {
    result,
    normalized: {
      version: "1",
      adapterContract: adapterContract(adapter),
      model: result.model,
      completion: completion(answers),
      answers
    }
  };
}
