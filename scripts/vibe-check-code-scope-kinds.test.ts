import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";
import {
  assertMetricFiles,
  isolatedChecks,
  isolatedFunctionDefinition,
  metricIds,
  selectedDefinition,
  sixParameterFunction,
  writeFiles
} from "./vibe-check-code-test-support.ts";

const qualityCommandIds = [
  "script:typecheck",
  "script:lint",
  "script:format:check"
];

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
