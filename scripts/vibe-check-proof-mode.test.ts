import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import test from "node:test";
import { defineConfig, run } from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import { runVibeCheck } from "./vibe-check.ts";
import {
  createGateDefinition,
  createVibeNativeChecks
} from "./lib/vibe-gate.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

test("CLI release, cold and CI modes never activate receipt-based omission", async () => {
  await withTemporaryDirectory("gate-full-mode-", async (directory) => {
    await fs.writeFile(path.join(directory, "document.md"), "[broken]()\n");
    for (const [argv, continuousIntegration] of [
      [[], true],
      [["--tag", "release"], false],
      [["--tag", "release", "--cold"], false],
      [["--full"], false],
      [["--full", "--cold"], false]
    ] as const) {
      let runCalls = 0;
      const observed: {
        activeToolIds: readonly string[] | undefined;
        flags: readonly string[] | undefined;
        project: ProjectDefinition | null;
        result: RunResult | null;
      } = {
        activeToolIds: undefined,
        flags: undefined,
        project: null,
        result: null
      };
      assert.equal(
        await runVibeCheck(argv, {
          continuousIntegration,
          prepareActivation: async () => ({
            kind: "incremental",
            activeCheckIds: [],
            activeToolIds: [],
            decisions: [],
            cacheDirectory: path.join(directory, "cache"),
            snapshot: fixtureGateWorkspaceSnapshot()
          }),
          createDefinition(invocation, _plan, dependencies) {
            observed.activeToolIds = dependencies.activeToolIds;
            observed.project = createGateDefinition(
              invocation.tags,
              dependencies
            );
            return defineConfig({
              checks: createVibeNativeChecks(directory).filter(
                ({ checkId }) => checkId === "markdown-lint"
              ),
              scheduler: { resourceCapacities: { "repository-scan": 2 } }
            });
          },
          createInvocationDirectory: () =>
            path.join(directory, `run-${argv.length}-${continuousIntegration}`),
          publishReceipts: async () => ({
            published: false,
            reason: "not-incremental"
          }),
          reportInfo: () => undefined,
          reportError: () => undefined,
          async runProject(definition, controls) {
            runCalls += 1;
            observed.flags = controls.flags;
            observed.result = await run(definition, {
              ...controls,
              projectRoot: directory,
              outputs: noOutput
            });
            return observed.result;
          }
        }),
        1
      );
      assert.equal(runCalls, 1);
      assert.equal(observed.activeToolIds, undefined);
      assert.ok(observed.project);
      assert.equal(
        observed.project.checks.find(
          ({ checkId }) => checkId === "markdown-lint"
        )?.enabledByFlags,
        undefined
      );
      assert.deepEqual(
        observed.flags,
        argv.some((argument) => argument === "--full" || argument === "release")
          ? ["release"]
          : []
      );
      assert.ok(observed.result);
      assert.equal(observed.result.kind, "completed");
      assert.equal(
        observed.result.snapshot.checks.find(
          ({ checkId }) => checkId === "markdown-lint"
        )?.outcome.status,
        "failed"
      );
    }
  });
});
