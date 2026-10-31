import { discoverInvestigationCandidates } from "../../candidates/candidate-discovery.ts";
import { readLocalPublication } from "../../publication/local-publication.ts";
import { validatePublishedDependency } from "../../publication/preparation/published-preparation.ts";
import { resolveInvestigationSelector } from "../../collection/investigation-selector.ts";
import { investigationNameFromId } from "../../collection/report-path.ts";
import { parseInvestigationReport } from "../../records/markdown.ts";
import { InvestigationPreparation } from "../../transactions/strict-preparation.ts";
import { prepareLocalNoOp } from "../rename-noop.ts";
import {
  noChangePreparation,
  changedRenamePreparation
} from "./rename-plan.ts";
import path from "node:path";

import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../../../shared/src/version-control/index.ts";
import { investigationIndexFileName } from "../../index/investigation-state-index.ts";
import { investigationResourcesDirectoryName } from "../../resources/resource-reference.ts";
import { prepareResourceMove } from "../resources/rename-resource.ts";
import { prepareNextIndex } from "../rename-index-projection.ts";
import {
  asFormalSource,
  isNoOpRename,
  resolveRenameTarget,
  rewriteSources,
  type RenameTarget
} from "./rename-preparation-source.ts";
import type {
  InvestigationRenameOptions,
  InvestigationRenameResult,
  PreparedRename,
  RenameSource,
  ResourceMove
} from "../rename-contract.ts";
import {
  errorText,
  renameFailure,
  renameMutation,
  renameStepFailure,
  type RenameStep
} from "../rename-support.ts";

export async function prepareRename(
  root: string,
  indexPath: string,
  options: InvestigationRenameOptions
): Promise<RenameStep<PreparedRename>> {
  const noOp = await prepareLocalNoOp(root, indexPath, options);
  if (noOp !== null) return noOp;
  const preparation = new InvestigationPreparation(root);
  try {
    const loaded = await loadRenameSources(
      root,
      indexPath,
      options.source,
      preparation
    );
    if ("result" in loaded) return loaded;
    const { source, sources, identities } = loaded.value;
    const target = resolveRenameTarget(
      source,
      identities,
      options.target,
      indexPath
    );
    if ("result" in target) return target;
    return isNoOpRename(source, target.value)
      ? noChangePreparation(indexPath, sources, source, target.value)
      : await changedPreparation(
          root,
          indexPath,
          { sources, preparation },
          source,
          target.value
        );
  } catch (error) {
    return renameStepFailure(indexPath, [errorText(error)]);
  }
}

async function loadRenameSources(
  root: string,
  indexPath: string,
  selector: string,
  preparation: InvestigationPreparation
): Promise<
  RenameStep<
    Readonly<{
      source: RenameSource;
      sources: readonly RenameSource[];
      identities: readonly Pick<RenameSource, "id" | "sourcePath">[];
    }>
  >
> {
  const discovered = await discoverInvestigationCandidates(root);
  const identities = [...discovered.candidateCollection.identityById.values()];
  const selected = resolveInvestigationSelector(
    identities.map((entry) => ({
      ...entry,
      name: investigationNameFromId(entry.id)
    })),
    selector
  );
  if (selected.status === "error")
    return renameStepFailure(indexPath, selected.errors);
  const identity = discovered.candidateCollection.identityById.get(
    selected.id
  )!;
  const candidate = discovered.candidateCollection.candidateById.get(
    selected.id
  );
  const loaded =
    candidate === undefined
      ? {
          value: await loadFormalRenameSources(root, selected.id, preparation)
        }
      : await loadCandidateRenameSource(
          root,
          indexPath,
          candidate,
          preparation
        );
  if ("result" in loaded) return loaded;
  const sources = loaded.value;
  const source = sources.find((entry) => entry.id === identity.id)!;
  return { value: { source, sources, identities } };
}

async function loadCandidateRenameSource(
  root: string,
  indexPath: string,
  candidate: Pick<RenameSource, "id" | "sourcePath">,
  preparation: InvestigationPreparation
): Promise<RenameStep<RenameSource[]>> {
  const text = await preparation.read(path.join(root, candidate.sourcePath));
  const parsed = parseInvestigationReport(text, candidate.id, {
    allowEmptyCoreSections: true
  });
  if (parsed.report === null || parsed.frontmatterErrors.length > 0)
    return renameStepFailure(indexPath, parsed.frontmatterErrors);
  return {
    value: [
      {
        ...candidate,
        text,
        filePath: path.join(root, candidate.sourcePath),
        candidate: true,
        parsed,
        document: parsed.report
      }
    ]
  };
}

async function loadFormalRenameSources(
  root: string,
  selectedId: string,
  preparation: InvestigationPreparation
): Promise<RenameSource[]> {
  const baseline = await readLocalPublication(root, [], preparation);
  const affected = [...baseline.states].filter(
    ([id, state]) =>
      id === selectedId ||
      state.relations.some((relation) => relation.target === selectedId) ||
      state.resourceIds.some((resource) =>
        resource.startsWith(selectedId + "/")
      )
  );
  const sources: RenameSource[] = [];
  for (const [id, state] of affected) {
    const source = {
      id,
      sourcePath: state.sourcePath,
      text: await preparation.read(path.join(root, state.sourcePath))
    };
    validatePublishedDependency(baseline.index, state, source);
    sources.push(
      asFormalSource(root, source, preparation.parsed(source), state)
    );
  }
  return sources;
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
    preparation,
    source.id === target.id ? undefined : source.id
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
