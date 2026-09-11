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
  DecisionQueryRequest,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import type { DecisionRelationEdge } from "./relation-graph.ts";
import type { DecisionId } from "./types.ts";

type RelationFilterRequest = Pick<
  Extract<DecisionQueryRequest, { command: "list" | "search" }>,
  "direction" | "relatedTo" | "relationType"
>;

export function resolveDecisionRelationIds(
  records: readonly IndexedDecisionRecord[],
  request: RelationFilterRequest
):
  | { decisionIds: ReadonlySet<DecisionId> | null; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  if (request.relatedTo === undefined)
    return relationIdsWithoutTarget(records, request);
  const target = resolveDecisionSelectorInRecords(
    records,
    request.relatedTo,
    "Related decision"
  );
  if (target.status === "error") return target;
  const relationIds = new Set<DecisionId>();
  const direction = request.direction ?? "both";
  if (direction === "predecessors" || direction === "both") {
    for (const relation of target.record.projection.relations) {
      if (relationMatches(relation, request)) relationIds.add(relation.target);
    }
  }
  if (direction === "successors" || direction === "both") {
    for (const record of records) {
      if (
        record.projection.relations.some(
          (relation) =>
            relation.target === target.record.decisionId &&
            relationMatches(relation, request)
        )
      ) {
        relationIds.add(record.decisionId);
      }
    }
  }
  return { decisionIds: relationIds, status: "ok" };
}

function relationIdsWithoutTarget(
  records: readonly IndexedDecisionRecord[],
  request: RelationFilterRequest
):
  | { decisionIds: ReadonlySet<DecisionId> | null; status: "ok" }
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
    return { decisionIds: null, status: "ok" };
  return {
    decisionIds: new Set(
      records
        .filter((record) =>
          record.projection.relations.some(
            (relation) => relation.type === request.relationType
          )
        )
        .map((record) => record.decisionId)
    ),
    status: "ok"
  };
}

function relationMatches(
  relation: Pick<DecisionRelationEdge, "type">,
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
