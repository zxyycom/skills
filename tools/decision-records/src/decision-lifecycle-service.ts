import path from "node:path";
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
import {
  decisionRelationTransactionMessage,
  decisionRelationTransactionRequiresHistoryBaseline,
  prepareDecisionRelationTransaction,
  type DecisionRelationTransactionRequest
} from "./decision-relation-transaction.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionAlignment,
  type DecisionId,
  type EstablishedDecisionRecord,
  type DecisionRecord,
  type DecisionRelationOverride,
  type DecisionScan,
  type DecisionSuccessor
} from "./types.ts";

export type DecisionLifecycleRequest =
  | {
      action: "activate";
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      decisionId: DecisionId;
      relationOverride: DecisionRelationOverride;
    }
  | {
      action: "evolve";
      discardId: DecisionId | null;
      deleteRecordedDecision: boolean;
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      successors: readonly DecisionSuccessor[];
    }
  | {
      action: "archive";
      keepUnrecordedHistory: boolean;
      decisionIds: readonly DecisionId[];
    }
  | {
      action: "discard";
      decisionId: DecisionId;
      deleteRecordedDecision: boolean;
    }
  | {
      action: "mark-aligned";
      decisionId: DecisionId;
    };

export function requiresDecisionHistoryBaseline(
  scan: DecisionScan,
  request: DecisionLifecycleRequest
): boolean {
  if (
    (request.action === "activate" ||
      request.action === "archive" ||
      (request.action === "evolve" &&
        (request.discardId === null || request.deleteRecordedDecision))) &&
    request.keepUnrecordedHistory
  ) {
    return false;
  }
  if (request.action === "archive") {
    return true;
  }
  if (request.action === "discard") {
    return decisionRelationTransactionRequiresHistoryBaseline(
      scan,
      discardRelationTransactionRequest(request)
    );
  }
  if (request.action !== "activate" && request.action !== "evolve") {
    return false;
  }
  const transactionRequest =
    request.action === "activate"
      ? activationRelationTransactionRequest(scan, request)
      : { ...request, kind: "evolve" as const };
  return (
    transactionRequest !== null &&
    decisionRelationTransactionRequiresHistoryBaseline(scan, transactionRequest)
  );
}

function activationRelationTransactionRequest(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>
): DecisionRelationTransactionRequest | null {
  const record = findRecord(scan, request.decisionId);
  if (record === null || !isDecisionCandidateRecord(record)) {
    return null;
  }
  return {
    discardId: null,
    deleteRecordedDecision: false,
    kind: "evolve",
    keepUnrecordedHistory: request.keepUnrecordedHistory,
    relationOverride: request.relationOverride,
    successors: [
      {
        alignment: request.alignment,
        decisionId: record.decisionId
      }
    ]
  };
}

export type DecisionLifecyclePreparation =
  | DecisionApplicationFailure
  | DecisionApplicationAttention
  | {
      changes: DecisionFileChange[];
      message: string;
      status: "ok";
    };

export function prepareDecisionLifecycle(
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  options: {
    currentTimestamp?: () => string;
    historyBaseline: DecisionHistoryBaseline | null;
  }
): DecisionLifecyclePreparation {
  if (
    requiresDecisionHistoryBaseline(scan, request) &&
    options.historyBaseline === null
  ) {
    return plainFailure(
      "Decision history baseline was not loaded before " + request.action + "."
    );
  }
  switch (request.action) {
    case "activate":
      return prepareActivation(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "evolve":
      return prepareEvolution(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "archive":
      return prepareArchive(
        scan,
        request.decisionIds,
        request.keepUnrecordedHistory,
        options.historyBaseline
      );
    case "discard":
      return prepareDiscard(
        scan,
        request.decisionId,
        request.deleteRecordedDecision,
        options.historyBaseline
      );
    case "mark-aligned":
      return prepareMarkAligned(scan, request.decisionId);
  }
}

function prepareActivation(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const record = findRecord(scan, request.decisionId);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.decisionId);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.sourcePath);
  }

  if (record.source.kind === "candidate") {
    const transactionRequest = activationRelationTransactionRequest(
      scan,
      request
    );
    if (transactionRequest === null) {
      return plainFailure(
        "Validated decision candidate is unavailable: " + record.sourcePath
      );
    }
    const prepared = prepareDecisionRelationTransaction(
      scan,
      transactionRequest,
      currentTimestamp,
      historyBaseline
    );
    if (prepared.status !== "ok") {
      return prepared;
    }
    return {
      changes: prepared.changes,
      message: decisionRelationTransactionMessage(
        "Activated new decision as " +
          request.alignment +
          " " +
          record.sourcePath,
        prepared
      ),
      status: "ok"
    };
  }

  if (record.source.kind !== "established") {
    return plainFailure(
      "Validated decision source is unavailable: " + record.sourcePath
    );
  }
  const source = record.source;

  if (request.relationOverride.kind === "replace") {
    return plainFailure(
      "--relation and --clear-relations apply only when activate establishes " +
        "a new decision candidate: " +
        record.sourcePath
    );
  }
  if (source.document.status === "active") {
    if (source.document.alignment !== request.alignment) {
      return plainFailure(
        source.document.alignment === "unaligned"
          ? "Use mark-aligned to change an active decision from unaligned to aligned."
          : "An aligned active decision cannot be changed back to unaligned."
      );
    }
    return {
      changes: [],
      message:
        "Decision is already active and " +
        request.alignment +
        ": " +
        record.sourcePath +
        ".",
      status: "ok"
    };
  }
  const nextText =
    serializeDecisionFrontmatter(source.document, source.document.tags, {
      alignment: request.alignment,
      createdAt: source.document.createdAt,
      status: "active"
    }) + source.body;
  return {
    changes: [
      {
        decisionPath: record.decisionPath,
        expectedText: source.text,
        nextText,
        targetPath: path.resolve(
          path.dirname(record.decisionPath),
          "..",
          record.decisionId
        )
      }
    ],
    message:
      "Activated as " + request.alignment + " " + record.sourcePath + ".",
    status: "ok"
  };
}

