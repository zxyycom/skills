/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git-pending-snapshot-content.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git-pending-snapshot-content.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git-pending-snapshot-content.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  readGitBlobSelections,
  type GitBlobSelection
} from "./git-blob-batch.ts";
import {
  fileKindForGitMode,
  operationError,
  type GitIndexEntry
} from "./git-core.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import type { VersionControlFile } from "./types.ts";

/** Complete payload validation chooses retention per unique object, then materializes only requested paths. */
export async function selectedPendingBlobs(
  context: GitRepositoryContext,
  entries: readonly GitIndexEntry[],
  paths: ReadonlySet<string>
): Promise<ReadonlyMap<string, GitBlobSelection>> {
  const selections = new Map<string, number | null>();
  for (const entry of entries)
    selections.set(
      entry.objectId,
      paths.has(entry.path) || selections.get(entry.objectId) === null
        ? null
        : 0
    );
  try {
    return await readGitBlobSelections(context.rootDirectory, selections);
  } catch (error) {
    throw operationError("read files from the pending snapshot", error, {
      causeCategory: "command-failed"
    });
  }
}

export function materializedFiles(
  entries: readonly GitIndexEntry[],
  blobs: ReadonlyMap<string, GitBlobSelection>,
  paths: ReadonlySet<string>
): VersionControlFile[] {
  return entries
    .filter((entry) => paths.has(entry.path))
    .map((entry) => {
      const blob = blobs.get(entry.objectId);
      if (blob === undefined)
        throw operationError(
          "read a file from the pending snapshot",
          undefined,
          { target: entry.path }
        );
      return {
        path: entry.path,
        kind: fileKindForGitMode(entry.mode),
        data: blob.data
      };
    });
}
