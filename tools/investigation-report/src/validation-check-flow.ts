import fs from "node:fs/promises";
import path from "node:path";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import {
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { validateReferencedInvestigationResources } from "./resources.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  collectValidatedInvestigationCollection,
  type InvestigationSnapshot,
  type ValidatedInvestigationCollection
} from "./validation-collection.ts";
import { unrecordedPredecessorWarnings } from "./validation-history.ts";
import type {
  InvestigationReportCheckResult,
  InvestigationSource
} from "./types.ts";
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
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode: "check",
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
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  // Scoped checks intentionally do not claim collection-wide layout, graph,
  // resource membership, or index freshness proof. The selected root report
  // and only its direct resource links are the validation boundary.
  const errors: string[] = [...layout.candidateErrors];
  const diagnostics: InvestigationDiagnostic[] = [];
  const sources = await readInvestigationSources(
    investigationRoot,
    layout.reportIds
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const available = new Set(sourceById.keys());
  const selected = ids.filter((id) => available.has(id));
  if (selected.length === 0) {
    errors.push("no investigation reports matched the requested IDs");
  }
  for (const id of ids) {
    if (!available.has(id)) {
      errors.push(`${id} investigation report does not exist`);
      continue;
    }
    errors.push(
      ...(await validateScopedReport(
        investigationRoot,
        sourceById.get(id)!,
        diagnostics
      ))
    );
  }
  return checkResult({
    availableReportCount: layout.reportIds.length,
    diagnostics,
    errors,
    indexChecked: false,
    indexPath: path.join(investigationRoot, investigationIndexFileName),
    selectedReportCount: selected.length
  });
}

async function validateScopedReport(
  investigationRoot: string,
  source: InvestigationSource,
  diagnostics: InvestigationDiagnostic[]
): Promise<string[]> {
  const { id } = source;
  const target = path.join(investigationRoot, source.sourcePath);
  let text: string;
  try {
    text = await fs.readFile(target, "utf8");
  } catch (error) {
    diagnostics.push(
      diagnosticFromError({
        code: "investigation-report.report-read-failed",
        error,
        reason: "the selected investigation report could not be read",
        recovery: "restore read access to the report, then retry the check",
        target
      })
    );
    return [`${id} could not be read`];
  }
  const built = buildInvestigationReportState(
    id,
    parseInvestigationReport(text, id),
    source.sourcePath
  );
  if (built.status !== "valid") return built.errors;
  return [
    ...built.errors,
    ...(await validateReferencedInvestigationResources(
      investigationRoot,
      built.state.resourceIds
    ))
  ];
}
