/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-relation-filter.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-relation-filter.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-relation-filter.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionRelationRecordSnapshot,
  type DecisionRelationRecordSnapshot
} from "./decision-query-records.ts";
import type { DecisionRelationEdge } from "./relation-graph.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionNameFromId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import type {
  DecisionFilteredRecord,
  DecisionFilterRelation,
  DecisionQueryRequest,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import type { DecisionId, DecisionRelation } from "./types.ts";

type RelationFilterRequest = Pick<
  Extract<DecisionQueryRequest, { command: "list" | "search" }>,
  "direction" | "relatedTo" | "relationType"
>;

type DecisionRelationFilter = Readonly<{
  relatedTo?: DecisionId;
  decisionIds: ReadonlySet<DecisionId> | null;
  relationsByDecisionId: ReadonlyMap<
    DecisionId,
    readonly DecisionFilterRelation[]
  >;
}>;

export function filterDecisionRelationRecords(
  source: readonly IndexedDecisionRecord[] | DecisionRelationRecordSnapshot,
  request: RelationFilterRequest
):
  | { records: DecisionFilteredRecord[]; relatedTo?: DecisionId; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const snapshot = decisionRelationRecordSnapshot(source);
  const filtered = resolveDecisionRelationFilter(snapshot, request);
  if (filtered.status === "error") return filtered;
  return {
    ...(filtered.value.relatedTo === undefined
      ? {}
      : { relatedTo: filtered.value.relatedTo }),
    records: snapshot.records.flatMap((record) => {
      if (
        filtered.value.decisionIds !== null &&
        !filtered.value.decisionIds.has(record.decisionId)
      ) {
        return [];
      }
      const filterRelations = filtered.value.relationsByDecisionId.get(
        record.decisionId
      );
      return [
        filterRelations === undefined ? record : { ...record, filterRelations }
      ];
    }),
    status: "ok"
  };
}

export function resolveDecisionRelationFilter(
  source: readonly IndexedDecisionRecord[] | DecisionRelationRecordSnapshot,
  request: RelationFilterRequest
):
  | { status: "ok"; value: DecisionRelationFilter }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const snapshot = decisionRelationRecordSnapshot(source);
  if (request.relatedTo === undefined)
    return relationFilterWithoutTarget(snapshot, request);
  const target = resolveDecisionSelectorInRecords(
    snapshot.records,
    request.relatedTo,
    "Related decision"
  );
  if (target.status === "error") return target;
  const errors = snapshot.relationErrors?.() ?? [];
  if (errors.length > 0)
    return { status: "error", failure: decisionFailure(errors) };
  const graph = snapshot.getRelationGraph();
  const relationsByDecisionId = collectRelatedEdges(
    graph,
    target.record.decisionId,
    request
  );
  return {
    status: "ok",
    value: {
      ...relationFilterFromMap(relationsByDecisionId),
      relatedTo: target.record.decisionId
    }
  };
}

function collectRelatedEdges(
  graph: ReturnType<DecisionRelationRecordSnapshot["getRelationGraph"]>,
  target: DecisionId,
  request: RelationFilterRequest
) {
  const relationsByDecisionId = new Map<DecisionId, DecisionFilterRelation[]>();
  const direction = request.direction ?? "both";
  if (direction !== "successors")
    appendRelatedEdges(
      relationsByDecisionId,
      graph.edgesBySource.get(target) ?? [],
      request,
      "target"
    );
  if (direction !== "predecessors")
    appendRelatedEdges(
      relationsByDecisionId,
      graph.edgesByTarget.get(target) ?? [],
      request,
      "source"
    );
  return relationsByDecisionId;
}

function appendRelatedEdges(
  result: Map<DecisionId, DecisionFilterRelation[]>,
  edges: readonly DecisionRelationEdge[],
  request: RelationFilterRequest,
  neighbor: "source" | "target"
): void {
  for (const relation of edges)
    if (relationMatches(relation, request))
      addRelation(result, relation[neighbor], filterRelation(relation));
}

