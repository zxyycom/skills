/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/cli-entry.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/cli-entry.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/cli-entry.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { resourcesFromEntry } from "./resources.ts";
import { runVideoCli, type VideoCliDefaults } from "./video.ts";

export { VideoFailure, type Failure } from "./failure.ts";
export type { VideoCliDefaults } from "./video.ts";

/** Bind once to the public entry URL; importing or binding never reads configuration or starts work. */
export function createVideoCli(
  entryUrl: string | URL
): (argv: string[], defaults?: VideoCliDefaults) => Promise<void> {
  const resources = resourcesFromEntry(entryUrl);
  return (argv, defaults) => runVideoCli(argv, resources, defaults);
}
