import fs from "node:fs/promises";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
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
  DecisionScan
} from "./types.ts";

export type DecisionLifecycleRequest =
  | {
      action: "activate" | "evolve";
      alignment: DecisionAlignment;
      recordPath: string;
      relations: readonly DecisionRelation[];
    }
  | {
      action: "archive";
      recordPaths: readonly string[];
    }
  | {
      action: "discard" | "mark-aligned";
      recordPath: string;
    };

export type DecisionLifecyclePreparation =
  | DecisionApplicationFailure
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
  } = {}
): Promise<DecisionLifecyclePreparation> {
  switch (request.action) {
    case "activate":
    case "evolve":
      return await prepareActivation(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp
      );
    case "archive":
      return await prepareArchive(scan, request.recordPaths);
    case "discard":
      return prepareDiscard(scan, request.recordPath);
    case "mark-aligned":
      return await prepareMarkAligned(scan, request.recordPath);
  }
}

async function prepareActivation(
  scan: DecisionScan,
  request: Extract<
    DecisionLifecycleRequest,
    { action: "activate" | "evolve" }
  >,
  currentTimestamp: () => string
): Promise<DecisionLifecyclePreparation> {
  if (request.action === "evolve" && request.relations.length === 0) {
    return plainFailure("evolve requires at least one --relation.");
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
  if (request.relations.length > 0 && record.document !== null) {
    return plainFailure(
      "--relation can only establish a new decision candidate: "
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

  const predecessors = evolutionPredecessors(
    scan,
    record.relativePath,
    request.relations
  );
  if (predecessors.errors.length > 0) {
    return decisionFailure(predecessors.errors);
  }
  const changes: DecisionFileChange[] = [];
  for (const predecessor of predecessors.records) {
    const prepared = await prepareArchivedDecisionChange(predecessor);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: request.alignment,
      createdAt: activation.createdAt,
      status: "active"
    },
    relations: request.relations.length > 0
      ? [...request.relations]
      : undefined
  });
  if (nextText === null) {
    return plainFailure(
      "Decision frontmatter is unavailable: " + record.relativePath
    );
  }
  changes.push({ decisionPath: record.decisionPath, nextText });
  const evolutionMessage = predecessors.records.length === 0
    ? ""
    : " and archived direct predecessors "
      + predecessors.records.map((predecessor) => predecessor.relativePath).join(", ");
  return {
    changes,
    message: activation.prefix
      + " as "
      + request.alignment
      + " "
      + record.relativePath
      + evolutionMessage
      + ".",
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
  recordPaths: readonly string[]
): Promise<DecisionLifecyclePreparation> {
  if (recordPaths.length === 0) {
    return plainFailure("At least one established decision path is required.");
  }
  const archivedPaths = new Set<string>();
  const changes: DecisionFileChange[] = [];
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
  const currentText = await readDecisionText(record);
  if (currentText.status === "error") {
    return currentText;
  }
  const nextText = replaceDecisionFrontmatter(currentText.value, {
    metadata: {
      alignment: null,
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

function evolutionPredecessors(
  scan: DecisionScan,
  successorPath: string,
  relations: readonly DecisionRelation[]
): { errors: string[]; records: DecisionRecord[] } {
  const errors: string[] = [];
  const records = new Map<string, DecisionRecord>();
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
      errors.push(
        "Evolution predecessor must be active: " + predecessor.relativePath
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
