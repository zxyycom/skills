import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runRecordTransaction } from "../src/transaction.ts";
import { fixture, stages } from "./transaction-fixture.ts";
import {
  readRecordFileSnapshot,
  writeRecordFileAtomically,
  type RecordFileWrite
} from "../src/transaction-files.ts";

export async function assertRecordWriteReadback(): Promise<void> {
  await fixture(async ({ root, a, b, index, plan }) => {
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        index: {
          ...plan.index!,
          write: async () => writeRecordFileAtomically(root, plan.index!)
        }
      })
    });
    assert.equal(transaction.status, "ok");
    assert.equal(transaction.committed, true);
    assert.equal(transaction.verification, "passed");
    assert.equal(await fs.readFile(a, "utf8"), "new-a");
    assert.equal(await fs.readFile(b, "utf8"), "new-b");
    assert.equal(await fs.readFile(index, "utf8"), "new-index");
    assert.equal((await fs.stat(a)).mode & 0o7777, 0o640);
    assert.equal((await fs.stat(index)).mode & 0o7777, 0o640);
  });
}

export async function assertRecordPreflightAndUnchanged(): Promise<void> {
  await fixture(async ({ root, a, plan }) => {
    const preflight = await runRecordTransaction({
      ...stages,
      preflight: true,
      prepare: async () => plan,
      withLock: async () => {
        assert.fail("preflight must not request the busy writer lock");
      }
    });
    assert.equal(preflight.status, "ok");
    assert.equal(preflight.changed, false);
    assert.equal(await fs.readFile(a, "utf8"), "old-a");
    const before = await readRecordFileSnapshot(root, a);
    const unchanged = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        writes: [{ path: a, before, next: before!.bytes }],
        index: null
      }),
      fresh: async () => {
        await fs.writeFile(a, "external-a");
      }
    });
    assert.equal(unchanged.status, "error");
    assert.equal(unchanged.changed, false);
    assert.equal(await fs.readFile(a, "utf8"), "external-a");
  });
}

export async function assertRecordActualWriteRecovery(): Promise<void> {
  await fixture(async ({ a, b, index, plan }) => {
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        writes: [
          plan.writes[0]!,
          {
            ...plan.writes[1]!,
            write: async () => {
              throw new Error("second write fails before mutation");
            }
          }
        ]
      })
    });
    assert.equal(transaction.outcome, "rolled-back");
    assert.equal(transaction.changed, false);
    assert.deepEqual(transaction.writtenPaths, [a]);
    assert.equal(await fs.readFile(a, "utf8"), "old-a");
    assert.equal(await fs.readFile(b, "utf8"), "old-b");
    assert.equal(await fs.readFile(index, "utf8"), "old-index");
    assert.equal((await fs.stat(a)).mode & 0o7777, 0o640);
  });
}

export async function assertRecordRecoveryWinnerProtection(): Promise<void> {
  for (const replacement of ["bytes", "inode", "mode", "unwritten"] as const)
    await fixture(async ({ root, a, b, index, plan }) => {
      let winnerInode = 0;
      const transaction = await runRecordTransaction({
        ...stages,
        prepare: async () => ({
          ...plan,
          writes: [plan.writes[0]!],
          guards: [{ path: b, before: await readRecordFileSnapshot(root, b) }],
          index: {
            ...plan.index!,
            write: async () => {
              if (replacement === "bytes") await fs.writeFile(a, "external-a");
              if (replacement === "mode") await fs.chmod(a, 0o600);
              if (replacement === "inode") {
                const winner = path.join(root, "winner.md");
                await fs.writeFile(winner, "new-a", { mode: 0o640 });
                await fs.rename(winner, a);
                winnerInode = (await fs.stat(a)).ino;
              }
              if (replacement === "unwritten")
                await fs.writeFile(b, "external-b");
              throw new Error("index publication rejected before mutation");
            }
          }
        })
      });
      assert.equal(transaction.outcome, "partial-or-unknown");
      assert.equal(await fs.readFile(index, "utf8"), "old-index");
      if (replacement === "bytes")
        assert.equal(await fs.readFile(a, "utf8"), "external-a");
      if (replacement === "mode")
        assert.equal((await fs.stat(a)).mode & 0o7777, 0o600);
      if (replacement === "inode")
        assert.equal((await fs.stat(a)).ino, winnerInode);
      if (replacement === "unwritten")
        assert.equal(await fs.readFile(b, "utf8"), "external-b");
    });
}

export async function assertRecordCommittedVerificationFailure(): Promise<void> {
  await fixture(async ({ a, index, plan }) => {
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => plan,
      verify: async () => {
        throw new Error("post-commit verification failed");
      },
      cleanup: async () => {
        throw new Error("cleanup also failed");
      }
    });
    assert.equal(transaction.status, "error");
    assert.equal(transaction.committed, true);
    assert.equal(transaction.changed, true);
    assert.equal(transaction.verification, "failed-or-unknown");
    assert.equal(transaction.outcome, "partial-or-unknown");
    assert.equal(transaction.errors.length, 1);
    assert.equal(transaction.cleanupErrors.length, 1);
    assert.equal(await fs.readFile(a, "utf8"), "new-a");
    assert.equal(await fs.readFile(index, "utf8"), "new-index");
  });
}

