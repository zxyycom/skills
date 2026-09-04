import path from "node:path";
import { toPosix } from "../../shared/src/node/filesystem.ts";
import type { DecisionId, DecisionSourcePath, DecisionTag } from "./types.ts";

const decisionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const decisionKebabCaseIdPatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const decisionIdPatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const decisionSourcePathPatternSource =
  "^(?:[a-z0-9]+(?:-[a-z0-9]+)*\\.md|archive/[a-z0-9]+(?:-[a-z0-9]+)*\\.md)$";
const decisionSourcePathPattern = new RegExp(
  decisionSourcePathPatternSource,
  "u"
);
export function isDecisionId(value: unknown): value is DecisionId {
  return typeof value === "string" && decisionIdPattern.test(value);
}

/** Normalizes one former Markdown-suffixed selector at an input boundary. */
export function normalizeDecisionIdInput(value: string): DecisionId | null {
  const normalized = value.replace(/\.md$/iu, "");
  return isDecisionId(normalized) ? normalized : null;
}

export function isDecisionSourcePath(
  value: unknown
): value is DecisionSourcePath {
  return typeof value === "string" && decisionSourcePathPattern.test(value);
}

/**
 * Reads the former basename-derived identifier only for historical Git
 * comparisons. Current collection identity is always frontmatter `id`.
 */
export function decisionIdFromSourcePath(value: string): DecisionId | null {
  if (!isDecisionSourcePath(value)) return null;
  const basename = value.startsWith("archive/")
    ? value.slice("archive/".length)
    : value;
  const id = basename.slice(0, -".md".length);
  return isDecisionId(id) ? id : null;
}

export function isArchivedDecisionSourcePath(
  value: unknown
): value is DecisionSourcePath {
  return (
    typeof value === "string" &&
    value.startsWith("archive/") &&
    isDecisionSourcePath(value)
  );
}

export function sourcePathForDecision(
  decisionId: string,
  status: "active" | "archived" | "candidate"
): DecisionSourcePath {
  if (!isDecisionId(decisionId)) {
    throw new Error("cannot derive a source path from an invalid Decision ID");
  }
  const basename = decisionId + ".md";
  const sourcePath = status === "archived" ? "archive/" + basename : basename;
  if (!isDecisionSourcePath(sourcePath)) {
    throw new Error("derived decision source path is invalid: " + sourcePath);
  }
  return sourcePath;
}

/**
 * Applies the lifecycle storage location while preserving the chosen
 * Markdown basename. A source path is storage, not an identity encoding.
 */
export function sourcePathForDecisionStatus(
  sourcePath: string,
  status: "active" | "archived" | "candidate"
): DecisionSourcePath | null {
  if (!isDecisionSourcePath(sourcePath)) return null;
  const basename = sourcePath.startsWith("archive/")
    ? sourcePath.slice("archive/".length)
    : sourcePath;
  const next = status === "archived" ? "archive/" + basename : basename;
  return isDecisionSourcePath(next) ? next : null;
}

export function displayDecisionPath(
  workspaceRoot: string,
  targetPath: string
): string {
  const relativePath = path.relative(workspaceRoot, targetPath);
  if (relativePath === "") {
    return ".";
  }
  if (
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep) ||
    path.isAbsolute(relativePath)
  ) {
    return targetPath;
  }
  return toPosix(relativePath);
}

export function isDecisionTag(value: unknown): value is DecisionTag {
  return typeof value === "string" && tagPattern.test(value);
}
