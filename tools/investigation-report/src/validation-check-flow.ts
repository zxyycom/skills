import path from "node:path";
import {
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { readInvestigationSources } from "./investigation-index-source.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { validateReferencedInvestigationResources } from "./resources.ts";
import { prepareInvestigationResourceRoot } from "./resource-root.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationIndex,
  checkInvestigationStateSnapshot
} from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  collectValidatedInvestigationCollection,
  type InvestigationSnapshot,
  type ValidatedInvestigationCollection
} from "./validation-collection.ts";
import { unrecordedPredecessorWarnings } from "./validation-history.ts";
import type { InvestigationReportCheckResult } from "./types.ts";
import { checkResult, lstatOrNull } from "./validation-results.ts";

export async function validateFullCollection(
  investigationRoot: string
): Promise<InvestigationReportCheckResult> {
  const collection = await collectValidatedInvestigationCollection(
    investigationRoot,
    {
      allowEmptyCollection: true
    }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return checkResult({
      availableReportCount: collection.reportCount,
      errors: collection.errors,
      indexChecked: false,
      indexPath: collection.indexPath,
      warnings: collection.warnings
    });
  }
  const snapshot = collection.snapshot;
  if (
    collection.reportCount === 0 &&
    (await lstatOrNull(collection.indexPath)) === null
  ) {
    return checkResult({
      availableReportCount: 0,
      errors: ["investigation collection must contain at least one report"],
      indexChecked: false,
      indexPath: collection.indexPath,
      warnings: collection.warnings
    });
  }
  return await validateSynchronizedCollection(
    investigationRoot,
    collection,
    snapshot
  );
}

async function validateSynchronizedCollection(
  investigationRoot: string,
  collection: ValidatedInvestigationCollection,
  snapshot: InvestigationSnapshot
): Promise<InvestigationReportCheckResult> {
  const synchronized = await checkInvestigationStateSnapshot({
    investigationsDirectory: investigationRoot,
    snapshot
  });
  const errors =
    synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(
          synchronized.diagnostics,
          collection.indexPath
        )
      : [];
  const diagnostics =
    synchronized.status === "error"
      ? synchronized.diagnostics.map((diagnostic) =>
          diagnosticFromStateIndexDiagnostic(diagnostic, {
            recovery:
              "correct the reported derived-index problem, then retry the check",
            target: collection.indexPath
          })
        )
      : [];
  const warnings = [
    ...collection.warnings,
    ...(await unrecordedPredecessorWarnings(
      investigationRoot,
      collection.states
    ))
  ];
  return checkResult({
    availableReportCount: collection.reportCount,
    diagnostics,
    errors,
    indexChecked: synchronized.status === "ok",
    indexPath: collection.indexPath,
    selectedReportCount: collection.reportCount,
    warnings
  });
}

export async function validateScopedCollection(
  investigationRoot: string,
  ids: readonly string[]
): Promise<InvestigationReportCheckResult> {
  const loaded = await loadInvestigationIndex({
    investigationsDirectory: investigationRoot
  });
  const sources = await readInvestigationSources(
    investigationRoot,
    ids,
    undefined,
    loaded
  );
  const diagnostics: InvestigationDiagnostic[] = [];
  const errors: string[] = [];
  const states = sources.map((source) =>
    buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
    )
  );
  errors.push(
    ...(await validateScopedResourceStates(investigationRoot, states))
  );
  return checkResult({
    availableReportCount:
      loaded.status === "ok"
        ? Object.keys(loaded.value.entries).length
        : sources.length,
    diagnostics,
    errors,
    indexChecked: false,
    indexPath: path.join(investigationRoot, investigationIndexFileName),
    selectedReportCount: sources.length
  });
}

async function validateScopedResourceStates(
  investigationRoot: string,
  states: readonly ReturnType<typeof buildInvestigationReportState>[]
): Promise<string[]> {
  const errors: string[] = [];
  const resourceIds = states.flatMap((built) =>
    built.status === "valid" ? built.state.resourceIds : []
  );
  const preparedResources =
    resourceIds.length === 0
      ? undefined
      : await prepareInvestigationResourceRoot(investigationRoot);
  for (const built of states) {
    errors.push(...built.errors);
    if (built.status === "valid")
      errors.push(
        ...(await validateReferencedInvestigationResources(
          investigationRoot,
          built.state.resourceIds,
          undefined,
          preparedResources
        ))
      );
  }
  return errors;
}
