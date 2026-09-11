import type { VersionControlRepository } from "../../shared/src/version-control/index.ts";
import type { StateIndexEntryStageResult } from "./types.ts";

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
