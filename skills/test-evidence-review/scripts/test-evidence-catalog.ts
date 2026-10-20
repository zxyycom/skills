#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/test-evidence/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/test-evidence/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/test-evidence/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/test-evidence/src/cli.ts");
try {
  runtime = await import("./runtime/tools/test-evidence/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
import type * as Public from "./test-evidence-catalog.d.mts";
export type * from "./test-evidence-catalog.d.mts";
// Bind the same runtime references to the existing public declaration contract.
// Emitted nominal brands/private fields and existing readonly projections do not create new runtime identities.
const publicRuntime = runtime as unknown as typeof Public;
export const expectedSourceSchema = runtime.expectedSourceSchema;
export const fingerprintSchema = runtime.fingerprintSchema;
export const listTestEvidenceTags: typeof Public.listTestEvidenceTags = publicRuntime.listTestEvidenceTags;
export const queryLimitSchema = runtime.queryLimitSchema;
export const queryOffsetSchema = runtime.queryOffsetSchema;
export const queryTestEvidence: typeof Public.queryTestEvidence = publicRuntime.queryTestEvidence;
export const runTestEvidenceCatalogCli: typeof Public.runTestEvidenceCatalogCli = publicRuntime.runTestEvidenceCatalogCli;
export const searchTestEvidence: typeof Public.searchTestEvidence = publicRuntime.searchTestEvidence;
export const showTestEvidenceCase: typeof Public.showTestEvidenceCase = publicRuntime.showTestEvidenceCase;
export const snapshotSchema = runtime.snapshotSchema;
export const stageTestEvidenceIndex: typeof Public.stageTestEvidenceIndex = publicRuntime.stageTestEvidenceIndex;
export const syncTestEvidenceIndex: typeof Public.syncTestEvidenceIndex = publicRuntime.syncTestEvidenceIndex;
export const testEvidenceCaseIdPatternSource = runtime.testEvidenceCaseIdPatternSource;
export const testEvidenceCaseIdSchema = runtime.testEvidenceCaseIdSchema;
export const testEvidenceCaseIndexStateSchema = runtime.testEvidenceCaseIndexStateSchema;
export const testEvidenceCaseSchema = runtime.testEvidenceCaseSchema;
export const testEvidenceCasesPath = runtime.testEvidenceCasesPath;
export const testEvidenceDefinitionVersion = runtime.testEvidenceDefinitionVersion;
export const testEvidenceDiagnosticSchema = runtime.testEvidenceDiagnosticSchema;
export const testEvidenceIndexMetadataSchema = runtime.testEvidenceIndexMetadataSchema;
export const testEvidenceIndexPath = runtime.testEvidenceIndexPath;
export const testEvidenceNamespace = runtime.testEvidenceNamespace;
export const testEvidencePath = runtime.testEvidencePath;
export const testEvidenceQueryResultSchema = runtime.testEvidenceQueryResultSchema;
export const testEvidenceReferenceResultSchema = runtime.testEvidenceReferenceResultSchema;
export const testEvidenceReportSchema = runtime.testEvidenceReportSchema;
export const testEvidenceSchemaVersion = runtime.testEvidenceSchemaVersion;
export const testEvidenceSearchResultSchema = runtime.testEvidenceSearchResultSchema;
export const testEvidenceShowResultSchema = runtime.testEvidenceShowResultSchema;
export const testEvidenceStageResultSchema = runtime.testEvidenceStageResultSchema;
export const testEvidenceStateIndexSchema = runtime.testEvidenceStateIndexSchema;
export const testEvidenceSyncResultSchema = runtime.testEvidenceSyncResultSchema;
export const testEvidenceTagSchema = runtime.testEvidenceTagSchema;
export const testEvidenceTagsResultSchema = runtime.testEvidenceTagsResultSchema;
export const testEvidenceTestIdSchema = runtime.testEvidenceTestIdSchema;
export const validateTestEvidence: typeof Public.validateTestEvidence = publicRuntime.validateTestEvidence;
export const validateTestEvidenceReferences: typeof Public.validateTestEvidenceReferences = publicRuntime.validateTestEvidenceReferences;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runTestEvidenceCatalogCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
