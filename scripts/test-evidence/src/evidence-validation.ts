import type { LedgerCase } from "./catalog-validation.ts";
import {
  compileScopePattern,
  matchesAnyScope
} from "./scope.ts";
import type {
  SourceFile,
  SourceMarker,
  TestEvidenceSummary,
  UnregisteredPolicy
} from "./types.ts";

export type EvidenceValidationOptions = {
  caseIdPattern: RegExp;
  cases: readonly LedgerCase[];
  catalogCaseCount: number;
  catalogPath: string;
  documentedCaseIds: ReadonlySet<string>;
  files: readonly SourceFile[];
  unregisteredTestEntries: UnregisteredPolicy;
};

export type EvidenceValidationResult = {
  errors: string[];
  summary: TestEvidenceSummary;
  warnings: string[];
};

export function validateEvidenceState(
  options: EvidenceValidationOptions
): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const activeAutomatedCases = options.cases.filter(
    (entry) => entry.kind === "active-automated"
  );
  const plannedAutomatedCases = options.cases.filter(
    (entry) => entry.kind === "planned-automated"
  );
  const reviewCases = options.cases.filter((entry) => entry.kind === "active-review");
  const exemptCases = options.cases.filter((entry) => entry.kind === "active-exempt");

  const markers = options.files.flatMap((file) => file.markers);
  for (const marker of markers) {
    if (marker.attachedEntryOffset === null) {
      errors.push(
        `${marker.relativePath}:${marker.line} @test-evidence ${marker.role} `
        + `${marker.id} does not directly precede a discovered test entry`
      );
    }
  }

  const attachedMarkers = markers.filter(
    (marker): marker is SourceMarker & { attachedEntryOffset: number } =>
      marker.attachedEntryOffset !== null
  );
  const markersByEntry = groupMarkersByEntry(attachedMarkers);
  for (const entryMarkers of markersByEntry.values()) {
    if (entryMarkers.length > 1) {
      const first = entryMarkers[0];
      if (first !== undefined) {
        errors.push(
          `${first.relativePath}:${first.line} multiple markers target one discovered `
          + "test entry; every entry must have exactly one @test-evidence marker"
        );
      }
    }
  }

  const validMarkers = validIdMarkers(
    attachedMarkers,
    options.caseIdPattern,
    errors
  );
  const mainMarkers = validMarkers.filter((marker) => marker.role === "main");
  const derivedMarkers = validMarkers.filter((marker) => marker.role === "derived");
  const exemptMarkers = validMarkers.filter((marker) => marker.role === "exempt");

  for (const id of duplicateValues(mainMarkers.map((marker) => marker.id))) {
    errors.push(
      `duplicate @test-evidence main marker: ${id} in `
      + markerLocations(mainMarkers, id)
    );
  }

  const documentedById = new Map(options.cases.map((entry) => [entry.id, entry]));
  const mainById = groupMarkersById(mainMarkers);
  const exemptById = groupMarkersById(exemptMarkers);

  for (const entry of activeAutomatedCases) {
    const caseMarkers = mainById.get(entry.id) ?? [];
    if (caseMarkers.length === 0) {
      errors.push(
        `${options.catalogPath}:${entry.line} active automated case ${entry.id} `
        + "is missing @test-evidence main"
      );
      continue;
    }
    for (const marker of caseMarkers) {
      if (marker.relativePath !== entry.codePath) {
        errors.push(
          `${options.catalogPath}:${entry.line} ${entry.id} Code path ${entry.codePath} `
          + `does not match @test-evidence main ${marker.relativePath}:${marker.line}`
        );
      }
    }
  }

  for (const entry of exemptCases) {
    if ((exemptById.get(entry.id) ?? []).length === 0) {
      errors.push(
        `${options.catalogPath}:${entry.line} active exempt case ${entry.id} `
        + "is missing @test-evidence exempt"
      );
    }
  }

  for (const marker of validMarkers) {
    const documented = documentedById.get(marker.id);
    if (documented === undefined) {
      const markerLocation =
        `${marker.relativePath}:${marker.line} @test-evidence ${marker.role} ${marker.id}`;
      errors.push(options.documentedCaseIds.has(marker.id)
        ? `${markerLocation} references a structurally invalid case in ${options.catalogPath}`
        : `${markerLocation} is missing from ${options.catalogPath}`);
      continue;
    }
    if (
      (marker.role === "main" || marker.role === "derived")
      && documented.kind !== "active-automated"
    ) {
      errors.push(
        `${marker.relativePath}:${marker.line} @test-evidence ${marker.role} ${marker.id} `
        + "must reference an active automated case"
      );
    }
    if (marker.role === "exempt") {
      if (documented.kind !== "active-exempt") {
        errors.push(
          `${marker.relativePath}:${marker.line} @test-evidence exempt ${marker.id} `
          + "must reference an active exempt case"
        );
      } else {
        const matchers = documented.scopePatterns.map(compileScopePattern);
        if (!matchesAnyScope(marker.relativePath, matchers)) {
          errors.push(
            `${marker.relativePath}:${marker.line} @test-evidence exempt ${marker.id} `
            + "must be covered by the case Scope"
          );
        }
      }
    }
  }

  const testEntries = options.files.flatMap((file) =>
    file.testEntries.map((entry) => ({ entry, relativePath: file.relativePath }))
  );
  const validMarkersByEntry = groupMarkersByEntry(validMarkers);
  const unregistered = testEntries.filter(({ entry, relativePath }) =>
    (validMarkersByEntry.get(entryKey(relativePath, entry.offset)) ?? []).length === 0
  );
  const unregisteredMessages = unregistered.map(({ entry, relativePath }) =>
    `${relativePath}:${entry.line}:${entry.column} contains a ${entry.language} test entry `
    + "but has no attached @test-evidence main, derived, or exempt marker"
  );
  if (options.unregisteredTestEntries === "error") {
    errors.push(...unregisteredMessages);
  } else if (options.unregisteredTestEntries === "warn") {
    warnings.push(...unregisteredMessages);
  }

  const exemptEntryKeys = new Set(
    exemptMarkers.map((marker) =>
      entryKey(marker.relativePath, marker.attachedEntryOffset)
    )
  );
  const discoveredTestFiles = new Set(
    testEntries.map(({ relativePath }) => relativePath)
  );

  return {
    errors,
    summary: {
      activeAutomatedCases: activeAutomatedCases.length,
      catalogCases: options.catalogCaseCount,
      derivedMarkers: derivedMarkers.length,
      discoveredTestEntries: testEntries.length,
      discoveredTestFiles: discoveredTestFiles.size,
      exemptCases: exemptCases.length,
      exemptMarkers: exemptMarkers.length,
      exemptTestEntries: exemptEntryKeys.size,
      mainMarkers: mainMarkers.length,
      plannedAutomatedCases: plannedAutomatedCases.length,
      reviewCases: reviewCases.length,
      reviewTriggers: 0,
      unregisteredTestEntries: unregistered.length
    },
    warnings
  };
}

