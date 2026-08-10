import path from "node:path";
import {
  err,
  errAsync,
  ok,
  ResultAsync,
  type Result
} from "neverthrow";
import {
  createStateIndexRuntime,
  type StateIndexDiagnostic,
  type StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  investigationIndexNamespace
} from "./investigation-state-index.ts";
import { parseInvestigationIndexStageOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationTopicPath,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationIndexStageOptions,
  InvestigationIndexStageResult
} from "./types.ts";

export type InvestigationIndexStageFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexStageResult;
}>;

type InvestigationIndexStageSuccess = Extract<
  InvestigationIndexStageResult,
  { status: "ok" }
>;

type PreparedStage = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
  topicIds: string[];
}>;

export async function stageInvestigationIndex(
  options: InvestigationIndexStageOptions
): Promise<InvestigationIndexStageResult> {
  const executed = await executeInvestigationIndexStage(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationIndexStage(
  input: unknown
): ResultAsync<InvestigationIndexStageSuccess, InvestigationIndexStageFailure> {
  const prepared = prepareStage(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }

  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) => stageFailure(
      "operation",
      failedStage(
        prepared.value.indexPath,
        diagnosticsFromMessages(
          "investigation-report.stage-location-invalid",
          errors,
          prepared.value.indexPath
        ),
        "index-path-invalid"
      )
    ))
    .andThen((canonical) => stageValidatedInvestigationIndex(
      canonical.investigationsDirectory,
      prepared.value.topicIds
    ));
}

function prepareStage(
  input: unknown
): Result<PreparedStage, InvestigationIndexStageFailure> {
  const parsed = parseInvestigationIndexStageOptions(input);
  if (parsed.isErr()) {
    const indexPath = defaultInvestigationIndexPath();
    return err(stageFailure(
      "invalid-options",
      failedStage(
        indexPath,
        diagnosticsFromMessages(
          "investigation-report.stage-options-invalid",
          parsed.error,
          indexPath
        )
      )
    ));
  }

  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const validatedIds = validateTopicIds(parsed.value.topicIds);
  const indexPath = investigationIndexPathForOptions(parsed.value);
  if (resolved.isErr() || validatedIds.isErr()) {
    return err(stageFailure(
      "invalid-options",
      failedStage(indexPath, [
        ...(resolved.isErr()
          ? diagnosticsFromMessages(
            "investigation-report.stage-location-invalid",
            resolved.error,
            indexPath
          )
          : []),
        ...(validatedIds.isErr() ? validatedIds.error : [])
      ], resolved.isErr() ? "index-path-invalid" : "selection-invalid")
    ));
  }
  return ok({
    indexPath,
    resolved: resolved.value,
    topicIds: validatedIds.value
  });
}

function validateTopicIds(
  topicIds: readonly string[]
): Result<string[], StateIndexDiagnostic[]> {
  if (topicIds.length === 0) {
    return err([stageDiagnostic(
      "investigation-report.stage-topic-ids-empty",
      "stage-index requires at least one investigation topic id"
    )]);
  }

  const diagnostics: StateIndexDiagnostic[] = [];
  const seen = new Set<string>();
  for (const topicId of topicIds) {
    if (!isInvestigationTopicPath(topicId)) {
      diagnostics.push(stageDiagnostic(
        "investigation-report.stage-topic-id-invalid",
        `topic id ${JSON.stringify(topicId)} must use a normalized `
          + "<category-id>/<semantic-slug>.md POSIX path",
        topicId
      ));
      continue;
    }
    if (seen.has(topicId)) {
      diagnostics.push(stageDiagnostic(
        "investigation-report.stage-topic-id-duplicate",
        `topic id ${JSON.stringify(topicId)} appears more than once`,
        topicId
      ));
      continue;
    }
    seen.add(topicId);
  }
  return diagnostics.length > 0
    ? err(diagnostics)
    : ok([...topicIds]);
}

function stageValidatedInvestigationIndex(
  investigationsDirectory: string,
  topicIds: readonly string[]
): ResultAsync<InvestigationIndexStageSuccess, InvestigationIndexStageFailure> {
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  const runtime = createStateIndexRuntime({
    definition: createInvestigationStateIndexDefinition(),
    indexPath: investigationIndexFileName,
    root: investigationsDirectory
  });
  return new ResultAsync(runtime.stageSelectedEntries(topicIds).then((result) => {
    const mapped = withDisplayIndexPath(result, indexPath);
    return mapped.status === "error"
      ? err(stageFailure("operation", mapped))
      : ok(mapped);
  }));
}

function withDisplayIndexPath(
  result: StateIndexEntryStageResult,
  indexPath: string
): InvestigationIndexStageResult {
  return {
    ...result,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      path: diagnostic.path === null
        ? null
        : diagnostic.path === investigationIndexFileName
          ? indexPath
          : diagnostic.path
    })),
    indexPath
  };
}

function failedStage(
  indexPath: string,
  diagnostics: StateIndexDiagnostic[],
  state: Exclude<Extract<
    StateIndexEntryStageResult,
    { status: "error" }
  >["state"], "pending-recovery-failed"> = "selection-invalid"
): Extract<
  InvestigationIndexStageResult,
  { changed: false; status: "error" }
> {
  return {
    changed: false,
    diagnostics,
    indexPath,
    namespace: investigationIndexNamespace,
    selectedIds: [],
    state,
    status: "error"
  };
}

function stageFailure(
  kind: InvestigationIndexStageFailure["kind"],
  result: InvestigationIndexStageResult
): InvestigationIndexStageFailure {
  return { kind, result };
}

function diagnosticsFromMessages(
  code: string,
  messages: readonly string[],
  indexPath: string
): StateIndexDiagnostic[] {
  return messages.map((message) => ({
    code,
    message,
    path: indexPath,
    stateId: null
  }));
}

function stageDiagnostic(
  code: string,
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

function defaultInvestigationIndexPath(): string {
  return path.join(defaultInvestigationsDirectory, investigationIndexFileName);
}

function investigationIndexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.resolve(
    options.workspaceRoot,
    options.investigationsDir ?? defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}
