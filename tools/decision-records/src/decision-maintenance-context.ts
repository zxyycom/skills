import type { FilesystemDecisionCandidates } from "./decision-stage-contracts.ts";
import { relatedPublishedDecisionIds } from "./decision-source-dependencies.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { readFilesystemDecisionCandidates } from "./decision-stage-sources.ts";
import { readStageFile } from "./decision-stage-support.ts";
import { createDecisionNameLookup } from "./decision-record-lookup.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import {
  decisionIndexState,
  decisionIndexFileName,
  parseDecisionIndex
} from "./decision-state-index.ts";
import { isDecisionId, parseDatedDecisionId } from "./decision-path.ts";
import { scanSourceFiles } from "./scan-records.ts";
import type { DecisionLifecycleRequest } from "./decision-lifecycle-service.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionRecord,
  DecisionRelationOverride,
  DecisionRelationOverrideGroup,
  DecisionPreparationContext,
  DecisionScanOptions
} from "./types.ts";

export function ordinaryDecisionRequest(
  request: DecisionLifecycleRequest
): boolean {
  return (
    request.action !== "discard" &&
    (request.action !== "evolve" ||
      (request.discardId === null && !request.deleteRecorded))
  );
}

/** Published graph plus an explicitly bounded set of verified current sources. */
export async function loadDecisionMaintenanceContext(
  options: DecisionScanOptions,
  request: DecisionLifecycleRequest
): Promise<DecisionPreparationContext> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const decisionsDirectory = path.resolve(
    workspaceRoot,
    options.decisionsDir ?? "docs/decisions"
  );
  await ensureDecisionDirectoryPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexText = (await readStageFile(indexPath)).toString("utf8");
  const loaded = parseDecisionIndex(indexText, indexPath);
  if (loaded.status === "error")
    throw new Error(
      "decision-index.json: " +
        loaded.diagnostics.map((item) => item.message).join("; ") +
        "; restore the sources and run sync-index explicitly."
    );
  const baseline = loaded.value;
  const candidateSources =
    request.action === "publish" || request.action === "evolve"
      ? await readFilesystemDecisionCandidates(decisionsDirectory, "decisions")
      : null;
  const availableIds = new Set([
    ...Object.keys(baseline.entries).filter(isDecisionId),
    ...(candidateSources?.sources.keys() ?? [])
  ]);
  const names = createDecisionNameLookup(availableIds);
  const selected = new Set<DecisionId>();
  for (const selector of requestSelectors(request)) {
    const dated = parseDatedDecisionId(selector);
    const matches =
      dated === null
        ? (names.get(selector) ?? [])
        : availableIds.has(dated.id)
          ? [dated.id]
          : [];
    if (matches.length !== 1)
      throw new Error(
        (matches.length === 0
          ? "Decision does not exist: "
          : "Decision name is ambiguous: ") +
          selector +
          (matches.length > 1
            ? "; choose one standard ID: " + matches.join(", ")
            : "")
      );
    selected.add(matches[0]!);
  }
  const records: DecisionPreparationContext["records"] = [];
  const sourceErrors: string[] = [];
  const indexErrors: string[] = [];
  const read = new Set<DecisionId>();
  const readSelected = async () => {
    for (const id of selected) {
      if (read.has(id)) continue;
      read.add(id);
      const record = await readMaintenanceSource(id, {
        baseline,
        candidateSources,
        decisionsDirectory,
        availableIds,
        indexPath,
        sourceErrors,
        indexErrors
      });
      records.push(record);
    }
  };
  await readSelected();
  // Direct before/after neighbours, then whole multi-member evolution events.
  const anchors = new Set(selected);
  for (const record of records)
    for (const relation of record.projection.relations)
      anchors.add(relation.target);
  for (const id of relatedPublishedDecisionIds(baseline, anchors))
    selected.add(id);
  await readSelected();
  if (sourceErrors.length > 0 || indexErrors.length > 0)
    throw new Error([...sourceErrors, ...indexErrors].join("; "));
  return {
    workspaceRoot,
    decisionsDirectory,
    indexPath,
    indexRelativePath: path
      .relative(workspaceRoot, indexPath)
      .split(path.sep)
      .join("/"),
    indexText,
    indexExists: true,
    records,
    sourceErrors,
    publishedBaseline: baseline
  };
}

