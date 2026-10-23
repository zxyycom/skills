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
