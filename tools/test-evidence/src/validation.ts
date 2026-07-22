import fs from "node:fs/promises";
import path from "node:path";
import { collectCatalogCases } from "./catalog.ts";
import { validateCatalogCases } from "./catalog-validation.ts";
import { loadTestEvidenceLedgerConfig } from "./config.ts";
import {
  createDiagnostic,
  sortUniqueDiagnostics
} from "./diagnostics.ts";
import { validateEvidenceState } from "./evidence-validation.ts";
import { validateGitState } from "./git-validation.ts";
import { buildInspectionViews } from "./inspection.ts";
import { parseTestEntryInventory } from "./inventory.ts";
import {
  testEvidenceReportSchemaVersion,
  type TestEvidenceDiagnostic,
  type TestEvidenceInspection,
  type TestEvidenceReport,
  type TestEvidenceSummary
} from "./types.ts";

export type ValidateTestEvidenceLedgerOptions = {
  config?: unknown;
  configPath?: string;
  inventory: unknown;
  inventorySource?: string;
  workspaceRoot: string;
};

const emptySummary: TestEvidenceSummary = {
  activeAutomatedCases: 0,
  catalogCases: 0,
  derivedMarkers: 0,
  discoveredTestEntries: 0,
  discoveredTestFiles: 0,
  exemptCases: 0,
  exemptMarkers: 0,
  exemptTestEntries: 0,
  mainMarkers: 0,
  plannedAutomatedCases: 0,
  reviewCases: 0,
  reviewTriggers: 0,
  unregisteredTestEntries: 0
};

export async function validateTestEvidenceLedger(
  options: ValidateTestEvidenceLedgerOptions
): Promise<TestEvidenceReport> {
  return (await inspectTestEvidenceLedger(options)).report;
}

export async function inspectTestEvidenceLedger(
  options: ValidateTestEvidenceLedgerOptions
): Promise<TestEvidenceInspection> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const [loadedConfig, parsedInventory] = await Promise.all([
    loadTestEvidenceLedgerConfig(workspaceRoot, options.configPath, options.config),
    Promise.resolve(parseTestEntryInventory(
      options.inventory,
      options.inventorySource ?? "test entry inventory"
    ))
  ]);
  const initialDiagnostics = [
    ...loadedConfig.diagnostics,
    ...parsedInventory.diagnostics,
    ...(parsedInventory.inventory?.diagnostics ?? [])
  ];

  if (loadedConfig.config === null || parsedInventory.inventory === null) {
    const diagnostics = sortUniqueDiagnostics(initialDiagnostics);
    return emptyInspection({
      catalogPath: loadedConfig.config?.catalogPath ?? "docs/testing/cases.md",
      configPath: loadedConfig.configRelativePath,
      configurationValid: loadedConfig.config !== null,
      diagnostics,
      inventoryAvailable: parsedInventory.inventory !== null
    });
  }
  const config = loadedConfig.config;
  const inventory = parsedInventory.inventory;

  const catalogDiagnostics: TestEvidenceDiagnostic[] = [];
  let catalogAvailable = true;
  let catalogText = "";
  try {
    catalogText = await fs.readFile(
      path.join(workspaceRoot, config.catalogPath),
      "utf8"
    );
  } catch (error) {
    catalogAvailable = false;
    catalogDiagnostics.push(createDiagnostic({
      category: "catalog",
      code: "catalog.read-failed",
      message: `${config.catalogPath} could not be read: ${errorMessage(error)}`,
      path: config.catalogPath,
      severity: "error"
    }));
  }

  const parsedCatalogCases = collectCatalogCases(
    catalogText,
    new RegExp(config.caseIdPattern, "u")
  );
  const catalog = validateCatalogCases(parsedCatalogCases, config.catalogPath);
  catalogDiagnostics.push(...catalog.errors.map((message) => createDiagnostic({
    category: "catalog",
    code: "catalog.invalid",
    message,
    path: config.catalogPath,
    severity: "error"
  })));

  const evidence = validateEvidenceState({
    caseIdPattern: new RegExp(config.caseIdPattern, "u"),
    cases: catalog.cases,
    catalogCaseCount: parsedCatalogCases.length,
    catalogPath: config.catalogPath,
    documentedCaseIds: catalog.documentedCaseIds,
    inventory,
    unregisteredTestEntries: config.unregisteredTestEntries
  });
  const git = await validateGitState({
    catalogPath: config.catalogPath,
    configPath: loadedConfig.configRelativePath,
    reviewMaxAgeDays: config.reviewMaxAgeDays,
    reviewTriggerPolicy: config.reviewTriggers,
    scopedCases: catalog.cases,
    workspaceRoot
  });

  const diagnostics = sortUniqueDiagnostics([
    ...initialDiagnostics,
    ...catalogDiagnostics,
    ...evidence.diagnostics,
    ...git.diagnostics
  ]);
  const report = createTestEvidenceReport(
    diagnostics,
    { ...evidence.summary, reviewTriggers: git.reviewTriggers.length },
    git.reviewTriggers
  );
  const views = buildInspectionViews({
    inventory,
    parsedCases: parsedCatalogCases,
    reviewTriggers: git.reviewTriggers,
    validCases: catalog.cases
  });
  return {
    cases: views.cases,
    catalogAvailable,
    catalogPath: config.catalogPath,
    configPath: loadedConfig.configRelativePath,
    configurationValid: true,
    inventoryAvailable: true,
    report,
    schemaVersion: testEvidenceReportSchemaVersion,
    sourceEntries: views.sourceEntries
  };
}

function emptyInspection(options: {
  catalogPath: string;
  configPath: string;
  configurationValid: boolean;
  diagnostics: readonly TestEvidenceDiagnostic[];
  inventoryAvailable: boolean;
}): TestEvidenceInspection {
  return {
    cases: [],
    catalogAvailable: false,
    catalogPath: options.catalogPath,
    configPath: options.configPath,
    configurationValid: options.configurationValid,
    inventoryAvailable: options.inventoryAvailable,
    report: createTestEvidenceReport(options.diagnostics),
    schemaVersion: testEvidenceReportSchemaVersion,
    sourceEntries: []
  };
}

export function createTestEvidenceReport(
  diagnostics: readonly TestEvidenceDiagnostic[],
  summary: TestEvidenceSummary = emptySummary,
  reviewTriggers: TestEvidenceReport["reviewTriggers"] = []
): TestEvidenceReport {
  return {
    diagnostics: [...diagnostics],
    reviewTriggers: [...reviewTriggers],
    schemaVersion: testEvidenceReportSchemaVersion,
    summary: { ...summary }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
