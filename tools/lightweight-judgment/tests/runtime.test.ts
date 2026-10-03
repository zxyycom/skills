import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { parseJson } from "../src/json.ts";
import { decodeSuccess, decodeFailure, parseObject } from "./output.ts";
import { runtime, request, args } from "./runtime-fixture.ts";

test("strict JSON rejects duplicates unsafe numbers and lossy transport at nested paths", () => {
  for (const text of [
    '{"x":1,"x":2}',
    '{"a":{"\\u0078":1,"x":2}}',
    "9007199254740993",
    "1e400",
    "1e-400",
    "-0",
    "0.100000000000000005",
    "{} {}",
    "[1,]",
    '"\\x"'
  ])
    assert.throws(() => parseJson(text));
  assert.deepEqual(
    parseJson('{"__proto__":{"a":1},"x":1e-3,"ok":[true,null]}'),
    { ["__proto__"]: { a: 1 }, x: 0.001, ok: [true, null] }
  );
});
test("JSON sources and equivalent ask preserve native state and send once", async () => {
  const bodies: string[] = [];
  const rt = runtime({
    readFile: async (file) =>
      file === "/request"
        ? JSON.stringify(request)
        : file === "/state"
          ? JSON.stringify(request.state)
          : "{}",
    fetch: async (_url, init) => {
      assert.equal(typeof init.body, "string");
      assert.ok(typeof init.body === "string");
      bodies.push(init.body);
      return new Response(
        JSON.stringify({
          model: "typesafe/jev-test",
          answers: { answer: { type: "noul", noul: 0 } }
        })
      );
    }
  });
  for (const command of [
    args,
    ["json", "--file", "/request"],
    ["json", "-"],
    [
      "ask",
      "--type",
      "noul",
      "--question",
      "rollback?",
      "--state-file",
      "/state"
    ]
  ])
    assert.equal((await runCli(command, rt)).exitCode, 0);
  assert.equal(new Set(bodies).size, 1);
  assert.equal(bodies.length, 4);
});

test("help doctor dry run remain offline and preview never reads the key", async () => {
  let calls = 0;
  const env = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "OPENROUTER_API_KEY") throw new Error("key read");
        return undefined;
      }
    }
  );
  const rt = runtime({
    env,
    fetch: async () => {
      calls++;
      throw new Error("network");
    }
  });
  assert.equal((await runCli([...args, "--dry-run"], rt)).exitCode, 0);
  assert.equal(
    (
      await runCli(
        ["--config", "/missing", "--help"],
        runtime({
          readFile: async () => {
            throw new Error("read");
          }
        })
      )
    ).exitCode,
    0
  );
  const doctor = decodeSuccess((await runCli(["doctor"], runtime())).stdout);
  assert.equal(doctor.result.hasApiKey, true);
  assert.equal(doctor.meta.attempts, 0);
  const missing = await runCli(["doctor"], runtime({ env: {} }));
  assert.equal(missing.exitCode, 2);
  assert.equal(decodeFailure(missing.stdout).error.kind, "configuration");
  assert.equal(calls, 0);
});

test("multi question native request fixed receiver preserves all valid response fields", async () => {
  const multi = {
    state: ["data", { path: "/not-read", url: "https://not-fetched" }],
    questions: {
      choice: {
        type: "choice",
        instructions: { focus: ["x"] },
        criteria: { a: null, b: { text: "b" } }
      },
      score: {
        type: "score",
        instructions: [],
        criteria: ["low", { label: "high" }]
      },
      no: {
        type: "noul",
        instructions: "no?",
        criteria: { true: [], false: {} }
      }
    }
  };
  let sent = 0;
  const response = {
    model: "typesafe/jev-1.13-test",
    answers: {
      choice: {
        type: "choice",
        choice: "b",
        probabilities: { a: 0.2, b: 0.8 },
        confidence: 0.6
      },
      score: {
        type: "score",
        score: 0.7,
        probabilities: { "0": 0.3, "1": 0.7 },
        confidence: 0.4,
        legend: { "0": "low", "1": "server-structured-label" }
      },
      no: { type: "noul", noul: 0.5 }
    },
    usage: { input_tokens: 100, cost: 0.0000042 },
    id: "request",
    provider: "Typesafe",
    extra: { preserved: true }
  };
  const result = await runCli(
    ["json", "--json", JSON.stringify(multi)],
    runtime({
      fetch: async (url, init) => {
        sent++;
        assert.equal(url, "https://openrouter.ai/api/v1/systemone");
        assert.equal(init.redirect, "manual");
        assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, {
          "Content-Type": "application/json",
          Authorization: "Bearer private-test-key"
        });
        assert.deepEqual(
          parseObject(typeof init.body === "string" ? init.body : ""),
          { ...multi, model: "typesafe/jev-1.13" }
        );
        return new Response(JSON.stringify(response));
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(decodeSuccess(result.stdout).result, response);
  assert.equal(sent, 1);
  assert.equal(result.stderr, "");
});
test("HTTP authentication rate limit network redirects and timeout are sanitized single attempts", async () => {
  for (const [status, kind] of [
    [401, "authentication"],
    [403, "authentication"],
    [429, "rate_limit"],
    [402, "http"],
    [503, "http"],
    [302, "http"]
  ] as const) {
    let sent = 0;
    const result = await runCli(
      args,
      runtime({
        fetch: async () => {
          sent++;
          return new Response("private-test-key state secret raw provider", {
            status,
            headers: { "retry-after": "2", Location: "https://evil" }
          });
        }
      })
    );
    assert.equal(result.exitCode, 3);
    assert.equal(decodeFailure(result.stdout).error.kind, kind);
    assert.equal(decodeFailure(result.stdout).error.httpStatus, status);
    assert.equal(decodeFailure(result.stdout).error.retryAfterMs, 2000);
    assert.equal(sent, 1);
    assert.equal(
      (result.stdout + result.stderr).includes("private-test-key"),
      false
    );
    assert.equal(
      (result.stdout + result.stderr).includes("raw provider"),
      false
    );
  }
  const network = await runCli(
    args,
    runtime({
      fetch: async () => {
        throw new Error("private-test-key");
      }
    })
  );
  assert.equal(decodeFailure(network.stdout).error.kind, "network");
  const timeout = await runCli(
    [...args, "--timeout-ms", "5"],
    runtime({ fetch: async () => new Promise(() => {}) })
  );
  assert.equal(decodeFailure(timeout.stdout).error.kind, "timeout");
  assert.equal(decodeFailure(timeout.stdout).meta.attempts, 1);
  const bodyTimeout = await runCli(
    [...args, "--timeout-ms", "5"],
    runtime({
      fetch: async () => new Response(new ReadableStream({ start() {} }))
    })
  );
  assert.equal(decodeFailure(bodyTimeout.stdout).error.kind, "timeout");
  assert.equal(decodeFailure(bodyTimeout.stdout).error.httpStatus, 200);
});
