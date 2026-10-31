import type {
  StateIndexDiagnostic,
  StateIndexFilesystemDiagnostic
} from "../../../index-runtime/src/index.ts";
import {
  decisionDiagnostic,
  type DecisionDiagnostic
} from "../application-result.ts";
import { operationErrorDetail } from "../../../shared/src/version-control/error-detail.ts";
import { decisionIndexFileName } from "./decision-index-definition.ts";

export function decisionIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath?: string
): string[] {
  return diagnostics.map((diagnostic) => {
    const source =
      diagnostic.path === null
        ? displayPath
        : displayPath === undefined || diagnostic.path !== decisionIndexFileName
          ? diagnostic.path
          : displayPath;
    const message = [
      ...(source === undefined ? [] : [source]),
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ]
      .filter((part) => part.length > 0)
      .join(" ");
    return diagnostic.filesystem === undefined
      ? message
      : message + filesystemDiagnosticMarker(diagnostic.filesystem);
  });
}

export function decisionIndexDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  options: Readonly<{
    code: string;
    recovery: string;
    target: string;
  }>
): DecisionDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const target = indexDiagnosticTarget(diagnostic, options.target);
    if (diagnostic.filesystem === undefined) {
      return decisionDiagnostic({
        code: options.code,
        reason: diagnostic.message,
        recovery: options.recovery,
        target
      });
    }
    const filesystem = diagnostic.filesystem;
    return decisionDiagnostic({
      causeCategory: filesystem.causeCategory,
      code: options.code,
      ...(filesystem.detail === null ? {} : { detail: filesystem.detail }),
      reason:
        "The derived Decision index filesystem operation could not complete.",
      recovery: recoveryForIndexFilesystemCause(filesystem, options.recovery),
      target
    });
  });
}

/** An older definition must be rebuilt from current Markdown, never read as current. */
export function decisionIndexRecovery(
  diagnostics: readonly StateIndexDiagnostic[],
  fallback: string
): string {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "state-index.definition-version-mismatch"
  )
    ? "Run check to validate current Decision Markdown. If it is valid, run sync-index without --select to rebuild the derived index; if an established source lacks alignment, restore its trusted historical alignment before rebuilding."
    : fallback;
}

function indexDiagnosticTarget(
  diagnostic: StateIndexDiagnostic,
  fallback: string
): string {
  const filesystemTarget = diagnostic.filesystem?.target;
  const filesystemDetail =
    filesystemTarget === null || filesystemTarget === undefined
      ? null
      : operationErrorDetail(filesystemTarget);
  if (filesystemDetail !== null) return filesystemDetail;
  return diagnostic.path ?? fallback;
}

function recoveryForIndexFilesystemCause(
  filesystem: StateIndexFilesystemDiagnostic,
  fallback: string
): string {
  switch (filesystem.causeCategory) {
    case "access-denied":
      return "Grant the current process filesystem access to the decision collection, then retry the command.";
    case "not-found":
      return "Restore the required Decision source or derived index, then retry the command.";
    case "unknown":
      return fallback;
  }
}

function filesystemDiagnosticMarker(
  filesystem: StateIndexFilesystemDiagnostic
): string {
  return (
    " " +
    (operationErrorDetail(filesystem.detail) ?? "filesystem operation failed") +
    " [decision-filesystem:" +
    filesystem.causeCategory +
    "]"
  );
}
