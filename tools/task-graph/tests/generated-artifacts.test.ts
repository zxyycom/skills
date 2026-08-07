import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as sourceApi from "../src/cli.ts";
import {
  graphIndex,
  prepareRootNativeRuntime,
  resolveNodeExecutable,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";
import {
  taskGraphJsonSchemaOverrideAction,
  taskIndexSchema
} from "../src/schema.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const generatedScriptPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.mjs"
);
const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.d.mts"
);
const generatedDeclarationDirectory = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph-sdk"
);
const generatedSchemaPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "references",
  "task-graph-index.schema.json"
);
const execFileAsync = promisify(execFile);

async function resolveInstalledPackageRoot(
  packageName: string,
  fromManifestPath: string
): Promise<string> {
  const packageRequire = createRequire(fromManifestPath);
  let current: string;
  try {
    current = path.dirname(packageRequire.resolve(`${packageName}/package.json`));
  } catch {
    current = path.dirname(packageRequire.resolve(packageName));
  }
  while (true) {
    const manifestPath = path.join(current, "package.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
        name?: unknown;
      };
      if (manifest.name === packageName) return current;
    } catch {
      // Continue toward the resolved package root.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to locate installed package root for ${packageName}`);
    }
    current = parent;
  }
}

async function copyInstalledPackageClosure(
  packageNames: readonly string[],
  fromManifestPath: string,
  targetNodeModules: string
): Promise<void> {
  const installed = new Map<string, string>();
  const pending = packageNames.map((packageName) => ({ packageName, fromManifestPath }));
  while (pending.length > 0) {
    const next = pending.shift();
    if (next === undefined) break;
    const sourcePackageRoot = await resolveInstalledPackageRoot(
      next.packageName,
      next.fromManifestPath
    );
    const existingSource = installed.get(next.packageName);
    if (existingSource !== undefined) {
      if (existingSource !== sourcePackageRoot) {
        throw new Error(`Build fixture requires conflicting versions of ${next.packageName}`);
      }
      continue;
    }
    installed.set(next.packageName, sourcePackageRoot);
    const targetPackageRoot = path.join(targetNodeModules, ...next.packageName.split("/"));
    await fs.mkdir(path.dirname(targetPackageRoot), { recursive: true });
    await fs.cp(sourcePackageRoot, targetPackageRoot, { recursive: true });
    const sourceManifestPath = path.join(sourcePackageRoot, "package.json");
    const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
      pending.push({ packageName: dependency, fromManifestPath: sourceManifestPath });
    }
  }
}

async function copyTaskGraphBuildCheckout(targetRoot: string): Promise<void> {
  for (const relativePath of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/build/task-graph.ts",
    "scripts/lib",
    "tools/shared/src",
    "tools/task-graph/src"
  ]) {
    const source = path.join(repositoryRoot, relativePath);
    const target = path.join(targetRoot, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true });
  }
  const rootManifestPath = path.join(repositoryRoot, "package.json");
  await copyInstalledPackageClosure(
    [
      "@types/node",
      "@types/write-file-atomic",
      "@typescript/native-preview",
      "@valibot/to-json-schema",
      "fast-glob",
      "valibot",
      "write-file-atomic"
    ],
    rootManifestPath,
    path.join(targetRoot, "node_modules")
  );
  const compilerRoot = await resolveInstalledPackageRoot(
    "@typescript/native-preview",
    rootManifestPath
  );
  await copyInstalledPackageClosure(
    [`@typescript/native-preview-${process.platform}-${process.arch}`],
    path.join(compilerRoot, "package.json"),
    path.join(targetRoot, "node_modules")
  );
}

const publicRuntimeExports = [
  "TaskGraphError",
  "TaskGraphService",
  "applyTaskGraphOperations",
  "cancelTask",
  "claimTask",
  "completeTask",
  "defaultTaskGraphIndexPath",
  "emptyTaskIndex",
  "failTask",
  "parseTaskGraphApplyRequest",
  "parseTaskIndex",
  "projectTaskGraph",
  "releaseTask",
  "removeTasks",
  "renewTaskLease",
  "retryTask",
  "runTaskGraphCli",
  "serializeTaskIndex",
  "taskControlModes",
  "taskEffectiveStates",
  "taskExecutionPhases",
  "taskGraphRuntimeProtocolVersion",
  "taskGraphSchemaVersion",
  "taskGraphSupportedNodeRange",
  "taskGraphVersion",
  "validateTaskIndexGraph"
] as const;

