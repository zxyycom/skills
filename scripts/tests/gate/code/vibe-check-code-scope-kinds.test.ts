import fs from "node:fs/promises";
import path from "node:path";
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
  isolatedFunctionDefinition,
  metricIds,
  selectedDefinition,
  sixParameterFunction,
  writeFiles
} from "./vibe-check-code-test-support.ts";
import type { GateToolId } from "../../../lib/vibe-gate/impact/impact-tools.ts";

const qualityCommandIds = [
  "script:typecheck",
  "script:lint",
  "script:format:check"
];

test("nested maintenance modules retain exact explicit scope metric coverage", async () => {
  const cases = [
    [
      "decision-maintenance",
      "tools/decision-records/src/candidates/create/prepare.ts"
    ],
    ["decision-query", "tools/decision-records/src/query/search/matcher.ts"],
    ["decision-record", "tools/decision-records/src/records/parser.ts"],
    ["decision-stage", "tools/decision-records/src/staging/refresh/proof.ts"],
    ["decision-cli", "tools/decision-records/src/cli/commands/select.ts"],
    [
      "investigation-maintenance",
      "tools/investigation-report/src/candidates/create/prepare.ts"
    ],
    [
      "investigation-query",
      "tools/investigation-report/src/query/search/matcher.ts"
    ],
    [
      "investigation-record",
      "tools/investigation-report/src/resources/inspect.ts"
    ],
    [
      "investigation-stage",
      "tools/investigation-report/src/staging/domain/proof.ts"
    ],
    [
      "investigation-cli",
      "tools/investigation-report/src/cli/commands/select.ts"
    ],
    ["gate-tests", "scripts/lib/vibe-gate/impact/paths.ts"],
    ["environment", "scripts/environment/tests/environment.test.ts"],
    [
      "skill-package-hash",
      "scripts/lib/skill-package/tests/skill-package-hash-path.test.ts"
    ],
    [
      "skill-release-publisher",
      "scripts/lib/publishing/publish-skills-assets.ts"
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
    ["record-operations", "tools/record-operations/src/reader/acquire.ts"],
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

test("declaration-only distribution scopes run quality commands but disable both real metrics", async () => {
  await withTemporaryDirectory(
    "gate-declaration-quality-",
    async (directory) => {
      const commands = [
        ["typecheck", "typecheck"],
        ["lint", "lint"],
        ["format:check", "format-check"]
      ] as const;
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({
          scripts: Object.fromEntries(
            commands.map(([script, file]) => [script, `bun ${file}.mjs`])
          )
        })
      );
      for (const [, command] of commands)
        await fs.writeFile(
          path.join(directory, `${command}.mjs`),
          `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(`${command}.started`)}, "started");\n`
        );
      for (const scope of [
        "decision-distribution",
        "investigation-distribution"
      ] as const) {
        for (const [, command] of commands)
          await fs.rm(path.join(directory, `${command}.started`), {
            force: true
          });
        const result = await runDefinition(
          isolatedChecks(selectedDefinition([scope]), [
            ...metricIds,
            ...qualityCommandIds
          ]),
          directory,
          [`gate-tool:${scope}`]
        );
        for (const id of metricIds) {
          const outcome = outcomeFor(result, id);
          assert.equal(outcome.status, "not-applicable", scope);
          assert.deepEqual(
            outcome.status === "not-applicable" ? outcome.reason : null,
            { code: "flag-condition-not-matched" },
            `${scope}: ${id}`
          );
        }
        for (const id of qualityCommandIds)
          assert.equal(
            outcomeFor(result, id).status,
            "passed",
            `${scope}: ${id}`
          );
        for (const [, command] of commands)
          assert.equal(
            await fs.readFile(
              path.join(directory, `${command}.started`),
              "utf8"
            ),
            "started"
          );
      }
    }
  );
});

test("declaration distribution scopes do not leak API files into a selected code domain", async () => {
  await withTemporaryDirectory("gate-declaration-union-", async (directory) => {
    const owned = "tools/task-graph/src/task.ts";
    await writeFiles(directory, [owned]);
    await writeFiles(
      directory,
      [
        "tools/decision-records/api/index.d.ts",
        "tools/investigation-report/api/index.d.ts",
        "skills/decision-records/scripts/runtime/generated.ts"
      ],
      sixParameterFunction
    );
    const definition = selectedDefinition([
      "task-graph",
      "decision-distribution",
      "investigation-distribution"
    ]);
    assertMetricFiles(definition, directory, [owned]);
    const result = await runDefinition(
      isolatedFunctionDefinition(definition),
      directory,
      [
        "gate-tool:task-graph",
        "gate-tool:decision-distribution",
        "gate-tool:investigation-distribution"
      ]
    );
    assert.equal(result.aggregate, "passed");
    assert.equal(outcomeFor(result, "function-metrics").status, "passed");
    assert.deepEqual(result.snapshot.records, []);
  });
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
