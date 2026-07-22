import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists, toPosix } from "../../lib/filesystem.ts";
import { isDecisionTopicId } from "./decision-path.ts";
import {
  parseDecisionIndex,
  type DecisionIndexEntry
} from "./decision-index.ts";
import { decisionRelationConsistencyErrors } from "./relation-graph.ts";
import { validateDecisionBody } from "./record.ts";
import {
  compareDecisionRecords,
  type DecisionDocument,
  type DecisionIndexMembershipIssue,
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

function unindexedDecisionError(
  indexRelativePath: string,
  relativePath: string
): string {
  return indexRelativePath + " does not include decision " + relativePath;
}

function selectProjection(
  source: DecisionDocument | DecisionIndexEntry
): DecisionProjection {
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
  areaId: string;
  areaPath: string;
  decisionsDirectory: string;
  errors: string[];
  indexEntryByPath: ReadonlyMap<string, DecisionIndexEntry> | null;
  indexMembershipIssues: DecisionIndexMembershipIssue[];
  indexRelativePath: string;
  records: DecisionRecord[];
  unindexedPaths: Set<string>;
}): Promise<void> {
  const {
    areaId,
    areaPath,
    decisionsDirectory,
    errors,
    indexEntryByPath,
    indexMembershipIssues,
    indexRelativePath,
    records,
    unindexedPaths
  } = options;
  const areaEntries = await fs.readdir(areaPath, { withFileTypes: true });
  areaEntries.sort((left, right) => left.name.localeCompare(right.name));

  if (!areaEntries.some((entry) => entry.isFile() && entry.name.endsWith(".md"))) {
    errors.push("Decision area must contain at least one decision file: " + areaId);
  }

  for (const entry of areaEntries) {
    const decisionPath = path.join(areaPath, entry.name);
    const relativePath = toPosix(path.relative(decisionsDirectory, decisionPath));
    if (entry.isDirectory()) {
      errors.push("Decision area must not contain nested directories: " + relativePath);
      continue;
    }
    if (!entry.isFile()) {
      errors.push("Decision area contains unsupported entry: " + relativePath);
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      errors.push("Decision area must contain only Markdown files: " + relativePath);
      continue;
    }

    const recordErrors: string[] = [];
    const document = await validateDecisionBody({
      body: await fs.readFile(decisionPath, "utf8"),
      decisionPath,
      decisionsDirectory,
      errors: recordErrors,
      fileName: entry.name,
      relativePath
    });
    errors.push(...recordErrors);

    const indexEntry = indexEntryByPath?.get(relativePath) ?? null;
    if (indexEntryByPath && !indexEntry) {
      unindexedPaths.add(relativePath);
      const message = unindexedDecisionError(indexRelativePath, relativePath);
      errors.push(message);
      indexMembershipIssues.push({
        kind: "unindexed-decision",
        message,
        path: relativePath
      });
    }

    records.push({
      areaId,
      bodyValid: recordErrors.length === 0,
      createdAt: indexEntry?.createdAt ?? null,
      decisionPath,
      document,
      fileName: entry.name,
      indexed: indexEntry !== null,
      markdownExists: true,
      projection: selectProjection(indexEntry ?? document),
      relativePath,
      status: indexEntry?.status ?? null
    });
  }
}

function addMissingIndexRecords(options: {
  decisionsDirectory: string;
  errors: string[];
  index: DecisionIndex | null;
  indexRelativePath: string;
  records: DecisionRecord[];
}): void {
  const {
    decisionsDirectory,
    errors,
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
    errors.push(indexRelativePath + " references missing decision " + entry.path);
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
  const errors: string[] = [];
  const records: DecisionRecord[] = [];
  const areaIds = new Set<string>();
  const indexMembershipIssues: DecisionIndexMembershipIssue[] = [];
  const unindexedPaths = new Set<string>();
  const decisionsLabel = displayPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, indexFileName);
  const indexRelativePath = displayPath(workspaceRoot, indexPath);
  const unavailableScan = (error: string): DecisionScan => ({
    areaIds,
    decisionsDirectoryAvailable: false,
    decisionsDirectory,
    errors: [error],
    index: null,
    indexExists: false,
    indexMembershipIssues,
    indexPath,
    indexRelativePath,
    indexText: "",
    records,
    unindexedPaths,
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
    const message = indexRelativePath + " is required";
    errors.push(message);
    indexMembershipIssues.push({ kind: "missing-index", message });
  }
  const indexText = indexExists ? await fs.readFile(indexPath, "utf8") : "";
  const index = indexText.length > 0
    ? parseDecisionIndex(indexText, indexRelativePath, errors)
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
        errors.push(decisionsLabel + " root contains unsupported file " + entry.name);
      }
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(decisionsLabel + " contains unsupported entry " + entry.name);
      continue;
    }

    areaIds.add(entry.name);
    if (!isDecisionTopicId(entry.name)) {
      errors.push("Decision area must use kebab-case: " + entry.name);
    }
    await scanArea({
      areaId: entry.name,
      areaPath: entryPath,
      decisionsDirectory,
      errors,
      indexEntryByPath,
      indexMembershipIssues,
      indexRelativePath,
      records,
      unindexedPaths
    });
  }

  addMissingIndexRecords({
    decisionsDirectory,
    errors,
    index,
    indexRelativePath,
    records
  });
  records.sort(compareDecisionRecords);
  errors.push(...decisionRelationConsistencyErrors(
    records.filter((record) => record.indexed)
  ));

  return {
    areaIds,
    decisionsDirectoryAvailable: true,
    decisionsDirectory,
    errors,
    index,
    indexExists,
    indexMembershipIssues,
    indexPath,
    indexRelativePath,
    indexText,
    records,
    unindexedPaths,
    workspaceRoot
  };
}
