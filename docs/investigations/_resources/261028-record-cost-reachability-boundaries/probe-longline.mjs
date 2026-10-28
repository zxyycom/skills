import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  createTextSearchMatcher,
  matchTextSegments,
  matchTextSegmentIdentifiers
} from "./baseline/tools/shared/src/file-text-search/segment-matcher.ts";
import { findLimitedLineMatches } from "./baseline/tools/shared/src/file-text-search/previews.ts";
const base = path.dirname(new URL(import.meta.url).pathname);
const original = await fs.readFile(
  path.join(
    base,
    "baseline/tools/shared/src/file-text-search/segment-matcher.ts"
  ),
  "utf8"
);
assert.equal(original.split("function normalizeSegment(").length, 2);
await fs.writeFile(
  path.join(
    base,
    "instrumented/tools/shared/src/file-text-search/segment-normalization-probe.ts"
  ),
  original + "\nexport { normalizeSegment };\n"
);
const { normalizeSegment } =
  await import("./instrumented/tools/shared/src/file-text-search/segment-normalization-probe.ts");
let occurrences = 0;
function boundedRanges(text, matcher, maximum) {
  const segment = normalizeSegment(text);
  const needles = matcher.mode === "phrase" ? [matcher.phrase] : matcher.terms;
  function next(needle, from) {
    const i = segment.text.indexOf(needle, from);
    if (i < 0) return null;
    occurrences++;
    return {
      index: i,
      start: segment.spans[i].start,
      end: segment.spans[i + needle.length - 1].end
    };
  }
  const heads = needles.map((needle) => next(needle, 0));
  const ranges = [];
  while (true) {
    let selected = -1;
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i];
      if (
        h !== null &&
        (selected < 0 ||
          h.start < heads[selected].start ||
          (h.start === heads[selected].start && h.end < heads[selected].end))
      )
        selected = i;
    }
    if (selected < 0) return { ranges, truncated: false };
    const current = heads[selected];
    const previous = ranges.at(-1);
    if (previous !== undefined && current.start <= previous.end)
      previous.end = Math.max(previous.end, current.end);
    else {
      if (ranges.length === maximum) return { ranges, truncated: true };
      ranges.push({ start: current.start, end: current.end });
    }
    heads[selected] = next(needles[selected], current.index + 1);
  }
}
function limited(lines, query, maximum) {
  const identifiers = matchTextSegmentIdentifiers(
    query,
    lines.map((text, index) => ({ text, identifier: index + 1 }))
  );
  if (identifiers.length === 0)
    return { matched: false, matches: [], truncated: false };
  const matches = [];
  let count = 0;
  for (const line of identifiers) {
    const bounded = boundedRanges(lines[line - 1], query, maximum - count);
    if (bounded.ranges.length) matches.push({ line, ranges: bounded.ranges });
    count += bounded.ranges.length;
    if (bounded.truncated) return { matched: true, matches, truncated: true };
  }
  return { matched: true, matches, truncated: false };
}
const samples = [
  {
    name: "separated-fullwidth",
    lines: ["Ａ ".repeat(10000)],
    text: "a",
    mode: "any"
  },
  {
    name: "overlap-chain",
    lines: ["a".repeat(10000)],
    text: "aa",
    mode: "any"
  },
  {
    name: "multi-term-earlier-second",
    lines: ["a z ".repeat(1000)],
    text: "z a",
    mode: "any"
  },
  {
    name: "grapheme-expansion",
    lines: ["ﬁ ﬃ e\u0301 😀 ".repeat(1000)],
    text: "fi ffi é 😀",
    mode: "any"
  },
  {
    name: "all-cross-line",
    lines: ["Ａ ".repeat(5000), "late"],
    text: "a late",
    mode: "all"
  },
  {
    name: "all-missing",
    lines: ["Ａ ".repeat(5000)],
    text: "a late",
    mode: "all"
  }
];
const results = [];
for (const s of samples) {
  const matcher = createTextSearchMatcher(s);
  occurrences = 0;
  const candidate = limited(s.lines, matcher, 1);
  const expected = findLimitedLineMatches(s.lines, matcher, 1);
  assert.deepEqual(candidate, expected);
  results.push({
    name: s.name,
    normalizedOccurrenceHeads: occurrences,
    result: candidate
  });
}
// Deterministic differential matrix: baseline Unicode mapper retained; tests only bounded range/merge change.
let seed = 0x261028;
function random(n) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % n;
}
const atoms = [
  "a",
  "b",
  "Ａ",
  "ﬁ",
  "ﬃ",
  "e\u0301",
  "é",
  "😀",
  "\u2003",
  " ",
  "\t",
  "İ",
  "Σ",
  "ος"
];
let cases = 0;
for (let n = 0; n < 1500; n++) {
  const lines = Array.from({ length: 1 + random(4) }, () =>
    Array.from(
      { length: 3 + random(35) },
      () => atoms[random(atoms.length)]
    ).join("")
  );
  const text = Array.from(
    { length: 1 + random(4) },
    () => atoms[random(atoms.length)]
  ).join(" ");
  if (!text.trim()) continue;
  for (const mode of ["all", "any", "phrase"]) {
    const matcher = createTextSearchMatcher({ mode, text });
    for (const maximum of [1, 2, 3]) {
      assert.deepEqual(
        limited(lines, matcher, maximum),
        findLimitedLineMatches(lines, matcher, maximum),
        JSON.stringify({ lines, text, mode, maximum })
      );
      cases++;
    }
  }
}
const output = {
  version: "eea1d03e3429f83797e660d75326e0ebd752f61d",
  seed: "0x261028",
  samples: results,
  differentialCases: cases,
  scope:
    "Prototype in /tmp only. Same baseline Unicode mapping; bounded merge compared against full current line matcher. Normalization remains full-input; abort behavior and public metadata consumer not changed or certified."
};
await fs.writeFile(
  path.join(base, "longline-results.json"),
  JSON.stringify(output, null, 2)
);
console.log(JSON.stringify(output, null, 2));
