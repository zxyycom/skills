import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  listFirstParentRevisionChanges
} from "../../shared/src/version-control/git-first-parent.ts";
import {
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/repository-relative-path.ts";
import type { GitDistanceEvidence } from "./types.ts";
export type { GitDistanceEvidence } from "./types.ts";

export type PlanVersionControlInspection =
  | {
    baseCommit: string;
    headCommit: string | null;
    outcome: "base-unavailable";
  }
  | {
    evidence: GitDistanceEvidence;
    outcome: "measured";
  };

type ChangeRepositoryContext = {
  changePath: string;
  repository: VersionControlRepository;
};

async function repositoryContext(
  changeDirectory: string
): Promise<ChangeRepositoryContext> {
  const repository = await openVersionControl(changeDirectory);
  return {
    changePath: repositoryRelativePathFromFileSystemPath(
      repository.rootDirectory,
      path.resolve(changeDirectory)
    ),
    repository
  };
}

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
      error instanceof VersionControlError
      && error.code === "revision-not-found"
    ) {
      return null;
    }
    throw error;
  }
}

async function measureResolvedGitDistance(
  context: ChangeRepositoryContext,
  resolvedBase: string,
  headCommit: string
): Promise<GitDistanceEvidence | null> {
  const revisions = await listFirstParentRevisionChanges(
    context.repository,
    { from: resolvedBase, to: headCommit }
  );
  if (revisions === null) {
    return null;
  }

  let changedLines = 0;
  let commitCount = 0;
  for (const revision of revisions) {
    const outsideChanges = revision.changes.filter(
      (change) => !isInsideChange(change.path, context.changePath)
    );
    const onlyChangesCurrentChange = revision.changes.length > 0
      && outsideChanges.length === 0;
    if (onlyChangesCurrentChange) {
      continue;
    }

    commitCount += 1;
    for (const change of outsideChanges) {
      changedLines += (change.addedLineCount ?? 0)
        + (change.deletedLineCount ?? 0);
    }
  }

  return {
    baseCommit: resolvedBase,
    changedLines,
    commitCount,
    headCommit
  };
}

export async function readCurrentHeadCommit(
  changeDirectory: string
): Promise<string | null> {
  const repository = await openVersionControl(changeDirectory);
  return await repository.getCurrentRevision();
}

export async function inspectPlanVersionControl(
  changeDirectory: string,
  baseCommit: string
): Promise<PlanVersionControlInspection> {
  const context = await repositoryContext(changeDirectory);
  const headCommit = await context.repository.getCurrentRevision();
  if (headCommit === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }

  const resolvedBase = await resolveCommit(context.repository, baseCommit);
  if (resolvedBase === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }
  const evidence = await measureResolvedGitDistance(
    context,
    resolvedBase,
    headCommit
  );
  if (evidence === null) {
    return { baseCommit, headCommit, outcome: "base-unavailable" };
  }
  return { evidence, outcome: "measured" };
}
