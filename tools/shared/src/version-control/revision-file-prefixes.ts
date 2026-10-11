import { fileKindForGitMode, operationError } from "./git-core.ts";
import { gitContextForRepository } from "./git-repository.ts";
import { readGitBlobSelections } from "./git-blob-batch.ts";
import { isReadableBlob, listTreeEntries } from "./git-revision.ts";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "./types.ts";

export type RevisionFilePrefix = VersionControlFile &
  Readonly<{ complete: boolean }>;

/** Fixed revision files remain fully readable; only bounded content is retained. */
export async function readRevisionFilePrefixes(
  repository: VersionControlRepository,
  options: Readonly<{
    revision: RevisionId;
    paths: readonly string[];
    prefixBytes: number;
  }>
): Promise<RevisionFilePrefix[]> {
  if (!Number.isSafeInteger(options.prefixBytes) || options.prefixBytes < 0)
    throw operationError(
      "select revision prefixes",
      "the prefix budget must be a non-negative safe integer"
    );
  if (options.paths.length === 0) return [];
  const context = gitContextForRepository(repository);
  const entries = await listTreeEntries(context, {
    revision: options.revision,
    scopes: options.paths,
    recursive: true,
    operation: "locate files in a revision"
  });
  const unsupported = entries.find((entry) => !isReadableBlob(entry));
  if (unsupported !== undefined)
    throw operationError("validate a revision file entry", undefined, {
      target: unsupported.path
    });
  try {
    const blobs = await readGitBlobSelections(
      context.rootDirectory,
      new Map(entries.map((entry) => [entry.objectId, options.prefixBytes])),
      "none"
    );
    const files = entries
      .map((entry) => {
        const blob = blobs.get(entry.objectId);
        if (blob === undefined)
          throw operationError("read a file from a revision", undefined, {
            target: entry.path
          });
        return {
          path: entry.path,
          kind: fileKindForGitMode(entry.mode),
          data: blob.data,
          complete: blob.data.length === blob.size
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));
    if (files.some((file, index) => file.path === files[index - 1]?.path))
      throw operationError("validate revision file entries");
    return files;
  } catch (error) {
    throw operationError("read files from a revision", error, {
      causeCategory: "command-failed"
    });
  }
}
