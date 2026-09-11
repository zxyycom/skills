import fs from "node:fs/promises";
import {
  decisionIdFromMarkdown,
  establishedDecisionMetadataFromSource
} from "./decision-metadata.ts";
import { isDecisionSourcePath } from "./decision-path.ts";
import { validateDecisionBody, type ValidatedDecisionBody } from "./record.ts";
import {
  emptyDecisionProjection,
  selectProjection,
  unindexedDecisionError
} from "./scan-relations.ts";
import { errorText } from "./scan-support.ts";
import type {
  CandidateSourceState,
  DecisionStoredIndexEntry,
  ScannedSourceMetadata,
  ScannedSourceState,
  SourceFile
} from "./scan-contracts.ts";
import type { DecisionId, DecisionIndex, DecisionRecord } from "./types.ts";

type ScanSourceContext = {
  availableDecisionIds: ReadonlySet<DecisionId>;
  index: DecisionIndex | null;
  indexErrors: string[];
  indexRelativePath: string;
  sourceErrors: string[];
};

export async function scanSourceFiles(options: {
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
  context: ScanSourceContext
): Promise<DecisionRecord> {
  const sourceText = await readSourceText(sourceFile, context.sourceErrors);
  return sourceText === null
    ? invalidDecisionRecord(sourceFile, null, "")
    : scanReadableSourceFile(sourceFile, sourceText, context);
}

async function readSourceText(
  sourceFile: SourceFile,
  sourceErrors: string[]
): Promise<string | null> {
  try {
    return (
      sourceFile.sourceText ??
      (await fs.readFile(sourceFile.decisionPath, "utf8"))
    );
  } catch (error) {
    sourceErrors.push(
      sourceFile.sourcePath + " could not be read: " + errorText(error)
    );
    return null;
  }
}

async function scanReadableSourceFile(
  sourceFile: SourceFile,
  sourceText: string,
  context: ScanSourceContext
): Promise<DecisionRecord> {
  const decisionId = decisionIdFromMarkdown(sourceText);
  const indexEntry = indexedSourceEntry(context.index, decisionId);
  const recordErrors: string[] = [];
  const sourceDocument = await validateDecisionBody({
    body: sourceText,
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
    sourceDocument?.decisionId ?? null,
    sourceState.document,
    indexEntry,
    context
  );
  context.sourceErrors.push(...recordErrors);
  return scannedDecisionRecord(
    sourceFile,
    decisionId,
    sourceDocument,
    sourceState,
    indexEntry
  );
}

function indexedSourceEntry(
  index: DecisionIndex | null,
  decisionId: DecisionId | null
): DecisionStoredIndexEntry | null {
  return index !== null &&
    decisionId !== null &&
    Object.hasOwn(index.entries, decisionId)
    ? index.entries[decisionId]
    : null;
}

function scannedSourceState(
  sourceFile: SourceFile,
  sourceText: string,
  sourceDocument: ValidatedDecisionBody | null,
  indexEntry: DecisionStoredIndexEntry | null,
  recordErrors: string[]
): ScannedSourceState {
  const validDecisionId = sourceDocument !== null;
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
  const hasValidPath = isDecisionSourcePath(sourceFile.sourcePath);
  const archived = sourceFile.sourcePath.startsWith("archive/");
  const statusMatchesPath =
    sourceDocument !== null &&
    ((sourceDocument.status === "archived" && archived) ||
      (sourceDocument.status !== "archived" && !archived));
  if (!hasValidPath || !validDecisionId || !statusMatchesPath) {
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
  const scaffoldValid = isCandidateScaffold(
    sourceDocument,
    validDecisionId,
    indexEntry,
    recordErrors
  );
  if (sourceDocument?.status === "candidate" && !scaffoldValid) {
    recordErrors.push(
      sourceFile.sourcePath +
        " candidate status is allowed only for an unindexed, " +
        "current-format Decision scaffold"
    );
  }
  const bodyReady = scaffoldValid && sourceDocument?.bodyReady === true;
  return { activationCandidate: bodyReady, bodyReady, scaffoldValid };
}

function isCandidateScaffold(
  sourceDocument: ValidatedDecisionBody | null,
  validDecisionId: boolean,
  indexEntry: DecisionStoredIndexEntry | null,
  recordErrors: readonly string[]
): boolean {
  if (!validDecisionId || recordErrors.length > 0 || indexEntry !== null)
    return false;
  if (sourceDocument?.status !== "candidate") return false;
  if (sourceDocument.alignment !== null) return false;
  return sourceDocument.createdAt === null;
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
  decisionId: DecisionId | null,
  document: DecisionRecord["document"],
  indexEntry: DecisionStoredIndexEntry | null,
  context: {
    indexErrors: string[];
    indexRelativePath: string;
  }
): void {
  if (document !== null && decisionId !== null && indexEntry === null) {
    context.indexErrors.push(
      unindexedDecisionError(context.indexRelativePath, decisionId)
    );
  }
  if (
    document !== null &&
    indexEntry !== null &&
    indexEntry.sourcePath !== sourceFile.sourcePath
  ) {
    context.indexErrors.push(
      context.indexRelativePath +
        " sourcePath does not match Decision ID " +
        (decisionId ?? sourceFile.sourcePath)
    );
  }
}

function scannedDecisionRecord(
  sourceFile: SourceFile,
  declaredDecisionId: DecisionId | null,
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
    decisionId:
      sourceDocument?.decisionId ?? declaredDecisionId ?? sourceFile.sourcePath,
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
        : selectProjection(indexEntry),
    status: null,
    tags: indexEntry?.tags ?? []
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
    decisionId: sourceFile.sourcePath,
    decisionPath: sourceFile.decisionPath,
    document: null,
    markdownExists: true,
    projection:
      indexEntry === null
        ? emptyDecisionProjection()
        : selectProjection(indexEntry),
    relationshipErrors: [],
    source: { kind: "invalid", text: sourceText },
    sourcePath: sourceFile.sourcePath,
    status: null,
    tags: indexEntry?.tags ?? []
  };
}
