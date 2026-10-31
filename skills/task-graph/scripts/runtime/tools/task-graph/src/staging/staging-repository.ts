/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/staging/staging-repository.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/staging/staging-repository.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/staging/staging-repository.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import path from "node:path";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  type VersionControlFile,
  type VersionControlRepository
} from "../../../shared/src/version-control/index.ts";
import { TaskGraphError } from "../errors.ts";
import { versionControlFailure } from "./staging-projection.ts";

export async function openStagingRepository(
  indexPath: string,
  selectedTaskIds: readonly string[]
): Promise<{
  repository: VersionControlRepository;
  repositoryIndexPath: string;
}> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(path.dirname(indexPath));
  } catch (error) {
    throw versionControlFailure(error, "discover-repository", selectedTaskIds);
  }
  try {
    return {
      repository,
      repositoryIndexPath: repositoryRelativePathFromFileSystemPath(
        repository.rootDirectory,
        indexPath
      )
    };
  } catch (error) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "The task index must be a file in the discovered version-control repository",
      { cause: error, indexPath, selectedTaskIds },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

export async function readHeadIndex(
  repository: VersionControlRepository,
  repositoryIndexPath: string,
  selectedTaskIds: readonly string[]
): Promise<{ indexFile: VersionControlFile | null; revision: string | null }> {
  try {
    const revision = await repository.getCurrentRevision();
    const indexFile =
      revision === null
        ? null
        : await repository.readRevisionFile(revision, repositoryIndexPath);
    return { indexFile, revision };
  } catch (error) {
    throw versionControlFailure(error, "read-head", selectedTaskIds);
  }
}

export async function replacePendingIndex(
  options: Readonly<{
    file: VersionControlFile;
    head: Awaited<ReturnType<typeof readHeadIndex>>;
    opened: Awaited<ReturnType<typeof openStagingRepository>>;
    selectedTaskIds: readonly string[];
  }>
): Promise<void> {
  try {
    await options.opened.repository.replacePendingFiles({
      expectedFiles:
        options.head.indexFile === null ? [] : [options.head.indexFile],
      expectedRevision: options.head.revision,
      files: [options.file],
      pathScope: options.opened.repositoryIndexPath
    });
  } catch (error) {
    throw versionControlFailure(
      error,
      "replace-pending",
      options.selectedTaskIds
    );
  }
}