function validIdMarkers<T extends SourceMarker>(
  markers: readonly T[],
  caseIdPattern: RegExp,
  errors: string[]
): T[] {
  return markers.filter((marker) => {
    if (caseIdPattern.test(marker.id)) {
      return true;
    }
    errors.push(
      `${marker.relativePath}:${marker.line} @test-evidence ${marker.role} `
      + "must include a valid case ID"
    );
    return false;
  });
}

function groupMarkersById<T extends SourceMarker>(
  markers: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const marker of markers) {
    const entries = grouped.get(marker.id) ?? [];
    entries.push(marker);
    grouped.set(marker.id, entries);
  }
  return grouped;
}

function groupMarkersByEntry<T extends SourceMarker & {
  attachedEntryOffset: number;
}>(markers: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const marker of markers) {
    const key = entryKey(marker.relativePath, marker.attachedEntryOffset);
    const entries = grouped.get(key) ?? [];
    entries.push(marker);
    grouped.set(key, entries);
  }
  return grouped;
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

function markerLocations(markers: readonly SourceMarker[], id: string): string {
  return markers
    .filter((marker) => marker.id === id)
    .map((marker) => `${marker.relativePath}:${marker.line}`)
    .join(", ");
}

function entryKey(relativePath: string, offset: number): string {
  return `${relativePath}\0${offset}`;
}
