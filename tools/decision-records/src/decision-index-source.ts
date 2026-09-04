import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import {
  decisionIdFromMarkdown,
  isCandidateDecisionMarkdown
} from "./decision-metadata.ts";
import { isDecisionId, isDecisionSourcePath } from "./decision-path.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { buildDecisionStateSnapshotFromSources } from "./decision-state-snapshot.ts";
import type {
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionId,
  DecisionSource,
  DecisionSourcePath
} from "./types.ts";

export async function readDecisionSourceRevision(
  decisionsDirectory: string,
  decisionIds: readonly string[] | undefined,
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  return decisionSourceRevision(
    await readDecisionSources(decisionsDirectory, decisionIds, signal)
  );
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  decisionIds: readonly string[] | undefined,
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  return await buildDecisionStateSnapshotFromSources(
    await readDecisionSources(decisionsDirectory, decisionIds, signal),
    signal
  );
}

async function readDecisionSources(
  decisionsDirectory: string,
  decisionIds: readonly string[] | undefined,
  signal?: AbortSignal
): Promise<DecisionSource[]> {
  const discovered = await discoverDecisionSources(decisionsDirectory, signal);
  if (decisionIds === undefined) {
    return discovered.filter(
      (source) => !isCandidateDecisionMarkdown(source.text)
    );
  }
  const requestedIds = validatedUniqueDecisionIds(decisionIds);
  const sourceById = new Map(
    discovered.map((source) => [source.decisionId, source])
  );
  return requestedIds.map((decisionId) => {
    const source = sourceById.get(decisionId);
    if (source === undefined) {
      throw new Error(
        `Decision ID does not resolve to a source path: ${decisionId}`
      );
    }
    return source;
  });
}

function validatedUniqueDecisionIds(
  decisionIds: readonly string[]
): DecisionId[] {
  const values = [...decisionIds].sort(compareText);
  if (new Set(values).size !== values.length) {
    throw new Error("decision sources must use unique Decision IDs");
  }
  const ids: DecisionId[] = [];
  for (const value of values) {
    if (!isDecisionId(value)) {
      throw new Error(`invalid indexed Decision ID ${value}`);
    }
    ids.push(value);
  }
  return ids;
}

async function discoverDecisionSources(
  decisionsDirectory: string,
  signal?: AbortSignal
): Promise<DecisionSource[]> {
  const sourcePaths = await collectDecisionSourcePaths(decisionsDirectory);
  const sources: DecisionSource[] = [];
  const seenIds = new Set<DecisionId>();
  for (const sourcePath of sourcePaths) {
    if (signal?.aborted === true) {
      throw new Error("decision source read was aborted");
    }
    const sourceFile = path.join(decisionsDirectory, ...sourcePath.split("/"));
    await requireRegularSourceFile(sourceFile, sourcePath);
    const text = await fs.readFile(sourceFile, "utf8");
    const decisionId = decisionIdFromMarkdown(text);
    if (decisionId === null) {
      throw new Error(
        `${sourcePath} must declare a valid frontmatter Decision ID`
      );
    }
    if (seenIds.has(decisionId)) {
      throw new Error(
        `Decision ID resolves to more than one source path: ${decisionId}`
      );
    }
    seenIds.add(decisionId);
    sources.push({
      decisionId,
      sourcePath: sourcePath as DecisionSourcePath,
      text
    });
  }
  return sources;
}

async function collectDecisionSourcePaths(
  decisionsDirectory: string
): Promise<string[]> {
  const rootEntries = await fs.readdir(decisionsDirectory, {
    withFileTypes: true
  });
  const sourcePaths: string[] = [];
  for (const entry of rootEntries) {
    if (entry.name.endsWith(".md")) {
      sourcePaths.push(entry.name);
      continue;
    }
    if (entry.isDirectory() && entry.name === "archive") {
      const archiveEntries = await fs.readdir(
        path.join(decisionsDirectory, entry.name),
        { withFileTypes: true }
      );
      for (const archiveEntry of archiveEntries) {
        if (archiveEntry.name.endsWith(".md")) {
          sourcePaths.push(`archive/${archiveEntry.name}`);
        }
      }
    }
  }
  const invalid = sourcePaths.find(
    (sourcePath) => !isDecisionSourcePath(sourcePath)
  );
  if (invalid !== undefined) {
    throw new Error(`invalid Decision source path: ${invalid}`);
  }
  return sourcePaths.sort(compareText);
}

async function requireRegularSourceFile(
  sourceFile: string,
  sourcePath: string
): Promise<void> {
  try {
    const entry = await fs.lstat(sourceFile);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error(
        `decision source must be a regular non-symbolic-link file: ${sourcePath}`
      );
    }
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      throw new Error(`Decision source does not exist: ${sourcePath}`, {
        cause: error
      });
    }
    throw error;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
