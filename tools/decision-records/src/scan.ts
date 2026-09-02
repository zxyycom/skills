import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { decisionFileSystemErrorText } from "./application-result.ts";
import {
  displayDecisionPath,
  isDecisionId,
  sourcePathForDecision
} from "./decision-path.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  parseDecisionIndex
} from "./decision-state-index.ts";
import { establishedDecisionMetadataFromSource } from "./decision-metadata.ts";
import { validateDecisionBody, type ValidatedDecisionBody } from "./record.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import {
  compareDecisionRecords,
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionIndex,
  type DecisionProjection,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

type DecisionStoredIndexEntry = DecisionIndex["entries"][DecisionId];

type SourceFile = {
  decisionId: string;
  decisionPath: string;
  sourcePath: string;
};

type SourceFileMembers = [SourceFile, ...SourceFile[]];

type DecisionScanLocation = {
  decisionsDirectory: string;
  decisionsLabel: string;
  indexPath: string;
  indexRelativePath: string;
  workspaceRoot: string;
};

type LoadedDecisionIndex = {
  index: DecisionIndex | null;
  indexExists: boolean;
  indexText: string;
};

type ScannedSourceState = Pick<
  DecisionRecord,
  "activationCandidate" | "bodyReady" | "document" | "scaffoldValid" | "source"
>;
type CandidateSourceState = Pick<
  ScannedSourceState,
  "activationCandidate" | "bodyReady" | "scaffoldValid"
>;
type ScannedSourceMetadata = Pick<
  DecisionRecord,
  "alignment" | "createdAt" | "projection" | "status" | "tags"
>;

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

export async function scanDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionScan> {
  const location = resolveDecisionScanLocation(options);
  const directoryError = await inspectDecisionsDirectory(location);
  if (directoryError !== null) {
    return unavailableDecisionScan(location, directoryError);
  }

  const collectionErrors: string[] = [];
  const indexErrors: string[] = [];
  const sourceErrors: string[] = [];
  const loadedIndex = await loadDecisionIndexForScan(location, indexErrors);
  let sourceFiles: SourceFile[] = [];
  try {
    sourceFiles = await collectSourceFiles({
      collectionErrors,
      decisionsDirectory: location.decisionsDirectory,
      decisionsLabel: location.decisionsLabel,
      sourceErrors
    });
  } catch (error) {
    addCollectionError(
      collectionErrors,
      sourceErrors,
      location.decisionsLabel + " could not be read: " + errorText(error)
    );
  }

  const availableDecisionIds = validateSourceMembership(
    sourceFiles,
    collectionErrors,
    sourceErrors
  );
  const records = await scanSourceFiles({
    availableDecisionIds,
    index: loadedIndex.index,
    indexErrors,
    indexRelativePath: location.indexRelativePath,
    sourceErrors,
    sourceFiles
  });
  appendMissingIndexedRecords(
    records,
    loadedIndex.index,
    location,
    indexErrors
  );
  if (!loadedIndex.indexExists && records.some(isEstablishedDecisionRecord)) {
    indexErrors.push(decisionIndexRequiredError(location.indexRelativePath));
  }

  records.sort(compareDecisionRecords);
  validateScannedRelationships(records, sourceErrors);
  return {
    collectionErrors,
    decisionsDirectoryAvailable: true,
    decisionsDirectory: location.decisionsDirectory,
    errors: [...sourceErrors, ...indexErrors],
    index: loadedIndex.index,
    indexErrors,
    indexExists: loadedIndex.indexExists,
    indexPath: location.indexPath,
    indexRelativePath: location.indexRelativePath,
    indexText: loadedIndex.indexText,
    records,
    sourceErrors,
    workspaceRoot: location.workspaceRoot
  };
}

