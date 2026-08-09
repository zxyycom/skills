import {
  decisionFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  prepareUnrecordedHistoryAttention,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import { prepareArchivedDecisionChange } from "./decision-lifecycle-change.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import { normalizeDecisionRelativePath } from "./decision-path.ts";
import {
  decisionRelationConsistencyIssues,
  type DecisionRelationConsistencyRecord
} from "./relation-graph.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionAlignment,
  type DecisionCandidateRecord,
  type DecisionRecord,
  type DecisionRelation,
  type DecisionRelationOverride,
  type DecisionScan,
  type DecisionSuccessor,
  type EstablishedDecisionRecord
} from "./types.ts";

type PreparedSuccessorFields = {
  alignment: DecisionAlignment;
  finalRelations: DecisionRelation[];
  sourceRelations: DecisionRelation[];
};

type PreparedSuccessor =
  | PreparedSuccessorFields & {
      candidate: true;
      record: DecisionCandidateRecord;
    }
  | PreparedSuccessorFields & {
      candidate: false;
      record: EstablishedDecisionRecord;
    };

export type DecisionRelationTransactionPreparation =
  | DecisionApplicationAttention
  | DecisionApplicationFailure
  | {
      archivedPredecessors: EstablishedDecisionRecord[];
      changes: DecisionFileChange[];
      collapsedRecord: EstablishedDecisionRecord | null;
      status: "ok";
      successors: PreparedSuccessor[];
    };

export type DecisionRelationTransactionRequest = {
  collapseUnrecordedPath: string | null;
  keepUnrecordedHistory: boolean;
  relationOverride: DecisionRelationOverride;
  successors: readonly DecisionSuccessor[];
};

