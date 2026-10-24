import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionIndexFromSnapshot,
  parseDecisionIndex,
  serializeDecisionIndex
} from "../src/decision-state-index.ts";
import { validateDecisionIndexSnapshot } from "../src/decision-index-snapshot.ts";
import { listStateSnapshot } from "./queries/snapshot-fixture.ts";
import {
  currentDecisionId,
  archivedDecisionId
} from "./support-record-fixture.ts";

async function mutableStateSnapshot() {
  const snapshot = await listStateSnapshot();
  return {
    metadata: { ...snapshot.metadata },
    sourceRevision: {
      ...snapshot.sourceRevision,
      entries: { ...snapshot.sourceRevision.entries }
    },
    states: { ...snapshot.states }
  };
}

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

test("Decision native index build preserves validation failures before relation diagnostics", async () => {
  type Snapshot = Awaited<ReturnType<typeof mutableStateSnapshot>>;
  const invalid: {
    name: string;
    change: (snapshot: Snapshot) => void;
    code: string;
    message: RegExp;
  }[] = [
    {
      name: "revision membership",
      change: (snapshot) => {
        delete snapshot.sourceRevision.entries[archivedDecisionId];
      },
      code: "state-index.source-revision-members-mismatch",
      message: /exactly the same state ids/
    },
    {
      name: "metadata before state",
      change: (snapshot) => {
        Object.assign(snapshot.metadata, { unexpected: true });
        snapshot.states[currentDecisionId]!.createdAt = "invalid";
      },
      code: "state-index.metadata-parse-failed",
      message: /unexpected/
    },
    {
      name: "state projection",
      change: (snapshot) => {
        snapshot.states[currentDecisionId]!.title = "短";
      },
      code: "state-index.state-parse-failed",
      message: /title.*actual 1/
    },
    {
      name: "definition source revision",
      change: (snapshot) => {
        snapshot.sourceRevision.metadata = "invalid";
      },
      code: "state-index.index-validation-failed",
      message: /sha256 decision source fingerprint/
    },
    {
      name: "definition source path uniqueness",
      change: (snapshot) => {
        snapshot.states[archivedDecisionId]!.status = "active";
        snapshot.states[archivedDecisionId]!.sourcePath =
          snapshot.states[currentDecisionId]!.sourcePath;
      },
      code: "state-index.index-validation-failed",
      message: /unique decision sourcePath/
    }
  ];
  for (const variant of invalid) {
    const snapshot = await mutableStateSnapshot();
    snapshot.states[currentDecisionId]!.relations[0]!.target =
      currentDecisionId;
    variant.change(snapshot);
    const result = await buildDecisionIndexFromSnapshot(snapshot);
    assert.equal(result.status, "error", variant.name);
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      [variant.code],
      variant.name
    );
    assert.match(result.diagnostics[0]!.message, variant.message, variant.name);
  }
  const aborted = await buildDecisionIndexFromSnapshot(
    await listStateSnapshot(),
    AbortSignal.abort()
  );
  assert.equal(aborted.status, "error");
  assert.equal(aborted.diagnostics[0]?.code, "state-index.operation-aborted");
});

test("Decision native index build validates the complete relation graph", async () => {
  for (const kind of ["missing", "self"] as const) {
    const snapshot = await mutableStateSnapshot();
    if (kind === "missing") {
      delete snapshot.states[archivedDecisionId];
      delete snapshot.sourceRevision.entries[archivedDecisionId];
    } else {
      snapshot.states[currentDecisionId]!.relations[0]!.target =
        currentDecisionId;
    }
    const result = await buildDecisionIndexFromSnapshot(snapshot);
    assert.equal(result.status, "error", kind);
    assert.deepEqual(
      result.diagnostics.map(({ code, path, stateId }) => ({
        code,
        path,
        stateId
      })),
      [
        {
          code: "decision-index.relation-invalid",
          path: "decision-index.json",
          stateId: null
        }
      ],
      kind
    );
    assert.match(
      result.diagnostics[0]!.message,
      kind === "missing" ? /target is not a scanned decision/ : /itself/,
      kind
    );
  }
});

test("Decision native index build normalizes and isolates its source snapshot", async () => {
  const snapshot = await mutableStateSnapshot();
  snapshot.states[currentDecisionId]!.relations[0]!.summary = "  保留原判断  ";
  const expectedState = {
    ...structuredClone(snapshot.states[currentDecisionId]),
    relations: [
      { type: "修订", target: archivedDecisionId, summary: "保留原判断" }
    ]
  };
  const expectedSourceRevision = structuredClone(snapshot.sourceRevision);
  const built = await buildDecisionIndexFromSnapshot(snapshot);
  assert.equal(built.status, "ok");
  if (built.status !== "ok") throw new Error("Expected valid fixture index");
  assert.deepEqual(built.value.entries[currentDecisionId], expectedState);
  assert.deepEqual(built.value.sourceRevision, expectedSourceRevision);
  const before = serializeDecisionIndex(built.value);
  snapshot.states[currentDecisionId]!.title = "调用方修改标题";
  snapshot.states[currentDecisionId]!.tags.length = 0;
  snapshot.states[currentDecisionId]!.relations[0]!.summary = "调用方修改关系";
  snapshot.sourceRevision.entries[currentDecisionId] = "caller-changed";
  assert.equal(serializeDecisionIndex(built.value), before);
  assert.deepEqual(built.value.entries[currentDecisionId], expectedState);
  assert.equal(Object.isFrozen(snapshot.states[currentDecisionId]), false);
  assert.equal(Object.isFrozen(built.value.entries), true);
  assert.equal(Object.isFrozen(built.value.entries[currentDecisionId]), true);
  assert.equal(
    Object.isFrozen(built.value.entries[currentDecisionId]!.tags),
    true
  );
  assert.equal(
    Object.isFrozen(built.value.entries[currentDecisionId]!.relations[0]),
    true
  );
  assert.equal(Object.isFrozen(built.value.sourceRevision.entries), true);
});

test("Decision raw index validation rejects frozen invalid projections before relation diagnostics", async () => {
  const built = await buildDecisionIndexFromSnapshot(await listStateSnapshot());
  assert.equal(built.status, "ok");
  if (built.status !== "ok") throw new Error("Expected valid fixture index");
  const invalid = structuredClone(built.value);
  invalid.entries[currentDecisionId]!.createdAt = "invalid";
  invalid.entries[currentDecisionId]!.relations[0]!.target = currentDecisionId;
  Object.freeze(invalid.entries[currentDecisionId]);
  Object.freeze(invalid.entries);
  Object.freeze(invalid);
  for (const result of [
    validateDecisionIndexSnapshot(invalid, "raw.json"),
    parseDecisionIndex(JSON.stringify(invalid), "raw.json")
  ]) {
    assert.equal(result.status, "error");
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["state-index.state-parse-failed"]
    );
    assert.equal(result.diagnostics[0]?.stateId, currentDecisionId);
    assert.match(result.diagnostics[0]!.message, /RFC 3339 timestamp/);
  }
});
