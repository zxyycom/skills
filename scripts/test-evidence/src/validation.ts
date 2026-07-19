import fs from "node:fs/promises";
import path from "node:path";
import { collectCatalogCases } from "./catalog.ts";
import { validateCatalogCases } from "./catalog-validation.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import { discoverSourceFiles } from "./discovery.ts";
import { validateEvidenceState } from "./evidence-validation.ts";
import type {
  TestEvidenceReport,
  TestEvidenceSummary
} from "./types.ts";

export type ValidateTestEvidenceOptions = {
  configPath?: string;
  workspaceRoot: string;
};

const emptySummary: TestEvidenceSummary = {
  activeAutomatedCases: 0,
  catalogCases: 0,
  derivedMarkers: 0,
  discoveredTestFiles: 0,
  exemptCases: 0,
  exemptMarkers: 0,
  exemptTestFiles: 0,
  mainMarkers: 0,
  plannedAutomatedCases: 0,
  reviewCases: 0,
  unregisteredTestFiles: 0
};

export async function validateTestEvidence(
  options: ValidateTestEvidenceOptions
): Promise<TestEvidenceReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const errors: string[] = [];
  const loaded = await loadTestEvidenceConfig(workspaceRoot, options.configPath);
  errors.push(...loaded.errors);
  if (loaded.config === null) {
    return { errors: uniqueSorted(errors), summary: { ...emptySummary }, warnings: [] };
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
  const parsedCatalogCases = collectCatalogCases(catalogText, caseIdPattern);
  const catalog = validateCatalogCases(parsedCatalogCases, config.catalogPath);
  const discovery = await discoverSourceFiles(workspaceRoot, config);
  const evidence = validateEvidenceState({
    caseIdPattern,
    cases: catalog.cases,
    catalogCaseCount: parsedCatalogCases.length,
    catalogPath: config.catalogPath,
    documentedCaseIds: catalog.documentedCaseIds,
    files: discovery.files,
    unregisteredTestFiles: config.unregisteredTestFiles
  });

  return {
    errors: uniqueSorted([
      ...errors,
      ...catalog.errors,
      ...discovery.errors,
      ...evidence.errors
    ]),
    summary: evidence.summary,
    warnings: uniqueSorted(evidence.warnings)
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
