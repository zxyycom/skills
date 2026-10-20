/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-sources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-sources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-sources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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

export async function readDecisionBaseline(
  options: Readonly<{
    decisionsDirectory: string;
    decisionScope: string;
    repository: VersionControlRepository;
    revision: RevisionId | null;
  }>
): Promise<readonly DecisionStageSource[]> {
  if (options.revision === null) return [];
  const revisionPaths = await options.repository.listRevisionFiles(
    options.revision,
    { pathScopes: [options.decisionScope] }
  );
  if (revisionPaths.length === 0) return [];
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
  if (sourcePaths.length === 0) return [];
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

/** One phase-local discovery; selected resolution owns which failures matter. */
export async function readFilesystemDecisionCandidates(
  decisionsDirectory: string,
  decisionScope: string
): Promise<FilesystemDecisionCandidates> {
  const sources = new Map<DecisionId, DecisionStageSource>();
  const duplicateIds = new Set<DecisionId>();
  const paths = new Map<
    string,
    { source: DecisionStageSource } | { error: unknown }
  >();
  const inspect = async (sourcePath: string): Promise<void> => {
    if (!isDecisionSourcePath(sourcePath)) return;
    try {
      const data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
      const source = stageSourceFromFile(
        {
          data,
          kind: "regular",
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      );
      paths.set(sourcePath, { source });
      if (sources.has(source.source.decisionId))
        duplicateIds.add(source.source.decisionId);
      else sources.set(source.source.decisionId, source);
    } catch (error) {
      paths.set(sourcePath, { error });
    }
  };
  for (const entry of await readStageDirectory(decisionsDirectory)) {
    if (entry.name === "archive" && entry.isDirectory()) {
      for (const archived of await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      )) {
        await inspect("archive/" + archived.name);
      }
    } else {
      await inspect(entry.name);
    }
  }
  return { duplicateIds, paths, sources };
}

/** Expected-path evidence takes precedence over another path declaring the ID. */
export function resolveFilesystemDecisionSource(
  filesystem: FilesystemDecisionCandidates,
  decisionId: DecisionId,
  expectedSourcePath?: string
): DecisionStageSource | null {
  if (expectedSourcePath !== undefined) {
    const expected = filesystem.paths.get(expectedSourcePath);
    if (expected !== undefined) {
      if ("error" in expected) throw expected.error;
      if (expected.source.source.decisionId !== decisionId) {
        throw new Error(
          `${expectedSourcePath} no longer declares the selected Decision ID ${decisionId}`
        );
      }
    }
  }
  if (filesystem.duplicateIds.has(decisionId)) {
    throw new Error(
      "Decision ID occurs in more than one filesystem source path: " +
        decisionId
    );
  }
  return filesystem.sources.get(decisionId) ?? null;
}

export async function verifySelectedFilesystemSources(
  decisionsDirectory: string,
  decisionScope: string,
  selectedSources: readonly SelectedFilesystemSource[]
): Promise<void> {
  const filesystem = await readFilesystemDecisionCandidates(
    decisionsDirectory,
    decisionScope
  );
  for (const selectedSource of selectedSources) {
    const current = resolveFilesystemDecisionSource(
      filesystem,
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
