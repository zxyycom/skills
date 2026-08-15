import * as v from "valibot";
import { sha256Fingerprint } from "./canonicalization.ts";
import {
  createTestEvidenceDiagnostic,
  formatTestEvidenceValidationIssues,
  testEvidenceErrorText
} from "./diagnostics.ts";
import {
  testEntityIndexPath,
  testEntityIndexSchema,
  type TestEntityIndex,
  type TestEntityIndexIdentity,
  type TestEvidenceDiagnostic
} from "./schemas.ts";
import type { LedgerTextSource } from "./text-source.ts";

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
      message: `${source.path} is not valid JSON: ${testEvidenceErrorText(error)}`,
      path: source.path
    });
  }

  const parsed = v.safeParse(testEntityIndexSchema, input);
  if (!parsed.success) {
    return failedEntityIndexParse("entity-index.schema-invalid", {
      message:
        `${source.path} is invalid: ` +
        formatTestEvidenceValidationIssues(parsed.issues),
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

function cloneTestEntityIndex(value: TestEntityIndex): TestEntityIndex {
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

function failedEntityIndexParse(
  code: string,
  details: {
    message: string;
    path?: string;
  }
): TestEntityIndexParseResult {
  return {
    diagnostics: [
      createTestEvidenceDiagnostic({
        category: "entity-index",
        code,
        message: details.message,
        path: details.path ?? testEntityIndexPath,
        severity: "error"
      })
    ],
    parsed: null
  };
}
