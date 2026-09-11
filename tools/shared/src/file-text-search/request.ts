import path from "node:path";
import {
  createTextSearchMatcher,
  TextSearchMatcherError,
  type TextSearchMatcher
} from "./segment-matcher.ts";
import type {
  FileTextSearchPreviewPolicy,
  FileTextSearchRequest,
  FileTextSearchResourceLimits,
  FileTextSearchSelection,
  ValidatedRequest
} from "./contracts.ts";
import {
  FileTextSearchError,
  invalidRequest,
  resourceLimit
} from "./contracts.ts";

const defaultResourceLimits = {
  maxCandidateFiles: 10_000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024
} as const;

export function validateRequest(
  request: FileTextSearchRequest
): ValidatedRequest {
  if (request === null || typeof request !== "object") {
    throw invalidRequest("File text search request must be an object.");
  }
  if (typeof request.root !== "string" || request.root.length === 0) {
    throw invalidRequest("File text search root must be a non-empty path.");
  }
  if (request.query === null || typeof request.query !== "object") {
    throw invalidRequest("File text search query must be an object.");
  }
  const query = createFileTextSearchMatcher(request.query);
  if (request.preview === null || typeof request.preview !== "object") {
    throw invalidRequest("File text search preview policy must be an object.");
  }
  validatePreviewPolicy(request.preview);
  const limits = validateResourceLimits(request.limits);
  validateSelection(request.selection, limits.maxCandidateFiles);
  return {
    limits,
    preview: request.preview,
    query,
    root: request.root,
    selection: request.selection,
    signal: request.signal
  };
}

function validateResourceLimits(
  input: FileTextSearchRequest["limits"]
): FileTextSearchResourceLimits {
  if (input !== undefined && (input === null || typeof input !== "object")) {
    throw invalidRequest("File text search resource limits must be an object.");
  }
  const limits = { ...defaultResourceLimits, ...input };
  for (const key of [
    "maxCandidateFiles",
    "maxFileBytes",
    "maxTotalBytes"
  ] as const) {
    if (!isPositiveInteger(limits[key])) {
      throw invalidRequest(
        `File text search ${key} must be a positive integer.`
      );
    }
  }
  return limits;
}

function validatePreviewPolicy(policy: FileTextSearchPreviewPolicy): void {
  if (!isNonNegativeInteger(policy.contextLines)) {
    throw invalidRequest(
      "File text search contextLines must be a non-negative integer."
    );
  }
  for (const key of [
    "maxFiles",
    "maxMatchesPerFile",
    "maxPreviewCharacters"
  ] as const) {
    if (!isPositiveInteger(policy[key])) {
      throw invalidRequest(
        `File text search ${key} must be a positive integer.`
      );
    }
  }
}

function validateSelection(
  selection: FileTextSearchSelection,
  maxCandidateFiles: number
): void {
  if (selection === null || typeof selection !== "object") {
    throw invalidRequest("File text search selection must be an object.");
  }
  if (selection.kind === "files") {
    validateFileSelection(selection, maxCandidateFiles);
    return;
  }
  if (selection.kind === "patterns") {
    validatePatternSelection(selection);
    return;
  }
  throw invalidRequest("File text search selection kind is unsupported.");
}

function validateFileSelection(
  selection: Extract<FileTextSearchSelection, { kind: "files" }>,
  maxCandidateFiles: number
): void {
  if ("include" in selection || "exclude" in selection) {
    throw invalidRequest(
      "File text search selection must use either files or patterns."
    );
  }
  if (!Array.isArray(selection.sourcePaths)) {
    throw invalidRequest(
      "File text search file selection must contain sourcePaths."
    );
  }
  if (selection.sourcePaths.length > maxCandidateFiles) {
    throw resourceLimit("File text search candidate file limit was exceeded.");
  }
  for (const sourcePath of selection.sourcePaths) parseSourcePath(sourcePath);
}

function validatePatternSelection(
  selection: Extract<FileTextSearchSelection, { kind: "patterns" }>
): void {
  if ("sourcePaths" in selection) {
    throw invalidRequest(
      "File text search selection must use either files or patterns."
    );
  }
  validatePatterns(selection.include, "include", false);
  if (selection.exclude !== undefined) {
    validatePatterns(selection.exclude, "exclude", true);
  }
}

function validatePatterns(
  patterns: unknown,
  name: string,
  allowEmpty: boolean
): void {
  if (!Array.isArray(patterns) || (!allowEmpty && patterns.length === 0)) {
    throw invalidRequest(
      `File text search ${name} patterns must not be empty.`
    );
  }
  for (const pattern of patterns) validatePattern(pattern, name);
}

function validatePattern(pattern: unknown, name: string): void {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw invalidRequest(
      `File text search ${name} patterns must be non-empty strings.`
    );
  }
  const escapesRoot =
    pattern.includes("\\") ||
    path.posix.isAbsolute(pattern) ||
    path.win32.isAbsolute(pattern) ||
    pattern.split("/").includes("..") ||
    pattern.startsWith("!");
  if (escapesRoot) {
    throw new FileTextSearchError({
      code: "invalid-path",
      message:
        "File text search patterns must remain below the collection root."
    });
  }
}

export function parseSourcePath(sourcePath: unknown): string {
  if (
    typeof sourcePath !== "string" ||
    sourcePath.length === 0 ||
    sourcePath.includes("\\") ||
    sourcePath.includes("\0") ||
    path.posix.isAbsolute(sourcePath) ||
    path.win32.isAbsolute(sourcePath)
  ) {
    throw new FileTextSearchError({
      code: "invalid-path",
      message:
        "File text search source paths must be root-relative POSIX paths."
    });
  }
  const segments = sourcePath.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw new FileTextSearchError({
      code: "invalid-path",
      message:
        "File text search source paths must remain below the collection root."
    });
  }
  return segments.join("/");
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function createFileTextSearchMatcher(
  query: FileTextSearchRequest["query"]
): TextSearchMatcher {
  try {
    return createTextSearchMatcher(query);
  } catch (error) {
    if (error instanceof TextSearchMatcherError) {
      throw invalidRequest(
        error.message.replace("Text search", "File text search")
      );
    }
    throw error;
  }
}
