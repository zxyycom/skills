import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionIndexFromSnapshot,
  parseDecisionIndex
} from "../src/decision-state-index.ts";
import { listStateSnapshot } from "./queries/snapshot-fixture.ts";
import {
  currentDecisionId,
  archivedDecisionId
} from "./support-record-fixture.ts";

test("Decision index schema rejects invalid projection identity and timestamp fields without filesystem", async () => {
  const built = await buildDecisionIndexFromSnapshot(await listStateSnapshot());
  assert.equal(built.status, "ok");
  if (built.status !== "ok") throw new Error("Expected valid fixture index");
  const original = built.value;
  const state = original.entries[currentDecisionId]!;
  const changed = (fields: Record<string, unknown>) => ({
    ...original,
    entries: {
      ...original.entries,
      [currentDecisionId]: { ...state, ...fields }
    }
  });
  const variants: [unknown, RegExp][] = [
    [{ ...original, unsupported: true }, /unsupported|Invalid key/],
    [{ schemaVersion: 2, records: [] }, /schema version 2 is unsupported/],
    [changed({ createdAt: "2026-07-10" }), /RFC 3339 timestamp/],
    [
      changed({ createdAt: "2026-07-10T09:10:11.123+08:00" }),
      /precise to seconds/
    ],
    [
      {
        ...original,
        sourceRevision: {
          ...original.sourceRevision,
          entries: {
            ...original.sourceRevision.entries,
            [currentDecisionId]: "not-a-sha256"
          }
        }
      },
      /sha256 decision source fingerprint/
    ],
    [changed({ title: "短" }), /actual 1/],
    [changed({ purpose: "长".repeat(101) }), /actual 101/]
  ];
  for (const id of [currentDecisionId, archivedDecisionId]) {
    const state = original.entries[id]!;
    for (const alignment of [null, "missing"] as const) {
      const next =
        alignment === "missing"
          ? Object.fromEntries(
              Object.entries(state).filter(([key]) => key !== "alignment")
            )
          : { ...state, alignment };
      variants.push([
        { ...original, entries: { ...original.entries, [id]: next } },
        /alignment/i
      ]);
    }
  }
  for (const [input, expected] of variants) {
    const parsed = parseDecisionIndex(
      JSON.stringify(input),
      "decision-index.json"
    );
    assert.equal(parsed.status, "error");
    if (parsed.status === "error")
      assert.match(
        parsed.diagnostics.map((d) => d.message).join("\n"),
        expected
      );
  }
});
