import assert from "node:assert/strict";
import test from "node:test";
import { pendingIndexRecords } from "../src/version-control/git-pending.ts";

test("pending update emits only changed and removed entries regardless of retained scope size", () => {
  for (const size of [10, 1000]) {
    const current = Array.from({ length: size }, (_, index) => ({
      mode: "100644",
      objectId: "a".repeat(40),
      path: `scope/${index}.md`,
      stage: 0 as const
    }));
    const target = current
      .slice(1)
      .map((entry, index) =>
        index === 0 ? { ...entry, objectId: "b".repeat(40) } : entry
      );
    const records = pendingIndexRecords(current, target);
    assert.deepEqual(records?.split("\0").filter(Boolean), [
      `0 ${"0".repeat(40)}\tscope/0.md`,
      `100644 ${"b".repeat(40)}\tscope/1.md`
    ]);
    assert.equal(pendingIndexRecords(current, current), null);
  }
});
