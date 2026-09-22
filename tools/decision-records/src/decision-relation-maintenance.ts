import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import {
  findRecord,
  relationsEqual
} from "./decision-relation-transaction-support.ts";
import type { DecisionRelationReview } from "./decision-relation-transaction-types.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionId,
  DecisionRelationOverrideGroup,
  DecisionScan,
  EstablishedDecisionRecord
} from "./types.ts";
import { isEstablishedDecisionRecord } from "./types.ts";

export type DecisionSetRelationsRequest = {
  action: "set-relations";
  preflight: boolean;
  relationOverrideGroups: readonly DecisionRelationOverrideGroup[];
};

type PreparedSetRelationsSource = {
  change: DecisionFileChange | null;
  finalRelations: EstablishedDecisionRecord["source"]["document"]["relations"];
  record: EstablishedDecisionRecord;
};

type DecisionSetRelationsPreparation =
  | DecisionApplicationFailure
  | {
      changes: DecisionFileChange[];
      message: string;
      relationReview: DecisionRelationReview;
      status: "ok";
    };

/**
 * Prepares the in-place complete relation replacement for established
 * decisions. Unlike evolve, this transaction never establishes candidates,
 * archives predecessors, or discards records; every final relation target must
 * already satisfy the established relation graph on its own.
 */
export function prepareDecisionSetRelations(
  scan: DecisionScan,
  request: DecisionSetRelationsRequest
): DecisionSetRelationsPreparation {
  const groups = [...request.relationOverrideGroups].sort((left, right) =>
    compareText(left.source, right.source)
  );
  const sources: PreparedSetRelationsSource[] = [];
  for (const group of groups) {
    const prepared = prepareSetRelationsSource(scan, group);
    if ("status" in prepared) return prepared;
    sources.push(prepared);
  }
  const graphFailure = setRelationsGraphFailure(scan, sources);
  if (graphFailure !== null) return graphFailure;
  return setRelationsResult(sources);
}

function prepareSetRelationsSource(
  scan: DecisionScan,
  group: DecisionRelationOverrideGroup
): PreparedSetRelationsSource | DecisionApplicationFailure {
  const record = findRecord(scan, group.source);
  if (record === null || !record.markdownExists) {
    return setRelationsFailure(
      "set-relations source does not exist: " + group.source
    );
  }
  if (!isEstablishedDecisionRecord(record)) {
    return setRelationsFailure(
      "set-relations maintains established decisions only; use publish or evolve for candidates: " +
        record.sourcePath
    );
  }
  const source = record.source;
  const finalRelations = replacementFor(group);
  return {
    change: relationsEqual(source.document.relations, finalRelations)
      ? null
      : setRelationsChange(record, finalRelations),
    finalRelations,
    record
  };
}

function replacementFor(
  group: DecisionRelationOverrideGroup
): EstablishedDecisionRecord["source"]["document"]["relations"] {
  if (group.relationOverride.kind !== "replace") {
    throw new TypeError(
      "set-relations groups must carry complete replacements"
    );
  }
  return group.relationOverride.relations.map((relation) => ({ ...relation }));
}

function setRelationsChange(
  record: EstablishedDecisionRecord,
  finalRelations: EstablishedDecisionRecord["source"]["document"]["relations"]
): DecisionFileChange {
  const source = record.source;
  return {
    decisionPath: record.decisionPath,
    expectedText: source.text,
    nextText:
      serializeDecisionFrontmatter(
        record.decisionId,
        { ...source.document, relations: finalRelations },
        source.document.tags,
        source.document
      ) + source.body
  };
}

function setRelationsGraphFailure(
  scan: DecisionScan,
  sources: readonly PreparedSetRelationsSource[]
): DecisionApplicationFailure | null {
  const finalRelationsBySource = new Map(
    sources.map((source) => [source.record.decisionId, source.finalRelations])
  );
  const previewRecords = scan.records.flatMap((record) =>
    isEstablishedDecisionRecord(record)
      ? [
          {
            decisionId: record.decisionId,
            projection: {
              ...record.source.document,
              relations:
                finalRelationsBySource.get(record.decisionId) ??
                record.source.document.relations
            },
            sourcePath: record.sourcePath,
            status: record.source.document.status
          }
        ]
      : []
  );
  const issues = decisionRelationConsistencyIssues(previewRecords);
  return issues.length === 0
    ? null
    : decisionFailure(issues.map((issue) => issue.message));
}

function setRelationsResult(
  sources: readonly PreparedSetRelationsSource[]
): DecisionSetRelationsPreparation {
  const sourceIds = sources.map((source) => source.record.decisionId);
  return {
    changes: sources.flatMap((source) =>
      source.change === null ? [] : [source.change]
    ),
    message: "Set relations for " + sourceIds.join(", ") + ".",
    relationReview: {
      phase: "preflight",
      sources: sources.map((source) => ({
        action:
          source.change === null
            ? ("unchanged" as const)
            : ("replace" as const),
        after: source.finalRelations.map(copyRelation),
        before: source.record.source.document.relations.map(copyRelation),
        sourceId: source.record.decisionId
      }))
    },
    status: "ok"
  };
}

function setRelationsFailure(error: string): DecisionApplicationFailure {
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.relation-maintenance-invalid",
      reason: error,
      recovery:
        "Correct the reported relation maintenance problem, then retry the command.",
      target: "Decision relation maintenance"
    })
  ]);
}

function copyRelation(
  relation: EstablishedDecisionRecord["source"]["document"]["relations"][number]
) {
  return relation.summary === undefined
    ? { target: relation.target, type: relation.type }
    : {
        summary: relation.summary,
        target: relation.target,
        type: relation.type
      };
}

function compareText(left: DecisionId, right: DecisionId): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
