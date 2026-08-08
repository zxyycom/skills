import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  changePlanArtifactNames,
  type ChangePlanAssessment
} from "./types.ts";

export type GitDistanceAssessment = Extract<
  ChangePlanAssessment,
  { assessment: "current" | "shelve-candidate" }
>;

export type GitDistanceEvidence = Omit<
  GitDistanceAssessment,
  "assessment"
>;

export type PlanVersionControlInspection =
  | {
    baseCommit: string | null;
    headCommit: string | null;
    outcome: "base-unavailable";
  }
  | {
    baseCommit: string;
    headCommit: string;
    outcome: "artifacts-changed";
  }
  | {
    evidence: GitDistanceEvidence;
    outcome: "measured";
  };

export type PlanArtifactConfirmation =
  | { confirmed: true; headCommit: string }
  | { confirmed: false; headCommit: string | null };

type ChangeRepositoryContext = {
  changePath: string;
  repository: VersionControlRepository;
};

async function repositoryContext(
  changeDirectory: string
): Promise<ChangeRepositoryContext> {
  const repository = await openVersionControl(changeDirectory);
  return {
    changePath: repository.getRepositoryRelativePath(
      path.resolve(changeDirectory)
    ),
    repository
  };
}

function artifactPaths(changePath: string): string[] {
  return changePlanArtifactNames.map(
    (artifact) => `${changePath}/${artifact}`
  );
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

async function artifactsMatchCommit(
  context: ChangeRepositoryContext,
  commit: string
): Promise<boolean> {
  const paths = artifactPaths(context.changePath);
  const [revisionFiles, pendingChanges, workspaceChanges] = await Promise.all([
    context.repository.listRevisionFiles(commit, { pathScopes: paths }),
    context.repository.listPendingChangedPaths({
      from: commit,
      pathScopes: paths
    }),
    context.repository.listWorkspaceChangedPaths()
  ]);
  if (
    revisionFiles.length !== paths.length
    || paths.some((artifactPath) => !revisionFiles.includes(artifactPath))
  ) {
    return false;
  }
  const pathSet = new Set(paths);
  return pendingChanges.length === 0
    && !workspaceChanges.some((changedPath) => pathSet.has(changedPath));
}

async function measureResolvedGitDistance(
  context: ChangeRepositoryContext,
  resolvedBase: string,
  headCommit: string
): Promise<GitDistanceEvidence | null> {
  let revisions;
  try {
    revisions = await context.repository.listFirstParentRevisionChanges({
      from: resolvedBase,
      to: headCommit
    });
  } catch (error) {
    if (
      error instanceof VersionControlError
      && error.code === "revision-not-first-parent"
    ) {
      return null;
    }
    throw error;
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
    headCommit,
    policy: "git-distance-v1"
  };
}

export async function confirmPlanArtifactsAtHead(
  changeDirectory: string
): Promise<PlanArtifactConfirmation> {
  const context = await repositoryContext(changeDirectory);
  const headCommit = await context.repository.getCurrentRevision();
  if (headCommit === null) {
    return { confirmed: false, headCommit };
  }
  return await artifactsMatchCommit(context, headCommit)
    ? { confirmed: true, headCommit }
    : { confirmed: false, headCommit };
}

export async function inspectPlanVersionControl(
  changeDirectory: string,
  baseCommit: string | null
): Promise<PlanVersionControlInspection> {
  const context = await repositoryContext(changeDirectory);
  const headCommit = await context.repository.getCurrentRevision();
  if (baseCommit === null || headCommit === null) {
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
  if (!await artifactsMatchCommit(context, resolvedBase)) {
    return {
      baseCommit,
      headCommit,
      outcome: "artifacts-changed"
    };
  }
  return { evidence, outcome: "measured" };
}

export async function measureGitDistance(
  changeDirectory: string,
  baseCommit: string
): Promise<GitDistanceEvidence | null> {
  const context = await repositoryContext(changeDirectory);
  const [resolvedBase, headCommit] = await Promise.all([
    resolveCommit(context.repository, baseCommit),
    context.repository.getCurrentRevision()
  ]);
  return resolvedBase === null || headCommit === null
    ? null
    : await measureResolvedGitDistance(context, resolvedBase, headCommit);
}

export function classifyGitDistance(
  evidence: GitDistanceEvidence
): GitDistanceAssessment {
  const candidate = (
    evidence.commitCount > 3 && evidence.changedLines > 1000
  ) || evidence.commitCount >= 9 || evidence.changedLines >= 3000;
  return {
    assessment: candidate ? "shelve-candidate" : "current",
    ...evidence
  };
}
