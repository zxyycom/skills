import assert from "node:assert/strict";
import test from "node:test";
import { runCli, type CliRuntime } from "../src/cli.ts";
import { decodeSuccess, decodeFailure, parseObject } from "./output.ts";

const request = {
  state: "data",
  questions: { a: { type: "noul", instructions: "yes?" } }
};

const response = {
  model: "typesafe/jev-test",
  answers: { a: { type: "noul", noul: 0.5 } }
};

function runtime(overrides: Partial<CliRuntime> = {}): CliRuntime {
  return {
    env: { OPENROUTER_API_KEY: "fixture-key" },
    home: "/fixture",
    readFile: async () => "{}",
    readStdin: async () => "",
    now: () => 1,
    fetch: async () => new Response(JSON.stringify(response)),
    ...overrides
  };
}
test("official bare and namespace JEV aliases remain unchanged at every model source", async () => {
  for (const model of [
    "jev-1.13",
    "jev-latest",
    "typesafe/jev-1.13",
    "~typesafe/jev-latest"
  ]) {
    const bodies: string[] = [];
    const rt = runtime({
      fetch: async (_url, init) => {
        assert.ok(typeof init.body === "string");
        bodies.push(init.body);
        return new Response(JSON.stringify(response));
      }
    });
    const inline = ["json", "--json", JSON.stringify(request)];
    const outcomes = [
      await runCli(inline, {
        ...rt,
        readFile: async () => JSON.stringify({ model })
      }),
      await runCli(
        ["json", "--json", JSON.stringify({ ...request, model })],
        rt
      ),
      await runCli([...inline, "--model", model], rt)
    ];
    assert.ok(outcomes.every((outcome) => outcome.exitCode === 0));
    assert.ok(bodies.every((body) => parseObject(body).model === model));
  }
  assert.equal(
    (
      await runCli(
        [
          "json",
          "--json",
          JSON.stringify({ ...request, model: "other/model" })
        ],
        runtime()
      )
    ).exitCode,
    2
  );
});
test("short credentials never corrupt JSON booleans keys or doctor diagnostics", async () => {
  for (const key of ["true", "a", 'quote"\\value']) {
    const rt = runtime({ env: { OPENROUTER_API_KEY: key } });
    const doctor = await runCli(["doctor"], rt);
    assert.equal(doctor.exitCode, 0);
    const diagnostic = decodeSuccess(doctor.stdout);
    assert.equal(diagnostic.ok, true);
    assert.equal(diagnostic.result.hasApiKey, true);
    assert.equal(diagnostic.result.model, "typesafe/jev-1.13");
    assert.equal(diagnostic.result.apiKeyEnv, "OPENROUTER_API_KEY");
    const result = await runCli(
      ["json", "--json", JSON.stringify(request)],
      rt
    );
    assert.equal(result.exitCode, 0);
    const envelope = decodeSuccess(result.stdout);
    assert.equal(envelope.ok, true);
    assert.deepEqual(envelope.result, response);
    assert.equal(envelope.error, null);
    assert.equal(result.stderr, "");
    const failed = await runCli(["json", "--json", JSON.stringify(request)], {
      ...rt,
      fetch: async () => {
        throw new Error(`network exposed ${key}`);
      }
    });
    const failure = decodeFailure(failed.stdout);
    assert.equal(failure.ok, false);
    assert.equal(failure.error.kind, "network");
    assert.ok(!failed.stdout.includes("network exposed"));
  }
});
test("network response rejects malformed UTF-8 while genuine replacement character stays valid", async () => {
  const wire = JSON.stringify({ ...response, note: "x" });
  const bytes = new TextEncoder().encode(wire);
  bytes[wire.indexOf('"note":"x"') + '"note":"'.length] = 0xff;
  const args = ["json", "--json", JSON.stringify(request)];
  const malformed = await runCli(
    args,
    runtime({ fetch: async () => new Response(bytes) })
  );
  assert.equal(malformed.exitCode, 3);
  assert.equal(decodeFailure(malformed.stdout).error.kind, "invalid_response");
  assert.equal(decodeFailure(malformed.stdout).error.httpStatus, 200);
  const legitimate = await runCli(
    args,
    runtime({
      fetch: async () =>
        new Response(JSON.stringify({ ...response, note: "�" }))
    })
  );
  assert.equal(legitimate.exitCode, 0);
  assert.equal(decodeSuccess(legitimate.stdout).result.note, "�");
  const broken = await runCli(
    args,
    runtime({
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("private upstream"));
            }
          })
        )
    })
  );
  assert.equal(decodeFailure(broken.stdout).error.kind, "network");
});
