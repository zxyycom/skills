import fs from "node:fs/promises";
import path from "node:path";
import { collectVerificationCases } from "./catalog.ts";
import { validateVerificationCases } from "./catalog-validation.ts";
import { loadVerificationEvidenceConfig } from "./config.ts";
import {
  createDiagnostic,
  sortUniqueDiagnostics
} from "./diagnostics.ts";
import {
  verificationEvidenceReportSchemaVersion
} from "./schemas.ts";
import { syncVerificationEvidenceIndex } from "./state-index.ts";
import type {
  VerificationEvidenceDiagnostic,
  VerificationEvidenceReport,
  VerificationEvidenceSummary
} from "./types.ts";

export type ValidateVerificationEvidenceOptions = {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

const emptySummary: VerificationEvidenceSummary = {
  catalogCases: 0,
  checkCases: 0,
  testCases: 0
};

export async function validateVerificationEvidence(
  options: ValidateVerificationEvidenceOptions
): Promise<VerificationEvidenceReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadVerificationEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return createVerificationEvidenceReport(loadedConfig.diagnostics);
  }
  const config = loadedConfig.config;

  const diagnostics: VerificationEvidenceDiagnostic[] = [
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
    return createVerificationEvidenceReport(diagnostics);
  }

  const parsedCases = collectVerificationCases(
    catalogText,
    new RegExp(config.caseIdPattern, "u")
  );
  const catalog = validateVerificationCases(parsedCases, config.catalogPath);
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
    const synchronized = await syncVerificationEvidenceIndex({
      config,
      configPath: options.configPath,
      mode: "check",
      workspaceRoot
    });
    diagnostics.push(...synchronized.diagnostics);
  }

  return createVerificationEvidenceReport(
    sortUniqueDiagnostics(diagnostics),
    {
      catalogCases: catalog.cases.length,
      checkCases: catalog.cases.filter(
        (entry) => entry.verification === "check"
      ).length,
      testCases: catalog.cases.filter(
        (entry) => entry.verification === "test"
      ).length
    }
  );
}

export function createVerificationEvidenceReport(
  diagnostics: readonly VerificationEvidenceDiagnostic[],
  summary: VerificationEvidenceSummary = emptySummary
): VerificationEvidenceReport {
  return {
    diagnostics: [...diagnostics],
    schemaVersion: verificationEvidenceReportSchemaVersion,
    summary: { ...summary }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
