/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-maintenance-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-maintenance-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-maintenance-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
  const availableIds = maintenanceAvailableIds(
    location.baseline,
    candidateSources
  );
  const sourceContext = { ...location, candidateSources, availableIds };
  const resolve = maintenanceSelectorResolver(availableIds);
  const selected = new Set(selectors.map(resolve));
  if (rename) addRenameReferrers(location.baseline, selected);
  const records: DecisionRecord[] = [];
  const recordsById = new Map<string, DecisionRecord>();
  await readSelectedMaintenanceSources(
    selected,
    records,
    recordsById,
    sourceContext
  );
  if (request.action === "publish" || request.action === "evolve") {
    addActiveMaintenancePredecessors(
      request,
      recordsById,
      selected,
      sourceContext
    );
    await readSelectedMaintenanceSources(
      selected,
      records,
      recordsById,
      sourceContext
    );
  }
  return records;
}

function maintenanceAvailableIds(
  baseline: MaintenanceLocation["baseline"],
  candidateSources: Awaited<ReturnType<typeof maintenanceCandidates>>
): Set<DecisionId> {
  return new Set([
    ...Object.keys(baseline.entries).filter(isDecisionId),
    ...(candidateSources?.collection.candidates
      .map(({ id }) => id)
      .filter(isDecisionId) ?? [])
  ]);
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
  recordsById: Map<string, DecisionRecord>,
  context: MaintenanceSourceContext
): Promise<void> {
  for (const id of selected) {
    if (recordsById.has(id)) continue;
    const record = await readMaintenanceSource(id, context);
    records.push(record);
    recordsById.set(record.decisionId, record);
  }
}

/** Only active direct predecessors are rewritten; archived targets remain index-only. */
function addActiveMaintenancePredecessors(
  request: Extract<DecisionLifecycleRequest, { action: "publish" | "evolve" }>,
  records: ReadonlyMap<string, DecisionRecord>,
  selected: Set<DecisionId>,
  context: MaintenanceSourceContext
): void {
  const resolve = maintenanceSelectorResolver(context.availableIds);
  const successors =
    request.action === "publish"
      ? [{ decisionId: request.decisionId }]
      : request.successors;
  const groups =
    request.action === "evolve" ? request.relationOverrideGroups : [];
  const groupsById = new Map<DecisionId, (typeof groups)[number]>();
  let nextGroup = 0;
  const findGroup = (id: DecisionId) => {
    while (!groupsById.has(id) && nextGroup < groups.length) {
      const group = groups[nextGroup++]!;
      const source = resolve(group.source);
      if (!groupsById.has(source)) groupsById.set(source, group);
    }
    return groupsById.get(id);
  };
  for (const successor of successors) {
    const relations = maintenanceSuccessorRelations(
      request,
      successor,
      records,
      resolve,
      findGroup
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
  records: ReadonlyMap<string, DecisionRecord>,
  resolve: (selector: string) => DecisionId,
  findGroup: (
    id: DecisionId
  ) => { relationOverride: DecisionSuccessor["relationOverride"] } | undefined
) {
  const id = resolve(successor.decisionId);
  const record = records.get(id)!;
  const grouped =
    request.action === "evolve" ? findGroup(id)?.relationOverride : undefined;
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
