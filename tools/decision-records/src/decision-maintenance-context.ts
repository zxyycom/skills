import path from "node:path";
import { decisionTransactionMembers } from "./decision-source-membership.ts";
import { loadCandidateIdentityContext } from "./decision-candidate-discovery.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import { createDecisionNameLookup } from "./decision-record-lookup.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import {
  isDecisionId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import {
  maintenanceBaseline,
  readMaintenanceSource,
  type MaintenanceSourceContext
} from "./decision-maintenance-source.ts";
import type { DecisionLifecycleRequest } from "./decision-lifecycle-service.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionRecord,
  DecisionPreparationContext,
  DecisionScanOptions,
  DecisionSuccessor
} from "./types.ts";

/** Published graph plus selected sources and sources this operation actually rewrites. */
export async function loadDecisionMaintenanceContext(
  options: DecisionScanOptions,
  request: DecisionLifecycleRequest,
  rename = false
): Promise<DecisionPreparationContext> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const decisionsDirectory = path.resolve(
    workspaceRoot,
    options.decisionsDir ?? "docs/decisions"
  );
  await ensureDecisionDirectoryPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const published = await maintenanceBaseline(decisionsDirectory, indexPath);
  const records = await loadMaintenanceRecords(
    request,
    {
      baseline: published.baseline,
      decisionsDirectory,
      indexPath
    },
    rename
  );
  return {
    workspaceRoot,
    decisionsDirectory,
    indexPath,
    indexRelativePath: path
      .relative(workspaceRoot, indexPath)
      .split(path.sep)
      .join("/"),
    indexText: published.text,
    indexExists: published.exists,
    records,
    sourceErrors: [],
    publishedBaseline: published.baseline,
    ...(rename
      ? { sourceMembers: await decisionTransactionMembers(decisionsDirectory) }
      : {})
  };
}

type MaintenanceLocation = Pick<
  MaintenanceSourceContext,
  "baseline" | "decisionsDirectory" | "indexPath"
>;

async function loadMaintenanceRecords(
  request: DecisionLifecycleRequest,
  location: MaintenanceLocation,
  rename: boolean
): Promise<DecisionRecord[]> {
  const selectors = selectedRequestSelectors(request);
  const candidateSources = await maintenanceCandidates(
    request,
    location,
    selectors,
    rename
  );
  const availableIds = new Set([
    ...Object.keys(location.baseline.entries).filter(isDecisionId),
    ...(candidateSources?.collection.candidates
      .map(({ id }) => id)
      .filter(isDecisionId) ?? [])
  ]);
  const sourceContext = { ...location, candidateSources, availableIds };
  const resolve = maintenanceSelectorResolver(availableIds);
  const selected = new Set(selectors.map(resolve));
  if (rename) addRenameReferrers(location.baseline, selected);
  const records: DecisionRecord[] = [];
  await readSelectedMaintenanceSources(selected, records, sourceContext);
  if (request.action === "publish" || request.action === "evolve") {
    addActiveMaintenancePredecessors(request, records, selected, sourceContext);
    await readSelectedMaintenanceSources(selected, records, sourceContext);
  }
  return records;
}

async function maintenanceCandidates(
  request: DecisionLifecycleRequest,
  location: MaintenanceLocation,
  selectors: readonly string[],
  rename: boolean
) {
  const needsCandidate =
    rename ||
    request.action === "publish" ||
    request.action === "evolve" ||
    request.action === "discard";
  if (!needsCandidate) return null;
  return await loadCandidateIdentityContext(
    location.decisionsDirectory,
    selectors.filter(
      (selector) => !location.baseline.entries[selector as DecisionId]
    )
  );
}

function addRenameReferrers(
  baseline: DecisionIndex,
  selected: Set<DecisionId>
): void {
  const source = [...selected][0]!;
  for (const [id, state] of Object.entries(baseline.entries))
    if (
      state.relations.some((relation) => relation.target === source) &&
      isDecisionId(id)
    )
      selected.add(id);
}

async function readSelectedMaintenanceSources(
  selected: ReadonlySet<DecisionId>,
  records: DecisionRecord[],
  context: MaintenanceSourceContext
): Promise<void> {
  for (const id of selected) {
    if (records.some((record) => record.decisionId === id)) continue;
    records.push(await readMaintenanceSource(id, context));
  }
}

/** Only active direct predecessors are rewritten; archived targets remain index-only. */
function addActiveMaintenancePredecessors(
  request: Extract<DecisionLifecycleRequest, { action: "publish" | "evolve" }>,
  records: readonly DecisionRecord[],
  selected: Set<DecisionId>,
  context: MaintenanceSourceContext
): void {
  const resolve = maintenanceSelectorResolver(context.availableIds);
  const successors =
    request.action === "publish"
      ? [{ decisionId: request.decisionId }]
      : request.successors;
  for (const successor of successors) {
    const relations = maintenanceSuccessorRelations(
      request,
      successor,
      records,
      resolve
    );
    for (const relation of relations) {
      const target = resolve(relation.target);
      if (context.baseline.entries[target]?.status === "active")
        selected.add(target);
    }
  }
}

function maintenanceSuccessorRelations(
  request: Extract<DecisionLifecycleRequest, { action: "publish" | "evolve" }>,
  successor: Pick<DecisionSuccessor, "decisionId" | "relationOverride">,
  records: readonly DecisionRecord[],
  resolve: (selector: string) => DecisionId
) {
  const id = resolve(successor.decisionId);
  const record = records.find((record) => record.decisionId === id)!;
  const grouped =
    request.action === "evolve"
      ? request.relationOverrideGroups.find(
          (group) => resolve(group.source) === id
        )?.relationOverride
      : undefined;
  const fallback =
    request.action === "evolve"
      ? request.relationOverride
      : { kind: "source" as const };
  const override = grouped ?? successor.relationOverride ?? fallback;
  return override.kind === "source"
    ? record.projection.relations
    : override.relations;
}

function maintenanceSelectorResolver(ids: ReadonlySet<DecisionId>) {
  const names = createDecisionNameLookup(ids);
  return (raw: string): DecisionId => {
    const selector = normalizeDecisionSelectorInput(raw);
    const dated = parseDatedDecisionId(selector);
    const matches =
      dated === null
        ? (names.get(selector) ?? [])
        : ids.has(dated.id)
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
    return matches[0]!;
  };
}

export function selectedRequestSelectors(
  request: DecisionLifecycleRequest
): string[] {
  if ("decisionId" in request) return [request.decisionId];
  if (request.action === "archive") return [...request.decisionIds];
  if (request.action === "set-relations")
    return request.relationOverrideGroups.map((group) => group.source);
  return [
    ...request.successors.map((successor) => successor.decisionId),
    ...(request.discardId === null ? [] : [request.discardId])
  ];
}
