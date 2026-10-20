/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/node/main-module.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/node/main-module.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/node/main-module.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/change-plan
 * Rebuild: bun run sync:change-plan-cli
 */
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function isMainModule(moduleUrl: string): boolean {
  const entryPoint = process.argv[1];
  return (
    entryPoint !== undefined &&
    pathToFileURL(path.resolve(entryPoint)).href === moduleUrl
  );
}
