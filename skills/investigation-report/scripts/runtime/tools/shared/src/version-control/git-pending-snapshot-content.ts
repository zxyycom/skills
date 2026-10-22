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
import type { PendingPayloadScope } from "./pending-snapshot.ts";
import type { VersionControlFile } from "./types.ts";

/** Payload scope selects validated objects; retention remains explicit per unique object. */
export async function selectedPendingBlobs(
  context: GitRepositoryContext,
  entries: readonly GitIndexEntry[],
  paths: ReadonlySet<string>,
  payloadScope: PendingPayloadScope = "scope"
): Promise<ReadonlyMap<string, GitBlobSelection>> {
  const selections = new Map<string, number | null>();
  for (const entry of entries) {
    if (payloadScope === "content-paths" && !paths.has(entry.path)) continue;
    selections.set(
      entry.objectId,
      paths.has(entry.path) || selections.get(entry.objectId) === null
        ? null
        : 0
    );
  }
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

/** Project actual payload identity without retaining content in the opaque snapshot. */
export function payloadFingerprints(
  blobs: ReadonlyMap<string, GitBlobSelection>
): ReadonlyMap<string, string> {
  const fingerprints = new Map<string, string>();
  for (const [id, blob] of blobs) fingerprints.set(id, blob.fingerprint);
  return fingerprints;
}

export function sameFingerprints(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>
): boolean {
  if (left.size !== right.size) return false;
  for (const [id, fingerprint] of left)
    if (right.get(id) !== fingerprint) return false;
  return true;
}
