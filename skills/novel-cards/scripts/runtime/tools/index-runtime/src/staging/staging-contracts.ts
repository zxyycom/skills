/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/staging/staging-contracts.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/staging/staging-contracts.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/staging/staging-contracts.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import type { VersionControlRepository } from "../../../shared/src/version-control/index.ts";
import type { StateIndexEntryStageResult } from "../types.ts";

export type EntryStageErrorState = Exclude<
  Extract<StateIndexEntryStageResult, { status: "error" }>["state"],
  "pending-recovery-failed"
>;

export type EntryStageResultContext = Readonly<{
  indexPath: string;
  namespace: string;
  pendingScope?: string;
}>;

export type StagingRepository = Pick<
  VersionControlRepository,
  | "getCurrentRevision"
  | "readRevisionFile"
  | "replacePendingFiles"
  | "rootDirectory"
>;
