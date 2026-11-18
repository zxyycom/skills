import fs from "node:fs/promises";
import path from "node:path";
import type { SkillFile } from "../types.ts";
import {
  assertNativeDirectory,
  createNativeDirectories,
  existingNativeAncestor
} from "./directory.ts";
import {
  readTargetFile,
  replaceTargetFile,
  sameFileState,
  type FileState
} from "./transaction-files.ts";

export type OverlayPlan = Readonly<{
  add: readonly string[];
  replace: readonly string[];
}>;

export async function planOverlay(
  root: string,
  files: readonly SkillFile[]
): Promise<OverlayPlan> {
  await existingNativeAncestor(root);
  const plan: { add: string[]; replace: string[] } = { add: [], replace: [] };
  for (const file of files) {
    ((await readTargetFile(root, file.path)) ? plan.replace : plan.add).push(
      file.path
    );
  }
  plan.add.sort();
  plan.replace.sort();
  return plan;
}

/** Use only this invocation's backups; never remove recovery material after a failed rollback. */
export async function applyOverlay(
  root: string,
  files: readonly SkillFile[],
  validate: () => Promise<void>
): Promise<void> {
  root = path.resolve(root);
  await planOverlay(root, files);
  const written: {
    name: string;
    before: FileState | null;
    installed: FileState;
    backup: string | null;
  }[] = [];
  const created = new Set<string>();
  let stage: string | null = null;
  let preserve = false;
  let succeeded = false;
  let failure: unknown;
  let failed = false;
  const rollbackFailures: string[] = [];
  try {
    await createNativeDirectories(path.dirname(root), created);
    stage = await fs.mkdtemp(
      path.join(path.dirname(root), `.${path.basename(root)}.native-`)
    );
    await createNativeDirectories(root, created);
    await assertNativeDirectory(root);
    const ordered = [...files].sort(
      (a, b) => Number(a.path === "SKILL.md") - Number(b.path === "SKILL.md")
    );
    for (const [index, file] of ordered.entries()) {
      if (file.path === "SKILL.md") await validate();
      const before = await readTargetFile(root, file.path);
      const backup = before ? path.join(stage, `backup-${index}`) : null;
      if (backup && before) {
        await fs.writeFile(backup, before.bytes, { mode: before.mode });
        await fs.chmod(backup, before.mode);
      }
      const next = path.join(stage, `new-${index}`);
      const mode = file.path.startsWith("bin/") ? 0o755 : 0o644;
      await fs.writeFile(next, file.data, { mode });
      await fs.chmod(next, mode);
      const installed = {
        bytes: Buffer.from(file.data),
        mode: (await fs.lstat(next)).mode & 0o777
      };
      await replaceTargetFile(root, file.path, next, before, (dir) =>
        created.add(dir)
      );
      written.push({ name: file.path, before, installed, backup });
      if (!sameFileState(await readTargetFile(root, file.path), installed))
        throw new Error(`installed readback failed: ${file.path}`);
    }
    succeeded = true;
  } catch (error) {
    failed = true;
    failure = error;
    for (const [index, entry] of written.reverse().entries()) {
      try {
        if (
          !sameFileState(
            await readTargetFile(root, entry.name),
            entry.installed
          )
        )
          throw new Error("modified after replacement");
        const destination = path.join(root, ...entry.name.split("/"));
        if (entry.backup && stage) {
          const restore = path.join(stage, `restore-${index}`);
          await fs.copyFile(entry.backup, restore);
          if (entry.before) await fs.chmod(restore, entry.before.mode);
          await fs.rename(restore, destination);
        } else await fs.unlink(destination);
        if (
          !sameFileState(await readTargetFile(root, entry.name), entry.before)
        )
          throw new Error("restore mismatch");
      } catch (rollbackError) {
        const reason =
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError);
        rollbackFailures.push(
          `${entry.name} (${reason}; backup: ${entry.backup ?? "none; remove added file manually"})`
        );
      }
    }
    preserve = rollbackFailures.length > 0;
  }
  const cleanupFailures: string[] = [];
  if (!preserve && stage) {
    try {
      await fs.rm(stage, { recursive: true, force: true });
    } catch (error) {
      cleanupFailures.push(
        `${stage}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (!succeeded && !preserve) {
    for (const dir of [...created].reverse()) {
      try {
        await fs.rmdir(dir);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          continue;
        cleanupFailures.push(
          `${dir}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
  if (failed) {
    const primary =
      failure instanceof Error ? failure.message : String(failure);
    const rollback = rollbackFailures.length
      ? `; rollback incomplete: ${rollbackFailures.join(", ")}; retained staging: ${stage}`
      : "; rollback complete";
    const cleanup = cleanupFailures.length
      ? `; temporary cleanup incomplete: ${cleanupFailures.join(", ")}`
      : "";
    throw new Error(`Native update failed: ${primary}${rollback}${cleanup}`, {
      cause: failure
    });
  }
  if (cleanupFailures.length)
    throw new Error(
      `Native skill installed; temporary cleanup incomplete: ${cleanupFailures.join(", ")}`
    );
}