function resolveDecisionScanLocation(
  options: DecisionScanOptions
): DecisionScanLocation {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const configuredDecisionDirectory = options.decisionsDir ?? "docs/decisions";
  const decisionsDirectory = path.isAbsolute(configuredDecisionDirectory)
    ? path.resolve(configuredDecisionDirectory)
    : path.resolve(workspaceRoot, configuredDecisionDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  return {
    decisionsDirectory,
    decisionsLabel: displayDecisionPath(workspaceRoot, decisionsDirectory),
    indexPath,
    indexRelativePath: displayDecisionPath(workspaceRoot, indexPath),
    workspaceRoot
  };
}

async function inspectDecisionsDirectory(
  location: DecisionScanLocation
): Promise<string | null> {
  try {
    if (!(await fs.stat(location.decisionsDirectory)).isDirectory()) {
      return location.decisionsLabel + " must be a directory";
    }
    return null;
  } catch (error) {
    return isFileSystemError(error, "ENOENT")
      ? location.decisionsLabel + " is required"
      : location.decisionsLabel +
          " could not be inspected: " +
          errorText(error);
  }
}

function unavailableDecisionScan(
  location: DecisionScanLocation,
  error: string
): DecisionScan {
  return {
    collectionErrors: [error],
    decisionsDirectoryAvailable: false,
    decisionsDirectory: location.decisionsDirectory,
    errors: [error],
    index: null,
    indexErrors: [],
    indexExists: false,
    indexPath: location.indexPath,
    indexRelativePath: location.indexRelativePath,
    indexText: "",
    records: [],
    sourceErrors: [error],
    workspaceRoot: location.workspaceRoot
  };
}

async function loadDecisionIndexForScan(
  location: DecisionScanLocation,
  indexErrors: string[]
): Promise<LoadedDecisionIndex> {
  let entry;
  try {
    entry = await fs.lstat(location.indexPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return { index: null, indexExists: false, indexText: "" };
    }
    indexErrors.push(
      location.indexRelativePath +
        " could not be inspected: " +
        errorText(error)
    );
    return { index: null, indexExists: false, indexText: "" };
  }

  if (entry.isSymbolicLink() || !entry.isFile()) {
    indexErrors.push(
      location.indexRelativePath +
        " must be a regular non-symbolic-link JSON file"
    );
    return { index: null, indexExists: true, indexText: "" };
  }

  let indexText: string;
  try {
    indexText = await fs.readFile(location.indexPath, "utf8");
  } catch (error) {
    indexErrors.push(
      location.indexRelativePath + " could not be read: " + errorText(error)
    );
    return { index: null, indexExists: true, indexText: "" };
  }
  const parsed = parseDecisionIndex(indexText, location.indexRelativePath);
  if (parsed.status === "error") {
    indexErrors.push(
      ...decisionIndexDiagnosticMessages(
        parsed.diagnostics,
        location.indexRelativePath
      )
    );
    return { index: null, indexExists: true, indexText };
  }
  return { index: parsed.value, indexExists: true, indexText };
}

async function collectSourceFiles(options: {
  collectionErrors: string[];
  decisionsDirectory: string;
  decisionsLabel: string;
  sourceErrors: string[];
}): Promise<SourceFile[]> {
  const { collectionErrors, decisionsDirectory, decisionsLabel, sourceErrors } =
    options;
  const sources: SourceFile[] = [];
  const rootEntries = await fs.readdir(decisionsDirectory, {
    withFileTypes: true
  });
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
    await collectArchivedSourceFiles({
      archiveDirectory: entryPath,
      collectionErrors,
      sourceErrors,
      sources
    });
  }
  return sources;
}

async function collectArchivedSourceFiles(options: {
  archiveDirectory: string;
  collectionErrors: string[];
  sourceErrors: string[];
  sources: SourceFile[];
}): Promise<void> {
  let archivedEntries;
  try {
    archivedEntries = await fs.readdir(options.archiveDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    addCollectionError(
      options.collectionErrors,
      options.sourceErrors,
      "Decision archive could not be read: " + errorText(error)
    );
    return;
  }
  archivedEntries.sort((left, right) => left.name.localeCompare(right.name));
  for (const archivedEntry of archivedEntries) {
    const sourcePath = "archive/" + archivedEntry.name;
    if (!archivedEntry.isFile() || !archivedEntry.name.endsWith(".md")) {
      addCollectionError(
        options.collectionErrors,
        options.sourceErrors,
        "Decision archive must contain only Markdown files: " + sourcePath
      );
      continue;
    }
    options.sources.push({
      decisionId: archivedEntry.name,
      decisionPath: path.join(options.archiveDirectory, archivedEntry.name),
      sourcePath
    });
  }
}

function validateSourceMembership(
  sourceFiles: readonly SourceFile[],
  collectionErrors: string[],
  sourceErrors: string[]
): ReadonlySet<DecisionId> {
  const sourceFilesById = new Map<string, SourceFileMembers>();
  for (const sourceFile of sourceFiles) {
    const members = sourceFilesById.get(sourceFile.decisionId);
    if (members === undefined) {
      sourceFilesById.set(sourceFile.decisionId, [sourceFile]);
    } else {
      members.push(sourceFile);
    }
  }

  const availableDecisionIds = new Set<DecisionId>();
  for (const [decisionId, members] of sourceFilesById) {
    if (!isDecisionId(decisionId)) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        "Decision source must use a stable kebab-case Decision ID basename: " +
          members[0].sourcePath
      );
    } else if (members.length === 1) {
      availableDecisionIds.add(decisionId);
    }
    if (members.length > 1) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        "Decision ID occurs in more than one source path: " +
          decisionId +
          " (" +
          members.map((member) => member.sourcePath).join(", ") +
          ")"
      );
    }
  }
  return availableDecisionIds;
}

