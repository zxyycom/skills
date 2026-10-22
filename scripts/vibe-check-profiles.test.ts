import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import { createGateDefinition, gateCheckIds } from "./lib/vibe-gate.ts";
import {
  outsideQuickScopeFlag,
  quickGateCheckIds
} from "./lib/vibe-gate/profiles.ts";
import { resolveGateInvocation, runVibeCheck } from "./vibe-check.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { authoritativeGatePackageScripts } from "./validators/project-config.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

test("project scopes parse independently from release compatibility arguments", () => {
  assert.equal(
    authoritativeGatePackageScripts["check:changed"],
    "bun run check --scope changed"
  );
  assert.equal(authoritativeGatePackageScripts.all, "bun run check:changed");
  for (const scope of ["quick", "changed", "full"] as const)
    assert.equal(resolveGateInvocation(["--scope", scope])?.scope, scope);
  for (const args of [
    ["--scope"],
    ["--scope", "release"],
    ["--scope", "unknown"],
    ["--scope", "quick", "--scope", "changed"],
    ["--scope", "changed", "--full"],
    ["--tag", "release", "--scope", "full"]
  ])
    assert.equal(resolveGateInvocation(args), null);
});

test("quick Definition retains all catalog IDs and intersects native activation conditions", () => {
  const quick = createGateDefinition([], {
    scope: "quick",
    activeToolIds: ["repository-code"]
  });
  const changed = createGateDefinition([], {
    activeToolIds: ["repository-code"]
  });
  assert.deepEqual(
    quick.checks.map(({ checkId }) => checkId),
    gateCheckIds()
  );
  const expectedQuickIds = [
    "gate-environment",
    "secret-detection",
    "json-validation",
    "json-schema-validation",
    "markdown-link-validation",
    "markdown-lint",
    "script:typecheck",
    "script:lint",
    "script:format:check",
    "script:validate"
  ];
  assert.deepEqual([...quickGateCheckIds].sort(), expectedQuickIds.toSorted());
  for (const [index, check] of quick.checks.entries()) {
    const complete = changed.checks[index]!;
    assert.deepEqual(check.dependsOn, complete.dependsOn, check.checkId);
    assert.deepEqual(
      check.resourceClaims,
      complete.resourceClaims,
      check.checkId
    );
    assert.deepEqual(
      check.enabledByFlags,
      expectedQuickIds.includes(check.checkId)
        ? complete.enabledByFlags
        : {
            when:
              complete.enabledByFlags === undefined
                ? outsideQuickScopeFlag
                : {
                    kind: "all",
                    conditions: [
                      outsideQuickScopeFlag,
                      complete.enabledByFlags.when
                    ]
                  },
            propagateDependsOn: true
          },
      check.checkId
    );
  }
});

test("quick CLI preserves exact reuse flags without publishing or clearing complete receipts", async () => {
  await withTemporaryDirectory("gate-quick-receipt-", async (directory) => {
    const cacheDirectory = path.join(directory, "cache");
    await fs.mkdir(cacheDirectory);
    const receiptPath = path.join(cacheDirectory, "receipts.json");
    await fs.writeFile(receiptPath, "existing proof\n");
    let prepared = false;
    let selectedScope = "";
    const exit = await runVibeCheck([], {
      continuousIntegration: false,
      createDefinition(invocation, _plan, dependencies) {
        selectedScope = invocation.scope;
        assert.equal(dependencies.scope, "quick");
        assert.deepEqual(dependencies.activeToolIds, []);
        return passedDefinition();
      },
      createInvocationDirectory: () => directory,
      nowMilliseconds: () => 100,
      prepareActivation: async () => {
        prepared = true;
        return {
          kind: "incremental",
          snapshot: fixtureGateWorkspaceSnapshot(),
          cacheDirectory,
          activeCheckIds: [],
          activeToolIds: [],
          decisions: [
            {
              action: "reuse",
              checkId: "markdown-lint",
              fingerprint: "proof",
              reason: "unchanged-success"
            },
            {
              action: "execute",
              checkId: "script:test:check",
              fingerprint: "heavy",
              reason: "inputs-changed"
            }
          ]
        };
      },
      publishReceipts: async () => {
        throw new Error("quick must not invoke receipt publisher");
      },
      reportInfo: () => undefined,
      async runProject(definition, controls) {
        assert.deepEqual(controls.flags, []);
        return run(definition, { ...controls, outputs: noOutput });
      }
    });
    assert.equal(exit, 0);
    assert.equal(prepared, true);
    assert.equal(selectedScope, "quick");
    assert.equal(await fs.readFile(receiptPath, "utf8"), "existing proof\n");
    const summary = JSON.parse(
      await fs.readFile(
        path.join(directory, "machine/gate-incremental.json"),
        "utf8"
      )
    );
    assert.deepEqual(summary.counts, {
      execute: 9,
      fallback: 0,
      firstRun: 0,
      reuse: 1,
      disabled: 54
    });
    assert.deepEqual(
      summary.decisions.map(({ checkId }: { checkId: string }) => checkId),
      ["markdown-lint"]
    );
    assert.equal(summary.completeChangePlan.length, 2);
    assert.deepEqual(summary.publication, {
      published: false,
      reason: "quick-scope"
    });
  });
});

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
