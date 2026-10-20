/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/change-plan
 * Rebuild: bun run sync:change-plan-cli
 */
import { openGitVersionControl } from "./git.ts";
import type { VersionControlRepository } from "./types.ts";

export {
  classifyVersionControlCause,
  renderVersionControlError,
  VersionControlError,
  type VersionControlErrorCauseCategory,
  type VersionControlErrorCode,
  type VersionControlErrorDetails
} from "./errors.ts";
export { repositoryRelativePathFromFileSystemPath } from "./repository-relative-path.ts";
export { changedPendingPaths } from "./pending-changed-paths.ts";
export type {
  ListChangedPathsOptions,
  ListPendingChangedPathsOptions,
  ListVersionControlFilesOptions,
  ReadWorkspaceFilesOptions,
  ReplacePendingFilesOptions,
  ReplacePendingFilesResult,
  RevisionId,
  VersionControlFile,
  VersionControlFileKind,
  VersionControlRepository
} from "./types.ts";

export async function openVersionControl(
  startDirectory: string
): Promise<VersionControlRepository> {
  return await openGitVersionControl(startDirectory);
}
