import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import {
  isDecisionId,
  sourcePathForDecision
} from "./decision-path.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { buildDecisionStateSnapshotFromSources } from "./decision-state-snapshot.ts";
import type {
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionId,
  DecisionSource
} from "./types.ts";

const decisionSourceReadConcurrency = 32;

export async function readDecisionSourceRevision(
  decisionsDirectory: string,
  decisionIds: readonly string[],
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  return decisionSourceRevision(await readDecisionSources(
    decisionsDirectory,
    decisionIds,
    signal
  ));
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  decisionIds: readonly string[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  return await buildDecisionStateSnapshotFromSources(
    await readDecisionSources(decisionsDirectory, decisionIds, signal),
    signal
  );
}

async function readDecisionSources(
  decisionsDirectory: string,
  decisionIds: readonly string[],
  signal?: AbortSignal
): Promise<DecisionSource[]> {
  const sortedInputs = [...decisionIds].sort(compareText);
  if (new Set(sortedInputs).size !== sortedInputs.length) {
    throw new Error("decision sources must use unique Decision IDs");
  }
  const ids: DecisionId[] = [];
  for (const decisionId of sortedInputs) {
    if (!isDecisionId(decisionId)) {
      throw new Error(`invalid indexed Decision ID ${decisionId}`);
    }
    ids.push(decisionId);
  }

  const sources: DecisionSource[] = [];
  for (
    let offset = 0;
    offset < ids.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision source read was aborted");
    }
    const batch = ids.slice(offset, offset + decisionSourceReadConcurrency);
    sources.push(...await Promise.all(batch.map(async (decisionId) => (
      await readDecisionSource(decisionsDirectory, decisionId, signal)
    ))));
  }
  return sources;
}

async function readDecisionSource(
  decisionsDirectory: string,
  decisionId: DecisionId,
  signal?: AbortSignal
): Promise<DecisionSource> {
  if (signal?.aborted === true) {
    throw new Error("decision source read was aborted");
  }
  const currentPath = path.join(decisionsDirectory, decisionId);
  const archivedPath = path.join(decisionsDirectory, "archive", decisionId);
  const currentSourcePath = sourcePathForDecision(decisionId, "active");
  const archivedSourcePath = sourcePathForDecision(decisionId, "archived");
  const [currentExists, archivedExists] = await Promise.all([
    decisionFileExists(currentPath, currentSourcePath),
    decisionFileExists(archivedPath, archivedSourcePath)
  ]);
  if (currentExists === archivedExists) {
    throw new Error(
      currentExists
        ? `Decision ID resolves to more than one source path: ${decisionId}`
        : `Decision ID does not resolve to a source path: ${decisionId}`
    );
  }
  const sourcePath = archivedExists ? archivedSourcePath : currentSourcePath;
  const sourceFilePath = archivedExists ? archivedPath : currentPath;
  try {
    return {
      decisionId,
      sourcePath,
      text: await fs.readFile(sourceFilePath, "utf8")
    };
  } catch (error) {
    throw new Error(
      `failed to read indexed decision ${sourcePath}: ${errorText(error)}`,
      { cause: error }
    );
  }
}

async function decisionFileExists(
  filePath: string,
  sourcePath: string
): Promise<boolean> {
  try {
    const entry = await fs.lstat(filePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error(
        `decision source must be a regular non-symbolic-link file: ${sourcePath}`
      );
    }
    return true;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