export function prepareDecisionRelationTransaction(
  scan: DecisionScan,
  request: DecisionRelationTransactionRequest,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionRelationTransactionPreparation {
  const successors = prepareSuccessors(
    scan,
    request.successors,
    request.relationOverride,
    currentTimestamp()
  );
  if (successors.status === "error") {
    return successors;
  }
  const strategyErrors = relationStrategyShapeErrors(successors.records);
  if (strategyErrors.length > 0) {
    return decisionFailure(strategyErrors);
  }

  const collapsed = prepareCollapsedPredecessor(
    scan,
    successors.records,
    request.collapseUnrecordedPath,
    request.relationOverride,
    historyBaseline
  );
  if (collapsed.status === "error") {
    return collapsed;
  }
  const predecessorSelection = directPredecessors(
    scan,
    successors.records,
    collapsed.record
  );
  if (predecessorSelection.errors.length > 0) {
    return decisionFailure(predecessorSelection.errors);
  }

  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    predecessorSelection.activeRecords,
    request.keepUnrecordedHistory,
    historyBaseline,
    collapsed.record === null
      && successors.records.length === 1
      && successors.records[0]?.candidate === true
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }

  const collapsedReferenceErrors = collapsed.record === null
    ? []
    : collapsedDecisionReferenceErrors(
        scan,
        successors.records,
        collapsed.record
      );
  if (collapsedReferenceErrors.length > 0) {
    return decisionFailure(collapsedReferenceErrors);
  }

  const previewRecords = buildRelationTransactionPreview(
    scan,
    successors.records,
    predecessorSelection.activeRecords,
    collapsed.record
  );
  const previewIssues = decisionRelationConsistencyIssues(previewRecords);
  if (previewIssues.length > 0) {
    return decisionFailure(previewIssues.map((issue) => issue.message));
  }
  const splitClosureErrors = splitSuccessorClosureErrors(
    successors.records,
    previewRecords
  );
  if (splitClosureErrors.length > 0) {
    return decisionFailure(splitClosureErrors);
  }

  const changes: DecisionFileChange[] = [];
  for (const predecessor of predecessorSelection.activeRecords) {
    const prepared = prepareArchivedDecisionChange(predecessor);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  for (const successor of successors.records) {
    if (
      !successor.candidate
      && relationsEqual(
        successor.sourceRelations,
        successor.finalRelations
      )
    ) {
      continue;
    }
    const source = successor.record.source;
    const nextProjection = {
      ...source.document,
      relations: successor.finalRelations
    };
    const nextText = successor.candidate
      ? serializeDecisionFrontmatter(nextProjection, {
          alignment: successor.alignment,
          createdAt: successors.establishedAt,
          status: "active"
        }) + source.body
      : serializeDecisionFrontmatter(nextProjection, source.document) + source.body;
    changes.push({
      decisionPath: successor.record.decisionPath,
      expectedText: source.text,
      nextText
    });
  }
  if (collapsed.record !== null) {
    changes.push({
      decisionPath: collapsed.record.decisionPath,
      expectedText: collapsed.record.source.text,
      nextText: null
    });
  }

  return {
    archivedPredecessors: predecessorSelection.activeRecords,
    changes,
    collapsedRecord: collapsed.record,
    status: "ok",
    successors: successors.records
  };
}

type PreparedSuccessors =
  | DecisionApplicationFailure
  | {
      establishedAt: string;
      records: PreparedSuccessor[];
      status: "ok";
    };

function prepareSuccessors(
  scan: DecisionScan,
  requestedSuccessors: readonly DecisionSuccessor[],
  relationOverride: DecisionRelationOverride,
  establishedAt: string
): PreparedSuccessors {
  if (requestedSuccessors.length === 0) {
    return plainFailure("evolve requires at least one --successor value.");
  }

  const selectedPaths = new Set<string>();
  const records: PreparedSuccessor[] = [];
  for (const requested of requestedSuccessors) {
    const requestedPath = normalizeDecisionRelativePath(requested.recordPath);
    const record = findRecord(scan, requestedPath);
    if (record === null || !record.markdownExists) {
      return plainFailure(
        "Successor decision does not exist: " + requested.recordPath
      );
    }
    if (selectedPaths.has(record.relativePath)) {
      return plainFailure(
        "Successor decision path is repeated: " + record.relativePath
      );
    }
    selectedPaths.add(record.relativePath);

    if (isDecisionCandidateRecord(record)) {
      const sourceRelations = cloneRelations(record.source.document.relations);
      records.push({
        alignment: requested.alignment,
        candidate: true,
        finalRelations: resolveEffectiveRelations(
          sourceRelations,
          relationOverride
        ),
        record,
        sourceRelations
      });
      continue;
    }
    if (!isEstablishedDecisionRecord(record)) {
      return decisionFailure(scan.sourceErrors.length > 0
        ? scan.sourceErrors
        : ["Validated successor source is unavailable: " + record.relativePath]);
    }

    const source = record.source;
    if (source.document.alignment === null) {
      return plainFailure(
        "Established successor must have a non-null alignment: "
          + record.relativePath
      );
    }
    if (source.document.alignment !== requested.alignment) {
      return plainFailure(
        "Established successor alignment confirmation does not match "
          + record.relativePath
          + ": expected "
          + source.document.alignment
          + "."
      );
    }

    const sourceRelations = cloneRelations(source.document.relations);
    const finalRelations = resolveEffectiveRelations(
      sourceRelations,
      relationOverride
    );
    records.push({
      alignment: source.document.alignment,
      candidate: false,
      finalRelations,
      record,
      sourceRelations
    });
  }
  return { establishedAt, records, status: "ok" };
}

function relationStrategyShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  const hasSplit = successors.some((successor) => (
    successor.finalRelations.some((relation) => relation.type === "拆分")
  ));
  if (!hasSplit) {
    if (successors.length !== 1) {
      return [
        "Multiple successors are supported only by the closed 拆分 strategy."
      ];
    }
    const relations = successors[0]?.finalRelations ?? [];
    if (
      relations.length > 0
      && relations.every((relation) => relation.type === "归并")
      && relations.length < 2
    ) {
      return ["A pure 归并 relation set requires at least two predecessors."];
    }
    return [];
  }

  if (successors.length < 2) {
    return [
      "The 拆分 strategy requires at least two explicitly selected successors."
    ];
  }
  if (successors.some((successor) => (
    successor.finalRelations.length !== 1
    || successor.finalRelations[0]?.type !== "拆分"
  ))) {
    return [
      "Every successor in a 拆分 transaction must have exactly one 拆分 "
        + "relation and no other relations."
    ];
  }
  const splitTargets = new Set(successors.map((successor) => (
    successor.finalRelations[0]?.target
  )));
  return splitTargets.size === 1
    ? []
    : ["Every successor in a 拆分 transaction must use the same predecessor."];
}

function splitSuccessorClosureErrors(
  successors: readonly PreparedSuccessor[],
  previewRecords: readonly DecisionRelationConsistencyRecord[]
): string[] {
  const splitPredecessor = successors[0]?.finalRelations[0]?.type === "拆分"
    ? successors[0].finalRelations[0].target
    : null;
  if (splitPredecessor === null) {
    return [];
  }
  const selectedPaths = new Set(
    successors.map((successor) => successor.record.relativePath)
  );
  const finalPaths = new Set(previewRecords
    .filter((record) => record.projection.relations.some((relation) => (
      relation.type === "拆分" && relation.target === splitPredecessor
    )))
    .map((record) => record.relativePath));
  const omitted = [...finalPaths]
    .filter((recordPath) => !selectedPaths.has(recordPath))
    .sort();
  const absent = [...selectedPaths]
    .filter((recordPath) => !finalPaths.has(recordPath))
    .sort();
  return omitted.length === 0 && absent.length === 0
    ? []
    : [
        "The selected successor set must equal every final direct 拆分 "
          + "successor of "
          + splitPredecessor
          + "."
          + (omitted.length === 0
            ? ""
            : " Omitted: " + omitted.join(", ") + ".")
          + (absent.length === 0
            ? ""
            : " Missing from final graph: " + absent.join(", ") + ".")
      ];
}

