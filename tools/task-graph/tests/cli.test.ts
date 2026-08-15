import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  TaskGraphService,
  runTaskGraphCli,
  serializeTaskIndex,
  type TaskGraphCliInternalOptions
} from "../src/cli.ts";
import { renderTaskListResult } from "../src/task-list-renderer.ts";
import {
  applyOperations,
  graphIndex,
  initialNow,
  loadUncontendedNativeLock,
  prepareRootNativeRuntime,
  resolveNodeExecutable,
  taskContent,
  taskOperation,
  uuidSequence,
  withTempWorkspace
} from "./helpers.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const cliSourcePath = path.join(
  repositoryRoot,
  "tools",
  "task-graph",
  "src",
  "cli.ts"
);

type RawCliCall = {
  exitCode: number;
  output: string;
};

type ParsedCliResult =
  | {
      data: unknown;
      indexPath: string;
      ok: true;
      revision: number | null;
    }
  | {
      error: {
        code: string;
        details: Record<string, unknown>;
        message: string;
        retryable: boolean;
      };
      indexPath: string;
      ok: false;
      revision: number | null;
    };

type CliCall = RawCliCall & {
  result: ParsedCliResult;
};

type CliServiceOptions = NonNullable<
  TaskGraphCliInternalOptions["serviceOptions"]
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(isRecord(value), `${label} must be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  assert.ok(typeof value === "string", `${label} must be a string`);
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  assert.ok(typeof value === "boolean", `${label} must be a boolean`);
  return value;
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

function requireRecords(
  value: unknown,
  label: string
): readonly Record<string, unknown>[] {
  return requireArray(value, label).map((entry, index) =>
    requireRecord(entry, `${label}[${index}]`)
  );
}

function requireStrings(value: unknown, label: string): readonly string[] {
  return requireArray(value, label).map((entry, index) =>
    requireString(entry, `${label}[${index}]`)
  );
}

function requireRevision(value: unknown): number | null {
  assert.ok(
    value === null ||
      (typeof value === "number" && Number.isSafeInteger(value)),
    "result.revision must be a safe integer or null"
  );
  return value;
}

function requireOnlyOutput(chunks: readonly string[]): string {
  assert.equal(chunks.length, 1);
  const output = chunks[0];
  assert.ok(output !== undefined);
  return output;
}

async function callRawCli(
  root: string,
  args: string[],
  options: { columns?: number; serviceOptions?: CliServiceOptions } = {}
): Promise<RawCliCall> {
  const chunks: string[] = [];
  const exitCode = await runTaskGraphCli(["--root", root, ...args], {
    ...(options.columns === undefined ? {} : { columns: options.columns }),
    io: { stdout: (text) => chunks.push(text) },
    serviceOptions: {
      clock: () => new Date("2026-08-06T08:00:00.000Z"),
      leaseIdGenerator: uuidSequence(1001),
      loadNativeLock: loadUncontendedNativeLock,
      lockRoot: path.join(root, "test-locks"),
      ...(options.serviceOptions ?? {})
    }
  });
  const output = requireOnlyOutput(chunks);
  assert.ok(output.endsWith("\n"));
  return { exitCode, output };
}

function parseJsonCall(call: {
  exitCode: number | null;
  output: string;
}): ParsedCliResult {
  assert.equal(call.output.endsWith("\n"), true);
  assert.equal(call.output.slice(0, -1).includes("\n"), false);
  const externalResult: unknown = JSON.parse(call.output);
  assert.equal(call.output, `${JSON.stringify(externalResult)}\n`);
  const parsed = requireRecord(externalResult, "CLI result");
  const indexPath = requireString(parsed.indexPath, "result.indexPath");
  const revision = requireRevision(parsed.revision);
  const ok = requireBoolean(parsed.ok, "result.ok");
  let result: ParsedCliResult;
  if (ok) {
    assert.equal(Object.hasOwn(parsed, "data"), true);
    result = { data: parsed.data, indexPath, ok, revision };
  } else {
    const error = requireRecord(parsed.error, "result.error");
    result = {
      error: {
        code: requireString(error.code, "result.error.code"),
        details: requireRecord(error.details, "result.error.details"),
        message: requireString(error.message, "result.error.message"),
        retryable: requireBoolean(error.retryable, "result.error.retryable")
      },
      indexPath,
      ok,
      revision
    };
  }
  assert.equal(call.exitCode, result.ok ? 0 : 1);
  return result;
}

async function callCli(
  root: string,
  args: string[],
  serviceOptions: CliServiceOptions = {}
): Promise<CliCall> {
  const { exitCode, output } = await callRawCli(root, args, { serviceOptions });
  const result = parseJsonCall({ exitCode, output });
  return { exitCode, output, result };
}

async function callProcessCli(
  args: string[],
  input: string,
  environment: NodeJS.ProcessEnv = process.env
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const child = spawn(await resolveNodeExecutable(), [cliSourcePath, ...args], {
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  child.stdin.end(input);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8")
  };
}

async function callCliWithMissingRuntime(
  root: string,
  args: string[],
  toolHome: string,
  nodeVersion: string
): Promise<CliCall> {
  const chunks: string[] = [];
  const exitCode = await runTaskGraphCli(["--root", root, ...args], {
    io: { stdout: (text) => chunks.push(text) },
    runtimeOptions: {
      environment: { TASK_GRAPH_TOOL_HOME: toolHome },
      nodeVersion
    }
  });
  const output = requireOnlyOutput(chunks);
  const result = parseJsonCall({ exitCode, output });
  return { exitCode, output, result };
}

async function writeRichListProjectionFixture(
  root: string
): Promise<TaskGraphService> {
  let index = graphIndex([
    taskOperation("parent", {
      control: { mode: "paused", reason: "awaiting review" },
      title: "Parent title"
    }),
    taskOperation("child", {
      parentId: "@parent",
      title: "Child title"
    }),
    taskOperation("dependency", {
      control: { mode: "queued" },
      title: "Dependency title"
    }),
    taskOperation("excluded", {
      control: { mode: "queued" },
      title: "Excluded title"
    })
  ]);
  index = applyOperations(index, [
    {
      kind: "set-dependency",
      taskId: "task-000001",
      dependencyId: "task-000003",
      present: true
    },
    {
      kind: "set-exclusion",
      taskId: "task-000001",
      excludedTaskId: "task-000004",
      present: true
    }
  ]);
  const indexPath = path.join(
    root,
    "docs",
    "task-graph",
    "task-graph-index.json"
  );
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, serializeTaskIndex(index), "utf8");
  return new TaskGraphService({ root, clock: () => initialNow });
}

test("CLI root help exposes commands runtime requirements and the global JSON option", async () => {
  await withTempWorkspace(async (root) => {
    const help = await callCli(root, []);
    assert.equal(help.result.ok, true);
    if (help.result.ok) {
      assert.equal(help.result.revision, null);
      const data = requireRecord(help.result.data, "root help data");
      const commands = requireStrings(data.commands, "root help data.commands");
      const usage = requireString(data.usage, "root help data.usage");
      assert.equal(usage.startsWith("task-graph"), true);
      assert.equal(data.requiresMutationRuntime, null);
      assert.equal(commands.length, 24);
      assert.ok(commands.includes("index stage"));
      assert.deepEqual(data.runtimeRequirements, {
        supportedNodeRange: "^22.22.2 || ^24.15.0 || >=26.0.0",
        mutationPrerequisite: "compatible-runtime",
        setupCommand: ["runtime", "info"],
        installCommandSource: "runtime info data.installCommand"
      });
      const globalOptions = requireRecords(
        data.globalOptions,
        "root help data.globalOptions"
      );
      assert.deepEqual(
        globalOptions.find((option) => option.name === "--json"),
        { name: "--json", required: false, type: "boolean", default: false }
      );
    }
  });
});

test("CLI command help recovers every command and structured special parameters", async () => {
  await withTempWorkspace(async (root) => {
    const rootHelp = await callCli(root, []);
    assert.equal(rootHelp.result.ok, true);
    if (!rootHelp.result.ok) return;
    const rootHelpData = requireRecord(rootHelp.result.data, "root help data");
    const commands = requireStrings(
      rootHelpData.commands,
      "root help data.commands"
    );
    for (const command of commands) {
      const commandHelp = await callCli(root, [
        ...command.split(" "),
        "--help"
      ]);
      assert.equal(commandHelp.result.ok, true);
      if (commandHelp.result.ok) {
        const data = requireRecord(
          commandHelp.result.data,
          `${command} help data`
        );
        assert.equal(data.command, command);
        assert.equal(typeof data.requiresMutationRuntime, "boolean");
      }
    }
    const removeHelp = await callCli(root, ["task", "remove", "--help"]);
    assert.equal(removeHelp.result.ok, true);
    if (removeHelp.result.ok) {
      const data = requireRecord(
        removeHelp.result.data,
        "task remove help data"
      );
      const parameters = requireRecord(
        data.parameters,
        "task remove help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "task remove help options"
      );
      assert.equal(data.command, "task remove");
      assert.match(
        requireString(data.usage, "task remove help usage"),
        /--expected-revision/u
      );
      assert.deepEqual(
        options.find((option) => option.name === "--task"),
        { name: "--task", required: true, type: "string", multiple: true }
      );
    }

    const taskCreateHelp = await callCli(root, ["task", "create", "--help"]);
    assert.equal(taskCreateHelp.result.ok, true);
    if (taskCreateHelp.result.ok) {
      const data = requireRecord(
        taskCreateHelp.result.data,
        "task create help data"
      );
      assert.equal(data.requiresMutationRuntime, true);
      const parameters = requireRecord(
        data.parameters,
        "task create help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "task create help options"
      );
      assert.deepEqual(
        options.find((option) => option.name === "--acceptance"),
        {
          name: "--acceptance",
          required: false,
          type: "string",
          multiple: true
        }
      );
    }

    const indexStageHelp = await callCli(root, ["index", "stage", "--help"]);
    assert.equal(indexStageHelp.result.ok, true);
    if (indexStageHelp.result.ok) {
      const data = requireRecord(
        indexStageHelp.result.data,
        "index stage help data"
      );
      assert.equal(data.requiresMutationRuntime, false);
      assert.equal(
        data.usage,
        "task-graph index stage --task <id> [--task <id>...]"
      );
      const parameters = requireRecord(
        data.parameters,
        "index stage help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "index stage help options"
      );
      assert.deepEqual(
        options.find((option) => option.name === "--task"),
        { name: "--task", required: true, type: "string", multiple: true }
      );
    }

    const applyHelp = await callCli(root, ["help", "apply"]);
    assert.equal(applyHelp.result.ok, true);
    if (applyHelp.result.ok) {
      const data = requireRecord(applyHelp.result.data, "apply help data");
      const parameters = requireRecord(
        data.parameters,
        "apply help parameters"
      );
      assert.deepEqual(parameters.input, {
        default: "stdin",
        fileOption: "--file",
        format: "json"
      });
    }
  });
});

test("CLI rejects prototype-like command and option names", async () => {
  await withTempWorkspace(async (root) => {
    for (const args of [
      ["help", "constructor"],
      ["index", "info", "--constructor"]
    ]) {
      const prototypeLookup = await callCli(root, args);
      assert.equal(prototypeLookup.result.ok, false);
      if (!prototypeLookup.result.ok) {
        assert.equal(prototypeLookup.result.error.code, "ARGUMENT_INVALID");
      }
    }
  });
});

test("CLI version reports 3.1.0 through the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const version = await callCli(root, ["--version"]);
    assert.equal(version.result.ok, true);
    if (version.result.ok) {
      assert.deepEqual(version.result.data, {
        name: "task-graph",
        version: "3.1.0"
      });
      assert.equal(version.result.revision, null);
    }
  });
});

test("CLI usage failures use the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const usage = await callCli(root, ["task", "create"]);
    assert.equal(usage.exitCode, 1);
    assert.equal(usage.result.ok, false);
    if (!usage.result.ok) {
      assert.equal(usage.result.error.code, "ARGUMENT_INVALID");
      assert.equal(usage.result.revision, null);
    }
  });
});

test("CLI task-list columns prefer injection then TTY and otherwise fall back to 80", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise columns",
      "--expected-revision",
      "0"
    ]);
    const inline = await callRawCli(root, ["task", "list"], { columns: 80 });
    const block = await callRawCli(root, ["task", "list"], { columns: 79 });
    assert.match(
      inline.output,
      /\nL0 \[task-000001\] candidate route task\n$/u
    );
    assert.match(
      block.output,
      /\nL0 \[task-000001\] candidate\n  title:route task\n$/u
    );

    const stdout = process.stdout;
    const originalIsTty = Object.getOwnPropertyDescriptor(stdout, "isTTY");
    const originalColumns = Object.getOwnPropertyDescriptor(stdout, "columns");
    try {
      Object.defineProperties(stdout, {
        isTTY: { configurable: true, value: true },
        columns: { configurable: true, value: 79 }
      });
      assert.equal(
        (await callRawCli(root, ["task", "list"])).output,
        block.output
      );
      assert.equal(
        (await callRawCli(root, ["task", "list"], { columns: 80 })).output,
        inline.output
      );
      assert.equal(
        (await callRawCli(root, ["task", "list"], { columns: 0 })).output,
        block.output
      );

      for (const invalidTtyColumns of [0, 79.5]) {
        Object.defineProperty(stdout, "columns", {
          configurable: true,
          value: invalidTtyColumns
        });
        assert.equal(
          (await callRawCli(root, ["task", "list"])).output,
          inline.output
        );
      }

      Object.defineProperties(stdout, {
        isTTY: { configurable: true, value: false },
        columns: { configurable: true, value: 79 }
      });
      assert.equal(
        (await callRawCli(root, ["task", "list"])).output,
        inline.output
      );
      for (const invalidInjectedColumns of [0, 79.5]) {
        assert.equal(
          (
            await callRawCli(root, ["task", "list"], {
              columns: invalidInjectedColumns
            })
          ).output,
          inline.output
        );
      }
    } finally {
      if (originalIsTty === undefined) Reflect.deleteProperty(stdout, "isTTY");
      else Object.defineProperty(stdout, "isTTY", originalIsTty);
      if (originalColumns === undefined)
        Reflect.deleteProperty(stdout, "columns");
      else Object.defineProperty(stdout, "columns", originalColumns);
    }
  });
});

test("CLI task list --json accepts the global flag before or after the command", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const before = await callRawCli(root, ["--json", "task", "list"]);
    const after = await callRawCli(root, ["task", "list", "--json"]);
    const beforeResult = parseJsonCall(before);
    assert.equal(beforeResult.ok, true);
    assert.deepEqual(parseJsonCall(after), beforeResult);
    assert.equal(after.output, before.output);
  });
});

test("CLI task list --json data equals the complete programmatic list projection", async () => {
  await withTempWorkspace(async (root) => {
    const service = await writeRichListProjectionFixture(root);
    const listed = await service.listTasks();
    const jsonCall = await callRawCli(root, ["task", "list", "--json"]);
    const result = parseJsonCall(jsonCall);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.revision, listed.revision);
    assert.deepEqual(result.data, listed.data);
  });
});

test("CLI default task list renders the complete programmatic projection", async () => {
  await withTempWorkspace(async (root) => {
    const service = await writeRichListProjectionFixture(root);
    const listed = await service.listTasks();
    const programmaticText = renderTaskListResult(
      {
        ok: true,
        indexPath: path.join(
          root,
          "docs",
          "task-graph",
          "task-graph-index.json"
        ),
        revision: listed.revision,
        data: listed.data
      },
      { columns: 80 }
    );
    const cliText = await callRawCli(root, ["task", "list"], { columns: 80 });
    assert.equal(cliText.exitCode, 0);
    assert.equal(cliText.output, programmaticText);
    assert.match(programmaticText, /parent:\[task-000001\]/u);
    assert.match(programmaticText, /needs:\[task-000003\]/u);
    assert.ok(programmaticText.includes('reason:"awaiting review"'));
    assert.match(programmaticText, /RUN MUTEX - cannot run at the same time/u);
  });
});

test("CLI task-list help and commands without text renderers remain on the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise JSON routes",
      "--expected-revision",
      "0"
    ]);
    for (const { args, ok } of [
      { args: ["task", "list", "--help"], ok: true },
      { args: ["task", "show", "task-000001"], ok: true },
      { args: ["task", "show"], ok: false }
    ]) {
      assert.equal(parseJsonCall(await callRawCli(root, args)).ok, ok);
    }
  });
});

test("CLI task-list command failures follow the selected output protocol", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const textFailure = await callRawCli(root, ["task", "list", "unexpected"]);
    assert.equal(textFailure.exitCode, 1);
    assert.match(
      textFailure.output,
      /^TASK LIST ERROR code=ARGUMENT_INVALID revision=0 retryable=false /u
    );
    assert.match(textFailure.output, /\n  detail actualPositionals=1\n/u);

    const jsonFailure = await callRawCli(root, [
      "task",
      "list",
      "unexpected",
      "--json"
    ]);
    const result = parseJsonCall(jsonFailure);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ARGUMENT_INVALID");
      assert.equal(result.revision, 0);
    }
  });
});

test("CLI global argument failures use revision-null JSON", async () => {
  await withTempWorkspace(async (root) => {
    for (const { args, message } of [
      {
        args: ["--json", "task", "list", "--json"],
        message: /--json must not be repeated/u
      },
      {
        args: ["task", "list", "--json=compact"],
        message: /--json does not accept a value/u
      },
      {
        args: ["task", "list", "--root", "--json"],
        message: /--root requires a non-empty path/u
      },
      {
        args: ["task", "list", "--index", "--json"],
        message: /--index requires a non-empty path/u
      }
    ]) {
      const failure = await callRawCli(root, args);
      const result = parseJsonCall(failure);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, "ARGUMENT_INVALID");
        assert.equal(result.revision, null);
        assert.match(result.error.message, message);
      }
    }
  });
});

test("CLI service-construction failures stay on the global JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const failure = await callRawCli(root, [
      "task",
      "list",
      "--index",
      "../outside.json"
    ]);
    const result = parseJsonCall(failure);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ARGUMENT_INVALID");
      assert.equal(result.revision, null);
    }
  });
});

test("process CLI preserves selected stdout protocol stderr and exit status", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise process transport",
      "--expected-revision",
      "0"
    ]);
    const calls = [
      {
        args: ["task", "list", "--root", root],
        expected: await callRawCli(root, ["task", "list"], { columns: 80 })
      },
      {
        args: ["task", "list", "unexpected", "--json", "--root", root],
        expected: await callRawCli(root, [
          "task",
          "list",
          "unexpected",
          "--json"
        ])
      }
    ];
    for (const { args, expected } of calls) {
      const processCall = await callProcessCli(args, "");
      assert.equal(processCall.exitCode, expected.exitCode);
      assert.equal(processCall.stdout, expected.output);
      assert.equal(processCall.stderr, "");
    }
  });
});

test("process CLI reports stdout faults only on stderr with exit two", async () => {
  await withTempWorkspace(async (root) => {
    const preloadPath = path.join(root, "stdout-fault.mjs");
    await fs.writeFile(
      preloadPath,
      "process.stdout.write = () => { throw new Error('simulated stdout fault'); };\n",
      "utf8"
    );
    const fault = await callProcessCli(["--version", "--root", root], "", {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--import=${pathToFileURL(preloadPath).href}`
      ]
        .filter((value) => value !== undefined && value !== "")
        .join(" ")
    });
    assert.equal(fault.exitCode, 2);
    assert.equal(fault.stdout, "");
    assert.match(fault.stderr, /simulated stdout fault/u);
  });
});

