import * as v from "valibot";
import { diagnostic, formatValibotIssue } from "./diagnostics.ts";
import { isPlainRecord, sameRecordMembers } from "./record.ts";
import {
  isStateIndexText,
  stateIndexSchema,
  stateIndexSchemaVersion,
  stateSourceRevisionSchema,
  type StateIndex
} from "./schemas.ts";
import type {
  StateIndexDiagnostic,
  StateIndexExpectation,
  StateIndexResult,
  StateSourceRevision
} from "./types.ts";

export function validateStateIndexValue(
  input: unknown,
  expectation: StateIndexExpectation | null,
  sourcePath: string
): { diagnostics: StateIndexDiagnostic[]; index: StateIndex | null } {
  const versionDiagnostic = unsupportedVersionDiagnostic(input, sourcePath);
  if (versionDiagnostic !== null)
    return { diagnostics: [versionDiagnostic], index: null };
  const idDiagnostics = validateIndexRecordIds(input, sourcePath);
  if (idDiagnostics.length > 0)
    return { diagnostics: idDiagnostics, index: null };
  const parsed = parseStateIndex(input, sourcePath);
  if (parsed.index === null) return parsed;
  const diagnostics = validateExpectation(
    parsed.index,
    expectation,
    sourcePath
  );
  if (
    !sameRecordMembers(
      parsed.index.entries,
      parsed.index.sourceRevision.entries
    )
  ) {
    diagnostics.push(
      diagnostic({
        code: "state-index.source-revision-members-mismatch",
        message:
          "sourceRevision.entries must contain exactly the same state ids as entries",
        path: sourcePath
      })
    );
  }
  return { diagnostics, index: diagnostics.length === 0 ? parsed.index : null };
}

function unsupportedVersionDiagnostic(
  input: unknown,
  sourcePath: string
): StateIndexDiagnostic | null {
  if (
    !isPlainRecord(input) ||
    !Object.hasOwn(input, "schemaVersion") ||
    input.schemaVersion === stateIndexSchemaVersion
  ) {
    return null;
  }
  return diagnostic({
    code: "state-index.schema-version-unsupported",
    message: `schema version ${String(input.schemaVersion)} is unsupported; expected ${stateIndexSchemaVersion}`,
    path: sourcePath
  });
}

function parseStateIndex(
  input: unknown,
  sourcePath: string
): {
  diagnostics: StateIndexDiagnostic[];
  index: StateIndex | null;
} {
  const parsed = v.safeParse(stateIndexSchema, input);
  if (parsed.success) return { diagnostics: [], index: parsed.output };
  return {
    diagnostics: parsed.issues.map((issue) =>
      diagnostic({
        code: issueBelongsToSourceRevision(issue)
          ? "state-index.source-revision-invalid"
          : "state-index.schema-invalid",
        message: formatValibotIssue(issue),
        path: sourcePath
      })
    ),
    index: null
  };
}

function validateExpectation(
  index: StateIndex,
  expectation: StateIndexExpectation | null,
  sourcePath: string
): StateIndexDiagnostic[] {
  if (expectation === null) return [];
  const diagnostics: StateIndexDiagnostic[] = [];
  if (index.namespace !== expectation.namespace) {
    diagnostics.push(
      diagnostic({
        code: "state-index.namespace-mismatch",
        message: `expected namespace ${expectation.namespace}, found ${index.namespace}`,
        path: sourcePath
      })
    );
  }
  if (index.definitionVersion !== expectation.definitionVersion) {
    diagnostics.push(
      diagnostic({
        code: "state-index.definition-version-mismatch",
        message: `expected definition version ${expectation.definitionVersion}, found ${index.definitionVersion}`,
        path: sourcePath
      })
    );
  }
  return diagnostics;
}

export function validateStateSourceRevisionValue(
  input: unknown,
  sourcePath: string | null = null
): StateIndexResult<StateSourceRevision> {
  const idDiagnostics = validateRecordIds(input, "entries", sourcePath);
  if (idDiagnostics.length > 0) {
    return { diagnostics: idDiagnostics, status: "error", value: null };
  }
  const parsed = v.safeParse(stateSourceRevisionSchema, input);
  if (!parsed.success) {
    return {
      diagnostics: parsed.issues.map((issue) =>
        diagnostic({
          code: "state-index.source-revision-invalid",
          message: formatValibotIssue(issue),
          path: sourcePath
        })
      ),
      status: "error",
      value: null
    };
  }
  return { diagnostics: [], status: "ok", value: parsed.output };
}

function validateIndexRecordIds(
  input: unknown,
  sourcePath: string
): StateIndexDiagnostic[] {
  if (!isPlainRecord(input)) return [];
  return [
    ...validateRecordIds(input, "entries", sourcePath),
    ...(isPlainRecord(input.sourceRevision)
      ? validateRecordIds(input.sourceRevision, "entries", sourcePath)
      : [])
  ];
}

function validateRecordIds(
  container: unknown,
  member: string,
  sourcePath: string | null
): StateIndexDiagnostic[] {
  if (!isPlainRecord(container)) return [];
  const record = container[member];
  if (!isPlainRecord(record)) return [];
  return Object.keys(record)
    .filter((id) => !isStateIndexText(id))
    .map((id) =>
      diagnostic({
        code: "state-index.id-invalid",
        message:
          "state id must be non-empty text without surrounding whitespace or control characters",
        path: sourcePath,
        stateId: id
      })
    );
}

function issueBelongsToSourceRevision(issue: v.BaseIssue<unknown>): boolean {
  const path = v.getDotPath(issue);
  return (
    path === "sourceRevision" || path?.startsWith("sourceRevision.") === true
  );
}
