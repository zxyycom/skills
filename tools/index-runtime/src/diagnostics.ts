import * as v from "valibot";
import { fileSystemDiagnostic as describeFileSystemDiagnostic } from "../../shared/src/node/filesystem-diagnostic.ts";
import type {
  StateIndexDiagnostic,
  StateIndexFilesystemDiagnostic,
  StateIndexResult,
  StateIndexVersionControlDiagnostic
} from "./types.ts";

export function diagnostic(options: {
  code: string;
  filesystem?: StateIndexFilesystemDiagnostic;
  message: string;
  path?: string | null;
  stateId?: string | null;
  versionControl?: StateIndexVersionControlDiagnostic;
}): StateIndexDiagnostic {
  return {
    code: options.code,
    ...(options.filesystem === undefined
      ? {}
      : { filesystem: options.filesystem }),
    message: options.message,
    path: options.path ?? null,
    stateId: options.stateId ?? null,
    ...(options.versionControl === undefined
      ? {}
      : { versionControl: options.versionControl })
  };
}

export function failure<Value = never>(
  code: string,
  message: string,
  options: {
    filesystem?: StateIndexFilesystemDiagnostic;
    path?: string | null;
    stateId?: string | null;
  } = {}
): StateIndexResult<Value> {
  return {
    diagnostics: [diagnostic({ code, message, ...options })],
    status: "error",
    value: null
  };
}

export function filesystemFailure<Value = never>(
  code: string,
  message: string,
  options: {
    error: unknown;
    operation: string;
    path?: string | null;
    stateId?: string | null;
    target?: string | null;
  }
): StateIndexResult<Value> {
  return failure(code, message, {
    filesystem: filesystemDiagnostic(options.error, {
      operation: options.operation,
      target: options.target
    }),
    path: options.path,
    stateId: options.stateId
  });
}

export function filesystemDiagnostic(
  error: unknown,
  options: Readonly<{ operation: string; target?: string | null }>
): StateIndexFilesystemDiagnostic | undefined {
  return describeFileSystemDiagnostic(error, options);
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatValibotIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath ? `${issuePath} ${issue.message}` : issue.message;
}
