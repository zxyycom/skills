import assert from "node:assert/strict";
import test from "node:test";
import {
  createGateDefinition,
  gateEnvironmentCheckId
} from "./lib/vibe-gate.ts";
import { createGateEnvironmentCheck } from "./lib/vibe-gate/checks/environment.ts";
import { defineCheck, defineConfig } from "@zxyycom/vibe-check";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("Gate environment is a bounded native command and every production result requires it", () => {
  const check = createGateEnvironmentCheck();
  assert.equal(check.options.executable, "node");
  assert.deepEqual(check.options.arguments, ["scripts/environment.js", "gate"]);
  assert.equal(check.options.environment.mode, "inherit");
  assert.equal(check.options.output.mode, "transcript");
  assert.equal(check.options.timeoutMs, 30_000);
  assert.equal(check.options.outputByteLimit, 1024 * 1024);
  for (const candidate of createGateDefinition(["release"]).checks) {
    if (candidate.checkId !== gateEnvironmentCheckId)
      assert.ok(
        Array.isArray(candidate.dependsOn) &&
          candidate.dependsOn.includes(gateEnvironmentCheckId),
        candidate.checkId
      );
  }
});

test("missing Gate environment prevents dependent project work", async () => {
  await withTemporaryDirectory("gate-env-missing-", async (directory) => {
    let executed = false;
    const result = await runDefinition(
      defineConfig({
        checks: [
          createGateEnvironmentCheck(),
          defineCheck({
            checkId: "consumer",
            displayName: "consumer",
            dependsOn: [gateEnvironmentCheckId],
            execute: () => {
              executed = true;
              return { status: "passed", data: {} };
            }
          })
        ]
      }),
      directory
    );
    assert.equal(result.aggregate, "failed");
    assert.equal(executed, false);
    assert.notEqual(
      outcomeFor(result, gateEnvironmentCheckId).status,
      "passed"
    );
  });
});
