import { openGitVersionControl } from "./git.ts";
import type { VersionControlRepository } from "./types.ts";

export {
  VersionControlError,
  type VersionControlErrorCode
} from "./errors.ts";
export type {
  ListChangedPathsOptions,
  ListVersionControlFilesOptions,
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "./types.ts";

export async function openVersionControl(
  startDirectory: string
): Promise<VersionControlRepository> {
  return await openGitVersionControl(startDirectory);
}
