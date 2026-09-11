import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { loadLegacyCatalog } from "./legacy.ts";
import { legacyIndexFile, legacyRoot, legacyTopicsFile } from "./legacy.ts";
import type { MigrationPlan, SourceFile } from "./migrate-types.ts";
import { MigrationError } from "./migrate-types.ts";
import { compare, isRecord, messageOf } from "./migrate-values.ts";

const sourceFilesByPlan = new WeakMap<
  MigrationPlan,
  Readonly<Record<string, SourceFile>>
>();

export async function rememberMigrationSources(
  plan: MigrationPlan,
  workspaceRoot: string,
  legacy: Awaited<ReturnType<typeof loadLegacyCatalog>>
): Promise<void> {
  const paths = [
    path.join(workspaceRoot, ...legacyRoot.split("/"), legacyIndexFile),
    path.join(workspaceRoot, ...legacyRoot.split("/"), legacyTopicsFile),
    ...legacy.cases.map((entry) =>
      path.join(workspaceRoot, ...entry.sourcePath.split("/"))
    )
  ].sort(compare);
  const result: Record<string, SourceFile> = Object.create(null);
  for (const filePath of paths) result[filePath] = await captureFile(filePath);
  sourceFilesByPlan.set(plan, result);
}

export async function executeMigrationTransaction(
  workspaceRoot: string,
  plan: MigrationPlan,
  revalidate: () => Promise<void>
): Promise<void> {
  const root = path.join(workspaceRoot, ...legacyRoot.split("/"));
  const backupDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-migration-")
  );
  const created: Array<{ path: string; text: string }> = [];
  const overwritten: SourceFile[] = [];
  const removed: SourceFile[] = [];
  try {
    await revalidate();
    const oldIndexPath = path.join(root, legacyIndexFile);
    const oldIndex = await captureExpectedSource(plan, oldIndexPath);
    overwritten.push(oldIndex);
    await fs.writeFile(
      path.join(backupDirectory, "old-index"),
      oldIndex.bytes,
      {
        mode: oldIndex.mode
      }
    );
    const casesDirectory = path.join(root, "cases");
    await fs.mkdir(casesDirectory, { mode: 0o755 });
    for (const entry of plan.cases) {
      const target = path.join(root, ...entry.sourcePath.split("/"));
      await fs.writeFile(target, entry.text, { mode: 0o644, flag: "wx" });
      created.push({ path: target, text: entry.text });
    }
    const indexText = `${JSON.stringify(plan.index, null, 2)}\n`;
    await fs.writeFile(oldIndexPath, indexText, {
      mode: oldIndex.mode,
      flag: "w"
    });
    created.push({ path: oldIndexPath, text: indexText });
    await removeLegacySources(workspaceRoot, backupDirectory, plan, removed);
  } catch (error) {
    const incomplete = await restoreMigration(
      created,
      overwritten,
      removed,
      path.join(root, "cases")
    );
    throw new MigrationError(
      `migration failed${incomplete ? "; recovery incomplete because concurrent changes were preserved" : "; original bytes restored"}: ${messageOf(error)}`
    );
  } finally {
    await fs.rm(backupDirectory, { recursive: true, force: true });
  }
}

async function removeLegacySources(
  workspaceRoot: string,
  backupDirectory: string,
  plan: MigrationPlan,
  removed: SourceFile[]
): Promise<void> {
  for (const sourcePath of plan.removedPaths.filter(
    (entry) => entry.endsWith(".md") || entry.endsWith(legacyTopicsFile)
  )) {
    const absolute = path.join(workspaceRoot, ...sourcePath.split("/"));
    const captured = await captureExpectedSource(plan, absolute);
    removed.push(captured);
    await fs.writeFile(
      path.join(backupDirectory, `${removed.length}`),
      captured.bytes,
      { mode: captured.mode }
    );
    await fs.unlink(absolute);
  }
  for (const sourcePath of plan.removedPaths.filter(
    (entry) => !entry.endsWith(".md") && !entry.endsWith(legacyTopicsFile)
  )) {
    await fs.rmdir(path.join(workspaceRoot, ...sourcePath.split("/")));
  }
}

async function captureExpectedSource(
  plan: MigrationPlan,
  filePath: string
): Promise<SourceFile> {
  const expected = sourceFilesByPlan.get(plan)?.[filePath];
  if (expected === undefined) {
    throw new MigrationError(
      `source was not present during preflight: ${filePath}`
    );
  }
  const current = await captureFile(filePath);
  if (
    current.dev !== expected.dev ||
    current.ino !== expected.ino ||
    !sameBytes(current.bytes, expected.bytes)
  ) {
    throw new MigrationError(
      `legacy source changed before replacement: ${filePath}`
    );
  }
  return current;
}

async function captureFile(filePath: string): Promise<SourceFile> {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new MigrationError(`${filePath} is not a regular file`);
  }
  return {
    bytes: await fs.readFile(filePath),
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode & 0o777,
    path: filePath
  };
}

async function restoreMigration(
  created: readonly { path: string; text: string }[],
  overwritten: readonly SourceFile[],
  removed: readonly SourceFile[],
  createdCasesDirectory: string
): Promise<boolean> {
  let incomplete = false;
  for (const entry of [...created].reverse()) {
    try {
      const current = await fs.readFile(entry.path, "utf8");
      if (current === entry.text) await fs.unlink(entry.path);
      else incomplete = true;
    } catch {
      /* already absent */
    }
  }
  try {
    await fs.rmdir(createdCasesDirectory);
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== "ENOENT") incomplete = true;
  }
  for (const entry of [...overwritten, ...removed].reverse()) {
    try {
      const stat = await lstat(entry.path);
      if (stat === null) {
        await fs.mkdir(path.dirname(entry.path), { recursive: true });
        await fs.writeFile(entry.path, entry.bytes, {
          mode: entry.mode,
          flag: "wx"
        });
      } else {
        incomplete = true;
      }
    } catch {
      incomplete = true;
    }
  }
  return incomplete;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

function lstat(filePath: string) {
  return fs.lstat(filePath).catch((error: unknown) => {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  });
}
