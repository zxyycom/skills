import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { VersionControlError } from "../../shared/src/version-control/index.ts";
import { buildDecisionIndexText } from "./decision-stage-index.ts";
import { buildDecisionStageTarget } from "./decision-stage-target.ts";
import { verifySelectedFilesystemSources } from "./decision-stage-sources.ts";
import type {
  DecisionStageTarget,
  SelectedFilesystemSource
} from "./decision-stage-contracts.ts";
import type { DecisionId, DecisionSource } from "./types.ts";
import {
  DecisionStageFileSystemError,
  DecisionStageInputError,
  stageDomainFailure,
  stageFileSystemFailure,
  stageInputFailure,
  versionControlFailure,
  type StageStep
} from "./decision-stage-support.ts";
import type { resolveDecisionLocation } from "./decision-query-context.ts";

export type PreparedDecisionStage = Readonly<{
  selectedIds: DecisionId[];
  selectedSources: readonly SelectedFilesystemSource[];
  sourceFiles: readonly VersionControlFile[];
  sources: readonly DecisionSource[];
}>;

type StageOptions = Readonly<{
  location: ReturnType<typeof resolveDecisionLocation>;
  opened: { decisionScope: string; repository: VersionControlRepository };
  selectedSelectors: readonly DecisionId[];
}>;

/**
 * Builds the selected decision target for one revision and verifies the
 * selected filesystem sources immediately before any pending replacement.
 */
export async function prepareDecisionStage(
  options: StageOptions,
  revision: RevisionId | null
): Promise<StageStep<PreparedDecisionStage>> {
  const target = await selectedDecisionTarget(options, revision);
  if (target.status === "error") return target;
  const verified = await verifiedSelectedSources(options, target.value);
  if (verified.status === "error") return verified;
  return {
    status: "ok",
    value: {
      selectedIds: target.value.selectedIds,
      selectedSources: target.value.selectedSources,
      sourceFiles: target.value.sourceFiles,
      sources: target.value.sources
    }
  };
}

async function selectedDecisionTarget(
  options: StageOptions,
  revision: RevisionId | null
): Promise<StageStep<DecisionStageTarget>> {
  return await constructDecisionStageTarget({
    decisionsDirectory: options.location.decisionsDirectory,
    decisionScope: options.opened.decisionScope,
    repository: options.opened.repository,
    revision,
    selectedSelectors: options.selectedSelectors
  });
}

async function verifiedSelectedSources(
  options: StageOptions,
  target: DecisionStageTarget
): Promise<StageStep<true>> {
  try {
    await verifySelectedFilesystemSources(
      options.location.decisionsDirectory,
      options.opened.decisionScope,
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
  return { status: "ok", value: true };
}

export async function constructDecisionStageTarget(
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

export async function replacePendingDecisionFiles(
  repository: VersionControlRepository,
  pathScope: string,
  expectedFiles: readonly VersionControlFile[],
  revision: RevisionId | null,
  files: readonly VersionControlFile[]
): Promise<StageStep<{ pendingPaths: string[] }>> {
  try {
    const replaced = await repository.replacePendingFiles({
      expectedFiles,
      expectedRevision: revision,
      files,
      pathScope
    });
    return { status: "ok", value: { pendingPaths: replaced.pendingPaths } };
  } catch (error) {
    return versionControlFailure(
      "replace the pending decision snapshot",
      error
    );
  }
}

export async function buildStageIndexText(
  sources: readonly DecisionSource[],
  indexRelativePath: string
): Promise<StageStep<string>> {
  try {
    return {
      status: "ok",
      value: await buildDecisionIndexText(sources, indexRelativePath)
    };
  } catch (error) {
    return stageDomainFailure(
      "decision-records.stage-index-projection-invalid",
      "The selected decision snapshot cannot produce a derived index.",
      indexRelativePath,
      error
    );
  }
}
