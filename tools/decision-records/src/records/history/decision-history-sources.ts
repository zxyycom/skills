import type { VersionControlRepository } from "../../../../shared/src/version-control/index.ts";
import {
  parseDecisionIndex,
  decisionIndexFileName
} from "../../index/decision-state-index.ts";
import {
  isDecisionId,
  isDecisionSourcePath
} from "../../collection/decision-path.ts";
import { decisionIdFromMarkdown } from "../decision-metadata.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionPreparationContext
} from "../../types.ts";

export async function readDecisionHistoryIndex(
  repository: VersionControlRepository,
  revision: string,
  directoryScope: string
): Promise<DecisionIndex | null> {
  const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
  const indexPath = prefix + decisionIndexFileName;
  const indexFile = await repository.readRevisionFile(revision, indexPath);
  if (indexFile === null) {
    const paths = await revisionDecisionSourcePaths(
      repository,
      revision,
      directoryScope
    );
    if (paths.length > 0)
      throw new DecisionHistoryEvidenceError(
        "Git HEAD Decision index is missing; explicitly recover the historical baseline before changing recorded history."
      );
    return null;
  }
  if (indexFile.kind !== "regular")
    throw new DecisionHistoryEvidenceError(
      "Git HEAD Decision index must be regular: " + indexPath
    );
  const parsed = parseDecisionIndex(
    new TextDecoder("utf-8", { fatal: true }).decode(indexFile.data),
    "Git HEAD " + indexPath
  );
  if (parsed.status === "error")
    throw new DecisionHistoryEvidenceError(
      "Git HEAD Decision index is invalid: " +
        parsed.diagnostics.map((item) => item.message).join("; ")
    );
  return parsed.value;
}

export function historySourcePaths(
  scan: DecisionPreparationContext,
  index: DecisionIndex,
  wanted: ReadonlySet<DecisionId>,
  prefix: string
): Map<string, DecisionId> {
  let selectedById: Map<string, (typeof scan.records)[number]> | undefined;
  return new Map(
    [...wanted].flatMap((id): [string, DecisionId][] => {
      const state = index.entries[id as DecisionId];
      if (state === undefined && selectedById === undefined) {
        selectedById = new Map();
        for (const record of scan.records)
          if (!selectedById.has(record.decisionId))
            selectedById.set(record.decisionId, record);
      }
      const selected = selectedById?.get(id);
      const sourcePath =
        state?.sourcePath ??
        (selected?.source.kind === "candidate"
          ? selected.sourcePath
          : undefined);
      return sourcePath === undefined ? [] : [[prefix + sourcePath, id]];
    })
  );
}

async function revisionDecisionSourcePaths(
  repository: VersionControlRepository,
  revision: string,
  directoryScope: string
): Promise<string[]> {
  const revisionFiles = await repositoryRevisionFiles(
    repository,
    revision,
    directoryScope
  );
  const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
  return revisionFiles.filter((filePath) =>
    isDecisionSourcePath(filePath.slice(prefix.length))
  );
}

async function repositoryRevisionFiles(
  repository: VersionControlRepository,
  revision: string,
  directoryScope: string
): Promise<string[]> {
  return directoryScope.length === 0
    ? repository.listRevisionFiles(revision)
    : repository.listRevisionFiles(revision, { pathScopes: [directoryScope] });
}

export async function revisionDecisionIds(
  repository: VersionControlRepository,
  revision: string,
  sourcePaths: ReadonlyMap<string, DecisionId>
): Promise<Set<DecisionId>> {
  if (sourcePaths.size === 0) return new Set<DecisionId>();
  const files = await repository.readRevisionFiles(revision, {
    pathScopes: [...sourcePaths.keys()]
  });
  return new Set(
    files.map((file) => {
      const expected = sourcePaths.get(file.path);
      const decisionId = decisionIdFromMarkdown(
        new TextDecoder("utf-8", { fatal: true }).decode(file.data)
      );
      if (
        expected === undefined ||
        decisionId !== expected ||
        file.kind === "symlink"
      )
        throw new DecisionHistoryEvidenceError(
          "Git HEAD Decision identity differs from its published index or selected locator: " +
            file.path +
            "; expected " +
            expected
        );
      return decisionId;
    })
  );
}

export function verifyPublishedHistoryIds(
  index: DecisionIndex,
  wanted: ReadonlySet<DecisionId>,
  recordedDecisionIds: ReadonlySet<DecisionId>
): void {
  for (const id of wanted) {
    if (
      isDecisionId(id) &&
      index.entries[id] !== undefined &&
      !recordedDecisionIds.has(id)
    )
      throw new DecisionHistoryEvidenceError(
        "Git HEAD Decision identity differs from its published index: " + id
      );
  }
}

export class DecisionHistoryEvidenceError extends Error {}
