import assert from "node:assert/strict";
import test from "node:test";
import {
  createGateDefinition,
  gateEnvironmentCheckId
} from "../../lib/vibe-gate.ts";
import { createGateEnvironmentCheck } from "../../lib/vibe-gate/checks/environment.ts";

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
