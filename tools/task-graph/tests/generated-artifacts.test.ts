import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as sourceApi from "../src/cli.ts";
import {
  applyOperations,
  graphIndex,
  prepareRootNativeRuntime,
  resolveNodeExecutable,
  taskContent,
  taskOperation,
  withTempWorkspace
} from "./helpers.ts";
import {
  execFileAsync,
  generatedScriptPath,
  repositoryRoot
} from "./generated-artifacts-support.ts";

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

test("generated Node CLI uses the isolated runtime for offline mutation", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const workspace = path.join(root, "workspace");
    await prepareRootNativeRuntime(toolHome);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
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
