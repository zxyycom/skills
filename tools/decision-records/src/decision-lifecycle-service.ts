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
  type DecisionMetadataCandidate
} from "./decision-metadata.ts";
import {
  isNewDecisionIdentityPath,
  normalizeDecisionRelativePath
} from "./decision-path.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionAlignment,
  DecisionRecord,
  DecisionRelation,
  DecisionScan,
  DecisionSplitSuccessor
} from "./types.ts";

export type DecisionLifecycleRequest =
  | {
      action: "activate";
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      recordPath: string;
      relations: readonly DecisionRelation[];
    }
  | {
      action: "evolve";
      alignment: DecisionAlignment;
      collapseUnrecordedPath: string | null;
      keepUnrecordedHistory: boolean;
      recordPath: string;
      relations: readonly DecisionRelation[];
    }
  | {
      action: "archive";
      keepUnrecordedHistory: boolean;
      recordPaths: readonly string[];
    }
  | {
      action: "split";
      keepUnrecordedHistory: boolean;
      predecessorPath: string;
      successors: readonly DecisionSplitSuccessor[];
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
      || request.action === "evolve"
      || request.action === "split")
    && request.keepUnrecordedHistory
  ) {
    return "none";
  }
  if (request.action === "archive" || request.action === "split") {
    return "unrecorded-preflight";
  }
  if (
    (request.action === "activate" || request.action === "evolve")
    && request.relations.length > 0
  ) {
    return "unrecorded-preflight";
  }
  return "none";
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
  const baselineRequirement = decisionHistoryBaselineRequirement(request);
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
    case "evolve":
      return await prepareActivation(
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
    case "split":
      return await prepareSplit(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
  }
}

async function prepareActivation(
  scan: DecisionScan,
  request: Extract<
    DecisionLifecycleRequest,
    { action: "activate" | "evolve" }
  >,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionLifecyclePreparation> {
  const collapseUnrecordedPath = request.action === "evolve"
    ? request.collapseUnrecordedPath
    : null;
  if (
    request.action === "evolve"
    && request.relations.length === 0
    && collapseUnrecordedPath === null
  ) {
    return plainFailure(
      "evolve requires at least one --relation or --collapse-unrecorded."
    );
  }
  const record = findRecord(scan, request.recordPath);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.recordPath);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.relativePath);
  }
  const currentText = await readDecisionText(record);
  if (currentText.status === "error") {
    return currentText;
  }
  const metadataErrors: string[] = [];
  const parsed = parseDecisionMarkdown({
    allowNullCreatedAt: true,
    errors: metadataErrors,
    markdown: currentText.value,
    relativePath: record.relativePath
  });
  if (parsed === null || metadataErrors.length > 0) {
    return decisionFailure(metadataErrors);
  }
  if (
    (request.relations.length > 0 || collapseUnrecordedPath !== null)
    && record.document !== null
  ) {
    return plainFailure(
      "Evolution options can only establish a new decision candidate: "
        + record.relativePath
    );
  }

  const activation = activationMetadata(
    scan,
    record,
    parsed.metadata,
    request.alignment,
    currentTimestamp
  );
  if (activation.status === "error") {
    return activation;
  }
  if (activation.state === "unchanged") {
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

  const evolution = await prepareEvolutionPlan(
    scan,
    record.relativePath,
    request,
    historyBaseline
  );
  if (evolution.status !== "ok") {
    return evolution;
  }
  const changes = [...evolution.changes];
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: request.alignment,
      createdAt: activation.createdAt,
      status: "active"
    },
    relations: request.action === "evolve" || request.relations.length > 0
      ? [...request.relations]
      : undefined
  });
  if (nextText === null) {
    return plainFailure(
      "Decision frontmatter is unavailable: " + record.relativePath
    );
  }
  changes.push({ decisionPath: record.decisionPath, nextText });
  const evolutionMessage = evolution.predecessors.length === 0
    ? ""
    : " and archived direct predecessors "
      + evolution.predecessors
        .map((predecessor) => predecessor.relativePath)
        .join(", ");
  const collapseMessage = evolution.collapsedRecord === null
    ? ""
    : " and collapsed unrecorded predecessor "
      + evolution.collapsedRecord.relativePath;
  return {
    changes,
    message: activation.prefix
      + " as "
      + request.alignment
      + " "
      + record.relativePath
      + evolutionMessage
      + collapseMessage
      + ".",
    status: "ok"
  };
}

type DecisionEvolutionPlan =
  | DecisionApplicationAttention
  | DecisionApplicationFailure
  | {
      changes: DecisionFileChange[];
      collapsedRecord: DecisionRecord | null;
      predecessors: DecisionRecord[];
      status: "ok";
    };

