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
import { investigationNameFromId } from "./report-path.ts";
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
  InvestigationRenamePlan,
  InvestigationRenameResult,
  PreparedRename,
  RenameSource,
  ResourceMove
} from "./rename-contract.ts";
import {
  compareText,
  countText,
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
  const sources = await loadRenameSources(root, indexPath);
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
        sources.value,
        source.value,
        target.value
      );
}

async function loadRenameSources(
  root: string,
  indexPath: string
): Promise<RenameStep<RenameSource[]>> {
  const layout = await inspectLayout(root, indexPath);
  if ("result" in layout) return layout;
  const formal = await collectValidatedInvestigationCollection(root, {
    allowEmptyCollection: true
  });
  if (formal.errors.length > 0 || formal.snapshot === null)
    return renameStepFailure(indexPath, formal.errors);
  const freshness = await verifyRenameIndexFreshness(root, indexPath, formal);
  if (freshness !== null) return freshness;
  const candidates = await readCandidateSources(
    root,
    layout.value.candidateIds
  );
  if ("result" in candidates) return candidates;
  return {
    value: [
      ...formal.sources.map((source) => asFormalSource(root, source)),
      ...candidates.value
    ].sort((left, right) => compareText(left.id, right.id))
  };
}

async function verifyRenameIndexFreshness(
  root: string,
  indexPath: string,
  formal: Awaited<ReturnType<typeof collectValidatedInvestigationCollection>>
): Promise<RenameStep<never> | null> {
  if (formal.sources.length === 0 || formal.snapshot === null) return null;
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: root,
    mode: "check",
    snapshot: formal.snapshot
  });
  return freshness.status === "error"
    ? renameStepFailure(indexPath, [
        "investigation index is not fresh for the current collection"
      ])
    : null;
}

function noChangePreparation(
  indexPath: string,
  sources: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget
): RenameStep<PreparedRename> {
  return {
    value: {
      indexPath,
      noChange: true,
      nextIndexText: null,
      oldIndexText: null,
      originalSources: sources,
      plan: renamePlan(sources, source, target, sources, false),
      resourceMove: null,
      sourceBefore: source,
      sources,
      targetSource: source
    }
  };
}

async function changedPreparation(
  root: string,
  indexPath: string,
  sources: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget
): Promise<RenameStep<PreparedRename>> {
  const rewritten = rewriteSources(sources, source, target);
  if ("result" in rewritten) return rewritten;
  const resourceMove = await prepareResourceMove(
    root,
    source.id,
    target.id,
    indexPath
  );
  if ("result" in resourceMove) return resourceMove;
  const index = await prepareNextIndex(root, indexPath, rewritten.value);
  if ("result" in index) return index;
  const plan = renamePlan(
    sources,
    source,
    target,
    rewritten.value,
    resourceMove.value !== null
  );
  return {
    value: {
      indexPath,
      noChange: false,
      nextIndexText: index.value.nextIndexText,
      oldIndexText: index.value.oldIndexText,
      originalSources: sources,
      plan,
      resourceMove: resourceMove.value,
      sourceBefore: source,
      sources: rewritten.value,
      targetSource: rewritten.value.find(
        (candidate) => candidate.id === target.id
      )!
    }
  };
}

function renamePlan(
  before: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget,
  after: readonly RenameSource[],
  resourceOwnerMoved: boolean
): InvestigationRenamePlan {
  const identityChanged = source.id !== target.id;
  const relationCounts = identityChanged
    ? before.reduce(
        (counts, current) => {
          const affected = current.document.relations.filter(
            (relation) => relation.target === source.id
          ).length;
          if (current.candidate) counts.candidate += affected;
          else counts.established += affected;
          return counts;
        },
        { candidate: 0, established: 0 }
      )
    : { candidate: 0, established: 0 };
  const resourcePrefix = `./_resources/${source.id}/`;
  const affectedResourceReferenceCount = identityChanged
    ? before.reduce(
        (count, current) =>
          count + countText(current.text, `](${resourcePrefix}`),
        0
      )
    : 0;
  const next = after.find((current) => current.id === target.id)!;
  return {
    affectedCandidateRelationCount: relationCounts.candidate,
    affectedEstablishedRelationCount: relationCounts.established,
    affectedResourceReferenceCount,
    newId: target.id,
    newName: target.name,
    newSourcePath: next.sourcePath,
    oldId: source.id,
    oldName: investigationNameFromId(source.id),
    oldSourcePath: source.sourcePath,
    outcome: "ready",
    resourceOwnerMoved
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
