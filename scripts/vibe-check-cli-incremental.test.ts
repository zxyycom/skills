import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import {
  activationFlagForCheck,
  type GateActivationPlan
} from "./lib/vibe-gate.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { runVibeCheck } from "./vibe-check.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

function incrementalPlan(directory: string): GateActivationPlan {
  return {
    activeCheckIds: ["passed"],
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
          flags: [activationFlagForCheck("passed")],
          mode: "all"
        },
        execution: () => ({ status: "passed" as const, data: {} })
      }),
      defineCheck({
        checkId: "reused",
        displayName: "reused",
        enabledByFlags: {
          flags: [activationFlagForCheck("reused")],
          mode: "all"
        },
        execution() {
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
          createDefinition(_invocation, selectedPlan) {
            assert.equal(selectedPlan, activationPlan);
            return definition;
          },
          createInvocationDirectory: () => invocationDirectory,
          prepareActivation: async () => activationPlan,
          publishReceipts: async (_plan, passedIds) => {
            publishedPassedIds = passedIds;
            return { published: true, receiptCount: 1 };
          },
          reportInfo: (message) => information.push(message),
          async runProject(selectedDefinition, controls) {
            assert.deepEqual(controls.flags, [
              activationFlagForCheck("passed")
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
        decisions: activationPlan.decisions,
        fallbackDetail: null,
        mode: "incremental",
        publication: { published: true, receiptCount: 1 },
        releaseTestBatchProof: null
      });
    }
  );
});

test("CLI accepts an empty effective aggregate when all base Checks are reused", async () => {
  await withTemporaryDirectory("skills-vibe-reuse-cli-", async (directory) => {
    const reusePlan: GateActivationPlan = {
      ...incrementalPlan(directory),
      activeCheckIds: [],
      decisions: [
        {
          action: "reuse",
          checkId: "reused",
          fingerprint: "reused-fingerprint",
          reason: "unchanged-success"
        }
      ]
    };
    assert.equal(
      await runVibeCheck([], {
        createDefinition: selectiveDefinition,
        createInvocationDirectory: () => path.join(directory, "reuse"),
        prepareActivation: async () => reusePlan,
        publishReceipts: async (_plan, passedIds) => {
          assert.deepEqual([...passedIds], []);
          return { published: true, receiptCount: 1 };
        },
        reportInfo: () => undefined,
        async runProject(definition, controls) {
          assert.equal(controls.checkAggregation?.empty, "passed");
          return await run(definition, { ...controls, outputs: noOutput });
        }
      }),
      0
    );
  });
});

test("CLI publishes conservative fallback reasons", async () => {
  await withTemporaryDirectory(
    "skills-vibe-fallback-cli-",
    async (directory) => {
      const fallbackPlan: GateActivationPlan = {
        activeCheckIds: ["passed"],
        cacheDirectory: path.join(directory, "fallback-cache"),
        decisions: [
          {
            action: "execute",
            checkId: "passed",
            fingerprint: null,
            reason: "snapshot-unavailable"
          }
        ],
        fallbackDetail: "required tool probe failed",
        kind: "fallback",
        snapshot: null
      };
      const invocationDirectory = path.join(directory, "fallback");
      const information: string[] = [];
      assert.equal(
        await runVibeCheck([], {
          createDefinition: passedDefinition,
          createInvocationDirectory: () => invocationDirectory,
          prepareActivation: async () => fallbackPlan,
          publishReceipts: async () => ({
            published: false,
            reason: "not-incremental"
          }),
          reportInfo: (message) => information.push(message),
          async runProject(definition, controls) {
            return await run(definition, { ...controls, outputs: noOutput });
          }
        }),
        0
      );
      assert.match(
        information[0] ?? "",
        /Snapshot fallback: required tool probe failed/u
      );
      const summary = JSON.parse(
        await fs.readFile(
          path.join(invocationDirectory, "machine", "gate-incremental.json"),
          "utf8"
        )
      );
      assert.equal(summary.fallbackDetail, "required tool probe failed");
    }
  );
});