test("generated distribution matches source API, schema bytes, and portable metadata", async () => {
  const generatedApi = await import(pathToFileURL(generatedScriptPath).href);
  assert.deepEqual(Object.keys(sourceApi).sort(), [...publicRuntimeExports]);
  assert.deepEqual(Object.keys(generatedApi).sort(), [...publicRuntimeExports]);

  const sourceOutput: string[] = [];
  const generatedOutput: string[] = [];
  const sourceExit = await sourceApi.runTaskGraphCli(["--version"], {
    io: { stdout: (text) => sourceOutput.push(text) }
  });
  const generatedRunner = generatedApi.runTaskGraphCli as typeof sourceApi.runTaskGraphCli;
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
    "cli.d.mts",
    "engine.d.mts",
    "errors.d.mts",
    "graph.d.mts",
    "index.d.mts",
    "service.d.mts",
    "types.d.mts"
  ]);
  const declarations = await Promise.all(declarationFiles.map(async (filename) => (
    await fs.readFile(path.join(generatedDeclarationDirectory, filename), "utf8")
  )));
  const declarationTree = [declaration, ...declarations].join("\n");
  for (const generatedDeclaration of [declaration, ...declarations]) {
    assert.match(generatedDeclaration, /Generated task graph SDK TypeScript declaration/u);
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
    "TaskGraphServiceOptions",
    "TaskGraphCliOptions"
  ]) {
    assert.match(declarationTree, new RegExp(`export type ${publicType}\\b`, "u"));
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
    assert.doesNotMatch(declarationTree, new RegExp(`\\b${internalName}\\b`, "u"));
  }
  assert.doesNotMatch(declarationTree, /\bNodeJS\b/u);
  assert.doesNotMatch(declarationTree, /LOCK_RECOVERY_REQUIRED|LOCK_LOST|valibot/u);

  await withTempWorkspace(async (root) => {
    await fs.copyFile(generatedScriptPath, path.join(root, "task-graph.mjs"));
    await fs.copyFile(generatedDeclarationPath, path.join(root, "task-graph.d.mts"));
    await fs.cp(
      generatedDeclarationDirectory,
      path.join(root, "task-graph-sdk"),
      { recursive: true }
    );
    const consumerPath = path.join(root, "consumer.mts");
    await fs.writeFile(consumerPath, [
      "import { TaskGraphService, runTaskGraphCli } from \"./task-graph.mjs\";",
      "import type { TaskContentInput, TaskGraphCliOptions } from \"./task-graph.mjs\";",
      "// @ts-expect-error internal store is not part of the SDK entry",
      "import type { TaskGraphStore } from \"./task-graph.mjs\";",
      "// @ts-expect-error redundant service factory is not part of the SDK entry",
      "import { createTaskGraphService } from \"./task-graph.mjs\";",
      "const content: TaskContentInput = { title: \"candidate\", goal: \"do work\" };",
      "const options: TaskGraphCliOptions = {};",
      "new TaskGraphService();",
      "void runTaskGraphCli([], options);",
      "void content;",
      ""
    ].join("\n"), "utf8");
    const compilerRoot = await resolveInstalledPackageRoot(
      "@typescript/native-preview",
      path.join(repositoryRoot, "package.json")
    );
    await execFileAsync(process.execPath, [
      path.join(compilerRoot, "bin", "tsgo"),
      "--ignoreConfig",
      "--noEmit",
      "--target", "ES2024",
      "--module", "NodeNext",
      "--moduleResolution", "NodeNext",
      "--strict",
      "--skipLibCheck", "false",
      consumerPath
    ], { cwd: root, windowsHide: true });
  });

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedScriptPath}.map`, "utf8")
  ) as {
    debugId?: unknown;
    sourceRoot: string;
    sources: string[];
    sourcesContent: Array<string | null>;
  };
  assert.equal(Object.hasOwn(sourceMap, "debugId"), false);
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/task-graph/src/cli.ts"));
  assert.ok(sourceMap.sources.some((source) => source.includes("write-file-atomic")));
  assert.ok(sourceMap.sources.every((source) => !source.includes("fs-native-extensions")));
  assert.ok(sourceMap.sources.every((source) =>
    !path.isAbsolute(source) && !source.includes("\\")
  ));
  const writeFileAtomicSourceIndex = sourceMap.sources.findIndex(
    (source) => source.endsWith("write-file-atomic/lib/index.js")
  );
  assert.notEqual(writeFileAtomicSourceIndex, -1);
  const writeFileAtomicSource = sourceMap.sourcesContent[writeFileAtomicSourceIndex];
  assert.equal(typeof writeFileAtomicSource, "string");
  assert.match(
    writeFileAtomicSource ?? "",
    /node_modules\/write-file-atomic\/lib\/index\.js/u
  );
  assert.doesNotMatch(writeFileAtomicSource ?? "", /\b__filename\b/u);
  assert.equal(script.includes(repositoryRoot), false);
  assert.equal(script.includes(repositoryRoot.replaceAll("\\", "\\\\")), false);

  const convertedSchema = toJsonSchema(taskIndexSchema, {
    errorMode: "ignore",
    overrideAction: taskGraphJsonSchemaOverrideAction,
    target: "draft-2020-12",
    typeMode: "input"
  });
  const expectedSchema = {
    ...convertedSchema,
    $id: "https://raw.githubusercontent.com/zxyycom/skills/main/skills/task-graph/references/task-graph-index.schema.json",
    $comment:
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, "
      + "revision, lease, and canonical-form invariants are validated by the "
      + "task-graph CLI info command.",
    title: "TaskGraphIndex"
  };
  assert.equal(
    await fs.readFile(generatedSchemaPath, "utf8"),
    `${JSON.stringify(expectedSchema, null, 2)}\n`
  );

  const consumerSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as object;
  const validateConsumer = new Ajv2020({ allErrors: true, strict: false }).compile(
    consumerSchema
  );
  const validIndex = graphIndex([taskOperation("consumer")]);
  validIndex.tasks["task-000001"]!.content.references =
    Object.fromEntries([["source", "supported"]]);
  validIndex.tasks["task-000001"]!.content.acceptance = [];
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(validateConsumer(validIndex), true, JSON.stringify(validateConsumer.errors));

  const title = validIndex.tasks["task-000001"]!.content;
  title.title = "😀".repeat(120);
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(validateConsumer(validIndex), true, JSON.stringify(validateConsumer.errors));

  for (const invalidTitle of [
    "",
    "x".repeat(121),
    "😀".repeat(121),
    "line one\nline two",
    " leading",
    "trailing "
  ]) {
    const invalid = structuredClone(validIndex);
    invalid.tasks["task-000001"]!.content.title = invalidTitle;
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTitle);
  }

  for (const invalidTextField of ["title", "reference"] as const) {
    const invalid = structuredClone(validIndex);
    if (invalidTextField === "title") {
      (invalid.tasks["task-000001"]!.content as {
        title: unknown;
      }).title = 42;
    } else {
      (invalid.tasks["task-000001"]!.content.references as Record<string, unknown>).source = 42;
    }
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTextField);
  }

  for (const [sourceId, zeroId] of [
    ["task-000001", "task-000000"]
  ] as const) {
    const invalid = structuredClone(validIndex);
    invalid.tasks[zeroId] = invalid.tasks[sourceId]!;
    delete invalid.tasks[sourceId];
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, zeroId);
  }

  const longDictionaryKey = structuredClone(validIndex);
  longDictionaryKey.tasks["task-000001"]!.content.references = Object.fromEntries([
    ["a".repeat(81), "too long"]
  ]);
  assert.throws(() => sourceApi.parseTaskIndex(longDictionaryKey));
  assert.equal(validateConsumer(longDictionaryKey), false);

  for (const reservedKey of ["constructor", "prototype", "__proto__"]) {
    const prototypeKey = structuredClone(validIndex);
    prototypeKey.tasks["task-000001"]!.content.references = Object.fromEntries([
      [reservedKey, "blocked"]
    ]);
    assert.throws(() => sourceApi.parseTaskIndex(prototypeKey));
    assert.equal(validateConsumer(prototypeKey), false, reservedKey);
  }
});

test("generated task graph bundle and source map are checkout-path independent", {
  timeout: 180_000
}, async () => {
  await withTempWorkspace(async (root) => {
    const shortCheckout = path.join(root, "short");
    const longCheckout = path.join(
      root,
      "checkout-with-a-materially-different-absolute-path-length"
    );
    await Promise.all([
      copyTaskGraphBuildCheckout(shortCheckout),
      copyTaskGraphBuildCheckout(longCheckout)
    ]);
    for (const checkout of [shortCheckout, longCheckout]) {
      await execFileAsync(
        process.execPath,
        ["scripts/build/task-graph.ts", "--write"],
        { cwd: checkout, timeout: 120_000, windowsHide: true }
      );
    }
    const relativeOutput = path.join("skills", "task-graph", "scripts", "task-graph.mjs");
    const shortBundle = await fs.readFile(path.join(shortCheckout, relativeOutput));
    const longBundle = await fs.readFile(path.join(longCheckout, relativeOutput));
    const shortSourceMap = await fs.readFile(path.join(shortCheckout, `${relativeOutput}.map`));
    const longSourceMap = await fs.readFile(path.join(longCheckout, `${relativeOutput}.map`));
    const relativeDeclaration = path.join(
      "skills",
      "task-graph",
      "scripts",
      "task-graph.d.mts"
    );
    const shortDeclaration = await fs.readFile(path.join(shortCheckout, relativeDeclaration));
    const longDeclaration = await fs.readFile(path.join(longCheckout, relativeDeclaration));
    const relativeDeclarationDirectory = path.join(
      "skills",
      "task-graph",
      "scripts",
      "task-graph-sdk"
    );
    const declarationFiles = (await fs.readdir(
      path.join(shortCheckout, relativeDeclarationDirectory)
    )).sort();
    assert.deepEqual(
      declarationFiles,
      (await fs.readdir(path.join(longCheckout, relativeDeclarationDirectory))).sort()
    );
    assert.deepEqual(shortBundle, longBundle);
    assert.deepEqual(shortSourceMap, longSourceMap);
    assert.deepEqual(shortDeclaration, longDeclaration);
    for (const filename of declarationFiles) {
      assert.deepEqual(
        await fs.readFile(path.join(shortCheckout, relativeDeclarationDirectory, filename)),
        await fs.readFile(path.join(longCheckout, relativeDeclarationDirectory, filename))
      );
    }
    assert.equal(shortBundle.includes(Buffer.from("debugId=")), false);
    assert.equal(shortSourceMap.includes(Buffer.from("debugId")), false);
    assert.equal(
      shortBundle.includes(Buffer.from("node_modules/write-file-atomic/lib/index.js")),
      true
    );

    const staleDeclaration = path.join(
      shortCheckout,
      relativeDeclarationDirectory,
      "stale.d.mts"
    );
    await fs.writeFile(staleDeclaration, "export {};\n", "utf8");
    await assert.rejects(execFileAsync(
      process.execPath,
      ["scripts/build/task-graph.ts", "--check"],
      { cwd: shortCheckout, timeout: 120_000, windowsHide: true }
    ));
    await execFileAsync(
      process.execPath,
      ["scripts/build/task-graph.ts", "--write"],
      { cwd: shortCheckout, timeout: 120_000, windowsHide: true }
    );
    await assert.rejects(fs.stat(staleDeclaration), { code: "ENOENT" });
  });
});

test("generated module import is side-effect free in an empty tool home under supported Node", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "empty-tool-home");
    const imported = await execFileAsync(await resolveNodeExecutable(), [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(pathToFileURL(generatedScriptPath).href)})`
    ], {
      cwd: root,
      env: { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome },
      windowsHide: true
    });
    assert.equal(imported.stdout, "");
    assert.equal(imported.stderr, "");
    await assert.rejects(fs.stat(toolHome), { code: "ENOENT" });
  });
});

