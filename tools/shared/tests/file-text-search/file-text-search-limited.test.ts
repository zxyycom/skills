import assert from "node:assert/strict";
import test from "node:test";
import { createTextSearchMatcher } from "../../src/file-text-search/index.ts";

test("limited range materialization matches complete Unicode all results and bounds grapheme work", async () => {
  const { findLimitedLineMatches, findLineMatches, limitMatchRanges } =
    await import("../../src/file-text-search/previews.ts");
  const lines = [
    "Ａlpha alpha",
    "Ｂeta beta",
    ...Array.from({ length: 998 }, () => "alpha beta")
  ];
  const matcher = createTextSearchMatcher({ mode: "all", text: "alpha beta" });
  const expected = limitMatchRanges(
    findLineMatches(lines, matcher, undefined),
    3
  );
  const original = Reflect.get(
    Intl.Segmenter.prototype,
    "segment"
  ) as typeof Intl.Segmenter.prototype.segment;
  let calls = 0;
  Intl.Segmenter.prototype.segment = function (...args) {
    calls++;
    return original.apply(this, args);
  };
  try {
    const actual = findLimitedLineMatches(lines, matcher, 3, undefined);
    assert.deepEqual(
      { matches: actual.matches, truncated: actual.truncated },
      expected
    );
    assert.equal(actual.matched, true);
    assert.equal(calls, 2);
  } finally {
    Intl.Segmenter.prototype.segment = original;
  }
});

test("limited ranges preserve Unicode, overlaps, cross-line all and phrase", async () => {
  const { findLimitedLineMatches, findLineMatches, limitMatchRanges } =
    await import("../../src/file-text-search/previews.ts");
  for (const [input, text, mode, maximum] of [
    [["Ａ ".repeat(1000)], "a", "any", 1],
    [["a".repeat(1000)], "aa", "any", 1],
    [["ﬁ Ａ a", "late"], "a late", "all", 1],
    [["a z a"], "z a", "any", 2],
    [["ﬁ ﬁ"], "fi", "phrase", 1],
    [["a"], "a missing", "all", 1]
  ] as const) {
    const query = createTextSearchMatcher({ mode, text });
    const expected = limitMatchRanges(
      findLineMatches(input, query, undefined),
      maximum
    );
    const actual = findLimitedLineMatches(input, query, maximum, undefined);
    assert.deepEqual(
      { matches: actual.matches, truncated: actual.truncated },
      expected
    );
    assert.equal(
      actual.matched,
      findLineMatches(input, query, undefined).length > 0
    );
  }
  const chain = findLimitedLineMatches(
    ["a".repeat(1000)],
    createTextSearchMatcher({ mode: "any", text: "aa" }),
    1,
    undefined
  );
  assert.deepEqual(chain, {
    matched: true,
    matches: [{ line: 1, ranges: [{ end: 1000, start: 0 }] }],
    truncated: false
  });
  const crossLine = findLimitedLineMatches(
    ["Ａ", "late"],
    createTextSearchMatcher({ mode: "all", text: "a late" }),
    1,
    undefined
  );
  assert.deepEqual(crossLine, {
    matched: true,
    matches: [{ line: 1, ranges: [{ end: 1, start: 0 }] }],
    truncated: true
  });
  const phrase = findLimitedLineMatches(
    ["xx ﬁ Ａ"],
    createTextSearchMatcher({ mode: "phrase", text: "fi a" }),
    1,
    undefined
  );
  assert.deepEqual(phrase, {
    matched: true,
    matches: [{ line: 1, ranges: [{ end: 6, start: 3 }] }],
    truncated: false
  });
});

test("limited ranges stop after the first omitted merged range", async () => {
  const { findLimitedLineMatches } =
    await import("../../src/file-text-search/previews.ts");
  const longLine = "Ａ ".repeat(1000);
  const normalized = "a ".repeat(999) + "a";
  const originalIndexOf: string["indexOf"] = Reflect.get(
    String.prototype,
    "indexOf"
  );
  let occurrenceSearches = 0;
  let limited: ReturnType<typeof findLimitedLineMatches>;
  try {
    String.prototype.indexOf = function (search, position) {
      if (String(this) === normalized && search === "a")
        occurrenceSearches += 1;
      return originalIndexOf.call(this, search, position);
    };
    limited = findLimitedLineMatches(
      [longLine],
      createTextSearchMatcher({ mode: "any", text: "a" }),
      1,
      undefined
    );
  } finally {
    String.prototype.indexOf = originalIndexOf;
  }
  assert.deepEqual(limited, {
    matched: true,
    matches: [{ line: 1, ranges: [{ end: 1, start: 0 }] }],
    truncated: true
  });
  assert.equal(occurrenceSearches, 2);
  assert.equal(
    JSON.stringify(limited.matches[0]?.ranges[0]),
    '{"end":1,"start":0}'
  );
});

test("limited range materialization preserves cancellation and unexpected failures", async () => {
  const { findLimitedLineMatches } =
    await import("../../src/file-text-search/previews.ts");
  const { FileTextSearchError } =
    await import("../../src/file-text-search/index.ts");
  const query = createTextSearchMatcher({ mode: "any", text: "a" });
  const original: Intl.Segmenter["segment"] = Reflect.get(
    Intl.Segmenter.prototype,
    "segment"
  );
  const controller = new AbortController();
  const failure = new Error("segment failure");
  try {
    Intl.Segmenter.prototype.segment = function (...args) {
      controller.abort();
      return original.apply(this, args);
    };
    assert.throws(
      () => findLimitedLineMatches(["a a"], query, 1, controller.signal),
      (error: unknown) =>
        error instanceof FileTextSearchError && error.code === "aborted"
    );
    Intl.Segmenter.prototype.segment = () => {
      throw failure;
    };
    assert.throws(
      () => findLimitedLineMatches(["a a"], query, 1, undefined),
      (error) => error === failure
    );
  } finally {
    Intl.Segmenter.prototype.segment = original;
  }
});