test("CLI gates every mutation before argument parsing or apply request and index access", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "missing-tool-home");
    const requestPath = path.join(root, "observable-request.json");
    const indexPath = path.join(
      root,
      "docs",
      "task-graph",
      "task-graph-index.json"
    );
    const nodeVersion = (
      await execFileAsync(
        await resolveNodeExecutable(),
        ["-p", "process.version"],
        { windowsHide: true }
      )
    ).stdout.trim();
    await fs.writeFile(requestPath, "{not-json", "utf8");
    const originalReadFile = fs.readFile;
    let requestReads = 0;
    let indexReads = 0;
    Object.defineProperty(fs, "readFile", {
      configurable: true,
      value: async (...args: Parameters<typeof fs.readFile>) => {
        const target = args[0];
        if (typeof target === "string") {
          if (path.resolve(target) === requestPath) requestReads += 1;
          if (path.resolve(target) === indexPath) indexReads += 1;
        }
        return await originalReadFile(...args);
      }
    });
    try {
      const mutationInvocations = [
        ["index", "init"],
        ["task", "create"],
        ["task", "update-content"],
        ["task", "update-control"],
        ["task", "remove"],
        ["relation", "parent"],
        ["relation", "dependency-add"],
        ["relation", "dependency-remove"],
        ["relation", "exclusion-add"],
        ["relation", "exclusion-remove"],
        ["claim"],
        ["renew"],
        ["release"],
        ["complete"],
        ["fail"],
        ["retry"],
        ["cancel"],
        ["apply", "--file", requestPath]
      ];
      for (const args of mutationInvocations) {
        const failure = await callCliWithMissingRuntime(
          root,
          args,
          toolHome,
          nodeVersion
        );
        assert.equal(failure.exitCode, 1);
        assert.equal(failure.output.endsWith("\n"), true);
        assert.equal(failure.output.slice(0, -1).includes("\n"), false);
        assert.equal(failure.result.ok, false);
        if (!failure.result.ok) {
          assert.equal(failure.result.error.code, "RUNTIME_MISSING");
          assert.equal(failure.result.revision, null);
        }
      }
    } finally {
      Object.defineProperty(fs, "readFile", {
        configurable: true,
        value: originalReadFile
      });
    }
    assert.equal(requestReads, 0);
    assert.equal(indexReads, 0);
    await assert.rejects(fs.stat(path.dirname(indexPath)), { code: "ENOENT" });
  });
});

