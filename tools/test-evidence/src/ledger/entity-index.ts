import { createHash } from "node:crypto";
import * as v from "valibot";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  testEntityIndexPath,
  testEntityIndexSchema,
  type TestEntityIndex,
  type TestEntityIndexIdentity,
  type TestEvidenceDiagnostic
} from "./schemas.ts";
import type { LedgerTextSource } from "./workspace.ts";

export type ParsedTestEntityIndex = {
  identity: TestEntityIndexIdentity;
  value: TestEntityIndex;
};

export type TestEntityIndexParseResult =
  | {
    diagnostics: [];
    parsed: ParsedTestEntityIndex;
  }
  | {
    diagnostics: TestEvidenceDiagnostic[];
    parsed: null;
  };

export function parseTestEntityIndex(
  source: LedgerTextSource
): TestEntityIndexParseResult {
  let input: unknown;
  try {
    input = JSON.parse(source.text) as unknown;
  } catch (error) {
    return failedEntityIndexParse("entity-index.json-invalid", {
      message: `${source.path} is not valid JSON: ${errorText(error)}`,
      path: source.path
    });
  }

  const parsed = v.safeParse(testEntityIndexSchema, input);
  if (!parsed.success) {
    const details = parsed.issues.map((issue) => {
      const issuePath = issue.path
        ?.map((segment) => String(segment.key))
        .join(".");
      return issuePath === undefined || issuePath.length === 0
        ? issue.message
        : `${issuePath}: ${issue.message}`;
    }).join("; ");
    return failedEntityIndexParse("entity-index.schema-invalid", {
      message: `${source.path} is invalid: ${details}`,
      path: source.path
    });
  }

  const value = cloneTestEntityIndex(parsed.output);
  const fingerprint = sha256Fingerprint(JSON.stringify(value));
  return {
    diagnostics: [],
    parsed: {
      identity: {
        schemaVersion: value.schemaVersion,
        sourceRevision: value.sourceRevision,
        fingerprint
      },
      value
    }
  };
}

export function cloneTestEntityIndex(
  value: TestEntityIndex
): TestEntityIndex {
  return {
    schemaVersion: value.schemaVersion,
    sourceRevision: value.sourceRevision,
    entities: value.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      locators: [...entity.locators]
    }))
  };
}

export function sha256Fingerprint(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function failedEntityIndexParse(
  code: string,
  details: {
    message: string;
    path?: string;
  }
): TestEntityIndexParseResult {
  return {
    diagnostics: [createTestEvidenceDiagnostic({
      category: "entity-index",
      code,
      message: details.message,
      path: details.path ?? testEntityIndexPath,
      severity: "error"
    })],
    parsed: null
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
