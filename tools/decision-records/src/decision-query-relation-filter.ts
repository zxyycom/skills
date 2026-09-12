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
  decisionIds: ReadonlySet<DecisionId> | null;
  relationsByDecisionId: ReadonlyMap<
    DecisionId,
    readonly DecisionFilterRelation[]
  >;
}>;

export function filterDecisionRelationRecords(
  records: readonly IndexedDecisionRecord[],
  request: RelationFilterRequest
):
  | { records: DecisionFilteredRecord[]; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const filtered = resolveDecisionRelationFilter(records, request);
  if (filtered.status === "error") return filtered;
  return {
    records: records.flatMap((record) => {
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
  records: readonly IndexedDecisionRecord[],
  request: RelationFilterRequest
):
  | { status: "ok"; value: DecisionRelationFilter }
  | { failure: DecisionApplicationFailure; status: "error" } {
  if (request.relatedTo === undefined)
    return relationFilterWithoutTarget(records, request);
  const target = resolveDecisionSelectorInRecords(
    records,
    request.relatedTo,
    "Related decision"
  );
  if (target.status === "error") return target;
  const relationsByDecisionId = new Map<DecisionId, DecisionFilterRelation[]>();
  const direction = request.direction ?? "both";
  if (direction === "predecessors" || direction === "both") {
    for (const relation of target.record.projection.relations) {
      if (relationMatches(relation, request)) {
        addRelation(
          relationsByDecisionId,
          relation.target,
          filterRelation(target.record.decisionId, relation)
        );
      }
    }
  }
  if (direction === "successors" || direction === "both") {
    for (const record of records) {
      record.projection.relations.forEach((relation) => {
        if (
          relation.target === target.record.decisionId &&
          relationMatches(relation, request)
        ) {
          addRelation(
            relationsByDecisionId,
            record.decisionId,
            filterRelation(record.decisionId, relation)
          );
        }
      });
    }
  }
  return {
    status: "ok",
    value: relationFilterFromMap(relationsByDecisionId)
  };
}

function relationFilterWithoutTarget(
  records: readonly IndexedDecisionRecord[],
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
  const relationsByDecisionId = new Map<DecisionId, DecisionFilterRelation[]>();
  records.forEach((record) =>
    record.projection.relations.forEach((relation) => {
      if (relation.type === request.relationType) {
        addRelation(
          relationsByDecisionId,
          record.decisionId,
          filterRelation(record.decisionId, relation)
        );
      }
    })
  );
  return { status: "ok", value: relationFilterFromMap(relationsByDecisionId) };
}

function emptyRelationFilter(): DecisionRelationFilter {
  return { decisionIds: null, relationsByDecisionId: new Map() };
}

function filterRelation(
  sourceId: DecisionId,
  relation: DecisionRelation
): DecisionFilterRelation {
  return {
    sourceId,
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
  relationsByDecisionId.set(decisionId, [
    ...(relationsByDecisionId.get(decisionId) ?? []),
    relation
  ]);
}

function relationFilterFromMap(
  relationsByDecisionId: ReadonlyMap<
    DecisionId,
    readonly DecisionFilterRelation[]
  >
): DecisionRelationFilter {
  const sorted = new Map<DecisionId, readonly DecisionFilterRelation[]>();
  relationsByDecisionId.forEach((relations, decisionId) => {
    const unique = new Map(
      relations.map((relation) => [
        `${relation.sourceId}\u0000${relation.type}\u0000${relation.target}`,
        relation
      ])
    );
    sorted.set(decisionId, [...unique.values()].sort(compareFilterRelations));
  });
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
