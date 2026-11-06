import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oldCli } from "./verify.ts";

export const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
export const base = path.join(repository, "dist", "record-benchmarks");
export const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
export function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "expected object"
  );
  return Object.fromEntries(Object.entries(value));
}
export function integer(
  value: unknown,
  minimum: number,
  maximum: number
): number {
  assert.ok(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= minimum &&
      value <= maximum,
    "invalid integer"
  );
  return value;
}
export async function treeHash(
  root: string,
  excluded?: string
): Promise<string> {
  const hash = createHash("sha256");
  async function visit(current: string, relative: string): Promise<void> {
    for (const entry of (await readdir(current)).sort()) {
      const name = relative ? `${relative}/${entry}` : entry;
      if (name === excluded) continue;
      const item = path.join(current, entry);
      const stat = await lstat(item);
      if (stat.isSymbolicLink())
        throw new Error(`symlink is not allowed in guarded tree: ${item}`);
      if (stat.isDirectory()) await visit(item, name);
      else if (stat.isFile()) {
        const bytes = await readFile(item);
        hash
          .update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`)
          .update(bytes);
      } else throw new Error(`special file in guarded tree: ${item}`);
    }
  }
  await visit(root, "");
  return hash.digest("hex");
}
export async function dependencyEntries(): Promise<
  Record<string, { path: string; sha256: string }>
> {
  const result: Record<string, { path: string; sha256: string }> = {};
  for (const domain of ["decisions", "investigations"] as const) {
    const resolve = createRequire(oldCli[domain]);
    for (const name of [
      "commander",
      "fast-glob",
      "fflate",
      "neverthrow",
      "simple-git",
      "valibot",
      "yaml"
    ]) {
      const file = await realpath(resolve.resolve(name));
      result[`${domain}:${name}`] = {
        path: file,
        sha256: digest(await readFile(file))
      };
    }
  }
  return result;
}
