import { isDeepStrictEqual } from "node:util";
import {
  buildDecisionIndexFromSnapshot,
  buildDecisionStateSnapshotFromSources,
  decisionIndexDiagnosticMessages,
  parseDecisionIndex,
  serializeDecisionIndex
} from "./decision-state-index.ts";
import { validateDecisionBody } from "./record.ts";
import type { DecisionSource } from "./types.ts";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";

export async function buildDecisionIndexText(
  sources: readonly DecisionSource[],
  indexRelativePath: string
): Promise<string> {
  const establishedSources = await selectEstablishedSources(sources);
  if (establishedSources.length === 0) {
    throw new Error("selected source contains no established decision");
  }
  const snapshot =
    await buildDecisionStateSnapshotFromSources(establishedSources);
  const built = await buildDecisionIndexFromSnapshot(snapshot);
  if (built.status === "error") {
    throw new Error(
      decisionIndexDiagnosticMessages(
        built.diagnostics,
        indexRelativePath
      ).join("; ")
    );
  }
  const indexText = serializeDecisionIndex(built.value);
  const parsed = parseDecisionIndex(indexText, indexRelativePath);
  if (parsed.status === "error") {
    throw new Error(
      decisionIndexDiagnosticMessages(
        parsed.diagnostics,
        indexRelativePath
      ).join("; ")
    );
  }
  if (
    !isDeepStrictEqual(parsed.value.sourceRevision, snapshot.sourceRevision) ||
    !sameIds(
      Object.keys(parsed.value.entries),
      establishedSources.map((source) => source.decisionId)
    )
  ) {
    throw new Error(
      "generated index does not match the complete selected decision source"
    );
  }
  return indexText;
}

async function selectEstablishedSources(
  sources: readonly DecisionSource[]
): Promise<DecisionSource[]> {
  const decisionIds = new Set(sources.map((source) => source.decisionId));
  const established: DecisionSource[] = [];
  for (const source of sources) {
    const errors: string[] = [];
    const document = await validateDecisionBody({
      body: source.text,
      decisionId: source.decisionId,
      errors,
      sourcePath: source.sourcePath,
      targetExists: (targetId) => decisionIds.has(targetId)
    });
    if (document === null || errors.length > 0) {
      throw new Error(errors.join("; ") || source.sourcePath + " is invalid");
    }
    if (document.status !== "candidate") {
      established.push(source);
    }
  }
  return established;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort(compareText);
  const orderedRight = [...right].sort(compareText);
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((entry, index) => entry === orderedRight[index])
  );
}

export function compareVersionControlFiles(
  left: VersionControlFile,
  right: VersionControlFile
): number {
  return compareText(left.path, right.path);
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
