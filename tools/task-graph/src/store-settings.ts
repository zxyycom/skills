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