async function prepareEvolutionPlan(
  scan: DecisionScan,
  successorPath: string,
  request: Extract<
    DecisionLifecycleRequest,
    { action: "activate" | "evolve" }
  >,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionEvolutionPlan> {
  const collapseUnrecordedPath = request.action === "evolve"
    ? request.collapseUnrecordedPath
    : null;
  const collapsed = prepareCollapsedPredecessor(
    scan,
    successorPath,
    collapseUnrecordedPath,
    request.relations,
    historyBaseline
  );
  if (collapsed.status === "error") {
    return collapsed;
  }
  const predecessors = evolutionPredecessors(
    scan,
    successorPath,
    request.relations,
    collapsed.record
  );
  if (predecessors.errors.length > 0) {
    return decisionFailure(predecessors.errors);
  }
  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    predecessors.records,
    request.keepUnrecordedHistory,
    historyBaseline,
    true
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }

  const changes: DecisionFileChange[] = [];
  for (const predecessor of predecessors.records) {
    const prepared = await prepareArchivedDecisionChange(predecessor);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  if (collapsed.record !== null) {
    changes.push({
      decisionPath: collapsed.record.decisionPath,
      nextText: null
    });
  }
  return {
    changes,
    collapsedRecord: collapsed.record,
    predecessors: predecessors.records,
    status: "ok"
  };
}

type ActivationMetadata =
  | DecisionApplicationFailure
  | {
      createdAt: string;
      prefix: string;
      state: "changed";
      status: "ok";
    }
  | {
      state: "unchanged";
      status: "ok";
    };

function activationMetadata(
  scan: DecisionScan,
  record: DecisionRecord,
  metadata: DecisionMetadataCandidate,
  alignment: DecisionAlignment,
  currentTimestamp: () => string
): ActivationMetadata {
  if (record.document !== null) {
    if (record.status === "active") {
      if (record.alignment !== alignment) {
        return plainFailure(
          record.alignment === "unaligned"
            ? "Use mark-aligned to change an active decision from unaligned to aligned."
            : "An aligned active decision cannot be changed back to unaligned."
        );
      }
      return { state: "unchanged", status: "ok" };
    }
    return metadata.createdAt === null
      ? plainFailure(
          "Established decision createdAt must not be null: " + record.relativePath
        )
      : {
          createdAt: metadata.createdAt,
          prefix: "Activated",
          state: "changed",
          status: "ok"
        };
  }

  if (!isNewDecisionIdentityPath(record.relativePath)) {
    return decisionFailure([
      "New decision identity path must use kebab-case semantic slugs "
        + "without date tokens: "
        + record.relativePath
    ]);
  }
  if (
    !record.activationCandidate
    || !record.bodyValid
    || metadata.status !== "active"
    || metadata.alignment !== alignment
    || metadata.createdAt !== null
  ) {
    return decisionFailure(scan.sourceErrors.length > 0
      ? scan.sourceErrors
      : [
          "New decision activation candidate must be a complete current-format "
            + "record with status: active, alignment: "
            + alignment
            + ", and createdAt: null: "
            + record.relativePath
        ]);
  }
  return {
    createdAt: currentTimestamp(),
    prefix: "Activated new decision",
    state: "changed",
    status: "ok"
  };
}

async function prepareSplit(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "split" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): Promise<DecisionLifecyclePreparation> {
  if (request.successors.length < 2) {
    return plainFailure(
      "split requires at least two --successor values that form the complete "
        + "successor set."
    );
  }

  const predecessor = findEstablishedRecord(scan, request.predecessorPath);
  if (predecessor === null || !predecessor.markdownExists) {
    return plainFailure(
      "Split predecessor is not an established decision: "
        + request.predecessorPath
    );
  }
  if (predecessor.status !== "active") {
    return plainFailure(
      "Split predecessor must be active: " + predecessor.relativePath
    );
  }

  const establishedAt = currentTimestamp();
  const successorPaths = new Set<string>();
  const preparedSuccessors: Array<{
    nextText: string;
    record: DecisionRecord;
    successor: DecisionSplitSuccessor;
  }> = [];
  for (const successor of request.successors) {
    const record = findRecord(scan, successor.recordPath);
    if (record === null || !record.markdownExists) {
      return plainFailure(
        "Split successor decision does not exist: " + successor.recordPath
      );
    }
    if (record.relativePath === predecessor.relativePath) {
      return plainFailure(
        "Split successor must not be the predecessor itself: "
          + record.relativePath
      );
    }
    if (successorPaths.has(record.relativePath)) {
      return plainFailure(
        "Split successor decision path is repeated: " + record.relativePath
      );
    }
    successorPaths.add(record.relativePath);
    if (record.document !== null) {
      return plainFailure(
        "Split successor must be a new decision candidate: "
          + record.relativePath
      );
    }

    const currentText = await readDecisionText(record);
    if (currentText.status === "error") {
      return currentText;
    }
    const metadataErrors: string[] = [];
    const parsed = parseDecisionMarkdown({
      allowNullCreatedAt: true,
      errors: metadataErrors,
      markdown: currentText.value,
      relativePath: record.relativePath
    });
    if (parsed === null || metadataErrors.length > 0) {
      return decisionFailure(metadataErrors);
    }
    if (parsed.projection.relations.length > 0) {
      return plainFailure(
        "Split successor candidate must declare relations: [] before the "
          + "split transaction sets its complete relation list: "
          + record.relativePath
      );
    }
    const activation = activationMetadata(
      scan,
      record,
      parsed.metadata,
      successor.alignment,
      () => establishedAt
    );
    if (activation.status === "error") {
      return activation;
    }
    if (activation.state === "unchanged") {
      return plainFailure(
        "Split successor must not already be active: " + record.relativePath
      );
    }
    const nextText = replaceDecisionFrontmatter(currentText.value, {
      metadata: {
        alignment: successor.alignment,
        createdAt: activation.createdAt,
        status: "active"
      },
      relations: [{
        type: "拆分",
        target: predecessor.relativePath
      }]
    });
    if (nextText === null) {
      return plainFailure(
        "Decision frontmatter is unavailable: " + record.relativePath
      );
    }
    preparedSuccessors.push({ nextText, record, successor });
  }

  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    [predecessor],
    request.keepUnrecordedHistory,
    historyBaseline,
    false
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }
  const archivedPredecessor = await prepareArchivedDecisionChange(predecessor);
  if (archivedPredecessor.status === "error") {
    return archivedPredecessor;
  }
  return {
    changes: [
      archivedPredecessor.change,
      ...preparedSuccessors.map(({ nextText, record }) => ({
        decisionPath: record.decisionPath,
        nextText
      }))
    ],
    message: "Split "
      + predecessor.relativePath
      + " into "
      + preparedSuccessors.map(({ record, successor }) => (
        successor.alignment + " " + record.relativePath
      )).join(", ")
      + ".",
    status: "ok"
  };
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
      "Discard requires a complete unactivated decision candidate with a new "
        + "identity path, current format, status: active, non-null alignment, "
        + "and createdAt: null: "
        + record.relativePath
    ]);
  }
  if (record.relationshipErrors.length > 0) {
    return decisionFailure([
      "Discard requires the candidate relationship graph to be valid: "
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
    message: "Discarded unactivated decision candidate "
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

type CollapsedPredecessorPreparation =
  | DecisionApplicationFailure
  | {
      record: DecisionRecord | null;
      status: "ok";
    };

function prepareCollapsedPredecessor(
  scan: DecisionScan,
  successorPath: string,
  collapsedPath: string | null,
  finalRelations: readonly DecisionRelation[],
  historyBaseline: DecisionHistoryBaseline | null
): CollapsedPredecessorPreparation {
  if (collapsedPath === null) {
    return { record: null, status: "ok" };
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
  if (record.relativePath === successorPath) {
    return plainFailure(
      "Collapsed predecessor must not be the successor itself: " + successorPath
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
  if (
    finalRelations.some(
      (relation) => relation.target === record.relativePath
    )
  ) {
    return plainFailure(
      "The complete final relation list must not retain the collapsed predecessor: "
        + record.relativePath
    );
  }

  return { record, status: "ok" };
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
        + "evolve --collapse-unrecorded <decision-path> with the complete final "
        + "--relation list."
      : "Re-run with --keep-unrecorded-history only after deciding that the "
        + "unrecorded history should be preserved; otherwise resolve it through "
        + "an explicit evolve collapse."
  ]);
}

function evolutionPredecessors(
  scan: DecisionScan,
  successorPath: string,
  relations: readonly DecisionRelation[],
  collapsedPredecessor: DecisionRecord | null
): { errors: string[]; records: DecisionRecord[] } {
  const errors: string[] = [];
  const records = new Map<string, DecisionRecord>();
  const collapsedDirectPredecessors = new Set(
    collapsedPredecessor?.document?.relations.map(
      (relation) => relation.target
    ) ?? []
  );
  for (const relation of relations) {
    if (relation.target === successorPath) {
      errors.push("Decision relation must not target itself: " + successorPath);
      continue;
    }
    const predecessor = findEstablishedRecord(scan, relation.target);
    if (predecessor === null) {
      errors.push(
        "Evolution predecessor is not an established decision: " + relation.target
      );
      continue;
    }
    if (predecessor.status !== "active") {
      if (
        predecessor.status === "archived"
        && collapsedDirectPredecessors.has(predecessor.relativePath)
      ) {
        continue;
      }
      errors.push(
        "Evolution predecessor must be active, unless it is a direct predecessor "
          + "of the collapsed decision: "
          + predecessor.relativePath
      );
      continue;
    }
    records.set(predecessor.relativePath, predecessor);
  }
  return { errors, records: [...records.values()] };
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
