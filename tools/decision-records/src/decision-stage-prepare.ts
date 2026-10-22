import type { DecisionApplicationFailure } from "./application-result.ts";
import { VersionControlError } from "../../shared/src/version-control/index.ts";
import {
  DecisionStageFileSystemError,
  DecisionStageConflictError,
  stageDomainFailure,
  stageFileSystemFailure,
  versionControlFailure
} from "./decision-stage-support.ts";

export function decisionStageTargetFailure(
  error: unknown
): DecisionApplicationFailure {
  if (error instanceof DecisionStageConflictError && error.kind === "pending")
    return stageDomainFailure(
      "decision-records.version-control-pending-conflict",
      "Pending decision snapshot changed before staging.",
      "Pending decision snapshot",
      error
    );
  if (error instanceof DecisionStageConflictError && error.kind === "source")
    return stageDomainFailure(
      "decision-records.stage-source-changed",
      "Selected decision source changed before staging.",
      "Selected decision source",
      error
    );
  if (error instanceof DecisionStageFileSystemError) {
    return stageFileSystemFailure(
      "Failed to construct the selected decision snapshot.",
      error.cause
    );
  }
  if (error instanceof VersionControlError) {
    return versionControlFailure(
      "construct the selected decision snapshot",
      error
    );
  }
  return stageDomainFailure(
    "decision-records.stage-snapshot-invalid",
    "The selected decision snapshot is invalid.",
    "Decision stage source selection",
    error
  );
}
