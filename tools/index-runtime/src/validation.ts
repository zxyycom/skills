import * as v from "valibot";
import { diagnostic, formatValibotIssue } from "./diagnostics.ts";
import {
  keyValueMatchesMode,
  scalarIdentity
} from "./key-values.ts";
import {
  isPlainRecord,
  sameRecordMembers
} from "./record.ts";
import {
  isStateIndexText,
  stateIndexSchema,
  stateIndexSchemaVersion,
  stateSourceRevisionSchema,
  type StateIndex,
  type StateIndexKeyDefinition
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
  if (
    isPlainRecord(input)
    && Object.hasOwn(input, "schemaVersion")
    && input.schemaVersion !== stateIndexSchemaVersion
  ) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.schema-version-unsupported",
        message: `schema version ${String(input.schemaVersion)} is unsupported; expected `
          + stateIndexSchemaVersion,
        path: sourcePath
      })],
      index: null
    };
  }

  const idDiagnostics = validateIndexRecordIds(input, sourcePath);
  if (idDiagnostics.length > 0) {
    return { diagnostics: idDiagnostics, index: null };
  }
  const parsed = v.safeParse(stateIndexSchema, input);
  if (!parsed.success) {
    return {
      diagnostics: parsed.issues.map((issue) => diagnostic({
        code: issueBelongsToSourceRevision(issue)
          ? "state-index.source-revision-invalid"
          : "state-index.schema-invalid",
        message: formatValibotIssue(issue),
        path: sourcePath
      })),
      index: null
    };
  }

  const index = parsed.output;
  const diagnostics: StateIndexDiagnostic[] = [];
  if (expectation !== null && index.namespace !== expectation.namespace) {
    diagnostics.push(diagnostic({
      code: "state-index.namespace-mismatch",
      message: `expected namespace ${expectation.namespace}, found ${index.namespace}`,
      path: sourcePath
    }));
  }
  if (
    expectation !== null
    && index.definitionVersion !== expectation.definitionVersion
  ) {
    diagnostics.push(diagnostic({
      code: "state-index.definition-version-mismatch",
      message: "expected definition version "
        + `${expectation.definitionVersion}, found ${index.definitionVersion}`,
      path: sourcePath
    }));
  }

  const definitions = validateKeyDefinitions(index.keyDefinitions, sourcePath, diagnostics);
  if (!sameRecordMembers(index.entries, index.sourceRevision.entries)) {
    diagnostics.push(diagnostic({
      code: "state-index.source-revision-members-mismatch",
      message: "sourceRevision.entries must contain exactly the same state ids as entries",
      path: sourcePath
    }));
  }
  for (const [id, entry] of Object.entries(index.entries)) {
    for (const [key, values] of Object.entries(entry.keys)) {
      const definition = definitions.get(key);
      if (definition === undefined) {
        diagnostics.push(diagnostic({
          code: "state-index.key-unknown",
          message: `state ${id} contains undeclared key ${key}`,
          path: sourcePath,
          stateId: id
        }));
        continue;
      }
      if (new Set(values.map(scalarIdentity)).size !== values.length) {
        diagnostics.push(diagnostic({
          code: "state-index.key-value-duplicate",
          message: `state ${id} repeats a value for key ${key}`,
          path: sourcePath,
          stateId: id
        }));
      }
      for (const value of values) {
        if (!keyValueMatchesMode(value, definition.mode)) {
          diagnostics.push(diagnostic({
            code: "state-index.key-value-invalid",
            message: `key ${key} with mode ${definition.mode} cannot contain ${typeof value}`,
            path: sourcePath,
            stateId: id
          }));
        }
      }
    }
  }

  return {
    diagnostics,
    index: diagnostics.length === 0 ? index : null
  };
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
      diagnostics: parsed.issues.map((issue) => diagnostic({
        code: "state-index.source-revision-invalid",
        message: formatValibotIssue(issue),
        path: sourcePath
      })),
      status: "error",
      value: null
    };
  }
  return { diagnostics: [], status: "ok", value: parsed.output };
}

function validateKeyDefinitions(
  definitions: readonly StateIndexKeyDefinition[],
  sourcePath: string,
  diagnostics: StateIndexDiagnostic[]
): Map<string, StateIndexKeyDefinition> {
  const byName = new Map<string, StateIndexKeyDefinition>();
  for (const definition of definitions) {
    if (definition.name === "id") {
      diagnostics.push(diagnostic({
        code: "state-index.key-reserved",
        message: "key definitions must not redefine the reserved id key",
        path: sourcePath
      }));
    }
    if (byName.has(definition.name)) {
      diagnostics.push(diagnostic({
        code: "state-index.key-definition-duplicate",
        message: `key definition ${definition.name} appears more than once`,
        path: sourcePath
      }));
    }
    byName.set(definition.name, definition);
  }
  return byName;
}

function validateIndexRecordIds(
  input: unknown,
  sourcePath: string
): StateIndexDiagnostic[] {
  if (!isPlainRecord(input)) {
    return [];
  }
  return [
    ...validateRecordIds(input, "entries", sourcePath),
    ...isPlainRecord(input.sourceRevision)
      ? validateRecordIds(input.sourceRevision, "entries", sourcePath)
      : []
  ];
}

function validateRecordIds(
  container: unknown,
  member: string,
  sourcePath: string | null
): StateIndexDiagnostic[] {
  if (!isPlainRecord(container)) {
    return [];
  }
  const record = container[member];
  if (!isPlainRecord(record)) {
    return [];
  }
  return Object.keys(record)
    .filter((id) => !isStateIndexText(id))
    .map((id) => diagnostic({
      code: "state-index.id-invalid",
      message: "state id must be non-empty text without surrounding whitespace or "
        + "control characters",
      path: sourcePath,
      stateId: id
    }));
}

function issueBelongsToSourceRevision(issue: v.BaseIssue<unknown>): boolean {
  const path = v.getDotPath(issue);
  return path === "sourceRevision" || path?.startsWith("sourceRevision.") === true;
}
