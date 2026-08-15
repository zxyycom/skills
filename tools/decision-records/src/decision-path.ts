import path from "node:path";
import { toPosix } from "../../shared/src/node/filesystem.ts";

const decisionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const tagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const decisionKebabCaseIdPatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const decisionIdPatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*\\.md$";
export const decisionSourcePathPatternSource =
  "^(?:[a-z0-9]+(?:-[a-z0-9]+)*\\.md|archive/[a-z0-9]+(?:-[a-z0-9]+)*\\.md)$";
const decisionSourcePathPattern = new RegExp(decisionSourcePathPatternSource, "u");
export function isDecisionId(value: string): boolean {
  return decisionIdPattern.test(value);
}

export function isDecisionSourcePath(value: string): boolean {
  return decisionSourcePathPattern.test(value);
}

export function decisionIdFromSourcePath(value: string): string | null {
  if (!isDecisionSourcePath(value)) {
    return null;
  }
  return value.startsWith("archive/") ? value.slice("archive/".length) : value;
}

export function isArchivedDecisionSourcePath(value: string): boolean {
  return value.startsWith("archive/") && isDecisionSourcePath(value);
}

export function sourcePathForDecision(
  decisionId: string,
  status: "active" | "archived" | "candidate"
): string {
  return status === "archived" ? "archive/" + decisionId : decisionId;
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
    relativePath === ".."
    || relativePath.startsWith(".." + path.sep)
    || path.isAbsolute(relativePath)
  ) {
    return targetPath;
  }
  return toPosix(relativePath);
}

export function isDecisionTag(value: string): boolean {
  return tagPattern.test(value);
}
