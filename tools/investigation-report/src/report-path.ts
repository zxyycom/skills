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
export const investigationIdPatternSource = `^${investigationKebabCasePatternSource}\\.md$`;

const kebabCasePattern = new RegExp(
  `^${investigationKebabCasePatternSource}$`,
  "u"
);
const investigationIdPattern = new RegExp(investigationIdPatternSource, "u");

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

export function validateInvestigationId(value: string): string[] {
  return isInvestigationId(value)
    ? []
    : [
        `${value || "<empty>"} must use a kebab-case semantic Investigation ID with .md`
      ];
}

export function isInvestigationTag(value: string): boolean {
  return kebabCasePattern.test(value);
}

export function reportPathForInvestigationId(
  investigationsDirectory: string,
  id: string
): string {
  return path.join(investigationsDirectory, id);
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
