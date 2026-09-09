import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import type { GateActivationPlan } from "./lib/vibe-gate.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { runVibeCheck } from "./vibe-check.ts";

const noOutput = {
  diagnosticLogging: { enabled: false },
  machinePublication: { enabled: false },
  progressRendering: { enabled: false }
} as const;

async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

type ProofModeRun = Readonly<{
  information: readonly string[];
  summary: Readonly<{ releaseTestBatchProof?: unknown }>;
}>;

async function runReleaseProofMode(
  directory: string,
  cold: boolean,
  reused: boolean
): Promise<ProofModeRun> {
  const snapshot = fixtureGateWorkspaceSnapshot();
  const releasePlan: GateActivationPlan = {
    activeCheckIds: ["release-proof-fixture"],
    cacheDirectory: path.join(directory, "incremental-gate-v2"),
    decisions: [
      {
        action: "execute",
        checkId: "release-proof-fixture",
        fingerprint: null,
        reason: "release-full"
      }
    ],
    kind: "release",
    snapshot
  };
  const invocationDirectory = path.join(directory, cold ? "cold" : "reused");
  const information: string[] = [];
  const exitCode = await runVibeCheck(["--full", ...(cold ? ["--cold"] : [])], {
    createDefinition(_invocation, selectedPlan, definitionDependencies) {
      assert.equal(selectedPlan, releasePlan);
      assert.equal(definitionDependencies.releaseTestBatchProof?.cold, cold);
      assert.equal(
        definitionDependencies.releaseTestBatchProof
          ?.initialWorkspaceFingerprint,
        snapshot.workspaceFingerprint
      );
      if (reused) definitionDependencies.releaseTestBatchProof?.onReuse?.();
      return defineConfig({
        checks: [
          defineCheck({
            checkId: "release-proof-fixture",
            displayName: "release proof fixture",
            execution: () => ({ status: "passed" as const, data: {} })
          })
        ],
        outputs: noOutput
      });
    },
    createInvocationDirectory: () => invocationDirectory,
    prepareActivation: async () => releasePlan,
    publishReceipts: async () => ({
      published: false,
      reason: "not-incremental"
    }),
    reportInfo: (message) => information.push(message),
    async runProject(definition, controls) {
      return await run(definition, { ...controls, outputs: noOutput });
    }
  });
  assert.equal(exitCode, 0);
  const summary: ProofModeRun["summary"] = JSON.parse(
    await fs.readFile(
      path.join(invocationDirectory, "machine", "gate-incremental.json"),
      "utf8"
    )
  );
  return { information, summary };
}

test("CLI publishes auditable release test proof modes", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-proof-mode-",
    async (directory) => {
      const reused = await runReleaseProofMode(directory, false, true);
      assert.equal(reused.summary.releaseTestBatchProof, "reused");
      assert.ok(
        reused.information.some((message) => message.includes("reused"))
      );

      const cold = await runReleaseProofMode(directory, true, false);
      assert.equal(cold.summary.releaseTestBatchProof, "cold");
      assert.ok(
        cold.information.some((message) => message.includes("ran cold"))
      );
    }
  );
});
