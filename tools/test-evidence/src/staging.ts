import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  type StateIndexDiagnostic
} from "../../index-runtime/src/index.ts";
import {
  testEvidenceCaseIdPatternSource,
  testEvidenceCaseIdSchema,
  testEvidenceIndexNamespace,
  testEvidenceIndexPath,
  testEvidenceIndexStageResultSchema
} from "./schemas.ts";
import { createTestEvidenceStateIndexDefinition } from "./state-index.ts";
import type { TestEvidenceIndexStageResult } from "./types.ts";

export type StageTestEvidenceIndexOptions = {
  caseIds: readonly string[];
  workspaceRoot: string;
};

type TestEvidenceIndexStageSuccess = Extract<
  TestEvidenceIndexStageResult,
  { status: "ok" }
>;

type TestEvidenceIndexStageError = Extract<
  TestEvidenceIndexStageResult,
  { status: "error" }
>;

export type TestEvidenceIndexStageFailure = Readonly<{
  kind: "invalid-arguments" | "operation";
  result: TestEvidenceIndexStageError;
}>;

const testEvidenceStageDiagnosticCodes = {
  caseIdDuplicate: "test-evidence.stage-case-id-duplicate",
  caseIdInvalid: "test-evidence.stage-case-id-invalid",
  caseIdsEmpty: "test-evidence.stage-case-ids-empty"
} as const;

type TestEvidenceStageDiagnosticCode =
  (typeof testEvidenceStageDiagnosticCodes)[keyof typeof testEvidenceStageDiagnosticCodes];

export async function stageTestEvidenceIndex(
  options: StageTestEvidenceIndexOptions
): Promise<TestEvidenceIndexStageResult> {
  const executed = await executeTestEvidenceIndexStage(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeTestEvidenceIndexStage(
  options: StageTestEvidenceIndexOptions
): ResultAsync<TestEvidenceIndexStageSuccess, TestEvidenceIndexStageFailure> {
  const validatedIds = validateCaseIds(options.caseIds);
  if (validatedIds.isErr()) {
    return errAsync(
      stageFailure("invalid-arguments", failedStage(validatedIds.error))
    );
  }

  const runtime = createStateIndexRuntime({
    definition: createTestEvidenceStateIndexDefinition(),
    indexPath: testEvidenceIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  return ResultAsync.fromSafePromise(
    runtime.stageSelectedEntries(validatedIds.value)
  ).andThen(
    (
      runtimeResult
    ): Result<TestEvidenceIndexStageSuccess, TestEvidenceIndexStageFailure> => {
      const result = v.parse(testEvidenceIndexStageResultSchema, runtimeResult);
      return result.status === "error"
        ? err(stageFailure("operation", result))
        : ok(result);
    }
  );
}

function validateCaseIds(
  caseIds: readonly string[]
): Result<string[], StateIndexDiagnostic[]> {
  if (caseIds.length === 0) {
    return err([
      stageDiagnostic(
        testEvidenceStageDiagnosticCodes.caseIdsEmpty,
        "stage-index requires at least one test evidence case ID"
      )
    ]);
  }

  const diagnostics: StateIndexDiagnostic[] = [];
  const seen = new Set<string>();
  for (const caseId of caseIds) {
    if (!v.safeParse(testEvidenceCaseIdSchema, caseId).success) {
      diagnostics.push(
        stageDiagnostic(
          testEvidenceStageDiagnosticCodes.caseIdInvalid,
          `case ID ${JSON.stringify(caseId)} must match ${
            testEvidenceCaseIdPatternSource
          }`,
          caseId
        )
      );
      continue;
    }
    if (seen.has(caseId)) {
      diagnostics.push(
        stageDiagnostic(
          testEvidenceStageDiagnosticCodes.caseIdDuplicate,
          `case ID ${JSON.stringify(caseId)} appears more than once`,
          caseId
        )
      );
      continue;
    }
    seen.add(caseId);
  }
  return diagnostics.length > 0 ? err(diagnostics) : ok([...caseIds]);
}

function stageFailure(
  kind: TestEvidenceIndexStageFailure["kind"],
  result: TestEvidenceIndexStageError
): TestEvidenceIndexStageFailure {
  return { kind, result };
}

function failedStage(
  diagnostics: StateIndexDiagnostic[]
): TestEvidenceIndexStageError {
  return {
    changed: false,
    diagnostics,
    indexPath: testEvidenceIndexPath,
    namespace: testEvidenceIndexNamespace,
    selectedIds: [],
    state: "selection-invalid",
    status: "error"
  };
}

function stageDiagnostic(
  code: TestEvidenceStageDiagnosticCode,
  message: string,
  stateId: string | null = null
): StateIndexDiagnostic {
  return {
    code,
    message,
    path: null,
    stateId
  };
}
