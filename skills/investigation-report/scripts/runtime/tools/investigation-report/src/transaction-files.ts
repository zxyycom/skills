/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/transaction-files.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/transaction-files.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/transaction-files.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  requireRecordTextSnapshot,
  type RecordTextSnapshot
} from "../../record-operations/src/transaction-snapshot.ts";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  readRecordFileSnapshot,
  sameRecordBytes,
  type RecordWriteIdentity,
  type RecordWritePermissions,
  type RecordFileSnapshot,
  type RecordFileWrite
} from "../../record-operations/src/transaction-files.ts";

/** Domain text expectations are checked against the exact safe file snapshot. */
export async function investigationFileWrite(
  root: string,
  target: string,
  expected: string | null,
  next: string | null,
  publication: Readonly<
    {
      captured?: RecordTextSnapshot;
      writer?: (
        target: string,
        text: string
      ) => Promise<void | RecordWriteIdentity>;
    } & RecordWritePermissions
  > = {}
): Promise<RecordFileWrite> {
  const { writer, mode = 0o644, creationMode } = publication;
  let before: RecordFileSnapshot | null;
  if (publication.captured === undefined)
    before = await readRecordFileSnapshot(root, target);
  else {
    if (expected === null)
      throw new Error("A captured Investigation source cannot be absent");
    before = requireRecordTextSnapshot(
      publication.captured,
      root,
      target,
      expected
    );
  }
  if (
    expected === null
      ? before !== null
      : before === null || !sameRecordBytes(before.bytes, Buffer.from(expected))
  )
    throw new Error(
      "Investigation source/index changed during transaction preparation: " +
        target
    );
  return {
    path: target,
    before,
    next: next === null ? null : Buffer.from(next),
    ...(creationMode === undefined
      ? { mode: before?.mode ?? mode }
      : { creationMode }),
    ...(writer === undefined
      ? {}
      : {
          write: async (target, bytes) =>
            writer(
              target,
              new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
                bytes
              )
            )
        })
  };
}

export type InvestigationMember = Readonly<{
  path: string;
  dev: number;
  ino: number;
  mode: number;
  kind: "file" | "directory";
}>;

/** Membership, not unrelated current report bodies. Index is guarded separately. */
export async function investigationMembers(
  root: string
): Promise<readonly InvestigationMember[]> {
  const members: InvestigationMember[] = [];
  for (const name of (await fs.readdir(root)).sort()) {
    if (name === "investigation-index.json") continue;
    const target = path.join(root, name);
    const stats = await fs.lstat(target);
    if (stats.isSymbolicLink() || (!stats.isFile() && !stats.isDirectory()))
      throw new Error("Unsafe Investigation collection member: " + target);
    members.push({
      path: target,
      dev: stats.dev,
      ino: stats.ino,
      mode: stats.mode & 0o7777,
      kind: stats.isFile() ? "file" : "directory"
    });
  }
  return members;
}

export async function verifyInvestigationMembers(
  root: string,
  expected: readonly InvestigationMember[],
  changedPaths: readonly string[] = []
): Promise<void> {
  const changed = new Set(changedPaths);
  const current = (await investigationMembers(root)).filter(
    (member) => !changed.has(member.path)
  );
  const before = expected.filter((member) => !changed.has(member.path));
  if (JSON.stringify(current) !== JSON.stringify(before))
    throw new Error(
      "Investigation collection members changed during transaction"
    );
}

export async function writeInvestigationTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await ensureRegularFile(targetPath);
  const mode = (await fs.lstat(targetPath)).mode & 0o7777;
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
    await handle.chmod(mode);
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function ensureRegularFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}
