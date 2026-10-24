import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertRecordWriteReadback,
  assertRecordPreflightAndUnchanged,
  assertRecordActualWriteRecovery,
  assertRecordRecoveryWinnerProtection,
  assertRecordCommittedVerificationFailure,
  assertRecordRejectedPublishedWriter,
  assertRecordCandidateCommitAndCleanup,
  assertRecordOldPathWinnerProtection
} from "./transaction-contract.ts";

test(
  "Record shared transaction verifies bytes mode and commit before success",
  assertRecordWriteReadback
);
test(
  "Record shared transaction preflight avoids locks and unchanged verifies fresh facts",
  assertRecordPreflightAndUnchanged
);
test(
  "Record shared transaction restores only actual precommit writes",
  assertRecordActualWriteRecovery
);
test(
  "Record shared transaction protects later bytes inode mode and unwritten members",
  assertRecordRecoveryWinnerProtection
);
test(
  "Record shared transaction retains committed verification and cleanup failures separately",
  assertRecordCommittedVerificationFailure
);
test(
  "Record shared transaction recognizes a rejected writer that published the index",
  assertRecordRejectedPublishedWriter
);
test(
  "Record shared candidate commit preserves creation and distinguishes cleanup only",
  assertRecordCandidateCommitAndCleanup
);
test(
  "Record shared transaction never overwrites a recreated old path",
  assertRecordOldPathWinnerProtection
);

import { assertRecordWriteHandleOwnership } from "./transaction-contract.ts";
test(
  "Record shared recovery never claims a replacement inode between writer close and readback",
  assertRecordWriteHandleOwnership
);

import { assertRecordCreationModeProof } from "./transaction-creation-contract.ts";
test(
  "Record shared native creation binds permission verification and recovery to its actual handle",
  assertRecordCreationModeProof
);

import {
  assertRecordPhaseVerificationReuse,
  assertRecordPhaseExpectedFactProtection,
  assertRecordPostPhaseDriftProtection
} from "./transaction-verification-contract.ts";
test(
  "Record shared verification acquires overlapping unchanged protection once in each independent phase",
  assertRecordPhaseVerificationReuse
);
test(
  "Record shared verification never reuses different namespace or expected snapshot facts",
  assertRecordPhaseExpectedFactProtection
);

test(
  "Record shared postwrite verification rejects later bytes mode and inode despite overlapping fresh protection",
  assertRecordPostPhaseDriftProtection
);

import assert from "node:assert/strict";
import { normalizeRecordTransactionPlan } from "../src/transaction-plan.ts";
import { RecordVerificationPhase } from "../src/transaction-verification.ts";
import {
  fixture as transactionFixture,
  stages
} from "./transaction-fixture.ts";
import { runRecordTransaction } from "../src/transaction.ts";

test("shared plan normalizes only unchanged proposals while retaining order index and conflicting protection", async () => {
  await transactionFixture(async ({ root, a, b, plan }) => {
    const before = plan.writes[0]!.before!;
    const index = plan.index!;
    const normalized = normalizeRecordTransactionPlan({
      ...plan,
      writes: [{ path: a, before, next: before.bytes }, plan.writes[1]!],
      guards: [{ path: a, before: { ...before, ino: before.ino + 1 } }]
    });
    assert.deepEqual(
      normalized.writes.map((change) => change.path),
      [b]
    );
    assert.strictEqual(normalized.index, index);
    assert.equal(normalized.guards!.length, 2);
    const rejected = await runRecordTransaction({
      ...stages,
      prepare: async () => normalized
    });
    assert.equal(rejected.status, "error");
    assert.equal(rejected.changed, false);
    assert.equal(await fs.readFile(b, "utf8"), "old-b");
    assert.throws(
      () =>
        normalizeRecordTransactionPlan({
          value: null,
          root,
          index: null,
          writes: [
            { path: a, before, next: before.bytes },
            { path: path.join(root, ".", "a.md"), before, next: before.bytes }
          ]
        }),
      /duplicate write path/
    );
    const invalid = {
      path: a,
      before,
      next: before.bytes,
      creationMode: 0o666
    };
    assert.throws(
      () =>
        normalizeRecordTransactionPlan({
          value: null,
          root,
          index: null,
          writes: [invalid]
        }),
      /Native creation mode/
    );
  });
});

test("shared fresh text acquisition binds roots isolates mutable proofs and rejects unsafe invalid or missing sources", async (t) => {
  await transactionFixture(async ({ root, a, plan }) => {
    const before = plan.writes[0]!.before!;
    const phase = new RecordVerificationPhase(root);
    const open = fs.open;
    let reads = 0;
    t.mock.method(fs, "open", async (...args: Parameters<typeof open>) => {
      if (String(args[0]) === a) reads += 1;
      return await open(...args);
    });
    await assert.rejects(
      phase.captureTextSnapshots(path.dirname(root), [a], () => {}),
      /root does not match/
    );
    let copied:
      | import("../src/transaction-snapshot.ts").RecordTextSnapshot
      | undefined;
    await phase.captureTextSnapshots(root, [a], (result) => {
      assert.ok(result.ok);
      copied = result.value;
    });
    assert.ok(copied);
    copied.snapshot.bytes[0] = copied.snapshot.bytes[0]! ^ 1;
    Object.assign(copied.snapshot.parents[0]!, { ino: -1 });
    await phase.verify(a, before);
    assert.equal(
      reads,
      1,
      "domain mutation must not poison cached actual bytes or parents"
    );
    await assert.rejects(phase.verify(a, copied.snapshot), /member changed/);
    const invalid = path.join(root, "invalid.md");
    const link = path.join(root, "linked.md");
    await fs.writeFile(invalid, Buffer.from([0xff]));
    await fs.symlink(a, link);
    const failures: Error[] = [];
    await phase.captureTextSnapshots(
      root,
      [invalid, link, path.join(root, "missing.md")],
      (result) => {
        assert.equal(result.ok, false);
        if (!result.ok) failures.push(result.error);
      }
    );
    assert.match(failures[0]!.message, /encoded data/);
    assert.match(failures[1]!.message, /regular non-symbolic-link/);
    assert.equal(
      Object.getOwnPropertyDescriptor(failures[2]!, "code")?.value,
      "ENOENT"
    );
    await assert.rejects(phase.verify(invalid, before), /member changed/);
    const later = new RecordVerificationPhase(root);
    await fs.writeFile(a, "later");
    await assert.rejects(later.verify(a, before), /member changed/);
  });
});
