import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { isDecisionId } from "./decision-path.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { buildDecisionStateSnapshotFromSources } from "./decision-state-snapshot.ts";
import type {
  DecisionIndexMetadata,
  DecisionIndexState,
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
  const ids = [...decisionIds].sort(compareText);
  if (new Set(ids).size !== ids.length) {
    throw new Error("decision sources must use unique Decision IDs");
  }
  for (const decisionId of ids) {
    if (!isDecisionId(decisionId)) {
      throw new Error(`invalid indexed Decision ID ${decisionId}`);
    }
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
  decisionId: string,
  signal?: AbortSignal
): Promise<DecisionSource> {
  if (signal?.aborted === true) {
    throw new Error("decision source read was aborted");
  }
  const currentPath = path.join(decisionsDirectory, decisionId);
  const archivedPath = path.join(decisionsDirectory, "archive", decisionId);
  const [currentExists, archivedExists] = await Promise.all([
    exists(currentPath),
    exists(archivedPath)
  ]);
  if (currentExists === archivedExists) {
    throw new Error(
      currentExists
        ? `Decision ID resolves to more than one source path: ${decisionId}`
        : `Decision ID does not resolve to a source path: ${decisionId}`
    );
  }
  const sourcePath = archivedExists ? "archive/" + decisionId : decisionId;
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

async function exists(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