async function scanSourceFiles(options: {
  availableDecisionIds: ReadonlySet<DecisionId>;
  index: DecisionIndex | null;
  indexErrors: string[];
  indexRelativePath: string;
  sourceErrors: string[];
  sourceFiles: readonly SourceFile[];
}): Promise<DecisionRecord[]> {
  const records: DecisionRecord[] = [];
  for (const sourceFile of options.sourceFiles) {
    records.push(await scanSourceFile(sourceFile, options));
  }
  return records;
}

async function scanSourceFile(
  sourceFile: SourceFile,
  context: {
    availableDecisionIds: ReadonlySet<DecisionId>;
    index: DecisionIndex | null;
    indexErrors: string[];
    indexRelativePath: string;
    sourceErrors: string[];
  }
): Promise<DecisionRecord> {
  const decisionId = isDecisionId(sourceFile.decisionId)
    ? sourceFile.decisionId
    : null;
  const indexEntry =
    context.index !== null &&
    decisionId !== null &&
    Object.hasOwn(context.index.entries, decisionId)
      ? context.index.entries[decisionId]
      : null;
  let sourceText: string;
  try {
    sourceText = await fs.readFile(sourceFile.decisionPath, "utf8");
  } catch (error) {
    const readError =
      sourceFile.sourcePath + " could not be read: " + errorText(error);
    context.sourceErrors.push(readError);
    return invalidDecisionRecord(sourceFile, indexEntry, "");
  }

  const recordErrors: string[] = [];
  const sourceDocument = await validateDecisionBody({
    body: sourceText,
    decisionId: sourceFile.decisionId,
    errors: recordErrors,
    sourcePath: sourceFile.sourcePath,
    targetExists: (targetId) => context.availableDecisionIds.has(targetId)
  });
  const sourceState = scannedSourceState(
    sourceFile,
    sourceText,
    sourceDocument,
    indexEntry,
    recordErrors
  );
  validateSourceIndexEntry(
    sourceFile,
    sourceState.document,
    indexEntry,
    context
  );
  context.sourceErrors.push(...recordErrors);
  return scannedDecisionRecord(
    sourceFile,
    sourceDocument,
    sourceState,
    indexEntry
  );
}

function scannedSourceState(
  sourceFile: SourceFile,
  sourceText: string,
  sourceDocument: ValidatedDecisionBody | null,
  indexEntry: DecisionStoredIndexEntry | null,
  recordErrors: string[]
): ScannedSourceState {
  const validDecisionId = isDecisionId(sourceFile.decisionId);
  validateSourceLocation(
    sourceFile,
    sourceDocument,
    validDecisionId,
    recordErrors
  );
  const candidate = candidateSourceState(
    sourceFile,
    sourceDocument,
    validDecisionId,
    indexEntry,
    recordErrors
  );
  const document = establishedSourceDocument(sourceDocument, recordErrors);
  return {
    ...candidate,
    document,
    source: classifyDecisionSource(
      sourceText,
      sourceDocument,
      document,
      candidate.scaffoldValid,
      recordErrors
    )
  };
}

