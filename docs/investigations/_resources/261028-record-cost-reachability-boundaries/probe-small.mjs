import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { materializeStateIndexEntry } from "./baseline/tools/index-runtime/src/query-fields.ts";
import { createDecisionStateIndexDefinition } from "./baseline/tools/decision-records/src/decision-index-definition.ts";
import { createInvestigationStateIndexDefinition } from "./baseline/tools/investigation-report/src/investigation-index-definition.ts";
import { isJsonObject } from "./baseline/tools/index-runtime/src/json.ts";
import { selectedStateIndexChanges } from "./baseline/tools/index-runtime/src/selection.ts";
import { syncStateIndex } from "./baseline/tools/index-runtime/src/storage.ts";
const root = path.dirname(new URL(import.meta.url).pathname);
function replaceOnce(source, marker, replacement) {
  assert.equal(
    source.split(marker).length,
    2,
    `expected one source marker: ${marker}`
  );
  return source.replace(marker, replacement);
}
let src = await fs.readFile(
  path.join(root, "baseline/tools/index-runtime/src/query-fields.ts"),
  "utf8"
);
src = replaceOnce(
  src,
  "const values: Record<string, StateIndexKeyScalar[]> = {};",
  "const values: Record<string, StateIndexKeyScalar[]> = {}; const memo = new WeakMap<object, boolean>();"
);
src = replaceOnce(
  src,
  "extractSource(id, state, field, source)",
  "extractSource(id, state, field, source, memo)"
);
src = replaceOnce(
  src,
  "source: StateIndexQuerySource\n): StateIndexResult<StateIndexKeyScalar[]>",
  "source: StateIndexQuerySource, memo: WeakMap<object, boolean>\n): StateIndexResult<StateIndexKeyScalar[]>"
);
src = replaceOnce(
  src,
  "!isJsonObject(value)",
  "!memoIsJsonObject(value, memo)"
);
src +=
  '\nfunction memoIsJsonObject(value: unknown, memo: WeakMap<object, boolean>): boolean { if(value === null || typeof value !== "object") return isJsonObject(value); let result=memo.get(value); if(result === undefined){ result=isJsonObject(value); memo.set(value,result); } return result; }\n';
