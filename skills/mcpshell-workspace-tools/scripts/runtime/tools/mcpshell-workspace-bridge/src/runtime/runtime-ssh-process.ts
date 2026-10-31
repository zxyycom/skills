/*
 * Synced TypeScript runtime; repository maintenance edits tools/mcpshell-workspace-bridge/src/runtime/runtime-ssh-process.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/mcpshell-workspace-bridge/src/runtime/runtime-ssh-process.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/mcpshell-workspace-bridge/src/runtime/runtime-ssh-process.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/mcpshell-workspace-tools
 * Rebuild: bun run sync:mcpshell-workspace-bridge
 */
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
