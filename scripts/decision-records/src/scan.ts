import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists, toPosix } from "../../lib/filesystem.ts";
import { parseDecisionIndex } from "./decision-index.ts";
import { decisionRelationConsistencyErrors } from "./relation-graph.ts";
import { validateDecisionBody } from "./record.ts";
import type {
  DecisionIndex,
  DecisionRecord,
  DecisionScan,
  DecisionScanOptions
} from "./types.ts";

const indexFileName = "decision-index.json";
const allowedRootFiles = new Set([indexFileName]);
const impactAreaPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

async function scanArea(options: {
  areaId: string;
  areaPath: string;
  currentPaths: Set<string>;
  decisionsDirectory: string;
  errors: string[];
  records: DecisionRecord[];
}): Promise<void> {
  const {
    areaId,
    areaPath,
    currentPaths,
    decisionsDirectory,
    errors,
    records
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
    const metadata = await validateDecisionBody({
      body: await fs.readFile(decisionPath, "utf8"),
      decisionPath,
      decisionsDirectory,
      errors: recordErrors,
      fileName: entry.name,
      relativePath
    });
    errors.push(...recordErrors);
    const current = currentPaths.has(relativePath);
    records.push({
      archived: !current,
      areaId,
      bodyValid: recordErrors.length === 0,
      current,
      decisionPath,
      fileName: entry.name,
      relativePath,
      ...metadata
    });
  }
}

function validateIndexEntries(
  index: DecisionIndex | null,
  records: DecisionRecord[],
  indexRelativePath: string,
  errors: string[]
): void {
  if (!index) {
    return;
  }

  const recordPaths = new Set(records.map((record) => record.relativePath));
  for (const entry of index.current) {
    if (!recordPaths.has(entry.path)) {
      errors.push(indexRelativePath + " references missing decision " + entry.path);
    }
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
  const decisionsLabel = displayPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, indexFileName);
  const indexRelativePath = displayPath(workspaceRoot, indexPath);
  const unavailableScan = (error: string): DecisionScan => ({
    areaIds,
    currentPaths: new Set(),
    decisionsDirectoryAvailable: false,
    decisionsDirectory,
    errors: [error],
    index: null,
    indexExists: false,
    indexPath,
    indexRelativePath,
    indexText: "",
    records,
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
    errors.push(indexRelativePath + " is required");
  }
  const indexText = indexExists ? await fs.readFile(indexPath, "utf8") : "";
  const index = indexText.length > 0
    ? parseDecisionIndex(indexText, indexRelativePath, errors)
    : null;
  const currentPaths = new Set(index?.current.map((entry) => entry.path) ?? []);
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
    if (!impactAreaPattern.test(entry.name)) {
      errors.push("Decision area must use kebab-case: " + entry.name);
    }
    await scanArea({
      areaId: entry.name,
      areaPath: entryPath,
      currentPaths,
      decisionsDirectory,
      errors,
      records
    });
  }

  validateIndexEntries(index, records, indexRelativePath, errors);
  errors.push(...decisionRelationConsistencyErrors(records));

  return {
    areaIds,
    currentPaths,
    decisionsDirectoryAvailable: true,
    decisionsDirectory,
    errors,
    index,
    indexExists,
    indexPath,
    indexRelativePath,
    indexText,
    records,
    workspaceRoot
  };
}
