import fs from "node:fs/promises";
import path from "node:path";
import { collectTestEvidenceCases } from "./catalog.ts";
import { validateTestEvidenceCases } from "./catalog-validation.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import {
  createDiagnostic,
  sortUniqueDiagnostics
} from "./diagnostics.ts";
import {
  testEvidenceReportSchemaVersion
} from "./schemas.ts";
import { syncTestEvidenceIndex } from "./state-index.ts";
import type {
  TestEvidenceDiagnostic,
  TestEvidenceReport,
  TestEvidenceSummary
} from "./types.ts";

export type ValidateTestEvidenceOptions = {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

const emptySummary: TestEvidenceSummary = {
  testCases: 0
};

export async function validateTestEvidence(
  options: ValidateTestEvidenceOptions
): Promise<TestEvidenceReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return createTestEvidenceReport(loadedConfig.diagnostics);
  }
  const config = loadedConfig.config;

  const diagnostics: TestEvidenceDiagnostic[] = [
    ...loadedConfig.diagnostics
  ];
  let catalogText: string;
  try {
    catalogText = await fs.readFile(
      path.join(workspaceRoot, ...config.catalogPath.split("/")),
      "utf8"
    );
  } catch (error) {
    diagnostics.push(createDiagnostic({
      category: "catalog",
      code: "catalog.read-failed",
      message: `${config.catalogPath} could not be read: ${errorMessage(error)}`,
      path: config.catalogPath,
      severity: "error"
    }));
    return createTestEvidenceReport(diagnostics);
  }

  const parsedCases = collectTestEvidenceCases(
    catalogText,
    new RegExp(config.caseIdPattern, "u")
  );
  const catalog = validateTestEvidenceCases(parsedCases, config.catalogPath);
  diagnostics.push(...catalog.errors.map((message) => createDiagnostic({
    category: "catalog",
    code: "catalog.invalid",
    message,
    path: config.catalogPath,
    severity: "error"
  })));

  if (
    catalog.errors.length === 0
    && catalog.cases.length === parsedCases.length
  ) {
    const synchronized = await syncTestEvidenceIndex({
      config,
      configPath: options.configPath,
      mode: "check",
      workspaceRoot
    });
    diagnostics.push(...synchronized.diagnostics);
  }

  return createTestEvidenceReport(
    sortUniqueDiagnostics(diagnostics),
    {
      testCases: catalog.cases.length
    }
  );
}

export function createTestEvidenceReport(
  diagnostics: readonly TestEvidenceDiagnostic[],
  summary: TestEvidenceSummary = emptySummary
): TestEvidenceReport {
  return {
    diagnostics: [...diagnostics],
    schemaVersion: testEvidenceReportSchemaVersion,
    summary: { ...summary }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
