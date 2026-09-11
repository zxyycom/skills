import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TaskGraphService,
  runTaskGraphCli,
  serializeTaskIndex,
  type TaskGraphCliInternalOptions
} from "../src/cli.ts";
import {
  applyOperations,
  graphIndex,
  initialNow,
  loadUncontendedNativeLock,
  resolveNodeExecutable,
  taskOperation,
  uuidSequence
} from "./helpers.ts";

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

export type CliCall = RawCliCall & {
  result: ParsedCliResult;
};

type CliServiceOptions = NonNullable<
  TaskGraphCliInternalOptions["serviceOptions"]
>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  assert.ok(isRecord(value), `${label} must be an object`);
  return value;
}

export function requireString(value: unknown, label: string): string {
  assert.ok(typeof value === "string", `${label} must be a string`);
  return value;
}

export function requireBoolean(value: unknown, label: string): boolean {
  assert.ok(typeof value === "boolean", `${label} must be a boolean`);
  return value;
}

export function requireArray(
  value: unknown,
  label: string
): readonly unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

export function requireRecords(
  value: unknown,
  label: string
): readonly Record<string, unknown>[] {
  return requireArray(value, label).map((entry, index) =>
    requireRecord(entry, `${label}[${index}]`)
  );
}

export function requireStrings(
  value: unknown,
  label: string
): readonly string[] {
  return requireArray(value, label).map((entry, index) =>
    requireString(entry, `${label}[${index}]`)
  );
}

export function requireRevision(value: unknown): number | null {
  assert.ok(
    value === null ||
      (typeof value === "number" && Number.isSafeInteger(value)),
    "result.revision must be a safe integer or null"
  );
  return value;
}

export function requireOnlyOutput(chunks: readonly string[]): string {
  assert.equal(chunks.length, 1);
  const output = chunks[0];
  assert.ok(output !== undefined);
  return output;
}

export async function callRawCli(
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
      ...options.serviceOptions
    }
  });
  const output = requireOnlyOutput(chunks);
  assert.ok(output.endsWith("\n"));
  return { exitCode, output };
}

export function parseJsonCall(call: {
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

export async function callCli(
  root: string,
  args: string[],
  serviceOptions: CliServiceOptions = {}
): Promise<CliCall> {
  const { exitCode, output } = await callRawCli(root, args, { serviceOptions });
  const result = parseJsonCall({ exitCode, output });
  return { exitCode, output, result };
}

export async function callProcessCli(
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

export async function callCliWithMissingRuntime(
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

export async function writeRichListProjectionFixture(
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
