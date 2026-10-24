import { InvestigationPreparation } from "./strict-preparation.ts";
import { prepareLocalNoOp } from "./rename-noop.ts";
import {
  noChangePreparation,
  changedRenamePreparation
} from "./rename-plan.ts";
import path from "node:path";

import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import {
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { prepareResourceMove } from "./rename-resource.ts";
import { prepareNextIndex } from "./rename-index-projection.ts";
import {
  asFormalSource,
  inspectLayout,
  isNoOpRename,
  readCandidateSources,
  resolveRenameSource,
  resolveRenameTarget,
  rewriteSources,
  type RenameTarget
} from "./rename-preparation-source.ts";
export {
  asFormalSource,
  inspectLayout,
  readCandidateSources
} from "./rename-preparation-source.ts";
import type {
  InvestigationRenameOptions,
  InvestigationRenameResult,
  PreparedRename,
  RenameSource,
  ResourceMove
} from "./rename-contract.ts";
import {
  compareText,
  errorText,
  renameFailure,
  renameMutation,
  renameStepFailure,
  type RenameStep
} from "./rename-support.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";

export async function prepareRename(
  root: string,
  indexPath: string,
  options: InvestigationRenameOptions
): Promise<RenameStep<PreparedRename>> {
  const noOp = await prepareLocalNoOp(root, indexPath, options);
  if (noOp !== null) return noOp;
  const preparation = new InvestigationPreparation(root);
  const sources = await loadRenameSources(root, indexPath, preparation);
  if ("result" in sources) return sources;
  const source = resolveRenameSource(sources.value, options.source, indexPath);
  if ("result" in source) return source;
  const target = resolveRenameTarget(
    source.value,
    sources.value,
    options.target,
    indexPath
  );
  if ("result" in target) return target;
  return isNoOpRename(source.value, target.value)
    ? noChangePreparation(indexPath, sources.value, source.value, target.value)
    : await changedPreparation(
        root,
        indexPath,
        { sources: sources.value, preparation },
        source.value,
        target.value
      );
}

async function loadRenameSources(
  root: string,
  indexPath: string,
  preparation: InvestigationPreparation
): Promise<RenameStep<RenameSource[]>> {
  const layout = await inspectLayout(root, indexPath, preparation);
  if ("result" in layout) return layout;
  const formal = await collectValidatedInvestigationCollection(root, {
    allowEmptyCollection: true,
    layout: layout.value,
    preparation
  });
  if (formal.errors.length > 0 || formal.snapshot === null)
    return renameStepFailure(indexPath, formal.errors);
  const freshness = await verifyRenameIndexFreshness(root, indexPath, formal);
  if (freshness !== null) return freshness;
  const candidates = await readCandidateSources(
    root,
    layout.value.candidateIds,
    { layout: layout.value, preparation }
  );
  if ("result" in candidates) return candidates;
  return {
    value: [
      ...formal.sources.map((source) =>
        asFormalSource(
          root,
          source,
          preparation.parsed(source),
          formal.states.get(source.id)
        )
      ),
      ...candidates.value
    ].sort((left, right) => compareText(left.id, right.id))
  };
}

async function verifyRenameIndexFreshness(
  root: string,
  indexPath: string,
  formal: Awaited<ReturnType<typeof collectValidatedInvestigationCollection>>
): Promise<RenameStep<never> | null> {
  if (formal.snapshot === null) return null;
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: root,
    mode: "check",
    snapshot: formal.snapshot
  });
  return freshness.status === "error" &&
    !(formal.sources.length === 0 && freshness.state === "index-missing")
    ? renameStepFailure(indexPath, [
        "investigation index is not fresh for the current collection"
      ])
    : null;
}

type RenamePreparationCollection = Readonly<{
  sources: readonly RenameSource[];
  preparation: InvestigationPreparation;
}>;

async function changedPreparation(
  root: string,
  indexPath: string,
  collection: RenamePreparationCollection,
  source: RenameSource,
  target: RenameTarget
): Promise<RenameStep<PreparedRename>> {
  const { sources, preparation } = collection;
  const rewritten = rewriteSources(sources, source, target);
  if ("result" in rewritten) return rewritten;
  const resourceMove = await prepareResourceMove(
    root,
    source.id,
    target.id,
    indexPath
  );
  if ("result" in resourceMove) return resourceMove;
  const index = await prepareNextIndex(
    root,
    indexPath,
    rewritten.value,
    preparation
  );
  if ("result" in index) return index;
  return {
    value: changedRenamePreparation({
      indexPath,
      preparation,
      sources,
      source,
      target,
      rewritten: rewritten.value,
      resourceMove: resourceMove.value,
      index: index.value
    })
  };
}

export async function recordedRenameConfirmation(
  root: string,
  source: RenameSource,
  resourceMove: ResourceMove | null,
  options: InvestigationRenameOptions
): Promise<InvestigationRenameResult | null> {
  const recorded = await hasRecordedRenameSource(root, source, resourceMove);
  if (recorded.errors.length > 0) {
    return renameFailure(
      path.join(root, investigationIndexFileName),
      null,
      recorded.errors,
      renameMutation("no-change")
    );
  }
  const confirmed = source.candidate
    ? options.renameRecordedCandidate === true
    : options.renameRecordedReport === true;
  if (!recorded.recorded || confirmed) return null;
  const noun = source.candidate ? "candidate" : "report";
  const flag = source.candidate
    ? "--rename-recorded-candidate"
    : "--rename-recorded-report";
  return {
    ...renameFailure(
      path.join(root, investigationIndexFileName),
      null,
      [
        `Investigation ${noun} ${source.id} has entered Git HEAD; confirm that its recorded identity should be renamed.`,
        `Re-run with ${flag} only after confirming this working-tree rename; Git history is not rewritten.`
      ],
      renameMutation("no-change")
    ),
    status: "attention"
  };
}

async function hasRecordedRenameSource(
  root: string,
  source: RenameSource,
  resourceMove: ResourceMove | null
): Promise<Readonly<{ errors: string[]; recorded: boolean }>> {
  try {
    const repository = await openVersionControl(root);
    const revision = await repository.getCurrentRevision();
    if (revision === null) return { errors: [], recorded: false };
    const files = await repository.listRevisionFiles(revision, {
      pathScopes: renameRevisionPaths(
        repository.rootDirectory,
        root,
        source,
        resourceMove
      )
    });
    return { errors: [], recorded: files.length > 0 };
  } catch (error) {
    return recordedRenameFailure(error);
  }
}

function renameRevisionPaths(
  repositoryRoot: string,
  root: string,
  source: RenameSource,
  resourceMove: ResourceMove | null
): string[] {
  const scope =
    path.resolve(root) === repositoryRoot
      ? ""
      : repositoryRelativePathFromFileSystemPath(repositoryRoot, root);
  return [
    scopedRenamePath(scope, source.sourcePath),
    ...(resourceMove === null
      ? []
      : [
          scopedRenamePath(
            scope,
            `${investigationResourcesDirectoryName}/${path.basename(resourceMove.from)}`
          )
        ])
  ];
}

function scopedRenamePath(scope: string, relativePath: string): string {
  return scope.length === 0 ? relativePath : `${scope}/${relativePath}`;
}

function recordedRenameFailure(
  error: unknown
): Readonly<{ errors: string[]; recorded: boolean }> {
  if (error instanceof VersionControlError && error.code === "not-repository")
    return { errors: [], recorded: false };
  return {
    errors: [
      "Git HEAD could not be inspected before Investigation rename: " +
        errorText(error)
    ],
    recorded: false
  };
}
