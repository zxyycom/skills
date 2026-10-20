#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-validator/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-validator/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-validator/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/skill-maintainer
 * Rebuild: bun run sync:skill-validator
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/skill-validator/src/cli.ts");
try {
  runtime = await import("./runtime/tools/skill-validator/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
import type * as Public from "./validate-skill.d.mts";
export type * from "./validate-skill.d.mts";
// Bind the same runtime references to the existing public declaration contract.
// Emitted nominal brands/private fields and existing readonly projections do not create new runtime identities.
const publicRuntime = runtime as unknown as typeof Public;
export const runSkillValidatorCli: typeof Public.runSkillValidatorCli = publicRuntime.runSkillValidatorCli;
export const validateSkillDirectory: typeof Public.validateSkillDirectory = publicRuntime.validateSkillDirectory;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runSkillValidatorCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
