import assert from "node:assert/strict";
import test from "node:test";
import {
  createTextSearchMatcher,
  matchTextSegments,
  searchFileText,
  TextSearchMatcherError
} from "../src/file-text-search/index.ts";
import { request, withFixture } from "./file-text-search-support.ts";

test("matches independent segments while retaining their identifiers and original ranges", () => {
  const all = matchTextSegments(
    createTextSearchMatcher({ mode: "all", text: "alpha beta" }),
    [
      { identifier: "title", text: "Ａlpha" },
      { identifier: "tag:0", text: "Ｂeta" }
    ]
  );
  assert.deepEqual(all, [
    { identifier: "title", ranges: [{ end: 5, start: 0 }] },
    { identifier: "tag:0", ranges: [{ end: 4, start: 0 }] }
  ]);

  const phrase = matchTextSegments(
    createTextSearchMatcher({ mode: "phrase", text: "alpha beta" }),
    [
      { identifier: "title", text: "Alpha" },
      { identifier: "tag:0", text: "Beta" }
    ]
  );
  assert.deepEqual(phrase, []);

  const normalizedPhrase = matchTextSegments(
    createTextSearchMatcher({ mode: "phrase", text: "alpha beta" }),
    [{ identifier: "summary", text: "前缀 Ａlpha\u00a0Ｂeta 后缀" }]
  );
  assert.deepEqual(normalizedPhrase, [
    { identifier: "summary", ranges: [{ end: 13, start: 3 }] }
  ]);
});

test("rejects aborted segment matching at the pure matcher boundary", () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      matchTextSegments(
        createTextSearchMatcher({ mode: "any", text: "needle" }),
        [{ identifier: "field", text: "needle" }],
        controller.signal
      ),
    (error: unknown) =>
      error instanceof TextSearchMatcherError && error.code === "aborted"
  );
});

test("selects root-relative regular files equivalently from patterns and explicit files", async () => {
  await withFixture(
    {
      "b.md": "needle\n",
      "nested/a.md": "needle\n",
      "nested/ignored.txt": "needle\n"
    },
    async (root) => {
      const patternResult = await searchFileText(
        request(
          root,
          { exclude: ["**/*.txt"], include: ["**/*"], kind: "patterns" },
          "needle"
        )
      );
      const explicitResult = await searchFileText(
        request(
          root,
          { kind: "files", sourcePaths: ["nested/a.md", "b.md", "b.md"] },
          "needle"
        )
      );
      assert.deepEqual(
        patternResult.hits.map((hit) => hit.sourcePath),
        ["b.md", "nested/a.md"]
      );
      assert.deepEqual(
        explicitResult.hits.map((hit) => hit.sourcePath),
        ["b.md", "nested/a.md"]
      );
      assert.deepEqual(patternResult.truncation, {
        files: false,
        matches: false,
        previewCharacters: false
      });
    }
  );
});

test("all and any can match terms on different physical lines, while phrase cannot", async () => {
  await withFixture(
    { "record.md": "Alpha\nbeta\nalpha beta\n" },
    async (root) => {
      const all = await searchFileText(
        request(
          root,
          { kind: "files", sourcePaths: ["record.md"] },
          "alpha beta"
        )
      );
      const any = await searchFileText(
        request(
          root,
          { kind: "files", sourcePaths: ["record.md"] },
          "missing beta",
          "any"
        )
      );
      const phrase = await searchFileText(
        request(
          root,
          { kind: "files", sourcePaths: ["record.md"] },
          "alpha beta",
          "phrase"
        )
      );
      assert.deepEqual(
        all.hits[0]?.previews
          .filter((preview) => preview.ranges.length > 0)
          .map((preview) => preview.line),
        [1, 2, 3]
      );
      assert.deepEqual(
        any.hits[0]?.previews
          .filter((preview) => preview.ranges.length > 0)
          .map((preview) => preview.line),
        [2, 3]
      );
      assert.deepEqual(
        phrase.hits[0]?.previews
          .filter((preview) => preview.ranges.length > 0)
          .map((preview) => preview.line),
        [3]
      );
    }
  );
});

test("normalizes NFKC, case, and Unicode whitespace while retaining original UTF-16 coordinates", async () => {
  await withFixture(
    { "unicode.md": "前缀 Ａlpha\u00a0Ｂeta 后缀\r\n" },
    async (root) => {
      const result = await searchFileText(
        request(
          root,
          { kind: "files", sourcePaths: ["unicode.md"] },
          "alpha beta",
          "phrase"
        )
      );
      const preview = result.hits[0]?.previews.find(
        (candidate) => candidate.ranges.length > 0
      );
      assert.deepEqual(preview, {
        column: 4,
        line: 1,
        preview: "前缀 Ａlpha\u00a0Ｂeta 后缀",
        ranges: [{ end: 13, start: 3 }]
      });
    }
  );
});

test("maps a normalized grapheme match back to its original combining-character range", async () => {
  await withFixture({ "combining.md": "e\u0301clair\n" }, async (root) => {
    const result = await searchFileText(
      request(
        root,
        { kind: "files", sourcePaths: ["combining.md"] },
        "ÉC",
        "phrase"
      )
    );
    assert.deepEqual(result.hits[0]?.previews, [
      {
        column: 1,
        line: 1,
        preview: "e\u0301clair",
        ranges: [{ end: 3, start: 0 }]
      }
    ]);
  });
});
