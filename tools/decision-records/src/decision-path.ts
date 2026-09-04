import path from "node:path";
import { toPosix } from "../../shared/src/node/filesystem.ts";
import type { DecisionId, DecisionSourcePath, DecisionTag } from "./types.ts";

const decisionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datedDecisionIdPattern =
  /^(\d{2})(\d{2})(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
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

/**
 * The ID syntax introduced for new records. Legacy pure IDs stay valid as
 * stored identities so existing records can still be located and migrated
 * explicitly, but they are never manufactured by new.
 */
export type ParsedDatedDecisionId = Readonly<{
  date: string;
  id: DecisionId;
  name: string;
}>;

export function parseDatedDecisionId(
  value: string
): ParsedDatedDecisionId | null {
  const match = datedDecisionIdPattern.exec(value);
  if (match === null || !isDecisionId(value)) return null;
  const [, yearText, monthText, dayText, name] = match;
  const year = 2000 + Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { date: `${yearText}${monthText}${dayText}`, id: value, name };
}

/** Removes exactly one case-insensitive Markdown suffix for a user selector. */
export function normalizeDecisionSelectorInput(value: string): string {
  return value.replace(/\.md$/iu, "");
}

/** The name index projects the dated suffix, or the whole legacy ID. */
export function decisionNameFromId(decisionId: DecisionId): string {
  return parseDatedDecisionId(decisionId)?.name ?? decisionId;
}

export function utcDecisionDate(date: Date = new Date()): string {
  return [
    String(date.getUTCFullYear() % 100).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
}

export function datedDecisionIdForName(
  name: string,
  date: string = utcDecisionDate()
): DecisionId | null {
  const id = `${date}-${name}`;
  return parseDatedDecisionId(id)?.id ?? null;
}

/** Normalizes one former Markdown-suffixed selector at an input boundary. */
export function normalizeDecisionIdInput(value: string): DecisionId | null {
  const normalized = normalizeDecisionSelectorInput(value);
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
 * Allocates a legal storage path for a renamed record. The basename is the
 * semantic name when that location is free; otherwise the complete ID keeps
 * the record addressable without overwriting another source.
 */
export function sourcePathForDecisionRename(
  decisionId: DecisionId,
  name: string,
  status: "active" | "archived" | "candidate",
  occupiedSourcePaths: ReadonlySet<string>
): DecisionSourcePath | null {
  const namePath = sourcePathForDecision(name, status);
  if (!occupiedSourcePaths.has(namePath)) return namePath;
  const idPath = sourcePathForDecision(decisionId, status);
  return occupiedSourcePaths.has(idPath) ? null : idPath;
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
