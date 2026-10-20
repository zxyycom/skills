import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import { runVibeCheck } from "./vibe-check.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";

test("CLI release, cold and CI modes never activate receipt-based omission", async () => {
  await withTemporaryDirectory("gate-full-mode-", async (directory) => {
    for (const [argv, continuousIntegration] of [
      [[], true],
      [["--full"], false],
      [["--full", "--cold"], false]
    ] as const) {
      assert.equal(
        await runVibeCheck(argv, {
          continuousIntegration,
          prepareActivation: async () => ({
            kind: "incremental",
            activeCheckIds: [],
            decisions: [],
            cacheDirectory: path.join(directory, "cache"),
            snapshot: fixtureGateWorkspaceSnapshot()
          }),
          createDefinition(_invocation, _plan, dependencies) {
            assert.equal(dependencies.activeCheckIds, undefined);
            assert.equal("releaseTestBatchProof" in dependencies, false);
            return passedDefinition();
          },
          createInvocationDirectory: () =>
            path.join(directory, `run-${argv.length}-${continuousIntegration}`),
          publishReceipts: async () => ({
            published: false,
            reason: "not-incremental"
          }),
          reportInfo: () => undefined,
          async runProject(definition, controls) {
            assert.deepEqual(
              controls.flags,
              argv.length > 0 ? ["release"] : []
            );
            return run(definition, { ...controls, outputs: noOutput });
          }
        }),
        0
      );
    }
  });
});
