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
import { expectedSemanticChecks } from "./vibe-check-catalog-fixture.ts";
import { repositoryRoot } from "./vibe-check-test-support.ts";

async function readRepositoryFile(relativePath: string): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, relativePath.slice(2)),
    "utf8"
  );
}

function importedTestFiles(
  source: string,
  importerPath: string
): readonly string[] {
  return [...source.matchAll(/await import\("(\.[^"\n]+)"\);/gu)].map(
    ([, relativePath]) =>
      `./${path.posix.normalize(
        path.posix.join(path.posix.dirname(importerPath.slice(2)), relativePath)
      )}`
  );
}

test("semantic Gate catalog matches its aggregate native entry points", async () => {
  assert.deepEqual(
    semanticGateChecks.map(({ checkId, command }) => [
      checkId,
      command.command,
      command.args.at(-1)
    ]),
    expectedSemanticChecks
  );
  assert.ok(
    semanticGateChecks.every(({ requiredTag }) => requiredTag === undefined)
  );

  const semanticLeafFiles: string[] = [];
  const aggregateFilesByTool = new Map<string, string[]>();
  for (const [checkId, command, commandPath] of expectedSemanticChecks) {
    const leafFiles = commandPath.includes("/checks/")
      ? importedTestFiles(await readRepositoryFile(commandPath), commandPath)
      : [commandPath];
    assert.ok(
      leafFiles.length > 0,
      `${checkId} wrapper imports no leaf test files: ${commandPath}`
    );
    for (const leafFile of leafFiles) {
      assert.equal(
        leafFile.includes("/checks/"),
        false,
        `${checkId} must import leaf test files only: ${leafFile}`
      );
    }
    semanticLeafFiles.push(...leafFiles);
    if (command === "bun") {
      const tool = /^\.\/tools\/([^/]+)\/tests\//u.exec(commandPath)?.[1];
      if (tool !== undefined) {
        const aggregateFiles = aggregateFilesByTool.get(tool) ?? [];
        aggregateFiles.push(...leafFiles);
        aggregateFilesByTool.set(tool, aggregateFiles);
      }
    }
  }

  const duplicateLeafFiles = semanticLeafFiles.filter(
    (leafFile, index) => semanticLeafFiles.indexOf(leafFile) !== index
  );
  assert.deepEqual(duplicateLeafFiles, []);
  const missingLeafFiles: string[] = [];
  for (const leafFile of semanticLeafFiles) {
    try {
      await fs.access(path.join(repositoryRoot, leafFile.slice(2)));
    } catch {
      missingLeafFiles.push(leafFile);
    }
  }
  assert.deepEqual(missingLeafFiles, []);

  for (const [tool, expectedAggregateFiles] of aggregateFilesByTool) {
    const aggregatePath = `./tools/${tool}/tests/run.ts`;
    const aggregateFiles = importedTestFiles(
      await readRepositoryFile(aggregatePath),
      aggregatePath
    );
    assert.deepEqual(
      [...aggregateFiles].sort(),
      [...expectedAggregateFiles].sort(),
      aggregatePath
    );
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
  assert.equal(
    manifest.scripts["test:version-control"],
    "bun test ./tools/shared/tests/version-control.test.ts"
  );
  assert.equal(
    releaseRequiredPackageScripts.includes("test:version-control"),
    true
  );
  assert.equal(
    Object.hasOwn(releaseBunTestPackageFiles, "test:version-control"),
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
