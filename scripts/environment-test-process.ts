import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export type CommandResult = SpawnSyncReturns<string>;

export function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): CommandResult {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: "pipe",
    windowsHide: true
  });
}

export function requireSuccess(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

export async function writeExecutable(
  filePath: string,
  source: string
): Promise<void> {
  await fs.writeFile(filePath, source, "utf8");
  await fs.chmod(filePath, 0o755);
}
