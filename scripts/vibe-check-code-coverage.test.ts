import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";
import {
  assertMetricFiles,
  findingSchema,
  isolatedFunctionDefinition,
  selectedDefinition,
  sixParameterFunction,
  writeFiles
} from "./vibe-check-code-test-support.ts";

test("selected version-control metrics block six-parameter maintained product source", async () => {
  await withTemporaryDirectory(
    "gate-version-control-metrics-",
    async (directory) => {
      const owned = "tools/shared/src/version-control/query.ts";
      const definition = selectedDefinition(["version-control"]);
      await writeFiles(directory, [owned]);
      await writeFiles(
        directory,
        ["tools/shared/src/file-text-search/index.ts"],
        sixParameterFunction
      );
      assertMetricFiles(definition, directory, [owned]);
      const isolated = isolatedFunctionDefinition(definition);
      const flags = ["gate-tool:version-control"];
      const healthy = await runDefinition(isolated, directory, flags);
      assert.equal(healthy.aggregate, "passed");
      assert.deepEqual(healthy.snapshot.records, []);
      await writeFiles(directory, [owned], sixParameterFunction);
      const failed = await runDefinition(isolated, directory, flags);
      assert.equal(failed.aggregate, "failed");
      assert.equal(outcomeFor(failed, "function-metrics").status, "failed");
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
    }
  );
});

test("selected build-source metrics block eight automation parameters without scanning nested outputs", async () => {
  await withTemporaryDirectory(
    "gate-build-source-metrics-",
    async (directory) => {
      const owned = "scripts/build/adapter.ts";
      const eightParameters =
        "export function tooMany(a, b, c, d, e, f, g, h) { return a; }\n";
      await writeFiles(directory, [owned]);
      await writeFiles(
        directory,
        [
          "scripts/build/node_modules/dependency.ts",
          "scripts/build/dist/output.ts",
          "scripts/build/build/output.ts",
          "scripts/build/nested/build/output.ts",
          "scripts/other/build/output.ts",
          "tools/alpha/build/output.ts",
          "skills/alpha/scripts/runtime/generated.ts"
        ],
        eightParameters
      );
      const definition = selectedDefinition(["repository-code"]);
      assertMetricFiles(definition, directory, [owned]);
      const isolated = isolatedFunctionDefinition(definition);
      const flags = ["gate-tool:repository-code"];
      const healthy = await runDefinition(isolated, directory, flags);
      assert.equal(healthy.aggregate, "passed");
      assert.deepEqual(healthy.snapshot.records, []);
      await writeFiles(directory, [owned], eightParameters);
      const failed = await runDefinition(isolated, directory, flags);
      assert.equal(failed.aggregate, "failed");
      assert.equal(outcomeFor(failed, "function-metrics").status, "failed");
      assert.deepEqual(
        failed.snapshot.records.map(({ data }) => v.parse(findingSchema, data)),
        [
          {
            functionName: "tooMany",
            limit: 7,
            metric: "parameter-count",
            path: owned,
            value: 8
          }
        ]
      );
    }
  );
});
