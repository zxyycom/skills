#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/cli-entry.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/cli-entry.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/cli-entry.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { fileURLToPath } from "node:url";
let runtime: typeof import("./runtime/tools/video-understanding/src/cli-entry.ts");
try {
  runtime = await import("./runtime/tools/video-understanding/src/cli-entry.ts");
} catch (error) {
  const directory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(directory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
export type { Failure, VideoCliDefaults } from "./runtime/tools/video-understanding/src/cli-entry.ts";
export type VideoFailure = import("./runtime/tools/video-understanding/src/cli-entry.ts").VideoFailure;
export const VideoFailure = runtime.VideoFailure;
export const runVideoCli = runtime.createVideoCli(import.meta.url);
if (import.meta.main) {
  await runVideoCli(process.argv.slice(2));
}
