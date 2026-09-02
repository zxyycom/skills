import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionAttention,
  decisionDiagnostic,
  decisionVersionControlFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIdFromSourcePath } from "./decision-path.ts";
import type {
  DecisionId,
  DecisionRelationType,
  DecisionScan
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
  scan: DecisionScan
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
    return await loadRepositoryHeadBaseline(repository, relativeDirectory);
  } catch (error) {
    return baselineFailure(error);
  }
}

async function loadRepositoryHeadBaseline(
  repository: VersionControlRepository,
  relativeDirectory: string
): Promise<DecisionHistoryBaselineResult> {
  const revision = await repository.getCurrentRevision();
  if (revision === null) {
    return {
      baseline: {
        kind: "git-head",
        label: "Git HEAD",
        recordedDecisionIds: new Set<DecisionId>()
      },
      status: "ok"
    };
  }

  const directoryScope = toRepositoryPath(relativeDirectory);
  const revisionFiles =
    directoryScope.length === 0
      ? await repository.listRevisionFiles(revision)
      : await repository.listRevisionFiles(revision, {
          pathScopes: [directoryScope]
        });
  const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
  const recordedDecisionIds = new Set<DecisionId>();
  for (const filePath of revisionFiles) {
    if (!filePath.startsWith(prefix)) continue;
    const decisionId = decisionIdFromSourcePath(filePath.slice(prefix.length));
    if (decisionId !== null) recordedDecisionIds.add(decisionId);
  }
  return {
    baseline: { kind: "git-head", label: "Git HEAD", recordedDecisionIds },
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