function prepareEvolution(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const prepared = prepareDecisionRelationTransaction(
    scan,
    { ...request, kind: "evolve" },
    currentTimestamp,
    historyBaseline
  );
  if (prepared.status !== "ok") {
    return prepared;
  }
  return {
    changes: prepared.changes,
    message: decisionRelationTransactionMessage(
      "Evolved successors " +
        prepared.successors
          .map(
            (successor) =>
              successor.alignment + " " + successor.record.sourcePath
          )
          .join(", "),
      prepared
    ),
    status: "ok"
  };
}

function prepareMarkAligned(
  scan: DecisionScan,
  decisionId: DecisionId
): DecisionLifecyclePreparation {
  const record = findEstablishedRecord(scan, decisionId);
  if (record === null) {
    return plainFailure("Established decision does not exist: " + decisionId);
  }
  const source = record.source;
  if (
    source.document.status !== "active" ||
    source.document.alignment !== "unaligned"
  ) {
    return plainFailure(
      "mark-aligned requires an active unaligned decision: " + record.sourcePath
    );
  }
  const nextText =
    serializeDecisionFrontmatter(source.document, source.document.tags, {
      alignment: "aligned",
      createdAt: source.document.createdAt,
      status: "active"
    }) + source.body;
  return {
    changes: [
      {
        decisionPath: record.decisionPath,
        expectedText: source.text,
        nextText
      }
    ],
    message: "Marked aligned " + record.sourcePath + ".",
    status: "ok"
  };
}

function prepareArchive(
  scan: DecisionScan,
  decisionIds: readonly DecisionId[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  if (decisionIds.length === 0) {
    return plainFailure("At least one established Decision ID is required.");
  }
  const archivedIds = new Set<DecisionId>();
  const records: EstablishedDecisionRecord[] = [];
  for (const decisionId of decisionIds) {
    const record = findEstablishedRecord(scan, decisionId);
    if (record === null) {
      return plainFailure("Established decision does not exist: " + decisionId);
    }
    if (record.source.document.status === "archived") {
      return plainFailure("Decision is already archived: " + record.sourcePath);
    }
    if (archivedIds.has(record.decisionId)) {
      return plainFailure("Decision ID is repeated: " + record.decisionId);
    }
    archivedIds.add(record.decisionId);
    records.push(record);
  }
  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    records.map((record) => ({
      decisionId: record.decisionId,
      kind: "archive"
    })),
    keepUnrecordedHistory,
    historyBaseline
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }
  const changes: DecisionFileChange[] = [];
  for (const record of records) {
    const prepared = prepareArchivedDecisionChange(record);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  return {
    changes,
    message: "Archived " + [...archivedIds].join(", ") + ".",
    status: "ok"
  };
}

function prepareDiscard(
  scan: DecisionScan,
  decisionId: DecisionId,
  deleteRecordedDecision: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const prepared = prepareDecisionRelationTransaction(
    scan,
    discardRelationTransactionRequest({
      action: "discard",
      decisionId,
      deleteRecordedDecision
    }),
    currentDecisionTimestamp,
    historyBaseline
  );
  if (prepared.status !== "ok") return prepared;
  return {
    changes: prepared.changes,
    message: "Discarded decision " + prepared.discardedRecord?.sourcePath + ".",
    status: "ok"
  };
}

function discardRelationTransactionRequest(
  request: Extract<DecisionLifecycleRequest, { action: "discard" }>
): DecisionRelationTransactionRequest {
  return {
    discardId: request.decisionId,
    deleteRecordedDecision: request.deleteRecordedDecision,
    kind: "discard",
    keepUnrecordedHistory: false,
    relationOverride: { kind: "source" },
    successors: []
  };
}

function findRecord(
  scan: DecisionScan,
  value: DecisionId
): DecisionRecord | null {
  return scan.records.find((record) => record.decisionId === value) ?? null;
}

function findEstablishedRecord(
  scan: DecisionScan,
  value: DecisionId
): EstablishedDecisionRecord | null {
  const record = findRecord(scan, value);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}

function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure([error], { presentation: "plain" });
}

function currentDecisionTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
