import {
  openVersionControl,
  type RevisionId,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import {
  decisionRepositoryScope,
  repositoryPath,
  versionControlFailure,
  type StageStep
} from "./decision-stage-support.ts";

export type StageRepositoryContext = Readonly<{
  decisionScope: string;
  repository: VersionControlRepository;
}>;

export type PendingDecisionSnapshot = Readonly<{
  expectedFiles: VersionControlFile[];
  pendingIndexPath: string | null;
  revision: RevisionId | null;
}>;

export async function openStageRepository(
  decisionsDirectory: string
): Promise<StageStep<StageRepositoryContext>> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(decisionsDirectory);
  } catch (error) {
    return versionControlFailure(
      "open the version-controlled decision workspace",
      error
    );
  }
  const decisionScope = decisionRepositoryScope(
    repository.rootDirectory,
    decisionsDirectory
  );
  if (decisionScope === null) {
    return decisionFailure([
      "Decision directory must be inside, and below the root of, its version-controlled " +
        "repository: " +
        decisionsDirectory
    ]);
  }
  return { status: "ok", value: { decisionScope, repository } };
}

export async function inspectPendingDecisionSnapshot(
  repository: VersionControlRepository,
  decisionScope: string,
  scope: "all" | "domain"
): Promise<StageStep<PendingDecisionSnapshot>> {
  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  try {
    const revision = await repository.getCurrentRevision();
    const expectedFiles = await repository.readPendingFiles({
      pathScopes: [decisionScope]
    });
    const changedPaths =
      revision === null
        ? expectedFiles.map((file) => file.path)
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [decisionScope]
          });
    const offending =
      scope === "all"
        ? changedPaths
        : changedPaths.filter((changedPath) => changedPath !== indexPath);
    if (offending.length > 0) {
      return pendingSnapshotConflict(decisionScope);
    }
    return {
      status: "ok",
      value: {
        expectedFiles,
        pendingIndexPath: changedPaths.includes(indexPath) ? indexPath : null,
        revision
      }
    };
  } catch (error) {
    return versionControlFailure(
      "inspect the pending decision snapshot",
      error
    );
  }
}

function pendingSnapshotConflict(
  decisionScope: string
): DecisionApplicationFailure {
  return decisionFailure([
    "Decision pending snapshot already contains files in " +
      decisionScope +
      "; inspect or resolve it before staging another decision set."
  ]);
}
