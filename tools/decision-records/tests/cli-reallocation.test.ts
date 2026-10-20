import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import {
  withTemporaryWorkspace,
  runBundledCli,
  runSuccessfulSourceCli
} from "./support.ts";
import { writeReallocationRing } from "./reallocation-fixture.ts";

test("Decision generated in-process trace preserves sparse event and default atomic budget blockage", async () => {
  await withTemporaryWorkspace("reallocation-bundled", async (root) => {
    const { successorIds } = await writeReallocationRing(root, 26);
    await runSuccessfulSourceCli(["sync-index", "--root", root]);
    const traceOutput = v.object({
      source: v.unknown(),
      traceIds: v.array(v.string()),
      contextIds: v.array(v.string()),
      blockedEvent: v.optional(v.object({ requiredMaxRecords: v.number() })),
      coverage: v.object({ complete: v.boolean() })
    });
    const run = async (budget?: number) => {
      const result = await runBundledCli([
        "--root",
        root,
        "trace",
        successorIds[0]!,
        "--json",
        "--depth",
        "all",
        ...(budget === undefined ? [] : ["--max-records", String(budget)])
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(result.stderr, "");
      return v.parse(traceOutput, JSON.parse(result.stdout) as unknown);
    };
    const complete = await run(52);
    assert.equal(complete.traceIds.length, 52);
    assert.deepEqual(complete.contextIds, []);
    assert.equal(complete.coverage.complete, true);
    assert.deepEqual(complete.source, {
      kind: "published-index",
      currentness: "unchecked",
      fallback: false
    });
    const blocked = await run();
    assert.equal(blocked.traceIds.length, 1);
    assert.equal(blocked.blockedEvent?.requiredMaxRecords, 52);
    assert.equal(blocked.coverage.complete, false);
  });
});
