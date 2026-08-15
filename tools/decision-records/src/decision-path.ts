import path from "node:path";
import { toPosix } from "../../shared/src/node/filesystem.ts";
import type { DecisionId, DecisionSourcePath, DecisionTag } from "./types.ts";

const decisionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const tagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const decisionKebabCaseIdPatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const decisionIdPatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*\\.md$";
export const decisionSourcePathPatternSource =
  "^(?:[a-z0-9]+(?:-[a-z0-9]+)*\\.md|archive/[a-z0-9]+(?:-[a-z0-9]+)*\\.md)$";
const decisionSourcePathPattern = new RegExp(
  decisionSourcePathPatternSource,
  "u"
);
export function isDecisionId(value: unknown): value is DecisionId {
  return typeof value === "string" && decisionIdPattern.test(value);
}

export function isDecisionSourcePath(
  value: unknown
): value is DecisionSourcePath {
  return typeof value === "string" && decisionSourcePathPattern.test(value);
}

export function decisionIdFromSourcePath(value: string): DecisionId | null {
  if (!isDecisionSourcePath(value)) {
    return null;
  }
  const decisionId = value.startsWith("archive/")
    ? value.slice("archive/".length)
    : value;
  return isDecisionId(decisionId) ? decisionId : null;
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
  const sourcePath =
    status === "archived" ? "archive/" + decisionId : decisionId;
  if (!isDecisionSourcePath(sourcePath)) {
    throw new Error("derived decision source path is invalid: " + sourcePath);
  }
  return sourcePath;
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
