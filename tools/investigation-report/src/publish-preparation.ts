import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { readInvestigationCandidate } from "./candidate.ts";
import { candidatePathForInvestigationId } from "./candidate-path.ts";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import {
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  collectValidatedInvestigationCollection,
  unrecordedPredecessorWarnings
} from "./validation.ts";
import type { InvestigationIndexState, InvestigationSource } from "./types.ts";
import type { InvestigationDiagnostic } from "./diagnostics.ts";

export type InvestigationPublishPreparation = Readonly<{
  candidatePaths: Map<string, string>;
  candidateSources: InvestigationSource[];
  formalSources: InvestigationSource[];
  indexExisted: boolean;
  indexPath: string;
  nextIndexText: string;
  resourceSnapshot: readonly InvestigationPublishResourceIdentity[];
  sources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
  warnings: string[];
}>;

export type InvestigationPublishResourceIdentity = Readonly<{
  dev: bigint;
  id: string;
  ino: bigint;
}>;

export type InvestigationPublishPreparationResult =
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: [];
      status: "ok";
      value: InvestigationPublishPreparation;
      warnings: string[];
    }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
      warnings: string[];
    }>;

/**
 * Builds the exact final formal collection for a selected candidate batch.
 * It owns only read-only publication gates; the mutation module re-runs it
 * under the collection lock before changing candidate names or the index.
 */
