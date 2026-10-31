import { copyRuntimeScripts } from "../../../shared/tests/distribution-fixture.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as sourceApi from "../../src/cli.ts";
import { assertDistributedSchema } from "./generated-artifacts-distribution-schema.ts";
import {
  resolveInstalledPackageRoot,
  withTempWorkspace
} from "../support/helpers.ts";
import {
  execFileAsync,
  generatedDeclarationDirectory,
  generatedDeclarationPath,
  generatedSchemaPath,
  generatedScriptPath,
  publicRuntimeExports,
  repositoryRoot
} from "./generated-artifacts-support.ts";

test("generated distribution exposes the source runtime API and matching CLI version", async () => {
  const generatedModule: unknown = await import(
    pathToFileURL(generatedScriptPath).href
  );
  assert.ok(typeof generatedModule === "object" && generatedModule !== null);
  const generatedApi = generatedModule;
  assert.deepEqual(Object.keys(sourceApi).sort(), [...publicRuntimeExports]);
  assert.deepEqual(Object.keys(generatedApi).sort(), [...publicRuntimeExports]);
  const runtimeModule: unknown = await import(
    pathToFileURL(
      path.join(
        path.dirname(generatedScriptPath),
        "runtime/tools/task-graph/src/cli.ts"
      )
    ).href
  );
  assert.ok(typeof runtimeModule === "object" && runtimeModule !== null);
  assert.ok(
    "TaskGraphService" in generatedApi && "TaskGraphService" in runtimeModule
  );
  assert.equal(generatedApi.TaskGraphService, runtimeModule.TaskGraphService);
  assert.ok(
    "runTaskGraphCli" in generatedApi && "runTaskGraphCli" in runtimeModule
  );
  assert.equal(generatedApi.runTaskGraphCli, runtimeModule.runTaskGraphCli);
  assert.ok(typeof generatedApi.runTaskGraphCli === "function");

  const sourceOutput: string[] = [];
  const generatedOutput: string[] = [];
  const sourceExit = await sourceApi.runTaskGraphCli(["--version"], {
    io: { stdout: (text) => sourceOutput.push(text) }
  });
  const generatedExit: unknown = await generatedApi.runTaskGraphCli(
    ["--version"],
    {
      io: {
        stdout: (text: unknown) => {
          assert.ok(typeof text === "string");
          generatedOutput.push(text);
        }
      }
    }
  );
  assert.ok(
    typeof generatedExit === "number" && Number.isInteger(generatedExit)
  );
  assert.equal(generatedExit, sourceExit);
  assert.deepEqual(generatedOutput, sourceOutput);
});

test("generated SDK declarations support public type consumers without leaking private APIs", async () => {
  const declaration = await fs.readFile(generatedDeclarationPath, "utf8");
  const declarationFiles = (
    await fs.readdir(generatedDeclarationDirectory, { recursive: true })
  )
    .filter((filename) => filename.endsWith(".d.mts"))
    .sort();
  const declarations = await Promise.all(
    declarationFiles.map(async (name) => {
      const filename = path.join(generatedDeclarationDirectory, name);
      return { filename, source: await fs.readFile(filename, "utf8") };
    })
  );
  const declarationTree = [
    declaration,
    ...declarations.map(({ source }) => source)
  ].join("\n");
  assert.match(declarationTree, /export type TaskListItem\b/u);
  assert.doesNotMatch(declarationTree, /\bTaskSummary\b/u);
  for (const { filename, source: generatedDeclaration } of [
    { filename: generatedDeclarationPath, source: declaration },
    ...declarations
  ]) {
    assert.match(
      generatedDeclaration,
      /Generated task graph SDK TypeScript declaration/u
    );
    assert.doesNotMatch(generatedDeclaration, /["']\.\.?\/[^"']+\.ts["']/u);
    for (const match of generatedDeclaration.matchAll(
      /\bfrom\s+["']([^"']+)["']/gu
    )) {
      const reference = match[1] ?? "";
      assert.match(reference, /^\.\.?\//u);
      const target = path.resolve(
        path.dirname(filename),
        reference.replace(/\.mjs$/u, ".d.mts")
      );
      const relative = path.relative(generatedDeclarationDirectory, target);
      assert.ok(
        relative.length > 0 &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative)
      );
      await fs.access(target);
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
});

test("generated runtime metadata identifies source and rebuild without local paths or debug artifacts", async () => {
  const script = await fs.readFile(generatedScriptPath, "utf8");
  assert.match(
    script,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/task-graph\/src\/cli\.ts/u
  );
  assert.match(script, /Rebuild: bun run sync:task-graph-cli/u);
  assert.match(script, /runtime\/tools\/task-graph\/src\/cli\.ts/u);
  assert.doesNotMatch(script, /debugId=/u);

  const copiedRenderer = await fs.readFile(
    path.join(
      path.dirname(generatedScriptPath),
      "runtime/tools/task-graph/src/rendering/task-list-renderer.ts"
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
});

test("distributed schema matches source bytes and validates consumer boundary values", async () => {
  await assertDistributedSchema(generatedSchemaPath);
});
