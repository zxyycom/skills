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
import type { NativeLockBinding } from "../src/runtime.ts";
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

async function copyPackageClosure(
  packageName: string,
  resolver: NodeJS.Require,
  runtimePath: string,
  copied: Set<string>
): Promise<void> {
  if (copied.has(packageName)) return;
  const entryPath = resolver.resolve(packageName);
  let packageRoot = path.dirname(entryPath);
  let manifest: { dependencies?: Record<string, string>; name?: string };
  while (true) {
    try {
      manifest = JSON.parse(
        await fs.readFile(path.join(packageRoot, "package.json"), "utf8")
      ) as typeof manifest;
      if (manifest.name === packageName) break;
    } catch {
      // Continue toward the package root.
    }
    const parent = path.dirname(packageRoot);
    if (parent === packageRoot) throw new Error(`Unable to locate package root for ${packageName}`);
    packageRoot = parent;
  }
  copied.add(packageName);
  await copyDirectory(
    packageRoot,
    path.join(runtimePath, "node_modules", ...packageName.split("/"))
  );
  const packageRequire = createRequire(path.join(packageRoot, "package.json"));
  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    await copyPackageClosure(dependencyName, packageRequire, runtimePath, copied);
  }
}

export async function prepareRootNativeRuntime(toolHome: string): Promise<void> {
  const options = {
    environment: { TASK_GRAPH_TOOL_HOME: toolHome },
    nodeVersion: await resolveNodeVersion()
  };
  const info = await getTaskGraphRuntimeInfo(options);
  await fs.mkdir(path.join(info.runtimePath, "node_modules"), { recursive: true });
  await copyPackageClosure(
    "fs-native-extensions",
    createRequire(import.meta.url),
    info.runtimePath,
    new Set()
  );
}

export const uncontendedNativeLock: NativeLockBinding = {
  tryLock: () => true,
  unlock: () => undefined
};

export const loadUncontendedNativeLock = async (): Promise<NativeLockBinding> =>
  uncontendedNativeLock;

export async function loadRootNativeLock(): Promise<NativeLockBinding> {
  if ("Bun" in globalThis) {
    throw new Error(
      "Real fs-native-extensions tests must run under Node.js; Bun must not load the native binding."
    );
  }
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
  return applyOperations(emptyTaskIndex(), operations, now);
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
