import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../../src/cli.ts";
import { validateAdapterResponse } from "../../src/adapters/adapter-response.ts";
import { orderedKeys, stringifyJson } from "../../src/protocol/json.ts";
import {
  configured,
  prepared,
  input,
  openai,
  usage
} from "./adapter-fixture.ts";
import { array } from "../statistics/statistics-fixture.ts";
import { object, decodeFailure } from "../support/output.ts";

test("OpenAI carrier compiler preserves structured local roots numeric key order and typed candidate and rubric semantics", async () => {
  const source =
    '{"state":{"10":"ten","2":["two",{"amount":"9007199254740993"}]},"questions":{"10":{"type":"choice","instructions":{"candidate":{"id":"001"},"focus":"candidate.id"},"criteria":{"10":null,"2":{"label":"second"},"__proto__":"literal"}},"2":{"type":"noul","instructions":["use local root"],"criteria":{"false":{"reason":"explicit negative"}}},"__proto__":{"type":"score","instructions":"rate","criteria":["",{"label":"structured","n":100}]}}}';
  const { prepared: p } = await prepared(source, openai);
  assert.equal(p.adapterContract, "openai-decisions/v1");
  assert.equal(
    p.wire.input,
    'JEV structured JSON:\n{"10":"ten","2":["two",{"amount":"9007199254740993"}]}'
  );
  const questions = array(p.wire.questions).map(object);
  assert.deepEqual(
    questions.map((q) => q.name),
    ["q0", "q1", "q2"]
  );
  assert.deepEqual(questions[0].choices, [
    { value: "10" },
    { value: "2", description: 'JEV structured JSON:\n{"label":"second"}' },
    { value: "__proto__", description: "literal" }
  ]);
  assert.ok(
    String(questions[0].instructions).includes(
      '{"candidate":{"id":"001"},"focus":"candidate.id"}'
    )
  );
  assert.ok(
    String(questions[1].instructions).includes(
      '"criteria":{"false":{"reason":"explicit negative"}}'
    )
  );
  assert.equal(questions[1].type, "predicate");
  assert.deepEqual(questions[2].levels, [
    { label: "" },
    {
      label: "1",
      description: 'JEV structured JSON:\n{"label":"structured","n":100}'
    }
  ]);
  assert.equal(p.carrierJson, source.slice(0, -1) + ',"model":"gpt-6-luna"}'); // model is appended after the original state/questions
  assert.deepEqual(
    array(p.manifest.questions).map((x) => object(x).id),
    ["10", "2", "__proto__"]
  );
});

test("OpenAI native answers retain raw response while normalized preserves identity values refusal and independent probabilities", async () => {
  const source =
    '{"state":"evidence","questions":{"10":{"type":"choice","instructions":"pick","criteria":{"10":"ten","2":"two"}},"2":{"type":"score","instructions":"score","criteria":["same","same"]},"__proto__":{"type":"noul","instructions":"supported?"}}}';
  const { carrier } = await prepared(source, openai);
  const raw = {
    model: "gpt-6-luna",
    answers: [
      {
        name: "q0",
        type: "choice",
        choice: "10",
        confidence: 0.12,
        probabilities: [
          { value: "2", probability: 0.9 },
          { value: "10", probability: 0.1 }
        ]
      },
      {
        name: "q1",
        type: "score",
        score: 0.123,
        confidence: 0.3,
        probabilities: [
          { value: 1, label: "same", probability: 0.7 },
          { value: 0, label: "same", probability: 0.4 }
        ]
      },
      { name: "q2", type: "refusal" }
    ],
    usage,
    extra: { preserve: true }
  };
  const result = validateAdapterResponse(
    JSON.stringify(raw),
    carrier,
    "openai-decisions"
  );
  assert.deepEqual(result.result, raw);
  assert.equal(result.normalized.completion, "partial");
  assert.deepEqual(orderedKeys(result.normalized.answers), [
    "10",
    "2",
    "__proto__"
  ]);
  assert.deepEqual(result.normalized.answers["10"], {
    status: "answered",
    type: "choice",
    choice: "10",
    confidence: 0.12,
    probabilities: Object.assign(Object.create(null), { "10": 0.1, "2": 0.9 })
  });
  const score = result.normalized.answers["2"];
  assert.ok(score.status === "answered" && score.type === "score");
  assert.equal(score.score, 0.123);
  assert.ok("providerLabels" in score);
  assert.deepEqual(Object.entries(score.providerLabels), [
    ["0", "same"],
    ["1", "same"]
  ]);
  assert.deepEqual(score.requestRubric, ["same", "same"]);
  assert.deepEqual(result.normalized.answers["__proto__"], {
    status: "refused",
    requestedType: "noul"
  });
  assert.equal(
    stringifyJson(result.normalized).includes(
      '"probabilities":{"10":0.1,"2":0.9}'
    ),
    true
  );
  const all = validateAdapterResponse(
    JSON.stringify({
      ...raw,
      answers: raw.answers.map((_, i) => ({ name: `q${i}`, type: "refusal" }))
    }),
    carrier,
    "openai-decisions"
  );
  assert.equal(all.normalized.completion, "refused");
  const q = (await prepared(input("s"), openai)).carrier;
  const noul = validateAdapterResponse(
    JSON.stringify({
      model: "gpt-6-luna",
      answers: [{ type: "predicate", name: "q0", probability: 0.5 }],
      usage
    }),
    q,
    "openai-decisions"
  );
  assert.deepEqual(noul.normalized.answers.answer, {
    status: "answered",
    type: "noul",
    noul: 0.5
  });
});

test("OpenAI response identity type ranges and complete candidate sets fail closed without leaking remote payload", async () => {
  const source = input("s", {
    answer: {
      type: "choice",
      instructions: "pick",
      criteria: { yes: "Y", no: "N" }
    }
  });
  const answer = {
    type: "choice",
    name: "q0",
    choice: "yes",
    confidence: 0.1,
    probabilities: [
      { value: "yes", probability: 0.3 },
      { value: "no", probability: 0.7 }
    ]
  };
  const invalid = [
    { ...answer, name: "private-remote" },
    { ...answer, type: "predicate" },
    { ...answer, choice: true },
    { ...answer, confidence: 2 },
    {
      ...answer,
      probabilities: [
        { value: "yes", probability: 0.1 },
        { value: "yes", probability: 0.9 }
      ]
    },
    {
      ...answer,
      probabilities: [
        { value: true, probability: 0.3 },
        { value: "no", probability: 0.7 }
      ]
    },
    {
      ...answer,
      probabilities: [
        { value: "yes", probability: -1 },
        { value: "no", probability: 0.7 }
      ]
    }
  ];
  for (const candidate of invalid) {
    let sent = 0;
    const outcome = await runCli(
      ["json", "--json", source],
      configured(openai, {
        fetch: async () => {
          sent++;
          return new Response(
            JSON.stringify({ model: "gpt-6-luna", answers: [candidate], usage })
          );
        }
      })
    );
    assert.equal(outcome.exitCode, 3, outcome.stdout);
    assert.equal(sent, 1);
    const decoded = decodeFailure(outcome.stdout);
    assert.equal(decoded.error.kind, "invalid_response");
    assert.equal(decoded.meta.attempts, 1);
    assert.equal(outcome.stdout.includes("private-remote"), false);
  }
});