export async function prepareInvestigationPublish(
  investigationsDirectory: string,
  ids: readonly string[]
): Promise<InvestigationPublishPreparationResult> {
  const layout = await readLayout(investigationsDirectory);
  if ("errors" in layout) return layout;
  const selectionErrors = selectedCandidateErrors(layout.value, ids);
  if (selectionErrors.length > 0) return preparationFailure(selectionErrors);

  const formal = await collectValidatedInvestigationCollection(
    investigationsDirectory,
    { allowEmptyCollection: true }
  );
  if (formal.errors.length > 0 || formal.snapshot === null) {
    return preparationFailure(formal.errors, [], formal.warnings);
  }
  const indexExisted = await regularIndexExists(formal.indexPath);
  if ("errors" in indexExisted) return indexExisted;
  if (formal.reportCount > 0 || indexExisted.value) {
    const freshness = await syncInvestigationStateIndex({
      investigationsDirectory,
      mode: "check",
      snapshot: formal.snapshot
    });
    if (freshness.status === "error") {
      return preparationFailure(
        investigationIndexDiagnosticMessages(
          freshness.diagnostics,
          formal.indexPath
        ),
        [],
        formal.warnings
      );
    }
  }

  const candidateSources: InvestigationSource[] = [];
  const candidatePaths = new Map<string, string>();
  const states = new Map(formal.states);
  const warnings = [...formal.warnings];
  for (const id of ids) {
    const candidate = await readInvestigationCandidate(
      investigationsDirectory,
      id
    );
    if (candidate.status === "error") {
      return preparationFailure(
        candidate.errors,
        candidate.diagnostics,
        warnings
      );
    }
    if (
      !candidate.value.readiness.scaffoldValid ||
      !candidate.value.readiness.bodyReady ||
      !candidate.value.readiness.resourceReady ||
      candidate.value.markdown === null
    ) {
      return preparationFailure(
        [
          `${id} investigation candidate is not ready for publish: ${candidate.value.errors.join("; ")}`
        ],
        [],
        warnings
      );
    }
    const parsed = parseInvestigationReport(candidate.value.markdown, id);
    const built = buildInvestigationReportState(id, parsed);
    if (built.status === "invalid") {
      return preparationFailure(built.errors, [], warnings);
    }
    candidatePaths.set(
      id,
      candidatePathForInvestigationId(investigationsDirectory, id)
    );
    candidateSources.push({ id, text: candidate.value.markdown });
    states.set(id, built.state);
  }

  const relationErrors = validateInvestigationRelationGraph(states);
  if (relationErrors.length > 0)
    return preparationFailure(relationErrors, [], warnings);

  const references: InvestigationResourceReferencesByReport = new Map(
    [...states].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const resourceValidation = await validateFullInvestigationResources(
    investigationsDirectory,
    references
  );
  if (resourceValidation.errors.length > 0) {
    return preparationFailure(
      resourceValidation.errors,
      [],
      [...warnings, ...resourceValidation.warnings]
    );
  }
  warnings.push(...resourceValidation.warnings);
  warnings.push(
    ...(await unrecordedPredecessorWarnings(investigationsDirectory, states))
  );

  const sources = [...formal.sources, ...candidateSources].sort((left, right) =>
    compareText(left.id, right.id)
  );
  const snapshot = createInvestigationStateSnapshot(
    sources,
    sources.map((source) => states.get(source.id)!)
  );
  const definition = createInvestigationStateIndexDefinition({ snapshot });
  const builtIndex = await buildStateIndex(definition, {
    root: investigationsDirectory
  });
  if (builtIndex.status === "error") {
    return preparationFailure(
      investigationIndexDiagnosticMessages(
        builtIndex.diagnostics,
        formal.indexPath
      ),
      [],
      warnings
    );
  }

  const resourceSnapshot = await snapshotReferencedResources(
    investigationsDirectory,
    candidateSources.flatMap((source) => states.get(source.id)!.resourceIds)
  );
  if (resourceSnapshot.status === "error") {
    return preparationFailure(resourceSnapshot.errors, [], warnings);
  }
  return {
    diagnostics: [],
    errors: [],
    status: "ok",
    value: {
      candidatePaths,
      candidateSources,
      formalSources: formal.sources,
      indexExisted: indexExisted.value,
      indexPath: formal.indexPath,
      nextIndexText: serializeStateIndex(builtIndex.value, definition),
      resourceSnapshot: resourceSnapshot.value,
      sources,
      states,
      warnings: uniqueSorted(warnings)
    },
    warnings: uniqueSorted(warnings)
  };
}

/** Rechecks only member identity, deliberately not resource bytes. */
export async function resourceSnapshotStillCurrent(
  investigationsDirectory: string,
  expected: readonly InvestigationPublishResourceIdentity[]
): Promise<string[]> {
  const current = await snapshotReferencedResources(
    investigationsDirectory,
    expected.map((resource) => resource.id)
  );
  if (current.status === "error") return current.errors;
  const unchanged =
    current.value.length === expected.length &&
    current.value.every(
      (entry, index) =>
        entry.id === expected[index]?.id &&
        entry.dev === expected[index]?.dev &&
        entry.ino === expected[index]?.ino
    );
  return unchanged
    ? []
    : [
        "selected candidate resources changed identity after publish preparation; no files were written"
      ];
}

async function readLayout(
  investigationsDirectory: string
): Promise<
  | Readonly<{ status: "ok"; value: InvestigationCollectionLayout }>
  | InvestigationPublishPreparationResult
> {
  try {
    const layout = await inspectInvestigationCollectionLayout(
      investigationsDirectory
    );
    return layout.errors.length === 0
      ? { status: "ok", value: layout }
      : preparationFailure(layout.errors);
  } catch {
    return preparationFailure([
      "investigation root could not be safely inspected before publish"
    ]);
  }
}

function selectedCandidateErrors(
  layout: InvestigationCollectionLayout,
  ids: readonly string[]
): string[] {
  const selected = new Set(ids);
  const errors: string[] = [];
  if (ids.length === 0)
    errors.push("publish requires at least one Investigation ID");
  if (selected.size !== ids.length) errors.push("publish IDs must not repeat");
  for (const id of ids) {
    if (!layout.candidateIds.includes(id)) {
      errors.push(`${id} investigation candidate does not exist`);
    }
  }
  return uniqueSorted(errors);
}

async function regularIndexExists(
  indexPath: string
): Promise<
  | Readonly<{ status: "ok"; value: boolean }>
  | InvestigationPublishPreparationResult
> {
  try {
    const entry = await fs.lstat(indexPath);
    return entry.isFile() && !entry.isSymbolicLink()
      ? { status: "ok", value: true }
      : preparationFailure([
          "investigation index must be a regular non-symbolic-link file"
        ]);
  } catch (error) {
    if (isMissing(error)) return { status: "ok", value: false };
    return preparationFailure([
      "investigation index could not be inspected before publish"
    ]);
  }
}

async function snapshotReferencedResources(
  investigationsDirectory: string,
  ids: readonly string[]
): Promise<
  | Readonly<{ status: "ok"; value: InvestigationPublishResourceIdentity[] }>
  | Readonly<{ errors: string[]; status: "error" }>
> {
  const snapshots: InvestigationPublishResourceIdentity[] = [];
  for (const id of [...new Set(ids)].sort(compareText)) {
    const resourcePath = path.join(
      investigationsDirectory,
      investigationResourcesDirectoryName,
      ...id.split("/")
    );
    try {
      const stat = await fs.lstat(resourcePath, { bigint: true });
      if (stat.isSymbolicLink() || !stat.isFile()) {
        return {
          errors: [
            `${investigationResourcesDirectoryName}/${id} changed to an unsafe member`
          ],
          status: "error"
        };
      }
      snapshots.push({ dev: stat.dev, id, ino: stat.ino });
    } catch {
      return {
        errors: [
          `${investigationResourcesDirectoryName}/${id} could not be rechecked before publish`
        ],
        status: "error"
      };
    }
  }
  return { status: "ok", value: snapshots };
}

function preparationFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = [],
  warnings: readonly string[] = []
): InvestigationPublishPreparationResult {
  return {
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: uniqueSorted(warnings)
  };
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
