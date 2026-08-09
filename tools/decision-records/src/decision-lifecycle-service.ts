import fs from "node:fs/promises";
import {
  decisionAttention,
  decisionFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import type {
  DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  parseDecisionMarkdown,
  replaceDecisionFrontmatter,
  type DecisionSourceMetadata
} from "./decision-metadata.ts";
import {
  isNewDecisionIdentityPath,
  normalizeDecisionRelativePath
} from "./decision-path.ts";
import {
  decisionRelationConsistencyIssues,
  type DecisionRelationConsistencyRecord
} from "./relation-graph.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionAlignment,
  DecisionRecord,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionScan,
  DecisionSuccessor
} from "./types.ts";

export type DecisionLifecycleRequest =
  | {
      action: "activate";
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      recordPath: string;
      relationOverride: DecisionRelationOverride;
    }
  | {
      action: "evolve";
      collapseUnrecordedPath: string | null;
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      successors: readonly DecisionSuccessor[];
    }
  | {
      action: "archive";
      keepUnrecordedHistory: boolean;
      recordPaths: readonly string[];
    }
  | {
      action: "discard" | "mark-aligned";
      recordPath: string;
    };

export type DecisionHistoryBaselineRequirement =
  | "collapse-proof"
  | "none"
  | "unrecorded-preflight";

export function decisionHistoryBaselineRequirement(
  scan: DecisionScan,
  request: DecisionLifecycleRequest
): DecisionHistoryBaselineRequirement {
  if (
    request.action === "evolve"
    && request.collapseUnrecordedPath !== null
  ) {
    return "collapse-proof";
  }
  if (
    (request.action === "activate"
      || request.action === "archive"
      || request.action === "evolve")
    && request.keepUnrecordedHistory
  ) {
    return "none";
  }
  if (request.action === "archive") {
    return "unrecorded-preflight";
  }
  if (request.action !== "activate" && request.action !== "evolve") {
    return "none";
  }
  const relations = effectiveRequestRelations(scan, request);
  return relations.some((relation) => (
    findEstablishedRecord(scan, relation.target)?.status === "active"
  ))
    ? "unrecorded-preflight"
    : "none";
}

export type DecisionLifecyclePreparation =
  | DecisionApplicationFailure
  | DecisionApplicationAttention
  | {
      changes: DecisionFileChange[];
      message: string;
      status: "ok";
    };

export async function prepareDecisionLifecycle(
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  options: {
    currentTimestamp?: () => string;
    historyBaseline: DecisionHistoryBaseline | null;
  }
): Promise<DecisionLifecyclePreparation> {
  const baselineRequirement = decisionHistoryBaselineRequirement(scan, request);
  if (
    baselineRequirement !== "none"
    && options.historyBaseline === null
  ) {
    return plainFailure(
      "Decision history baseline was not loaded before " + request.action + "."
    );
  }
  switch (request.action) {
    case "activate":
      return await prepareActivation(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "evolve":
      return await prepareEvolution(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "archive":
      return await prepareArchive(
        scan,
        request.recordPaths,
        request.keepUnrecordedHistory,
        options.historyBaseline
      );
    case "discard":
      return prepareDiscard(scan, request.recordPath);
    case "mark-aligned":
      return await prepareMarkAligned(scan, request.recordPath);
  }
}

async function prepareActivation(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionLifecyclePreparation> {
  const record = findRecord(scan, request.recordPath);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.recordPath);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.relativePath);
  }

  if (record.document === null) {
    const prepared = await prepareRelationTransaction(
      scan,
      {
        collapseUnrecordedPath: null,
        keepUnrecordedHistory: request.keepUnrecordedHistory,
        relationOverride: request.relationOverride,
        successors: [{
          alignment: request.alignment,
          recordPath: record.relativePath
        }]
      },
      currentTimestamp,
      historyBaseline
    );
    if (prepared.status !== "ok") {
      return prepared;
    }
    return {
      changes: prepared.changes,
      message: relationTransactionMessage(
        "Activated new decision as " + request.alignment + " " + record.relativePath,
        prepared
      ),
      status: "ok"
    };
  }

  if (request.relationOverride.kind === "replace") {
    return plainFailure(
      "--relation and --clear-relations apply only when activate establishes "
        + "a new decision candidate: "
        + record.relativePath
    );
  }
  if (record.status === "active") {
    if (record.alignment !== request.alignment) {
      return plainFailure(
        record.alignment === "unaligned"
          ? "Use mark-aligned to change an active decision from unaligned to aligned."
          : "An aligned active decision cannot be changed back to unaligned."
      );
    }
    return {
      changes: [],
      message: "Decision is already active and "
        + request.alignment
        + ": "
        + record.relativePath
        + ".",
      status: "ok"
    };
  }
  if (record.createdAt === null) {
    return plainFailure(
      "Established decision createdAt must not be null: " + record.relativePath
    );
  }
  const currentText = await readDecisionText(record);
  if (currentText.status === "error") {
    return currentText;
  }
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: request.alignment,
      createdAt: record.createdAt,
      status: "active"
    }
  });
  return nextText === null
    ? plainFailure(
        "Decision frontmatter is unavailable: " + record.relativePath
      )
    : {
        changes: [{ decisionPath: record.decisionPath, nextText }],
        message: "Activated as "
          + request.alignment
          + " "
          + record.relativePath
          + ".",
        status: "ok"
      };
}

