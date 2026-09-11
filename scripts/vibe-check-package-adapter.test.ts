import assert from "node:assert/strict";
import test from "node:test";
import {
  createGateDefinition,
  type GateCommandInvocation
} from "./lib/vibe-gate.ts";
import {
  expectedSemanticCommandPaths,
  expectedSemanticPrerequisites
} from "./vibe-check-catalog-fixture.ts";
import {
  outcomeFor,
  passingNativeChecks,
  runDefinition,
  scriptForCommand,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("package script adapter maps terminal results and settles independent Checks", async () => {
  await withTemporaryDirectory("skills-vibe-adapter-", async (directory) => {
    const calls: GateCommandInvocation[] = [];
    const failedScript = "test:relation-graph";
    const failedOutput = [
      "omitted-1",
      "omitted-2",
      "detail-1",
      "detail-2",
      "detail-3",
      "detail-4"
    ].join("\n");
    const failedResult = await runDefinition(
      createGateDefinition([], {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) => {
          calls.push(invocation);
          return {
            exitCode: scriptForCommand(invocation) === failedScript ? 1 : 0,
            output:
              scriptForCommand(invocation) === failedScript
                ? failedOutput
                : `${scriptForCommand(invocation)} output`,
            status: "completed"
          };
        }
      }),
      directory
    );

    assert.equal(failedResult.aggregate, "failed");
    assert.equal(
      outcomeFor(failedResult, `script:${failedScript}`).status,
      "failed"
    );
    assert.deepEqual(
      failedResult.checkMessages
        .filter(({ checkId }) => checkId === `script:${failedScript}`)
        .map(({ code, message }) => ({ code, message })),
      [
        {
          code: "package-script-exit-nonzero",
          message:
            "bun run test:relation-graph exited with code 1. Run bun run test:relation-graph directly for its full diagnostic."
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "…detail-1"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-2"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-3"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-4"
        }
      ]
    );
    assert.ok(
      failedResult.checkMessages.every(
        ({ message }) => !/[\n\r\u2028\u2029]/u.test(message)
      )
    );
    assert.equal(outcomeFor(failedResult, "script:lint").status, "passed");
    assert.ok(
      calls
        .filter((invocation) => scriptForCommand(invocation) !== null)
        .every(
          (invocation) =>
            invocation.command === "bun" &&
            invocation.args[0] === "run" &&
            invocation.args[1] === scriptForCommand(invocation)
        )
    );
    assert.ok(
      calls.some(
        (invocation) =>
          invocation.command === "bun" &&
          invocation.args[0] === "test" &&
          scriptForCommand(invocation) === null
      )
    );

    const unavailableResult = await runDefinition(
      createGateDefinition([], {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) =>
          scriptForCommand(invocation) === failedScript
            ? {
                output: "Bun is unavailable",
                reason: "gate-command-start-failed",
                status: "unavailable"
              }
            : { exitCode: 0, output: "", status: "completed" }
      }),
      directory
    );

    assert.equal(unavailableResult.aggregate, "failed");
    assert.deepEqual(outcomeFor(unavailableResult, `script:${failedScript}`), {
      reason: { code: "package-script-start-failed" },
      status: "unavailable"
    });
    assert.equal(outcomeFor(unavailableResult, "script:lint").status, "passed");
  });
});

test("public distribution Checks require successful generation Checks", async () => {
  await withTemporaryDirectory(
    "skills-vibe-distribution-prerequisites-",
    async (directory) => {
      for (const [
        consumerCheckId,
        prerequisites
      ] of expectedSemanticPrerequisites) {
        const [prerequisite] = prerequisites;
        const consumerPath = expectedSemanticCommandPaths.get(consumerCheckId);
        if (consumerPath === undefined) {
          throw new Error(
            `missing consumer command path for ${consumerCheckId}`
          );
        }
        for (const behavior of ["passed", "failed", "unavailable"] as const) {
          const calls: GateCommandInvocation[] = [];
          const result = await runDefinition(
            createGateDefinition(["release"], {
              batchReleaseTests: false,
              nativeChecks: passingNativeChecks(),
              runCommand: async (invocation) => {
                calls.push(invocation);
                if (
                  scriptForCommand(invocation) !==
                  prerequisite.slice("script:".length)
                ) {
                  return { exitCode: 0, output: "", status: "completed" };
                }
                if (behavior === "failed") {
                  return {
                    exitCode: 1,
                    output: "generated artifact drift",
                    status: "completed"
                  };
                }
                if (behavior === "unavailable") {
                  return {
                    output: "generation command unavailable",
                    reason: "gate-command-start-failed",
                    status: "unavailable"
                  };
                }
                return {
                  exitCode: 0,
                  output: "",
                  status: "completed"
                };
              }
            }),
            directory,
            ["release"]
          );

          assert.equal(outcomeFor(result, prerequisite).status, behavior);
          assert.equal(
            outcomeFor(result, consumerCheckId).status,
            behavior === "passed" ? "passed" : "unavailable"
          );
          assert.equal(
            calls.filter(
              (invocation) =>
                scriptForCommand(invocation) ===
                prerequisite.slice("script:".length)
            ).length,
            1,
            prerequisite
          );
          assert.equal(
            calls.filter(
              (invocation) =>
                invocation.command === "bun" &&
                invocation.args[0] === "test" &&
                invocation.args[1] === consumerPath
            ).length,
            behavior === "passed" ? 1 : 0,
            `${consumerCheckId} execution after ${prerequisite} ${behavior}`
          );
        }
      }
    }
  );
});