export async function assertRecordRejectedPublishedWriter(): Promise<void> {
  await fixture(async ({ a, index, plan }) => {
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        index: {
          ...plan.index!,
          write: async () => {
            await fs.writeFile(index, "new-index");
            throw new Error("writer rejected after publishing index");
          }
        }
      })
    });
    assert.equal(transaction.committed, true);
    assert.equal(transaction.outcome, "partial-or-unknown");
    assert.equal(await fs.readFile(a, "utf8"), "new-a");
    assert.equal(await fs.readFile(index, "utf8"), "new-index");
  });
}

export async function assertRecordCandidateCommitAndCleanup(): Promise<void> {
  await assertCandidateExitCommit();
  await fixture(async ({ root, plan }) => {
    const candidate = path.join(root, "candidate.md");
    const change: RecordFileWrite = {
      path: candidate,
      before: null,
      next: Buffer.from("draft"),
      mode: 0o600
    };
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({ ...plan, writes: [change], index: null }),
      cleanup: async () => {
        throw new Error("candidate cleanup failed");
      }
    });
    assert.equal(transaction.committed, true);
    assert.equal(transaction.outcome, "committed-cleanup-pending");
    assert.equal(transaction.verification, "passed");
    assert.equal(await fs.readFile(candidate, "utf8"), "draft");
    assert.equal(await fs.readFile(plan.index!.path, "utf8"), "old-index");
  });
}

async function assertCandidateExitCommit(): Promise<void> {
  await fixture(async ({ root, a, plan }) => {
    let resourcesChanged = false;
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        writes: [
          { ...plan.writes[0]!, next: null, write: async () => undefined }
        ],
        index: null
      }),
      resources: {
        changed: () => resourcesChanged,
        apply: async () => {
          resourcesChanged = true;
        },
        recover: async () => {
          assert.fail("committed candidate exit must not recover resources");
        }
      },
      verify: async () => {
        throw new Error("candidate exit postcondition failed");
      }
    });
    assert.equal(transaction.committed, true);
    assert.equal(transaction.outcome, "partial-or-unknown");
    assert.equal(transaction.verification, "failed-or-unknown");
    assert.equal(resourcesChanged, true);
    assert.equal(await readRecordFileSnapshot(root, a), null);
  });
}

export async function assertRecordOldPathWinnerProtection(): Promise<void> {
  await fixture(async ({ root, a, index, plan }) => {
    const moved = path.join(root, "moved.md");
    const original = plan.writes[0]!.before!;
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        writes: [
          {
            path: moved,
            before: null,
            next: original.bytes,
            mode: original.mode
          },
          { path: a, before: original, next: null }
        ],
        index: {
          ...plan.index!,
          write: async () => {
            await fs.writeFile(a, "old-path winner");
            throw new Error("publish failed");
          }
        }
      })
    });
    assert.equal(transaction.outcome, "partial-or-unknown");
    assert.equal(await fs.readFile(a, "utf8"), "old-path winner");
    assert.equal(await fs.readFile(index, "utf8"), "old-index");
    await assert.rejects(fs.stat(moved), { code: "ENOENT" });
  });
}

export async function assertRecordWriteHandleOwnership(): Promise<void> {
  await fixture(async ({ root, a, plan }) => {
    const open = fs.open;
    let winnerInode = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      if (
        String(args[0]) === a &&
        typeof args[1] === "number" &&
        (args[1] & 1) === 1
      ) {
        const close = handle.close.bind(handle);
        handle.close = async () => {
          await close();
          const winner = path.join(root, "new-inode-winner");
          await fs.writeFile(winner, "new-a", { mode: 0o640 });
          await fs.rename(winner, a);
          winnerInode = (await fs.stat(a)).ino;
        };
      }
      return handle;
    }) as typeof fs.open;
    try {
      const transaction = await runRecordTransaction({
        ...stages,
        prepare: async () => plan
      });
      assert.equal(transaction.outcome, "partial-or-unknown");
      assert.equal(transaction.changed, true);
      assert.equal((await fs.stat(a)).ino, winnerInode);
      assert.equal(await fs.readFile(a, "utf8"), "new-a");
      assert.equal(await fs.readFile(plan.index!.path, "utf8"), "old-index");
    } finally {
      fs.open = open;
    }
  });
  await fixture(async ({ a, plan }) => {
    const transaction = await runRecordTransaction({
      ...stages,
      prepare: async () => ({
        ...plan,
        writes: [
          {
            ...plan.writes[0]!,
            write: async (target, bytes) => {
              const replacement = target + ".custom";
              await fs.writeFile(replacement, bytes, { mode: 0o640 });
              await fs.rename(replacement, target);
            }
          }
        ],
        index: {
          ...plan.index!,
          write: async () => {
            throw new Error("index failed after opaque custom source writer");
          }
        }
      })
    });
    assert.equal(transaction.outcome, "partial-or-unknown");
    assert.equal(await fs.readFile(a, "utf8"), "new-a");
  });
}