test("CLI domain read-only commands run without an installed runtime", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "read-only task",
      "--goal",
      "query without runtime",
      "--acceptance",
      "all read-only commands succeed",
      "--expected-revision",
      "0"
    ]);
    const toolHome = path.join(root, "missing-tool-home");
    const nodeVersion = (
      await execFileAsync(
        await resolveNodeExecutable(),
        ["-p", "process.version"],
        { windowsHide: true }
      )
    ).stdout.trim();
    for (const args of [
      ["index", "info"],
      ["task", "list", "--json"],
      ["task", "show", "task-000001"],
      ["actionable"]
    ]) {
      const result = await callCliWithMissingRuntime(
        root,
        args,
        toolHome,
        nodeVersion
      );
      assert.equal(result.exitCode, 0, args.join(" "));
      assert.equal(result.result.ok, true, args.join(" "));
    }
    await assert.rejects(fs.stat(toolHome), { code: "ENOENT" });
  });
});

test("CLI runtime info reports missing and compatible states without index access", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const node = await resolveNodeExecutable();
    const nodeVersion = (
      await execFileAsync(node, ["-p", "process.version"], {
        windowsHide: true
      })
    ).stdout.trim();
    const invoke = async (args: string[]): Promise<CliCall> => {
      const chunks: string[] = [];
      const exitCode = await runTaskGraphCli(["--root", root, ...args], {
        io: { stdout: (text) => chunks.push(text) },
        runtimeOptions: {
          environment: { TASK_GRAPH_TOOL_HOME: toolHome },
          nodeVersion
        }
      });
      const output = requireOnlyOutput(chunks);
      assert.equal(output.endsWith("\n"), true);
      assert.equal(output.slice(0, -1).includes("\n"), false);
      return { exitCode, output, result: parseJsonCall({ exitCode, output }) };
    };
    const missing = await invoke(["runtime", "info"]);
    assert.equal(missing.result.ok, true);
    if (missing.result.ok) {
      const data = requireRecord(missing.result.data, "runtime info data");
      assert.equal(data.state, "missing");
      assert.equal(missing.result.revision, null);
    }
    await prepareRootNativeRuntime(toolHome);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const compatible = await callProcessCli(
      ["runtime", "info", "--root", root],
      "",
      environment
    );
    assert.equal(compatible.exitCode, 0);
    assert.equal(compatible.stderr, "");
    const compatibleResult = parseJsonCall({
      exitCode: compatible.exitCode,
      output: compatible.stdout
    });
    assert.equal(compatibleResult.ok, true);
    if (compatibleResult.ok) {
      const data = requireRecord(compatibleResult.data, "runtime info data");
      assert.equal(data.compatible, true);
    }
    await assert.rejects(fs.stat(path.join(root, "docs")), { code: "ENOENT" });
  });
});

