import * as v from "valibot";
import type {
  StateIndexDiagnostic,
  StateIndexResult
} from "./types.ts";

export function diagnostic(options: {
  code: string;
  message: string;
  path?: string | null;
  stateId?: string | null;
}): StateIndexDiagnostic {
  return {
    code: options.code,
    message: options.message,
    path: options.path ?? null,
    stateId: options.stateId ?? null
  };
}

export function failure<Value = never>(
  code: string,
  message: string,
  options: {
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

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatValibotIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath ? `${issuePath} ${issue.message}` : issue.message;
}
