import process from "node:process";
import type { ChildProcess } from "node:child_process";

export function processTerminator(child: ChildProcess, graceMs: number) {
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const signal = (signal: NodeJS.Signals): void => {
    if (child.pid === undefined) return;
    try {
      if (process.platform !== "win32") process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      child.kill(signal);
    }
  };
  return {
    clear: () => {
      if (killTimer !== undefined) clearTimeout(killTimer);
    },
    terminate: () => {
      signal("SIGTERM");
      if (killTimer === undefined)
        killTimer = setTimeout(() => signal("SIGKILL"), graceMs);
    }
  };
}
