import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as v from "valibot";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  releaseRequiredPackageScripts,
  semanticGateChecks
} from "./lib/vibe-gate.ts";
import { expectedSemanticChecks } from "./vibe-check-catalog-fixture.ts";
import { repositoryRoot } from "./vibe-check-test-support.ts";

const importRule = `id: catalog-import-source
language: TypeScript
rule:
  kind: string
  any:
    - inside:
        kind: import_statement
    - inside:
        kind: arguments
        inside:
          pattern: import($$$)
`;
const importMatchSchema = v.array(
  v.object({ file: v.string(), text: v.string() })
);

function collectCatalogImports(
  files: readonly string[],
  source?: string
): ReadonlyMap<string, readonly string[]> {
  const output = execFileSync(
    path.join(
      repositoryRoot,
      "node_modules/@ast-grep/cli",
      process.platform === "win32" ? "ast-grep.exe" : "ast-grep"
    ),
    [
      "scan",
      "--inline-rules",
      importRule,
      "--json=compact",
      ...(source === undefined ? files : ["--stdin"])
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      input: source,
      timeout: 10_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    }
  );
  const matches = v.parse(importMatchSchema, JSON.parse(output) as unknown);
  const imports = new Map<string, string[]>();
  for (const match of matches) {
    assert.match(match.text, /^["'][^"'\\\r\n]+["']$/u);
    const file = path.posix.normalize(match.file.replaceAll("\\", "/"));
    const entries = imports.get(file) ?? [];
    entries.push(match.text.slice(1, -1));
    imports.set(file, entries);
  }
  return imports;
}

function importedTestFiles(
  imports: ReadonlyMap<string, readonly string[]>,
  importerPath: string
): readonly string[] {
  return (imports.get(path.posix.normalize(importerPath)) ?? []).map(
    (relativePath) => {
      assert.ok(relativePath.startsWith("."), importerPath);
      return `./${path.posix.normalize(path.posix.join(path.posix.dirname(importerPath.slice(2)), relativePath))}`;
    }
  );
}

test("semantic catalog import collection ignores comments and inert strings", () => {
  const imports = collectCatalogImports(
    [],
    [
      'import "./static.test.ts";',
      "await import('./dynamic.test.ts');",
      '// await import("./comment.test.ts");',
      '/* import "./block-comment.test.ts"; */',
      "const text = 'await import(\"./string.test.ts\");';"
    ].join("\n")
  );
  assert.deepEqual(imports.get("STDIN"), [
    "./static.test.ts",
    "./dynamic.test.ts"
  ]);
});

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

  const wrapperFiles = expectedSemanticChecks
    .map(([, , commandPath]) => commandPath)
    .filter((file) => file.includes("/checks/"));
  const aggregatePaths = [
    ...new Set(
      expectedSemanticChecks
        .filter(([, command]) => command === "bun")
        .flatMap(([, , commandPath]) => {
          const tool = /^\.\/tools\/([^/]+)\/tests\//u.exec(commandPath)?.[1];
          return tool === undefined ? [] : [`./tools/${tool}/tests/run.ts`];
        })
    )
  ];
  const imports = collectCatalogImports([...wrapperFiles, ...aggregatePaths]);
  const semanticLeafFiles: string[] = [];
  const aggregateFilesByTool = new Map<string, string[]>();
  for (const [checkId, command, commandPath] of expectedSemanticChecks) {
    const leafFiles = commandPath.includes("/checks/")
      ? importedTestFiles(imports, commandPath)
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
  for (const leafFile of semanticLeafFiles) {
    await fs.access(path.join(repositoryRoot, leafFile.slice(2)));
  }

  for (const [tool, expectedAggregateFiles] of aggregateFilesByTool) {
    const aggregatePath = `./tools/${tool}/tests/run.ts`;
    const aggregateFiles = importedTestFiles(imports, aggregatePath);
    assert.deepEqual(
      [...aggregateFiles]
        .filter(
          (file) =>
            tool !== "mcpshell-workspace-bridge" ||
            !file.endsWith("-integration.test.ts")
        )
        .sort(),
      [...expectedAggregateFiles].sort(),
      aggregatePath
    );
  }
});

test("semantic commands retain native store, version-control and retired performance entry policies", async () => {
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
  const manifest = v.parse(
    v.object({ scripts: v.record(v.string(), v.string()) }),
    JSON.parse(
      await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8")
    ) as unknown
  );
  assert.equal(manifest.scripts["test:index-runtime-performance"], undefined);
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
});
