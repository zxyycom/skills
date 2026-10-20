#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/investigation-report/src/cli.ts");
try {
  runtime = await import("./runtime/tools/investigation-report/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
import type * as Public from "./check-investigations.d.mts";
export type * from "./check-investigations.d.mts";
// Bind the same runtime references to the existing public declaration contract.
// Emitted nominal brands/private fields and existing readonly projections do not create new runtime identities.
const publicRuntime = runtime as unknown as typeof Public;
export const createInvestigationCandidate: typeof Public.createInvestigationCandidate = publicRuntime.createInvestigationCandidate;
export const createInvestigationCandidateFromCli = runtime.createInvestigationCandidateFromCli;
export const discardInvestigationRecord: typeof Public.discardInvestigationRecord = publicRuntime.discardInvestigationRecord;
export const listInvestigationCandidates: typeof Public.listInvestigationCandidates = publicRuntime.listInvestigationCandidates;
export const publishInvestigationCandidates: typeof Public.publishInvestigationCandidates = publicRuntime.publishInvestigationCandidates;
export const queryInvestigationIndex: typeof Public.queryInvestigationIndex = publicRuntime.queryInvestigationIndex;
export const renameInvestigationRecord: typeof Public.renameInvestigationRecord = publicRuntime.renameInvestigationRecord;
export const runInvestigationReportCheckCli: typeof Public.runInvestigationReportCheckCli = publicRuntime.runInvestigationReportCheckCli;
export const searchInvestigationReports: typeof Public.searchInvestigationReports = publicRuntime.searchInvestigationReports;
export const setInvestigationRelations: typeof Public.setInvestigationRelations = publicRuntime.setInvestigationRelations;
export const showInvestigationCandidate: typeof Public.showInvestigationCandidate = publicRuntime.showInvestigationCandidate;
export const showInvestigationReport: typeof Public.showInvestigationReport = publicRuntime.showInvestigationReport;
export const stageInvestigationReports: typeof Public.stageInvestigationReports = publicRuntime.stageInvestigationReports;
export const synchronizeInvestigationIndex: typeof Public.synchronizeInvestigationIndex = publicRuntime.synchronizeInvestigationIndex;
export const traceInvestigationReports: typeof Public.traceInvestigationReports = publicRuntime.traceInvestigationReports;
export const validateInvestigationReports: typeof Public.validateInvestigationReports = publicRuntime.validateInvestigationReports;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runInvestigationReportCheckCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
