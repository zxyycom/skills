/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/store/store-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/store/store-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/store/store-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import type { NativeLockBinding } from "../runtime.ts";
import type { TaskIndex } from "../types.ts";

export type AtomicWrite = (
  target: string,
  text: string,
  options: { encoding: "utf8"; fsync: true }
) => Promise<void>;

export type TaskGraphStoreOptions = {
  atomicWrite?: AtomicWrite;
  indexPath?: string;
  loadNativeLock?: () => Promise<NativeLockBinding>;
  lockRoot?: string;
  lockPollMilliseconds?: number;
  lockWaitMilliseconds?: number;
  monotonicClock?: () => number;
  root?: string;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type TaskIndexRead = {
  canonical: boolean;
  index: TaskIndex;
  text: string;
};
export type LockHandle = {
  binding: NativeLockBinding;
  file: import("node:fs/promises").FileHandle;
};
