import { VersionControlError } from "../../shared/src/version-control/index.ts";
import { diagnostic } from "./diagnostics.ts";
import type {
  StateIndexContext,
  StateIndexDiagnostic,
  StateIndexEntryStageResult,
  StateIndexPendingMutation,
  StateIndexVersionControlDiagnostic
} from "./types.ts";
import type {
  EntryStageErrorState,
  EntryStageResultContext
} from "./staging-contracts.ts";

export function isOperationAborted(context: StateIndexContext): boolean {
  return context.signal?.aborted === true;
}

export function pendingFailure(
  context: EntryStageResultContext,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  const versionControl = versionControlDiagnostic(error);
  if (
    error instanceof VersionControlError &&
    error.code === "pending-conflict"
  ) {
    return pendingConflictFailure(context, error, selectedIds, versionControl);
  }
  if (
    error instanceof VersionControlError &&
    error.code === "pending-recovery-failed"
  ) {
    return pendingRecoveryFailure(context, selectedIds, versionControl);
  }
  return failedPendingStage(
    context,
    "pending-write-failed",
    [
      diagnostic({
        ...pendingWriteFailureDiagnostic(error),
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds,
    "no-change"
  );
}

export function pendingConflictFailure(
  context: EntryStageResultContext,
  error: VersionControlError,
  selectedIds: string[],
  versionControl: StateIndexVersionControlDiagnostic | undefined
): StateIndexEntryStageResult {
  const busy = error.causeCategory === "busy";
  return failedPendingStage(
    context,
    "pending-conflict",
    [
      diagnostic({
        code: "state-index.pending-conflict",
        message: busy
          ? "the pending write boundary is busy; wait for any known concurrent operation " +
            "to finish, then confirm a remaining lock is not stale before retrying"
          : "the current revision or target pending content changed; reread the current " +
            "revision and target pending content, resolve any existing pending change for " +
            "this index, then retry",
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds,
    "no-change"
  );
}

export function pendingRecoveryFailure(
  context: EntryStageResultContext,
  selectedIds: string[],
  versionControl: StateIndexVersionControlDiagnostic | undefined
): StateIndexEntryStageResult {
  return failedRecoveryStage(
    context,
    [
      diagnostic({
        code: "state-index.pending-recovery-failed",
        message:
          "pending recovery was incomplete; read and reconcile the target range through " +
          "the version-control API before retrying; if it cannot be uniquely read or " +
          "attributed, stop and ask the range owner",
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds
  );
}

export function repositoryOpenFailure(
  context: EntryStageResultContext,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  if (error instanceof VersionControlError && error.code === "not-repository") {
    return failedStage(
      context,
      "revision-read-failed",
      [
        diagnostic({
          code: "state-index.repository-unavailable",
          message:
            "the configured root is not inside a version-control repository; choose a " +
            "repository-backed root, then retry",
          path: context.indexPath,
          versionControl: versionControlDiagnostic(error)
        })
      ],
      selectedIds
    );
  }
  return revisionReadFailure(context, selectedIds, error);
}

export function revisionReadFailure(
  context: EntryStageResultContext,
  selectedIds: string[],
  error?: unknown
): StateIndexEntryStageResult {
  return failedStage(
    context,
    "revision-read-failed",
    [
      diagnostic({
        ...revisionReadFailureDiagnostic(error),
        path: context.indexPath,
        versionControl: versionControlDiagnostic(error)
      })
    ],
    selectedIds
  );
}

export function abortedStage(
  context: EntryStageResultContext,
  selectedIds: string[]
): StateIndexEntryStageResult {
  return failedStage(
    context,
    "operation-aborted",
    [
      diagnostic({
        code: "state-index.operation-aborted",
        message: "index entry staging was aborted",
        path: context.indexPath
      })
    ],
    selectedIds
  );
}

export function failedRecoveryStage(
  context: EntryStageResultContext,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[]
): StateIndexEntryStageResult {
  return {
    changed: null,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    pending: pendingMutation(context, "partial-or-unknown"),
    selectedIds,
    state: "pending-recovery-failed",
    status: "error"
  };
}

export function failedPendingStage(
  context: EntryStageResultContext,
  state: "pending-conflict" | "pending-write-failed",
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[],
  outcome: Extract<StateIndexPendingMutation["outcome"], "no-change">
): StateIndexEntryStageResult {
  return {
    changed: false,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    pending: pendingMutation(context, outcome),
    selectedIds,
    state,
    status: "error"
  };
}

export function failedStage(
  context: EntryStageResultContext,
  state: EntryStageErrorState,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[] = []
): StateIndexEntryStageResult {
  return {
    changed: false,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    selectedIds,
    state,
    status: "error"
  };
}

export function pendingMutation(
  context: EntryStageResultContext,
  outcome: StateIndexPendingMutation["outcome"]
): StateIndexPendingMutation {
  return {
    outcome,
    scope: context.pendingScope ?? context.indexPath
  };
}

export function versionControlDiagnostic(
  error: unknown
): StateIndexVersionControlDiagnostic | undefined {
  if (!(error instanceof VersionControlError)) {
    return undefined;
  }
  return {
    causeCategory: error.causeCategory,
    detail: error.detail,
    operation: error.operation,
    target: error.target
  };
}

export function pendingWriteFailureDiagnostic(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof VersionControlError) {
    switch (error.causeCategory) {
      case "access-denied":
        return {
          code: "state-index.pending-access-denied",
          message:
            "the current process was denied access while replacing the pending index; " +
            "grant this process the required repository write access, then retry"
        };
      case "tool-unavailable":
        return {
          code: "state-index.pending-tool-unavailable",
          message:
            "the version-control tool was unavailable while replacing the pending index; " +
            "restore the configured tool, then retry"
        };
    }
  }
  return {
    code: "state-index.pending-write-failed",
    message:
      "failed to replace the pending index; the previous pending range was preserved; " +
      "inspect the target pending content and repository access, then retry"
  };
}

export function revisionReadFailureDiagnostic(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof VersionControlError) {
    switch (error.causeCategory) {
      case "access-denied":
        return {
          code: "state-index.repository-access-denied",
          message:
            "the current process was denied access while reading the repository; grant " +
            "this process the required repository read access, then retry"
        };
      case "tool-unavailable":
        return {
          code: "state-index.repository-tool-unavailable",
          message:
            "the version-control tool was unavailable while reading the repository; " +
            "restore the configured tool, then retry"
        };
      case "revision-unavailable":
        return {
          code: "state-index.revision-unavailable",
          message:
            "the current revision is unavailable; restore repository revision integrity, " +
            "then retry"
        };
    }
  }
  return {
    code: "state-index.revision-read-failed",
    message:
      "failed to read the current revision or its index file; check repository " +
      "access and revision integrity, then retry"
  };
}
