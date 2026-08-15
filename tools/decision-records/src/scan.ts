import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists, toPosix } from "../../shared/src/node/filesystem.ts";
import {
  decisionIdFromSourcePath,
  displayDecisionPath,
  isDecisionId,
  sourcePathForDecision
} from "./decision-path.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  parseDecisionIndex
} from "./decision-state-index.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import { validateDecisionBody } from "./record.ts";
import { establishedDecisionMetadataFromSource } from "./decision-metadata.ts";
import {
  compareDecisionRecords,
  type DecisionIndex,
  type DecisionProjection,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

type DecisionStoredIndexEntry = DecisionIndex["entries"][string];

type SourceFile = {
  decisionId: string;
  decisionPath: string;
  sourcePath: string;
};

const allowedRootFiles = new Set([decisionIndexFileName]);

export function unindexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " does not include Decision ID " + decisionId;
}

export function decisionIndexRequiredError(indexRelativePath: string): string {
  return indexRelativePath + " is required";
}

export function missingIndexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " references missing Decision ID " + decisionId;
}

function selectProjection(source: DecisionProjection): DecisionProjection {
  return {
    background: source.background,
    decision: source.decision,
    purpose: source.purpose,
    relations: source.relations,
    title: source.title
  };
}

function addCollectionError(
  collectionErrors: string[],
  sourceErrors: string[],
  error: string
): void {
  collectionErrors.push(error);
  sourceErrors.push(error);
}

function recordFromIndexEntry(options: {
  decisionsDirectory: string;
  decisionId: string;
  entry: DecisionStoredIndexEntry;
}): DecisionRecord {
  const { decisionsDirectory, decisionId, entry } = options;
  const state = entry.state;
  return {
    activationCandidate: false,
    alignment: state.alignment,
    bodyValid: false,
    createdAt: state.createdAt,
    decisionId,
    decisionPath: path.join(decisionsDirectory, ...state.sourcePath.split("/")),
    document: null,
    indexed: true,
    markdownExists: false,
    projection: selectProjection(state),
    relationshipErrors: [],
    source: { kind: "missing" },
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

async function collectSourceFiles(options: {
  collectionErrors: string[];
  decisionsDirectory: string;
  decisionsLabel: string;
  sourceErrors: string[];
}): Promise<SourceFile[]> {
  const {
    collectionErrors,
    decisionsDirectory,
    decisionsLabel,
    sourceErrors
  } = options;
  const sources: SourceFile[] = [];
  const rootEntries = await fs.readdir(decisionsDirectory, { withFileTypes: true });
  rootEntries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of rootEntries) {
    const entryPath = path.join(decisionsDirectory, entry.name);
    if (entry.isFile()) {
      if (entry.name.endsWith(".md")) {
        sources.push({
          decisionId: entry.name,
          decisionPath: entryPath,
          sourcePath: entry.name
        });
      } else if (!allowedRootFiles.has(entry.name)) {
        addCollectionError(
          collectionErrors,
          sourceErrors,
          decisionsLabel + " root contains unsupported file " + entry.name
        );
      }
      continue;
    }
    if (!entry.isDirectory()) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        decisionsLabel + " contains unsupported entry " + entry.name
      );
      continue;
    }
    if (entry.name !== "archive") {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        decisionsLabel + " root contains unsupported directory " + entry.name
      );
      continue;
    }
    const archivedEntries = await fs.readdir(entryPath, { withFileTypes: true });
    archivedEntries.sort((left, right) => left.name.localeCompare(right.name));
    for (const archivedEntry of archivedEntries) {
      const archivedPath = path.join(entryPath, archivedEntry.name);
      const sourcePath = "archive/" + archivedEntry.name;
      if (!archivedEntry.isFile() || !archivedEntry.name.endsWith(".md")) {
        addCollectionError(
          collectionErrors,
          sourceErrors,
          "Decision archive must contain only Markdown files: " + sourcePath
        );
        continue;
      }
      sources.push({
        decisionId: archivedEntry.name,
        decisionPath: archivedPath,
        sourcePath
      });
    }
  }
  return sources;
}

