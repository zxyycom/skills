import fs from "node:fs/promises";
import path from "node:path";
import { collectCatalogCases, duplicateValues, normalizePath } from "./catalog.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import { discoverSourceFiles } from "./discovery.ts";
import type {
  SourceMarker,
  TestEvidenceReport,
  TestEvidenceSummary
} from "./types.ts";

export type ValidateTestEvidenceOptions = {
  configPath?: string;
  workspaceRoot: string;
};

const emptySummary: TestEvidenceSummary = {
  catalogCases: 0,
  discoveredTestFiles: 0,
  exemptTestFiles: 0,
  implementedCases: 0,
  plannedCases: 0,
  primaryMarkers: 0,
  supportingMarkers: 0,
  unregisteredTestFiles: 0
};

export async function validateTestEvidence(
  options: ValidateTestEvidenceOptions
): Promise<TestEvidenceReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const loaded = await loadTestEvidenceConfig(workspaceRoot, options.configPath);
  errors.push(...loaded.errors);
  if (loaded.config === null) {
    return { errors, summary: { ...emptySummary }, warnings };
  }
  const config = loaded.config;

  let catalogText = "";
  try {
    catalogText = await fs.readFile(path.join(workspaceRoot, config.catalogPath), "utf8");
  } catch (error) {
    errors.push(
      `${config.catalogPath} could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const caseIdPattern = new RegExp(config.caseIdPattern, "u");
  const catalogCases = collectCatalogCases(catalogText, caseIdPattern);
  const implemented = catalogCases.filter((entry) => entry.status === "implemented");
  const planned = catalogCases.filter((entry) => entry.status === "planned");
  const discovery = await discoverSourceFiles(workspaceRoot, config);
  errors.push(...discovery.errors);

  const markers = discovery.files.flatMap((file) => file.markers);
  const primaryMarkers = markers.filter((marker) => marker.kind === "case");
  const supportingMarkers = markers.filter((marker) => marker.kind === "supports");
  const exemptionMarkers = markers.filter((marker) => marker.kind === "test-exempt");
  const validPrimaryMarkers = validIdMarkers(primaryMarkers, caseIdPattern, errors);
  const validSupportingMarkers = validIdMarkers(supportingMarkers, caseIdPattern, errors);

  for (const marker of exemptionMarkers) {
    if (marker.reason === null || marker.reason.trim().length === 0) {
      errors.push(
        `${marker.relativePath}:${marker.line} @test-exempt must include a non-empty reason`
      );
    }
  }

  errors.push(...duplicateValues(catalogCases.map((entry) => entry.id))
    .map((id) => `duplicate case ID in ${config.catalogPath}: ${id}`));
  errors.push(...duplicateValues(validPrimaryMarkers.map((marker) => marker.id ?? ""))
    .map((id) => `duplicate primary @case marker: ${id} in ${markerLocations(validPrimaryMarkers, id)}`));

  for (const entry of catalogCases) {
    if (entry.status === null) {
      errors.push(
        `${config.catalogPath}:${entry.line} ${entry.id} must declare Status: implemented or Status: planned`
      );
    }
    if (entry.provesDeclarations !== 1 || !entry.provesContent) {
      errors.push(
        `${config.catalogPath}:${entry.line} ${entry.id} must include exactly one non-empty Proves section`
      );
    }
    if (
      entry.status === "implemented"
      && (
        entry.codeDeclarations !== 1
        || entry.invalidCode
        || entry.codePath === null
      )
    ) {
      errors.push(
        `${config.catalogPath}:${entry.line} ${entry.id} must declare exactly one Code path`
      );
    }
    if (entry.status === "planned" && entry.codeDeclarations > 0) {
      errors.push(
        `${config.catalogPath}:${entry.line} planned case ${entry.id} must not declare Code`
      );
    }
  }

  const documentedById = new Map(catalogCases.map((entry) => [entry.id, entry]));
  const primaryById = groupMarkers(validPrimaryMarkers);
  const allLinkedMarkers = [...validPrimaryMarkers, ...validSupportingMarkers];

  for (const entry of implemented) {
    const caseMarkers = primaryById.get(entry.id) ?? [];
    if (caseMarkers.length === 0) {
      errors.push(
        `${config.catalogPath}:${entry.line} implemented case ${entry.id} is missing a primary @case marker`
      );
      continue;
    }

    if (entry.codePath !== null) {
      for (const marker of caseMarkers) {
        if (normalizePath(marker.relativePath) !== entry.codePath) {
          errors.push(
            `${config.catalogPath}:${entry.line} ${entry.id} Code path ${entry.codePath} does not match @case marker ${marker.relativePath}:${marker.line}`
          );
        }
      }
    }
  }

  for (const marker of allLinkedMarkers) {
    const id = marker.id ?? "";
    const documented = documentedById.get(id);
    if (documented === undefined) {
      errors.push(
        `${marker.relativePath}:${marker.line} @${marker.kind} ${id} is missing from ${config.catalogPath}`
      );
    } else if (documented.status === "planned") {
      errors.push(
        `${marker.relativePath}:${marker.line} planned case ${id} must not have source markers`
      );
    }
  }

  const testFiles = discovery.files.filter((file) => file.detectedLanguages.length > 0);
  const exemptTestFiles = testFiles.filter((file) =>
    file.markers.some((marker) =>
      marker.kind === "test-exempt"
      && marker.reason !== null
      && marker.reason.trim().length > 0
    )
  );
  const registeredPaths = new Set(
    [...validPrimaryMarkers, ...validSupportingMarkers].map((marker) => marker.relativePath)
  );
  const exemptPaths = new Set(exemptTestFiles.map((file) => file.relativePath));
  const unregistered = testFiles.filter((file) =>
    !registeredPaths.has(file.relativePath) && !exemptPaths.has(file.relativePath)
  );
  const unregisteredMessages = unregistered.map((file) =>
    `${file.relativePath} contains ${file.detectedLanguages.join("/")} test entries but has no @case, @supports, or justified @test-exempt marker`
  );
  if (config.unregisteredTestFiles === "error") {
    errors.push(...unregisteredMessages);
  } else if (config.unregisteredTestFiles === "warn") {
    warnings.push(...unregisteredMessages);
  }

  return {
    errors: [...new Set(errors)].sort(),
    summary: {
      catalogCases: catalogCases.length,
      discoveredTestFiles: testFiles.length,
      exemptTestFiles: exemptTestFiles.length,
      implementedCases: implemented.length,
      plannedCases: planned.length,
      primaryMarkers: validPrimaryMarkers.length,
      supportingMarkers: validSupportingMarkers.length,
      unregisteredTestFiles: unregistered.length
    },
    warnings: [...new Set(warnings)].sort()
  };
}

function validIdMarkers(
  markers: readonly SourceMarker[],
  caseIdPattern: RegExp,
  errors: string[]
): SourceMarker[] {
  return markers.filter((marker) => {
    const id = marker.id ?? "";
    if (id.length > 0 && caseIdPattern.test(id)) {
      return true;
    }
    errors.push(
      `${marker.relativePath}:${marker.line} @${marker.kind} must include a valid case ID`
    );
    return false;
  });
}

function groupMarkers(markers: readonly SourceMarker[]): Map<string, SourceMarker[]> {
  const grouped = new Map<string, SourceMarker[]>();
  for (const marker of markers) {
    const id = marker.id ?? "";
    const entries = grouped.get(id) ?? [];
    entries.push(marker);
    grouped.set(id, entries);
  }
  return grouped;
}

function markerLocations(markers: readonly SourceMarker[], id: string): string {
  return markers
    .filter((marker) => marker.id === id)
    .map((marker) => `${marker.relativePath}:${marker.line}`)
    .join(", ");
}
