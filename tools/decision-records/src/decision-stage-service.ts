import { Buffer } from "node:buffer";
import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type RevisionId,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import {
  displayDecisionPath,
  isDecisionId,
  normalizeDecisionSelectorInput
} from "./decision-path.ts";
import {
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";
import type { DecisionId } from "./types.ts";
import { buildDecisionStageTarget } from "./decision-stage-target.ts";
import { verifySelectedFilesystemSources } from "./decision-stage-sources.ts";
import type { DecisionStageTarget } from "./decision-stage-contracts.ts";
import {
  DecisionStageFileSystemError,
  DecisionStageInputError,
  decisionRepositoryScope,
  repositoryPath,
  stageDomainFailure,
  stageFileSystemFailure,
  versionControlFailure
} from "./decision-stage-support.ts";
import {
  buildDecisionIndexText,
  compareVersionControlFiles
} from "./decision-stage-index.ts";

export type DecisionStageSuccess = {
  command: "stage";
  indexRelativePath: string;
  pendingFileCount: number;
  selectedIds: DecisionId[];
  status: "ok";
};

export type DecisionStageResult =
  | DecisionApplicationFailure
  | DecisionStageSuccess;

type StageStep<T> = DecisionApplicationFailure | { status: "ok"; value: T };
type StageRepositoryContext = Readonly<{
  decisionScope: string;
  repository: VersionControlRepository;
}>;
type PendingDecisionSnapshot = Readonly<{
  expectedFiles: VersionControlFile[];
  revision: RevisionId | null;
}>;
type DecisionStageFiles = Readonly<{
  files: VersionControlFile[];
  indexRelativePath: string;
}>;

export async function stageDecisionRecords(options: {
  decisionIds: readonly string[];
  location: DecisionLocation;
}): Promise<DecisionStageResult> {
  const selectedSelectors = validateSelectedSelectors(options.decisionIds);
  if (selectedSelectors.status === "error") return selectedSelectors;
  const location = resolveDecisionLocation(options.location);
  const opened = await openStageRepository(location.decisionsDirectory);
  if (opened.status === "error") return opened;
  return stageAtRepository(location, opened.value, selectedSelectors.value);
}

async function stageAtRepository(
  location: ReturnType<typeof resolveDecisionLocation>,
  opened: StageRepositoryContext,
  selectedSelectors: readonly DecisionId[]
): Promise<DecisionStageResult> {
  const pending = await inspectPendingDecisionSnapshot(
    opened.repository,
    opened.decisionScope
  );
  if (pending.status === "error") return pending;
  const targetResult = await constructDecisionStageTarget({
    decisionsDirectory: location.decisionsDirectory,
    decisionScope: opened.decisionScope,
    repository: opened.repository,
    revision: pending.value.revision,
    selectedSelectors
  });
  if (targetResult.status === "error") return targetResult;
  return stagePreparedTarget(
    location,
    opened,
    pending.value,
    targetResult.value
  );
}

async function stagePreparedTarget(
  location: ReturnType<typeof resolveDecisionLocation>,
  opened: StageRepositoryContext,
  pending: PendingDecisionSnapshot,
  target: DecisionStageTarget
): Promise<DecisionStageResult> {
  if (target.sources.length === 0) {
    return decisionFailure([
      "Selected Decision IDs must produce at least one established decision"
    ]);
  }
  const stagedFiles = await prepareDecisionStageFiles(
    location,
    opened.decisionScope,
    opened.repository,
    target
  );
  if (stagedFiles.status === "error") return stagedFiles;
  const replaced = await replacePendingDecisionFiles(
    opened.repository,
    opened.decisionScope,
    pending.expectedFiles,
    target.revision,
    stagedFiles.value.files
  );
  if (replaced.status === "error") return replaced;
  return {
    command: "stage",
    indexRelativePath: stagedFiles.value.indexRelativePath,
    pendingFileCount: replaced.value,
    selectedIds: target.selectedIds,
    status: "ok"
  };
}

async function openStageRepository(
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

async function inspectPendingDecisionSnapshot(
  repository: VersionControlRepository,
  decisionScope: string
): Promise<StageStep<PendingDecisionSnapshot>> {
  try {
    const revision = await repository.getCurrentRevision();
    const expectedFiles = await repository.readPendingFiles({
      pathScopes: [decisionScope]
    });
    const existingPending =
      revision === null
        ? []
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [decisionScope]
          });
    if (
      existingPending.length > 0 ||
      (revision === null && expectedFiles.length > 0)
    ) {
      return decisionFailure([
        "Decision pending snapshot already contains files in " +
          decisionScope +
          "; inspect or resolve it before staging another decision set."
      ]);
    }
    return { status: "ok", value: { expectedFiles, revision } };
  } catch (error) {
    return versionControlFailure(
      "inspect the pending decision snapshot",
      error
    );
  }
}