test("generated Node CLI probes the isolated runtime and mutates offline", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const workspace = path.join(root, "workspace");
    await prepareRootNativeRuntime(toolHome);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const checked = await execFileAsync(await resolveNodeExecutable(), [
      generatedScriptPath,
      "runtime",
      "info",
      "--root",
      workspace
    ], { cwd: root, env: environment, windowsHide: true });
    assert.equal(checked.stderr, "");
    const checkResult = JSON.parse(checked.stdout) as {
      ok: boolean;
      data: { compatible: boolean };
    };
    assert.equal(checkResult.ok, true);
    assert.equal(checkResult.data.compatible, true);
    const initialized = await execFileAsync(await resolveNodeExecutable(), [
      generatedScriptPath,
      "index",
      "init",
      "--root",
      workspace
    ], { cwd: root, env: environment, windowsHide: true });
    assert.equal(initialized.stderr, "");
    assert.equal((JSON.parse(initialized.stdout) as { ok: boolean }).ok, true);
    await assert.rejects(fs.stat(path.join(
      workspace,
      "docs",
      "task-graph",
      "task-graph-index.json.lock"
    )), { code: "ENOENT" });
  });
});

test("distributed task-graph tree contains no native runtime or install artifacts", async () => {
  const skillRoot = path.join(repositoryRoot, "skills", "task-graph");
  const pending = [skillRoot];
  const files: string[] = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (directory === undefined) break;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else files.push(path.relative(skillRoot, target).replaceAll("\\", "/"));
    }
  }
  assert.ok(files.every((name) => !name.startsWith("references/runtime/")));
  assert.ok(files.every((name) => !name.endsWith(".node")));
  assert.ok(files.every((name) => !name.includes("/.install-") && !name.includes("npm-cache")));
});