await fs.writeFile(
  path.join(
    root,
    "instrumented/tools/index-runtime/src/query-fields-candidate.ts"
  ),
  src
);
const { materializeStateIndexEntry: cached } = await import(
  pathToFileURL(
    path.join(
      root,
      "instrumented/tools/index-runtime/src/query-fields-candidate.ts"
    )
  )
);
const freeze = (x) => {
  if (x && typeof x === "object") {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
function counted(fn) {
  let calls = 0;
  const original = Object.values;
  Object.values = function (v) {
    calls++;
    return original(v);
  };
  try {
    return { result: fn(), objectValues: calls };
  } finally {
    Object.values = original;
  }
}
const results = { query: [], selection: [], longLine: [] };
for (const n of [10, 1000]) {
  const state = freeze({
    name: "entry",
    tags: ["tag"],
    status: "active",
    alignment: "aligned",
    formedAt: "2026-10-01T00:00:00Z",
    relations: Array.from({ length: n }, (_, i) => ({
      type: "修订",
      target: `target-${i}`
    }))
  });
  for (const [domain, definition] of [
    ["DR", createDecisionStateIndexDefinition()],
    ["IR", createInvestigationStateIndexDefinition()]
  ]) {
    const original = counted(() =>
      materializeStateIndexEntry(definition, "entry", state)
    );
    const candidate = counted(() => cached(definition, "entry", state));
    assert.deepEqual(candidate.result, original.result);
    results.query.push({
      domain,
      n,
      baselineObjectValues: original.objectValues,
      candidateObjectValues: candidate.objectValues,
      status: original.result.status
    });
  }
}
const cases = [
  { name: "missing", state: {}, path: ["a"] },
  { name: "null-container", state: { a: null }, path: ["a", "b"] },
  { name: "array-container", state: { a: [] }, path: ["a", "b"] },
  {
    name: "nonarray-each",
    state: { a: {} },
    path: ["a", { kind: "each" }, "b"]
  },
  { name: "object-leaf", state: { a: {} }, path: ["a"] },
  {
    name: "bad-instant",
    state: { a: "bad" },
    path: ["a"],
    normalization: "instant"
  },
  {
    name: "nested-each",
    state: { a: [{ b: "v" }, { b: "x" }] },
    path: ["a", { kind: "each" }, "b"]
  }
];
for (const c of cases) {
  const definition = {
    queryFields: ["first", "second"].map((name) => ({
      name,
      mode: c.normalization ? "range" : "exact",
      sources: [
        {
          kind: "state-path",
          path: c.path,
          ...(c.normalization ? { normalization: c.normalization } : {})
        }
      ]
    }))
  };
  assert.deepEqual(
    cached(definition, "entry", freeze(c.state)),
    materializeStateIndexEntry(definition, "entry", c.state)
  );
}
let reads = 0;
const accessor = Object.freeze({
  get v() {
    reads++;
    return reads === 1 ? "ok" : undefined;
  }
});
results.query.push({
  errorEquivalenceCases: cases.length,
  freezeOnlyCounterexample: [isJsonObject(accessor), isJsonObject(accessor)],
  getterReads: reads
});
const index = (entries, revisions) => ({
  schemaVersion: 4,
  namespace: "probe",
  definitionVersion: 1,
  metadata: {},
  sourceRevision: { metadata: "m", entries: revisions },
  entries
});
function countStringify(fn) {
  const orig = JSON.stringify;
  let calls = 0;
  JSON.stringify = function (...args) {
    calls++;
    return Reflect.apply(orig, this, args);
  };
  try {
    return { result: fn(), calls };
  } finally {
    JSON.stringify = orig;
  }
}
function candidateChanges(b, c, selected) {
  if (
    JSON.stringify(b.metadata) !== JSON.stringify(c.metadata) ||
    b.sourceRevision.metadata !== c.sourceRevision.metadata
  )
    return { kind: "collection-changed", changedIds: [] };
  const missing = selected.find(
    (id) => !Object.hasOwn(b.entries, id) && !Object.hasOwn(c.entries, id)
  );
  if (missing !== undefined)
    return { kind: "selected-id-missing", changedIds: [], stateId: missing };
  const ids = new Set([
    ...Object.keys(b.entries),
    ...Object.keys(c.entries),
    ...Object.keys(b.sourceRevision.entries),
    ...Object.keys(c.sourceRevision.entries)
  ]);
  const changedIds = [...ids]
    .filter(
      (id) =>
        b.sourceRevision.entries[id] !== c.sourceRevision.entries[id] ||
        JSON.stringify(b.entries[id]) !== JSON.stringify(c.entries[id])
    )
    .sort();
  const unselectedIds = changedIds.filter((id) => !selected.includes(id));
  return unselectedIds.length
    ? { kind: "unselected-changes", changedIds, unselectedIds }
    : { kind: "accepted", changedIds };
}
for (const changed of [0, 1, 100]) {
  const entries = Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [`s${i}`, { v: i }])
  );
  const before = Object.fromEntries(
    Object.keys(entries).map((id) => [id, "old"])
  );
  const after = { ...before };
  for (let i = 0; i < changed; i++) after[`s${i}`] = "new";
  const b = freeze(index(structuredClone(entries), before)),
    c = freeze(index(structuredClone(entries), after));
  const a = countStringify(() =>
    selectedStateIndexChanges(b, c, Object.keys(entries))
  );
  const z = countStringify(() => candidateChanges(b, c, Object.keys(entries)));
  assert.deepEqual(a.result, z.result);
  results.selection.push({
    n: 100,
    changedRevisions: changed,
    baselineStringify: a.calls,
    candidateStringify: z.calls,
    changedIds: a.result.changedIds.length,
    stateIdentityShared: b.entries.s0 === c.entries.s0
  });
}
const fixture = await fs.mkdtemp(path.join(root, "selected-sync-"));
const snapshot = {
  metadata: {},
  states: { a: { text: "A" }, b: { text: "B" } },
  sourceRevision: { metadata: "m", entries: { a: "a1", b: "b1" } }
};
const definition = {
  namespace: "probe",
  definitionVersion: 1,
  queryFields: [
    {
      name: "text",
      mode: "text",
      sources: [{ kind: "state-path", path: ["text"] }]
    }
  ],
  parseMetadata: (x) => x,
  parseState: (x) => x,
  read: async () => structuredClone(snapshot),
  readRevision: async () => structuredClone(snapshot.sourceRevision)
};
const common = {
  context: { root: fixture },
  definition,
  indexPath: "index.json"
};
const initial = await syncStateIndex({ ...common, mode: "write" });
assert.equal(initial.status, "ok");
const disk = JSON.parse(
  await fs.readFile(path.join(fixture, "index.json"), "utf8")
);
assert.ok(disk !== null && typeof disk === "object" && !Array.isArray(disk));
assert.ok(
  disk.entries !== null &&
    typeof disk.entries === "object" &&
    !Array.isArray(disk.entries)
);
assert.ok(
  disk.entries.b !== null &&
    typeof disk.entries.b === "object" &&
    !Array.isArray(disk.entries.b)
);
assert.equal(typeof disk.entries.b.text, "string");
disk.entries.b.text = "forged-but-valid";
await fs.writeFile(
  path.join(fixture, "index.json"),
  JSON.stringify(disk, null, 2) + "\n"
);
const protectedResult = await syncStateIndex({
  ...common,
  mode: "preview",
  scope: { kind: "selected", selectedIds: ["a"] }
});
assert.equal(protectedResult.state, "unselected-changes");
results.selection.push({
  fixture,
  sameRevisionAlteredUnselectedState: protectedResult
});
// Instrument raw occurrence count only; unmodified public search still runs baseline behavior.
let matcher = await fs.readFile(
  path.join(
    root,
    "baseline/tools/shared/src/file-text-search/segment-matcher.ts"
  ),
  "utf8"
);
matcher = replaceOnce(
  matcher,
  "ranges.push({ end, start });",
  "globalThis.__rawOccurrences += 1; ranges.push({ end, start });"
);
await fs.writeFile(
  path.join(
    root,
    "instrumented/tools/shared/src/file-text-search/segment-matcher.ts"
  ),
  matcher
);
const { createTextSearchMatcher } =
  await import("./instrumented/tools/shared/src/file-text-search/segment-matcher.ts");
