import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { readRecordText } from "../../record-operations/src/source.ts";
import {
  loadCandidateIdentityContext,
  type CandidateIdentityContext
} from "./decision-candidate-discovery.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import {
  decisionIndexState,
  decisionIndexFileName,
  parseDecisionIndex,
  buildDecisionIndexFromSnapshot
} from "./decision-state-index.ts";
import { scanSourceFiles } from "./scan-records.ts";
import type { DecisionId, DecisionIndex, DecisionRecord } from "./types.ts";

export async function maintenanceBaseline(
  directory: string,
  indexPath: string
): Promise<
  Readonly<{ baseline: DecisionIndex; text: string; exists: boolean }>
> {
  let text: string;
  try {
    text = await readRecordText(directory, decisionIndexFileName);
  } catch (error) {
    // Bootstrap is an explicit candidate-only branch; an existing formal collection must recover.
    if (
      !isFileSystemError(error, "ENOENT") &&
      !(
        error instanceof Error &&
        "cause" in error &&
        isFileSystemError(error.cause, "ENOENT")
      )
    )
      throw error;
    await loadCandidateIdentityContext(directory);
    const built = await buildDecisionIndexFromSnapshot({
      metadata: {},
      sourceRevision: decisionSourceRevision([]),
      states: {}
    });
    if (built.status === "error")
      throw new Error(built.diagnostics.map((item) => item.message).join("; "));
    return { baseline: built.value, text: "", exists: false };
  }
  const loaded = parseDecisionIndex(text, indexPath);
  if (loaded.status === "error")
    throw new Error(
      "decision-index.json: " +
        loaded.diagnostics.map((item) => item.message).join("; ") +
        "; restore the sources and run sync-index explicitly."
    );
  return { baseline: loaded.value, text, exists: true };
}

export type MaintenanceSourceContext = Readonly<{
  baseline: DecisionIndex;
  candidateSources: CandidateIdentityContext | null;
  decisionsDirectory: string;
  availableIds: ReadonlySet<DecisionId>;
  indexPath: string;
}>;
export async function readMaintenanceSource(
  id: DecisionId,
  context: MaintenanceSourceContext
): Promise<DecisionRecord> {
  const {
    baseline,
    candidateSources,
    decisionsDirectory,
    availableIds,
    indexPath
  } = context;
  const entry = baseline.entries[id];
  const candidate = candidateSources?.collection.candidateById.get(id);
  const sourcePath = entry?.sourcePath ?? candidate?.sourcePath;
  if (sourcePath === undefined)
    throw new Error("Missing selected Decision source: " + id);
  const decisionPath = path.join(decisionsDirectory, sourcePath);
  await ensureDecisionDirectoryPath(
    decisionsDirectory,
    path.dirname(decisionPath)
  );
  const sourceText =
    candidate?.text ?? (await readRecordText(decisionsDirectory, sourcePath));
  if (decisionIdFromMarkdown(sourceText) !== id)
    throw new Error("Selected Decision identity drift: " + sourcePath);
  const sourceErrors: string[] = [];
  const indexErrors: string[] = [];
  const parsed = await scanSourceFiles({
    availableDecisionIds: availableIds,
    index: baseline,
    indexErrors,
    indexRelativePath: indexPath,
    sourceErrors,
    sourceFiles: [{ decisionId: id, decisionPath, sourcePath, sourceText }]
  });
  if (sourceErrors.length > 0 || indexErrors.length > 0)
    throw new Error([...sourceErrors, ...indexErrors].join("; "));
  const record = parsed[0]!;
  verifyMaintenanceSource(context.baseline, id, record, sourceText);
  return record;
}

function verifyMaintenanceSource(
  baseline: DecisionIndex,
  id: DecisionId,
  record: DecisionRecord,
  sourceText: string
): void {
  const entry = baseline.entries[id];
  if (
    entry !== undefined &&
    (record.document === null ||
      !isDeepStrictEqual(
        decisionIndexState(entry.sourcePath, record.document, id),
        entry
      ) ||
      decisionSourceRevision([
        { decisionId: id, sourcePath: entry.sourcePath, text: sourceText }
      ]).entries[id] !== baseline.sourceRevision.entries[id])
  )
    throw new Error(
      "Selected Decision source differs from published index; run sync-index: " +
        record.sourcePath
    );
}
