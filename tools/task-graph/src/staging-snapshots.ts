import fs from "node:fs/promises";
import { TaskGraphError } from "./errors.ts";
import {
  isCanonicalTaskId,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import { compareText, isMissingFileError } from "./staging-projection.ts";
import type { TaskIndex } from "./types.ts";

export type TaskSelection = Readonly<{ selectedTaskIds: readonly string[] }>;

export function validateTaskSelection(input: unknown): TaskSelection {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task index staging requires at least one --task value"
    );
  }
  const selectedTaskIds: string[] = [];
  const selectedTaskIdSet = new Set<string>();
  for (const taskId of input) {
    if (typeof taskId !== "string" || !isCanonicalTaskId(taskId)) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        "Selected task ids must use canonical task-000001 form",
        { taskId: typeof taskId === "string" ? taskId : null }
      );
    }
    if (selectedTaskIdSet.has(taskId)) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        `Selected task id ${taskId} appears more than once`,
        { taskId }
      );
    }
    selectedTaskIdSet.add(taskId);
    selectedTaskIds.push(taskId);
  }
  selectedTaskIds.sort(compareText);
  return { selectedTaskIds };
}

export async function readWorkspaceIndex(
  indexPath: string
): Promise<TaskIndex> {
  let data: Buffer;
  try {
    data = await fs.readFile(indexPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new TaskGraphError(
        "INDEX_NOT_FOUND",
        `Task index does not exist: ${indexPath}`,
        { indexPath }
      );
    }
    throw new TaskGraphError(
      "INDEX_READ_FAILED",
      `Unable to read task index: ${indexPath}`,
      { indexPath, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
  return parseSnapshot(data, indexPath, "workspace");
}

export function parseSnapshot(
  input: Uint8Array,
  indexPath: string,
  source: "HEAD" | "workspace"
): TaskIndex {
  const text = decodeSnapshot(input, indexPath, source);
  const raw = parseSnapshotJson(text, indexPath, source);
  const index = parseSnapshotIndex(raw, indexPath, source);
  if (serializeTaskIndex(index) !== text) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not canonical`,
      {
        indexPath,
        source,
        requirement:
          "canonical field order, two-space JSON, LF, and one trailing newline"
      }
    );
  }
  return index;
}

export function decodeSnapshot(
  input: Uint8Array,
  indexPath: string,
  source: "HEAD" | "workspace"
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid UTF-8 text`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

export function parseSnapshotJson(
  text: string,
  indexPath: string,
  source: "HEAD" | "workspace"
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid JSON`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

export function parseSnapshotIndex(
  raw: unknown,
  indexPath: string,
  source: "HEAD" | "workspace"
): TaskIndex {
  try {
    return parseTaskIndex(raw);
  } catch (error) {
    if (error instanceof TaskGraphError) {
      throw new TaskGraphError(
        error.code,
        `The ${source} task index is invalid: ${error.message}`,
        {
          indexPath,
          source,
          causeCode: error.code,
          causeDetails: error.details
        },
        { cause: error }
      );
    }
    throw error;
  }
}
