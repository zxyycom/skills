import { Buffer } from "node:buffer";
import type {
  RevisionId,
  VersionControlFile
} from "../../shared/src/version-control/index.ts";
import { changedPendingPaths } from "../../shared/src/version-control/index.ts";
import type { DecisionId } from "./types.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import type { resolveDecisionLocation } from "./decision-query-context.ts";
import {
  buildStageIndexText,
  prepareDecisionStage,
  replacePendingDecisionFiles
} from "./decision-stage-prepare.ts";
import {
  displayIndexRelativePath,
  selectedSourceRelativePaths
} from "./decision-stage-paths.ts";
import {
  repositoryPath,
  versionControlFailure,
  type StageStep
} from "./decision-stage-support.ts";
import type { StageRepositoryContext } from "./decision-stage-repository.ts";
import type { DecisionStageResult } from "./decision-stage-service.ts";

type IndexStageOptions = Readonly<{
  location: ReturnType<typeof resolveDecisionLocation>;
  opened: StageRepositoryContext;
  selectedSelectors: readonly DecisionId[];
}>;

type IndexBaseline = Readonly<{
  expectedFiles: VersionControlFile[];
  revision: RevisionId | null;
}>;

/**
 * Stages only the derived index projection, so the pending index must still
 * match the current revision baseline; any other pending index bytes stop the
 * projection instead of composing an unreviewed state.
 */
export async function stageIndexProjection(
  options: IndexStageOptions
): Promise<DecisionStageResult> {
  const { location, opened } = options;
  const indexPath = repositoryPath(opened.decisionScope, decisionIndexFileName);
  const indexRelativePath = displayIndexRelativePath(location);
  const baseline = await indexScopeBaseline(opened, indexPath);
  if (baseline.status === "error") return baseline;
  const prepared = await prepareDecisionStage(options, baseline.value.revision);
  if (prepared.status === "error") return prepared;
  const indexText = await buildStageIndexText(
    prepared.value.sources,
    indexRelativePath
  );
  if (indexText.status === "error") return indexText;
  const files = [
    { data: Buffer.from(indexText.value, "utf8"), path: indexPath }
  ];
  const replaced = await replacePendingDecisionFiles(
    opened.repository,
    indexPath,
    baseline.value.expectedFiles,
    baseline.value.revision,
    files
  );
  if (replaced.status === "error") return replaced;
  return {
    callerOwnedPaths: selectedSourceRelativePaths(
      location,
      prepared.value.selectedSources
    ),
    command: "stage",
    indexRelativePath,
    pendingFileCount: replaced.value.pendingPaths.length,
    preservedPendingPaths: [],
    scope: "index",
    selectedIds: prepared.value.selectedIds,
    status: "ok",
    writtenPaths:
      changedPendingPaths(baseline.value.expectedFiles, files).length > 0
        ? [indexRelativePath]
        : []
  };
}

async function indexScopeBaseline(
  opened: StageRepositoryContext,
  indexPath: string
): Promise<StageStep<IndexBaseline>> {
  try {
    const revision = await opened.repository.getCurrentRevision();
    const headIndex =
      revision === null
        ? null
        : await opened.repository.readRevisionFile(revision, indexPath);
    const pendingIndexFiles = await opened.repository.readPendingFiles({
      pathScopes: [indexPath]
    });
    const expectedFiles = headIndex === null ? [] : [headIndex];
    if (!samePendingFileSets(pendingIndexFiles, expectedFiles)) {
      return indexBaselineConflict();
    }
    return { status: "ok", value: { expectedFiles, revision } };
  } catch (error) {
    return versionControlFailure("inspect the pending decision index", error);
  }
}

function indexBaselineConflict(): DecisionApplicationFailure {
  return decisionFailure([
    "The pending decision index already differs from the current revision baseline; inspect or resolve it before staging another index projection."
  ]);
}

function samePendingFileSets(
  left: readonly VersionControlFile[],
  right: readonly VersionControlFile[]
): boolean {
  return (
    left.length === right.length &&
    left.every((file) =>
      right.some(
        (candidate) =>
          candidate.path === file.path &&
          Buffer.from(candidate.data).equals(Buffer.from(file.data))
      )
    )
  );
}
