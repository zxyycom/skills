import assert from "node:assert/strict";
import test from "node:test";
import {
  activationFlagForCheck,
  createGateDefinition,
  gateEnvironmentCheckId,
  packageScriptCheckId
} from "./lib/vibe-gate.ts";
import {
  outcomeFor,
  passingNativeChecks,
  repositoryRoot,
  runDefinition
} from "./vibe-check-test-support.ts";

test("Gate environment failure blocks dependent Checks before their execution", async () => {
  const invocations: string[] = [];
  const typecheck = packageScriptCheckId("typecheck");
  const definition = createGateDefinition([], {
    activeCheckIds: [typecheck],
    nativeChecks: passingNativeChecks(),
    runCommand: async (invocation) => {
      invocations.push([invocation.command, ...invocation.args].join(" "));
      return {
        exitCode: invocation.command === "node" ? 1 : 0,
        output:
          "Gate environment: fixture\n[mismatch] bun 1.4.3 - expected 1.4.2",
        status: "completed"
      };
    }
  });
  const result = await runDefinition(definition, repositoryRoot, [
    activationFlagForCheck(typecheck)
  ]);
  assert.equal(result.aggregate, "failed");
  assert.deepEqual(invocations, ["node scripts/environment.js gate"]);
  assert.equal(outcomeFor(result, gateEnvironmentCheckId).status, "failed");
  const dependentOutcome = outcomeFor(result, typecheck);
  assert.equal(dependentOutcome.status, "unavailable");
  if (dependentOutcome.status !== "unavailable") {
    throw new Error("expected the dependent Check to be unavailable");
  }
  assert.equal(dependentOutcome.reason.code, "dependency-not-passed");
});
