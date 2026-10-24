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