async function constructDecisionStageTarget(
  options: Parameters<typeof buildDecisionStageTarget>[0]
): Promise<StageStep<DecisionStageTarget>> {
  try {
    return { status: "ok", value: await buildDecisionStageTarget(options) };
  } catch (error) {
    if (error instanceof DecisionStageInputError) {
      return stageInputFailure([error.message], 2);
    }
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
}

async function prepareDecisionStageFiles(
  location: ReturnType<typeof resolveDecisionLocation>,
  decisionScope: string,
  repository: VersionControlRepository,
  target: DecisionStageTarget
): Promise<StageStep<DecisionStageFiles>> {
  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, decisionIndexFileName)
  );
  try {
    await verifySelectedFilesystemSources(
      location.decisionsDirectory,
      decisionScope,
      target.selectedSources
    );
  } catch (error) {
    if (error instanceof DecisionStageFileSystemError) {
      return stageFileSystemFailure(
        "Failed to verify selected decision filesystem sources before staging.",
        error.cause
      );
    }
    return stageDomainFailure(
      "decision-records.stage-source-changed",
      "Selected decision filesystem source changed before staging.",
      "Selected decision filesystem sources",
      error
    );
  }
  let indexText: string;
  try {
    indexText = await buildDecisionIndexText(target.sources, indexRelativePath);
  } catch (error) {
    return stageDomainFailure(
      "decision-records.stage-index-projection-invalid",
      "The selected decision snapshot cannot produce a derived index.",
      indexRelativePath,
      error
    );
  }
  const files = [
    ...target.sourceFiles,
    { data: Buffer.from(indexText, "utf8"), path: indexPath }
  ].sort(compareVersionControlFiles);
  return { status: "ok", value: { files, indexRelativePath } };
}

async function replacePendingDecisionFiles(
  repository: VersionControlRepository,
  decisionScope: string,
  expectedFiles: readonly VersionControlFile[],
  revision: RevisionId | null,
  files: readonly VersionControlFile[]
): Promise<StageStep<number>> {
  try {
    const replaced = await repository.replacePendingFiles({
      expectedFiles,
      expectedRevision: revision,
      files,
      pathScope: decisionScope
    });
    return { status: "ok", value: replaced.pendingPaths.length };
  } catch (error) {
    return versionControlFailure(
      "replace the pending decision snapshot",
      error
    );
  }
}

function validateSelectedSelectors(
  decisionIds: readonly string[]
): DecisionApplicationFailure | { status: "ok"; value: DecisionId[] } {
  const errors: string[] = [];
  const values: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  if (decisionIds.length === 0) {
    errors.push("stage requires at least one Decision ID");
  }
  for (const value of decisionIds) {
    const decisionId = normalizeDecisionSelectorInput(value);
    if (!isDecisionId(decisionId)) {
      errors.push(
        "Decision selector must be extensionless kebab-case text: " + value
      );
      continue;
    }
    if (seen.has(decisionId)) {
      errors.push("Decision selector must not be repeated: " + decisionId);
      continue;
    }
    seen.add(decisionId);
    values.push(decisionId);
  }
  return errors.length === 0
    ? { status: "ok", value: values }
    : stageInputFailure(errors, 2);
}

function stageInputFailure(
  errors: readonly string[],
  exitCode: 1 | 2 = 1
): DecisionApplicationFailure {
  return decisionFailure(
    errors.map((reason) =>
      decisionDiagnostic({
        code: "decision-records.stage-input-invalid",
        reason,
        recovery:
          "Correct the selected Decision IDs or source state, then retry staging.",
        target: "Decision stage input"
      })
    ),
    { exitCode }
  );
}
