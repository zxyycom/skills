import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  releaseBunTestPackageFiles,
  releaseRequiredPackageScripts,
  releaseTestBatchGroups,
  semanticGateChecks
} from "./lib/vibe-gate.ts";
import {
  expectedSemanticCommandPaths,
  expectedSemanticGateChecks
} from "./vibe-check-catalog-fixture.ts";
import { repositoryRoot } from "./vibe-check-test-support.ts";

test("semantic Gate catalog matches its aggregate native entry points", async () => {
  for (const [, checkId, , files] of expectedSemanticGateChecks) {
    const commandPath = expectedSemanticCommandPaths.get(checkId);
    assert.ok(commandPath, `missing command path for ${checkId}`);
    if (commandPath?.includes("/checks/")) {
      const source = await fs.readFile(
        path.join(repositoryRoot, commandPath.slice(2)),
        "utf8"
      );
      const importedFiles = [
        ...source.matchAll(/await import\("(\.\.\/[^"\n]+)"\);/gu)
      ].map(
        ([, relativePath]) =>
          `./${path.posix.normalize(
            path.posix.join(
              path.posix.dirname(commandPath.slice(2)),
              relativePath
            )
          )}`
      );
      assert.deepEqual(importedFiles, files, checkId);
    } else {
      assert.deepEqual([commandPath], files, checkId);
    }
  }
  assert.deepEqual(
    [
      "change-plan",
      "decision-records",
      "investigation-report",
      "task-graph",
      "test-evidence"
    ].map(
      (tool) =>
        semanticGateChecks.filter(({ checkId }) =>
          checkId.startsWith(`test:${tool}:`)
        ).length
    ),
    [3, 5, 5, 8, 5]
  );
  const semanticFiles = expectedSemanticGateChecks.flatMap(
    ([, , , files]) => files
  );
  assert.equal(semanticFiles.length, 77);
  assert.equal(new Set(semanticFiles).size, semanticFiles.length);
  for (const tool of [
    "change-plan",
    "decision-records",
    "investigation-report",
    "task-graph",
    "test-evidence"
  ]) {
    const aggregatePath = `./tools/${tool}/tests/run.ts`;
    const aggregateSource = await fs.readFile(
      path.join(repositoryRoot, aggregatePath.slice(2)),
      "utf8"
    );
    const aggregateFiles = [
      ...aggregateSource.matchAll(/await import\("(\.\/[^"\n]+)"\);/gu)
    ]
      .map(
        ([, relativePath]) =>
          `./${path.posix.normalize(
            path.posix.join(
              path.posix.dirname(aggregatePath.slice(2)),
              relativePath
            )
          )}`
      )
      .sort();
    const expectedAggregateFiles = semanticFiles
      .filter(
        (file) =>
          file.startsWith(`./tools/${tool}/tests/`) &&
          file !== "./tools/task-graph/tests/native-store.test.ts"
      )
      .sort();
    assert.deepEqual(aggregateFiles, expectedAggregateFiles, aggregatePath);
  }
});

test("release test batch catalog matches command and package manifests", async () => {
  assert.ok(
    semanticGateChecks
      .filter(({ command }) => command.command === "bun")
      .every(
        ({ command }) => command.args.length === 2 && command.args[0] === "test"
      )
  );
  assert.equal(
    semanticGateChecks.filter(({ command }) => command.command === "node")
      .length,
    1
  );
  assert.deepEqual(
    semanticGateChecks.find(({ command }) => command.command === "node")
      ?.command.args,
    ["--test", "./tools/task-graph/tests/native-store.test.ts"]
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8")
  ) as { scripts: Readonly<Record<string, string>> };
  assert.equal(
    manifest.scripts["test:index-runtime-performance"],
    "bun test ./tools/index-runtime/tests/performance.test.ts"
  );
  assert.equal(
    new Set<string>(releaseRequiredPackageScripts).has(
      "test:index-runtime-performance"
    ),
    false
  );
  for (const [script, files] of Object.entries(releaseBunTestPackageFiles)) {
    assert.equal(manifest.scripts[script], `bun test ${files.join(" ")}`);
  }
  assert.deepEqual(
    releaseTestBatchGroups.map(({ checkId }) => checkId),
    [
      ...semanticGateChecks
        .filter(
          (check) => check.command.command === "bun" && !("dependsOn" in check)
        )
        .map(({ checkId }) => checkId),
      ...Object.keys(releaseBunTestPackageFiles).map(
        (script) => `script:${script}`
      )
    ]
  );
});
