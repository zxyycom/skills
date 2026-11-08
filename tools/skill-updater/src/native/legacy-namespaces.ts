import fs from "node:fs/promises";
import path from "node:path";

async function entries(directory: string): Promise<import("node:fs").Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}

async function scopedEntries(
  root: string,
  relative: string,
  conflicts: string[]
): Promise<import("node:fs").Dirent[]> {
  let current = root;
  const visited: string[] = [];
  for (const part of relative.split("/")) {
    visited.push(part);
    current = path.join(current, part);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        conflicts.push(visited.join("/"));
        return [];
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
  }
  return await entries(current);
}

async function scanNamespace(
  root: string,
  relative: string,
  known: ReadonlySet<string>,
  conflicts: string[]
): Promise<void> {
  const absolute = path.join(root, ...relative.split("/"));
  let info;
  try {
    info = await fs.lstat(absolute);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    conflicts.push(relative);
    return;
  }
  for (const entry of await entries(absolute)) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await scanNamespace(root, name, known, conflicts);
    else if (!known.has(name)) conflicts.push(name);
  }
}

/** Enumerate only retired domain entry, SDK and domain-runtime namespaces. */
export async function findUnknownLegacyDomainFiles(
  root: string,
  role: string,
  known: ReadonlySet<string>
): Promise<string[]> {
  const entryStem =
    role === "decision-records"
      ? "decision-records"
      : role === "investigation-report"
        ? "check-investigations"
        : null;
  if (!entryStem) throw new Error(`unsupported native role: ${role}`);
  const conflicts: string[] = [];
  for (const entry of await scopedEntries(root, "scripts", conflicts)) {
    const lower = entry.name.toLowerCase();
    const relative = `scripts/${entry.name}`;
    if (lower.startsWith(`${entryStem}.`) && !known.has(relative))
      conflicts.push(relative);
    if (lower === `${entryStem}-sdk`)
      await scanNamespace(root, relative, known, conflicts);
  }
  for (const entry of await scopedEntries(
    root,
    "scripts/runtime/tools",
    conflicts
  )) {
    if (entry.name.toLowerCase() === role)
      await scanNamespace(
        root,
        `scripts/runtime/tools/${entry.name}`,
        known,
        conflicts
      );
  }
  return conflicts.sort();
}
