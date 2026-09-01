import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as sourceApi from "../src/cli.ts";
import {
  applyOperations,
  graphIndex,
  prepareRootNativeRuntime,
  resolveInstalledPackageRoot,
  resolveNodeExecutable,
  taskContent,
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

type TaskGraphCliRunner = (
  argv: readonly string[],
  options: { io: { stdout: (text: string) => void } }
) => Promise<number>;

function requireGeneratedRunner(module: unknown): TaskGraphCliRunner {
  if (
    typeof module !== "object" ||
    module === null ||
    Array.isArray(module) ||
    !("runTaskGraphCli" in module) ||
    typeof module.runTaskGraphCli !== "function"
  ) {
    assert.fail("generated module must export a runTaskGraphCli function");
  }
  const { runTaskGraphCli } = module;
  return async (argv, options) => {
    const result: unknown = await runTaskGraphCli(argv, options);
    if (typeof result !== "number" || !Number.isInteger(result)) {
      assert.fail(
        "generated runTaskGraphCli must resolve to an integer exit code"
      );
    }
    return result;
  };
}

async function invokeTaskGraphCli(
  root: string,
  runner: TaskGraphCliRunner,
  args: string[]
): Promise<{ exitCode: number; output: string }> {
  const output: string[] = [];
  const exitCode = await runner(["--root", root, ...args], {
    io: { stdout: (text) => output.push(text) }
  });
  const onlyOutput = output.length === 1 ? output[0] : undefined;
  if (onlyOutput === undefined) {
    assert.fail(
      `task-graph CLI must write exactly once, received ${output.length} writes`
    );
  }
  return { exitCode, output: onlyOutput };
}

async function writeDistributedListFixture(root: string): Promise<void> {
  const indexPath = path.join(root, sourceApi.defaultTaskGraphIndexPath);
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(
    indexPath,
    sourceApi.serializeTaskIndex(
      graphIndex([
        taskOperation("distributed-list", {
          control: { mode: "queued" },
          title: "Distributed list task"
        })
      ])
    ),
    "utf8"
  );
}

test("generated CLI task list text and JSON modes match source", async () => {
  const generatedApi: unknown = await import(
    pathToFileURL(generatedScriptPath).href
  );
  const generatedRunner = requireGeneratedRunner(generatedApi);
  await withTempWorkspace(async (root) => {
    await writeDistributedListFixture(root);
    const sourceText = await invokeTaskGraphCli(
      root,
      sourceApi.runTaskGraphCli,
      ["task", "list"]
    );
    const generatedText = await invokeTaskGraphCli(root, generatedRunner, [
      "task",
      "list"
    ]);
    assert.deepEqual(generatedText, sourceText);
    assert.equal(sourceText.exitCode, 0);
    assert.match(sourceText.output, /^TASK LIST tasks=1 tracks=1 /u);
    assert.match(
      sourceText.output,
      /\[task-000001\].*Distributed list task\n$/u
    );

    const sourceJson = await invokeTaskGraphCli(
      root,
      sourceApi.runTaskGraphCli,
      ["--json", "task", "list"]
    );
    const generatedJson = await invokeTaskGraphCli(root, generatedRunner, [
      "--json",
      "task",
      "list"
    ]);
    assert.deepEqual(generatedJson, sourceJson);
    assert.equal(sourceJson.exitCode, 0);
    const result: unknown = JSON.parse(sourceJson.output);
    if (
      typeof result !== "object" ||
      result === null ||
      Array.isArray(result) ||
      !("ok" in result)
    ) {
      assert.fail("task-list JSON result must contain an ok field");
    }
    assert.equal(result.ok, true);
  });
});

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
    "cli.d.mts",
    "engine.d.mts",
    "errors.d.mts",
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
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, " +
      "revision, lease, and canonical-form invariants are validated by the " +
      "task-graph CLI info command.",
    title: "TaskGraphIndex"
  };
  assert.equal(
    await fs.readFile(generatedSchemaPath, "utf8"),
    `${JSON.stringify(expectedSchema, null, 2)}\n`
  );

  const consumerSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as object;
  const validateConsumer = new Ajv2020({
    allErrors: true,
    strict: false
  }).compile(consumerSchema);
  const validIndex = graphIndex([taskOperation("consumer")]);
  validIndex.tasks["task-000001"]!.content.references = Object.fromEntries([
    ["source", "supported"]
  ]);
  validIndex.tasks["task-000001"]!.content.acceptance = [];
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(
    validateConsumer(validIndex),
    true,
    JSON.stringify(validateConsumer.errors)
  );

  const title = validIndex.tasks["task-000001"]!.content;
  title.title = "😀".repeat(120);
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(
    validateConsumer(validIndex),
    true,
    JSON.stringify(validateConsumer.errors)
  );

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
      (
        invalid.tasks["task-000001"]!.content as {
          title: unknown;
        }
      ).title = 42;
    } else {
      (
        invalid.tasks["task-000001"]!.content.references as Record<
          string,
          unknown
        >
      ).source = 42;
    }
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTextField);
  }

  for (const [sourceId, zeroId] of [["task-000001", "task-000000"]] as const) {
    const invalid = structuredClone(validIndex);
    invalid.tasks[zeroId] = invalid.tasks[sourceId]!;
    delete invalid.tasks[sourceId];
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, zeroId);
  }

  const longDictionaryKey = structuredClone(validIndex);
  longDictionaryKey.tasks["task-000001"]!.content.references =
    Object.fromEntries([["a".repeat(81), "too long"]]);
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

