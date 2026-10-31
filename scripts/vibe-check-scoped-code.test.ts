import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  collectProjectFiles,
  defineCheck,
  defineConfig
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition } from "@zxyycom/vibe-check";
import * as v from "valibot";
import { createGateDefinition } from "./lib/vibe-gate.ts";
import type { GateToolId } from "./lib/vibe-gate/impact-tools.ts";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

const metricIds = ["file-metrics", "function-metrics"];
const codeAreasSchema = v.looseObject({
  codeAreas: v.record(
    v.string(),
    v.looseObject({
      files: v.object({
        patterns: v.array(v.string()),
        useDefaultExcludes: v.optional(v.boolean())
      })
    })
  )
});
const findingSchema = v.object({
  functionName: v.string(),
  limit: v.number(),
  metric: v.string(),
  path: v.string(),
  value: v.number()
});
const healthyFunction = "export function healthy() { return 1; }\n";
const sixParameterFunction =
  "export function tooMany(a: number, b: number, c: number, d: number, e: number, f: number) { return a; }\n";

async function writeFiles(
  directory: string,
  files: readonly string[],
  content: string = healthyFunction
): Promise<void> {
  for (const file of files) {
    const target = path.join(directory, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
}

function selectedDefinition(scopes: readonly GateToolId[]): ProjectDefinition {
  return createGateDefinition([], {
    scope: "selected",
    selectionScopes: scopes
  });
}

function checkFor(definition: ProjectDefinition, checkId: string): Check {
  const check = definition.checks.find((entry) => entry.checkId === checkId);
  assert.ok(check, `missing ${checkId}`);
  return check;
}

function assertMetricFiles(
  definition: ProjectDefinition,
  directory: string,
  expected: readonly string[]
): void {
  for (const checkId of metricIds) {
    const { codeAreas } = v.parse(
      codeAreasSchema,
      checkFor(definition, checkId).options
    );
    const actual = new Set(
      Object.values(codeAreas).flatMap(({ files }) =>
        collectProjectFiles({ projectRoot: directory, selection: files })
      )
    );
    assert.deepEqual([...actual].sort(), [...expected].sort(), checkId);
  }
}

function isolatedFunctionDefinition(
  definition: ProjectDefinition
): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "gate-environment",
        displayName: "Isolated passing environment",
        execute: () => ({ status: "passed", data: {} })
      }),
      checkFor(definition, "function-metrics")
    ],
    scheduler: { resourceCapacities: { "cpu-work": 4 } }
  });
}

test("selected code metrics collect owned maintenance code without dependency or generated copies", async () => {
  await withTemporaryDirectory("gate-owned-code-", async (directory) => {
    const owned = [
      "tools/task-graph/src/task.ts",
      "tools/task-graph/tests/task.test.ts"
    ];
    await writeFiles(directory, [
      ...owned,
      "tools/task-graph/README.md",
      "tools/task-graph/settings.json",
      "tools/task-graph/src/module.mts",
      "tools/task-graph/node_modules/dependency.ts",
      "tools/index-runtime/src/runtime.ts",
      "tools/skill-updater/src/update.ts",
      "tools/decision-records/src/decision.ts",
      "scripts/lib/gate-sample.ts",
      "skills/task-graph/scripts/runtime/copied.ts",
      "docs/task-graph/example.ts"
    ]);
    assertMetricFiles(selectedDefinition(["task-graph"]), directory, owned);
  });
});

test("selected code metrics union multiple independently owned domains", async () => {
  await withTemporaryDirectory("gate-code-union-", async (directory) => {
    const owned = [
      "tools/task-graph/src/task.ts",
      "tools/novel-cards/src/cards.js"
    ];
    await writeFiles(directory, [
      ...owned,
      "tools/index-runtime/src/runtime.ts",
      "tools/decision-records/src/decision.ts",
      "skills/novel-cards/scripts/runtime/copied.ts"
    ]);
    assertMetricFiles(
      selectedDefinition(["task-graph", "novel-cards", "task-graph"]),
      directory,
      owned
    );
  });
});

test("selected metric scope exclusions do not erase another scope inclusion", async () => {
  await withTemporaryDirectory("gate-code-exclusions-", async (directory) => {
    const search = "tools/shared/src/file-text-search/index.ts";
    const output = "tools/shared/src/file-text-search/record-search-output.ts";
    await writeFiles(directory, [
      search,
      output,
      "tools/index-runtime/src/runtime.ts",
      "skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
    ]);
    assertMetricFiles(selectedDefinition(["file-text-search"]), directory, [
      search
    ]);
    assertMetricFiles(selectedDefinition(["record-search-output"]), directory, [
      output
    ]);
    assertMetricFiles(
      selectedDefinition(["file-text-search", "record-search-output"]),
      directory,
      [search, output]
    );
    assertMetricFiles(
      selectedDefinition(["record-search-output", "file-text-search"]),
      directory,
      [search, output]
    );
  });
});

test("selected function metrics ignore unrelated violations and block owned violations", async () => {
  await withTemporaryDirectory("gate-owned-function-", async (directory) => {
    const owned = "tools/task-graph/src/task.ts";
    await writeFiles(directory, [owned]);
    await writeFiles(
      directory,
      [
        "tools/decision-records/src/decision.ts",
        "tools/task-graph/tests/task.test.ts"
      ],
      sixParameterFunction
    );
    const definition = isolatedFunctionDefinition(
      selectedDefinition(["task-graph"])
    );
    const flags = ["gate-tool:task-graph"];
    const healthy = await runDefinition(definition, directory, flags);
    assert.equal(healthy.aggregate, "passed");
    assert.equal(outcomeFor(healthy, "function-metrics").status, "passed");
    assert.deepEqual(healthy.snapshot.records, []);

    await writeFiles(directory, [owned], sixParameterFunction);
    const failed = await runDefinition(definition, directory, flags);
    assert.equal(failed.aggregate, "failed");
    const outcome = outcomeFor(failed, "function-metrics");
    assert.equal(outcome.status, "failed");
    assert.deepEqual(outcome.status === "failed" ? { ...outcome.data } : null, {
      blockingFindingCount: 1,
      findingCount: 1
    });
    assert.deepEqual(
      failed.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
      [
        {
          functionName: "tooMany",
          limit: 5,
          metric: "parameter-count",
          path: owned,
          value: 6
        }
      ]
    );
  });
});

test("changed full and release metrics retain all maintained code and unrelated violations", async () => {
  await withTemporaryDirectory("gate-complete-code-", async (directory) => {
    const owned = "tools/task-graph/src/task.ts";
    const unrelated = "tools/decision-records/src/decision.ts";
    const support = "scripts/lib/gate-sample.ts";
    await writeFiles(directory, [owned, support]);
    await writeFiles(directory, [unrelated], sixParameterFunction);
    await writeFiles(directory, [
      "skills/task-graph/scripts/runtime/copied.ts"
    ]);
    for (const scope of ["changed", "full", "release"] as const) {
      const definition = createGateDefinition(
        scope === "release" ? ["release"] : [],
        { scope }
      );
      assertMetricFiles(definition, directory, [owned, unrelated, support]);
      const result = await runDefinition(
        isolatedFunctionDefinition(definition),
        directory
      );
      assert.equal(
        outcomeFor(result, "function-metrics").status,
        "failed",
        scope
      );
      assert.deepEqual(
        result.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
        [
          {
            functionName: "tooMany",
            limit: 5,
            metric: "parameter-count",
            path: unrelated,
            value: 6
          }
        ],
        scope
      );
    }
  });
});
