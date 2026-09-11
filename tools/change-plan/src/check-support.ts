import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { ChangePlanMetadataError, readChangePlanMetadata } from "./metadata.ts";
import {
  changePlanMetadataName,
  type ChangePlanDiagnostic,
  type ChangePlanFileName,
  type ChangePlanMetadata,
  type ChangePlanTaskProgress
} from "./types.ts";

export type ArtifactProgress = {
  completedTaskCount: number;
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
};
export function emptyTaskProgress(): ChangePlanTaskProgress {
  return {
    implementation: { completedTaskCount: 0, taskCount: 0 },
    readiness: { completedTaskCount: 0, taskCount: 0 },
    verification: { completedTaskCount: 0, taskCount: 0 }
  };
}
export function emptyArtifactProgress(): ArtifactProgress {
  return {
    completedTaskCount: 0,
    taskCount: 0,
    taskProgress: emptyTaskProgress()
  };
}
export async function lstatOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function directoryDiagnostic(
  code: ChangePlanDiagnostic["code"],
  message: string
): ChangePlanDiagnostic {
  return { code, file: null, message };
}
export function fileDiagnostic(
  file: ChangePlanFileName,
  code: ChangePlanDiagnostic["code"],
  message: string
): ChangePlanDiagnostic {
  return { code, file, message };
}
export function sortDiagnostics(
  diagnostics: readonly ChangePlanDiagnostic[]
): ChangePlanDiagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}
function compareDiagnostics(
  left: ChangePlanDiagnostic,
  right: ChangePlanDiagnostic
): number {
  return (
    compareDiagnosticFiles(left, right) ||
    compareDiagnosticLines(left, right) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}
function compareDiagnosticFiles(
  left: ChangePlanDiagnostic,
  right: ChangePlanDiagnostic
): number {
  return optionalText(left.file).localeCompare(optionalText(right.file));
}
function compareDiagnosticLines(
  left: ChangePlanDiagnostic,
  right: ChangePlanDiagnostic
): number {
  return optionalLine(left.line) - optionalLine(right.line);
}
function optionalText(value: string | null): string {
  return value || "";
}
function optionalLine(value: number | undefined): number {
  return value || 0;
}
export function addChangeNameDiagnostic(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): void {
  const changeName = path.basename(changeDirectory);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(changeName))
    diagnostics.push(
      directoryDiagnostic(
        "invalid-change-name",
        `change directory name must use kebab-case: ${changeName || "<empty>"}`
      )
    );
}
export async function inspectChangeDirectory(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): Promise<boolean> {
  try {
    const stat = await lstatOrNull(changeDirectory);
    if (stat === null) {
      diagnostics.push(
        directoryDiagnostic(
          "change-directory-not-found",
          `change directory does not exist: ${changeDirectory}`
        )
      );
      return false;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      diagnostics.push(
        directoryDiagnostic(
          "change-path-not-directory",
          `change path must be a regular directory and not a symbolic link: ${changeDirectory}`
        )
      );
      return false;
    }
    return true;
  } catch (error) {
    diagnostics.push(
      directoryDiagnostic(
        "change-directory-read-failed",
        `cannot inspect change directory ${changeDirectory}: ${errorMessage(error)}`
      )
    );
    return false;
  }
}
export async function readActiveMetadata(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ChangePlanMetadata | null> {
  try {
    return await readChangePlanMetadata(changeDirectory);
  } catch (error) {
    diagnostics.push(metadataDiagnostic(error));
    return null;
  }
}
function metadataDiagnostic(error: unknown): ChangePlanDiagnostic {
  if (!(error instanceof ChangePlanMetadataError))
    return fileDiagnostic(
      changePlanMetadataName,
      "file-read-failed",
      `cannot read ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  return fileDiagnostic(
    changePlanMetadataName,
    metadataErrorCode(error),
    error.message
  );
}
function metadataErrorCode(
  error: ChangePlanMetadataError
): ChangePlanDiagnostic["code"] {
  switch (error.code) {
    case "missing":
      return "missing-required-file";
    case "invalid":
      return "invalid-metadata";
    case "invalid-path":
      return "required-path-not-file";
    case "io":
      return "file-read-failed";
  }
}
