import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  captureRecordWrite,
  restoreRecordWrites,
  readRecordFileSnapshot,
  writeRecordFile,
  writeRecordFileAtomically,
  type RecordFileWrite
} from "../../src/transactions/transaction-files.ts";
import { runRecordTransaction } from "../../src/transactions/transaction.ts";
import { stages } from "./transaction-fixture.ts";

/** Raw create requests still require actual handle permissions before claiming a write. */
export async function assertRecordCreationModeProof(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "record-create-proof-"));
  try {
    for (const writer of [writeRecordFile, writeRecordFileAtomically]) {
      const target = path.join(root, writer.name);
      const change: RecordFileWrite = {
        path: target,
        before: null,
        next: Buffer.from("created"),
        creationMode: 0o600
      };
      const identity = await writer(root, change);
      assert.ok(identity);
      const written = await captureRecordWrite(root, change, identity);
      assert.ok(written);
      assert.equal(identity.mode, written.mode);
      await fs.chmod(target, written.mode ^ 0o040);
      await assert.rejects(
        captureRecordWrite(root, change, identity),
        /identity differs/
      );
      const errors = await restoreRecordWrites(root, [
        { change, written, owned: true }
      ]);
      assert.equal(errors.length, 1);
      assert.equal(await fs.readFile(target, "utf8"), "created");
      assert.equal((await fs.stat(target)).mode & 0o7777, written.mode ^ 0o040);
    }
    await verifyCreationRecovery(root);
    await verifyUnprovedCreation(root);
    await verifyMixedPermissionIntent(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function verifyCreationRecovery(root: string): Promise<void> {
  const target = path.join(root, "recover");
  const result = await runRecordTransaction({
    ...stages,
    prepare: async () => ({
      value: null,
      root,
      writes: [
        {
          path: target,
          before: null,
          next: Buffer.from("created"),
          creationMode: 0o600
        }
      ],
      index: {
        path: path.join(root, "index"),
        before: null,
        next: Buffer.from("index"),
        write: async () => {
          throw new Error("before index write");
        }
      }
    })
  });
  assert.equal(result.outcome, "rolled-back");
  assert.equal(result.changed, false);
  await assert.rejects(fs.access(target), { code: "ENOENT" });
}

async function verifyUnprovedCreation(root: string): Promise<void> {
  const target = path.join(root, "opaque");
  const result = await runRecordTransaction({
    ...stages,
    prepare: async () => ({
      value: null,
      root,
      index: null,
      writes: [
        {
          path: target,
          before: null,
          next: Buffer.from("created"),
          creationMode: 0o600,
          write: async (file, bytes) => {
            await fs.writeFile(file, bytes, { flag: "wx", mode: 0o600 });
          }
        }
      ]
    })
  });
  assert.equal(result.status, "error");
  assert.equal(result.outcome, "partial-or-unknown");
  assert.equal(result.changed, true);
  assert.equal(await fs.readFile(target, "utf8"), "created");
}

async function verifyMixedPermissionIntent(root: string): Promise<void> {
  const change: RecordFileWrite = {
    path: path.join(root, "mixed"),
    before: null,
    next: Buffer.from("bytes"),
    mode: 0o600
  };
  Reflect.set(change, "creationMode", 0o666);
  await assert.rejects(writeRecordFile(root, change), /no exact mode/);
  await assert.rejects(fs.access(change.path), { code: "ENOENT" });
  const existing = path.join(root, "existing");
  await fs.writeFile(existing, "untouched");
  await assert.rejects(
    writeRecordFile(root, {
      path: existing,
      before: await readRecordFileSnapshot(root, existing),
      next: null,
      creationMode: 0o600
    }),
    /absent target/
  );
  assert.equal(await fs.readFile(existing, "utf8"), "untouched");
  const before = await readRecordFileSnapshot(root, existing);
  assert.ok(before);
  const unchanged = await runRecordTransaction({
    ...stages,
    prepare: async () => ({
      value: null,
      root,
      index: null,
      writes: [
        { path: existing, before, next: before.bytes, creationMode: 0o600 }
      ]
    })
  });
  assert.equal(unchanged.status, "error");
  assert.equal(unchanged.changed, false);
  assert.equal(await fs.readFile(existing, "utf8"), "untouched");
}