function directPredecessors(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[],
  collapsedRecord: EstablishedDecisionRecord | null
): { activeRecords: EstablishedDecisionRecord[]; errors: string[] } {
  const activeRecords = new Map<string, EstablishedDecisionRecord>();
  const collapsedDirectPredecessors = new Set(
    collapsedRecord?.source.document.relations.map((relation) => (
      normalizeDecisionRelativePath(relation.target)
    )) ?? []
  );
  const errors: string[] = [];
  for (const successor of successors) {
    const seenTargets = new Set<string>();
    for (const relation of successor.finalRelations) {
      const targetPath = normalizeDecisionRelativePath(relation.target);
      if (targetPath === successor.record.relativePath) {
        errors.push(
          "Decision relation must not target itself: "
            + successor.record.relativePath
        );
        continue;
      }
      if (seenTargets.has(targetPath)) {
        errors.push(
          "Decision relation target is repeated for "
            + successor.record.relativePath
            + ": "
            + targetPath
        );
        continue;
      }
      seenTargets.add(targetPath);
      const predecessor = findEstablishedRecord(scan, targetPath);
      if (predecessor === null) {
        errors.push(
          "Evolution predecessor is not an established decision: " + targetPath
        );
        continue;
      }
      if (
        predecessor.source.document.status === "archived"
        && collapsedRecord !== null
        && !collapsedDirectPredecessors.has(predecessor.relativePath)
      ) {
        errors.push(
          "Archived final relation target must be a direct predecessor of "
            + "the collapsed decision: "
            + predecessor.relativePath
        );
        continue;
      }
      if (predecessor.source.document.status === "active") {
        activeRecords.set(predecessor.relativePath, predecessor);
      }
    }
  }
  return { activeRecords: [...activeRecords.values()], errors };
}

function buildRelationTransactionPreview(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[],
  archivedPredecessors: readonly EstablishedDecisionRecord[],
  collapsedRecord: EstablishedDecisionRecord | null
): DecisionRelationConsistencyRecord[] {
  const successorByPath = new Map(successors.map((successor) => [
    successor.record.relativePath,
    successor
  ]));
  const archivedPaths = new Set(
    archivedPredecessors.map((record) => record.relativePath)
  );
  const preview: DecisionRelationConsistencyRecord[] = [];
  for (const record of scan.records) {
    const successor = successorByPath.get(record.relativePath);
    const establishedRecord = isEstablishedDecisionRecord(record)
      ? record
      : null;
    if (
      record.relativePath === collapsedRecord?.relativePath
      || (establishedRecord === null && successor === undefined)
    ) {
      continue;
    }
    const status = successor?.candidate === true
      ? "active"
      : archivedPaths.has(record.relativePath)
        ? "archived"
        : successor?.candidate === false
          ? successor.record.source.document.status
          : establishedRecord?.source.document.status;
    if (status === undefined) {
      continue;
    }
    const projection = successor === undefined
      ? establishedRecord?.source.document
      : {
          ...successor.record.source.document,
          relations: successor.finalRelations
        };
    if (projection === undefined) {
      continue;
    }
    preview.push({
      projection,
      relativePath: record.relativePath,
      status
    });
  }
  return preview;
}

type CollapsedPredecessorPreparation =
  | DecisionApplicationFailure
  | {
      record: EstablishedDecisionRecord | null;
      status: "ok";
    };

