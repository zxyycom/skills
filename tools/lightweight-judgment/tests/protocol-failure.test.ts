import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeFailure } from "./output.ts";
import { runtime } from "./runtime-fixture.ts";

test("invalid protocol never repairs or retries and hides remote answer payloads", async () => {
  const sensitiveId = "private-question-id";
  const sensitiveKey = "private-remote-key";
  const noul = { type: "noul", instructions: "judge" };
  const choice = {
    type: "choice",
    instructions: "pick",
    criteria: { a: "A", b: "B" }
  };
  const score = {
    type: "score",
    instructions: "score",
    criteria: ["low", "high"]
  };
  const wire = (answer: unknown) =>
    JSON.stringify({
      model: "typesafe/jev-test",
      answers: { [sensitiveId]: answer }
    });
  const fixtures = [
    {
      question: noul,
      raw: `{"${sensitiveKey}":`,
      location: "response.json",
      reason: "非法 JSON 值"
    },
    {
      question: noul,
      raw: `{"${sensitiveKey}":1,"${sensitiveKey}":2}`,
      location: "response.json",
      reason: "重复对象键"
    },
    {
      question: noul,
      raw: `{"${sensitiveKey}":1e-400}`,
      location: "response.json",
      reason: "数值下溢"
    },
    {
      question: noul,
      raw: `{"${sensitiveKey}":0.100000000000000005}`,
      location: "response.json",
      reason: "数值不能无损往返，请使用字符串保存精确数值"
    },
    {
      question: noul,
      raw: JSON.stringify({ model: "private-model", answers: {} }),
      location: "response.model",
      reason: "无法识别实际模型"
    },
    {
      question: noul,
      raw: JSON.stringify({
        model: "typesafe/jev-test",
        answers: { [sensitiveKey]: { type: "noul", noul: 0.5 } }
      }),
      location: "response.answers",
      reason: "答案 ID 集合不匹配"
    },
    {
      question: noul,
      raw: wire({ type: "noul", noul: 2 }),
      location: "response.answers[0].noul",
      reason: "需要 0–1 有限概率"
    },
    {
      question: choice,
      raw: wire({
        type: "choice",
        choice: "a",
        confidence: 0.5,
        probabilities: { a: 0.2, b: 0.2 }
      }),
      location: "response.answers[0].probabilities",
      reason: "概率和不等于 1"
    },
    {
      question: choice,
      raw: wire({
        type: "choice",
        choice: "a",
        confidence: 0.5,
        probabilities: { a: 0.2, b: 0.8 }
      }),
      location: "response.answers[0].choice",
      reason: "choice 不是最大概率项"
    },
    {
      question: score,
      raw: wire({
        type: "score",
        score: 0.4,
        confidence: 0.5,
        probabilities: { "0": 0.2, "1": 0.8 },
        legend: { "0": "low", "1": "high" }
      }),
      location: "response.answers[0].score",
      reason: "score 与加权结果不一致"
    }
  ];
  const messages = new Set<string>();
  for (const fixture of fixtures) {
    let sent = 0;
    const result = await runCli(
      [
        "json",
        "--json",
        JSON.stringify({
          state: "private state",
          questions: { [sensitiveId]: fixture.question }
        })
      ],
      runtime({
        fetch: async () => {
          sent++;
          return new Response(fixture.raw);
        }
      })
    );
    const failure = decodeFailure(result.stdout);
    assert.equal(result.exitCode, 3);
    assert.equal(failure.error.kind, "invalid_response");
    assert.equal(failure.error.httpStatus, 200);
    assert.equal(failure.meta.attempts, 1);
    assert.equal(failure.result, null);
    assert.equal(
      failure.error.message,
      `${fixture.location}: ${fixture.reason}`
    );
    assert.equal(result.stderr, `${failure.error.message}\n`);
    assert.equal(sent, 1);
    messages.add(failure.error.message);
    for (const secret of [
      sensitiveId,
      sensitiveKey,
      "private-model",
      "private state",
      "private-test-key"
    ]) {
      assert.ok(!(result.stdout + result.stderr).includes(secret));
    }
  }
  assert.equal(messages.size, fixtures.length);
});
