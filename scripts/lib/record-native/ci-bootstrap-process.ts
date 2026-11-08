import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";

export const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function command(
  executable: string,
  args: string[],
  cwd: string,
  input?: Uint8Array
): Buffer {
  const result = spawnSync(executable, args, {
    cwd,
    input,
    shell: process.platform === "win32" && executable === "pnpm",
    env: { ...process.env, NODE_OPTIONS: "" },
    maxBuffer: 128 * 1024 * 1024
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${executable} failed: ${result.stderr?.toString() ?? result.error?.message}`
    );
  return result.stdout;
}
export async function json(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
}
export async function unpack(bytes: Uint8Array, dest: string): Promise<void> {
  for (const [name, data] of extractNativeArchive(bytes)) {
    const file = path.join(dest, ...name.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data, { flag: "wx" });
  }
}
