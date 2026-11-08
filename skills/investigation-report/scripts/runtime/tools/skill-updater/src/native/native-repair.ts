/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/native-repair.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/native-repair.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/native-repair.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import type {
  NativeRole,
  NativeTarget
} from "../../../skill-package/src/native-release-manifest.ts";
import { assertNativeDirectory } from "./directory.ts";
import { inspectInstalledNativeEvidence } from "./installed-evidence.ts";
import { receiptPath } from "./legacy-state.ts";
import { findUnknownLegacyDomainFiles } from "./legacy-namespaces.ts";
import { readTargetFile } from "./transaction-files.ts";

type Inspection = Awaited<ReturnType<typeof inspectInstalledNativeEvidence>>;
type Created = {
  name: string;
  device: number;
  inode: number;
  bytes: Buffer;
  mode: number;
  complete: boolean;
};

/** Missing members are repairable only with the complete retained package proof. */
export async function inspectNativeRepair(
  root: string,
  role: NativeRole,
  target: NativeTarget
): Promise<Inspection> {
  await assertNativeDirectory(root);
  const inspection = await inspectInstalledNativeEvidence(
    root,
    role,
    target,
    true
  );
  const known = new Set([
    ...inspection.files.map((file) => file.path),
    receiptPath
  ]);
  const unknown = await findUnknownLegacyDomainFiles(root, role, known);
  if (unknown.length)
    throw new Error(
      `unknown files occupy retired domain paths: ${unknown.join(", ")}`
    );
  return inspection;
}

async function parents(
  root: string,
  name: string,
  created: string[]
): Promise<void> {
  let current = root;
  for (const component of name.split("/").slice(0, -1)) {
    current = path.join(current, component);
    try {
      await fs.mkdir(current);
      created.push(current);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    const info = await fs.lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error(`unsafe target parent: ${name}`);
  }
}

async function undo(
  root: string,
  files: Created[],
  directories: string[]
): Promise<void> {
  const errors: string[] = [];
  for (const file of files.reverse()) {
    try {
      const location = path.join(root, ...file.name.split("/"));
      const info = await fs.lstat(location);
      const current = await readTargetFile(root, file.name);
      if (!isUnchangedCreatedFile(file, info, current))
        throw new Error("created file changed");
      await fs.unlink(location);
    } catch {
      errors.push(file.name);
    }
  }
  for (const directory of directories.reverse()) {
    try {
      await fs.rmdir(directory);
    } catch {
      errors.push(directory);
    }
  }
  if (errors.length)
    throw new Error(`repair rollback incomplete: ${errors.join(", ")}`);
}

function isUnchangedCreatedFile(
  file: Created,
  info: Awaited<ReturnType<typeof fs.lstat>>,
  current: Awaited<ReturnType<typeof readTargetFile>>
): boolean {
  if (!file.complete || !current || !info.ino || info.nlink !== 1) return false;
  return (
    info.ino === file.inode &&
    info.dev === file.device &&
    file.bytes.equals(current.bytes) &&
    current.mode === file.mode
  );
}

/** Add only absent proven members, never overwrite an existing path. */
export async function repairMissingNativeMembers(input: {
  root: string;
  role: NativeRole;
  target: NativeTarget;
  inspection: Inspection;
  afterCreate?: (name: string) => Promise<void>;
  validate?: () => Promise<void>;
}): Promise<void> {
  const { root, role, target, inspection } = input;
  const checked = await inspectNativeRepair(root, role, target);
  if (
    JSON.stringify(checked.missing) !== JSON.stringify(inspection.missing) ||
    checked.files.some(
      (file, i) => !inspection.files[i]?.data.equals(file.data)
    )
  )
    throw new Error("native repair inputs changed before confirmation");
  const files: Created[] = [],
    directories: string[] = [];
  try {
    for (const name of checked.missing) {
      const file = checked.files.find((item) => item.path === name)!;
      const record = checked.records.get(name)!;
      await parents(root, name, directories);
      const handle = await fs.open(
        path.join(root, ...name.split("/")),
        "wx",
        record.mode
      );
      try {
        const info = await handle.stat();
        const created: Created = {
          name,
          device: info.dev,
          inode: info.ino,
          bytes: file.data,
          mode: record.mode,
          complete: false
        };
        files.push(created);
        await handle.writeFile(file.data);
        await handle.chmod(record.mode);
        created.complete = true;
      } finally {
        await handle.close();
      }
      await input.afterCreate?.(name);
    }
    await inspectInstalledNativeEvidence(root, role, target);
    await input.validate?.();
  } catch (error) {
    try {
      await undo(root, files, directories);
    } catch (rollback) {
      throw new Error(
        `native repair failed: ${String(error)}; ${String(rollback)}`
      );
    }
    throw new Error(
      `native repair failed; created members restored: ${String(error)}`
    );
  }
}
