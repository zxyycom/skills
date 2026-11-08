import { assertNativeDirectory } from "./directory.ts";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SkillFile } from "../types.ts";
import type { LegacyManifest } from "./legacy-plan.ts";

function expectedBackups(
  files: readonly SkillFile[],
  legacy: LegacyManifest,
  complete: Buffer
) {
  const ordered = [
    ...files.filter((file) => file.path !== "SKILL.md"),
    { path: ".record-native-receipt.json" },
    { path: "SKILL.md" }
  ];
  const expected = new Map<string, { byteLength: number; sha256: string }>();
  for (const [index, file] of ordered.entries()) {
    const previous = legacy.files[file.path];
    if (previous) expected.set(`backup-${index}`, previous);
  }
  expected.set("complete-receipt", {
    byteLength: complete.length,
    sha256: createHash("sha256").update(complete).digest("hex")
  });
  return expected;
}

/** Never recursively delete a retained recovery directory or unrecognized content. */
export async function inspectLegacyBackups(
  stage: string,
  files: readonly SkillFile[],
  legacy: LegacyManifest,
  complete: Buffer,
  requireAll = false
): Promise<string[]> {
  await assertNativeDirectory(stage);
  const expected = expectedBackups(files, legacy, complete);
  const names = await fs.readdir(stage);
  for (const name of names)
    await verifyBackupFile(stage, name, expected.get(name));
  if (requireAll) assertRequiredBackups(expected, names);
  return names;
}

async function verifyBackupFile(
  stage: string,
  name: string,
  proof: { byteLength: number; sha256: string } | undefined
): Promise<void> {
  if (!proof) throw new Error(`unrecognized recovery file: ${name}`);
  const file = path.join(stage, name);
  const info = await fs.lstat(file);
  if (
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.size !== proof.byteLength
  ) {
    throw new Error(`changed recovery file: ${name}`);
  }
  const data = await fs.readFile(file);
  if (createHash("sha256").update(data).digest("hex") !== proof.sha256)
    throw new Error(`changed recovery file: ${name}`);
}

function assertRequiredBackups(
  expected: ReadonlyMap<string, unknown>,
  names: readonly string[]
): void {
  for (const name of expected.keys())
    if (name !== "complete-receipt" && !names.includes(name))
      throw new Error(`missing recovery file: ${name}`);
}

export async function removeLegacyBackups(
  stage: string,
  files: readonly SkillFile[],
  legacy: LegacyManifest,
  complete: Buffer
): Promise<void> {
  const names = await inspectLegacyBackups(stage, files, legacy, complete);
  for (const name of names) {
    // Reinspect before each unlink; unknown or modified entries remain intact.
    await inspectLegacyBackups(stage, files, legacy, complete);
    await fs.unlink(path.join(stage, name));
  }
  await fs.rmdir(stage);
}