function validateSourceLocation(
  sourceFile: SourceFile,
  sourceDocument: ValidatedDecisionBody | null,
  validDecisionId: boolean,
  recordErrors: string[]
): void {
  const expectedSourcePath =
    sourceDocument === null || !validDecisionId
      ? null
      : sourcePathForDecision(sourceFile.decisionId, sourceDocument.status);
  if (expectedSourcePath !== sourceFile.sourcePath) {
    recordErrors.push(
      sourceFile.sourcePath + " status must match its physical sourcePath"
    );
  }
}

function candidateSourceState(
  sourceFile: SourceFile,
  sourceDocument: ValidatedDecisionBody | null,
  validDecisionId: boolean,
  indexEntry: DecisionStoredIndexEntry | null,
  recordErrors: string[]
): CandidateSourceState {
  const scaffoldValid =
    validDecisionId &&
    recordErrors.length === 0 &&
    indexEntry === null &&
    sourceDocument?.status === "candidate" &&
    sourceDocument.alignment === null &&
    sourceDocument.createdAt === null;
  const bodyReady = scaffoldValid && sourceDocument?.bodyReady === true;
  const activationCandidate = bodyReady;
  if (sourceDocument?.status === "candidate" && !scaffoldValid) {
    recordErrors.push(
      sourceFile.sourcePath +
        " candidate status is allowed only for an unindexed, " +
        "current-format Decision scaffold"
    );
  }
  return { activationCandidate, bodyReady, scaffoldValid };
}

function establishedSourceDocument(
  sourceDocument: ValidatedDecisionBody | null,
  recordErrors: readonly string[]
): DecisionRecord["document"] {
  const establishedMetadata =
    sourceDocument === null
      ? null
      : establishedDecisionMetadataFromSource(sourceDocument);
  return recordErrors.length === 0 &&
    sourceDocument !== null &&
    establishedMetadata !== null
    ? {
        ...selectProjection(sourceDocument),
        tags: [...sourceDocument.tags],
        ...establishedMetadata
      }
    : null;
}

function classifyDecisionSource(
  sourceText: string,
  sourceDocument: ValidatedDecisionBody | null,
  document: DecisionRecord["document"],
  scaffoldValid: boolean,
  recordErrors: readonly string[]
): DecisionRecord["source"] {
  return recordErrors.length > 0 || sourceDocument === null
    ? { kind: "invalid" as const, text: sourceText }
    : scaffoldValid
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
}

function validateSourceIndexEntry(
  sourceFile: SourceFile,
  document: DecisionRecord["document"],
  indexEntry: DecisionStoredIndexEntry | null,
  context: {
    indexErrors: string[];
    indexRelativePath: string;
  }
): void {
  if (document !== null && indexEntry === null) {
    context.indexErrors.push(
      unindexedDecisionError(context.indexRelativePath, sourceFile.decisionId)
    );
  }
  if (
    document !== null &&
    indexEntry !== null &&
    indexEntry.state.sourcePath !== sourceFile.sourcePath
  ) {
    context.indexErrors.push(
      context.indexRelativePath +
        " sourcePath does not match Decision ID " +
        sourceFile.decisionId
    );
  }
}

function scannedDecisionRecord(
  sourceFile: SourceFile,
  sourceDocument: ValidatedDecisionBody | null,
  sourceState: ScannedSourceState,
  indexEntry: DecisionStoredIndexEntry | null
): DecisionRecord {
  const metadata = scannedSourceMetadata(sourceDocument, indexEntry);
  return {
    activationCandidate: sourceState.activationCandidate,
    bodyReady: sourceState.bodyReady,
    scaffoldValid: sourceState.scaffoldValid,
    alignment: metadata.alignment,
    createdAt: metadata.createdAt,
    decisionId: sourceFile.decisionId,
    decisionPath: sourceFile.decisionPath,
    document: sourceState.document,
    markdownExists: true,
    projection: metadata.projection,
    relationshipErrors: [],
    source: sourceState.source,
    sourcePath: sourceFile.sourcePath,
    status: metadata.status,
    tags: metadata.tags
  };
}

