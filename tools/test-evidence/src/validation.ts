import path from "node:path";
import { loadTestEvidenceCatalog } from "./catalog-source.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import {
  sortUniqueDiagnostics
} from "./diagnostics.ts";
import {
  testEvidenceReportSchemaVersion
} from "./schemas.ts";
import { syncTestEvidenceIndex } from "./state-index.ts";
import { cloneTopicDefinitions } from "./topics.ts";
import type {
  TestEvidenceDiagnostic,
  TestEvidenceReport,
  TestEvidenceSummary,
  TestEvidenceTopicDefinition
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
  const catalog = await loadTestEvidenceCatalog(
    workspaceRoot,
    config,
    loadedConfig.configRelativePath
  );
  diagnostics.push(...catalog.diagnostics);

  if (catalog.diagnostics.length === 0) {
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
    },
    catalog.topicCatalog?.topics ?? []
  );
}

export function createTestEvidenceReport(
  diagnostics: readonly TestEvidenceDiagnostic[],
  summary: TestEvidenceSummary = emptySummary,
  topics: readonly TestEvidenceTopicDefinition[] = []
): TestEvidenceReport {
  return {
    diagnostics: [...diagnostics],
    schemaVersion: testEvidenceReportSchemaVersion,
    summary: { ...summary },
    topics: cloneTopicDefinitions(topics)
  };
}
