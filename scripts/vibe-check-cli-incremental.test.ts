import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import {
  activationFlagForTool,
  type GateActivationPlan
} from "./lib/vibe-gate.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { runVibeCheck } from "./vibe-check.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

function incrementalPlan(directory: string): GateActivationPlan {
  return {
    activeCheckIds: ["passed"],
    activeToolIds: ["passed-tool"],
    cacheDirectory: path.join(directory, "cache"),
    decisions: [
      {
        action: "execute",
        checkId: "passed",
        fingerprint: "fixture-fingerprint",
        reason: "inputs-changed"
      },
      {
        action: "reuse",
        checkId: "reused",
        fingerprint: "reused-fingerprint",
        reason: "unchanged-success"
      }
    ],
    kind: "incremental",
    snapshot: fixtureGateWorkspaceSnapshot()
  };
}

function selectiveDefinition() {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "passed",
        displayName: "passed",
        enabledByFlags: {
          when: activationFlagForTool("passed-tool")
        },
        execute: () => ({ status: "passed" as const, data: {} })
      }),
      defineCheck({
        checkId: "reused",
        displayName: "reused",
        enabledByFlags: {
          when: activationFlagForTool("reused-tool")
        },
        execute() {
          throw new Error("a reused Check must not execute");
        }
      })
    ],
    outputs: noOutput
  });
}

test("CLI publishes incremental activation and receipt summaries", async () => {
  await withTemporaryDirectory(
    "skills-vibe-incremental-cli-",
    async (directory) => {
      const activationPlan = incrementalPlan(directory);
      const definition = selectiveDefinition();
      const information: string[] = [];
      const invocationDirectory = path.join(directory, "invocation");
      let publishedPassedIds: ReadonlySet<string> | null = null;
      assert.equal(
        await runVibeCheck([], {
          continuousIntegration: false,
          createDefinition(_invocation, selectedPlan) {
            assert.equal(selectedPlan, activationPlan);
            return definition;
          },
          createInvocationDirectory: () => invocationDirectory,
          prepareActivation: async () => activationPlan,
          publishReceipts: async (_plan, passedIds) => {
            publishedPassedIds = passedIds.passedCheckIds;
            return { published: true, receiptCount: 1 };
          },
          reportInfo: (message) => information.push(message),
          async runProject(selectedDefinition, controls) {
            assert.deepEqual(controls.flags, [
              activationFlagForTool("passed-tool")
            ]);
            return await run(selectedDefinition, {
              ...controls,
              outputs: noOutput
            });
          }
        }),
        0
      );
      assert.deepEqual([...(publishedPassedIds ?? [])], ["passed"]);
      assert.match(information[0] ?? "", /execute 1, reuse 1, fallback 0/u);
      const summary = JSON.parse(
        await fs.readFile(
          path.join(invocationDirectory, "machine", "gate-incremental.json"),
          "utf8"
        )
      );
      assert.deepEqual(summary, {
        counts: { execute: 1, fallback: 0, firstRun: 0, reuse: 1 },
        activeToolIds: ["passed-tool"],
        decisions: activationPlan.decisions,
        fallbackDetail: null,
        unclosedInputs: { entries: [], omittedCount: 0, total: 0 },
        mode: "incremental",
        publication: { published: true, receiptCount: 1 }
      });
    }
  );
});

test("CLI rejects output failure, Run rejection and failed aggregates without publishing success", async () => {
  await withTemporaryDirectory("gate-cli-final-result-", async (directory) => {
    for (const mode of ["output", "rejected", "failed"] as const) {
      const diagnostics: string[] = [];
      let publicationCalls = 0;
      const exitCode = await runVibeCheck([], {
        continuousIntegration: false,
        createDefinition: passedDefinition,
        createInvocationDirectory: () => path.join(directory, mode),
        prepareActivation: async () => incrementalPlan(directory),
        publishReceipts: async (_plan, result) => {
          publicationCalls += 1;
          assert.equal(result.runSucceeded, false);
          return { published: false, reason: "check-not-passed" };
        },
        reportError: (message) => diagnostics.push(message),
        reportInfo: () => undefined,
        async runProject(definition, controls) {
          if (mode === "rejected") throw new Error("private rejection detail");
          return run(
            {
              ...definition,
              ...(mode === "output"
                ? {
                    scheduler: {
                      ...definition.scheduler,
                      terminalEffects: [
                        () => {
                          throw new Error("private terminal detail");
                        }
                      ]
                    }
                  }
                : {}),
              ...(mode === "failed"
                ? {
                    checks: [
                      defineCheck({
                        checkId: "failed",
                        displayName: "failed",
                        execute: () => ({ status: "failed", data: {} })
                      })
                    ]
                  }
                : {})
            },
            { ...controls, outputs: noOutput }
          );
        }
      });
      assert.equal(exitCode, 1, mode);
      assert.equal(publicationCalls, mode === "rejected" ? 0 : 1, mode);
      assert.ok(diagnostics.length > 0);
      assert.equal(diagnostics.join(" ").includes("private"), false);
    }
  });
});
