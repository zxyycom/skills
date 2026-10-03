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

test("record search counts files and retains identities after preview characters are exhausted", async () => {
  await withFixture(
    { "a.md": "needle needle needle", "b.md": "needle" },
    async (root) => {
      const searched = await searchRecordText(recordRequest(root, 2, 6));
      assert.deepEqual(
        searched.hits.map((hit) => hit.sourcePath),
        ["a.md", "b.md"]
      );
      assert.deepEqual(searched.hits[1]?.previews, []);
      assert.deepEqual(contentSearchFacts(searched).counts, {
        matched: { value: 2, precision: "exact" },
        returned: 2
      });
      assert.deepEqual(contentSearchFacts(searched).coverage, {
        scanComplete: true,
        resultsComplete: true,
        previewsComplete: false,
        reasons: ["match-previews", "preview-characters"]
      });
    }
  );
});

test("record search distinguishes exact budget use from omitted previews and ignores hidden-record previews", async () => {
  await withFixture(
    { "a.md": "needle needle", "b.md": "needle needle needle" },
    async (root) => {
      const searched = await searchRecordText(recordRequest(root, 1, 13));
      assert.deepEqual(searched.truncation, {
        files: true,
        matches: false,
        previewCharacters: false
      });
      assert.deepEqual(contentSearchFacts(searched).coverage, {
        scanComplete: true,
        resultsComplete: false,
        previewsComplete: true,
        reasons: ["max-records"]
      });
      assert.deepEqual(contentSearchFacts(searched).counts, {
        matched: { value: 2, precision: "exact" },
        returned: 1
      });
    }
  );
});

test("record search reports the first hidden hit as a lower bound when unscanned files remain", async () => {
  await withFixture(
    {
      "a.md": "needle",
      "b.md": "not matching",
      "c.md": "needle",
      "d.md": "needle"
    },
    async (root) => {
      const searched = await searchRecordText(recordRequest(root, 1));
      assert.equal(searched.scannedFiles, 3);
      assert.equal(searched.selectedFiles, 4);
      assert.deepEqual(contentSearchFacts(searched).counts, {
        matched: { value: 2, precision: "lower-bound" },
        returned: 1
      });
      assert.deepEqual(contentSearchFacts(searched).coverage, {
        scanComplete: false,
        resultsComplete: false,
        previewsComplete: true,
        reasons: ["max-records"]
      });
    }
  );
});

test("record search reports complete zero hits and validates effective budgets", async () => {
  await withFixture({ "a.md": "absent" }, async (root) => {
    const searched = await searchRecordText(recordRequest(root, 1));
    assert.deepEqual(contentSearchFacts(searched).counts, {
      matched: { value: 0, precision: "exact" },
      returned: 0
    });
    assert.deepEqual(contentSearchFacts(searched).coverage, {
      scanComplete: true,
      resultsComplete: true,
      previewsComplete: true,
      reasons: []
    });
    assert.deepEqual(searched.limits, {
      maxCandidateFiles: 10_000,
      maxFileBytes: 2 * 1024 * 1024,
      maxTotalBytes: 20 * 1024 * 1024
    });
    await assert.rejects(
      searchRecordText({
        ...recordRequest(root, 1),
        preview: {
          contextLines: 0,
          maxFiles: 0,
          maxMatchesPerFile: 1,
          maxPreviewCharacters: 1
        }
      }),
      (error: unknown) =>
        error instanceof FileTextSearchError && error.code === "invalid-request"
    );
  });
});

test("record search preserves required reads resource failures and cancellation after display exhaustion", async () => {
  await withFixture(
    { "a.md": "needle", "b.md": new Uint8Array([255]) },
    async (root) => {
      await assert.rejects(
        searchRecordText(recordRequest(root, 2, 1)),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "invalid-utf8"
      );
      await assert.rejects(
        searchRecordText({
          ...recordRequest(root, 2, 1),
          limits: { maxTotalBytes: 6 }
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError &&
          error.code === "resource-limit"
      );
      await assert.rejects(
        searchRecordText({
          ...recordRequest(root, 2),
          signal: AbortSignal.abort()
        }),
        (error: unknown) =>
          error instanceof FileTextSearchError && error.code === "aborted"
      );
    }
  );
});

test("record search match-range limits alone do not limit scanning or returned identities", async () => {
  await withFixture(
    { "a.md": "needle needle needle", "b.md": "needle" },
    async (root) => {
      const searched = await searchRecordText(recordRequest(root, 2));
      assert.deepEqual(contentSearchFacts(searched).counts, {
        matched: { value: 2, precision: "exact" },
        returned: 2
      });
      assert.deepEqual(contentSearchFacts(searched).coverage, {
        scanComplete: true,
        resultsComplete: true,
        previewsComplete: false,
        reasons: ["match-previews"]
      });
      assert.equal(searched.hits[0]?.previews[0]?.ranges.length, 2);
    }
  );
});
