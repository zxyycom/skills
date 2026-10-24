import {
  requireRecordTextSnapshot,
  type RecordTextSnapshot
} from "../../record-operations/src/transaction-snapshot.ts";
import fs from "node:fs/promises";
import path from "node:path";
import {
  readRecordFileSnapshot,
  sameRecordBytes,
  writeRecordFileAtomically,
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
  const names = (await fs.readdir(root))
    .filter((name) => name !== "investigation-index.json")
    .sort();
  const batchSize = 32;
  for (let offset = 0; offset < names.length; offset += batchSize) {
    const targets = names
      .slice(offset, offset + batchSize)
      .map((name) => path.join(root, name));
    // Drain the bounded batch before reporting its first failure in name order.
    const results = await Promise.allSettled(
      targets.map((target) => fs.lstat(target))
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") throw result.reason;
      const target = targets[index];
      const stats = result.value;
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
  const target = path.resolve(targetPath);
  const root = path.dirname(target);
  const before = await readRecordFileSnapshot(root, target);
  if (before === null)
    throw Object.assign(
      new Error("Investigation source does not exist: " + target),
      {
        code: "ENOENT",
        path: target
      }
    );
  await writeRecordFileAtomically(root, {
    path: target,
    before,
    next: Buffer.from(text),
    mode: before.mode
  });
}
