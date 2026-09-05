import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  createTextSearchMatcher,
  FileTextSearchError,
  matchTextSegments,
  searchFileText,
  TextSearchMatcherError,
  type FileTextSearchMode,
  type FileTextSearchSelection
} from "../src/file-text-search/index.ts";

const temporaryDirectories: string[] = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map(async (directory) => {
      await fs.rm(directory, { force: true, recursive: true });
    })
  );
});

async function withFixture(
  files: Readonly<Record<string, string | Uint8Array>>,
  callback: (root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "file-text-search-"));
  temporaryDirectories.push(root);
  for (const [sourcePath, content] of Object.entries(files)) {
    const target = path.join(root, ...sourcePath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  await callback(root);
}

function request(
  root: string,
  selection: FileTextSearchSelection,
  text: string,
  mode: FileTextSearchMode = "all"
) {
  return {
    preview: {
      contextLines: 1,
      maxFiles: 20,
      maxMatchesPerFile: 20,
      maxPreviewCharacters: 10_000
    },
    query: { mode, text },
    root,
    selection
  } as const;
}

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

test("merges overlapping context windows and marks context lines without match ranges", async () => {
  await withFixture(
    { "context.md": "zero\nneedle one\nneedle two\nthree\n" },
    async (root) => {
      const result = await searchFileText(
        request(root, { kind: "files", sourcePaths: ["context.md"] }, "needle")
      );
      assert.deepEqual(result.hits[0]?.previews, [
        { column: null, line: 1, preview: "zero", ranges: [] },
        {
          column: 1,
          line: 2,
          preview: "needle one",
          ranges: [{ end: 6, start: 0 }]
        },
        {
          column: 1,
          line: 3,
          preview: "needle two",
          ranges: [{ end: 6, start: 0 }]
        },
        { column: null, line: 4, preview: "three", ranges: [] }
      ]);
    }
  );
});

test("reports every output limit instead of presenting an incomplete result as complete", async () => {
  await withFixture(
    {
      "a.md": "needle\nneedle\n",
      "b.md": "needle\n"
    },
    async (root) => {
      const matchLimited = await searchFileText({
        ...request(root, { kind: "patterns", include: ["**/*.md"] }, "needle"),
        preview: {
          contextLines: 0,
          maxFiles: 1,
          maxMatchesPerFile: 1,
          maxPreviewCharacters: 100
        }
      });
      assert.deepEqual(matchLimited.truncation, {
        files: true,
        matches: true,
        previewCharacters: false
      });
      const previewLimited = await searchFileText({
        ...request(root, { kind: "files", sourcePaths: ["a.md"] }, "needle"),
        preview: {
          contextLines: 0,
          maxFiles: 10,
          maxMatchesPerFile: 10,
          maxPreviewCharacters: 6
        }
      });
      assert.deepEqual(previewLimited.hits, [
        {
          previews: [
            {
              column: 1,
              line: 1,
              preview: "needle",
              ranges: [{ end: 6, start: 0 }]
            }
          ],
          sourcePath: "a.md"
        }
      ]);
      assert.equal(previewLimited.truncation.previewCharacters, true);
    }
  );
});

test("rejects unsafe paths, symbolic links, and invalid UTF-8 without exposing root paths", async () => {
  await withFixture(
    {
      "document.md": "needle\n",
      "invalid.md": new Uint8Array([0xff])
    },
    async (root) => {
      await assert.rejects(
        searchFileText(
          request(
            root,
            { kind: "files", sourcePaths: ["../document.md"] },
            "needle"
          )
        ),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "invalid-path"
      );
      await fs.symlink(
        path.join(root, "document.md"),
        path.join(root, "linked.md")
      );
      await assert.rejects(
        searchFileText(
          request(root, { kind: "files", sourcePaths: ["linked.md"] }, "needle")
        ),
        (error: unknown) =>
          error instanceof FileTextSearchError &&
          error.code === "invalid-file" &&
          !error.message.includes(root)
      );
      await assert.rejects(
        searchFileText(
          request(
            root,
            { kind: "files", sourcePaths: ["invalid.md"] },
            "needle"
          )
        ),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "invalid-utf8"
      );
    }
  );
});

test("honors an already aborted search", async () => {
  await withFixture({ "document.md": "needle\n" }, async (root) => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      searchFileText({
        ...request(
          root,
          { kind: "files", sourcePaths: ["document.md"] },
          "needle"
        ),
        signal: controller.signal
      }),
      (error: unknown) =>
        error instanceof FileTextSearchError && error.code === "aborted"
    );
  });
});

test("limits actual ranges rather than matching lines", async () => {
  await withFixture({ "ranges.md": "needle needle\n" }, async (root) => {
    const result = await searchFileText({
      ...request(root, { kind: "files", sourcePaths: ["ranges.md"] }, "needle"),
      preview: {
        contextLines: 0,
        maxFiles: 10,
        maxMatchesPerFile: 1,
        maxPreviewCharacters: 100
      }
    });
    assert.deepEqual(result.hits[0]?.previews, [
      {
        column: 1,
        line: 1,
        preview: "needle needle",
        ranges: [{ end: 6, start: 0 }]
      }
    ]);
    assert.equal(result.truncation.matches, true);
  });
});

test("uses whole-line lowercase semantics for contextual Greek sigma", async () => {
  await withFixture({ "sigma.md": "ΟΣ\n" }, async (root) => {
    const result = await searchFileText(
      request(
        root,
        { kind: "files", sourcePaths: ["sigma.md"] },
        "ος",
        "phrase"
      )
    );
    assert.deepEqual(result.hits[0]?.previews, [
      {
        column: 1,
        line: 1,
        preview: "ΟΣ",
        ranges: [{ end: 2, start: 0 }]
      }
    ]);
  });
});

test("preserves a clipped matching preview before spending budget on context", async () => {
  await withFixture(
    { "budget.md": "context that is much longer\nneedle\nsecond context\n" },
    async (root) => {
      const result = await searchFileText({
        ...request(
          root,
          { kind: "files", sourcePaths: ["budget.md"] },
          "needle"
        ),
        preview: {
          contextLines: 1,
          maxFiles: 10,
          maxMatchesPerFile: 10,
          maxPreviewCharacters: 6
        }
      });
      assert.deepEqual(result.hits, [
        {
          previews: [
            {
              column: 1,
              line: 2,
              preview: "needle",
              ranges: [{ end: 6, start: 0 }]
            }
          ],
          sourcePath: "budget.md"
        }
      ]);
      assert.equal(result.truncation.previewCharacters, true);
    }
  );
});

test("fails before unbounded candidate or byte scanning", async () => {
  await withFixture(
    {
      "a.md": "needle\n",
      "b.md": "needle\n",
      "large.md": "123456789"
    },
    async (root) => {
      await assert.rejects(
        searchFileText({
          ...request(
            root,
            { kind: "patterns", include: ["**/*.md"] },
            "needle"
          ),
          limits: { maxCandidateFiles: 2 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError &&
          error.code === "resource-limit"
      );
      await assert.rejects(
        searchFileText({
          ...request(
            root,
            { kind: "files", sourcePaths: ["large.md"] },
            "needle"
          ),
          limits: { maxFileBytes: 8 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError &&
          error.code === "resource-limit"
      );
      await assert.rejects(
        searchFileText({
          ...request(
            root,
            { kind: "files", sourcePaths: ["a.md", "b.md"] },
            "needle"
          ),
          limits: { maxTotalBytes: 8 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError &&
          error.code === "resource-limit"
      );
    }
  );
});
