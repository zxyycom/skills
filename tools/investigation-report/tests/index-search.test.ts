import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { searchInvestigationReports } from "../src/query.ts";
import {} from "../src/report-path.ts";
import { reportMarkdown, withTempRoot, writeCollection } from "./v6-support.ts";

test("search finds formal Markdown with all, any, phrase, and structural filters", async () => {
  await withTempRoot("search", async (root) => {
    await writeCollection(root, [
      { id: "base", formedAt: "2026-08-28T10:00:00+00:00" },
      {
        id: "supplement",
        formedAt: "2026-08-28T12:00:00+00:00",
        relations: [{ target: "base", type: "补充" }],
        tags: ["alpha", "investigation-report"],
        title: "Alpha phrase title"
      },
      { id: "other", tags: ["other"] }
    ]);
    const all = await searchInvestigationReports({
      query: "Alpha 当前",
      workspaceRoot: root
    });
    assert.deepEqual(
      all.entries.map((entry) => entry.id),
      ["supplement"]
    );
    assert.equal(all.entries[0]?.sourcePath, "supplement.md");
    const allEntry = all.entries[0];
    assert.ok(
      allEntry !== undefined &&
        "previews" in allEntry &&
        allEntry.previews.length > 0
    );
    const phrase = await searchInvestigationReports({
      match: "phrase",
      query: "Alpha phrase title",
      workspaceRoot: root
    });
    assert.deepEqual(
      phrase.entries.map((entry) => entry.id),
      ["supplement"]
    );
    const any = await searchInvestigationReports({
      match: "any",
      query: "absent Alpha",
      tags: ["alpha"],
      formedAtFrom: "2026-08-28T11:00:00+00:00",
      formedAtTo: "2026-08-28T12:00:00+00:00",
      relationType: "补充",
      workspaceRoot: root
    });
    assert.deepEqual(
      any.entries.map((entry) => entry.id),
      ["supplement"]
    );
  });
});

test("search excludes candidates, resources, and index bytes and falls back read-only", async () => {
  await withTempRoot("search-fallback", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    const directory = `${root}/docs/investigations`;
    await fs.writeFile(
      `${directory}/_candidate.candidate`,
      reportMarkdown({ id: "candidate" }).replace(
        "已形成结果，仍保留适用条件和未知。",
        "candidate-only-term"
      ),
      "utf8"
    );
    await fs.mkdir(`${directory}/_resources/formal`, { recursive: true });
    await fs.writeFile(
      `${directory}/_resources/formal/evidence.txt`,
      "resource-only-term",
      "utf8"
    );
    assert.deepEqual(
      (
        await searchInvestigationReports({
          query: "candidate-only-term",
          workspaceRoot: root
        })
      ).entries,
      []
    );
    assert.deepEqual(
      (
        await searchInvestigationReports({
          query: "resource-only-term",
          workspaceRoot: root
        })
      ).entries,
      []
    );
    const indexPath = `${directory}/investigation-index.json`;
    await fs.rm(indexPath);
    const fallback = await searchInvestigationReports({
      query: "当前",
      workspaceRoot: root
    });
    assert.equal(fallback.status, "ok");
    assert.deepEqual(
      fallback.entries.map((entry) => entry.id),
      ["formal"]
    );
    assert.equal(fallback.warnings.length, 1);
    await assert.rejects(fs.access(indexPath));
  });
});
