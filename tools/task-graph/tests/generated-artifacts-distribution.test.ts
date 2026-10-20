import { copyRuntimeScripts } from "../../shared/tests/distribution-fixture.ts";
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
  const runtime = await import(
    pathToFileURL(
      path.join(
        path.dirname(generatedScriptPath),
        "runtime/tools/task-graph/src/cli.ts"
      )
    ).href
  );
  assert.equal(generatedApi.TaskGraphService, runtime.TaskGraphService);
  assert.equal(generatedApi.runTaskGraphCli, runtime.runTaskGraphCli);

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
  assert.match(script, /runtime\/tools\/task-graph\/src\/cli\.ts/u);
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
    await copyRuntimeScripts(generatedScriptPath, root);
    const consumerPath = path.join(root, "consumer.mts");
    await fs.writeFile(
      consumerPath,
      [
        'import { TaskGraphService, runTaskGraphCli } from "./task-graph.ts";',
        'import type { TaskContentInput, TaskGraphCliOptions, TaskIndexStageResult, TaskListItem } from "./task-graph.ts";',
        "// @ts-expect-error removed summary alias is not part of the SDK entry",
        'import type { TaskSummary } from "./task-graph.ts";',
        "// @ts-expect-error internal store is not part of the SDK entry",
        'import type { TaskGraphStore } from "./task-graph.ts";',
        "// @ts-expect-error redundant service factory is not part of the SDK entry",
        'import { createTaskGraphService } from "./task-graph.ts";',
        'const content: TaskContentInput = { title: "candidate", goal: "do work" };',
        "const options: TaskGraphCliOptions = {};",
        "const listItem: TaskListItem | null = null;",
        "const service = new TaskGraphService();",
        "const typedService: TaskGraphService = service; void typedService;",
        "// @ts-expect-error internal store must remain hidden for direct TS consumers",
        "void service.store;",
        "// @ts-expect-error internal constructor options must remain hidden",
        "new TaskGraphService({ loadNativeLock: async () => null });",
        "// @ts-expect-error internal CLI runtime injection must remain hidden",
        "runTaskGraphCli([], { commandRunner: async () => null });",
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
        "--types",
        "node",
        "--allowImportingTsExtensions",
        "--skipLibCheck",
        "false",
        consumerPath
      ],
      { cwd: root, windowsHide: true }
    );
  });

  const copiedRenderer = await fs.readFile(
    path.join(
      path.dirname(generatedScriptPath),
      "runtime/tools/task-graph/src/task-list-renderer.ts"
    ),
    "utf8"
  );
  assert.match(copiedRenderer, /Synced TypeScript runtime/u);
  await assert.rejects(
    fs.stat(generatedScriptPath.replace(/\.ts$/u, ".mjs.map")),
    { code: "ENOENT" }
  );
  assert.equal(script.includes(repositoryRoot), false);
  assert.equal(script.includes(repositoryRoot.replaceAll("\\", "\\\\")), false);

  await assertDistributedSchema(generatedSchemaPath);
});
