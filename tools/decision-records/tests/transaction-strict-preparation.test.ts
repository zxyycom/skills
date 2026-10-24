import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  readRecordTextSnapshot,
  requireRecordTextSnapshot
} from "../../record-operations/src/transaction-snapshot.ts";
import { runRecordTransaction } from "../../record-operations/src/transaction.ts";
import { loadDecisionTransactionValidationContext } from "../src/scan-snapshot.ts";
import { prepareDecisionTransactionPlan } from "../src/decision-transaction-plan.ts";
import { projectDecisionTransactionIndex } from "../src/decision-transaction-projection.ts";
import { captureDecisionTransactionSources } from "../src/decision-transaction-source.ts";
import {
  currentSourcePath,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

async function strictContext(root: string) {
  const prepared = await loadDecisionTransactionValidationContext(
    { workspaceRoot: root },
    { allowEmptyDecisionSet: true }
  );
  assert.equal(
    prepared.result.errors.length,
    0,
    prepared.result.errors.join("\n")
  );
  assert.ok(prepared.sourceCapture);
  return { context: prepared.result.scan, capture: prepared.sourceCapture };
}

test("Decision strict preparation transfers one root-bound acquisition and reuses unchanged documents", async () => {
  await withFixtureWorkspace("strict-source-transfer", async (root) => {
    const open = fs.open;
    const opens = new Map<string, number>();
    fs.open = async (...args) => {
      const target = String(args[0]);
      opens.set(target, (opens.get(target) ?? 0) + 1);
      return await open(...args);
    };
    try {
      const { context, capture } = await strictContext(root);
      for (const record of context.records)
        assert.equal(opens.get(record.decisionPath), 1);
      assert.equal(
        opens.get(context.indexPath),
        2,
        "existing independent index validation remains enabled"
      );
      opens.clear();
      const reusedDocuments = new Map<string, number>();
      for (const record of context.records) {
        if (record.source.kind !== "established") continue;
        const document = record.source.document;
        Object.defineProperty(record.source, "document", {
          get: () => {
            reusedDocuments.set(
              record.decisionPath,
              (reusedDocuments.get(record.decisionPath) ?? 0) + 1
            );
            return document;
          }
        });
      }
      const plan = await prepareDecisionTransactionPlan(context, [], capture);
      for (const record of context.records.filter(
        (item) => item.source.kind === "established"
      ))
        assert.equal(reusedDocuments.get(record.decisionPath), 1);
      assert.equal(
        opens.size,
        0,
        "same preparation must not reopen protected sources or index"
      );
      assert.deepEqual(
        JSON.parse(Buffer.from(plan.index!.next!).toString()),
        await projectDecisionTransactionIndex(context, [])
      );
      await captureDecisionTransactionSources(context);
      for (const record of context.records)
        assert.equal(
          opens.get(record.decisionPath),
          1,
          "a caller-held scan without the private acquisition must be recaptured"
        );
    } finally {
      fs.open = open;
    }
  });
});

test("Decision strict proof transfer rejects wrong roots missing facts and malformed acquired text", async () => {
  await withFixtureWorkspace("strict-source-binding", async (root) => {
    const { context, capture } = await strictContext(root);
    const target = decisionFilePath(root, currentSourcePath);
    const captured = capture.sources.get(target)!;
    assert.throws(
      () =>
        requireRecordTextSnapshot(
          captured,
          path.dirname(target),
          target,
          captured.text
        ),
      /proof does not match/
    );
    assert.throws(
      () =>
        requireRecordTextSnapshot(captured, root, target, captured.text + "\n"),
      /proof does not match/
    );
    capture.sources.delete(target);
    await assert.rejects(
      captureDecisionTransactionSources(context, capture),
      /no source proof/
    );
    await fs.writeFile(target, Buffer.from([0xff]));
    await assert.rejects(readRecordTextSnapshot(root, target), /encoded data/);
    await fs.unlink(target);
    await assert.rejects(readRecordTextSnapshot(root, target), {
      code: "ENOENT"
    });
  });
});

test("Decision strict transferred proof retains independent fresh guards and final complete graph validation", async () => {
  await withFixtureWorkspace("strict-source-fresh", async (root) => {
    const { context, capture } = await strictContext(root);
    const record = context.records.find(
      (item) => item.sourcePath === currentSourcePath
    )!;
    assert.notEqual(record.source.kind, "missing");
    if (record.source.kind === "missing")
      throw new Error("Fixture source missing");
    const changes = [
      {
        decisionPath: record.decisionPath,
        expectedText: record.source.text,
        nextText: record.source.text.replace("title: ", "title: 更安全的")
      }
    ];
    assert.deepEqual(
      await projectDecisionTransactionIndex(context, changes, true),
      await projectDecisionTransactionIndex(context, changes)
    );
    const target = context.records.find((item) => item.status === "archived")!;
    assert.notEqual(target.source.kind, "missing");
    if (target.source.kind === "missing")
      throw new Error("Fixture target missing");
    await assert.rejects(
      projectDecisionTransactionIndex(
        context,
        [
          {
            decisionPath: target.decisionPath,
            expectedText: target.source.text,
            nextText: null
          }
        ],
        true
      ),
      /target/
    );
    const plan = await prepareDecisionTransactionPlan(
      context,
      changes,
      capture
    );
    const oldText = await fs.readFile(record.decisionPath, "utf8");
    const before = capture.sources.get(record.decisionPath)!.snapshot;
    await fs.chmod(record.decisionPath, before.mode ^ 0o100);
    const result = await runRecordTransaction({
      prepare: async () => plan,
      fresh: async () => {},
      verify: async () => {},
      verifyRecovered: async () => {}
    });
    assert.equal(result.status, "error");
    assert.equal(result.changed, false);
    assert.equal(await fs.readFile(record.decisionPath, "utf8"), oldText);
    assert.equal(
      (await fs.stat(record.decisionPath)).mode & 0o777,
      before.mode ^ 0o100
    );
  });
});

import { RecordVerificationPhase } from "../../record-operations/src/transaction-verification.ts";
import { recordReaderWorkerThreshold } from "../../record-operations/src/reader-batch.ts";
import { prepareDecisionRename } from "../src/decision-rename-planning.ts";
import {
  verifyPlan,
  verifyWritten
} from "../../record-operations/src/transaction.ts";
import fsSync from "node:fs";
import { readRecordFileSnapshotSync } from "../../record-operations/src/reader-sync.ts";
import {
  candidateDecisionBody,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";
import { syncDecisionIndex } from "../src/decision-state-index.ts";

// A real threshold-sized write set exceeds the runner default on ordinary filesystems; no latency budget is asserted.
test(
  "Decision rename batches a real threshold sized changed source set in fresh and postwrite phases",
  { timeout: 30000 },
  async (t) => {
    await withTemporaryWorkspace("rename-many-changed", async (root) => {
      const source = "260901-original";
      await writeDecision(
        root,
        "archive/" + source,
        candidateDecisionBody({ id: source, title: "原始判断" })
          .replace("status: candidate", "status: archived")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", "createdAt: 2026-09-01T00:00:00Z")
      );
      const ids = Array.from(
        { length: recordReaderWorkerThreshold },
        (_, index) => `260901-linked-${index}`
      );
      for (const id of ids)
        await writeDecision(
          root,
          id,
          candidateDecisionBody({
            id,
            title: "引用场景",
            relations: [{ type: "修订", target: source }]
          })
        );
      const sync = await syncDecisionIndex({
        decisionsDirectory: path.join(root, "docs/decisions"),
        mode: "write"
      });
      assert.equal(sync.status, "ok", JSON.stringify(sync));
      const original: unknown = Object.getOwnPropertyDescriptor(
        RecordVerificationPhase.prototype,
        "verifyMany"
      )?.value;
      assert.ok(typeof original === "function");
      const observed = t.mock.method(
        RecordVerificationPhase.prototype,
        "verifyMany"
      );
      const batches: number[] = [];
      observed.mock.mockImplementation(async function (
        this: RecordVerificationPhase,
        ...args: Parameters<typeof observed>
      ) {
        batches.push(args[0].length);
        await Reflect.apply(original, this, args);
      });
      const { context, capture } = await strictContext(root);
      const prepared = prepareDecisionRename(context, {
        source,
        target: "renamed",
        workspaceRoot: root
      });
      assert.equal(prepared.status, "ready", JSON.stringify(prepared));
      if (prepared.status !== "ready")
        assert.fail("Expected a ready real rename plan");
      const plan = await prepareDecisionTransactionPlan(
        context,
        prepared.value.changes,
        capture
      );
      assert.equal(plan.writes.length, recordReaderWorkerThreshold + 2);
      await verifyPlan(plan, new RecordVerificationPhase(plan.root));
      // Commit mechanics are covered by the small shared transaction contracts. Here
      // the fixture establishes real changed bytes without 1,000 journal lifecycles.
      const changes = [
        ...plan.writes,
        ...(plan.index === null ? [] : [plan.index])
      ];
      for (const change of changes) {
        if (change.next === null) fsSync.unlinkSync(change.path);
        else
          fsSync.writeFileSync(change.path, change.next, { mode: change.mode });
      }
      const actual = changes.map((change) => {
        const written = readRecordFileSnapshotSync(plan.root, change.path);
        if (change.next === null) assert.equal(written, null);
        else {
          assert.ok(written);
          assert.deepEqual(
            Buffer.from(written.bytes),
            Buffer.from(change.next)
          );
          assert.equal(written.mode, change.before?.mode ?? change.mode);
          const located = fsSync.statSync(change.path);
          assert.equal(written.dev, located.dev);
          assert.equal(written.ino, located.ino);
        }
        return { change, written };
      });
      await verifyWritten(plan, actual);
      assert.deepEqual(batches, [
        recordReaderWorkerThreshold + 3,
        recordReaderWorkerThreshold + 3
      ]);
      for (const id of ids)
        assert.match(
          await fs.readFile(decisionFilePath(root, id), "utf8"),
          /target: "?260901-renamed/
        );
      await assert.rejects(
        fs.access(decisionFilePath(root, "archive/" + source)),
        { code: "ENOENT" }
      );
    });
  }
);
