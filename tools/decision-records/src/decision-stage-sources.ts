import { Buffer } from "node:buffer";
import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { isDecisionSourcePath } from "./decision-path.ts";
import {
  decisionRelativePath,
  decodeUtf8,
  readStageDirectory,
  readStageFile,
  repositoryPath
} from "./decision-stage-support.ts";
import type {
  DecisionStageSource,
  FilesystemDecisionCandidates,
  SelectedFilesystemSource
} from "./decision-stage-contracts.ts";
import type { DecisionId } from "./types.ts";

export async function readDecisionBaseline(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
}): Promise<DecisionStageSource[]> {
  if (options.revision === null) {
    return [];
  }
  const revisionPaths = await options.repository.listRevisionFiles(
    options.revision,
    { pathScopes: [options.decisionScope] }
  );
  if (revisionPaths.length === 0) {
    return [];
  }
  const sourcePaths: string[] = [];
  for (const repositoryFilePath of revisionPaths) {
    const sourcePath = decisionRelativePath(
      options.decisionScope,
      repositoryFilePath
    );
    if (sourcePath === decisionIndexFileName) {
      continue;
    }
    if (!isDecisionSourcePath(sourcePath)) {
      throw new Error(
        "revision decision scope contains unsupported file: " + sourcePath
      );
    }
    sourcePaths.push(repositoryFilePath);
  }
  if (sourcePaths.length === 0) {
    return [];
  }
  const files = await options.repository.readRevisionFiles(options.revision, {
    pathScopes: sourcePaths
  });
  return files.map((file) =>
    stageSourceFromFile(
      file,
      decisionRelativePath(options.decisionScope, file.path)
    )
  );
}

/**
 * Discovers only recognizable current Decision identities for selector
 * resolution. It deliberately ignores unrelated or malformed files: selected
 * sources are read and verified again by the staging transaction below.
 */
export async function readFilesystemDecisionCandidates(
  decisionsDirectory: string,
  decisionScope: string
): Promise<FilesystemDecisionCandidates> {
  const sources = new Map<DecisionId, DecisionStageSource>();
  const duplicateIds = new Set<DecisionId>();
  const addSource = async (sourcePath: string): Promise<void> => {
    try {
      const data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
      const source = stageSourceFromFile(
        {
          data,
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      );
      if (sources.has(source.source.decisionId)) {
        duplicateIds.add(source.source.decisionId);
      } else {
        sources.set(source.source.decisionId, source);
      }
    } catch {
      // A malformed unselected file is not part of this stage transaction.
    }
  };
  const rootEntries = await readStageDirectory(decisionsDirectory);
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await addSource(entry.name);
    } else if (entry.isDirectory() && entry.name === "archive") {
      const archivedEntries = await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      );
      for (const archivedEntry of archivedEntries) {
        if (archivedEntry.isFile() && archivedEntry.name.endsWith(".md")) {
          await addSource("archive/" + archivedEntry.name);
        }
      }
    }
  }
  return { duplicateIds, sources };
}

export async function verifySelectedFilesystemSources(
  decisionsDirectory: string,
  decisionScope: string,
  selectedSources: readonly SelectedFilesystemSource[]
): Promise<void> {
  for (const selectedSource of selectedSources) {
    const current = await readFilesystemDecisionSource(
      decisionsDirectory,
      decisionScope,
      selectedSource.decisionId,
      selectedSource.source?.source.sourcePath
    );
    if (selectedSource.source === null && current === null) {
      continue;
    }
    if (
      selectedSource.source === null ||
      current === null ||
      selectedSource.source.source.sourcePath !== current.source.sourcePath ||
      !Buffer.from(selectedSource.source.file.data).equals(
        Buffer.from(current.file.data)
      )
    ) {
      throw new Error(selectedSource.decisionId);
    }
  }
}

export async function readFilesystemDecisionSource(
  decisionsDirectory: string,
  decisionScope: string,
  decisionId: DecisionId,
  expectedSourcePath?: string
): Promise<DecisionStageSource | null> {
  const matches: DecisionStageSource[] = [];
  const inspect = async (
    sourcePath: string,
    entry: { isFile(): boolean; name: string }
  ): Promise<void> => {
    if (!isDecisionSourcePath(sourcePath)) return;
    const isKnownPath = sourcePath === expectedSourcePath;
    if (!entry.isFile()) {
      if (isKnownPath) {
        await readStageFile(
          path.join(decisionsDirectory, ...sourcePath.split("/"))
        );
      }
      return;
    }

    let data: Buffer;
    try {
      data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
    } catch (error) {
      if (isKnownPath) throw error;
      return;
    }
    let text: string;
    try {
      text = decodeUtf8(data, sourcePath);
    } catch (error) {
      if (isKnownPath) throw error;
      return;
    }
    const declaredId = decisionIdFromMarkdown(text);
    if (declaredId !== decisionId) {
      if (isKnownPath)
        throw new Error(
          `${sourcePath} no longer declares the selected Decision ID ${decisionId}`
        );
      return;
    }
    matches.push(
      stageSourceFromFile(
        { data, path: repositoryPath(decisionScope, sourcePath) },
        sourcePath
      )
    );
  };

  const rootEntries = await readStageDirectory(decisionsDirectory);
  for (const entry of rootEntries) {
    if (entry.name === decisionIndexFileName) continue;
    if (entry.name === "archive" && entry.isDirectory()) {
      const archiveEntries = await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      );
      for (const archiveEntry of archiveEntries) {
        await inspect("archive/" + archiveEntry.name, archiveEntry);
      }
      continue;
    }
    await inspect(entry.name, entry);
  }
  if (matches.length > 1) {
    throw new Error(
      "Decision ID occurs in more than one filesystem source path: " +
        decisionId
    );
  }
  return matches[0] ?? null;
}

function stageSourceFromFile(
  file: VersionControlFile,
  sourcePath: string
): DecisionStageSource {
  if (!isDecisionSourcePath(sourcePath)) {
    throw new Error("invalid decision source path: " + sourcePath);
  }
  const text = decodeUtf8(file.data, sourcePath);
  const decisionId = decisionIdFromMarkdown(text);
  if (decisionId === null) {
    throw new Error(
      "decision source must declare a valid frontmatter Decision ID: " +
        sourcePath
    );
  }
  return {
    file,
    source: {
      decisionId,
      sourcePath,
      text
    }
  };
}
