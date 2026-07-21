import type { LedgerCase } from "./catalog-validation.ts";
import { createDiagnostic } from "./diagnostics.ts";
import { compileScopePattern, matchesAnyScope } from "./scope.ts";
import type {
  TestEntryInventory,
  TestEntryMarker,
  TestEvidenceDiagnostic,
  TestEvidenceSummary,
  UnregisteredPolicy
} from "./types.ts";

export type EvidenceValidationOptions = {
  caseIdPattern: RegExp;
  cases: readonly LedgerCase[];
  catalogCaseCount: number;
  catalogPath: string;
  documentedCaseIds: ReadonlySet<string>;
  inventory: TestEntryInventory;
  unregisteredTestEntries: UnregisteredPolicy;
};

export type EvidenceValidationResult = {
  diagnostics: TestEvidenceDiagnostic[];
  summary: TestEvidenceSummary;
};

export function validateEvidenceState(
  options: EvidenceValidationOptions
): EvidenceValidationResult {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const activeAutomatedCases = options.cases.filter(
    (entry) => entry.kind === "active-automated"
  );
  const plannedAutomatedCases = options.cases.filter(
    (entry) => entry.kind === "planned-automated"
  );
  const reviewCases = options.cases.filter((entry) => entry.kind === "active-review");
  const exemptCases = options.cases.filter((entry) => entry.kind === "active-exempt");

  const markers = options.inventory.markers;
  for (const marker of markers) {
    if (marker.targetEntryId === null) {
      diagnostics.push(mappingDiagnostic(
        marker,
        "mapping.marker-unattached",
        `${marker.path}:${marker.line} @test-evidence ${marker.role} ${marker.caseId} `
          + "does not directly precede a discovered test entry"
      ));
    }
  }

  const attachedMarkers = markers.filter(
    (marker): marker is TestEntryMarker & { targetEntryId: string } =>
      marker.targetEntryId !== null
  );
  const markersByEntry = groupMarkersByEntry(attachedMarkers);
  for (const entryMarkers of markersByEntry.values()) {
    if (entryMarkers.length > 1) {
      const first = entryMarkers[0];
      if (first !== undefined) {
        diagnostics.push(mappingDiagnostic(
          first,
          "mapping.entry-marker-count-invalid",
          `${first.path}:${first.line} multiple markers target one discovered test entry; `
            + "every entry must have exactly one @test-evidence marker"
        ));
      }
    }
  }

  const validMarkers = validIdMarkers(
    attachedMarkers,
    options.caseIdPattern,
    diagnostics
  );
  const mainMarkers = validMarkers.filter((marker) => marker.role === "main");
  const derivedMarkers = validMarkers.filter((marker) => marker.role === "derived");
  const exemptMarkers = validMarkers.filter((marker) => marker.role === "exempt");

  for (const caseId of duplicateValues(mainMarkers.map((marker) => marker.caseId))) {
    const marker = mainMarkers.find((candidate) => candidate.caseId === caseId);
    if (marker !== undefined) {
      diagnostics.push(mappingDiagnostic(
        marker,
        "mapping.main-duplicate",
        `duplicate @test-evidence main marker: ${caseId} in ${markerLocations(mainMarkers, caseId)}`
      ));
    }
  }

  const documentedById = new Map(options.cases.map((entry) => [entry.id, entry]));
  const mainById = groupMarkersById(mainMarkers);
  const exemptById = groupMarkersById(exemptMarkers);

  for (const entry of activeAutomatedCases) {
    const caseMarkers = mainById.get(entry.id) ?? [];
    if (caseMarkers.length === 0) {
      diagnostics.push(createDiagnostic({
        caseId: entry.id,
        category: "mapping",
        code: "mapping.main-missing",
        line: entry.line,
        message: `${options.catalogPath}:${entry.line} active automated case ${entry.id} `
          + "is missing @test-evidence main",
        path: options.catalogPath,
        severity: "error"
      }));
      continue;
    }
    for (const marker of caseMarkers) {
      if (marker.path !== entry.codePath) {
        diagnostics.push(mappingDiagnostic(
          marker,
          "mapping.code-path-mismatch",
          `${options.catalogPath}:${entry.line} ${entry.id} Code path ${entry.codePath} `
            + `does not match @test-evidence main ${marker.path}:${marker.line}`
        ));
      }
    }
  }

  for (const entry of exemptCases) {
    if ((exemptById.get(entry.id) ?? []).length === 0) {
      diagnostics.push(createDiagnostic({
        caseId: entry.id,
        category: "mapping",
        code: "mapping.exempt-missing",
        line: entry.line,
        message: `${options.catalogPath}:${entry.line} active exempt case ${entry.id} `
          + "is missing @test-evidence exempt",
        path: options.catalogPath,
        severity: "error"
      }));
    }
  }

  for (const marker of validMarkers) {
    const documented = documentedById.get(marker.caseId);
    if (documented === undefined) {
      const markerLocation = `${marker.path}:${marker.line} @test-evidence ${marker.role} ${marker.caseId}`;
      diagnostics.push(mappingDiagnostic(
        marker,
        options.documentedCaseIds.has(marker.caseId)
          ? "mapping.case-invalid"
          : "mapping.case-missing",
        options.documentedCaseIds.has(marker.caseId)
          ? `${markerLocation} references a structurally invalid case in ${options.catalogPath}`
          : `${markerLocation} is missing from ${options.catalogPath}`
      ));
      continue;
    }
    if (
      (marker.role === "main" || marker.role === "derived")
      && documented.kind !== "active-automated"
    ) {
      diagnostics.push(mappingDiagnostic(
        marker,
        "mapping.automated-role-invalid",
        `${marker.path}:${marker.line} @test-evidence ${marker.role} ${marker.caseId} `
          + "must reference an active automated case"
      ));
    }
    if (marker.role === "exempt") {
      if (documented.kind !== "active-exempt") {
        diagnostics.push(mappingDiagnostic(
          marker,
          "mapping.exempt-role-invalid",
          `${marker.path}:${marker.line} @test-evidence exempt ${marker.caseId} `
            + "must reference an active exempt case"
        ));
      } else if (!matchesAnyScope(
        marker.path,
        documented.scopePatterns.map(compileScopePattern)
      )) {
        diagnostics.push(mappingDiagnostic(
          marker,
          "mapping.exempt-scope-mismatch",
          `${marker.path}:${marker.line} @test-evidence exempt ${marker.caseId} `
            + "must be covered by the case Scope"
        ));
      }
    }
  }

  const validMarkersByEntry = groupMarkersByEntry(validMarkers);
  const unregistered = options.inventory.entries.filter((entry) =>
    (validMarkersByEntry.get(entry.id) ?? []).length === 0
  );
  if (options.unregisteredTestEntries !== "ignore") {
    for (const entry of unregistered) {
      const severity = options.unregisteredTestEntries === "error" ? "error" : "warning";
      diagnostics.push(createDiagnostic({
        blocking: severity === "error",
        category: "mapping",
        code: "mapping.unregistered-entry",
        column: entry.column,
        line: entry.line,
        message: `${entry.path}:${entry.line}:${entry.column} contains a ${entry.language} test entry `
          + "but has no attached @test-evidence main, derived, or exempt marker",
        path: entry.path,
        severity
      }));
    }
  }

  return {
    diagnostics,
    summary: {
      activeAutomatedCases: activeAutomatedCases.length,
      catalogCases: options.catalogCaseCount,
      derivedMarkers: derivedMarkers.length,
      discoveredTestEntries: options.inventory.entries.length,
      discoveredTestFiles: new Set(
        options.inventory.entries.map((entry) => entry.path)
      ).size,
      exemptCases: exemptCases.length,
      exemptMarkers: exemptMarkers.length,
      exemptTestEntries: new Set(
        exemptMarkers.map((marker) => marker.targetEntryId)
      ).size,
      mainMarkers: mainMarkers.length,
      plannedAutomatedCases: plannedAutomatedCases.length,
      reviewCases: reviewCases.length,
      reviewTriggers: 0,
      unregisteredTestEntries: unregistered.length
    }
  };
}

