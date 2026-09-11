import { decisionNameFromId, parseDatedDecisionId } from "./decision-path.ts";
import { DecisionStageInputError } from "./decision-stage-support.ts";
import {
  readDecisionBaseline,
  readFilesystemDecisionCandidates,
  readFilesystemDecisionSource
} from "./decision-stage-sources.ts";
import { compareText } from "./decision-stage-index.ts";
import type {
  DecisionStageSource,
  DecisionStageTarget,
  DecisionStageTargetOptions,
  FilesystemDecisionCandidates,
  SelectedFilesystemSource
} from "./decision-stage-contracts.ts";
import type { DecisionId } from "./types.ts";

export async function buildDecisionStageTarget(
  options: DecisionStageTargetOptions
): Promise<DecisionStageTarget> {
  const baseline = await readDecisionBaseline({
    decisionsDirectory: options.decisionsDirectory,
    decisionScope: options.decisionScope,
    repository: options.repository,
    revision: options.revision
  });
  const filesystemCandidates = await readFilesystemDecisionCandidates(
    options.decisionsDirectory,
    options.decisionScope
  );
  const selectedIds = resolveSelectedDecisionIds(
    options.selectedSelectors,
    baseline,
    filesystemCandidates
  );
  const selectedOptions = { ...options, selectedIds };
  const sourceById = new Map(
    baseline.map((source) => [source.source.decisionId, source])
  );
  const selectedSources =
    options.revision === null || baseline.length === 0
      ? await mergeFilesystemDecisionSources(
          selectedOptions,
          sourceById,
          filesystemCandidates
        )
      : await mergeSelectedDecisionSources(
          selectedOptions,
          sourceById,
          filesystemCandidates
        );
  const sources = [...sourceById.values()].sort((left, right) =>
    compareText(left.source.decisionId, right.source.decisionId)
  );
  return {
    revision: options.revision,
    selectedIds,
    selectedSources,
    sourceFiles: sources.map((source) => source.file),
    sources: sources.map((source) => source.source)
  };
}

async function mergeFilesystemDecisionSources(
  options: Omit<DecisionStageTargetOptions, "selectedSelectors"> & {
    selectedIds: readonly DecisionId[];
  },
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = options.selectedIds.map((decisionId) => ({
    decisionId,
    source: filesystem.sources.get(decisionId) ?? null
  }));
  for (const selectedSource of selectedSources) {
    if (filesystem.duplicateIds.has(selectedSource.decisionId)) {
      throw duplicateFilesystemDecisionIdError(selectedSource.decisionId);
    }
    if (selectedSource.source === null) {
      throw new DecisionStageInputError(
        "Selected Decision ID does not exist in the filesystem: " +
          selectedSource.decisionId
      );
    }
  }
  for (const selectedSource of selectedSources) {
    if (selectedSource.source !== null) {
      sourceById.set(
        selectedSource.source.source.decisionId,
        selectedSource.source
      );
    }
  }
  return selectedSources;
}

async function mergeSelectedDecisionSources(
  options: Omit<DecisionStageTargetOptions, "selectedSelectors"> & {
    selectedIds: readonly DecisionId[];
  },
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = await Promise.all(
    options.selectedIds.map(async (decisionId) => {
      if (filesystem.duplicateIds.has(decisionId)) {
        throw duplicateFilesystemDecisionIdError(decisionId);
      }
      const current = filesystem.sources.get(decisionId);
      if (current !== undefined) return { decisionId, source: current };
      const baselineSource = sourceById.get(decisionId);
      return {
        decisionId,
        source:
          baselineSource === undefined
            ? null
            : await readFilesystemDecisionSource(
                options.decisionsDirectory,
                options.decisionScope,
                decisionId,
                baselineSource.source.sourcePath
              )
      };
    })
  );
  for (const selectedSource of selectedSources) {
    if (
      selectedSource.source === null &&
      !sourceById.has(selectedSource.decisionId)
    ) {
      throw new DecisionStageInputError(
        "Selected Decision ID does not exist in the revision or filesystem: " +
          selectedSource.decisionId
      );
    }
    if (selectedSource.source === null) {
      sourceById.delete(selectedSource.decisionId);
    } else {
      sourceById.set(selectedSource.decisionId, selectedSource.source);
    }
  }
  return selectedSources;
}

function resolveSelectedDecisionIds(
  selectors: readonly string[],
  baseline: readonly DecisionStageSource[],
  filesystem: FilesystemDecisionCandidates
): DecisionId[] {
  const candidateIds = new Set<DecisionId>([
    ...baseline.map((source) => source.source.decisionId),
    ...filesystem.sources.keys()
  ]);
  const resolved: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  for (const selector of selectors) {
    const parsed = parseDatedDecisionId(selector);
    const decisionId =
      parsed === null
        ? resolveDecisionNameSelector(selector, candidateIds)
        : parsed.id;
    if (seen.has(decisionId)) {
      throw new DecisionStageInputError(
        "Selected Decision selector resolves to a repeated Decision ID: " +
          decisionId
      );
    }
    seen.add(decisionId);
    resolved.push(decisionId);
  }
  return resolved;
}

function duplicateFilesystemDecisionIdError(decisionId: DecisionId): Error {
  return new Error(
    "Decision ID occurs in more than one filesystem source path: " + decisionId
  );
}

function resolveDecisionNameSelector(
  name: string,
  candidateIds: ReadonlySet<DecisionId>
): DecisionId {
  const matches = [...candidateIds]
    .filter((decisionId) => decisionNameFromId(decisionId) === name)
    .sort(compareText);
  if (matches.length === 0) {
    throw new DecisionStageInputError(
      "Selected Decision name does not exist in the revision or filesystem: " +
        name
    );
  }
  if (matches.length > 1) {
    throw new DecisionStageInputError(
      "Selected Decision name is ambiguous: " +
        name +
        " (" +
        matches.join(", ") +
        ")"
    );
  }
  return matches[0]!;
}
