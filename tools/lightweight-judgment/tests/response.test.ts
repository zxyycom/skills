import assert from "node:assert/strict";
import test from "node:test";
import { validateResponse } from "../src/response.ts";
import { validateRequest, validateModel } from "../src/request.ts";
import { parseJson, stringifyJson } from "../src/json.ts";

const model = validateModel("typesafe/jev-test", "input", "fixture.model");

function request(type: string, criteria?: unknown) {
  return validateRequest(
    parseJson(
      JSON.stringify({
        state: "s",
        questions: {
          a: {
            type,
            instructions: "i",
            ...(criteria === undefined ? {} : { criteria })
          }
        }
      })
    ),
    undefined,
    model
  );
}

function response(answer: unknown): string {
  return JSON.stringify({ model, answers: { a: answer } });
}
test("Noul rejects wrong types and out of range values without inventing confidence", () => {
  const req = request("noul");
  for (const value of [-1, 1.1, "0.5", null, {}, true])
    assert.throws(() =>
      validateResponse(response({ type: "noul", noul: value }), req)
    );
  assert.deepEqual(
    validateResponse(response({ type: "noul", noul: 0.5 }), req),
    { model, answers: { a: { type: "noul", noul: 0.5 } } }
  );
});
test("Choice validates exact keys probabilities confidence and maximum with strict tolerance", () => {
  const req = request("choice", { a: "A", b: "B" });
  const answer = {
    type: "choice",
    choice: "b",
    confidence: 0.2,
    probabilities: { a: 0.4, b: 0.6 }
  };
  assert.doesNotThrow(() => validateResponse(response(answer), req));
  for (const update of [
    { choice: "a" },
    { choice: "missing" },
    { confidence: -1 },
    { confidence: undefined },
    { probabilities: { a: 0.4, b: 0.7 } },
    { probabilities: { a: 0.4, c: 0.6 } },
    { probabilities: { a: -0.1, b: 1.1 } },
    { probabilities: { a: "0.4", b: 0.6 } }
  ])
    assert.throws(() =>
      validateResponse(response({ ...answer, ...update }), req)
    );
  assert.doesNotThrow(() =>
    validateResponse(
      response({ ...answer, choice: "a", probabilities: { a: 0.5, b: 0.5 } }),
      req
    )
  );
});
test("Score validates weighted value range legend and distribution independently", () => {
  const req = request("score", ["low", "high"]);
  const answer = {
    type: "score",
    score: 0.6,
    confidence: 0.2,
    probabilities: { "0": 0.4, "1": 0.6 },
    legend: { "0": "low", "1": "high" }
  };
  assert.doesNotThrow(() => validateResponse(response(answer), req));
  for (const update of [
    { score: 0.7 },
    { score: -1 },
    { score: 2 },
    { score: "0.6" },
    { confidence: 2 },
    { probabilities: { "0": 0.4, "1": 0.7 } },
    { legend: { "0": "low" } },
    { legend: { "0": "high", "1": "low" } },
    { legend: { "0": "low", "1": {} } }
  ])
    assert.throws(() =>
      validateResponse(response({ ...answer, ...update }), req)
    );
});
test("native JSON serialization preserves integer-like candidate and nested state key order", () => {
  const raw =
    '{"state":{"10":"ten","2":"two","1":"one"},"questions":{"10":{"type":"choice","instructions":"pick","criteria":{"10":"ten","2":"two","1":"one"}},"2":{"type":"noul","instructions":"yes?"}}}';
  const req = validateRequest(parseJson(raw), undefined, model);
  const sent = stringifyJson(req);
  assert.ok(sent.includes('"state":{"10":"ten","2":"two","1":"one"}'));
  assert.ok(sent.includes('"criteria":{"10":"ten","2":"two","1":"one"}'));
  assert.ok(sent.indexOf('"10":{"type"') < sent.indexOf('"2":{"type"'));
});