function validIdMarkers<T extends TestEntryMarker>(
  markers: readonly T[],
  caseIdPattern: RegExp,
  diagnostics: TestEvidenceDiagnostic[]
): T[] {
  return markers.filter((marker) => {
    if (caseIdPattern.test(marker.caseId)) {
      return true;
    }
    diagnostics.push(mappingDiagnostic(
      marker,
      "mapping.case-id-invalid",
      `${marker.path}:${marker.line} @test-evidence ${marker.role} must include a valid case ID`
    ));
    return false;
  });
}

function mappingDiagnostic(
  marker: TestEntryMarker,
  code: string,
  message: string
): TestEvidenceDiagnostic {
  return createDiagnostic({
    caseId: marker.caseId,
    category: "mapping",
    code,
    line: marker.line,
    message,
    path: marker.path,
    severity: "error"
  });
}

function groupMarkersById<T extends TestEntryMarker>(
  markers: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const marker of markers) {
    const entries = grouped.get(marker.caseId) ?? [];
    entries.push(marker);
    grouped.set(marker.caseId, entries);
  }
  return grouped;
}

function groupMarkersByEntry<T extends TestEntryMarker & { targetEntryId: string }>(
  markers: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const marker of markers) {
    const entries = grouped.get(marker.targetEntryId) ?? [];
    entries.push(marker);
    grouped.set(marker.targetEntryId, entries);
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

function markerLocations(markers: readonly TestEntryMarker[], caseId: string): string {
  return markers
    .filter((marker) => marker.caseId === caseId)
    .map((marker) => `${marker.path}:${marker.line}`)
    .join(", ");
}
