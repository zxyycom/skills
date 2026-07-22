import type { ParsedCatalogCase } from "./catalog.ts";
import type { LedgerCase } from "./catalog-validation.ts";
import type {
  ReviewTrigger,
  TestEntryInventory,
  TestEntryMarker,
  TestEvidenceCaseView,
  TestEvidenceSourceEntryView,
  TestEvidenceSourceMarkerView
} from "./types.ts";

export type BuildInspectionViewsOptions = {
  inventory: TestEntryInventory;
  parsedCases: readonly ParsedCatalogCase[];
  reviewTriggers: readonly ReviewTrigger[];
  validCases: readonly LedgerCase[];
};

export type InspectionViews = {
  cases: TestEvidenceCaseView[];
  sourceEntries: TestEvidenceSourceEntryView[];
};

export function buildInspectionViews(
  options: BuildInspectionViewsOptions
): InspectionViews {
  const idCounts = countValues(options.parsedCases.map((entry) => entry.id));
  const validCaseLocations = new Set(
    options.validCases.map((entry) => caseLocation(entry.id, entry.line))
  );
  const triggers = new Map(
    options.reviewTriggers.map((trigger) => [trigger.caseId, trigger])
  );

  return {
    cases: options.parsedCases.map((entry) => ({
      codePath: entry.codePath,
      contract: [...entry.sections.contract.items],
      id: entry.id,
      lastReview: entry.reviewResult !== null
        && entry.reviewedAt !== null
        && entry.reviewedCommit !== null
        ? {
            at: entry.reviewedAt,
            commit: entry.reviewedCommit,
            result: entry.reviewResult
          }
        : null,
      line: entry.line,
      proves: [...entry.sections.proves.items],
      reason: [...entry.sections.reason.items],
      review: [...entry.sections.review.items],
      risk: [...entry.sections.risk.items],
      scope: entry.sections.scope.items.map(normalizeScopeItem),
      sourceMarkers: options.inventory.markers
        .filter((marker) => marker.caseId === entry.id)
        .map((marker) => markerView(marker, options.inventory))
        .sort(compareMarkerViews),
      status: entry.status,
      title: entry.title,
      trigger: triggers.get(entry.id) ?? null,
      valid: idCounts.get(entry.id) === 1
        && validCaseLocations.has(caseLocation(entry.id, entry.line)),
      verification: entry.verification
    })),
    sourceEntries: sourceEntryViews(options.inventory)
  };
}

function markerView(
  marker: TestEntryMarker,
  inventory: TestEntryInventory
): TestEvidenceSourceMarkerView {
  const entry = marker.targetEntryId === null
    ? null
    : inventory.entries.find((candidate) => candidate.id === marker.targetEntryId) ?? null;
  return {
    attached: entry !== null,
    entryColumn: entry?.column ?? null,
    entryLine: entry?.line ?? null,
    markerLine: marker.line,
    path: marker.path,
    role: marker.role
  };
}

function sourceEntryViews(
  inventory: TestEntryInventory
): TestEvidenceSourceEntryView[] {
  return inventory.entries.map((entry) => ({
    column: entry.column,
    detectorIds: [...entry.detectorIds],
    id: entry.id,
    language: entry.language,
    line: entry.line,
    markers: inventory.markers
      .filter((marker) => marker.targetEntryId === entry.id)
      .map((marker) => ({
        caseId: marker.caseId,
        markerLine: marker.line,
        role: marker.role
      }))
      .sort((left, right) => left.markerLine - right.markerLine),
    path: entry.path
  }));
}

function normalizeScopeItem(value: string): string {
  return value.match(/^`([^`]+)`$/u)?.[1] ?? value;
}

function countValues(values: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function caseLocation(id: string, line: number): string {
  return `${id}\0${line}`;
}

function compareMarkerViews(
  left: TestEvidenceSourceMarkerView,
  right: TestEvidenceSourceMarkerView
): number {
  return compareText(left.path, right.path)
    || left.markerLine - right.markerLine;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
