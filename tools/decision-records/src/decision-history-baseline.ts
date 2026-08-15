import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionAttention,
  decisionFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIdFromSourcePath } from "./decision-path.ts";
import type {
  DecisionId,
  DecisionScan,
  EstablishedDecisionRecord
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

export async function loadDecisionHistoryBaseline(
  scan: DecisionScan
): Promise<DecisionHistoryBaselineResult> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(scan.decisionsDirectory);
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository") {
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
    const revisionFiles = directoryScope.length === 0
      ? await repository.listRevisionFiles(revision)
      : await repository.listRevisionFiles(revision, {
          pathScopes: [directoryScope]
        });
    const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
    const recordedDecisionIds = new Set<DecisionId>();
    for (const filePath of revisionFiles) {
      if (!filePath.startsWith(prefix)) {
        continue;
      }
      const decisionId = decisionIdFromSourcePath(filePath.slice(prefix.length));
      if (decisionId !== null) {
        recordedDecisionIds.add(decisionId);
      }
    }
    return {
      baseline: {
        kind: "git-head",
        label: "Git HEAD",
        recordedDecisionIds
      },
      status: "ok"
    };
  } catch (error) {
    return baselineFailure(error);
  }
}

export function prepareUnrecordedHistoryAttention(
  records: readonly EstablishedDecisionRecord[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null,
  canCollapse: boolean
): DecisionApplicationAttention | null {
  if (
    keepUnrecordedHistory
    || historyBaseline === null
    || historyBaseline.kind !== "git-head"
  ) {
    return null;
  }
  const unrecordedIds = records
    .map((record) => record.decisionId)
    .filter((decisionId) => (
      !historyBaseline.recordedDecisionIds.has(decisionId)
    ));
  if (unrecordedIds.length === 0) {
    return null;
  }
  return decisionAttention([
    "The following decisions have not entered "
      + historyBaseline.label
      + ": "
      + unrecordedIds.join(", ")
      + ".",
    "Archiving them now may preserve same-change intermediate decisions as "
      + "meaningless evolution history; no files were changed.",
    canCollapse
      ? "Re-run with --keep-unrecorded-history to preserve that history, or use "
        + "evolve --collapse-unrecorded <decision-id> with one --successor "
        + "and the complete final relation selection."
      : "Re-run with --keep-unrecorded-history only after deciding that the "
        + "unrecorded history should be preserved; otherwise resolve it through "
        + "an explicit evolve collapse."
  ]);
}

function isOutsideRepository(relativePath: string): boolean {
  return path.isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(".." + path.sep);
}

function toRepositoryPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function baselineFailure(error: unknown): DecisionApplicationFailure {
  return decisionFailure([
    "Failed to inspect Git HEAD before changing decision history: "
      + errorText(error)
  ], { presentation: "plain" });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