const { findLimitedLineMatches } =
  await import("./instrumented/tools/shared/src/file-text-search/previews.ts");
for (const c of [
  { name: "separated-fullwidth", text: "Ａ ".repeat(10000), query: "a" },
  { name: "overlap-chain", text: "a".repeat(10000), query: "aa" },
  {
    name: "multi-term-earlier-second",
    text: "a z ".repeat(1000),
    query: "z a"
  },
  {
    name: "grapheme-expansion",
    text: "ﬁ ﬃ e\u0301 😀 ".repeat(1000),
    query: "fi ffi é 😀"
  }
]) {
  globalThis.__rawOccurrences = 0;
  const match = findLimitedLineMatches(
    [c.text],
    createTextSearchMatcher({ mode: "any", text: c.query }),
    1
  );
  results.longLine.push({
    name: c.name,
    length: c.text.length,
    rawOccurrences: globalThis.__rawOccurrences,
    match
  });
}
const all = findLimitedLineMatches(
  ["Ａ ".repeat(5000), "late"],
  createTextSearchMatcher({ mode: "all", text: "a late" }),
  1
);
assert.equal(all.matched, true);
const absent = findLimitedLineMatches(
  ["Ａ ".repeat(5000)],
  createTextSearchMatcher({ mode: "all", text: "a late" }),
  1
);
assert.equal(absent.matched, false);
results.longLine.push({ crossLineAll: all, absentTermAll: absent });
await fs.writeFile(
  path.join(root, "small-results.json"),
  JSON.stringify(results, null, 2)
);
console.log(JSON.stringify(results, null, 2));
