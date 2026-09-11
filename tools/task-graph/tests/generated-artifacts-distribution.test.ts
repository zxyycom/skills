import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as sourceApi from "../src/cli.ts";
import { assertDistributedSchema } from "./generated-artifacts-distribution-schema.ts";
import { resolveInstalledPackageRoot, withTempWorkspace } from "./helpers.ts";
import {
  execFileAsync,
  generatedDeclarationDirectory,
  generatedDeclarationPath,
  generatedSchemaPath,
  generatedScriptPath,
  publicRuntimeExports,
  repositoryRoot
} from "./generated-artifacts-support.ts";

test("generated distribution matches current source API, schema bytes, and metadata", async () => {
  const generatedApi = await import(pathToFileURL(generatedScriptPath).href);
  assert.deepEqual(Object.keys(sourceApi).sort(), [...publicRuntimeExports]);
  assert.deepEqual(Object.keys(generatedApi).sort(), [...publicRuntimeExports]);

  const sourceOutput: string[] = [];
  const generatedOutput: string[] = [];
  const sourceExit = await sourceApi.runTaskGraphCli(["--version"], {
    io: { stdout: (text) => sourceOutput.push(text) }
  });
  const generatedRunner =
    generatedApi.runTaskGraphCli as typeof sourceApi.runTaskGraphCli;
  const generatedExit = await generatedRunner(["--version"], {
    io: { stdout: (text) => generatedOutput.push(text) }
  });
  assert.equal(generatedExit, sourceExit);
  assert.deepEqual(generatedOutput, sourceOutput);

  const script = await fs.readFile(generatedScriptPath, "utf8");
  assert.match(
    script,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/task-graph\/src\/cli\.ts/u
  );
  assert.match(script, /Rebuild: bun run sync:task-graph-cli/u);
  assert.match(script, /sourceMappingURL=task-graph\.mjs\.map/u);
  assert.doesNotMatch(script, /debugId=/u);

  const declaration = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(declaration, /export \* from "\.\/task-graph-sdk\/cli\.mjs";/u);
  const declarationFiles = (await fs.readdir(generatedDeclarationDirectory))
    .filter((filename) => filename.endsWith(".d.mts"))
    .sort();
  assert.deepEqual(declarationFiles, [
    "cli-contract.d.mts",
    "cli.d.mts",
    "engine-apply.d.mts",
    "engine-claim.d.mts",
    "engine-content.d.mts",
    "engine-lifecycle.d.mts",
    "engine-removal.d.mts",
    "engine.d.mts",
    "errors.d.mts",
    "graph-projection.d.mts",
    "graph-topology.d.mts",
    "graph-validation.d.mts",
    "graph.d.mts",
    "index.d.mts",
    "service.d.mts",
    "types.d.mts"
  ]);
  const declarations = await Promise.all(
    declarationFiles.map(
      async (filename) =>
        await fs.readFile(
          path.join(generatedDeclarationDirectory, filename),
          "utf8"
        )
    )
  );
  const declarationTree = [declaration, ...declarations].join("\n");
  assert.match(declarationTree, /export type TaskListItem\b/u);
  assert.doesNotMatch(declarationTree, /\bTaskSummary\b/u);
  for (const generatedDeclaration of [declaration, ...declarations]) {
    assert.match(
      generatedDeclaration,
      /Generated task graph SDK TypeScript declaration/u
    );
    assert.doesNotMatch(generatedDeclaration, /["']\.\.?\/[^"']+\.ts["']/u);
    for (const match of generatedDeclaration.matchAll(
      /\bfrom\s+["']([^"']+)["']/gu
    )) {
      assert.match(match[1] ?? "", /^\.\//u);
    }
  }
  for (const exportedName of publicRuntimeExports) {
    assert.match(declarationTree, new RegExp(`\\b${exportedName}\\b`, "u"));
  }
  for (const publicType of [
    "TaskMutationPrecondition",
    "CompleteTaskOptions",
    "CancelTaskOptions",
    "ClaimTaskOptions",
    "RemoveTasksOptions",
    "TaskGraphApplyRequest",
    "TaskGraphRuntimeInfo",
    "TaskGraphRuntimeInstallCommand",
    "TaskGraphProjection",
    "TaskContentInput",
    "TaskIndexInfo",
    "TaskIndexStageResult",
    "TaskGraphServiceOptions",
    "TaskGraphCliOptions"
  ]) {
    assert.match(
      declarationTree,
      new RegExp(`export type ${publicType}\\b`, "u")
    );
  }
  for (const internalName of [
    "TaskGraphStore",
    "TaskGraphStoreHooks",
    "TaskGraphStoreOptions",
    "createTaskGraphStore",
    "IdGenerator",
    "hooks",
    "idGenerator",
    "processState",
    "NativeLockBinding",
    "RuntimeInstallInternalOptions",
    "RuntimeCommandRequest",
    "RuntimeCommandResult",
    "runRuntimeCommand",
    "AtomicWrite",
    "commandRunner",
    "probeCommandRunner",
    "TaskGraphCliInternalOptions",
    "TaskGraphServiceInternalOptions"
  ]) {
    assert.doesNotMatch(
      declarationTree,
      new RegExp(`\\b${internalName}\\b`, "u")
    );
  }
  assert.doesNotMatch(declarationTree, /\bNodeJS\b/u);
  assert.doesNotMatch(
    declarationTree,
    /LOCK_RECOVERY_REQUIRED|LOCK_LOST|valibot/u
  );

  await withTempWorkspace(async (root) => {
    await fs.copyFile(generatedScriptPath, path.join(root, "task-graph.mjs"));
    await fs.copyFile(
      generatedDeclarationPath,
      path.join(root, "task-graph.d.mts")
    );
    await fs.cp(
      generatedDeclarationDirectory,
      path.join(root, "task-graph-sdk"),
      { recursive: true }
    );
    const consumerPath = path.join(root, "consumer.mts");
    await fs.writeFile(
      consumerPath,
      [
        'import { TaskGraphService, runTaskGraphCli } from "./task-graph.mjs";',
        'import type { TaskContentInput, TaskGraphCliOptions, TaskIndexStageResult, TaskListItem } from "./task-graph.mjs";',
        "// @ts-expect-error removed summary alias is not part of the SDK entry",
        'import type { TaskSummary } from "./task-graph.mjs";',
        "// @ts-expect-error internal store is not part of the SDK entry",
        'import type { TaskGraphStore } from "./task-graph.mjs";',
        "// @ts-expect-error redundant service factory is not part of the SDK entry",
        'import { createTaskGraphService } from "./task-graph.mjs";',
        'const content: TaskContentInput = { title: "candidate", goal: "do work" };',
        "const options: TaskGraphCliOptions = {};",
        "const listItem: TaskListItem | null = null;",
        "const service = new TaskGraphService();",
        'void service.stageTaskIndex(["task-000001"]);',
        "function stageChanged(result: TaskIndexStageResult): boolean {",
        '  if (result.state === "staged") {',
        "    const changed: true = result.changed;",
        "    return changed;",
        "  }",
        "  const changed: false = result.changed;",
        "  return changed;",
        "}",
        "void runTaskGraphCli([], options);",
        "void stageChanged;",
        "void content;",
        "void listItem;",
        ""
      ].join("\n"),
      "utf8"
    );
    const compilerRoot = await resolveInstalledPackageRoot(
      "@typescript/native-preview",
      path.join(repositoryRoot, "package.json")
    );
    await execFileAsync(
      process.execPath,
      [
        path.join(compilerRoot, "bin", "tsgo"),
        "--ignoreConfig",
        "--noEmit",
        "--target",
        "ES2024",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--skipLibCheck",
        "false",
        consumerPath
      ],
      { cwd: root, windowsHide: true }
    );
  });

  const externalSourceMap: unknown = JSON.parse(
    await fs.readFile(`${generatedScriptPath}.map`, "utf8")
  );
  if (
    typeof externalSourceMap !== "object" ||
    externalSourceMap === null ||
    Array.isArray(externalSourceMap) ||
    !("sourceRoot" in externalSourceMap) ||
    typeof externalSourceMap.sourceRoot !== "string" ||
    !("sources" in externalSourceMap) ||
    !Array.isArray(externalSourceMap.sources) ||
    !("sourcesContent" in externalSourceMap) ||
    !Array.isArray(externalSourceMap.sourcesContent)
  ) {
    assert.fail(
      "generated source map must contain sourceRoot, sources, and sourcesContent"
    );
  }
  const sources: string[] = [];
  for (const source of externalSourceMap.sources) {
    if (typeof source !== "string") {
      assert.fail("generated source map sources must contain only strings");
    }
    sources.push(source);
  }
  const sourcesContent: Array<string | null> = [];
  for (const sourceContent of externalSourceMap.sourcesContent) {
    if (sourceContent !== null && typeof sourceContent !== "string") {
      assert.fail(
        "generated source map sourcesContent must contain strings or null"
      );
    }
    sourcesContent.push(sourceContent);
  }
  const sourceMap = {
    sourceRoot: externalSourceMap.sourceRoot,
    sources,
    sourcesContent
  };
  assert.equal(Object.hasOwn(externalSourceMap, "debugId"), false);
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/task-graph/src/cli.ts"));
  assert.ok(
    sourceMap.sources.includes("tools/task-graph/src/task-list-renderer.ts")
  );
  assert.ok(
    sourceMap.sources.some((source) => source.includes("write-file-atomic"))
  );
  assert.ok(
    sourceMap.sources.every(
      (source) => !source.includes("fs-native-extensions")
    )
  );
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
  const writeFileAtomicSourceIndex = sourceMap.sources.findIndex((source) =>
    source.endsWith("write-file-atomic/lib/index.js")
  );
  assert.notEqual(writeFileAtomicSourceIndex, -1);
  const writeFileAtomicSource =
    sourceMap.sourcesContent[writeFileAtomicSourceIndex];
  assert.equal(typeof writeFileAtomicSource, "string");
  assert.match(
    writeFileAtomicSource ?? "",
    /node_modules\/write-file-atomic\/lib\/index\.js/u
  );
  assert.doesNotMatch(writeFileAtomicSource ?? "", /\b__filename\b/u);
  assert.equal(script.includes(repositoryRoot), false);
  assert.equal(script.includes(repositoryRoot.replaceAll("\\", "\\\\")), false);

  await assertDistributedSchema(generatedSchemaPath);
});