function prepareCollapsedPredecessor(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[],
  collapsedPath: string | null,
  relationOverride: DecisionRelationOverride,
  historyBaseline: DecisionHistoryBaseline | null
): CollapsedPredecessorPreparation {
  if (collapsedPath === null) {
    return { record: null, status: "ok" };
  }
  if (successors.length !== 1 || successors[0]?.candidate !== true) {
    return plainFailure(
      "--collapse-unrecorded requires exactly one new decision candidate successor."
    );
  }
  const successor = successors[0];
  if (
    successor.finalRelations.length === 0
    && relationOverride.kind === "source"
  ) {
    return plainFailure(
      "Use --clear-relations to explicitly select an empty final relation set "
        + "when collapsing an unrecorded predecessor."
    );
  }
  if (
    historyBaseline === null
    || historyBaseline.kind !== "git-head"
  ) {
    return plainFailure(
      "--collapse-unrecorded requires an available Git HEAD baseline."
    );
  }
  const record = findEstablishedRecord(scan, collapsedPath);
  if (record === null || !record.markdownExists) {
    return plainFailure(
      "Collapsed predecessor is not an established decision: " + collapsedPath
    );
  }
  if (record.relativePath === successor.record.relativePath) {
    return plainFailure(
      "Collapsed predecessor must not be the successor itself: "
        + successor.record.relativePath
    );
  }
  if (record.source.document.status !== "active") {
    return plainFailure(
      "Collapsed predecessor must be active: " + record.relativePath
    );
  }
  if (historyBaseline.recordedDecisionPaths.has(record.relativePath)) {
    return plainFailure(
      "Cannot collapse a decision recorded in "
        + historyBaseline.label
        + ": "
        + record.relativePath
    );
  }
  if (successor.finalRelations.some((relation) => (
    normalizeDecisionRelativePath(relation.target) === record.relativePath
  ))) {
    return plainFailure(
      "The complete final relation list must not retain the collapsed predecessor: "
        + record.relativePath
    );
  }
  return { record, status: "ok" };
}

function collapsedDecisionReferenceErrors(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[],
  collapsedRecord: EstablishedDecisionRecord
): string[] {
  const selectedPaths = new Set(
    successors.map((successor) => successor.record.relativePath)
  );
  const referencingPaths = scan.records
    .filter((record) => record.relativePath !== collapsedRecord.relativePath)
    .filter((record) => !selectedPaths.has(record.relativePath))
    .filter((record) => (
      record.source.kind === "candidate"
      || record.source.kind === "established"
    ) && record.source.document.relations.some((relation) => (
      relation.target === collapsedRecord.relativePath
    )))
    .map((record) => record.relativePath)
    .sort();
  return referencingPaths.length === 0
    ? []
    : [
        "Cannot collapse decision while it is still referenced: "
          + collapsedRecord.relativePath,
        "Remove or replace references from: " + referencingPaths.join(", ")
      ];
}

export function decisionRelationTransactionMessage(
  prefix: string,
  prepared: Extract<DecisionRelationTransactionPreparation, { status: "ok" }>
): string {
  const archived = prepared.archivedPredecessors.length === 0
    ? ""
    : " and archived new active predecessors "
      + prepared.archivedPredecessors
        .map((record) => record.relativePath)
        .join(", ");
  const collapsed = prepared.collapsedRecord === null
    ? ""
    : " and collapsed unrecorded predecessor "
      + prepared.collapsedRecord.relativePath;
  return prefix + archived + collapsed + ".";
}

export function decisionRelationTransactionRequiresHistoryBaseline(
  scan: DecisionScan,
  request: DecisionRelationTransactionRequest
): boolean {
  const relations = request.successors.flatMap((successor) => {
    const record = findRecord(scan, successor.recordPath);
    if (
      record === null
      || (record.source.kind !== "candidate"
        && record.source.kind !== "established")
    ) {
      return [];
    }
    return resolveEffectiveRelations(
      record.source.document.relations,
      request.relationOverride
    );
  });
  return relations.some((relation) => (
    findEstablishedRecord(scan, relation.target)?.source.document.status === "active"
  ));
}

function findRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const recordPath = normalizeDecisionRelativePath(value);
  return scan.records.find((record) => record.relativePath === recordPath) ?? null;
}

function findEstablishedRecord(
  scan: DecisionScan,
  value: string
): EstablishedDecisionRecord | null {
  const record = findRecord(scan, value);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}

function cloneRelations(
  relations: readonly DecisionRelation[]
): DecisionRelation[] {
  return relations.map(({ type, target }) => ({
    type,
    target: normalizeDecisionRelativePath(target)
  }));
}

function resolveEffectiveRelations(
  sourceRelations: readonly DecisionRelation[],
  relationOverride: DecisionRelationOverride
): DecisionRelation[] {
  return cloneRelations(
    relationOverride.kind === "source"
      ? sourceRelations
      : relationOverride.relations
  );
}

function relationsEqual(
  left: readonly DecisionRelation[],
  right: readonly DecisionRelation[]
): boolean {
  return left.length === right.length
    && left.every((relation, index) => (
      relation.type === right[index]?.type
      && relation.target === right[index]?.target
    ));
}

function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure([error], { presentation: "plain" });
}
