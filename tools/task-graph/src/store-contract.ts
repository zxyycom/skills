import type { NativeLockBinding } from "./runtime.ts";
import type { TaskIndex } from "./types.ts";

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