export async function scanDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionScan> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const configuredDecisionDirectory = options.decisionsDir ?? "docs/decisions";
  const decisionsDirectory = path.isAbsolute(configuredDecisionDirectory)
    ? path.resolve(configuredDecisionDirectory)
    : path.resolve(workspaceRoot, configuredDecisionDirectory);
  const activationCandidateErrors: string[] = [];
  const collectionErrors: string[] = [];
  const indexErrors: string[] = [];
  const sourceErrors: string[] = [];
  const records: DecisionRecord[] = [];
  const decisionsLabel = displayDecisionPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(workspaceRoot, indexPath);
  const unavailableScan = (error: string): DecisionScan => ({
    activationCandidateErrors,
    collectionErrors: [error],
    decisionsDirectoryAvailable: false,
    decisionsDirectory,
    errors: [error],
    indexErrors,
    index: null,
    indexExists: false,
    indexPath,
    indexRelativePath,
    indexText: "",
    records,
    sourceErrors: [error],
    workspaceRoot
  });

  if (!await pathExists(decisionsDirectory)) {
    return unavailableScan(decisionsLabel + " is required");
  }
  if (!(await fs.stat(decisionsDirectory)).isDirectory()) {
    return unavailableScan(decisionsLabel + " must be a directory");
  }

  const indexExists = await pathExists(indexPath);
  const indexText = indexExists ? await fs.readFile(indexPath, "utf8") : "";
  const parsedIndex = indexText.length > 0
    ? parseDecisionIndex(indexText, indexRelativePath)
    : null;
  if (parsedIndex?.status === "error") {
    indexErrors.push(...decisionIndexDiagnosticMessages(
      parsedIndex.diagnostics,
      indexRelativePath
    ));
  }
  const index = parsedIndex?.status === "ok" ? parsedIndex.value : null;
  const sourceFiles = await collectSourceFiles({
    collectionErrors,
    decisionsDirectory,
    decisionsLabel,
    sourceErrors
  });
  const sourceFilesById = new Map<string, SourceFile[]>();
  for (const sourceFile of sourceFiles) {
    sourceFilesById.set(sourceFile.decisionId, [
      ...sourceFilesById.get(sourceFile.decisionId) ?? [],
      sourceFile
    ]);
  }
  for (const [decisionId, members] of sourceFilesById) {
    if (!isDecisionId(decisionId)) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        "Decision source must use a stable kebab-case Decision ID basename: "
          + members[0]!.sourcePath
      );
    }
    if (members.length > 1) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        "Decision ID occurs in more than one source path: "
          + decisionId
          + " ("
          + members.map((member) => member.sourcePath).join(", ")
          + ")"
      );
    }
  }
  const availableDecisionIds = new Set(
    [...sourceFilesById.entries()]
      .filter(([decisionId, members]) => isDecisionId(decisionId) && members.length === 1)
      .map(([decisionId]) => decisionId)
  );

  for (const sourceFile of sourceFiles) {
    const indexEntry = index !== null && Object.hasOwn(index.entries, sourceFile.decisionId)
      ? index.entries[sourceFile.decisionId]
      : null;
    const recordErrors: string[] = [];
    const sourceText = await fs.readFile(sourceFile.decisionPath, "utf8");
    const sourceDocument = await validateDecisionBody({
      body: sourceText,
      decisionId: sourceFile.decisionId,
      errors: recordErrors,
      sourcePath: sourceFile.sourcePath,
      targetExists: (targetId) => availableDecisionIds.has(targetId)
    });
    const expectedSourcePath = sourceDocument === null
      ? null
      : sourcePathForDecision(sourceFile.decisionId, sourceDocument.status);
    if (expectedSourcePath !== sourceFile.sourcePath) {
      recordErrors.push(
        sourceFile.sourcePath + " status must match its physical sourcePath"
      );
    }
    const activationCandidate = recordErrors.length === 0
      && indexEntry === null
      && sourceDocument?.status === "candidate"
      && sourceDocument.alignment === null
      && sourceDocument.createdAt === null;
    if (sourceDocument?.status === "candidate" && !activationCandidate) {
      recordErrors.push(
        sourceFile.sourcePath + " candidate status is allowed only for a complete, "
          + "unindexed, current-format new Decision ID"
      );
    }
    const establishedMetadata = sourceDocument
      ? establishedDecisionMetadataFromSource(sourceDocument)
      : null;
    const document = recordErrors.length === 0
      && sourceDocument
      && establishedMetadata
      ? { ...selectProjection(sourceDocument), tags: [...sourceDocument.tags], ...establishedMetadata }
      : null;
    const source = recordErrors.length > 0 || sourceDocument === null
      ? { kind: "invalid" as const, text: sourceText }
      : activationCandidate
        ? {
            body: sourceDocument.body,
            document: {
              ...selectProjection(sourceDocument),
              tags: [...sourceDocument.tags],
              alignment: null,
              createdAt: null,
              status: "candidate" as const
            },
            kind: "candidate" as const,
            text: sourceText
          }
        : document === null
          ? { kind: "invalid" as const, text: sourceText }
          : {
              body: sourceDocument.body,
              document,
              kind: "established" as const,
              text: sourceText
            };

    if (document !== null && indexEntry === null) {
      indexErrors.push(unindexedDecisionError(indexRelativePath, sourceFile.decisionId));
    }
    if (document !== null && indexEntry !== null && indexEntry.state.sourcePath !== sourceFile.sourcePath) {
      indexErrors.push(
        indexRelativePath + " sourcePath does not match Decision ID " + sourceFile.decisionId
      );
    }
    sourceErrors.push(...recordErrors);
    records.push({
      activationCandidate,
      alignment: sourceDocument?.alignment ?? null,
      bodyValid: recordErrors.length === 0,
      createdAt: sourceDocument?.createdAt ?? null,
      decisionId: sourceFile.decisionId,
      decisionPath: sourceFile.decisionPath,
      document,
      indexed: indexEntry !== null,
      markdownExists: true,
      projection: sourceDocument
        ? selectProjection(sourceDocument)
        : indexEntry
          ? selectProjection(indexEntry.state)
          : {
              background: "",
              decision: "",
              purpose: "",
              relations: [],
              title: ""
            },
      relationshipErrors: [],
      source,
      sourcePath: sourceFile.sourcePath,
      status: sourceDocument?.status ?? null,
      tags: sourceDocument?.tags ?? indexEntry?.state.tags ?? []
    });
  }

  if (index !== null) {
    const recordIds = new Set(records.map((record) => record.decisionId));
    for (const [decisionId, storedEntry] of Object.entries(index.entries)) {
      if (recordIds.has(decisionId)) {
        continue;
      }
      indexErrors.push(missingIndexedDecisionError(indexRelativePath, decisionId));
      records.push(recordFromIndexEntry({
        decisionsDirectory,
        decisionId,
        entry: storedEntry
      }));
    }
  }
  if (!indexExists && records.some((record) => record.document !== null)) {
    indexErrors.push(decisionIndexRequiredError(indexRelativePath));
  }
  records.sort(compareDecisionRecords);
  const relationshipIssues = decisionRelationConsistencyIssues(
    records.flatMap((record) => record.source.kind === "established"
      ? [{
          decisionId: record.decisionId,
          projection: record.source.document,
          sourcePath: record.sourcePath,
          status: record.source.document.status
        }]
      : [])
  );
  const recordById = new Map(records.map((record) => [record.decisionId, record]));
  for (const issue of relationshipIssues) {
    sourceErrors.push(issue.message);
    for (const decisionId of issue.sourceIds) {
      recordById.get(decisionId)?.relationshipErrors.push(issue.message);
    }
  }
  for (const candidate of records.filter((record) => record.activationCandidate)) {
    for (const relation of candidate.projection.relations) {
      const target = recordById.get(relation.target);
      if (
        target !== undefined
        && (target.document !== null || target.activationCandidate)
      ) {
        continue;
      }
      const error = candidate.sourcePath
        + " relationship "
        + relation.type
        + " target is not a valid scanned decision: "
        + relation.target;
      sourceErrors.push(error);
      candidate.relationshipErrors.push(error);
    }
  }

  const errors = [...sourceErrors, ...indexErrors];
  return {
    activationCandidateErrors,
    collectionErrors,
    decisionsDirectoryAvailable: true,
    decisionsDirectory,
    errors,
    indexErrors,
    index,
    indexExists,
    indexPath,
    indexRelativePath,
    indexText,
    records,
    sourceErrors,
    workspaceRoot
  };
}
