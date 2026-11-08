#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { runNativeUpdaterCli } from "./runtime/tools/skill-updater/src/native/cli.ts";
import { pathToFileURL } from "node:url";
import path from "node:path";
const config = {"releaseAssetName":"decision-records-native.zip","releaseManifestAssetName":"skill-release-manifest.json","repo":"zxyycom/skills","skillName":"decision-records","sourcePath":"skills/decision-records"};
export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  return await runNativeUpdaterCli(config, "decision-records", import.meta.url, argv, false);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await run(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
