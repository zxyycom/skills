/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-target.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-target.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-target.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { createDecisionNameLookup } from "./decision-record-lookup.ts";
import { parseDatedDecisionId } from "./decision-path.ts";
import { DecisionStageInputError } from "./decision-stage-support.ts";
import {
  readDecisionBaseline,
  readFilesystemDecisionCandidates,
  resolveFilesystemDecisionSource
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
  return await decisionStageTargetFromSources({
    baseline,
    filesystemCandidates,
    selectedSelectors: options.selectedSelectors,
    revision: options.revision
  });
}

export async function decisionStageTargetFromSources(options: {
  baseline: readonly DecisionStageSource[];
  filesystemCandidates: FilesystemDecisionCandidates;
  selectedSelectors: readonly string[];
  revision: DecisionStageTarget["revision"];
}): Promise<DecisionStageTarget> {
  const { baseline, filesystemCandidates } = options;
  const selectedIds = resolveSelectedDecisionIds(
    options.selectedSelectors,
    baseline,
    filesystemCandidates
  );
  const sourceById = new Map(
    baseline.map((source) => [source.source.decisionId, source])
  );
  const selectedSources =
    options.revision === null || baseline.length === 0
      ? await mergeFilesystemDecisionSources(
          selectedIds,
          sourceById,
          filesystemCandidates
        )
      : await mergeSelectedDecisionSources(
          selectedIds,
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
  selectedIds: readonly DecisionId[],
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = selectedIds.map((decisionId) => ({
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
  selectedIds: readonly DecisionId[],
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = await Promise.all(
    selectedIds.map(async (decisionId) => {
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
            : resolveFilesystemDecisionSource(
                filesystem,
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

export function resolveSelectedDecisionIds(
  selectors: readonly string[],
  baseline: readonly DecisionStageSource[],
  filesystem: FilesystemDecisionCandidates
): DecisionId[] {
  const candidateIds = new Set<DecisionId>([
    ...baseline.map((source) => source.source.decisionId),
    ...filesystem.sources.keys()
  ]);
  let names: ReadonlyMap<string, readonly DecisionId[]> | undefined;
  const resolved: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  for (const selector of selectors) {
    const parsed = parseDatedDecisionId(selector);
    const decisionId =
      parsed === null
        ? resolveDecisionNameSelector(
            selector,
            (names ??= createDecisionNameLookup(candidateIds))
          )
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
  names: ReadonlyMap<string, readonly DecisionId[]>
): DecisionId {
  const matches = names.get(name) ?? [];
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
