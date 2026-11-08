import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const roles = ["decision-records", "investigation-report"] as const;
export type Role = (typeof roles)[number];
type Target = "x86_64-unknown-linux-gnu" | "x86_64-pc-windows-msvc";
type Receipt = {
  schemaVersion: 1;
  target: Target;
  generation: string;
  sourceHash: string;
  binaries: Record<Role, string>;
};
const hashPattern = /^[0-9a-f]{64}$/;

export function hostTarget(): Target {
  if (process.arch === "x64" && process.platform === "win32")
    return "x86_64-pc-windows-msvc";
  const report: unknown = process.report.getReport();
  if (
    process.arch === "x64" &&
    process.platform === "linux" &&
    object(report) &&
    object(report.header) &&
    typeof report.header.glibcVersionRuntime === "string"
  )
    return "x86_64-unknown-linux-gnu";
  throw new Error(
    "unsupported host; run on Linux x64 glibc or Windows x64 MSVC"
  );
}
export function executableName(role: Role, target: Target): string {
  return target === "x86_64-pc-windows-msvc" ? `${role}.exe` : role;
}
export function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseReceipt(value: unknown): Receipt {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    (value.target !== "x86_64-unknown-linux-gnu" &&
      value.target !== "x86_64-pc-windows-msvc") ||
    typeof value.generation !== "string" ||
    !/^generation-[a-zA-Z0-9-]+$/.test(value.generation) ||
    typeof value.sourceHash !== "string" ||
    !hashPattern.test(value.sourceHash) ||
    !object(value.binaries)
  )
    throw new Error("invalid runtime receipt");
  const decision = value.binaries["decision-records"];
  const investigation = value.binaries["investigation-report"];
  if (
    typeof decision !== "string" ||
    !hashPattern.test(decision) ||
    typeof investigation !== "string" ||
    !hashPattern.test(investigation)
  )
    throw new Error("invalid binary hashes in runtime receipt");
  return {
    schemaVersion: 1,
    target: value.target,
    generation: value.generation,
    sourceHash: value.sourceHash,
    binaries: {
      "decision-records": decision,
      "investigation-report": investigation
    }
  };
}
export async function assertRuntimeDirectory(directory: string): Promise<void> {
  // Check actual path components rather than comparing realpath strings: Windows
  // can spell the same directory with different casing or 8.3 names.
  let current = path.resolve(directory);
  while (true) {
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`invalid runtime directory: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function preparedRuntime(
  root: string,
  role?: Role
): Promise<{ receipt: Receipt; paths: Record<Role, string> }> {
  const workspace = path.resolve(root);
  const local = path.join(workspace, ".local");
  const base = path.join(local, "record-cli");
  await assertRuntimeDirectory(workspace);
  await assertRuntimeDirectory(local);
  await assertRuntimeDirectory(base);
  const receiptPath = path.join(base, "receipt.json");
  const receiptStat = await lstat(receiptPath);
  if (!receiptStat.isFile() || receiptStat.isSymbolicLink())
    throw new Error("invalid runtime receipt file");
  const receipt = parseReceipt(
    JSON.parse(await readFile(receiptPath, "utf8")) as unknown
  );
  if (receipt.target !== hostTarget())
    throw new Error("runtime target does not match host");
  const generation = path.join(base, receipt.generation);
  await assertRuntimeDirectory(generation);
  const paths = Object.fromEntries(
    roles.map((name) => [
      name,
      path.join(generation, executableName(name, receipt.target))
    ])
  ) as Record<Role, string>;
  for (const name of role ? [role] : roles) {
    const stat = await lstat(paths[name]);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`invalid executable: ${name}`);
    if (process.platform !== "win32") await access(paths[name], constants.X_OK);
    if (digest(await readFile(paths[name])) !== receipt.binaries[name])
      throw new Error(`binary hash mismatch: ${name}`);
  }
  return { receipt, paths };
}
