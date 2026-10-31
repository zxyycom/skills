import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { syncStateIndex } from "../../../index-runtime/src/index.ts";
import {
  createDecisionStateIndexDefinition,
  syncDecisionIndex
} from "../../src/index/decision-state-index.ts";
import {
  candidateDecisionBody,
  withTemporaryWorkspace,
  writeDecision
} from "../support/support.ts";

async function measuredSync<Result>(operation: () => Promise<Result>) {
  const original = Object.entries;
  let visits = 0;
  Object.entries = function (value: object) {
    if (
      Object.isFrozen(value) &&
      Object.hasOwn(value, "purpose") &&
      Object.hasOwn(value, "decision")
    )
      visits += 1;
    return original(value);
  } as typeof Object.entries;
  try {
    return { result: await operation(), visits };
  } finally {
    Object.entries = original;
  }
}

test("Decision sync reuses frozen canonical projection without repeating per-record normalization", async () => {
  for (const count of [1, 30]) {
    await withTemporaryWorkspace("canonical-sync-cost", async (root) => {
      for (let index = 0; index < count; index += 1) {
        const id = `261001-example-${String(index).padStart(3, "0")}`;
        await writeDecision(
          root,
          id,
          candidateDecisionBody({ id })
            .replace("status: candidate", "status: active")
            .replace("alignment: null", "alignment: aligned")
            .replace("createdAt: null", "createdAt: 2026-10-01T00:00:00Z")
        );
      }
      const directory = path.join(root, "docs", "decisions");
      const optimized = await measuredSync(() =>
        syncDecisionIndex({
          decisionsDirectory: directory,
          indexPath: "optimized.json",
          mode: "write"
        })
      );
      const mutableDefinition = { ...createDecisionStateIndexDefinition() };
      const reference = await measuredSync(() =>
        syncStateIndex({
          context: { root: directory },
          definition: mutableDefinition,
          indexPath: "reference.json",
          mode: "write"
        })
      );
      assert.equal(optimized.result.status, "ok");
      assert.equal(reference.result.status, "ok");
      assert.equal(
        await fs.readFile(path.join(directory, "optimized.json"), "utf8"),
        await fs.readFile(path.join(directory, "reference.json"), "utf8")
      );
      assert.ok(
        reference.visits - optimized.visits >= count,
        `N=${count}, reference=${reference.visits}, optimized=${optimized.visits}`
      );
    });
  }
});
