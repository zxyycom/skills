import assert from "node:assert/strict";
import test from "node:test";
import { validateAdapterResponse } from "../src/adapter-response.ts";
import { prepared, input, image, router } from "./adapter-fixture.ts";

test("Jev Box and structured Score legend preserve native values and reject invalid coordinates without inventing absence", async () => {
  const source = input(image(), {
    box: { type: "box", instructions: "locate" },
    score: {
      type: "score",
      instructions: "rate",
      criteria: [{ label: "low", details: ["none"] }, ["high"]]
    }
  });
  const { carrier } = await prepared(source, {
    ...router,
    images: true,
    longContext: true
  });
  const answer = {
    type: "box",
    box: { left: 0.1, top: 0.2, right: 0.9, bottom: 1 },
    confidence: 0.01
  };
  const raw = {
    model: "typesafe/jev-1.14-20261014",
    answers: {
      box: answer,
      score: {
        type: "score",
        score: 0.3,
        confidence: 0.1,
        probabilities: { "0": 0.7, "1": 0.3 },
        legend: { "0": { label: "low", details: ["none"] }, "1": ["high"] }
      }
    }
  };
  const value = validateAdapterResponse(
    JSON.stringify(raw),
    carrier,
    "openrouter-decisions"
  );
  assert.deepEqual(value.result, raw);
  assert.deepEqual(value.normalized.answers.box, {
    status: "answered",
    ...answer
  });
  assert.equal(Object.hasOwn(value.normalized.answers.box, "absent"), false);
  for (const box of [
    { left: 0, top: 0, right: 0, bottom: 1 },
    { left: 0, top: 1, right: 1, bottom: 0 },
    { left: 0, top: 0, right: 1.1, bottom: 1 },
    { left: 0, top: 0, right: 1 }
  ])
    assert.throws(
      () =>
        validateAdapterResponse(
          JSON.stringify({
            ...raw,
            answers: { ...raw.answers, box: { ...answer, box } }
          }),
          carrier,
          "openrouter-decisions"
        ),
      { kind: "invalid_response" }
    );
  assert.throws(
    () =>
      validateAdapterResponse(
        JSON.stringify({
          ...raw,
          answers: {
            ...raw.answers,
            score: {
              ...raw.answers.score,
              legend: { "0": { label: "wrong" }, "1": ["high"] }
            }
          }
        }),
        carrier,
        "openrouter-decisions"
      ),
    { kind: "invalid_response" }
  );
});
