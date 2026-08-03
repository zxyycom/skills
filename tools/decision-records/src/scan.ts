import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists, toPosix } from "../../shared/src/node/filesystem.ts";
import {
  decisionDomainFromRelativePath,
  displayDecisionPath,
  isDecisionDomainId,
  isNewDecisionIdentityPath
} from "./decision-path.ts";
import {
  decisionDomainCatalogFileName,
  loadDecisionDomainCatalog
} from "./decision-domain-catalog.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  parseDecisionIndex
} from "./decision-state-index.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import { validateDecisionBody } from "./record.ts";
import { decisionMetadataFromCandidate } from "./decision-metadata.ts";
import {
  compareDecisionRecords,
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionProjection,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

const allowedRootFiles = new Set([
  decisionDomainCatalogFileName,
  decisionIndexFileName
]);

export function unindexedDecisionError(
  indexRelativePath: string,
  relativePath: string
): string {
  return indexRelativePath + " does not include decision " + relativePath;
}

export function activationCandidateError(relativePath: string): string {
  return "Unactivated decision candidate must be activated or discarded before "
    + "strict check: "
    + relativePath;
}

export function decisionIndexRequiredError(indexRelativePath: string): string {
  return indexRelativePath + " is required";
}

export function missingIndexedDecisionError(
  indexRelativePath: string,
  relativePath: string
): string {
  return indexRelativePath + " references missing decision " + relativePath;
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

function recordFromIndexEntry(options: {
  decisionsDirectory: string;
  entry: DecisionIndexEntry;
}): DecisionRecord {
  const { decisionsDirectory, entry } = options;
  const state = entry.state;
  const pathParts = state.path.split("/");
  const fileName = pathParts.at(-1) ?? state.path;
  return {
    activationCandidate: false,
    alignment: state.alignment,
    bodyValid: false,
    createdAt: state.createdAt,
    decisionPath: path.join(decisionsDirectory, ...pathParts),
    document: null,
    domain: decisionDomainFromRelativePath(state.path) ?? "",
    fileName,
    indexed: true,
    markdownExists: false,
    projection: selectProjection(state),
    relativePath: state.path,
    relationshipErrors: [],
    status: state.status
  };
}

async function scanDomainDirectory(options: {
  activationCandidateErrors: string[];
  decisionsDirectory: string;
  domainId: string;
  domainPath: string;
  indexEntryByPath: ReadonlyMap<string, DecisionIndexEntry> | null;
  indexErrors: string[];
  indexRelativePath: string;
  records: DecisionRecord[];
  sourceErrors: string[];
}): Promise<void> {
  const {
    activationCandidateErrors,
    decisionsDirectory,
    domainId,
    domainPath,
    indexEntryByPath,
    indexErrors,
    indexRelativePath,
    records,
    sourceErrors
  } = options;
  const domainEntries = await fs.readdir(domainPath, { withFileTypes: true });
  domainEntries.sort((left, right) => left.name.localeCompare(right.name));

  if (!domainEntries.some((entry) => (
    entry.isFile() && entry.name.endsWith(".md")
  ))) {
    sourceErrors.push(
      "Decision domain directory must contain at least one decision file: " + domainId
    );
  }

  for (const entry of domainEntries) {
    const decisionPath = path.join(domainPath, entry.name);
    const relativePath = toPosix(path.relative(decisionsDirectory, decisionPath));
    if (entry.isDirectory()) {
      sourceErrors.push(
        "Decision domain directory must not contain nested directories: " + relativePath
      );
      continue;
    }
    if (!entry.isFile()) {
      sourceErrors.push(
        "Decision domain directory contains unsupported entry: " + relativePath
      );
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      sourceErrors.push(
        "Decision domain directory must contain only Markdown files: " + relativePath
      );
      continue;
    }

    const indexEntry = indexEntryByPath?.get(relativePath) ?? null;
    const recordErrors: string[] = [];
    const sourceText = await fs.readFile(decisionPath, "utf8");
    const sourceDocument = await validateDecisionBody({
      allowNullCreatedAt: true,
      body: sourceText,
      decisionsDirectory,
      errors: recordErrors,
      fileName: entry.name,
      relativePath
    });
    const activationCandidate = recordErrors.length === 0
      && isNewDecisionIdentityPath(relativePath)
      && sourceDocument?.status === "active"
      && sourceDocument.alignment !== null
      && sourceDocument.createdAt === null;
    if (sourceDocument?.createdAt === null && !activationCandidate) {
      recordErrors.push(
        relativePath
        + " createdAt: null is allowed only for a current-format new decision "
        + "identity with status: active and alignment: aligned or unaligned"
      );
    }
    const establishedMetadata = sourceDocument
      ? decisionMetadataFromCandidate(sourceDocument)
      : null;
    const document = recordErrors.length === 0
      && sourceDocument
      && establishedMetadata
      ? { ...selectProjection(sourceDocument), ...establishedMetadata }
      : null;

    if (activationCandidate) {
      const message = activationCandidateError(relativePath);
      indexErrors.push(message);
      activationCandidateErrors.push(message);
    } else if (document !== null && !indexEntry) {
      indexErrors.push(unindexedDecisionError(indexRelativePath, relativePath));
    }
    sourceErrors.push(...recordErrors);

    records.push({
      activationCandidate,
      alignment: sourceDocument?.alignment ?? null,
      bodyValid: recordErrors.length === 0,
      createdAt: sourceDocument?.createdAt ?? null,
      decisionPath,
      document,
      domain: domainId,
      fileName: entry.name,
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
      relativePath,
      relationshipErrors: [],
      status: sourceDocument?.status ?? null
    });
  }
}

function addMissingIndexRecords(options: {
  decisionsDirectory: string;
  indexErrors: string[];
  index: DecisionIndex | null;
  indexRelativePath: string;
  records: DecisionRecord[];
}): void {
  const {
    decisionsDirectory,
    indexErrors,
    index,
    indexRelativePath,
    records
  } = options;
  if (!index) {
    return;
  }

  const recordPaths = new Set(records.map((record) => record.relativePath));
  for (const entry of index.entries) {
    if (recordPaths.has(entry.id)) {
      continue;
    }
    indexErrors.push(missingIndexedDecisionError(indexRelativePath, entry.id));
    records.push(recordFromIndexEntry({ decisionsDirectory, entry }));
  }
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
  const domainErrors: string[] = [];
  const domainIds = new Set<string>();
  const indexErrors: string[] = [];
  const sourceErrors: string[] = [];
  const records: DecisionRecord[] = [];
  const decisionsLabel = displayDecisionPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(workspaceRoot, indexPath);
  const unavailableScan = (error: string): DecisionScan => ({
    activationCandidateErrors,
    decisionsDirectoryAvailable: false,
    decisionsDirectory,
    domainErrors,
    domainIds,
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

  const domainCatalogPath = path.join(
    decisionsDirectory,
    decisionDomainCatalogFileName
  );
  const domainCatalogRelativePath = displayDecisionPath(
    workspaceRoot,
    domainCatalogPath
  );
  const loadedDomainCatalog = await loadDecisionDomainCatalog(
    domainCatalogPath,
    domainCatalogRelativePath
  );
  if (loadedDomainCatalog.status === "error") {
    domainErrors.push(...loadedDomainCatalog.errors);
    sourceErrors.push(...loadedDomainCatalog.errors);
  } else {
    for (const domain of loadedDomainCatalog.value.domains) {
      domainIds.add(domain.id);
    }
  }
  const knownDomainIds = loadedDomainCatalog.status === "error"
    ? null
    : domainIds;

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
  const indexEntryByPath = index
    ? new Map(index.entries.map((entry) => [entry.id, entry]))
    : null;
  const rootEntries = await fs.readdir(decisionsDirectory, { withFileTypes: true });
  rootEntries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of rootEntries) {
    const entryPath = path.join(decisionsDirectory, entry.name);
    if (entry.isFile()) {
      if (!allowedRootFiles.has(entry.name)) {
        sourceErrors.push(decisionsLabel + " root contains unsupported file " + entry.name);
      }
      continue;
    }
    if (!entry.isDirectory()) {
      sourceErrors.push(decisionsLabel + " contains unsupported entry " + entry.name);
      continue;
    }

    if (!isDecisionDomainId(entry.name)) {
      sourceErrors.push(
        "Decision domain directory must use kebab-case: " + entry.name
      );
    }
    if (knownDomainIds !== null && !knownDomainIds.has(entry.name)) {
      const error = (
        "Decision domain directory is not defined in "
        + decisionDomainCatalogFileName
        + ": "
        + entry.name
      );
      domainErrors.push(error);
      sourceErrors.push(error);
    }
    await scanDomainDirectory({
      activationCandidateErrors,
      decisionsDirectory,
      domainId: entry.name,
      domainPath: entryPath,
      indexErrors,
      indexEntryByPath,
      indexRelativePath,
      records,
      sourceErrors
    });
  }

  addMissingIndexRecords({
    decisionsDirectory,
    indexErrors,
    index,
    indexRelativePath,
    records
  });
  if (!indexExists && records.some((record) => record.document !== null)) {
    indexErrors.push(decisionIndexRequiredError(indexRelativePath));
  }
  records.sort(compareDecisionRecords);
  const relationshipIssues = decisionRelationConsistencyIssues(
    records.filter((record) => record.document !== null || record.activationCandidate)
  );
  const recordByPath = new Map(records.map((record) => [
    record.relativePath,
    record
  ]));
  for (const issue of relationshipIssues) {
    sourceErrors.push(issue.message);
    for (const sourcePath of issue.sourcePaths) {
      recordByPath.get(sourcePath)?.relationshipErrors.push(issue.message);
    }
  }

  const errors = [...sourceErrors, ...indexErrors];

  return {
    activationCandidateErrors,
    decisionsDirectoryAvailable: true,
    decisionsDirectory,
    domainErrors,
    domainIds,
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
