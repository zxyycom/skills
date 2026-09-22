import { Buffer } from "node:buffer";
import type {
  RevisionId,
  VersionControlFile
} from "../../shared/src/version-control/index.ts";
import { changedPendingPaths } from "../../shared/src/version-control/index.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { compareVersionControlFiles } from "./decision-stage-index.ts";
import type { DecisionId } from "./types.ts";
import type { resolveDecisionLocation } from "./decision-query-context.ts";
import {
  buildStageIndexText,
  prepareDecisionStage,
  replacePendingDecisionFiles,
  type PreparedDecisionStage
} from "./decision-stage-prepare.ts";
import {
  displayIndexRelativePath,
  displayRepositoryRelativePath
} from "./decision-stage-paths.ts";
import {
  repositoryPath,
  versionControlFailure,
  type StageStep
} from "./decision-stage-support.ts";
import {
  inspectPendingDecisionSnapshot,
  type PendingDecisionSnapshot,
  type StageRepositoryContext
} from "./decision-stage-repository.ts";
import type { DecisionStageResult } from "./decision-stage-service.ts";

type WorkspaceStageOptions = Readonly<{
  location: ReturnType<typeof resolveDecisionLocation>;
  opened: StageRepositoryContext;
  selectedSelectors: readonly DecisionId[];
}>;

type WorkspaceStageFiles = Readonly<{
  files: VersionControlFile[];
  indexRelativePath: string;
}>;

/**
 * Stages the `all` or `domain` scope: selected formal Markdown (plus the index
 * projection for `all`) replaces only its own paths while every other pending
 * byte in the decision scope - notably a pending index staged by a previous
 * `index` run - is carried into the replacement target unchanged.
 */
export async function stageWorkspaceSnapshot(
  options: WorkspaceStageOptions,
  scope: "all" | "domain"
): Promise<DecisionStageResult> {
  const { location, opened } = options;
  const pending = await inspectPendingDecisionSnapshot(
    opened.repository,
    opened.decisionScope,
    scope
  );
  if (pending.status === "error") return pending;
  const prepared = await prepareDecisionStage(options, pending.value.revision);
  if (prepared.status === "error") return prepared;
  const stagedFiles = await prepareWorkspaceStageFiles(
    location,
    opened,
    pending.value,
    prepared.value,
    scope
  );
  if (stagedFiles.status === "error") return stagedFiles;
  const replaced = await replacePendingDecisionFiles(
    opened.repository,
    opened.decisionScope,
    pending.value.expectedFiles,
    pending.value.revision,
    stagedFiles.value.files
  );
  if (replaced.status === "error") return replaced;
  return workspaceStageResult({
    location,
    opened,
    pending: pending.value,
    prepared: prepared.value,
    replaced: replaced.value,
    scope,
    stagedFiles: stagedFiles.value
  });
}

function workspaceStageResult(args: {
  location: WorkspaceStageOptions["location"];
  opened: StageRepositoryContext;
  pending: PendingDecisionSnapshot;
  prepared: PreparedDecisionStage;
  replaced: { pendingPaths: string[] };
  scope: "all" | "domain";
  stagedFiles: WorkspaceStageFiles;
}): DecisionStageResult {
  const writtenPaths = changedPendingPaths(
    args.pending.expectedFiles,
    args.stagedFiles.files
  ).map((repositoryFilePath) =>
    displayRepositoryRelativePath(
      args.location,
      args.opened.decisionScope,
      repositoryFilePath
    )
  );
  const preservedPendingPaths =
    args.scope === "domain" && args.pending.pendingIndexPath !== null
      ? [args.stagedFiles.indexRelativePath]
      : [];
  return {
    callerOwnedPaths:
      args.scope === "domain" ? [args.stagedFiles.indexRelativePath] : [],
    command: "stage",
    indexRelativePath: args.stagedFiles.indexRelativePath,
    pendingFileCount: args.replaced.pendingPaths.length,
    preservedPendingPaths,
    scope: args.scope,
    selectedIds: args.prepared.selectedIds,
    status: "ok",
    writtenPaths
  };
}

async function prepareWorkspaceStageFiles(
  location: WorkspaceStageOptions["location"],
  opened: StageRepositoryContext,
  pending: PendingDecisionSnapshot,
  prepared: PreparedDecisionStage,
  scope: "all" | "domain"
): Promise<StageStep<WorkspaceStageFiles>> {
  const indexRelativePath = displayIndexRelativePath(location);
  const files = [...prepared.sourceFiles];
  if (scope === "all") {
    const indexText = await buildStageIndexText(
      prepared.sources,
      indexRelativePath
    );
    if (indexText.status === "error") return indexText;
    files.push({
      data: Buffer.from(indexText.value, "utf8"),
      path: repositoryPath(opened.decisionScope, decisionIndexFileName)
    });
  } else {
    const preservedIndex = await preservedPendingIndexFile(opened, pending);
    if (preservedIndex.status === "error") return preservedIndex;
    if (preservedIndex.value !== null) files.push(preservedIndex.value);
  }
  return {
    status: "ok",
    value: {
      files: files.sort(compareVersionControlFiles),
      indexRelativePath
    }
  };
}

/**
 * Keeps the pending index inside the replacement target when it is not part
 * of the selected domain write: already staged index bytes win, and otherwise
 * the revision baseline index is carried forward so the replacement does not
 * silently drop the derived index from the pending snapshot.
 */
async function preservedPendingIndexFile(
  opened: StageRepositoryContext,
  pending: PendingDecisionSnapshot
): Promise<StageStep<VersionControlFile | null>> {
  const indexPath = repositoryPath(opened.decisionScope, decisionIndexFileName);
  const pendingIndex = pending.expectedFiles.find(
    (file) => file.path === indexPath
  );
  if (pendingIndex !== undefined) {
    return { status: "ok", value: pendingIndex };
  }
  if (pending.revision === null) {
    return { status: "ok", value: null };
  }
  return await revisionBaselineIndex(opened, pending.revision, indexPath);
}

async function revisionBaselineIndex(
  opened: StageRepositoryContext,
  revision: RevisionId,
  indexPath: string
): Promise<StageStep<VersionControlFile | null>> {
  try {
    return {
      status: "ok",
      value: await opened.repository.readRevisionFile(revision, indexPath)
    };
  } catch (error) {
    return versionControlFailure(
      "read the revision decision index baseline",
      error
    );
  }
}
