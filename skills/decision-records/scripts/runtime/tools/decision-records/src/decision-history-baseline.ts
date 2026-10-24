/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-history-baseline.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-history-baseline.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-history-baseline.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  readDecisionHistoryIndex,
  historySourcePaths,
  revisionDecisionIds,
  verifyPublishedHistoryIds,
  DecisionHistoryEvidenceError
} from "./decision-history-sources.ts";
import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionAttention,
  decisionFailure,
  decisionDiagnostic,
  decisionVersionControlFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { isDecisionId } from "./decision-path.ts";
import type {
  DecisionId,
  DecisionRelationType,
  DecisionPreparationContext
} from "./types.ts";

export type DecisionHistoryBaseline =
  | {
      kind: "git-head";
      label: "Git HEAD";
      recordedDecisionIds: ReadonlySet<DecisionId>;
    }
  | {
      kind: "outside-git-worktree";
    };

export type DecisionHistoryBaselineResult =
  | DecisionApplicationFailure
  | {
      baseline: DecisionHistoryBaseline;
      status: "ok";
    };

export type UnrecordedHistoryAttentionTarget =
  | {
      decisionId: DecisionId;
      kind: "archive";
    }
  | {
      decisionId: DecisionId;
      kind: "relation";
      relationType: DecisionRelationType;
    };

export async function loadDecisionHistoryBaseline(
  scan: DecisionPreparationContext,
  decisionIds: readonly DecisionId[] = scan.records
    .map((record) => record.decisionId)
    .filter(isDecisionId)
): Promise<DecisionHistoryBaselineResult> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(scan.decisionsDirectory);
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return {
        baseline: { kind: "outside-git-worktree" },
        status: "ok"
      };
    }
    return baselineFailure(error);
  }

  const relativeDirectory = path.relative(
    repository.rootDirectory,
    scan.decisionsDirectory
  );
  if (isOutsideRepository(relativeDirectory)) {
    return {
      baseline: { kind: "outside-git-worktree" },
      status: "ok"
    };
  }

  try {
    return await loadRepositoryHeadBaseline(
      repository,
      relativeDirectory,
      scan,
      decisionIds
    );
  } catch (error) {
    return baselineFailure(error);
  }
}

async function loadRepositoryHeadBaseline(
  repository: VersionControlRepository,
  relativeDirectory: string,
  scan: DecisionPreparationContext,
  decisionIds: readonly DecisionId[]
): Promise<DecisionHistoryBaselineResult> {
  const revision = await repository.getCurrentRevision();
  if (revision === null) return emptyHeadBaseline();
  const directoryScope = toRepositoryPath(relativeDirectory);
  const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
  const index = await readDecisionHistoryIndex(
    repository,
    revision,
    directoryScope
  );
  if (index === null) return emptyHeadBaseline();
  const wanted = new Set(decisionIds);
  const sourcePaths = historySourcePaths(scan, index, wanted, prefix);
  const recordedDecisionIds = await revisionDecisionIds(
    repository,
    revision,
    sourcePaths
  );
  verifyPublishedHistoryIds(index, wanted, recordedDecisionIds);
  return {
    baseline: { kind: "git-head", label: "Git HEAD", recordedDecisionIds },
    status: "ok"
  };
}

function emptyHeadBaseline(): DecisionHistoryBaselineResult {
  return {
    baseline: {
      kind: "git-head",
      label: "Git HEAD",
      recordedDecisionIds: new Set<DecisionId>()
    },
    status: "ok"
  };
}

export function prepareUnrecordedHistoryAttention(
  targets: readonly UnrecordedHistoryAttentionTarget[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionApplicationAttention | null {
  if (
    keepUnrecordedHistory ||
    historyBaseline === null ||
    historyBaseline.kind !== "git-head"
  ) {
    return null;
  }
  const unrecordedTargets = targets
    .filter(
      (target) => !historyBaseline.recordedDecisionIds.has(target.decisionId)
    )
    .sort(compareUnrecordedHistoryAttentionTargets);
  if (unrecordedTargets.length === 0) {
    return null;
  }
  return decisionAttention(
    unrecordedTargets.map((target) =>
      decisionDiagnostic({
        code: "decision-records.unrecorded-history",
        outcome: "no-change",
        reason: unrecordedHistoryAttentionMessage(
          historyBaseline.label,
          target
        ),
        recovery:
          "Re-run with --keep-unrecorded-history only after confirming that the unrecorded history should be preserved.",
        scope: "Decision Markdown files and derived decision index",
        target: "Decision history for " + target.decisionId
      })
    )
  );
}

function unrecordedHistoryAttentionMessage(
  historyLabel: string,
  target: UnrecordedHistoryAttentionTarget
): string {
  if (target.kind === "archive") {
    return (
      "Decision " +
      target.decisionId +
      " has not entered " +
      historyLabel +
      "; confirm whether it should be preserved as independent decision history."
    );
  }
  return (
    "Predecessor decision " +
    target.decisionId +
    " has not entered " +
    historyLabel +
    "; confirm whether this " +
    target.relationType +
    " relation should be preserved as independent decision evolution."
  );
}

function compareUnrecordedHistoryAttentionTargets(
  left: UnrecordedHistoryAttentionTarget,
  right: UnrecordedHistoryAttentionTarget
): number {
  const decisionIdComparison = compareText(left.decisionId, right.decisionId);
  if (decisionIdComparison !== 0) {
    return decisionIdComparison;
  }
  if (left.kind !== right.kind) {
    return compareText(left.kind, right.kind);
  }
  if (left.kind === "relation" && right.kind === "relation") {
    return compareText(left.relationType, right.relationType);
  }
  return 0;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isOutsideRepository(relativePath: string): boolean {
  return (
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep)
  );
}

function toRepositoryPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function baselineFailure(error: unknown): DecisionApplicationFailure {
  if (error instanceof DecisionHistoryEvidenceError)
    return decisionFailure([
      decisionDiagnostic({
        code: "decision-records.history-baseline-invalid",
        reason: error.message,
        outcome: "no-change",
        scope: "Decision Markdown files and derived decision index",
        target: "Decision history baseline",
        recovery:
          "Restore a trusted historical index and its selected source identities before retrying; do not infer recorded history by scanning unrelated blobs."
      })
    ]);
  return decisionVersionControlFailure(
    {
      action: "inspect Git HEAD before changing decision history",
      outcome: "no-change",
      scope: "Decision Markdown files and derived decision index",
      target: "Decision history baseline"
    },
    error
  );
}
