import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  TaskGraphError,
  applyTaskGraphOperations,
  emptyTaskIndex,
  type TaskContentInput,
  type TaskGraphRevisionOperation,
  type TaskIndex
} from "../src/index.ts";
import type { NativeLockBinding, NpmCommandResult } from "../src/runtime.ts";
import { getTaskGraphRuntimeInfo } from "../src/runtime.ts";

export const initialNow = new Date("2026-08-06T08:00:00.000Z");
const execFileAsync = promisify(execFile);
let nodeExecutablePromise: Promise<string> | null = null;
let nodeVersionPromise: Promise<string> | null = null;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

export async function resolveNodeExecutable(): Promise<string> {
  nodeExecutablePromise ??= execFileAsync("node", ["-p", "process.execPath"], {
    windowsHide: true
  }).then(({ stdout }) => stdout.trim());
  return await nodeExecutablePromise;
}

export async function resolveNodeVersion(): Promise<string> {
  nodeVersionPromise ??= resolveNodeExecutable().then(async (node) => {
    const { stdout } = await execFileAsync(node, ["-p", "process.version"], {
      windowsHide: true
    });
    return stdout.trim();
  });
  return await nodeVersionPromise;
}

export async function copyRootNativePackages(cwd: string): Promise<NpmCommandResult> {
  const lock = JSON.parse(
    await fs.readFile(path.join(cwd, "package-lock.json"), "utf8")
  ) as { packages: Record<string, { optional?: boolean; version?: string }> };
  for (const [lockPath, entry] of Object.entries(lock.packages)) {
    if (lockPath === "" || entry.optional === true || entry.version === undefined) continue;
    const packageName = lockPath.slice(lockPath.lastIndexOf("node_modules/") + 13);
    const pnpmDirectoryName = `${packageName.replace("/", "+")}@${entry.version}`;
    const source = path.join(
      repositoryRoot,
      "node_modules",
      ".pnpm",
      pnpmDirectoryName,
      "node_modules",
      packageName
    );
    const target = path.join(cwd, ...lockPath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await copyDirectory(source, target);
  }
  return {
    exitCode: 0,
    signal: null,
    stderr: "",
    stdout: "",
    timedOut: false
  };
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const sourceEntry = path.join(source, entry.name);
    const targetEntry = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourceEntry, targetEntry);
    } else if (entry.isSymbolicLink()) {
      const resolved = await fs.realpath(sourceEntry);
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) await copyDirectory(resolved, targetEntry);
      else await fs.copyFile(resolved, targetEntry);
    } else {
      await fs.copyFile(sourceEntry, targetEntry);
    }
  }
}

export async function prepareRootNativeRuntime(toolHome: string): Promise<void> {
  const nodeVersion = await resolveNodeVersion();
  const options = {
    environment: { TASK_GRAPH_TOOL_HOME: toolHome },
    nodeVersion
  };
  const info = await getTaskGraphRuntimeInfo(options);
  await fs.mkdir(info.runtimePath, { recursive: true });
  await Promise.all([
    fs.copyFile(
      path.join(repositoryRoot, "tools", "task-graph", "references", "runtime", "package.json"),
      path.join(info.runtimePath, "package.json")
    ),
    fs.copyFile(
      path.join(repositoryRoot, "tools", "task-graph", "references", "runtime", "package-lock.json"),
      path.join(info.runtimePath, "package-lock.json")
    )
  ]);
  await copyRootNativePackages(info.runtimePath);
  await fs.writeFile(path.join(info.runtimePath, "runtime.json"), `${JSON.stringify({
    schemaVersion: 1,
    runtimeId: info.runtimeId,
    packageLockSha256: info.runtimeId.slice(3),
    packages: { "fs-native-extensions": "1.5.0" },
    installedAt: "2026-08-06T08:00:00.000Z",
    nodeVersion,
    platform: process.platform,
    arch: process.arch
  }, null, 2)}\n`, "utf8");
}

export const uncontendedNativeLock: NativeLockBinding = {
  tryLock: () => true,
  unlock: () => undefined
};

export const loadUncontendedNativeLock = async (): Promise<NativeLockBinding> =>
  uncontendedNativeLock;

export async function loadRootNativeLock(): Promise<NativeLockBinding> {
  const runtimeRequire = createRequire(import.meta.url);
  const input = runtimeRequire("fs-native-extensions") as unknown;
  assert.ok(typeof input === "object" && input !== null);
  const value = input as Record<string, unknown>;
  assert.equal(typeof value.tryLock, "function");
  assert.equal(typeof value.unlock, "function");
  const tryLock = value.tryLock as (fd: number) => boolean;
  const unlock = value.unlock as (fd: number) => void;
  return { tryLock, unlock };
}

export function taskContent(title: string): TaskContentInput {
  return {
    title,
    goal: `${title} goal`,
    acceptance: [`${title} accepted`]
  };
}

export function applyOperations(
  current: TaskIndex,
  operations: TaskGraphRevisionOperation[],
  now: Date = initialNow
): TaskIndex {
  return applyTaskGraphOperations(current, {
    expectedRevision: current.revision,
    operations
  }, now).index;
}

export function graphIndex(
  operations: TaskGraphRevisionOperation[],
  now: Date = initialNow
): TaskIndex {
  return applyOperations(emptyTaskIndex(), [
    { kind: "create-scope", key: "test-scope" },
    ...operations
  ], now);
}

export function taskOperation(
  alias: string,
  options: {
    control?: { mode: "inherit" | "candidate" | "queued"; reason?: null }
      | { mode: "waiting" | "paused"; reason: string };
    parentId?: string | null;
    title?: string;
  } = {}
): TaskGraphRevisionOperation {
  return {
    kind: "create-task",
    scopeId: "scope-000001",
    alias,
    content: taskContent(options.title ?? alias),
    ...(options.parentId === undefined ? {} : { parentId: options.parentId }),
    ...(options.control === undefined ? {} : { control: options.control })
  };
}

export function expectTaskGraphError(
  operation: () => unknown,
  code: TaskGraphError["code"]
): TaskGraphError {
  try {
    operation();
  } catch (error) {
    assert.ok(error instanceof TaskGraphError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected task graph error ${code}`);
}

export async function expectTaskGraphRejection(
  operation: () => Promise<unknown>,
  code: TaskGraphError["code"]
): Promise<TaskGraphError> {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof TaskGraphError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected task graph rejection ${code}`);
}

export async function withTempWorkspace(
  operation: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "task-graph-"));
  try {
    await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

export function uuidSequence(start = 1): () => string {
  let value = start;
  return () => {
    const suffix = String(value).padStart(12, "0");
    value += 1;
    return `00000000-0000-4000-8000-${suffix}`;
  };
}

export type MutableClock = {
  clock: () => Date;
  set: (value: string) => void;
};

export function mutableClock(initial = initialNow.toISOString()): MutableClock {
  let current = new Date(initial);
  return {
    clock: () => new Date(current),
    set: (value: string) => {
      current = new Date(value);
    }
  };
}
