import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  FileTextSearchError,
  searchFileText
} from "../src/file-text-search/index.ts";
import { request, withFixture } from "./file-text-search-support.ts";

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
      "a.md": "needle\n",
      "b.md": "needle\nneedle\n"
    },
    async (root) => {
      const matchLimited = await searchFileText({
        ...request(root, { kind: "files", sourcePaths: ["b.md"] }, "needle"),
        preview: {
          contextLines: 0,
          maxFiles: 1,
          maxMatchesPerFile: 1,
          maxPreviewCharacters: 100
        }
      });
      assert.deepEqual(matchLimited.truncation, {
        files: false,
        matches: true,
        previewCharacters: false
      });
      const previewLimited = await searchFileText({
        ...request(root, { kind: "files", sourcePaths: ["b.md"] }, "needle"),
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
          sourcePath: "b.md"
        }
      ]);
      assert.equal(previewLimited.truncation.previewCharacters, true);

      const fileLimitedBeforeMatchProcessing = await searchFileText({
        ...request(
          root,
          { kind: "files", sourcePaths: ["a.md", "b.md"] },
          "needle"
        ),
        preview: {
          contextLines: 0,
          maxFiles: 1,
          maxMatchesPerFile: 1,
          maxPreviewCharacters: 100
        }
      });
      assert.deepEqual(fileLimitedBeforeMatchProcessing.truncation, {
        files: true,
        matches: false,
        previewCharacters: false
      });
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
    {
      "budget.md": "context that is much longer\nneedle\nsecond context\n",
      "later-match.md": "needle",
      "unreadable-after-budget.md": new Uint8Array([0xff])
    },
    async (root) => {
      const result = await searchFileText({
        ...request(
          root,
          {
            kind: "files",
            sourcePaths: [
              "budget.md",
              "later-match.md",
              "unreadable-after-budget.md"
            ]
          },
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
