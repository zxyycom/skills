import fs from "node:fs/promises";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { decisionFileSystemErrorText } from "./application-result.ts";
import {
  decisionIndexDiagnosticMessages,
  parseDecisionIndex
} from "./decision-state-index.ts";
import type { DecisionIndex } from "./types.ts";

export type LoadedDecisionIndex = {
  index: DecisionIndex | null;
  indexExists: boolean;
  indexText: string;
};

type IndexLocation = { indexPath: string; indexRelativePath: string };
type IndexEntryState = "missing" | "invalid" | "regular";

export async function loadDecisionIndexForScan(
  location: IndexLocation,
  indexErrors: string[]
): Promise<LoadedDecisionIndex> {
  const entryState = await inspectIndexEntry(location, indexErrors);
  if (entryState === "missing")
    return { index: null, indexExists: false, indexText: "" };
  if (entryState === "invalid")
    return { index: null, indexExists: true, indexText: "" };
  return readRegularDecisionIndex(location, indexErrors);
}

async function inspectIndexEntry(
  location: IndexLocation,
  indexErrors: string[]
): Promise<IndexEntryState> {
  let entry;
  try {
    entry = await fs.lstat(location.indexPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return "missing";
    indexErrors.push(
      location.indexRelativePath +
        " could not be inspected: " +
        decisionFileSystemErrorText(error)
    );
    return "missing";
  }
  if (!entry.isSymbolicLink() && entry.isFile()) return "regular";
  indexErrors.push(
    location.indexRelativePath +
      " must be a regular non-symbolic-link JSON file"
  );
  return "invalid";
}

async function readRegularDecisionIndex(
  location: IndexLocation,
  indexErrors: string[]
): Promise<LoadedDecisionIndex> {
  let indexText: string;
  try {
    indexText = await fs.readFile(location.indexPath, "utf8");
  } catch (error) {
    indexErrors.push(
      location.indexRelativePath +
        " could not be read: " +
        decisionFileSystemErrorText(error)
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