function relationFilterWithoutTarget(
  snapshot: DecisionRelationRecordSnapshot,
  request: RelationFilterRequest
):
  | { status: "ok"; value: DecisionRelationFilter }
  | { failure: DecisionApplicationFailure; status: "error" } {
  if (request.direction !== undefined) {
    return {
      failure: decisionFailure([
        decisionDiagnostic({
          code: "decision-records.related-direction-without-target",
          reason: "Relation direction requires a related Decision selector.",
          recovery:
            "Provide --related-to with --direction, or omit --direction.",
          target: "direction"
        })
      ]),
      status: "error"
    };
  }
  if (request.relationType === undefined)
    return { status: "ok", value: emptyRelationFilter() };
  const errors = snapshot.relationErrors?.() ?? [];
  if (errors.length > 0)
    return { status: "error", failure: decisionFailure(errors) };
  const relationsByDecisionId = new Map<DecisionId, DecisionFilterRelation[]>();
  for (const edges of snapshot.getRelationGraph().edgesBySource.values()) {
    for (const relation of edges) {
      if (relation.type === request.relationType) {
        addRelation(
          relationsByDecisionId,
          relation.source,
          filterRelation(relation)
        );
      }
    }
  }
  return { status: "ok", value: relationFilterFromMap(relationsByDecisionId) };
}

function emptyRelationFilter(): DecisionRelationFilter {
  return { decisionIds: null, relationsByDecisionId: new Map() };
}

function filterRelation(
  relation: DecisionRelationEdge
): DecisionFilterRelation {
  return {
    sourceId: relation.source,
    ...(relation.summary === undefined ? {} : { summary: relation.summary }),
    target: relation.target,
    type: relation.type
  };
}

function addRelation(
  relationsByDecisionId: Map<DecisionId, DecisionFilterRelation[]>,
  decisionId: DecisionId,
  relation: DecisionFilterRelation
): void {
  const relations = relationsByDecisionId.get(decisionId);
  if (relations === undefined)
    relationsByDecisionId.set(decisionId, [relation]);
  else relations.push(relation);
}

function relationFilterFromMap(
  relationsByDecisionId: ReadonlyMap<
    DecisionId,
    readonly DecisionFilterRelation[]
  >
): DecisionRelationFilter {
  const sorted = new Map(
    [...relationsByDecisionId].map(([decisionId, relations]) => {
      const unique = new Map(
        relations.map((relation) => [
          `${relation.sourceId}\u0000${relation.type}\u0000${relation.target}`,
          relation
        ])
      );
      return [
        decisionId,
        [...unique.values()].sort(compareFilterRelations)
      ] as const;
    })
  );
  return { decisionIds: new Set(sorted.keys()), relationsByDecisionId: sorted };
}

function compareFilterRelations(
  left: DecisionFilterRelation,
  right: DecisionFilterRelation
): number {
  return (
    compareText(left.sourceId, right.sourceId) ||
    compareText(left.type, right.type) ||
    compareText(left.target, right.target)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relationMatches(
  relation: Pick<DecisionRelation, "type">,
  request: RelationFilterRequest
): boolean {
  return (
    request.relationType === undefined || relation.type === request.relationType
  );
}

function resolveDecisionSelectorInRecords(
  records: readonly IndexedDecisionRecord[],
  selector: string,
  label: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  if (dated !== null) {
    const record = records.find(
      (candidate) => candidate.decisionId === dated.id
    );
    return record === undefined
      ? { failure: selectorNotFound(label, normalized), status: "error" }
      : { record, status: "ok" };
  }
  const matches = records.filter(
    (candidate) => decisionNameFromId(candidate.decisionId) === normalized
  );
  if (matches.length === 0)
    return { failure: selectorNotFound(label, normalized), status: "error" };
  if (matches.length === 1) return { record: matches[0]!, status: "ok" };
  return {
    failure: decisionFailure(
      [
        decisionDiagnostic({
          code: "decision-records.decision-ambiguous",
          reason:
            `${label} name is ambiguous: ${normalized}; choose one standard ID: ` +
            matches
              .map((record) => record.decisionId)
              .sort()
              .join(", "),
          recovery:
            "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
          target: normalized
        })
      ],
      { presentation: "plain" }
    ),
    status: "error"
  };
}

function selectorNotFound(
  label: string,
  selector: string
): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.decision-not-found",
        reason: `${label} does not exist: ${selector}`,
        recovery:
          "Use list to choose a Decision ID or unique name, then retry the command.",
        target: selector
      })
    ],
    { presentation: "plain" }
  );
}
