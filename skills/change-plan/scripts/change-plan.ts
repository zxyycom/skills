#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/change-plan/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/change-plan/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/change-plan/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/change-plan
 * Rebuild: bun run sync:change-plan-cli
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/change-plan/src/cli.ts");
try {
  runtime = await import("./runtime/tools/change-plan/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
export type * from "./runtime/tools/change-plan/src/cli.ts";
export type ChangePlanMetadataError = import("./runtime/tools/change-plan/src/cli.ts").ChangePlanMetadataError;
export const ChangePlanMetadataError = runtime.ChangePlanMetadataError;
export const checkChangePlanCollection = runtime.checkChangePlanCollection;
export const checkChangePlanDirectory = runtime.checkChangePlanDirectory;
export const finalizeChangePlanDirectory = runtime.finalizeChangePlanDirectory;
export const listChangePlans = runtime.listChangePlans;
export const parseChangePlanMetadata = runtime.parseChangePlanMetadata;
export const planChangePlanDirectory = runtime.planChangePlanDirectory;
export const readChangePlanMetadata = runtime.readChangePlanMetadata;
export const runChangePlanCli = runtime.runChangePlanCli;
export const showChangePlanDirectory = runtime.showChangePlanDirectory;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runChangePlanCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
