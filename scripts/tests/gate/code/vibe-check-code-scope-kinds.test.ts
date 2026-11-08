import assert from "node:assert/strict";
import test from "node:test";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "../vibe-check-test-support.ts";
import {
  assertMetricFiles,
  isolatedChecks,
  metricIds,
  selectedDefinition,
  writeFiles
} from "./vibe-check-code-test-support.ts";
import type { GateToolId } from "../../../lib/vibe-gate/impact/impact-tools.ts";

test("nested maintenance modules retain exact explicit scope metric coverage", async () => {
  const cases = [
    ["record-rust", "tools/record-cli/src/main.rs"],
    ["gate-tests", "scripts/lib/vibe-gate/impact/paths.ts"],
    ["environment", "scripts/environment/tests/environment.test.ts"],
    [
      "skill-package-hash",
      "scripts/lib/skill-package/tests/skill-package-hash-path.test.ts"
    ],
    [
      "skill-release-publisher",
      "scripts/lib/publishing/publish-skills-github.ts"
    ],
    ["generated-file", "scripts/lib/generation/runtime/source-runtime.ts"],
    [
      "test-evidence-project",
      "scripts/test-evidence/snapshot/snapshot-source.ts"
    ],
    [
      "version-control",
      "tools/shared/src/version-control/git/pending/prepare.ts"
    ],
    ["index-runtime", "tools/index-runtime/src/query/filter.ts"],
    ["task-graph", "tools/task-graph/src/engine/operation.ts"],
    ["video-understanding", "tools/video-understanding/src/media/asr.ts"],
    [
      "lightweight-judgment",
      "tools/lightweight-judgment/src/statistics/summary.ts"
    ],
    ["change-plan", "tools/change-plan/src/deletion/prepare.ts"],
    ["mcpshell", "tools/mcpshell-workspace-bridge/src/initializer/plan.ts"]
  ] as const satisfies readonly (readonly [GateToolId, string])[];
  await withTemporaryDirectory(
    "gate-nested-module-scopes-",
    async (directory) => {
      await writeFiles(
        directory,
        cases.map(([, filename]) => filename)
      );
      for (const [scope, filename] of cases) {
        assertMetricFiles(selectedDefinition([scope]), directory, [filename]);
      }
    }
  );
});

test("an expected code scope with no maintained files never reports passing metrics", async () => {
  await withTemporaryDirectory(
    "gate-empty-code-metrics-",
    async (directory) => {
      await writeFiles(directory, ["tools/decision-records/src/unrelated.ts"]);
      const definition = selectedDefinition(["task-graph"]);
      assertMetricFiles(definition, directory, []);
      const result = await runDefinition(
        isolatedChecks(definition, metricIds),
        directory,
        ["gate-tool:task-graph"]
      );
      assert.equal(result.aggregate, "failed");
      for (const id of metricIds) {
        const outcome = outcomeFor(result, id);
        assert.equal(outcome.status, "not-applicable", id);
        assert.deepEqual(
          outcome.status === "not-applicable" ? outcome.reason : null,
          { code: "no-eligible-input" },
          id
        );
      }
    }
  );
});
