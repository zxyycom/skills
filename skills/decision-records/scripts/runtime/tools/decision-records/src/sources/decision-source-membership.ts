/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/sources/decision-source-membership.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/sources/decision-source-membership.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/sources/decision-source-membership.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";

export async function decisionTransactionMembers(
  directory: string
): Promise<string[]> {
  const members: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === "decision-index.json") continue;
    if (entry.name !== "archive") {
      members.push(entry.name);
      continue;
    }
    const archive = path.join(directory, entry.name);
    const stats = await fs.lstat(archive);
    if (!stats.isDirectory() || stats.isSymbolicLink())
      throw new Error(
        "Decision archive must be a regular non-symbolic-link directory."
      );
    try {
      for (const name of await fs.readdir(archive))
        members.push("archive/" + name);
    } catch (error) {
      if (!isFileSystemError(error, "ENOENT")) throw error;
      throw new Error(
        "Decision archive disappeared during membership collection.",
        { cause: error }
      );
    }
  }
  return members.sort();
}
