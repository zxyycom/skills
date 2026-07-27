import path from "node:path";
import {
  testEvidenceCatalogPath,
  testEvidenceReportSchemaVersion,
  type TestEvidenceDiagnostic,
  type TestEvidenceTopicDefinition,
  type TestEvidenceTopicsResult
} from "./schemas.ts";
import { loadTestEvidenceTopicCatalog } from "./topic-catalog.ts";

export type ListTestEvidenceTopicsOptions = {
  workspaceRoot: string;
};

export async function listTestEvidenceTopics(
  options: ListTestEvidenceTopicsOptions
): Promise<TestEvidenceTopicsResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedTopics = await loadTestEvidenceTopicCatalog(workspaceRoot);
  return createTopicsResult({
    diagnostics: loadedTopics.diagnostics,
    topics: loadedTopics.catalog?.topics
  });
}

export function createTopicsResult(options: {
  diagnostics?: readonly TestEvidenceDiagnostic[];
  topics?: readonly TestEvidenceTopicDefinition[];
} = {}): TestEvidenceTopicsResult {
  return {
    catalogPath: testEvidenceCatalogPath,
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
