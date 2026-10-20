#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
// Release manifest asset: https://github.com/zxyycom/skills/releases/latest/download/skill-release-manifest.json
// Release asset: https://github.com/zxyycom/skills/releases/latest/download/test-evidence-review.zip
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { UpdaterConfig } from "./runtime/tools/skill-updater/src/types.ts";
export type { UpdaterConfig } from "./runtime/tools/skill-updater/src/types.ts";

export const skillUpdaterConfig: Readonly<UpdaterConfig> = Object.freeze({
  "releaseAssetName": "test-evidence-review.zip",
  "releaseManifestAssetName": "skill-release-manifest.json",
  "repo": "zxyycom/skills",
  "skillName": "test-evidence-review",
  "sourcePath": "skills/test-evidence-review"
});

export async function runSkillUpdaterCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let runtime: typeof import("./runtime/tools/skill-updater/src/index.ts");
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const installCommand = 'pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated';
  try {
    // Load the complete updater before any package files can be overwritten.
    runtime = await import("./runtime/tools/skill-updater/src/index.ts");
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    throw new Error('Unable to load skill updater runtime: ' + diagnostic + '\nRestore compatible dependencies explicitly:\n  ' + installCommand + '\nIf runtime files or the manifest/lockfile are damaged, re-obtain this skill and retry. No installation was attempted.', { cause: error });
  }
  return await runtime.runSkillUpdaterCli(skillUpdaterConfig, import.meta.url, argv);
}

if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runSkillUpdaterCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