test("CLI success and predictable schema, state, conflict, and file failures use one envelope", async () => {
  await withTempWorkspace(async (root) => {
    const initialized = await callCli(root, ["index", "init"]);
    assert.equal(initialized.result.ok, true);
    assert.equal(initialized.result.revision, 0);

    const task = await callCli(root, [
      "task",
      "create",
      "--title",
      "candidate",
      "--goal",
      "candidate goal",
      "--reference",
      "thread=supported",
      "--expected-revision",
      "0"
    ]);
    assert.equal(task.result.ok, true);
    assert.equal(task.result.revision, 1);

    const shownTask = await callCli(root, ["task", "show", "task-000001"]);
    assert.equal(shownTask.result.ok, true);
    if (shownTask.result.ok) {
      const data = requireRecord(shownTask.result.data, "task show data");
      const taskData = requireRecord(data.task, "task show data.task");
      const content = requireRecord(
        taskData.content,
        "task show data.task.content"
      );
      assert.deepEqual(content.acceptance, []);
      assert.deepEqual(content.references, { thread: "supported" });
    }

    const reservedReference = await callCli(root, [
      "task",
      "create",
      "--title",
      "reserved reference",
      "--goal",
      "reserved reference goal",
      "--acceptance",
      "reserved reference accepted",
      "--reference",
      "prototype=blocked",
      "--expected-revision",
      "1"
    ]);
    assert.equal(reservedReference.result.ok, false);
    if (!reservedReference.result.ok) {
      assert.equal(reservedReference.result.error.code, "REQUEST_INVALID");
    }

    const prototypeReference = await callCli(root, [
      "task",
      "create",
      "--title",
      "invalid prototype",
      "--goal",
      "invalid prototype goal",
      "--acceptance",
      "invalid prototype accepted",
      "--reference",
      "__proto__=blocked",
      "--expected-revision",
      "1"
    ]);
    assert.equal(prototypeReference.result.ok, false);
    if (!prototypeReference.result.ok) {
      assert.equal(prototypeReference.result.error.code, "REQUEST_INVALID");
    }

    for (const [args, code] of [
      [["task", "show", "constructor"], "TASK_NOT_FOUND"]
    ] as const) {
      const lookup = await callCli(root, [...args]);
      assert.equal(lookup.result.ok, false);
      if (!lookup.result.ok) assert.equal(lookup.result.error.code, code);
    }

    const stateFailure = await callCli(root, [
      "claim",
      "task-000001",
      "--actor",
      "worker"
    ]);
    assert.equal(stateFailure.result.ok, false);
    if (!stateFailure.result.ok) {
      assert.equal(stateFailure.result.error.code, "STATE_CONFLICT");
      assert.equal(stateFailure.result.revision, 1);
    }

    const conflict = await callCli(root, [
      "task",
      "create",
      "--title",
      "stale",
      "--goal",
      "stale revision",
      "--expected-revision",
      "0"
    ]);
    assert.equal(conflict.result.ok, false);
    if (!conflict.result.ok) {
      assert.equal(conflict.result.error.code, "REVISION_CONFLICT");
      assert.equal(conflict.result.error.retryable, true);
    }

    const invalidRequestPath = path.join(root, "invalid-request.json");
    await fs.writeFile(
      invalidRequestPath,
      JSON.stringify({
        expectedRevision: 1,
        operations: [
          { kind: "create-task", content: taskContent("invalid"), extra: true }
        ]
      }),
      "utf8"
    );
    const schemaFailure = await callCli(root, [
      "apply",
      "--file",
      invalidRequestPath
    ]);
    assert.equal(schemaFailure.result.ok, false);
    if (!schemaFailure.result.ok) {
      assert.equal(schemaFailure.result.error.code, "REQUEST_INVALID");
    }

    const missingFile = await callCli(root, [
      "apply",
      "--file",
      path.join(root, "missing.json")
    ]);
    assert.equal(missingFile.result.ok, false);
    if (!missingFile.result.ok) {
      assert.equal(missingFile.result.error.code, "REQUEST_INVALID");
    }

    const duplicateInit = await callCli(root, ["index", "init"]);
    assert.equal(duplicateInit.result.ok, false);
    if (!duplicateInit.result.ok) {
      assert.equal(duplicateInit.result.error.code, "INDEX_EXISTS");
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(
      root,
      [
        "task",
        "create",
        "--title",
        "committed but response lost",
        "--goal",
        "exercise write outcome",
        "--expected-revision",
        "0"
      ],
      {
        atomicWrite: async (target) => {
          await fs.writeFile(target, "{corrupt", "utf8");
          throw new Error("simulated different replacement");
        }
      }
    );
    assert.equal(unknown.result.ok, false);
    if (!unknown.result.ok) {
      assert.equal(unknown.result.error.code, "WRITE_OUTCOME_UNKNOWN");
      assert.equal(unknown.result.revision, null);
      assert.equal(unknown.result.error.details.possibleRevision, 1);
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(
      root,
      [
        "task",
        "create",
        "--title",
        "committed then unreadable",
        "--goal",
        "exercise missing readback",
        "--expected-revision",
        "0"
      ],
      {
        atomicWrite: async (target) => {
          await fs.unlink(target);
        }
      }
    );
    assert.equal(unknown.result.ok, true);
    assert.equal(unknown.result.revision, 1);
  });
});

test("CLI index info preserves the unsupported schema error code", async () => {
  await withTempWorkspace(async (root) => {
    const indexPath = path.join(
      root,
      "docs",
      "task-graph",
      "task-graph-index.json"
    );
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(
      indexPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          revision: 0,
          nextIds: { scope: 1, task: 1 },
          scopes: {}
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const checked = await callCli(root, ["index", "info"]);
    assert.equal(checked.exitCode, 1);
    assert.equal(checked.result.ok, false);
    if (!checked.result.ok) {
      assert.equal(checked.result.error.code, "SCHEMA_UNSUPPORTED");
      assert.equal(checked.result.revision, null);
    }
  });
});

test("process CLI maps path failures to JSON exit one with empty stderr", async () => {
  await withTempWorkspace(async (root) => {
    const rootFile = path.join(root, "not-a-directory");
    await fs.writeFile(rootFile, "ordinary file\n", "utf8");
    try {
      await execFileAsync(
        await resolveNodeExecutable(),
        [cliSourcePath, "index", "info", "--root", rootFile],
        { encoding: "utf8", windowsHide: true }
      );
      assert.fail("CLI should fail when --root is an ordinary file");
    } catch (error) {
      const failure = requireRecord(error, "execFile failure");
      assert.equal(failure.code, 1);
      assert.equal(failure.stderr, "");
      const output = requireString(failure.stdout, "execFile failure stdout");
      assert.ok(output.endsWith("\n"));
      assert.equal(output.slice(0, -1).includes("\n"), false);
      const result = parseJsonCall({ exitCode: 1, output });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(
          result.error.code === "INDEX_NOT_FOUND" ||
            result.error.code === "INDEX_READ_FAILED"
        );
      }
    }
  });
});

test("CLI rejects ambiguous lease and revision pairs plus invalid control reasons", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "running",
      "--goal",
      "running goal",
      "--acceptance",
      "running accepted",
      "--control",
      "queued",
      "--expected-revision",
      "0"
    ]);
    const claimed = await callCli(root, [
      "claim",
      "task-000001",
      "--actor",
      "worker"
    ]);
    assert.equal(claimed.result.ok, true);
    if (!claimed.result.ok) return;
    const claimData = requireRecord(claimed.result.data, "claim data");
    const leaseId = requireString(claimData.leaseId, "claim data.leaseId");
    for (const args of [
      [
        "complete",
        "task-000001",
        "--lease",
        leaseId,
        "--expected-revision",
        "3",
        "--result-summary",
        "ambiguous"
      ],
      [
        "cancel",
        "task-000001",
        "--lease",
        leaseId,
        "--expected-revision",
        "3",
        "--reason",
        "ambiguous"
      ],
      [
        "claim",
        "task-000001",
        "--actor",
        "replacement",
        "--recover-lease",
        leaseId
      ]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const args of [
      [
        "complete",
        "task-000001",
        "--result-summary",
        "missing mutation precondition"
      ],
      ["cancel", "task-000001", "--reason", "missing mutation precondition"]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const controlArgs of [
      ["--control", "queued", "--reason", "not allowed"],
      ["--control", "waiting"],
      ["--reason", "orphaned"]
    ]) {
      const failure = await callCli(root, [
        "task",
        "create",
        "--title",
        "invalid control",
        "--goal",
        "invalid control goal",
        "--acceptance",
        "invalid control accepted",
        "--expected-revision",
        "3",
        ...controlArgs
      ]);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }
  });
});

