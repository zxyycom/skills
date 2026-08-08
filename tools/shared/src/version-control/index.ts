import { openGitVersionControl } from "./git.ts";
import type { VersionControlRepository } from "./types.ts";

export {
  VersionControlError,
  type VersionControlErrorCode
} from "./errors.ts";
export type {
  ListFirstParentRevisionChangesOptions,
  ListChangedPathsOptions,
  ListPendingChangedPathsOptions,
  ListVersionControlFilesOptions,
  ReplacePendingFilesOptions,
  ReplacePendingFilesResult,
  RevisionId,
  VersionControlFile,
  VersionControlPathChange,
  VersionControlRevisionChange,
  VersionControlRepository
} from "./types.ts";

export async function openVersionControl(
  startDirectory: string
): Promise<VersionControlRepository> {
  return await openGitVersionControl(startDirectory);
}