async function prepareEvolution(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionLifecyclePreparation> {
  const prepared = await prepareRelationTransaction(
    scan,
    request,
    currentTimestamp,
    historyBaseline
  );
  if (prepared.status !== "ok") {
    return prepared;
  }
  return {
    changes: prepared.changes,
    message: relationTransactionMessage(
      "Evolved successors "
        + prepared.successors.map((successor) => (
          successor.alignment + " " + successor.record.relativePath
        )).join(", "),
      prepared
    ),
    status: "ok"
  };
}

type PreparedSuccessor = {
  alignment: DecisionAlignment;
  candidate: boolean;
  currentText: string;
  finalRelations: DecisionRelation[];
  metadata: DecisionSourceMetadata;
  record: DecisionRecord;
  sourceRelations: DecisionRelation[];
};

type RelationTransactionPreparation =
  | DecisionApplicationAttention
  | DecisionApplicationFailure
  | {
      archivedPredecessors: DecisionRecord[];
      changes: DecisionFileChange[];
      collapsedRecord: DecisionRecord | null;
      status: "ok";
      successors: PreparedSuccessor[];
    };

async function prepareRelationTransaction(
  scan: DecisionScan,
  request: {
    collapseUnrecordedPath: string | null;
    keepUnrecordedHistory: boolean;
    relationOverride: DecisionRelationOverride;
    successors: readonly DecisionSuccessor[];
  },
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<RelationTransactionPreparation> {
  const successors = await prepareSuccessors(
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
    const prepared = await prepareArchivedDecisionChange(predecessor);
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
    const nextText = replaceDecisionFrontmatter(successor.currentText, {
      metadata: successor.candidate
        ? {
            alignment: successor.alignment,
            createdAt: successors.establishedAt,
            status: "active"
          }
        : successor.metadata,
      relations: successor.finalRelations
    });
    if (nextText === null) {
      return plainFailure(
        "Decision frontmatter is unavailable: " + successor.record.relativePath
      );
    }
    changes.push({
      decisionPath: successor.record.decisionPath,
      nextText
    });
  }
  if (collapsed.record !== null) {
    changes.push({
      decisionPath: collapsed.record.decisionPath,
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

async function prepareSuccessors(
  scan: DecisionScan,
  requestedSuccessors: readonly DecisionSuccessor[],
  relationOverride: DecisionRelationOverride,
  establishedAt: string
): Promise<PreparedSuccessors> {
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

    const currentText = await readDecisionText(record);
    if (currentText.status === "error") {
      return currentText;
    }
    const metadataErrors: string[] = [];
    const parsed = parseDecisionMarkdown({
      errors: metadataErrors,
      markdown: currentText.value,
      relativePath: record.relativePath
    });
    if (parsed === null || metadataErrors.length > 0) {
      return decisionFailure(metadataErrors);
    }

    const candidate = record.document === null;
    if (candidate) {
      if (
        !isNewDecisionIdentityPath(record.relativePath)
        || !record.activationCandidate
        || !record.bodyValid
        || parsed.metadata.status !== "candidate"
        || parsed.metadata.alignment !== null
        || parsed.metadata.createdAt !== null
      ) {
        return decisionFailure(scan.sourceErrors.length > 0
          ? scan.sourceErrors
          : [
              "New decision successor must be a complete current-format "
                + "candidate with status: candidate, alignment: null, and "
                + "createdAt: null: "
                + record.relativePath
            ]);
      }
    } else {
      if (
        record.alignment === null
        || parsed.metadata.status === "candidate"
      ) {
        return plainFailure(
          "Established successor must have a non-null alignment: "
            + record.relativePath
        );
      }
      if (record.alignment !== requested.alignment) {
        return plainFailure(
          "Established successor alignment confirmation does not match "
            + record.relativePath
            + ": expected "
            + record.alignment
            + "."
        );
      }
    }

    const sourceRelations = cloneRelations(parsed.projection.relations);
    const finalRelations = relationOverride.kind === "source"
      ? cloneRelations(sourceRelations)
      : cloneRelations(relationOverride.relations);
    records.push({
      alignment: requested.alignment,
      candidate,
      currentText: currentText.value,
      finalRelations,
      metadata: parsed.metadata,
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
  collapsedRecord: DecisionRecord | null
): { activeRecords: DecisionRecord[]; errors: string[] } {
  const activeRecords = new Map<string, DecisionRecord>();
  const collapsedDirectPredecessors = new Set(
    collapsedRecord?.projection.relations.map((relation) => (
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
        predecessor.status === "archived"
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
      if (predecessor.status === "active") {
        activeRecords.set(predecessor.relativePath, predecessor);
      }
    }
  }
  return { activeRecords: [...activeRecords.values()], errors };
}

function buildRelationTransactionPreview(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[],
  archivedPredecessors: readonly DecisionRecord[],
  collapsedRecord: DecisionRecord | null
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
    if (
      record.relativePath === collapsedRecord?.relativePath
      || (record.document === null && !successorByPath.has(record.relativePath))
    ) {
      continue;
    }
    const successor = successorByPath.get(record.relativePath);
    const status = successor?.candidate === true
      ? "active"
      : archivedPaths.has(record.relativePath)
        ? "archived"
        : record.status;
    if (status === null || status === "candidate") {
      continue;
    }
    preview.push({
      projection: successor === undefined
        ? record.document ?? record.projection
        : {
            ...record.projection,
            relations: successor.finalRelations
          },
      relativePath: record.relativePath,
      status
    });
  }
  return preview;
}

type CollapsedPredecessorPreparation =
  | DecisionApplicationFailure
  | {
      record: DecisionRecord | null;
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
  if (record.status !== "active") {
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
  collapsedRecord: DecisionRecord
): string[] {
  const selectedPaths = new Set(
    successors.map((successor) => successor.record.relativePath)
  );
  const referencingPaths = scan.records
    .filter((record) => record.relativePath !== collapsedRecord.relativePath)
    .filter((record) => !selectedPaths.has(record.relativePath))
    .filter((record) => record.document !== null || record.activationCandidate)
    .filter((record) => (
      record.document?.relations ?? record.projection.relations
    ).some((relation) => relation.target === collapsedRecord.relativePath))
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

function relationTransactionMessage(
  prefix: string,
  prepared: Extract<RelationTransactionPreparation, { status: "ok" }>
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

function effectiveRequestRelations(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" | "evolve" }>
): DecisionRelation[] {
  if (request.action === "activate") {
    const record = findRecord(scan, request.recordPath);
    if (record === null || record.document !== null) {
      return [];
    }
    return request.relationOverride.kind === "source"
      ? cloneRelations(record.projection.relations)
      : cloneRelations(request.relationOverride.relations);
  }
  return request.successors.flatMap((successor) => {
    const record = findRecord(scan, successor.recordPath);
    if (record === null) {
      return [];
    }
    return request.relationOverride.kind === "source"
      ? cloneRelations(record.projection.relations)
      : cloneRelations(request.relationOverride.relations);
  });
}

async function prepareMarkAligned(
  scan: DecisionScan,
  recordPath: string
): Promise<DecisionLifecyclePreparation> {
  const record = findEstablishedRecord(scan, recordPath);
  if (
    record === null
    || !record.markdownExists
    || record.createdAt === null
  ) {
    return plainFailure("Established decision does not exist: " + recordPath);
  }
  if (record.status !== "active" || record.alignment !== "unaligned") {
    return plainFailure(
      "mark-aligned requires an active unaligned decision: " + record.relativePath
    );
  }
  const currentText = await readDecisionText(record);
  if (currentText.status === "error") {
    return currentText;
  }
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: "aligned",
      createdAt: record.createdAt,
      status: "active"
    }
  });
  return nextText === null
    ? plainFailure(
        "Decision frontmatter is unavailable: " + record.relativePath
      )
    : {
        changes: [{ decisionPath: record.decisionPath, nextText }],
        message: "Marked aligned " + record.relativePath + ".",
        status: "ok"
      };
}

async function prepareArchive(
  scan: DecisionScan,
  recordPaths: readonly string[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionLifecyclePreparation> {
  if (recordPaths.length === 0) {
    return plainFailure("At least one established decision path is required.");
  }
  const archivedPaths = new Set<string>();
  const records: DecisionRecord[] = [];
  for (const recordPath of recordPaths) {
    const record = findEstablishedRecord(scan, recordPath);
    if (record === null) {
      return plainFailure("Established decision does not exist: " + recordPath);
    }
    if (record.status === "archived") {
      return plainFailure("Decision is already archived: " + record.relativePath);
    }
    if (archivedPaths.has(record.relativePath)) {
      return plainFailure("Decision path is repeated: " + record.relativePath);
    }
    archivedPaths.add(record.relativePath);
    records.push(record);
  }
  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    records,
    keepUnrecordedHistory,
    historyBaseline,
    false
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }
  const changes: DecisionFileChange[] = [];
  for (const record of records) {
    const prepared = await prepareArchivedDecisionChange(record);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  return {
    changes,
    message: "Archived " + [...archivedPaths].join(", ") + ".",
    status: "ok"
  };
}

function prepareDiscard(
  scan: DecisionScan,
  recordPath: string
): DecisionLifecyclePreparation {
  const record = findRecord(scan, recordPath);
  if (record === null || !record.markdownExists) {
    return plainFailure("Decision does not exist: " + recordPath);
  }
  if (record.document !== null) {
    return decisionFailure([
      "Cannot discard established decision: " + record.relativePath,
      "Use archive or create a real evolution decision instead."
    ]);
  }
  if (!record.activationCandidate || !record.bodyValid) {
    return decisionFailure([
      "Discard requires a complete reviewable decision candidate with a new "
        + "identity path, current format, status: candidate, alignment: null, "
        + "and createdAt: null: "
        + record.relativePath
    ]);
  }
  if (record.relationshipErrors.length > 0) {
    return decisionFailure([
      "Discard requires the candidate relationships to be structurally valid: "
        + record.relativePath,
      ...record.relationshipErrors
    ]);
  }
  const referencingPaths = scan.records
    .filter((candidate) => candidate.relativePath !== record.relativePath)
    .filter((candidate) => (
      candidate.document?.relations ?? candidate.projection.relations
    ).some((relation) => relation.target === record.relativePath))
    .map((candidate) => candidate.relativePath);
  if (referencingPaths.length > 0) {
    return decisionFailure([
      "Cannot discard decision file while it is still referenced: "
        + record.relativePath,
      "Remove references from: " + referencingPaths.join(", ")
    ]);
  }
  return {
    changes: [{ decisionPath: record.decisionPath, nextText: null }],
    message: "Discarded decision candidate "
      + record.relativePath
      + " before it entered the decision index.",
    status: "ok"
  };
}

type PreparedDecisionChange =
  | DecisionApplicationFailure
  | {
      change: DecisionFileChange;
      status: "ok";
    };

async function prepareArchivedDecisionChange(
  record: DecisionRecord
): Promise<PreparedDecisionChange> {
  if (record.createdAt === null) {
    return plainFailure(
      "Decision createdAt is unavailable: " + record.relativePath
    );
  }
  if (record.alignment === null) {
    return plainFailure(
      "Active decision alignment is unavailable: " + record.relativePath
    );
  }
  const currentText = await readDecisionText(record);
  if (currentText.status === "error") {
    return currentText;
  }
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: record.alignment,
      createdAt: record.createdAt,
      status: "archived"
    }
  });
  return nextText === null
    ? plainFailure(
        "Decision frontmatter is unavailable: " + record.relativePath
      )
    : {
        change: { decisionPath: record.decisionPath, nextText },
        status: "ok"
      };
}

function prepareUnrecordedHistoryAttention(
  records: readonly DecisionRecord[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null,
  canCollapse: boolean
): DecisionApplicationAttention | null {
  if (
    keepUnrecordedHistory
    || historyBaseline === null
    || historyBaseline.kind !== "git-head"
  ) {
    return null;
  }
  const unrecordedPaths = records
    .map((record) => record.relativePath)
    .filter((recordPath) => (
      !historyBaseline.recordedDecisionPaths.has(recordPath)
    ));
  if (unrecordedPaths.length === 0) {
    return null;
  }
  return decisionAttention([
    "The following decisions have not entered "
      + historyBaseline.label
      + ": "
      + unrecordedPaths.join(", ")
      + ".",
    "Archiving them now may preserve same-change intermediate decisions as "
      + "meaningless evolution history; no files were changed.",
    canCollapse
      ? "Re-run with --keep-unrecorded-history to preserve that history, or use "
        + "evolve --collapse-unrecorded <decision-path> with one --successor "
        + "and the complete final relation selection."
      : "Re-run with --keep-unrecorded-history only after deciding that the "
        + "unrecorded history should be preserved; otherwise resolve it through "
        + "an explicit evolve collapse."
  ]);
}

function findRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const recordPath = normalizeDecisionRelativePath(value);
  return scan.records.find((record) => record.relativePath === recordPath) ?? null;
}

function findEstablishedRecord(
  scan: DecisionScan,
  value: string
): DecisionRecord | null {
  const record = findRecord(scan, value);
  return record?.document !== null ? record : null;
}

function cloneRelations(
  relations: readonly DecisionRelation[]
): DecisionRelation[] {
  return relations.map(({ type, target }) => ({
    type,
    target: normalizeDecisionRelativePath(target)
  }));
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

async function readDecisionText(
  record: DecisionRecord
): Promise<
  | DecisionApplicationFailure
  | { status: "ok"; value: string }
> {
  try {
    return {
      status: "ok",
      value: await fs.readFile(record.decisionPath, "utf8")
    };
  } catch (error) {
    return decisionFailure([
      "Failed to read decision body "
        + record.relativePath
        + ": "
        + errorText(error)
    ]);
  }
}

function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure([error], { presentation: "plain" });
}

function currentDecisionTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
