import type { LedgerCase } from "./catalog-validation.ts";
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
  unregisteredTestFiles: UnregisteredPolicy;
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
  const mainMarkers = markers.filter((marker) => marker.role === "main");
  const derivedMarkers = markers.filter((marker) => marker.role === "derived");
  const exemptMarkers = markers.filter((marker) => marker.role === "exempt");
  const validMainMarkers = validIdMarkers(mainMarkers, options.caseIdPattern, errors);
  const validDerivedMarkers = validIdMarkers(
    derivedMarkers,
    options.caseIdPattern,
    errors
  );
  const validExemptMarkers = validIdMarkers(
    exemptMarkers,
    options.caseIdPattern,
    errors
  );

  for (const id of duplicateValues(validMainMarkers.map((marker) => marker.id))) {
    errors.push(
      `duplicate @test-evidence main marker: ${id} in `
      + markerLocations(validMainMarkers, id)
    );
  }

  const documentedById = new Map(options.cases.map((entry) => [entry.id, entry]));
  const mainById = groupMarkers(validMainMarkers);
  const exemptById = groupMarkers(validExemptMarkers);
  const allValidMarkers = [
    ...validMainMarkers,
    ...validDerivedMarkers,
    ...validExemptMarkers
  ];

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

  for (const marker of allValidMarkers) {
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
    if (marker.role === "exempt" && documented.kind !== "active-exempt") {
      errors.push(
        `${marker.relativePath}:${marker.line} @test-evidence exempt ${marker.id} `
        + "must reference an active exempt case"
      );
    }
  }

  const testFiles = options.files.filter((file) => file.detectedLanguages.length > 0);
  const testFilePaths = new Set(testFiles.map((file) => file.relativePath));
  for (const marker of allValidMarkers) {
    if (!testFilePaths.has(marker.relativePath)) {
      errors.push(
        `${marker.relativePath}:${marker.line} @test-evidence ${marker.role} ${marker.id} `
        + "is not in a discovered test file"
      );
    }
  }

  for (const file of testFiles) {
    validateFileMarkerRoles(file, errors);
  }

  const registeredPaths = new Set(
    [...validMainMarkers, ...validDerivedMarkers].map((marker) => marker.relativePath)
  );
  const exemptPaths = new Set(validExemptMarkers.map((marker) => marker.relativePath));
  const exemptTestFiles = testFiles.filter((file) => exemptPaths.has(file.relativePath));
  const unregistered = testFiles.filter((file) =>
    !registeredPaths.has(file.relativePath) && !exemptPaths.has(file.relativePath)
  );
  const unregisteredMessages = unregistered.map((file) =>
    `${file.relativePath} contains ${file.detectedLanguages.join("/")} test entries but has no `
    + "@test-evidence main, derived, or exempt marker"
  );
  if (options.unregisteredTestFiles === "error") {
    errors.push(...unregisteredMessages);
  } else if (options.unregisteredTestFiles === "warn") {
    warnings.push(...unregisteredMessages);
  }

  return {
    errors,
    summary: {
      activeAutomatedCases: activeAutomatedCases.length,
      catalogCases: options.catalogCaseCount,
      derivedMarkers: validDerivedMarkers.length,
      discoveredTestFiles: testFiles.length,
      exemptCases: exemptCases.length,
      exemptMarkers: validExemptMarkers.length,
      exemptTestFiles: exemptTestFiles.length,
      mainMarkers: validMainMarkers.length,
      plannedAutomatedCases: plannedAutomatedCases.length,
      reviewCases: reviewCases.length,
      unregisteredTestFiles: unregistered.length
    },
    warnings
  };
}

function validIdMarkers(
  markers: readonly SourceMarker[],
  caseIdPattern: RegExp,
  errors: string[]
): SourceMarker[] {
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

function groupMarkers(markers: readonly SourceMarker[]): Map<string, SourceMarker[]> {
  const grouped = new Map<string, SourceMarker[]>();
  for (const marker of markers) {
    const entries = grouped.get(marker.id) ?? [];
    entries.push(marker);
    grouped.set(marker.id, entries);
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

function validateFileMarkerRoles(file: SourceFile, errors: string[]): void {
  const markersById = groupMarkers(file.markers);
  for (const [id, markers] of markersById) {
    const roles = new Set(markers.map((marker) => marker.role));
    if (roles.has("main") && roles.has("derived")) {
      errors.push(
        `${file.relativePath} must not mark ${id} as both main and derived`
      );
    }
    if (markers.filter((marker) => marker.role === "derived").length > 1) {
      errors.push(
        `${file.relativePath} must not repeat @test-evidence derived ${id}`
      );
    }
  }

  const roles = new Set(file.markers.map((marker) => marker.role));
  if (roles.has("exempt") && (roles.has("main") || roles.has("derived"))) {
    errors.push(
      `${file.relativePath} must not mix @test-evidence exempt with main or derived`
    );
  }
  if (file.markers.filter((marker) => marker.role === "exempt").length > 1) {
    errors.push(
      `${file.relativePath} must declare exactly one @test-evidence exempt marker`
    );
  }
}
