import assert from "node:assert/strict";
import test from "node:test";
import { validateResponse } from "../src/response.ts";
import { validateRequest, validateModel } from "../src/request.ts";
import { parseJson, stringifyJson } from "../src/json.ts";
import { runCli } from "../src/cli.ts";
import { runtime } from "./runtime-fixture.ts";
import { decodeSuccess } from "./output.ts";

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

test("CLI preserves schema-valid answers without numerical consistency checks", async () => {
  const score = {
    type: "score",
    score: 3.15,
    confidence: 0.29,
    probabilities: { "0": 0.09, "1": 0.07, "2": 0.09, "3": 0.11, "4": 0.64 },
    legend: {
      "0": "none",
      "1": "little",
      "2": "some",
      "3": "much",
      "4": "core"
    },
    provider_detail: { explanation: "synthetic service metadata" }
  };
  const received = {
    model,
    answers: {
      a: score,
      b: {
        type: "choice",
        choice: "low",
        confidence: 0.2,
        probabilities: { low: 0.123, high: 0.7 }
      },
      c: { type: "noul", noul: 0.7 },
      d: {
        type: "score",
        score: 0.123,
        confidence: 0,
        probabilities: { "0": 0, "1": 0 },
        legend: { "0": "service-rendered low", "1": "service-rendered high" }
      }
    },
    id: "synthetic-response-id",
    provider: "synthetic-provider",
    usage: { input_tokens: 758, output_tokens: 20, cost: 0.000031836 }
  };
  let sent = 0;
  const result = await runCli(
    [
      "json",
      "--json",
      JSON.stringify({
        state: "synthetic record",
        questions: {
          a: {
            type: "score",
            instructions: "rate",
            criteria: Object.values(score.legend)
          },
          b: {
            type: "choice",
            instructions: "pick",
            criteria: { low: "low", high: "high" }
          },
          c: { type: "noul", instructions: "supported?" },
          d: {
            type: "score",
            instructions: "rate structured levels",
            criteria: [{ label: "low" }, ["high"]]
          }
        }
      })
    ],
    runtime({
      fetch: async () => {
        sent++;
        return new Response(JSON.stringify(received));
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(sent, 1);
  assert.deepEqual(decodeSuccess(result.stdout).result, received);
});
test("Noul rejects wrong types and out of range values without inventing confidence", () => {
  const req = request("noul");
  for (const value of [-1, 1.1, "0.5", null, {}, true])
    assert.throws(
      () => validateResponse(response({ type: "noul", noul: value }), req),
      { kind: "invalid_response" }
    );
  assert.deepEqual(
    validateResponse(response({ type: "noul", noul: 0.5 }), req),
    { model, answers: { a: { type: "noul", noul: 0.5 } } }
  );
});
test("Choice validates schema and preserves independent numerical fields", () => {
  const req = request("choice", { a: "A", b: "B" });
  const answer = {
    type: "choice",
    choice: "b",
    confidence: 0.2,
    probabilities: { a: 0.4, b: 0.6 }
  };
  assert.doesNotThrow(() => validateResponse(response(answer), req));
  for (const update of [
    { choice: "missing" },
    { confidence: -1 },
    { confidence: undefined },
    { probabilities: { a: 0.4, c: 0.6 } },
    { probabilities: { a: -0.1, b: 1.1 } },
    { probabilities: { a: "0.4", b: 0.6 } }
  ])
    assert.throws(
      () => validateResponse(response({ ...answer, ...update }), req),
      { kind: "invalid_response" }
    );
  for (const update of [
    { choice: "a" },
    { probabilities: { a: 0.4, b: 0.7 } },
    { choice: "a", probabilities: { a: 0.123, b: 0.7 } },
    { choice: "a", probabilities: { a: 0.5, b: 0.5 } }
  ]) {
    const preserved = { ...answer, ...update };
    assert.deepEqual(
      validateResponse(response(preserved), req).answers.a,
      preserved
    );
  }
});
test("Score validates schema and preserves independent numerical fields", () => {
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
    { score: -1 },
    { score: 2 },
    { score: "0.6" },
    { confidence: 2 },
    { probabilities: { "0": 0.4 } },
    { probabilities: { "0": 0.4, "1": 1.1 } },
    { probabilities: { "0": "0.4", "1": 0.6 } },
    { legend: { "0": "low" } },
    { legend: { "0": "high", "1": "low" } },
    { legend: { "0": "low", "1": {} } }
  ])
    assert.throws(
      () => validateResponse(response({ ...answer, ...update }), req),
      { kind: "invalid_response" }
    );
  for (const update of [
    { score: 0.7 },
    { probabilities: { "0": 0.4, "1": 0.7 } },
    { score: 0.123, probabilities: { "0": 0.4, "1": 0.6 } }
  ]) {
    const preserved = { ...answer, ...update };
    assert.deepEqual(
      validateResponse(response(preserved), req).answers.a,
      preserved
    );
  }
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
