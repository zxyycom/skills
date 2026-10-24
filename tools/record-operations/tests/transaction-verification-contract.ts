import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { RecordVerificationPhase } from "../src/transaction-verification.ts";
import { readRecordFileSnapshot } from "../src/transaction-snapshot.ts";
import { writeRecordFile } from "../src/transaction-files.ts";
import { runRecordTransaction } from "../src/transaction.ts";
import { fixture, stages } from "./transaction-fixture.ts";

export async function assertRecordPhaseVerificationReuse(): Promise<void> {
  await fixture(async ({ root, a, plan }) => {
    const before = plan.writes[0]!.before!;
    const open = fs.open;
    let opens = 0;
    fs.open = async (...args) => {
      if (String(args[0]) === a) opens += 1;
      return await open(...args);
    };
    try {
      const result = await runRecordTransaction({
        ...stages,
        prepare: async () => ({
          value: null,
          root,
          writes: [{ path: a, before, next: before.bytes }],
          guards: [
            { path: a, before },
            {
              path: path.join(root, ".", "a.md"),
              before: { ...before, bytes: Buffer.from(before.bytes) }
            }
          ],
          index: null
        }),
        verify: async () =>
          assert.equal(
            opens,
            2,
            "fresh and postwrite each acquire exactly once"
          )
      });
      assert.equal(result.status, "ok");
      assert.equal(result.changed, false);
      assert.equal(opens, 2);
    } finally {
      fs.open = open;
    }
  });
}

export async function assertRecordPhaseExpectedFactProtection(): Promise<void> {
  await fixture(async ({ root, a, plan }) => {
    const before = plan.writes[0]!.before!;
    for (const different of [
      { ...before, mode: before.mode ^ 0o100 },
      { ...before, ino: before.ino + 1 },
      { ...before, bytes: Buffer.from("other") },
      { ...before, parents: [] }
    ]) {
      const phase = new RecordVerificationPhase(root);
      await phase.verify(a, before);
      await assert.rejects(phase.verify(a, different), /member changed/);
    }
    const outerRoot = path.dirname(root);
    const outer = await readRecordFileSnapshot(outerRoot, a);
    assert.ok(outer);
    const innerPhase = new RecordVerificationPhase(root);
    const outerPhase = new RecordVerificationPhase(outerRoot);
    await innerPhase.verify(a, before);
    await assert.rejects(outerPhase.verify(a, before), /member changed/);
    await outerPhase.verify(a, outer);
    const phase = new RecordVerificationPhase(root);
    const mutable = { ...before, bytes: Buffer.from(before.bytes) };
    await phase.verify(a, mutable);
    mutable.bytes[0] = mutable.bytes[0]! ^ 1;
    await assert.rejects(phase.verify(a, mutable), /member changed/);
  });
}

export async function assertRecordPostPhaseDriftProtection(): Promise<void> {
  for (const mutation of ["bytes", "mode", "inode"] as const) {
    await fixture(async ({ root, a, plan }) => {
      const before = plan.writes[0]!.before!;
      const index = plan.index!;
      let replacementInode: number | undefined;
      const result = await runRecordTransaction({
        ...stages,
        prepare: async () => ({
          value: null,
          root,
          writes: [{ path: a, before, next: before.bytes }],
          guards: [{ path: a, before }],
          index: {
            ...index,
            write: async () => {
              const identity = await writeRecordFile(root, index);
              assert.ok(
                identity,
                "Native index writer returns its handle proof"
              );
              if (mutation === "bytes") await fs.writeFile(a, "later");
              if (mutation === "mode") await fs.chmod(a, before.mode ^ 0o100);
              if (mutation === "inode") {
                const winner = a + ".winner";
                await fs.writeFile(winner, before.bytes, { mode: before.mode });
                await fs.rename(winner, a);
                replacementInode = (await fs.stat(a)).ino;
              }
              return identity;
            }
          }
        })
      });
      assert.equal(result.status, "error");
      assert.equal(result.committed, true);
      assert.equal(result.verification, "failed-or-unknown");
      assert.equal(
        await fs.readFile(a, "utf8"),
        mutation === "bytes" ? "later" : "old-a"
      );
      assert.equal(
        (await fs.stat(a)).mode & 0o7777,
        mutation === "mode" ? before.mode ^ 0o100 : before.mode
      );
      if (replacementInode !== undefined)
        assert.equal((await fs.stat(a)).ino, replacementInode);
    });
  }
}