function requestSelectors(request: DecisionLifecycleRequest): string[] {
  if ("decisionId" in request) return [request.decisionId];
  switch (request.action) {
    case "archive":
      return [...request.decisionIds];
    case "set-relations":
      return relationGroupSelectors(request.relationOverrideGroups);
    case "evolve":
      return evolutionSelectors(request);
  }
}
function overrideSelectors(override: DecisionRelationOverride): DecisionId[] {
  return override.kind === "source"
    ? []
    : [
        ...override.relations.map((relation) => relation.target),
        ...(override.relationSummaries ?? []).map((summary) => summary.target)
      ];
}

type MaintenanceSourceContext = Readonly<{
  baseline: DecisionIndex;
  candidateSources: FilesystemDecisionCandidates | null;
  decisionsDirectory: string;
  availableIds: ReadonlySet<DecisionId>;
  indexPath: string;
  sourceErrors: string[];
  indexErrors: string[];
}>;
async function readMaintenanceSource(
  id: DecisionId,
  context: MaintenanceSourceContext
): Promise<DecisionRecord> {
  const {
    baseline,
    candidateSources,
    decisionsDirectory,
    availableIds,
    indexPath,
    sourceErrors,
    indexErrors
  } = context;
  if (candidateSources?.duplicateIds.has(id))
    throw new Error("Duplicate selected Decision identity: " + id);
  const entry = baseline.entries[id];
  const candidate = candidateSources?.sources.get(id)?.source;
  const sourcePath = entry?.sourcePath ?? candidate?.sourcePath;
  if (sourcePath === undefined)
    throw new Error("Missing selected Decision source: " + id);
  const decisionPath = path.join(decisionsDirectory, sourcePath);
  await ensureDecisionDirectoryPath(
    decisionsDirectory,
    path.dirname(decisionPath)
  );
  const sourceText = (await readStageFile(decisionPath)).toString("utf8");
  if (decisionIdFromMarkdown(sourceText) !== id)
    throw new Error("Selected Decision identity drift: " + sourcePath);
  const parsed = await scanSourceFiles({
    availableDecisionIds: availableIds,
    index: baseline,
    indexErrors,
    indexRelativePath: indexPath,
    sourceErrors,
    sourceFiles: [{ decisionId: id, decisionPath, sourcePath, sourceText }]
  });
  const record = parsed[0]!;
  if (sourceErrors.length > 0) throw new Error(sourceErrors.join("; "));
  verifyPublishedMaintenanceSource(baseline, id, record, sourceText);
  return record;
}
function verifyPublishedMaintenanceSource(
  baseline: DecisionIndex,
  id: DecisionId,
  record: DecisionRecord,
  sourceText: string
): void {
  const entry = baseline.entries[id];
  const sourcePath = record.sourcePath;
  if (entry !== undefined) {
    if (
      record.document === null ||
      !isDeepStrictEqual(
        decisionIndexState(entry.sourcePath, record.document, id),
        entry
      ) ||
      decisionSourceRevision([
        { decisionId: id, sourcePath: entry.sourcePath, text: sourceText }
      ]).entries[id] !== baseline.sourceRevision.entries[id]
    ) {
      throw new Error(
        "Selected Decision source differs from published index; run sync-index: " +
          sourcePath
      );
    }
  }
}

function evolutionSelectors(
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>
): string[] {
  const selectors: string[] = [];
  for (const successor of request.successors) {
    selectors.push(successor.decisionId);
    if (successor.relationOverride !== undefined)
      selectors.push(...overrideSelectors(successor.relationOverride));
  }
  selectors.push(...overrideSelectors(request.relationOverride));
  for (const group of request.relationOverrideGroups)
    selectors.push(group.source, ...overrideSelectors(group.relationOverride));
  if (request.discardId !== null) selectors.push(request.discardId);
  return selectors;
}

function relationGroupSelectors(
  groups: readonly DecisionRelationOverrideGroup[]
): string[] {
  const selectors: string[] = [];
  for (const group of groups)
    selectors.push(group.source, ...overrideSelectors(group.relationOverride));
  return selectors;
}
