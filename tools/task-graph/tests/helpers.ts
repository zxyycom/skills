import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  TaskGraphError,
  applyTaskGraphOperations,
  emptyTaskIndex,
  type TaskContentInput,
  type TaskGraphRevisionOperation,
  type TaskIndex
} from "../src/index.ts";

export const initialNow = new Date("2026-08-06T08:00:00.000Z");

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
