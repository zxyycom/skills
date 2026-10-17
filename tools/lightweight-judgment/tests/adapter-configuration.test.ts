import assert from "node:assert/strict";
import test from "node:test";
import { request } from "./runtime-fixture.ts";
import { runCli } from "../src/cli.ts";
import {
  configured,
  input,
  openai,
  typesafe,
  router
} from "./adapter-fixture.ts";
import { decodeFailure, decodeSuccess } from "./output.ts";

test("adapter configuration isolates credentials validates every model source and rejects unsupported combinations offline", async () => {
  for (const config of [
    { adapter: "unknown" },
    { adapter: "typesafe" },
    { ...openai, apiKeyEnv: undefined },
    { ...openai, model: "typesafe/jev-1.14" },
    { ...typesafe, model: "typesafe/jev-1.14" },
    { ...router, model: "gpt-6-luna" },
    { ...openai, longContext: true },
    { images: true },
    { longContext: true }
  ]) {
    const outcome = await runCli(
      ["json", "--json", input("s"), "--dry-run"],
      configured(config, { env: {}, fetch: async () => assert.fail("no HTTP") })
    );
    assert.equal(outcome.exitCode, 2, outcome.stdout);
    assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
  }
  for (const source of [
    input("s"),
    JSON.stringify({ ...request, model: "typesafe/jev-bad" })
  ]) {
    const result = await runCli(
      ["json", "--json", source, "--model", "gpt-6-luna", "--dry-run"],
      configured(openai, { env: {} })
    );
    assert.equal(
      result.exitCode,
      source.includes("jev-bad") ? 2 : 0,
      result.stdout
    );
  }
  let reads = 0;
  const env = { OPENROUTER_API_KEY: "must-not-fallback" };
  Object.defineProperty(env, "NATIVE_KEY", {
    get() {
      reads++;
      return undefined;
    }
  });
  const outcome = await runCli(
    ["json", "--json", input("s")],
    configured(openai, {
      env,
      fetch: async () => assert.fail("missing declared credential")
    })
  );
  assert.equal(outcome.exitCode, 2);
  assert.equal(reads, 1);
  assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
  const doctor = await runCli(["doctor"], configured(openai));
  assert.equal(
    decodeSuccess(doctor.stdout).result.adapterContract,
    "openai-decisions/v1"
  );
});
