/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/store-settings.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/store-settings.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/store-settings.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import { performance } from "node:perf_hooks";
import { loadNativeLockBinding, type NativeLockBinding } from "./runtime.ts";
import type { AtomicWrite, TaskGraphStoreOptions } from "./store-contract.ts";
import {
  defaultAtomicWrite,
  defaultSleep,
  lockTiming,
  storePaths
} from "./store-support.ts";

function defaultMonotonicClock(): number {
  return performance.now();
}

function configuredValue<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function storeConfiguration(options: TaskGraphStoreOptions): Readonly<{
  atomicWrite: AtomicWrite;
  indexPath: string;
  loadNativeLock: () => Promise<NativeLockBinding>;
  lockPath: string;
  lockRoot: string;
  monotonicClock: () => number;
  pollMilliseconds: number;
  sleep: (milliseconds: number) => Promise<void>;
  waitMilliseconds: number;
}> {
  const paths = storePaths(options);
  const timing = lockTiming(options);
  return {
    atomicWrite: configuredValue(options.atomicWrite, defaultAtomicWrite),
    indexPath: paths.indexPath,
    loadNativeLock: configuredValue(
      options.loadNativeLock,
      loadNativeLockBinding
    ),
    lockPath: paths.lockPath,
    lockRoot: paths.lockRoot,
    monotonicClock: configuredValue(
      options.monotonicClock,
      defaultMonotonicClock
    ),
    pollMilliseconds: timing.pollMilliseconds,
    sleep: configuredValue(options.sleep, defaultSleep),
    waitMilliseconds: timing.waitMilliseconds
  };
}
