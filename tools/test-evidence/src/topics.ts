import path from "node:path";
import { loadTestEvidenceConfig } from "./config.ts";
import {
  defaultTestEvidenceCatalogPath,
  testEvidenceReportSchemaVersion,
  type TestEvidenceDiagnostic,
  type TestEvidenceTopicDefinition,
  type TestEvidenceTopicsResult
} from "./schemas.ts";
import { loadTestEvidenceTopicCatalog } from "./topic-catalog.ts";

export type ListTestEvidenceTopicsOptions = {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

export async function listTestEvidenceTopics(
  options: ListTestEvidenceTopicsOptions
): Promise<TestEvidenceTopicsResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return createTopicsResult({
      diagnostics: loadedConfig.diagnostics
    });
  }

  const loadedTopics = await loadTestEvidenceTopicCatalog(
    workspaceRoot,
    loadedConfig.config.catalogPath
  );
  return createTopicsResult({
    catalogPath: loadedConfig.config.catalogPath,
    diagnostics: [
      ...loadedConfig.diagnostics,
      ...loadedTopics.diagnostics
    ],
    topics: loadedTopics.catalog?.topics
  });
}

export function createTopicsResult(options: {
  catalogPath?: string;
  diagnostics?: readonly TestEvidenceDiagnostic[];
  topics?: readonly TestEvidenceTopicDefinition[];
} = {}): TestEvidenceTopicsResult {
  return {
    catalogPath: options.catalogPath ?? defaultTestEvidenceCatalogPath,
    diagnostics: [...(options.diagnostics ?? [])],
    schemaVersion: testEvidenceReportSchemaVersion,
    topics: cloneTopicDefinitions(options.topics ?? [])
  };
}

export function cloneTopicDefinitions(
  topics: readonly TestEvidenceTopicDefinition[]
): TestEvidenceTopicDefinition[] {
  return topics.map(({ id, description }) => ({ id, description }));
}
