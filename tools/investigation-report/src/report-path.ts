import fs from "node:fs/promises";
import path from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";

export const defaultInvestigationsDirectory = "docs/investigations";
export const investigationIndexFileName = "investigation-index.json";
export const investigationKebabCasePatternSource = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const investigationIdPatternSource = `^${investigationKebabCasePatternSource}$`;
export const investigationSourcePathPatternSource = `^${investigationKebabCasePatternSource}\\.md$`;

const kebabCasePattern = new RegExp(
  `^${investigationKebabCasePatternSource}$`,
  "u"
);
const investigationIdPattern = new RegExp(investigationIdPatternSource, "u");
const datedInvestigationIdPattern =
  /^(\d{2})(\d{2})(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const investigationSourcePathPattern = new RegExp(
  investigationSourcePathPatternSource,
  "u"
);

export type ResolvedInvestigationsDirectory = {
  investigationsDirectory: string;
  investigationsDirectoryOption: string;
  workspaceRoot: string;
};

export type CanonicalInvestigationsDirectory = {
  investigationsDirectory: string;
  investigationsDirectoryOption: string;
  workspaceRoot: string;
};

export function resolveInvestigationsDirectory(
  workspaceRootValue: string,
  investigationsDirectoryValue?: string
): Result<ResolvedInvestigationsDirectory, string[]> {
  const workspaceRoot = path.resolve(workspaceRootValue);
  const investigationsDirectoryOption =
    investigationsDirectoryValue ?? defaultInvestigationsDirectory;
  const investigationsDirectory = path.resolve(
    workspaceRoot,
    investigationsDirectoryOption
  );
  const errors: string[] = [];
  if (path.isAbsolute(investigationsDirectoryOption)) {
    errors.push(
      "investigations directory must be relative to the workspace root"
    );
  } else if (!isPathWithinDirectory(investigationsDirectory, workspaceRoot)) {
    errors.push("investigations directory must stay within the workspace root");
  }
  return errors.length > 0
    ? err(errors)
    : ok({
        investigationsDirectory,
        investigationsDirectoryOption,
        workspaceRoot
      });
}

export function canonicalizeInvestigationsDirectory(
  resolved: ResolvedInvestigationsDirectory
): ResultAsync<CanonicalInvestigationsDirectory, string[]> {
  return canonicalDirectory("workspace root", resolved.workspaceRoot).andThen(
    (canonicalWorkspaceRoot) =>
      canonicalDirectory(
        displayPath(resolved.investigationsDirectoryOption),
        resolved.investigationsDirectory
      ).andThen((canonicalInvestigationsDirectory) => {
        if (
          !isPathWithinDirectory(
            canonicalInvestigationsDirectory,
            canonicalWorkspaceRoot
          )
        ) {
          return err([
            "investigations directory must resolve within the workspace root"
          ]);
        }
        return ok({
          investigationsDirectory: canonicalInvestigationsDirectory,
          investigationsDirectoryOption: resolved.investigationsDirectoryOption,
          workspaceRoot: canonicalWorkspaceRoot
        });
      })
  );
}

export function isInvestigationId(value: string): boolean {
  return !value.includes("/") && investigationIdPattern.test(value);
}

export type ParsedDatedInvestigationId = Readonly<{
  date: string;
  id: string;
  name: string;
}>;

export function parseDatedInvestigationId(
  value: string
): ParsedDatedInvestigationId | null {
  const match = datedInvestigationIdPattern.exec(value);
  if (match === null || !isInvestigationId(value)) return null;
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

export function normalizeInvestigationSelectorInput(value: string): string {
  return value.replace(/\.md$/iu, "");
}

export function investigationNameFromId(id: string): string {
  return parseDatedInvestigationId(id)?.name ?? id;
}

export function utcInvestigationDate(timestamp: string): string | null {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return null;
  const date = new Date(milliseconds);
  return [
    String(date.getUTCFullYear() % 100).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
}

export function datedInvestigationIdForName(
  name: string,
  formedAt: string
): string | null {
  const date = utcInvestigationDate(formedAt);
  if (date === null) return null;
  const id = `${date}-${name}`;
  return parseDatedInvestigationId(id)?.id ?? null;
}

/** Normalizes one former Markdown-suffixed selector at an input boundary. */
export function normalizeInvestigationIdInput(value: string): string | null {
  const normalized = normalizeInvestigationSelectorInput(value);
  return isInvestigationId(normalized) ? normalized : null;
}

export function isInvestigationSourcePath(value: string): boolean {
  return !value.includes("/") && investigationSourcePathPattern.test(value);
}

export function validateInvestigationId(value: string): string[] {
  return isInvestigationId(value)
    ? []
    : [
        `${value || "<empty>"} must use an extensionless kebab-case semantic Investigation ID`
      ];
}

export function isInvestigationTag(value: string): boolean {
  return kebabCasePattern.test(value);
}

function canonicalDirectory(
  label: string,
  directory: string
): ResultAsync<string, string[]> {
  return ResultAsync.fromPromise(fs.realpath(directory), (error) => [
    fileSystemResolutionError(label, error)
  ]).andThen((canonicalDirectoryPath) =>
    ResultAsync.fromPromise(fs.stat(canonicalDirectoryPath), (error) => [
      fileSystemResolutionError(label, error)
    ]).andThen((stats) =>
      stats.isDirectory()
        ? ok(canonicalDirectoryPath)
        : err([`${label} must be a directory`])
    )
  );
}

function fileSystemResolutionError(label: string, error: unknown): string {
  if (isFileSystemError(error, "ENOENT")) {
    return `${label} does not exist`;
  }
  return `${label} could not be resolved: ${errorText(error)}`;
}

function displayPath(value: string): string {
  return value.replace(/\\/gu, "/");
}

function errorText(error: unknown): string {
  return operationErrorDetail(error) ?? "unavailable error detail";
}
