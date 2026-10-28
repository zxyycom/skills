import assert from "node:assert/strict";
import test from "node:test";
import { FileTextSearchError } from "../src/file-text-search/contracts.ts";
import { searchRecordText } from "../src/file-text-search/record-search.ts";
import { contentSearchFacts } from "../src/file-text-search/record-search-info.ts";
import { request, withFixture } from "./file-text-search-support.ts";

function recordRequest(
  root: string,
  maxFiles: number,
  maxPreviewCharacters = 10_000
) {
  const base = request(root, { kind: "patterns", include: ["*.md"] }, "needle");
  return {
    ...base,
    preview: {
      ...base.preview,
      contextLines: 0,
      maxFiles,
      maxMatchesPerFile: 2,
      maxPreviewCharacters
    }
  };
}

test("record search validates only accessed files while rejecting every explicit path syntax", async () => {
  await withFixture({ "a.md": "needle", "b.md": "needle" }, async (root) => {
    const base = recordRequest(root, 1);
    const selected = {
      kind: "files" as const,
      sourcePaths: ["a.md", "b.md", "z-missing.md"]
    };
    const result = await searchRecordText({ ...base, selection: selected });
    assert.equal(contentSearchFacts(result).coverage.scanComplete, false);
    assert.deepEqual(contentSearchFacts(result).counts.matched, {
      value: 2,
      precision: "lower-bound"
    });
    await assert.rejects(
      searchRecordText({
        ...base,
        selection: {
          kind: "files",
          sourcePaths: ["a.md", "b.md", "../invalid"]
        }
      }),
      (error: unknown) =>
        error instanceof FileTextSearchError && error.code === "invalid-path"
    );
    await assert.rejects(
      searchRecordText({
        ...base,
        selection: { kind: "files", sourcePaths: ["a.md", "z-missing.md"] }
      }),
      (error: unknown) =>
        error instanceof FileTextSearchError && error.code === "invalid-file"
    );
  });
});

test("only visited sources enforce safe identity and UTF-8 after a bounded hidden hit", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await withFixture(
    { "a.md": "needle", "b.md": "needle", "z.md": new Uint8Array([0xff]) },
    async (root) => {
      const selection = {
        kind: "files" as const,
        sourcePaths: ["a.md", "b.md", "z.md"]
      };
      const base = { ...recordRequest(root, 1), selection };
      const result = await searchRecordText(base);
      assert.deepEqual(contentSearchFacts(result).counts.matched, {
        value: 2,
        precision: "lower-bound"
      });
      await assert.rejects(
        searchRecordText({
          ...base,
          preview: { ...base.preview, maxFiles: 3 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "invalid-utf8"
      );
      await fs.unlink(path.join(root, "z.md"));
      await fs.symlink("a.md", path.join(root, "z.md"));
      await searchRecordText(base);
      await assert.rejects(
        searchRecordText({
          ...base,
          preview: { ...base.preview, maxFiles: 3 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "invalid-file"
      );
    }
  );
});

test("a selected source replaced before its visit is rejected even after one hit", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  await withFixture({ "a.md": "needle", "b.md": "needle" }, async (root) => {
    const base = {
      ...recordRequest(root, 1),
      selection: { kind: "files" as const, sourcePaths: ["a.md", "b.md"] }
    };
    await assert.rejects(
      searchRecordText(base, ({ sourcePath }) => {
        if (sourcePath === "a.md") {
          fs.unlinkSync(path.join(root, "b.md"));
          fs.symlinkSync("a.md", path.join(root, "b.md"));
        }
      }),
      (error: unknown) =>
        error instanceof FileTextSearchError &&
        error.code === "invalid-file" &&
        error.sourcePath === "b.md"
    );
  });
});

test(
  "unreadable selected source fails on visit but not after scanning stops",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await withFixture(
      { "a.md": "needle", "b.md": "needle", "z.md": "needle" },
      async (root) => {
        const target = path.join(root, "z.md");
        const base = {
          ...recordRequest(root, 1),
          selection: {
            kind: "files" as const,
            sourcePaths: ["a.md", "b.md", "z.md"]
          }
        };
        await fs.chmod(target, 0);
        try {
          await searchRecordText(base);
          await assert.rejects(
            searchRecordText({
              ...base,
              preview: { ...base.preview, maxFiles: 3 }
            }),
            (error: unknown) =>
              error instanceof FileTextSearchError &&
              error.code === "invalid-file" &&
              error.sourcePath === "z.md"
          );
        } finally {
          await fs.chmod(target, 0o600);
        }
      }
    );
  }
);
