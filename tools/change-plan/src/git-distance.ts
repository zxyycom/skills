import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import type { VersionControlRevisionChange } from "../../shared/src/version-control/types.ts";
import { listResolvedFirstParentRevisionChanges } from "../../shared/src/version-control/git-first-parent.ts";
import { repositoryRelativePathFromFileSystemPath } from "../../shared/src/version-control/repository-relative-path.ts";
import type { GitDistanceEvidence } from "./types.ts";
export type { GitDistanceEvidence } from "./types.ts";

export type PlanVersionControlInspection =
  | Readonly<{
      baseCommit: string;
      headCommit: string | null;
      outcome: "base-unavailable";
    }>
  | Readonly<{
      evidence: GitDistanceEvidence;
      outcome: "measured";
    }>;

export type PlanVersionControlInspector = (
  changeDirectory: string,
  baseCommit: string
) => Promise<PlanVersionControlInspection>;

type PlanHistory =
  | Extract<PlanVersionControlInspection, { outcome: "base-unavailable" }>
  | Readonly<{
      baseCommit: string;
      headCommit: string;
      outcome: "available";
      revisions: readonly VersionControlRevisionChange[];
    }>;

function isInsideChange(file: string, changePath: string): boolean {
  return file.startsWith(`${changePath}/`);
}

async function resolveCommit(
  repository: VersionControlRepository,
  commit: string
): Promise<string | null> {
  try {
    return await repository.resolveRevision(commit);
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "revision-not-found"
    ) {
      return null;
    }
    throw error;
  }
}

function measureGitDistance(
  changePath: string,
  history: Extract<PlanHistory, { outcome: "available" }>
): GitDistanceEvidence {
  let changedLines = 0;
  let commitCount = 0;
  for (const revision of history.revisions) {
    const outsideChanges = revision.changes.filter(
      (change) => !isInsideChange(change.path, changePath)
    );
    const onlyChangesCurrentChange =
      revision.changes.length > 0 && outsideChanges.length === 0;
    if (onlyChangesCurrentChange) {
      continue;
    }

    commitCount += 1;
    changedLines += outsideChanges.reduce(
      (lines, change) =>
        lines + (change.addedLineCount ?? 0) + (change.deletedLineCount ?? 0),
      0
    );
  }

  return {
    baseCommit: history.baseCommit,
    changedLines,
    commitCount,
    headCommit: history.headCommit
  };
}

export async function readCurrentHeadCommit(
  changeDirectory: string
): Promise<string | null> {
  const repository = await openVersionControl(path.dirname(changeDirectory));
  return await repository.getCurrentRevision();
}

export async function inspectPlanVersionControl(
  changeDirectory: string,
  baseCommit: string
): Promise<PlanVersionControlInspection> {
  return await createPlanVersionControlInspector(path.dirname(changeDirectory))(
    changeDirectory,
    baseCommit
  );
}

/** One query owns these promises, including failures; no cache survives a query. */
export function createPlanVersionControlInspector(
  changeRoot: string
): PlanVersionControlInspector {
  let repositoryQuery: Promise<VersionControlRepository> | undefined;
  let currentHead: Promise<string | null> | undefined;
  const histories = new Map<string, Promise<PlanHistory>>();
  return async (changeDirectory, baseCommit) => {
    // The caller checks the whole Change root before sharing this repository.
    repositoryQuery ??= openVersionControl(changeRoot);
    const repository = await repositoryQuery;
    const changePath = repositoryRelativePathFromFileSystemPath(
      repository.rootDirectory,
      path.resolve(changeDirectory)
    );
    currentHead ??= repository.getCurrentRevision();
    let history = histories.get(baseCommit);
    if (history === undefined) {
      history = readPlanHistory(repository, currentHead, baseCommit);
      histories.set(baseCommit, history);
    }
    const result = await history;
    return result.outcome === "base-unavailable"
      ? result
      : {
          evidence: measureGitDistance(changePath, result),
          outcome: "measured"
        };
  };
}

async function readPlanHistory(
  repository: VersionControlRepository,
  currentHead: Promise<string | null>,
  baseCommit: string
): Promise<PlanHistory> {
  const headCommit = await currentHead;
  if (headCommit === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }

  const resolvedBase = await resolveCommit(repository, baseCommit);
  if (resolvedBase === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }
  const revisions = await listResolvedFirstParentRevisionChanges(repository, {
    from: resolvedBase,
    to: headCommit
  });
  if (revisions === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }
  return {
    baseCommit: resolvedBase,
    headCommit,
    outcome: "available",
    revisions
  };
}