function scannedSourceMetadata(
  sourceDocument: ValidatedDecisionBody | null,
  indexEntry: DecisionStoredIndexEntry | null
): ScannedSourceMetadata {
  if (sourceDocument !== null) {
    return {
      alignment: sourceDocument.alignment,
      createdAt: sourceDocument.createdAt,
      projection: selectProjection(sourceDocument),
      status: sourceDocument.status,
      tags: sourceDocument.tags
    };
  }
  return {
    alignment: null,
    createdAt: null,
    projection:
      indexEntry === null
        ? emptyDecisionProjection()
        : selectProjection(indexEntry.state),
    status: null,
    tags: indexEntry?.state.tags ?? []
  };
}

function invalidDecisionRecord(
  sourceFile: SourceFile,
  indexEntry: DecisionStoredIndexEntry | null,
  sourceText: string
): DecisionRecord {
  return {
    activationCandidate: false,
    bodyReady: false,
    scaffoldValid: false,
    alignment: null,
    createdAt: null,
    decisionId: sourceFile.decisionId,
    decisionPath: sourceFile.decisionPath,
    document: null,
    markdownExists: true,
    projection:
      indexEntry === null
        ? emptyDecisionProjection()
        : selectProjection(indexEntry.state),
    relationshipErrors: [],
    source: { kind: "invalid", text: sourceText },
    sourcePath: sourceFile.sourcePath,
    status: null,
    tags: indexEntry?.state.tags ?? []
  };
}

function appendMissingIndexedRecords(
  records: DecisionRecord[],
  index: DecisionIndex | null,
  location: DecisionScanLocation,
  indexErrors: string[]
): void {
  if (index === null) {
    return;
  }
  const recordIds = new Set(records.map((record) => record.decisionId));
  for (const [rawDecisionId, storedEntry] of Object.entries(index.entries)) {
    if (recordIds.has(rawDecisionId)) {
      continue;
    }
    if (!isDecisionId(rawDecisionId)) {
      indexErrors.push(
        location.indexRelativePath +
          " contains invalid Decision ID " +
          rawDecisionId
      );
      continue;
    }
    indexErrors.push(
      missingIndexedDecisionError(location.indexRelativePath, rawDecisionId)
    );
    records.push(
      recordFromIndexEntry({
        decisionsDirectory: location.decisionsDirectory,
        decisionId: rawDecisionId,
        entry: storedEntry
      })
    );
  }
}

function recordFromIndexEntry(options: {
  decisionsDirectory: string;
  decisionId: DecisionId;
  entry: DecisionStoredIndexEntry;
}): DecisionRecord {
  const { decisionsDirectory, decisionId, entry } = options;
  const state = entry.state;
  return {
    activationCandidate: false,
    bodyReady: false,
    scaffoldValid: false,
    alignment: state.alignment,
    createdAt: state.createdAt,
    decisionId,
    decisionPath: path.join(decisionsDirectory, ...state.sourcePath.split("/")),
    document: null,
    markdownExists: false,
    projection: selectProjection(state),
    relationshipErrors: [],
    source: { kind: "missing" },
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

function validateScannedRelationships(
  records: readonly DecisionRecord[],
  sourceErrors: string[]
): void {
  const relationshipIssues = decisionRelationConsistencyIssues(
    records.flatMap((record) =>
      isEstablishedDecisionRecord(record)
        ? [
            {
              decisionId: record.decisionId,
              projection: record.source.document,
              sourcePath: record.sourcePath,
              status: record.source.document.status
            }
          ]
        : []
    )
  );
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  for (const issue of relationshipIssues) {
    sourceErrors.push(issue.message);
    for (const decisionId of issue.sourceIds) {
      recordById.get(decisionId)?.relationshipErrors.push(issue.message);
    }
  }
  for (const candidate of records.filter(
    (record) => record.activationCandidate
  )) {
    for (const relation of candidate.projection.relations) {
      const target = recordById.get(relation.target);
      if (
        target !== undefined &&
        (isEstablishedDecisionRecord(target) || target.activationCandidate)
      ) {
        continue;
      }
      const error =
        candidate.sourcePath +
        " relationship " +
        relation.type +
        " target is not a valid scanned decision: " +
        relation.target;
      sourceErrors.push(error);
      candidate.relationshipErrors.push(error);
    }
  }
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

function emptyDecisionProjection(): DecisionProjection {
  return {
    background: "",
    decision: "",
    purpose: "",
    relations: [],
    title: ""
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

function errorText(error: unknown): string {
  return decisionFileSystemErrorText(error);
}
