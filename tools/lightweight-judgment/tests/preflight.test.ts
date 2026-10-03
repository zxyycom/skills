import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeSuccess, decodeFailure, object } from "./output.ts";
import { runtime, request, args } from "./runtime-fixture.ts";

test("configuration file selection and model timeout precedence are explicit", async () => {
  const read: string[] = [];
  const rt = runtime({
    env: { LIGHTWEIGHT_JUDGMENT_CONFIG: "/env" },
    readFile: async (file) => {
      read.push(file);
      return '{"model":"typesafe/jev-config","timeoutMs":99,"apiKeyEnv":"CUSTOM"}';
    }
  });
  const result = decodeSuccess(
    (
      await runCli(
        [
          "--config",
          "/explicit",
          ...args,
          "--model",
          "typesafe/jev-cli",
          "--timeout-ms",
          "100",
          "--dry-run"
        ],
        rt
      )
    ).stdout
  );
  assert.deepEqual(read, ["/explicit"]);
  assert.equal(object(result.result.request).model, "typesafe/jev-cli");
  assert.equal(result.meta.attempts, 0);
  const requestModel = decodeSuccess(
    (
      await runCli(
        [
          "json",
          "--json",
          JSON.stringify({ ...request, model: "typesafe/jev-request" }),
          "--dry-run"
        ],
        rt
      )
    ).stdout
  );
  assert.equal(
    object(requestModel.result.request).model,
    "typesafe/jev-request"
  );
  const configured = decodeSuccess(
    (await runCli([...args, "--dry-run"], rt)).stdout
  );
  assert.equal(object(configured.result.request).model, "typesafe/jev-config");
  assert.deepEqual(read.slice(1), ["/env", "/env"]);
  const diagnostics = decodeSuccess(
    (
      await runCli(["doctor", "--timeout-ms", "100"], {
        ...rt,
        env: { LIGHTWEIGHT_JUDGMENT_CONFIG: "/env", CUSTOM: "fixture" }
      })
    ).stdout
  );
  assert.equal(diagnostics.result.timeoutMs, 100);
  const defaults = decodeSuccess((await runCli(["doctor"], runtime())).stdout);
  assert.equal(defaults.result.timeoutMs, 15000);
});
test("malformed inputs incompatible criteria and invalid configuration fail before send", async () => {
  let sent = 0;
  const rt = runtime({
    fetch: async () => {
      sent++;
      throw new Error("sent");
    }
  });
  for (const argv of [
    [...args, "--file", "/x"],
    ["json"],
    [...args, "--unknown"],
    [...args, "--json", "{}"],
    ["ask", "--type", "noul", "--question", "x", "--text", "x", "--level", "x"],
    [
      "ask",
      "--type",
      "choice",
      "--question",
      "x",
      "--text",
      "x",
      "--option",
      "a=x",
      "--option",
      "a=y"
    ],
    ["json", "--json", '{"state":true,"questions":{}}'],
    [
      "json",
      "--json",
      JSON.stringify({ ...request, endpoint: "https://evil" })
    ],
    [
      "json",
      "--json",
      JSON.stringify({ ...request, model: "other/model" }),
      "--model",
      "typesafe/jev-override"
    ]
  ])
    assert.equal((await runCli(argv, rt)).exitCode, 2);
  for (const config of [
    '{"endpoint":"http://external.example/v1/systemone"}',
    '{"endpoint":"https://key@example.test/v1/systemone"}',
    '{"endpoint":"https://example.test/v1/systemone?key=secret"}',
    '{"endpoint":"https://example.test/v1/systemone#fragment"}',
    '{"endpoint":"/relative"}',
    '{"apiKey":""}',
    '{"apiKey":"bad key"}',
    '{"logging":{"enabled":"true"}}',
    '{"logging":{"databasePath":""}}',
    '{"logging":{"saveRequest":1}}',
    '{"logging":{"saveResponse":null}}',
    '{"logging":{"__proto__":true}}',
    '{"timeoutMs":0}',
    '{"timeoutMs":1.5}',
    '{"timeoutMs":2147483648}',
    '{"timeoutMs":"99"}',
    '{"apiKeyEnv":"bad-name"}',
    '{"model":"other/model"}',
    '{"model":"typesafe/jev-ok","model":"typesafe/jev-bad"}'
  ])
    for (const argv of [args, [...args, "--model", "typesafe/jev-override"]]) {
      const failed = await runCli(
        argv,
        runtime({ readFile: async () => config })
      );
      assert.equal(failed.exitCode, 2);
      assert.equal(decodeFailure(failed.stdout).error.kind, "configuration");
    }
  assert.equal(
    (await runCli(["--config", "/missing", ...args], rt)).exitCode,
    2
  );
  for (const timeout of ["0", "-1", "1.5", "01", "2147483648"]) {
    const failed = await runCli([...args, "--timeout-ms", timeout], rt);
    assert.equal(failed.exitCode, 2);
    assert.equal(decodeFailure(failed.stdout).error.kind, "input");
    assert.equal(decodeFailure(failed.stdout).meta.attempts, 0);
  }
  assert.equal(sent, 0);
});
