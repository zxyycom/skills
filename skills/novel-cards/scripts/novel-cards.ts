#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/novel-cards/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/novel-cards/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/novel-cards/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/novel-cards/src/cli.ts");
try {
  runtime = await import("./runtime/tools/novel-cards/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
export type * from "./runtime/tools/novel-cards/src/cli.ts";
export const help = runtime.help;
export const runCli = runtime.runCli;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
