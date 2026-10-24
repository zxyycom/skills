import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import { runVibeCheck } from "./vibe-check.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

test("CLI enforces only quick budgets including input preparation and late report overhead", async () => {
  await withTemporaryDirectory("gate-cli-performance-", async (directory) => {
    for (const mode of [
      "quick",
      "late",
      "changed",
      "full",
      "release",
      "ci"
    ] as const) {
      let currentTime = 0;
      let clockReads = 0;
      const invocationDirectory = path.join(directory, mode);
      const exit = await runVibeCheck(
        mode === "release"
          ? ["--full"]
          : mode === "changed" || mode === "full"
            ? ["--scope", mode]
            : [],
        {
          continuousIntegration: mode === "ci",
          nowMilliseconds: () => {
            clockReads += 1;
            return mode === "late" && clockReads >= 3 ? 30_000 : currentTime;
          },
          createInvocationDirectory: () => invocationDirectory,
          createDefinition(invocation, _plan, dependencies) {
            assert.equal(
              invocation.scope,
              mode === "ci" ? "full" : mode === "late" ? "quick" : mode
            );
            if (["full", "release", "ci"].includes(mode))
              assert.equal(dependencies.activeToolIds, undefined);
            return passedDefinition();
          },
          prepareActivation: async () => {
            currentTime = mode === "late" ? 29_999 : 30_000;
            return {
              kind: "incremental",
              snapshot: fixtureGateWorkspaceSnapshot(),
              cacheDirectory: path.join(directory, "cache"),
              activeCheckIds: [],
              activeToolIds: [],
              decisions: [
                {
                  action: "execute",
                  checkId: "script:typecheck",
                  fingerprint: null,
                  reason: "release-full"
                },
                {
                  action: "execute",
                  checkId: "release:skill-prepare",
                  fingerprint: null,
                  reason: "release-full"
                }
              ]
            };
          },
          publishReceipts: async () => ({
            published: false,
            reason: "not-incremental"
          }),
          reportInfo: () => undefined,
          reportError: () => undefined,
          async runProject(definition, controls) {
            const result = await run(definition, {
              ...controls,
              outputs: noOutput
            });
            assert.equal(result.kind, "completed");
            return result;
          }
        }
      );
      assert.equal(exit, mode === "quick" || mode === "late" ? 1 : 0, mode);
      const summary = JSON.parse(
        await fs.readFile(
          path.join(invocationDirectory, "machine/gate-performance.json"),
          "utf8"
        )
      );
      assert.equal(summary.nativeResult.aggregate, "passed", mode);
      const eligible =
        mode === "quick" || mode === "late" ? 10 : mode === "release" ? 69 : 66;
      assert.deepEqual(
        summary.selection,
        {
          basis: "planned-activation-before-run",
          eligible,
          execute: eligible,
          reuse: 0,
          disabled: 69 - eligible
        },
        mode
      );
      assert.equal(summary.performance.passed, exit === 0, mode);
      if (mode === "late")
        assert.equal(summary.timingBoundary.end, "after-performance-report");
      if (mode === "full" || mode === "ci") {
        const incremental = JSON.parse(
          await fs.readFile(
            path.join(invocationDirectory, "machine/gate-incremental.json"),
            "utf8"
          )
        );
        assert.deepEqual(
          incremental.decisions.map(
            ({ checkId }: { checkId: string }) => checkId
          ),
          ["script:typecheck"]
        );
        assert.equal(incremental.counts.execute, 1);
      }
    }
  });
});

test("CLI blocks quick report failure without adding a complete-scope I/O gate", async () => {
  await withTemporaryDirectory(
    "gate-performance-output-failure-",
    async (directory) => {
      for (const scope of ["quick", "changed"] as const) {
        const diagnostics: string[] = [];
        let nativePassed = false;
        const exit = await runVibeCheck(["--scope", scope], {
          continuousIntegration: false,
          prepareActivation: false,
          createDefinition: passedDefinition,
          createInvocationDirectory: () => directory,
          nowMilliseconds: () => 0,
          writePerformanceSummary: async () => {
            throw new Error("private I/O detail");
          },
          reportInfo: () => undefined,
          reportError: (message) => diagnostics.push(message),
          async runProject(definition, controls) {
            const result = await run(definition, {
              ...controls,
              outputs: noOutput
            });
            nativePassed =
              result.kind === "completed" && result.aggregate === "passed";
            return result;
          }
        });
        assert.equal(nativePassed, true);
        assert.equal(exit, scope === "quick" ? 1 : 0);
        assert.equal(diagnostics.length, 1);
        assert.match(
          diagnostics[0]!,
          /performance summary could not be completed/u
        );
        assert.equal(diagnostics[0]!.includes("private"), false);
      }
    }
  );
});

test("CLI consumes native duration facts for quick budgets and report-only scopes", async () => {
  await withTemporaryDirectory(
    "gate-cli-native-durations-",
    async (directory) => {
      for (const scenario of [
        {
          name: "p90-limit",
          durations: [0, 0, 0, 0, 0, 0, 0, 0, 10_000, 0],
          mean: 1_000,
          p90: 0,
          passed: true
        },
        {
          name: "p90-block",
          durations: [10_000, 0, 0, 0, 0, 0, 0, 0, 0],
          mean: 10_000 / 9,
          p90: 10_000,
          passed: false
        },
        {
          name: "mean-block",
          durations: [5_000],
          mean: 5_000,
          p90: 5_000,
          passed: false
        },
        {
          name: "null-and-zero",
          durations: [null, 0, 2],
          mean: 1,
          p90: 2,
          passed: true
        },
        {
          name: "no-executed-samples",
          durations: [null],
          mean: null,
          p90: null,
          passed: false
        }
      ]) {
        for (const scope of ["quick", "full"] as const) {
          const invocationDirectory = path.join(
            directory,
            scenario.name,
            scope
          );
          const exit = await runVibeCheck(["--scope", scope], {
            continuousIntegration: false,
            prepareActivation: false,
            createDefinition: passedDefinition,
            createInvocationDirectory: () => invocationDirectory,
            nowMilliseconds: () => 100,
            reportInfo: () => undefined,
            reportError: () => undefined,
            async runProject(definition, controls) {
              const result = await run(definition, {
                ...controls,
                outputs: noOutput
              });
              assert.equal(result.kind, "completed");
              if (result.kind !== "completed")
                throw new Error("expected completed native fixture Run");
              return {
                ...result,
                checkDurations: scenario.durations.map((durationMs, index) => ({
                  checkId: `native-${index}`,
                  durationMs
                }))
              };
            }
          });
          assert.equal(
            exit,
            scope === "full" || scenario.passed ? 0 : 1,
            `${scenario.name}: ${scope}`
          );
          const summary = JSON.parse(
            await fs.readFile(
              path.join(invocationDirectory, "machine/gate-performance.json"),
              "utf8"
            )
          );
          assert.equal(summary.nativeResult.aggregate, "passed");
          assert.equal(
            summary.performance.sampleCount,
            scenario.durations.filter((value) => value !== null).length
          );
          assert.equal(summary.performance.meanMs, scenario.mean);
          assert.equal(summary.performance.p90Ms, scenario.p90);
          assert.equal(
            summary.performance.passed,
            scope === "full" || scenario.passed
          );
        }
      }
    }
  );
});