test("CLI apply resolves aliases and rolls back every operation when one fails", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const validRequestPath = path.join(root, "valid-apply.json");
    await fs.writeFile(
      validRequestPath,
      `${JSON.stringify(
        {
          expectedRevision: 0,
          operations: [
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("parent"),
              control: { mode: "queued" }
            },
            {
              kind: "create-task",
              alias: "child",
              parentId: "@constructor",
              content: taskContent("child")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const applied = await callCli(root, ["apply", "--file", validRequestPath]);
    assert.equal(applied.result.ok, true);
    if (applied.result.ok) {
      const data = requireRecord(applied.result.data, "apply data");
      assert.equal(applied.result.revision, 1);
      assert.deepEqual(data.aliases, {
        child: "task-000002",
        constructor: "task-000001"
      });
    }

    const duplicateAliasPath = path.join(root, "duplicate-alias.json");
    await fs.writeFile(
      duplicateAliasPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("first duplicate")
            },
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("second duplicate")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const duplicateAlias = await callCli(root, [
      "apply",
      "--file",
      duplicateAliasPath
    ]);
    assert.equal(duplicateAlias.result.ok, false);
    if (!duplicateAlias.result.ok) {
      assert.equal(duplicateAlias.result.error.code, "REQUEST_INVALID");
    }

    const longAliasPath = path.join(root, "long-alias.json");
    await fs.writeFile(
      longAliasPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "a".repeat(81),
              content: taskContent("long alias")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const longAlias = await callCli(root, ["apply", "--file", longAliasPath]);
    assert.equal(longAlias.result.ok, false);
    if (!longAlias.result.ok) {
      assert.equal(longAlias.result.error.code, "REQUEST_INVALID");
    }

    const invalidRequestPath = path.join(root, "rollback-apply.json");
    await fs.writeFile(
      invalidRequestPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "temporary",
              content: taskContent("temporary")
            },
            {
              kind: "set-dependency",
              taskId: "@temporary",
              dependencyId: "task-999999",
              present: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const rejected = await callCli(root, [
      "apply",
      "--file",
      invalidRequestPath
    ]);
    assert.equal(rejected.result.ok, false);
    if (!rejected.result.ok) {
      assert.equal(rejected.result.error.code, "TASK_NOT_FOUND");
    }
    const info = await callCli(root, ["index", "info"]);
    assert.equal(info.result.ok, true);
    if (info.result.ok) {
      const data = requireRecord(info.result.data, "index info data");
      assert.equal(info.result.revision, 1);
      assert.equal(data.nextTaskId, 3);
    }
  });
});

test("process CLI apply accepts a JSON request from stdin without extra output", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    await callCli(root, ["index", "init"]);
    const request = `${JSON.stringify({
      expectedRevision: 0,
      operations: [
        {
          kind: "create-task",
          alias: "stdin-task",
          content: taskContent("stdin task"),
          control: { mode: "queued" }
        }
      ]
    })}\n`;
    const invoked = await callProcessCli(["apply", "--root", root], request, {
      ...process.env,
      TASK_GRAPH_TOOL_HOME: toolHome
    });
    assert.equal(invoked.exitCode, 0);
    assert.equal(invoked.stderr, "");
    assert.ok(invoked.stdout.endsWith("\n"));
    assert.equal(invoked.stdout.slice(0, -1).includes("\n"), false);
    const result = parseJsonCall({
      exitCode: invoked.exitCode,
      output: invoked.stdout
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const data = requireRecord(result.data, "apply data");
      assert.equal(result.revision, 1);
      assert.deepEqual(data.aliases, { "stdin-task": "task-000001" });
    }
  });
});

test("independent Node CLI claims serialize and only one excluded task wins", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    await callCli(root, ["index", "init"]);
    const requestPath = path.join(root, "excluded-tasks.json");
    await fs.writeFile(
      requestPath,
      `${JSON.stringify(
        {
          expectedRevision: 0,
          operations: [
            {
              kind: "create-task",
              alias: "left",
              content: taskContent("left"),
              control: { mode: "queued" }
            },
            {
              kind: "create-task",
              alias: "right",
              content: taskContent("right"),
              control: { mode: "queued" }
            },
            {
              kind: "set-exclusion",
              taskId: "@left",
              excludedTaskId: "@right",
              present: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const applied = await callCli(root, ["apply", "--file", requestPath]);
    assert.equal(applied.result.ok, true);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const claims = await Promise.all([
      callProcessCli(
        ["claim", "task-000001", "--actor", "left-worker", "--root", root],
        "",
        environment
      ),
      callProcessCli(
        ["claim", "task-000002", "--actor", "right-worker", "--root", root],
        "",
        environment
      )
    ]);
    assert.equal(claims.filter(({ exitCode }) => exitCode === 0).length, 1);
    assert.equal(claims.filter(({ exitCode }) => exitCode === 1).length, 1);
    for (const claim of claims) {
      assert.equal(claim.stderr, "");
      assert.equal(claim.stdout.endsWith("\n"), true);
      assert.equal(claim.stdout.slice(0, -1).includes("\n"), false);
    }
    const failure = claims.find(({ exitCode }) => exitCode === 1);
    assert.ok(failure !== undefined);
    const failureResult = parseJsonCall({
      exitCode: failure.exitCode,
      output: failure.stdout
    });
    assert.equal(failureResult.ok, false);
    if (!failureResult.ok) {
      assert.equal(failureResult.error.code, "STATE_CONFLICT");
      assert.equal(failureResult.revision, 2);
    }
    const info = await callCli(root, ["index", "info"]);
    assert.equal(info.result.revision, 2);
  });
});
