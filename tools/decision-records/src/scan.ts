import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists, toPosix } from "../../shared/src/node/filesystem.ts";
import {
  isDecisionTopicId,
  isNewDecisionIdentityPath
} from "./decision-path.ts";
import {
  parseDecisionIndex,
  type DecisionIndexEntry
} from "./decision-index.ts";
import { decisionRelationConsistencyErrors } from "./relation-graph.ts";
import { validateDecisionBody } from "./record.ts";
import { decisionMetadataFromCandidate } from "./decision-metadata.ts";
import {
  compareDecisionRecords,
  type DecisionIndex,
  type DecisionProjection,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

const indexFileName = "decision-index.json";
const allowedRootFiles = new Set([indexFileName]);

function displayPath(workspaceRoot: string, targetPath: string): string {
  const relativePath = path.relative(workspaceRoot, targetPath);
  if (relativePath === "") {
    return ".";
  }
  if (relativePath === ".."
    || relativePath.startsWith(".." + path.sep)
    || path.isAbsolute(relativePath)) {
    return targetPath;
  }

  return toPosix(relativePath);
}

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
  const pathParts = entry.path.split("/");
  const fileName = pathParts.at(-1) ?? entry.path;
  return {
    activationCandidate: false,
    alignment: entry.alignment,
    areaId: pathParts[0] ?? "",
    bodyValid: false,
    createdAt: entry.createdAt,
    decisionPath: path.join(decisionsDirectory, ...pathParts),
    document: null,
    fileName,
    indexed: true,
    markdownExists: false,
    projection: selectProjection(entry),
    relativePath: entry.path,
    status: entry.status
  };
}

async function scanArea(options: {
  activationCandidateErrors: string[];
  areaId: string;
  areaPath: string;
  decisionsDirectory: string;
  indexErrors: string[];
  indexEntryByPath: ReadonlyMap<string, DecisionIndexEntry> | null;
  indexRelativePath: string;
  records: DecisionRecord[];
  sourceErrors: string[];
}): Promise<void> {
  const {
    activationCandidateErrors,
    areaId,
    areaPath,
    decisionsDirectory,
    indexErrors,
    indexEntryByPath,
    indexRelativePath,
    records,
    sourceErrors
  } = options;
  const areaEntries = await fs.readdir(areaPath, { withFileTypes: true });
  areaEntries.sort((left, right) => left.name.localeCompare(right.name));

  if (!areaEntries.some((entry) => entry.isFile() && entry.name.endsWith(".md"))) {
    sourceErrors.push("Decision area must contain at least one decision file: " + areaId);
  }

  for (const entry of areaEntries) {
    const decisionPath = path.join(areaPath, entry.name);
    const relativePath = toPosix(path.relative(decisionsDirectory, decisionPath));
    if (entry.isDirectory()) {
      sourceErrors.push("Decision area must not contain nested directories: " + relativePath);
      continue;
    }
    if (!entry.isFile()) {
      sourceErrors.push("Decision area contains unsupported entry: " + relativePath);
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      sourceErrors.push("Decision area must contain only Markdown files: " + relativePath);
      continue;
    }

    const indexEntry = indexEntryByPath?.get(relativePath) ?? null;
    const recordErrors: string[] = [];
    const sourceDocument = await validateDecisionBody({
      allowNullCreatedAt: indexEntry === null,
      body: await fs.readFile(decisionPath, "utf8"),
      decisionPath,
      decisionsDirectory,
      errors: recordErrors,
      fileName: entry.name,
      relativePath
    });
    const activationCandidate = indexEntry === null
      && isNewDecisionIdentityPath(relativePath)
      && sourceDocument?.status === "active"
      && sourceDocument.alignment !== null
      && sourceDocument.createdAt === null;
    if (sourceDocument?.createdAt === null && !activationCandidate) {
      recordErrors.push(
        relativePath
        + " createdAt: null is allowed only for an unindexed new decision "
        + "identity with status: active and alignment: aligned or unaligned"
      );
    }
    const establishedMetadata = sourceDocument
      ? decisionMetadataFromCandidate(sourceDocument)
      : null;
    const document = sourceDocument && establishedMetadata
      ? { ...selectProjection(sourceDocument), ...establishedMetadata }
      : null;

    if (indexEntryByPath && !indexEntry) {
      const message = activationCandidate
        ? activationCandidateError(relativePath)
        : unindexedDecisionError(indexRelativePath, relativePath);
      indexErrors.push(message);
      if (activationCandidate) {
        activationCandidateErrors.push(message);
      }
    }
    sourceErrors.push(...recordErrors);

    records.push({
      activationCandidate,
      alignment: indexEntry?.alignment ?? sourceDocument?.alignment ?? null,
      areaId,
      bodyValid: recordErrors.length === 0,
      createdAt: indexEntry?.createdAt ?? sourceDocument?.createdAt ?? null,
      decisionPath,
      document,
      fileName: entry.name,
      indexed: indexEntry !== null,
      markdownExists: true,
      projection: indexEntry
        ? selectProjection(indexEntry)
        : sourceDocument
          ? selectProjection(sourceDocument)
          : {
              background: "",
              decision: "",
              purpose: "",
              relations: [],
              title: ""
            },
      relativePath,
      status: indexEntry?.status ?? sourceDocument?.status ?? null
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
  for (const entry of index.records) {
    if (recordPaths.has(entry.path)) {
      continue;
    }
    indexErrors.push(missingIndexedDecisionError(indexRelativePath, entry.path));
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
  const indexErrors: string[] = [];
  const sourceErrors: string[] = [];
  const records: DecisionRecord[] = [];
  const areaIds = new Set<string>();
  const decisionsLabel = displayPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, indexFileName);
  const indexRelativePath = displayPath(workspaceRoot, indexPath);
  const unavailableScan = (error: string): DecisionScan => ({
    activationCandidateErrors,
    areaIds,
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
  if (!indexExists) {
    const message = decisionIndexRequiredError(indexRelativePath);
    indexErrors.push(message);
  }
  const indexText = indexExists ? await fs.readFile(indexPath, "utf8") : "";
  const index = indexText.length > 0
    ? parseDecisionIndex(indexText, indexRelativePath, indexErrors)
    : null;
  const indexEntryByPath = index
    ? new Map(index.records.map((entry) => [entry.path, entry]))
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

    areaIds.add(entry.name);
    if (!isDecisionTopicId(entry.name)) {
      sourceErrors.push("Decision area must use kebab-case: " + entry.name);
    }
    await scanArea({
      activationCandidateErrors,
      areaId: entry.name,
      areaPath: entryPath,
      decisionsDirectory,
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
  records.sort(compareDecisionRecords);
  sourceErrors.push(...decisionRelationConsistencyErrors(
    records.filter((record) => record.document !== null || record.activationCandidate)
  ));

  const errors = [...sourceErrors, ...indexErrors];

  return {
    activationCandidateErrors,
    areaIds,
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