test("generated module import is side-effect free in an empty tool home under supported Node", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "empty-tool-home");
    const imported = await execFileAsync(
      await resolveNodeExecutable(),
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(pathToFileURL(generatedScriptPath).href)})`
      ],
      {
        cwd: root,
        env: { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome },
        windowsHide: true
      }
    );
    assert.equal(imported.stdout, "");
    assert.equal(imported.stderr, "");
    await assert.rejects(fs.stat(toolHome), { code: "ENOENT" });
  });
});

test("generated Node CLI stages selected task entries without native runtime", async () => {
  await withTempWorkspace(async (root) => {
    const repositoryRoot = path.join(root, "repository");
    const toolHome = path.join(root, "empty-tool-home");
    const indexPath = path.join(
      repositoryRoot,
      sourceApi.defaultTaskGraphIndexPath
    );
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    for (const args of [
      ["init", "--quiet"],
      ["config", "core.autocrlf", "false"],
      ["config", "user.email", "generated-stage@example.invalid"],
      ["config", "user.name", "Generated Stage Test"]
    ]) {
      await execFileAsync("git", ["-C", repositoryRoot, ...args], {
        windowsHide: true
      });
    }
    const baseline = graphIndex([
      taskOperation("alpha", { title: "alpha baseline" }),
      taskOperation("bravo", { title: "bravo baseline" })
    ]);
    await fs.writeFile(
      indexPath,
      sourceApi.serializeTaskIndex(baseline),
      "utf8"
    );
    await execFileAsync("git", ["-C", repositoryRoot, "add", "."], {
      windowsHide: true
    });
    await execFileAsync(
      "git",
      ["-C", repositoryRoot, "commit", "--quiet", "--message", "base"],
      { windowsHide: true }
    );
    const candidate = applyOperations(baseline, [
      {
        kind: "update-task-content",
        taskId: "task-000001",
        content: taskContent("alpha workspace")
      }
    ]);
    const candidateText = sourceApi.serializeTaskIndex(candidate);
    await fs.writeFile(indexPath, candidateText, "utf8");

    const staged = await execFileAsync(
      await resolveNodeExecutable(),
      [
        generatedScriptPath,
        "--root",
        repositoryRoot,
        "index",
        "stage",
        "--task",
        "task-000001"
      ],
      {
        cwd: root,
        env: { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome },
        windowsHide: true
      }
    );

    assert.equal(staged.stderr, "");
    assert.equal(
      staged.stdout,
      "TASK INDEX STAGE state=staged revision=2 task-count=2 next-task-id=3 " +
        'selected-task-ids=["task-000001"]\n'
    );
    const pendingText = (
      await execFileAsync(
        "git",
        [
          "-C",
          repositoryRoot,
          "show",
          `:${sourceApi.defaultTaskGraphIndexPath}`
        ],
        { windowsHide: true }
      )
    ).stdout;
    const pending = sourceApi.parseTaskIndex(
      JSON.parse(pendingText) as unknown
    );
    assert.equal(pending.revision, candidate.revision);
    assert.equal(
      pending.tasks["task-000001"]!.content.title,
      "alpha workspace"
    );
    assert.equal(pending.tasks["task-000002"]!.content.title, "bravo baseline");
    assert.equal(await fs.readFile(indexPath, "utf8"), candidateText);
    await assert.rejects(fs.stat(toolHome), { code: "ENOENT" });
  });
});

test("generated Node CLI probes the isolated runtime and mutates offline", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const workspace = path.join(root, "workspace");
    await prepareRootNativeRuntime(toolHome);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const checked = await execFileAsync(
      await resolveNodeExecutable(),
      [generatedScriptPath, "runtime", "info", "--root", workspace],
      { cwd: root, env: environment, windowsHide: true }
    );
    assert.equal(checked.stderr, "");
    const checkResult = JSON.parse(checked.stdout) as {
      ok: boolean;
      data: { compatible: boolean };
    };
    assert.equal(checkResult.ok, true);
    assert.equal(checkResult.data.compatible, true);
    const initialized = await execFileAsync(
      await resolveNodeExecutable(),
      [generatedScriptPath, "index", "init", "--root", workspace],
      { cwd: root, env: environment, windowsHide: true }
    );
    assert.equal(initialized.stderr, "");
    assert.equal((JSON.parse(initialized.stdout) as { ok: boolean }).ok, true);
    await assert.rejects(
      fs.stat(
        path.join(workspace, "docs", "task-graph", "task-graph-index.json.lock")
      ),
      { code: "ENOENT" }
    );
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
  assert.ok(
    files.every(
      (name) => !name.includes("/.install-") && !name.includes("npm-cache")
    )
  );
});
