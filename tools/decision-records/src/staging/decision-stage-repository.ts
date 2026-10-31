import {
  openVersionControl,
  type VersionControlRepository
} from "../../../shared/src/version-control/index.ts";
import { decisionFailure } from "../application-result.ts";
import {
  decisionRepositoryScope,
  versionControlFailure,
  type StageStep
} from "./decision-stage-support.ts";

export type StageRepositoryContext = Readonly<{
  decisionScope: string;
  repository: VersionControlRepository;
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
